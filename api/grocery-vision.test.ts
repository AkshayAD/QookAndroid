import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { authenticateSupabaseUser } from '../lib/supabaseAuth';
import handler from './grocery-vision';

const googleGenAITestState = vi.hoisted(() => ({
    generateContent: vi.fn(),
}));

const supabaseTestState = vi.hoisted(() => ({
    rpc: vi.fn(),
}));

vi.mock('../lib/supabaseAuth', () => ({
    authenticateSupabaseUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(function GoogleGenAI() {
        return {
            models: { generateContent: googleGenAITestState.generateContent },
        };
    }),
    Type: {},
}));

function createRequest(body: unknown, authorization = 'Bearer token') {
    return new Request('https://qook.in/api/grocery-vision', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
        },
        body: JSON.stringify(body),
    });
}

describe('grocery vision API hardening', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
        vi.mocked(createClient).mockReturnValue({ rpc: supabaseTestState.rpc } as any);
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: 'user-1', token: 'token' });
        supabaseTestState.rpc.mockResolvedValue({ data: true, error: null });
        googleGenAITestState.generateContent.mockResolvedValue({
            text: JSON.stringify({
                groceries: [{ item: 'rice', quantity: '1 bag' }],
                imageType: 'pantry',
                confidence: 0.9,
            }),
        });
    });

    it('requires bearer authentication before processing images', async () => {
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: null, token: null });

        const response = await handler(createRequest({ imageData: 'Zm9v' }, ''));

        expect(response.status).toBe(401);
        expect(GoogleGenAI).not.toHaveBeenCalled();
    });

    it('rejects a body userId that does not match the token user', async () => {
        const response = await handler(createRequest({
            userId: 'user-2',
            imageData: 'Zm9v',
            imageType: 'image/jpeg',
        }));

        expect(response.status).toBe(403);
        expect(GoogleGenAI).not.toHaveBeenCalled();
    });

    it('rejects oversized images before calling Gemini', async () => {
        const response = await handler(createRequest({
            userId: 'user-1',
            imageData: 'A'.repeat(11_184_814),
            imageType: 'image/jpeg',
        }));

        expect(response.status).toBe(413);
        expect(GoogleGenAI).not.toHaveBeenCalled();
    });

    it('allows an authenticated BYOK request with a supported image type', async () => {
        const response = await handler(createRequest({
            userId: 'user-1',
            imageData: 'Zm9v',
            imageType: 'image/jpg',
            userApiKey: 'user-gemini-key',
        }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(supabaseTestState.rpc).toHaveBeenCalledWith('check_rate_limit', {
            p_user_id: 'user-1',
            p_action_type: 'grocery_vision',
            p_window_minutes: 1,
            p_max_requests: 8,
        });
        expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'user-gemini-key' });
        expect(body.groceries).toEqual([{ item: 'rice', quantity: '1 bag' }]);
    });

    it('rate limits an authenticated BYOK request before calling Gemini', async () => {
        supabaseTestState.rpc.mockResolvedValue({ data: false, error: null });

        const response = await handler(createRequest({
            userId: 'user-1',
            imageData: 'Zm9v',
            imageType: 'image/jpeg',
            userApiKey: 'user-gemini-key',
        }));

        expect(response.status).toBe(429);
        expect(supabaseTestState.rpc).toHaveBeenCalledWith('check_rate_limit', {
            p_user_id: 'user-1',
            p_action_type: 'grocery_vision',
            p_window_minutes: 1,
            p_max_requests: 8,
        });
        expect(GoogleGenAI).not.toHaveBeenCalled();
    });
});
