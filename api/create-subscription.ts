import {
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireAuthenticatedUser,
} from '../lib/serverApi';
import { createRazorpayClient, getRazorpayKeyId } from '../lib/razorpaySecurity';

function getAllowedSubscriptionAmounts(plan: any): number[] {
    return Array.from(new Set([
        Number(plan.first_month_price ?? 0),
        Number(plan.regular_price ?? 0),
        Number(plan.price_inr ?? 0),
    ].filter((amount) => amount > 0)));
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, req.body?.user_id || req.body?.userId);
        const internalPlanId = req.body?.internal_plan_id || req.body?.internalPlanId || req.body?.plan_id;
        const totalCount = Number(req.body?.total_count || 120);
        const applyFirstMonthDiscount = req.body?.apply_first_month_discount !== false;

        if (!internalPlanId) {
            return res.status(400).json({ error: 'internal_plan_id is required' });
        }

        const supabase = getSupabaseAdminClient();
        const { data: plan, error: planError } = await supabase
            .from('subscription_plans')
            .select('id, name, price_inr, first_month_price, regular_price, monthly_credits, razorpay_plan_id, razorpay_offer_id, razorpay_upi_offer_id, is_active')
            .eq('id', internalPlanId)
            .eq('is_active', true)
            .single();

        if (planError || !plan) {
            return res.status(404).json({ error: 'Subscription plan not found' });
        }

        if (!plan.razorpay_plan_id) {
            return res.status(400).json({ error: 'Subscription plan is not configured for Razorpay' });
        }

        const offerId = applyFirstMonthDiscount
            ? plan.razorpay_offer_id || plan.razorpay_upi_offer_id || null
            : null;

        const razorpay = createRazorpayClient();
        const subscriptionOptions: any = {
            plan_id: plan.razorpay_plan_id,
            total_count: Number.isFinite(totalCount) && totalCount > 0 ? totalCount : 120,
            quantity: 1,
            customer_notify: 1,
            notes: {
                user_id: userId,
                internal_plan_id: plan.id,
                type: 'subscription',
            },
        };

        if (offerId) {
            subscriptionOptions.offer_id = offerId;
        }

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);
        const allowedAmounts = getAllowedSubscriptionAmounts(plan);
        const intendedAmount = allowedAmounts[0] || Number(plan.price_inr || 0);

        await supabase
            .from('billing_payment_intents')
            .insert({
                provider: 'razorpay',
                user_id: userId,
                item_type: 'subscription',
                item_id: plan.id,
                amount_inr: intendedAmount,
                currency: 'INR',
                status: 'pending',
                provider_subscription_id: subscription.id,
                provider_plan_id: plan.razorpay_plan_id,
                metadata: {
                    offer_id: offerId,
                    allowed_amounts_inr: allowedAmounts,
                },
            });

        await supabase
            .from('user_subscriptions')
            .update({
                razorpay_subscription_id: subscription.id,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        return res.status(200).json({
            ...subscription,
            key_id: getRazorpayKeyId(),
            subscription_id: subscription.id,
            internal_plan_id: plan.id,
            offer_applied: Boolean(offerId),
        });
    } catch (error) {
        console.error('Error creating Razorpay subscription:', error);
        return res.status(getErrorStatus(error)).json({
            error: getErrorMessage(error, 'Failed to create subscription'),
        });
    }
}
