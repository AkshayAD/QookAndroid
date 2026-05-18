import { createClient } from '@supabase/supabase-js';
import {
    applyCors,
    assertRequestUser,
    getErrorMessage,
    getErrorStatus,
    requireAuthenticatedUser,
    requireEnv,
} from '../lib/serverApi';

/**
 * Account Deletion API
 * 
 * Soft-deletes a user account:
 * - Archives user data to deleted_users table
 * - Marks all user data with deleted_at timestamp
 * - Does NOT physically delete data
 * - User can re-register with same email (will get new UUID)
 */

export default async function handler(req: any, res: any) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId: requestedUserId, reason } = req.body;
        const authUserId = await requireAuthenticatedUser(req.headers.authorization);
        const userId = assertRequestUser(authUserId, requestedUserId);
        const supabase: any = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

        // First, cancel any active Razorpay subscription
        // This should be immediate cancellation (not at cycle end) since account is being deleted
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('razorpay_subscription_id')
            .eq('user_id', userId)
            .single();

        if (subscription?.razorpay_subscription_id) {
            try {
                const auth = Buffer.from(`${requireEnv('VITE_RAZORPAY_KEY_ID')}:${requireEnv('RAZORPAY_KEY_SECRET')}`).toString('base64');
                const response = await fetch(
                    `https://api.razorpay.com/v1/subscriptions/${subscription.razorpay_subscription_id}/cancel`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ cancel_at_cycle_end: false }) // Immediate cancellation
                    }
                );

                if (response.ok) {
                    console.log(`Cancelled Razorpay subscription ${subscription.razorpay_subscription_id} for deleted user ${userId}`);
                } else {
                    const errorData = await response.json();
                    console.warn('Razorpay cancellation warning:', errorData);
                    // Continue with account deletion even if Razorpay fails
                }
            } catch (rzpError) {
                console.error('Razorpay cancellation error:', rzpError);
                // Continue with account deletion
            }
        }

        // Call the soft_delete_user function
        const { data, error } = await supabase.rpc('soft_delete_user', {
            p_user_id: userId,
            p_reason: reason || 'User requested deletion'
        });

        if (error) {
            console.error('Soft delete error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete account'
            });
        }

        // Check the response from the function
        if (data && data.success === false) {
            return res.status(400).json(data);
        }

        // Optionally: Delete from auth.users (hard delete from auth)
        // This prevents the user from signing in with the deleted account
        // But they can re-register with the same email
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);

        if (authError) {
            console.error('Auth delete error:', authError);
            // Don't fail the request - data is already archived
            // The user just might still be able to "sign in" but will see no data
        }

        return res.status(200).json({
            success: true,
            message: 'Account deleted successfully. You can re-register with the same email for a fresh start.'
        });

    } catch (error: any) {
        console.error('Account deletion error:', error);
        return res.status(getErrorStatus(error)).json({
            success: false,
            error: getErrorMessage(error, 'An unexpected error occurred')
        });
    }
}
