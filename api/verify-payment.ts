
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpay_subscription_id,
        user_id,
        plan_id, // Internal plan ID or pack ID
        type // 'subscription' or 'pack'
    } = req.body;

    if (!razorpay_payment_id || !razorpay_signature || !user_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const key_secret = process.env.RAZORPAY_KEY_SECRET;

        // 1. Verify Signature
        let generated_signature = '';

        if (type === 'subscription') {
            // Subscription signature: razorpay_payment_id + | + razorpay_subscription_id
            const message = razorpay_payment_id + '|' + razorpay_subscription_id;
            generated_signature = crypto
                .createHmac('sha256', key_secret)
                .update(message)
                .digest('hex');
        } else {
            // Order signature: razorpay_order_id + | + razorpay_payment_id
            const message = razorpay_order_id + '|' + razorpay_payment_id;
            generated_signature = crypto
                .createHmac('sha256', key_secret)
                .update(message)
                .digest('hex');
        }

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // 2. Grant Benefits via Supabase RPC
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase.rpc('verify_razorpay_payment', {
            p_user_id: user_id,
            p_order_id: razorpay_order_id || razorpay_subscription_id,
            p_payment_id: razorpay_payment_id,
            p_signature: razorpay_signature,
            p_plan_id: plan_id
        });

        if (error) throw error;

        return res.status(200).json({ success: true, verified: true });

    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ error: 'Verification failed', details: error.message });
    }
}
