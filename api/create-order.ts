import Razorpay from 'razorpay';
import { createClient as createAnonClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { amount_inr, pack_id, user_id, currency = 'INR' } = req.body;

    if (!amount_inr || !pack_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Auth validation: verify the caller is the user themselves
    if (user_id) {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const supabaseUrl = process.env.VITE_SUPABASE_URL;
            const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
            if (supabaseUrl && anonKey) {
                const authClient = createAnonClient(supabaseUrl, anonKey);
                const { data: { user: authUser } } = await authClient.auth.getUser(token);
                if (authUser && authUser.id !== user_id) {
                    return res.status(403).json({ error: 'Cannot create order for another user' });
                }
            }
        }
    }

    try {
        const razorpay = new Razorpay({
            key_id: process.env.VITE_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const options = {
            amount: amount_inr * 100, // amount in the smallest currency unit (paise)
            currency,
            receipt: `receipt_${Date.now()}`,
            notes: {
                pack_id,
                user_id: user_id || '',
                type: 'credit_pack'
            }
        };

        const order = await razorpay.orders.create(options);

        return res.status(200).json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        return res.status(500).json({ error: 'Failed to create order', details: error.message });
    }
}
