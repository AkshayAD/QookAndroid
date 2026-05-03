import Razorpay from 'razorpay';
import { authenticateSupabaseUser } from '../lib/supabaseAuth';

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
        const { userId: authUserId } = await authenticateSupabaseUser(req.headers.authorization);
        if (authUserId && authUserId !== user_id) {
            return res.status(403).json({ error: 'Cannot create order for another user' });
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
