import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Razorpay Webhook Handler
 *
 * Processes Razorpay subscription and payment lifecycle events.
 * This is the source of truth for subscription status changes
 * and recurring credit grants.
 *
 * Configure the webhook URL in Razorpay Dashboard:
 *   https://your-domain.com/api/razorpay-webhook
 *
 * Required events to enable:
 *   - subscription.activated
 *   - subscription.charged
 *   - subscription.cancelled
 *   - subscription.completed
 *   - subscription.halted
 *   - subscription.pending
 *   - payment.failed
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
    );
}

export default async function handler(req: any, res: any) {
    // Only accept POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Verify Razorpay signature
    const razorpaySignature = req.headers['x-razorpay-signature'];
    if (!razorpaySignature) {
        console.warn('Webhook received without signature header');
        return res.status(400).json({ error: 'Missing signature' });
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (webhookSecret) {
        try {
            const isValid = verifyWebhookSignature(rawBody, razorpaySignature, webhookSecret);
            if (!isValid) {
                console.error('Webhook signature verification failed');
                return res.status(400).json({ error: 'Invalid signature' });
            }
        } catch (err: any) {
            console.error('Signature verification error:', err.message);
            return res.status(400).json({ error: 'Signature verification failed' });
        }
    } else {
        console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification');
    }

    // 2. Parse event
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType = event?.event;
    const payload = event?.payload;

    if (!eventType || !payload) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log(`Razorpay webhook received: ${eventType}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        switch (eventType) {
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
                await handleSubscriptionHalted(supabase, payload);
                break;

            case 'subscription.pending':
                await handleSubscriptionPending(supabase, payload);
                break;

            case 'payment.failed':
                await handlePaymentFailed(supabase, payload);
                break;

            default:
                console.log(`Unhandled webhook event: ${eventType}`);
        }

        // Always respond 200 to Razorpay to acknowledge receipt
        return res.status(200).json({ status: 'ok', event: eventType });
    } catch (error: any) {
        console.error(`Error processing webhook ${eventType}:`, error);
        // Still return 200 to prevent Razorpay retries on app-level errors
        // Razorpay will keep retrying on non-2xx, which could cause duplicates
        return res.status(200).json({ status: 'error', message: error.message });
    }
}

// =====================================================
// Event Handlers
// =====================================================

/**
 * subscription.activated — First payment successful, subscription is now active.
 * This is where we link the Razorpay subscription to our database record.
 */
async function handleSubscriptionActivated(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const razorpayPlanId = subscription.plan_id;
    const razorpayCustomerId = subscription.customer_id;

    // Find the user by their razorpay_subscription_id
    // (set during create-subscription or verify-payment)
    const user = await findUserByRazorpaySubscription(supabase, razorpaySubId);

    if (!user) {
        console.warn(`subscription.activated: No user found for Razorpay sub ${razorpaySubId}`);
        return;
    }

    // Look up internal plan from razorpay_plan_id
    const internalPlanId = await resolveInternalPlanId(supabase, razorpayPlanId) || user.plan_id;

    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setDate(renewsAt.getDate() + 28);

    await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            plan_id: internalPlanId,
            razorpay_subscription_id: razorpaySubId,
            razorpay_customer_id: razorpayCustomerId || null,
            started_at: now.toISOString(),
            renews_at: renewsAt.toISOString(),
            cancelled_at: null,
            updated_at: now.toISOString(),
        })
        .eq('user_id', user.user_id);

    await logSubscriptionEvent(supabase, user.user_id, 'subscribe', null, internalPlanId, 0);

    console.log(`subscription.activated: User ${user.user_id} activated on plan ${internalPlanId}`);
}

/**
 * subscription.charged — A recurring payment was collected.
 * Grant credits for the new billing period.
 */
async function handleSubscriptionCharged(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;
    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const user = await findUserByRazorpaySubscription(supabase, razorpaySubId);

    if (!user) {
        console.warn(`subscription.charged: No user found for Razorpay sub ${razorpaySubId}`);
        return;
    }

    const internalPlanId = user.plan_id;

    // Fetch plan details for credit amounts
    const { data: plan } = await supabase
        .from('subscription_plans')
        .select('unified_credits, monthly_credits, weekly_bonus, weekly_bonus_credits')
        .eq('id', internalPlanId)
        .single();

    const monthlyCredits = plan?.unified_credits ?? plan?.monthly_credits ?? 0;

    // Update billing period
    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setDate(renewsAt.getDate() + 28);

    await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            renews_at: renewsAt.toISOString(),
            updated_at: now.toISOString(),
        })
        .eq('user_id', user.user_id);

    // Grant monthly credits (skip for BYOK/unlimited plans)
    if (monthlyCredits > 0) {
        await supabase
            .from('user_credits')
            .insert({
                user_id: user.user_id,
                credit_type: 'plan',
                credits: monthlyCredits,
                meal_credits: monthlyCredits,
                grocery_credits: 0,
                edit_credits: 0,
                regen_credits: 0,
                expires_at: renewsAt.toISOString(),
            });
    }

    // Log the charge event
    const amountInr = payment?.amount ? Math.round(payment.amount / 100) : 0;
    await logSubscriptionEvent(supabase, user.user_id, 'renew', internalPlanId, internalPlanId, amountInr);

    console.log(`subscription.charged: User ${user.user_id} renewed, granted ${monthlyCredits} credits`);
}

/**
 * subscription.cancelled — Razorpay confirms the subscription was cancelled.
 * If cancel_at_cycle_end was true, the user keeps access until period ends.
 */
async function handleSubscriptionCancelled(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const user = await findUserByRazorpaySubscription(supabase, razorpaySubId);

    if (!user) {
        console.warn(`subscription.cancelled: No user found for Razorpay sub ${razorpaySubId}`);
        return;
    }

    // Only update if not already cancelled (avoid overwriting cancelled_at)
    if (user.status !== 'cancelled') {
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.user_id)
            .eq('status', 'active');
    }

    await logSubscriptionEvent(supabase, user.user_id, 'cancel', user.plan_id, 'free', 0);

    console.log(`subscription.cancelled: User ${user.user_id} subscription cancelled`);
}

/**
 * subscription.completed — The subscription has ended (all cycles completed
 * or billing period expired after cancellation).
 * Downgrade user to free.
 */
async function handleSubscriptionCompleted(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const user = await findUserByRazorpaySubscription(supabase, razorpaySubId);

    if (!user) {
        console.warn(`subscription.completed: No user found for Razorpay sub ${razorpaySubId}`);
        return;
    }

    const oldTier = user.plan_id;

    await supabase
        .from('user_subscriptions')
        .update({
            status: 'expired',
            plan_id: 'free',
            razorpay_subscription_id: null,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.user_id);

    await logSubscriptionEvent(supabase, user.user_id, 'downgrade', oldTier, 'free', 0);

    console.log(`subscription.completed: User ${user.user_id} downgraded to free`);
}

/**
 * subscription.halted — Multiple payment retries failed.
 * User should be notified to update payment method.
 */
async function handleSubscriptionHalted(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const user = await findUserByRazorpaySubscription(supabase, razorpaySubId);

    if (!user) {
        console.warn(`subscription.halted: No user found for Razorpay sub ${razorpaySubId}`);
        return;
    }

    // Use 'halted' status — CHECK constraint was updated to allow this
    await supabase
        .from('user_subscriptions')
        .update({
            status: 'halted',
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.user_id);

    await logSubscriptionEvent(supabase, user.user_id, 'cancel', user.plan_id, 'free', 0);

    console.log(`subscription.halted: User ${user.user_id} subscription halted due to payment failures`);
}

/**
 * subscription.pending — Subscription created but first payment not yet completed.
 */
async function handleSubscriptionPending(supabase: any, payload: any) {
    const subscription = payload.subscription?.entity;
    if (!subscription) return;

    console.log(`subscription.pending: Razorpay sub ${subscription.id} is pending first payment`);
    // No action needed — subscription will be activated once payment succeeds
}

/**
 * payment.failed — A payment attempt failed.
 * Log it for tracking; Razorpay will retry automatically.
 */
async function handlePaymentFailed(supabase: any, payload: any) {
    const payment = payload.payment?.entity;
    if (!payment) return;

    const errorDescription = payment.error_description || 'Unknown error';
    const errorCode = payment.error_code || 'unknown';

    console.log(`payment.failed: Payment ${payment.id} failed — ${errorCode}: ${errorDescription}`);

    // If this is tied to a subscription, find the user
    if (payment.subscription_id) {
        const user = await findUserByRazorpaySubscription(supabase, payment.subscription_id);
        if (user) {
            try {
                await supabase
                    .from('fact_subscription_events')
                    .insert({
                        user_id: user.user_id,
                        event_type: 'cancel', // closest allowed event type
                        old_tier: user.plan_id,
                        new_tier: user.plan_id,
                        revenue_inr: 0,
                        payment_method: `failed:${errorCode}`,
                    });
            } catch (analyticsError) {
                console.warn('Failed to log payment failure event:', analyticsError);
            }
        }
    }
}

// =====================================================
// Helper Functions
// =====================================================

async function findUserByRazorpaySubscription(
    supabase: any,
    razorpaySubscriptionId: string
): Promise<{ user_id: string; plan_id: string; status: string } | null> {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_id, status')
        .eq('razorpay_subscription_id', razorpaySubscriptionId)
        .maybeSingle();

    if (error) {
        console.error('Error finding user by Razorpay subscription:', error);
        return null;
    }

    return data;
}

async function resolveInternalPlanId(
    supabase: any,
    razorpayPlanId: string
): Promise<string | null> {
    const { data, error } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('razorpay_plan_id', razorpayPlanId)
        .maybeSingle();

    if (error || !data) {
        console.warn(`Could not resolve internal plan for Razorpay plan ${razorpayPlanId}`);
        return null;
    }

    return data.id;
}

async function logSubscriptionEvent(
    supabase: any,
    userId: string,
    eventType: string,
    oldTier: string | null,
    newTier: string,
    revenueInr: number
): Promise<void> {
    try {
        await supabase
            .from('fact_subscription_events')
            .insert({
                user_id: userId,
                event_type: eventType,
                old_tier: oldTier,
                new_tier: newTier,
                revenue_inr: revenueInr,
            });
    } catch (error) {
        console.warn('Failed to log subscription event:', error);
    }
}
