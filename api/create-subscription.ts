import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { authenticateSupabaseUser } from '../lib/supabaseAuth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        plan_id,                    // Razorpay plan ID
        internal_plan_id,           // Internal plan ID (e.g., 'basic', 'pro') to look up offer
        user_id,                    // User ID (validated against auth token)
        total_count = 120,          // Default 10 years (120 months)
        offer_id: providedOfferId,  // Optional: Override offer ID
        apply_first_month_discount = true // Whether to apply first-month discount offer
    } = req.body;

    if (!plan_id) {
        return res.status(400).json({ error: 'Missing plan_id' });
    }

    try {
        // Initialize Supabase client for server-side
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Auth validation: verify the caller is the user themselves
        if (user_id) {
            const { userId: authUserId } = await authenticateSupabaseUser(req.headers.authorization);
            if (authUserId && authUserId !== user_id) {
                return res.status(403).json({ error: 'Cannot create subscription for another user' });
            }
        }

        let offerId = providedOfferId;

        // If internal_plan_id provided and no override, fetch offer_id from database
        // Try both razorpay_offer_id (card) and razorpay_upi_offer_id (UPI)
        if (internal_plan_id && !providedOfferId && apply_first_month_discount) {
            if (supabaseUrl && supabaseServiceKey) {
                const supabase = createClient(supabaseUrl, supabaseServiceKey);

                const { data: planData, error: planError } = await supabase
                    .from('subscription_plans')
                    .select('razorpay_offer_id, razorpay_upi_offer_id')
                    .eq('id', internal_plan_id)
                    .single();

                if (!planError && planData) {
                    // Prefer the general offer; UPI offer can be applied at checkout level
                    offerId = planData.razorpay_offer_id || planData.razorpay_upi_offer_id;
                    if (offerId) {
                        console.log(`Applying offer ${offerId} for plan ${internal_plan_id}`);
                    }
                }
            }
        }

        // Initialize Razorpay
        const razorpay = new Razorpay({
            key_id: process.env.VITE_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Build subscription options
        const subscriptionOptions: any = {
            plan_id,
            total_count,
            quantity: 1,
            customer_notify: 1,
        };

        // Apply Razorpay offer if available (for first-month discount)
        // Razorpay only supports single offer_id per subscription
        if (offerId) {
            subscriptionOptions.offer_id = offerId;
            console.log('Creating subscription with offer:', offerId);
        }

        const subscription = await razorpay.subscriptions.create(subscriptionOptions);

        // Save the razorpay_subscription_id to the database immediately
        // This ensures we can track it even if the client-side callback fails
        if (user_id && supabaseUrl && supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            await supabase
                .from('user_subscriptions')
                .update({
                    razorpay_subscription_id: subscription.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user_id);
        }

        return res.status(200).json({
            ...subscription,
            offer_applied: !!offerId
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        return res.status(500).json({ error: 'Failed to create subscription', details: error.message });
    }
}
