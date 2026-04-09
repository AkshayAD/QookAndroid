import { supabase } from './supabase';
import { isNative, openHostedAuthBrowser } from '../utils/platform';
import { signInWithNativeGoogle } from './nativeGoogleAuth';

const WEB_GOOGLE_ORIGINS = new Set([
    'https://www.qook.in',
    'https://qook.in',
]);
const CANONICAL_QOOK_AUTH_ORIGIN = 'https://www.qook.in';
const PRODUCTION_QOOK_GOOGLE_CLIENT_ID = '399705277846-3d4lf1gucl4iumremffpkca9ali94rru.apps.googleusercontent.com';

// Google OAuth client IDs are public identifiers. Keep a production default so
// Android release builds cannot silently lose native Google sign-in when local
// env files are missing.
export const googleWebClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
    || PRODUCTION_QOOK_GOOGLE_CLIENT_ID;

export const WEB_POST_AUTH_PATH = '/dashboard';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const NATIVE_AUTH_PATH = '/auth/native';
export const NATIVE_APP_CALLBACK_URL = 'in.qook.app://auth/callback';
export type GoogleSignInMode = 'web-gis' | 'native-direct' | 'unavailable';

export const buildGoogleOAuthRedirectUrl = (nativePlatform: boolean, origin?: string): string => (
    nativePlatform
        ? NATIVE_APP_CALLBACK_URL
        : `${origin || window.location.origin}${WEB_POST_AUTH_PATH}`
);

export const buildNativeGoogleAuthUrl = (origin: string = CANONICAL_QOOK_AUTH_ORIGIN): string => (
    `${origin}${NATIVE_AUTH_PATH}`
);

export const buildNativeAppCallbackUrl = (accessToken: string, refreshToken: string): string => {
    const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    return `${NATIVE_APP_CALLBACK_URL}#${params.toString()}`;
};

export const getGoogleOAuthRedirectUrl = (): string => (
    buildGoogleOAuthRedirectUrl(isNative(), window.location.origin)
);

export const getNativeGoogleAuthUrl = (): string => buildNativeGoogleAuthUrl();

export const resolvePostAuthDestination = (isAuthenticated: boolean): string => (
    isAuthenticated ? WEB_POST_AUTH_PATH : '/'
);

export const isSupportedGoogleWebOrigin = (origin?: string): boolean => {
    const resolvedOrigin = origin
        || (typeof window !== 'undefined' ? window.location.origin : '');

    return WEB_GOOGLE_ORIGINS.has(resolvedOrigin);
};

export const getGoogleSignInMode = (
    nativePlatform: boolean = isNative(),
    origin?: string
): GoogleSignInMode => {
    if (nativePlatform) {
        return googleWebClientId ? 'native-direct' : 'unavailable';
    }

    if (Boolean(googleWebClientId) && isSupportedGoogleWebOrigin(origin)) {
        return 'web-gis';
    }

    return 'unavailable';
};

export const canUseGoogleIdentityServices = (): boolean => (
    getGoogleSignInMode() === 'web-gis'
);

export const getGoogleSignInUnavailableMessage = (
    nativePlatform: boolean = isNative(),
    origin?: string
): string => {
    const mode = getGoogleSignInMode(nativePlatform, origin);

    if (mode === 'native-direct') {
        return 'Google sign-in is available on this Android build.';
    }

    if (!googleWebClientId) {
        return 'Google sign-in is not configured for this environment.';
    }

    if (!isSupportedGoogleWebOrigin(origin)) {
        return 'Google sign-in is available on the live Qook website only.';
    }

    return 'Google sign-in is not available right now.';
};

export async function openNativeGoogleAuthHandoff(onBrowserFinished?: () => void): Promise<void> {
    if (!isNative()) {
        throw new Error('Native Google handoff is only available in the app.');
    }

    await openHostedAuthBrowser(getNativeGoogleAuthUrl(), onBrowserFinished);
}

export async function signInWithNativeGoogleIdToken(): Promise<void> {
    const result = await signInWithNativeGoogle(googleWebClientId);
    await signInWithGoogleIdToken(result.idToken);
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
