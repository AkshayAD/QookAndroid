import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    signInWithNativeGoogle: vi.fn(),
    signInWithIdToken: vi.fn(),
}));

vi.mock('./nativeGoogleAuth', () => ({
    signInWithNativeGoogle: mocks.signInWithNativeGoogle,
}));

vi.mock('./supabase', () => ({
    supabase: {
        auth: {
            signInWithIdToken: mocks.signInWithIdToken,
        },
    },
}));

describe('signInWithNativeGoogleIdToken', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.signInWithNativeGoogle.mockResolvedValue({
            idToken: 'native-id-token',
            nonce: 'native-nonce',
        });
        mocks.signInWithIdToken.mockResolvedValue({ error: null });
    });

    it('passes the native nonce through to Supabase ID-token sign-in', async () => {
        const { googleWebClientId, signInWithNativeGoogleIdToken } = await import('./googleAuth');

        await signInWithNativeGoogleIdToken();

        expect(mocks.signInWithNativeGoogle).toHaveBeenCalledWith(googleWebClientId);
        expect(mocks.signInWithIdToken).toHaveBeenCalledWith({
            provider: 'google',
            token: 'native-id-token',
            nonce: 'native-nonce',
        });
    });
});
