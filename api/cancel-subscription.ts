import {
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireEnv,
    requireAuthenticatedUser,
} from '../lib/serverApi';

/**
 * Cancel Subscription API
 * 
 * Cancels a user's Razorpay subscription and updates the database.
 * The user keeps access until the current billing period ends.
 */

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;

        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, user_id);

        const supabase = getSupabaseAdminClient();

        // 1. Get user's current subscription
        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['active', 'pending'])
            .single();

        if (subError || !subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        // 2. Check if there's a Razorpay subscription to cancel
        let razorpayCancelled = false;
        if (subscription.razorpay_subscription_id) {
            try {
                // Cancel the Razorpay subscription
                // Using fetch directly to pass cancel_at_cycle_end parameter
                const auth = Buffer.from(`${requireEnv('VITE_RAZORPAY_KEY_ID')}:${requireEnv('RAZORPAY_KEY_SECRET')}`).toString('base64');
                const response = await fetch(
                    `https://api.razorpay.com/v1/subscriptions/${subscription.razorpay_subscription_id}/cancel`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ cancel_at_cycle_end: true })
                    }
                );

                if (response.ok) {
                    razorpayCancelled = true;
                    console.log(`Cancelled Razorpay subscription: ${subscription.razorpay_subscription_id}`);
                } else {
                    const errorData = await response.json();
                    console.error('Razorpay cancellation error:', errorData);
                    // Continue if already cancelled
                    if (!errorData.error?.description?.includes('cancelled')) {
                        console.warn('Continuing despite Razorpay error - subscription may already be cancelled');
                    }
                }
            } catch (rzpError: any) {
                console.error('Razorpay cancellation error:', rzpError);
                console.warn('Continuing despite Razorpay error - subscription may already be cancelled');
            }
        }

        // 3. Keep entitlement active until the current billing period ends.
        const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
                cancelled_at: new Date().toISOString(),
                cancel_at_period_end: true,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .in('status', ['active', 'pending']);

        if (updateError) {
            console.error('Database update error:', updateError);
            return res.status(500).json({ error: 'Failed to update subscription status' });
        }

        // 4. Log the cancellation event
        await supabase
            .from('fact_subscription_events')
            .insert({
                user_id: userId,
                event_type: 'cancel',
                old_tier: subscription.plan_id,
                new_tier: subscription.plan_id,
                revenue_inr: 0
            });

        // 5. Return success
        return res.status(200).json({
            success: true,
            message: razorpayCancelled
                ? 'Subscription cancelled. You will have access until the end of your current billing period.'
                : 'Subscription marked as cancelled.',
            razorpay_cancelled: razorpayCancelled,
            access_until: subscription.renews_at // They keep access until this date
        });

    } catch (error: any) {
        console.error('Cancel subscription error:', error);
        return res.status(getErrorStatus(error)).json({
            error: getErrorMessage(error, 'Failed to cancel subscription')
        });
    }
}
