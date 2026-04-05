import { supabase } from './supabase';
import { getOAuthRedirectUrl, isNative } from '../utils/platform';

const WEB_GOOGLE_ORIGINS = new Set([
    'https://www.qook.in',
    'https://qook.in',
]);

export const googleWebClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

export const getGoogleOAuthRedirectUrl = (): string => (
    isNative()
        ? getOAuthRedirectUrl()
        : `${window.location.origin}/dashboard`
);

export const isSupportedGoogleWebOrigin = (): boolean => (
    typeof window !== 'undefined' && WEB_GOOGLE_ORIGINS.has(window.location.origin)
);

export const canUseGoogleIdentityServices = (): boolean => (
    !isNative() && Boolean(googleWebClientId) && isSupportedGoogleWebOrigin()
);

export const canUseLegacyGoogleOAuth = (): boolean => (
    isNative() || import.meta.env.DEV
);

export const getGoogleSignInUnavailableMessage = (): string => {
    if (!googleWebClientId) {
        return 'Google sign-in is not configured for this environment.';
    }

    if (!isSupportedGoogleWebOrigin()) {
        return 'Google sign-in is available on the live Qook website only.';
    }

    return 'Google sign-in is not available right now.';
};

export async function signInWithGoogleOAuth(): Promise<void> {
    if (!supabase) {
        throw new Error('Supabase is not configured');
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: getGoogleOAuthRedirectUrl(),
        },
    });

    if (error) {
        throw error;
    }
}

export async function signInWithGoogleIdToken(token: string, nonce?: string): Promise<void> {
    if (!supabase) {
        throw new Error('Supabase is not configured');
    }

    const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token,
        nonce,
    });

    if (error) {
        throw error;
    }
}

export const signInWithGoogle = signInWithGoogleOAuth;
