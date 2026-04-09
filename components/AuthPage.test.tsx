import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthPage from './AuthPage';

vi.mock('./GoogleSignInButton', () => ({
    default: () => <button type="button">Continue with Google</button>,
}));
vi.mock('../utils/platform', () => ({
    isNative: () => false,
}));

describe('AuthPage', () => {
    it('shows a Google-only sign-in screen', () => {
        render(<AuthPage />);

        expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
        expect(screen.queryByPlaceholderText(/email address/i)).toBeNull();
        expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
        expect(screen.queryByText(/continue with email/i)).toBeNull();
        expect(screen.getByText(/qook signs you in with google directly on/i)).toBeTruthy();
    });
});
