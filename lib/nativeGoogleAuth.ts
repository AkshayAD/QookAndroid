import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeGoogleSignInResult = {
    idToken: string;
    nonce?: string;
    email?: string;
    name?: string;
    photoUrl?: string | null;
};

type NativeGoogleAuthPlugin = {
    signIn(options: { serverClientId: string }): Promise<NativeGoogleSignInResult>;
    signOut(): Promise<void>;
};

export type NativeGoogleAuthErrorCode =
    | 'MISCONFIGURED'
    | 'UNAVAILABLE'
    | 'PLAY_SERVICES_UNAVAILABLE'
    | 'INVALID_TOKEN'
    | 'CANCELLED'
    | 'FAILED';

export class NativeGoogleAuthError extends Error {
    code: NativeGoogleAuthErrorCode;

    constructor(message: string, code: NativeGoogleAuthErrorCode) {
        super(message);
        this.name = 'NativeGoogleAuthError';
        this.code = code;
    }
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');

export function isNativeGoogleAuthSupported(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function normalizeNativeGoogleAuthError(error: unknown): NativeGoogleAuthError {
    if (error instanceof NativeGoogleAuthError) {
        return error;
    }

    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : 'Native Google sign-in failed.';
    const explicitCode = typeof error === 'object' && error && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: NativeGoogleAuthErrorCode }).code
        : null;
    const normalizedMessage = message.toLowerCase();
    const code: NativeGoogleAuthErrorCode = explicitCode
        ?? (normalizedMessage.includes('cancelled') || normalizedMessage.includes('canceled')
            ? 'CANCELLED'
            : normalizedMessage.includes('play services')
                ? 'PLAY_SERVICES_UNAVAILABLE'
                : normalizedMessage.includes('not configured')
                    || normalizedMessage.includes('oauth client')
                    || normalizedMessage.includes('google-services.json')
                    || normalizedMessage.includes('sha fingerprint')
                    || normalizedMessage.includes('sha-1')
                    || normalizedMessage.includes('developer error')
                    ? 'MISCONFIGURED'
                    : normalizedMessage.includes('unavailable')
                        ? 'UNAVAILABLE'
                        : 'FAILED');
    return new NativeGoogleAuthError(message, code);
}

export function isNativeGoogleAuthCancellation(error: unknown): boolean {
    return normalizeNativeGoogleAuthError(error).code === 'CANCELLED';
}

export function shouldFallbackToHostedGoogleAuth(error: unknown): boolean {
    const code = normalizeNativeGoogleAuthError(error).code;
    return code === 'MISCONFIGURED'
        || code === 'UNAVAILABLE'
        || code === 'PLAY_SERVICES_UNAVAILABLE';
}

export async function signInWithNativeGoogle(serverClientId: string): Promise<NativeGoogleSignInResult> {
    if (!isNativeGoogleAuthSupported()) {
        throw new NativeGoogleAuthError('Native Google sign-in is unavailable on this platform.', 'UNAVAILABLE');
    }

    if (!serverClientId.trim()) {
        throw new NativeGoogleAuthError('Google sign-in is not configured for Android.', 'MISCONFIGURED');
    }

    try {
        return await NativeGoogleAuth.signIn({ serverClientId });
    } catch (error) {
        throw normalizeNativeGoogleAuthError(error);
    }
}

export async function signOutFromNativeGoogle(): Promise<void> {
    if (!isNativeGoogleAuthSupported()) {
        return;
    }

    try {
        await NativeGoogleAuth.signOut();
    } catch (error) {
        console.warn('[Auth] Native Google sign-out failed', error);
    }
}
