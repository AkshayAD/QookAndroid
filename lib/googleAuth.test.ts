import { describe, expect, it } from 'vitest';
import {
    buildGoogleOAuthRedirectUrl,
    buildNativeAppCallbackUrl,
    buildNativeGoogleAuthUrl,
    getGoogleSignInMode,
    resolvePostAuthDestination,
} from './googleAuth';

describe('buildGoogleOAuthRedirectUrl', () => {
    it('uses the native deep link for native OAuth', () => {
        expect(buildGoogleOAuthRedirectUrl(true, 'https://www.qook.in')).toBe('in.qook.app://auth/callback');
    });

    it('sends web OAuth back to the dashboard route', () => {
        expect(buildGoogleOAuthRedirectUrl(false, 'https://www.qook.in')).toBe('https://www.qook.in/dashboard');
    });
});

describe('buildNativeGoogleAuthUrl', () => {
    it('targets the first-party Qook hosted native auth route', () => {
        expect(buildNativeGoogleAuthUrl()).toBe('https://www.qook.in/auth/native');
    });
});

describe('buildNativeAppCallbackUrl', () => {
    it('serializes the Supabase session tokens into the app callback fragment', () => {
        expect(buildNativeAppCallbackUrl('access-token', 'refresh-token')).toBe(
            'in.qook.app://auth/callback#access_token=access-token&refresh_token=refresh-token'
        );
    });
});

describe('getGoogleSignInMode', () => {
    it('uses native Google sign-in inside the Android app', () => {
        expect(getGoogleSignInMode(true, 'https://www.qook.in')).toBe('native-direct');
    });
});

describe('resolvePostAuthDestination', () => {
    it('sends authenticated users to the dashboard', () => {
        expect(resolvePostAuthDestination(true)).toBe('/dashboard');
    });

    it('sends unauthenticated users back to the public shell', () => {
        expect(resolvePostAuthDestination(false)).toBe('/');
    });
});
