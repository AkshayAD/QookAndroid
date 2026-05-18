import { getErrorMessage, getErrorStatus, getSupabaseAdminClient } from '../lib/serverApi';
import { verifyWebhookSignature } from '../lib/razorpaySecurity';

export const config = {
    api: {
        bodyParser: false,
    },
};

async function readRawBody(req: any): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

function getEntityId(payload: any): string {
    return payload?.payment?.entity?.id
        || payload?.subscription?.entity?.id
        || payload?.order?.entity?.id
        || 'unknown';
}

function getWebhookEventKey(req: any, event: any): string {
    const headerId = req.headers['x-razorpay-event-id'];
    if (typeof headerId === 'string' && headerId) {
        return headerId;
    }
    if (event?.id) {
        return event.id;
    }
    return [
        event?.event || 'unknown',
        getEntityId(event?.payload),
        event?.created_at || 'no-ts',
    ].join(':');
}

async function beginWebhookEvent(supabase: any, eventKey: string, eventType: string, payload: any) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('billing_webhook_events')
        .insert({
            provider: 'razorpay',
            event_key: eventKey,
            event_type: eventType,
            status: 'processing',
            payload,
            attempt_count: 1,
            updated_at: now,
        })
        .select('id, status, updated_at')
        .single();

    if (!error) {
        return { id: data.id, duplicate: false };
    }

    if (error.code !== '23505') {
        throw error;
    }

    const { data: existing, error: existingError } = await supabase
        .from('billing_webhook_events')
        .select('id, status, updated_at, attempt_count')
        .eq('provider', 'razorpay')
        .eq('event_key', eventKey)
        .single();

    if (existingError) {
        throw existingError;
    }

    if (existing.status === 'processed') {
        return { id: existing.id, duplicate: true };
    }

    const updatedAt = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
    const freshProcessing = existing.status === 'processing'
        && Number.isFinite(updatedAt)
        && Date.now() - updatedAt < 10 * 60 * 1000;

    if (freshProcessing) {
        return { id: existing.id, duplicate: true };
    }

    const { data: retried, error: retryError } = await supabase
        .from('billing_webhook_events')
        .update({
            status: 'processing',
            payload,
            error_message: null,
            attempt_count: (existing.attempt_count || 0) + 1,
            updated_at: now,
        })
        .eq('id', existing.id)
        .select('id')
        .single();

    if (retryError) {
        throw retryError;
    }

    return { id: retried.id, duplicate: false };
}

async function markWebhookEvent(supabase: any, id: string, status: 'processed' | 'failed', errorMessage?: string) {
    await supabase
        .from('billing_webhook_events')
        .update({
            status,
            error_message: errorMessage || null,
            processed_at: status === 'processed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);
}

async function findUserBySubscription(supabase: any, razorpaySubscriptionId: string) {
    const { data: intent } = await supabase
        .from('billing_payment_intents')
        .select('user_id, item_id, provider_plan_id')
        .eq('provider', 'razorpay')
        .eq('provider_subscription_id', razorpaySubscriptionId)
        .eq('item_type', 'subscription')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (intent) {
        return {
            user_id: intent.user_id,
            plan_id: intent.item_id,
            provider_plan_id: intent.provider_plan_id,
        };
    }

    const { data } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_id')
        .eq('razorpay_subscription_id', razorpaySubscriptionId)
        .maybeSingle();

    return data;
}

async function resolveInternalPlanId(supabase: any, razorpayPlanId: string): Promise<string | null> {
    const { data } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('razorpay_plan_id', razorpayPlanId)
        .maybeSingle();
    return data?.id || null;
}

async function logSubscriptionEvent(
    supabase: any,
    userId: string,
    eventType: string,
    oldTier: string | null,
    newTier: string,
    revenueInr: number
) {
    await supabase
        .from('fact_subscription_events')
        .insert({
            user_id: userId,
            event_type: eventType,
            old_tier: oldTier,
            new_tier: newTier,
            revenue_inr: revenueInr,
        });
}

async function handleSubscriptionActivated(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const user = await findUserBySubscription(supabase, subscription.id);
    if (!user) {
        throw new Error(`No user found for subscription ${subscription.id}`);
    }

    const internalPlanId = user.plan_id
        || await resolveInternalPlanId(supabase, subscription.plan_id);

    if (!internalPlanId) {
        throw new Error(`No internal plan found for Razorpay plan ${subscription.plan_id}`);
    }

    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setDate(renewsAt.getDate() + 28);

    const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
            user_id: user.user_id,
            plan_id: internalPlanId,
            status: 'active',
            razorpay_subscription_id: subscription.id,
            razorpay_customer_id: subscription.customer_id || null,
            started_at: now.toISOString(),
            renews_at: renewsAt.toISOString(),
            cancelled_at: null,
            cancel_at_period_end: false,
            updated_at: now.toISOString(),
        }, { onConflict: 'user_id' });

    if (error) throw error;
    await logSubscriptionEvent(supabase, user.user_id, 'subscribe', null, internalPlanId, 0);
}

async function handleSubscriptionCharged(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;
    if (!subscription || !payment?.id) return;

    const user = await findUserBySubscription(supabase, subscription.id);
    if (!user) {
        throw new Error(`No user found for subscription ${subscription.id}`);
    }

    const internalPlanId = user.plan_id
        || await resolveInternalPlanId(supabase, subscription.plan_id);

    if (!internalPlanId) {
        throw new Error(`No internal plan found for Razorpay plan ${subscription.plan_id}`);
    }

    const { data, error } = await supabase.rpc('verify_razorpay_payment', {
        p_user_id: user.user_id,
        p_order_id: subscription.id,
        p_payment_id: payment.id,
        p_signature: '',
        p_plan_id: internalPlanId,
        p_type: 'subscription',
        p_subscription_id: subscription.id,
        p_payload: { payment, subscription, source: 'webhook' },
    });

    if (error) throw error;

    await supabase
        .from('billing_payment_intents')
        .update({
            status: 'completed',
            provider_payment_id: payment.id,
            completed_at: new Date().toISOString(),
        })
        .eq('provider', 'razorpay')
        .eq('provider_subscription_id', subscription.id)
        .eq('user_id', user.user_id);

    const amountInr = payment.amount ? Math.round(payment.amount / 100) : 0;
    if (!data?.duplicate) {
        await logSubscriptionEvent(supabase, user.user_id, 'renew', internalPlanId, internalPlanId, amountInr);
    }
}

async function handlePaymentCaptured(supabase: any, payload: any) {
    const payment = payload.payment?.entity;
    if (!payment?.order_id || !payment?.id) return;

    const { data: purchase } = await supabase
        .from('credit_purchases')
        .select('id, user_id, pack_id, amount_inr, status')
        .eq('razorpay_order_id', payment.order_id)
        .maybeSingle();

    if (!purchase || purchase.status === 'completed') return;
    if (payment.amount !== Number(purchase.amount_inr) * 100 || payment.currency !== 'INR') {
        throw new Error(`Captured payment amount mismatch for order ${payment.order_id}`);
    }

    const { error } = await supabase.rpc('verify_razorpay_payment', {
        p_user_id: purchase.user_id,
        p_order_id: payment.order_id,
        p_payment_id: payment.id,
        p_signature: '',
        p_plan_id: purchase.pack_id,
        p_type: 'pack',
        p_subscription_id: null,
        p_payload: { payment, source: 'webhook' },
    });

    if (error) throw error;

    await supabase
        .from('credit_purchases')
        .update({
            status: 'completed',
            razorpay_payment_id: payment.id,
        })
        .eq('id', purchase.id);

    await supabase
        .from('billing_payment_intents')
        .update({
            status: 'completed',
            provider_payment_id: payment.id,
            completed_at: new Date().toISOString(),
        })
        .eq('provider', 'razorpay')
        .eq('provider_order_id', payment.order_id)
        .eq('user_id', purchase.user_id);
}

async function handleSubscriptionCancelled(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const user = await findUserBySubscription(supabase, subscription.id);
    if (!user) return;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'cancelled',
            plan_id: 'free',
            razorpay_subscription_id: null,
            cancel_at_period_end: false,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.user_id);

    if (error) throw error;
    await logSubscriptionEvent(supabase, user.user_id, 'cancel', user.plan_id, 'free', 0);
}

async function handleSubscriptionCompleted(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const user = await findUserBySubscription(supabase, subscription.id);
    if (!user) return;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'expired',
            plan_id: 'free',
            razorpay_subscription_id: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.user_id);

    if (error) throw error;
    await logSubscriptionEvent(supabase, user.user_id, 'downgrade', user.plan_id, 'free', 0);
}

async function handleSubscriptionState(supabase: any, payload: any, status: string) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const user = await findUserBySubscription(supabase, subscription.id);
    if (!user) return;

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            status,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.user_id);

    if (error) throw error;
}

async function handlePaymentFailed(supabase: any, payload: any) {
    const payment = payload.payment?.entity;
    if (!payment?.subscription_id) return;

    const user = await findUserBySubscription(supabase, payment.subscription_id);
    if (!user) return;

    await supabase
        .from('fact_subscription_events')
        .insert({
            user_id: user.user_id,
            event_type: 'cancel',
            old_tier: user.plan_id,
            new_tier: user.plan_id,
            revenue_inr: 0,
            payment_method: `failed:${payment.error_code || 'unknown'}`,
        });
}

async function processWebhookEvent(supabase: any, eventType: string, payload: any) {
    switch (eventType) {
        case 'payment.captured':
            await handlePaymentCaptured(supabase, payload);
            break;
        case 'subscription.activated':
            await handleSubscriptionActivated(supabase, payload);
            break;
        case 'subscription.charged':
            await handleSubscriptionCharged(supabase, payload);
            break;
        case 'subscription.cancelled':
            await handleSubscriptionCancelled(supabase, payload);
            break;
        case 'subscription.completed':
            await handleSubscriptionCompleted(supabase, payload);
            break;
        case 'subscription.halted':
            await handleSubscriptionState(supabase, payload, 'halted');
            break;
        case 'subscription.pending':
            await handleSubscriptionState(supabase, payload, 'pending');
            break;
        case 'payment.failed':
            await handlePaymentFailed(supabase, payload);
            break;
        default:
            break;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing signature' });
    }

    let eventId: string | null = null;
    let supabase: any = null;

    try {
        supabase = getSupabaseAdminClient();
        const rawBody = await readRawBody(req);
        verifyWebhookSignature(rawBody, signature);

        const event = JSON.parse(rawBody);
        const eventType = event?.event;
        const payload = event?.payload;

        if (!eventType || !payload) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        const eventKey = getWebhookEventKey(req, event);
        const webhookEvent = await beginWebhookEvent(supabase, eventKey, eventType, event);
        eventId = webhookEvent.id;

        if (webhookEvent.duplicate) {
            return res.status(200).json({ status: 'duplicate', event: eventType });
        }

        await processWebhookEvent(supabase, eventType, payload);
        await markWebhookEvent(supabase, eventId, 'processed');

        return res.status(200).json({ status: 'ok', event: eventType });
    } catch (error) {
        console.error('Razorpay webhook error:', error);
        if (eventId && supabase) {
            await markWebhookEvent(supabase, eventId, 'failed', error instanceof Error ? error.message : 'unknown');
        }
        return res.status(getErrorStatus(error)).json({
            error: getErrorMessage(error, 'Webhook processing failed'),
        });
    }
}
