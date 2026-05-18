import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GoogleSignInButton from './GoogleSignInButton';
import {
    canUseHostedNativeAuthFallback,
    openNativeGoogleAuthHandoff,
    signInWithNativeGoogleIdToken,
} from '../lib/googleAuth';

vi.mock('../lib/googleAuth', () => ({
    canUseHostedNativeAuthFallback: vi.fn(),
    getGoogleSignInMode: vi.fn(() => 'native-direct'),
    getGoogleSignInUnavailableMessage: vi.fn(() => 'Google sign-in is unavailable.'),
    googleWebClientId: 'google-client-id',
    openNativeGoogleAuthHandoff: vi.fn(),
    signInWithGoogleIdToken: vi.fn(),
    signInWithNativeGoogleIdToken: vi.fn(),
}));

vi.mock('../lib/nativeGoogleAuth', () => ({
    isNativeGoogleAuthCancellation: vi.fn(() => false),
    shouldFallbackToHostedGoogleAuth: vi.fn(() => true),
}));

describe('GoogleSignInButton native fallback', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(signInWithNativeGoogleIdToken).mockRejectedValue(new Error('Native auth is misconfigured.'));
        vi.mocked(openNativeGoogleAuthHandoff).mockResolvedValue();
    });

    it('does not open hosted auth when production fallback is disabled', async () => {
        vi.mocked(canUseHostedNativeAuthFallback).mockReturnValue(false);
        const onError = vi.fn();

        render(<GoogleSignInButton mode="native-direct" onError={onError} />);

        fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith('Native auth is misconfigured.');
        });
        expect(openNativeGoogleAuthHandoff).not.toHaveBeenCalled();
    });

    it('opens hosted auth only when explicit dev fallback is enabled', async () => {
        vi.mocked(canUseHostedNativeAuthFallback).mockReturnValue(true);
        const onError = vi.fn();

        render(<GoogleSignInButton mode="native-direct" onError={onError} />);

        fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

        await waitFor(() => {
            expect(openNativeGoogleAuthHandoff).toHaveBeenCalledTimes(1);
        });
        expect(onError).not.toHaveBeenCalled();
    });
});
