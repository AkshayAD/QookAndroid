import {
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireAuthenticatedUser,
} from '../lib/serverApi';
import { createRazorpayClient, getRazorpayKeyId } from '../lib/razorpaySecurity';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, req.body?.user_id || req.body?.userId);
        const packId = req.body?.pack_id || req.body?.packId;

        if (!packId) {
            return res.status(400).json({ error: 'pack_id is required' });
        }

        const supabase = getSupabaseAdminClient();
        const { data: pack, error: packError } = await supabase
            .from('credit_packs')
            .select('id, name, credits, price_inr, validity_days, is_active')
            .eq('id', packId)
            .eq('is_active', true)
            .single();

        if (packError || !pack) {
            return res.status(404).json({ error: 'Credit pack not found' });
        }

        const razorpay = createRazorpayClient();
        const receipt = `pack_${pack.id}_${Date.now()}`;
        const order = await razorpay.orders.create({
            amount: Number(pack.price_inr) * 100,
            currency: 'INR',
            receipt,
            notes: {
                pack_id: pack.id,
                user_id: userId,
                type: 'credit_pack',
            },
        });

        await supabase
            .from('credit_purchases')
            .insert({
                user_id: userId,
                pack_id: pack.id,
                credits_added: pack.credits,
                amount_inr: pack.price_inr,
                razorpay_order_id: order.id,
                status: 'pending',
            });

        await supabase
            .from('billing_payment_intents')
            .insert({
                provider: 'razorpay',
                user_id: userId,
                item_type: 'pack',
                item_id: pack.id,
                amount_inr: pack.price_inr,
                currency: 'INR',
                status: 'pending',
                provider_order_id: order.id,
                metadata: {
                    credits: pack.credits,
                    validity_days: pack.validity_days,
                },
            });

        return res.status(200).json({
            ...order,
            key_id: getRazorpayKeyId(),
            pack_id: pack.id,
            amount: Number(pack.price_inr) * 100,
            amount_inr: Number(pack.price_inr),
            currency: 'INR',
            credits: Number(pack.credits),
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        return res.status(getErrorStatus(error)).json({
            error: getErrorMessage(error, 'Failed to create order'),
        });
    }
}
