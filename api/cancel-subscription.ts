import { createClient } from '@supabase/supabase-js';
import { authenticateSupabaseUser } from '../lib/supabaseAuth';

/**
 * Cancel Subscription API
 * 
 * Cancels a user's Razorpay subscription and updates the database.
 * The user keeps access until the current billing period ends.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Auth validation: verify the caller is the user themselves
        const { userId: authUserId } = await authenticateSupabaseUser(req.headers.authorization);
        if (authUserId && authUserId !== user_id) {
            return res.status(403).json({ error: 'Cannot cancel another user\'s subscription' });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get user's current subscription
        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user_id)
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
                const auth = Buffer.from(`${process.env.VITE_RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
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

        // 3. Update database - mark as cancelled (only active/pending subscriptions)
        const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id)
            .in('status', ['active', 'pending']);

        if (updateError) {
            console.error('Database update error:', updateError);
            return res.status(500).json({ error: 'Failed to update subscription status' });
        }

        // 4. Log the cancellation event
        await supabase
            .from('fact_subscription_events')
            .insert({
                user_id,
                event_type: 'cancel',
                old_tier: subscription.plan_id,
                new_tier: 'free',
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
        return res.status(500).json({
            error: 'Failed to cancel subscription',
            details: error.message
        });
    }
}
