import {
    ApiError,
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireAuthenticatedUser,
} from '../lib/serverApi';
import {
    assertRazorpayAmount,
    createRazorpayClient,
    requireRazorpayCapturedPayment,
    verifyOrderSignature,
    verifySubscriptionSignature,
} from '../lib/razorpaySecurity';

async function finalizePackPayment(supabase: any, razorpay: any, userId: string, body: any) {
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
        throw new ApiError(400, 'Missing Razorpay order payment fields');
    }

    verifyOrderSignature(orderId, paymentId, signature);

    const { data: purchase, error: purchaseError } = await supabase
        .from('credit_purchases')
        .select('id, user_id, pack_id, credits_added, amount_inr, status, razorpay_order_id')
        .eq('user_id', userId)
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

    if (purchaseError || !purchase) {
        throw new ApiError(404, 'Pending credit purchase not found');
    }

    if (purchase.status === 'completed') {
        return { success: true, duplicate: true };
    }

    const payment = await razorpay.payments.fetch(paymentId);
    requireRazorpayCapturedPayment(payment);

    if (payment.order_id !== orderId) {
        throw new ApiError(400, 'Payment order mismatch');
    }

    assertRazorpayAmount(payment, Number(purchase.amount_inr), 'INR');

    const { data, error } = await supabase.rpc('verify_razorpay_payment', {
        p_user_id: userId,
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_signature: signature,
        p_plan_id: purchase.pack_id,
        p_type: 'pack',
        p_subscription_id: null,
        p_payload: { payment },
    });

    if (error) {
        throw error;
    }

    await supabase
        .from('credit_purchases')
        .update({
            status: 'completed',
            razorpay_payment_id: paymentId,
        })
        .eq('id', purchase.id);

    await supabase
        .from('billing_payment_intents')
        .update({
            status: 'completed',
            provider_payment_id: paymentId,
            completed_at: new Date().toISOString(),
        })
        .eq('provider', 'razorpay')
        .eq('provider_order_id', orderId)
        .eq('user_id', userId);

    return data || { success: true };
}

async function finalizeSubscriptionPayment(supabase: any, razorpay: any, userId: string, body: any) {
    const subscriptionId = body.razorpay_subscription_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (!subscriptionId || !paymentId || !signature) {
        throw new ApiError(400, 'Missing Razorpay subscription payment fields');
    }

    verifySubscriptionSignature(subscriptionId, paymentId, signature);

    const { data: intent, error: intentError } = await supabase
        .from('billing_payment_intents')
        .select('*')
        .eq('provider', 'razorpay')
        .eq('user_id', userId)
        .eq('provider_subscription_id', subscriptionId)
        .eq('item_type', 'subscription')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (intentError || !intent) {
        throw new ApiError(404, 'Pending subscription intent not found');
    }

    if (intent.status === 'completed') {
        return { success: true, duplicate: true };
    }

    const [payment, subscription] = await Promise.all([
        razorpay.payments.fetch(paymentId),
        razorpay.subscriptions.fetch(subscriptionId),
    ]);

    requireRazorpayCapturedPayment(payment);

    if (payment.subscription_id !== subscriptionId) {
        throw new ApiError(400, 'Payment subscription mismatch');
    }

    if (subscription.plan_id !== intent.provider_plan_id) {
        throw new ApiError(400, 'Subscription plan mismatch');
    }

    const allowedAmounts = Array.isArray(intent.metadata?.allowed_amounts_inr)
        ? intent.metadata.allowed_amounts_inr.map(Number).filter((amount: number) => amount > 0)
        : [Number(intent.amount_inr)];

    const amountMatches = allowedAmounts.some((amount: number) =>
        payment.amount === amount * 100 && payment.currency === intent.currency
    );

    if (!amountMatches) {
        throw new ApiError(400, 'Payment amount or currency mismatch');
    }

    const { data, error } = await supabase.rpc('verify_razorpay_payment', {
        p_user_id: userId,
        p_order_id: subscriptionId,
        p_payment_id: paymentId,
        p_signature: signature,
        p_plan_id: intent.item_id,
        p_type: 'subscription',
        p_subscription_id: subscriptionId,
        p_payload: { payment, subscription },
    });

    if (error) {
        throw error;
    }

    await supabase
        .from('billing_payment_intents')
        .update({
            status: 'completed',
            provider_payment_id: paymentId,
            completed_at: new Date().toISOString(),
            metadata: {
                ...(intent.metadata || {}),
                payment_status: payment.status,
            },
        })
        .eq('id', intent.id);

    return data || { success: true };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, req.body?.user_id || req.body?.userId);
        const type = req.body?.type === 'pack' ? 'pack' : 'subscription';

        if (!req.body?.razorpay_payment_id || !req.body?.razorpay_signature) {
            return res.status(400).json({ error: 'Missing required payment fields' });
        }

        const supabase = getSupabaseAdminClient();
        const razorpay = createRazorpayClient();
        const result = type === 'pack'
            ? await finalizePackPayment(supabase, razorpay, userId, req.body)
            : await finalizeSubscriptionPayment(supabase, razorpay, userId, req.body);

        return res.status(200).json({ success: true, verified: true, result });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(getErrorStatus(error)).json({
            error: getErrorMessage(error, 'Payment verification failed'),
        });
    }
}
