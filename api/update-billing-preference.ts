import {
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireAuthenticatedUser,
} from '../lib/serverApi';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, req.body?.user_id || req.body?.userId);
        const preference = req.body?.preference;

        if (preference !== 'credits' && preference !== 'byok') {
            return res.status(400).json({ error: 'Invalid billing preference' });
        }

        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
            .from('user_subscriptions')
            .update({
                billing_preference: preference,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        if (error) {
            throw error;
        }

        return res.status(200).json({ success: true, billing_preference: preference });
    } catch (error) {
        console.error('Update billing preference error:', error);
        return res.status(getErrorStatus(error)).json({
            error: getErrorMessage(error, 'Failed to update billing preference'),
        });
    }
}
