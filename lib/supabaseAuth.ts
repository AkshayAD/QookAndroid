import { createClient } from '@supabase/supabase-js';

export function getSupabaseAuthClient() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    return createClient(supabaseUrl, supabaseAnonKey);
}

export async function authenticateSupabaseUser(authHeader?: string | null): Promise<{
    userId: string | null;
    token: string | null;
}> {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
        return { userId: null, token: null };
    }

    const authClient = getSupabaseAuthClient();
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data?.user?.id) {
        return { userId: null, token: null };
    }

    return {
        userId: data.user.id,
        token,
    };
}
