import { supabase } from '../lib/supabase';

export async function getAuthenticatedJsonHeaders(): Promise<Record<string, string>> {
    if (!supabase) {
        throw new Error('Authentication required. Please sign in again.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in again.');
    }

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
    };
}
