import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateSupabaseUser } from '../lib/supabaseAuth';
import { createClient } from '@supabase/supabase-js';
import referralsHandler from './referrals';

vi.mock('../lib/supabaseAuth', () => ({
    authenticateSupabaseUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}));

function createReq(body: any, authorization = 'Bearer token') {
    return {
        method: 'POST',
        headers: { authorization },
        body,
    };
}

function createRes() {
    const res: any = {
        statusCode: 200,
        body: null,
        status: vi.fn((statusCode: number) => {
            res.statusCode = statusCode;
            return res;
        }),
        json: vi.fn((body: unknown) => {
            res.body = body;
            return res;
        }),
        setHeader: vi.fn(),
        end: vi.fn(),
    };
    return res;
}

function queryResult(data: any, error: any = null) {
    const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        single: vi.fn(async () => ({ data, error })),
        maybeSingle: vi.fn(async () => ({ data, error })),
        update: vi.fn(() => chain),
        insert: vi.fn(async () => ({ error })),
    };
    return chain;
}

describe('referral API billing writes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: 'referee-1', token: 'token' });
    });

    it('requires bearer authentication before creating a service-role client', async () => {
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: null, token: null });
        const res = createRes();

        await referralsHandler(createReq({ action: 'award_referrer_credits', user_id: 'referee-1' }, ''), res);

        expect(res.statusCode).toBe(401);
        expect(vi.mocked(createClient)).not.toHaveBeenCalled();
    });

    it('rejects body user ids that do not match the token user', async () => {
        const res = createRes();

        await referralsHandler(createReq({ action: 'award_referrer_credits', user_id: 'other-user' }), res);

        expect(res.statusCode).toBe(403);
        expect(vi.mocked(createClient)).not.toHaveBeenCalled();
    });

    it('validates referral codes through the authenticated server endpoint', async () => {
        const referralCodeQuery = queryResult({
            user_id: 'referrer-1',
            is_active: true,
            usage_count: 0,
            max_uses: 10,
        });
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'referral_codes') {
                    return referralCodeQuery;
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        const res = createRes();

        await referralsHandler(createReq({
            action: 'validate_referral',
            referral_code: 'qook-abc123',
        }), res);

        expect(res.statusCode).toBe(200);
        expect(referralCodeQuery.eq).toHaveBeenCalledWith('code', 'QOOK-ABC123');
        expect(supabase.from).not.toHaveBeenCalledWith('user_credits');
        expect(res.body).toEqual({ valid: true, referrerId: 'referrer-1' });
    });

    it('applies referral credits through the service-role client', async () => {
        const inserts: Record<string, any[]> = {};
        const updates: Record<string, any[]> = {};
        const supabase = {
            rpc: vi.fn(async () => ({ data: null, error: null })),
            from: vi.fn((table: string) => {
                if (table === 'referral_codes') {
                    return queryResult({
                        id: 'code-1',
                        user_id: 'referrer-1',
                        is_active: true,
                        usage_count: 0,
                        max_uses: 10,
                    });
                }

                if (table === 'referrals') {
                    const chain = queryResult(null);
                    chain.insert = vi.fn(async (row) => {
                        inserts[table] = [...(inserts[table] || []), row];
                        return { error: null };
                    });
                    return chain;
                }

                if (table === 'user_settings') {
                    return queryResult({ onboarding_completed: false });
                }

                if (table === 'user_credits') {
                    const chain = queryResult(null);
                    chain.insert = vi.fn(async (row) => {
                        inserts[table] = [...(inserts[table] || []), row];
                        return { error: null };
                    });
                    return chain;
                }

                if (table === 'user_profiles') {
                    const chain = queryResult(null);
                    chain.update = vi.fn((patch) => {
                        updates[table] = [...(updates[table] || []), patch];
                        return chain;
                    });
                    return chain;
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        const res = createRes();

        await referralsHandler(createReq({
            action: 'apply_referral',
            user_id: 'referee-1',
            referral_code: 'QOOK-ABC123',
        }), res);

        expect(res.statusCode).toBe(200);
        expect(inserts.referrals[0]).toMatchObject({
            referrer_id: 'referrer-1',
            referee_id: 'referee-1',
            referral_code_id: 'code-1',
            status: 'pending',
            referee_credits_awarded: 3,
        });
        expect(inserts.user_credits[0]).toMatchObject({
            user_id: 'referee-1',
            credit_type: 'bonus',
            credits: 3,
            meal_credits: 3,
            referral_credits: 3,
        });
        expect(supabase.rpc).toHaveBeenCalledWith('increment_referral_usage', { p_code: 'QOOK-ABC123' });
        expect(updates.user_profiles[0]).toMatchObject({
            referred_by: 'referrer-1',
            referral_code_used: 'QOOK-ABC123',
        });
    });

    it('awards referrer credits only after a conditional pending-referral update', async () => {
        const inserts: Record<string, any[]> = {};
        const referralUpdateChain: any = {
            eq: vi.fn(() => referralUpdateChain),
            select: vi.fn(async () => ({ data: [{ id: 'referral-1' }], error: null })),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'referrals') {
                    return {
                        select: vi.fn(() => queryResult({
                            id: 'referral-1',
                            referrer_id: 'referrer-1',
                            status: 'pending',
                            referrer_credits_awarded: 0,
                        })),
                        update: vi.fn(() => referralUpdateChain),
                    };
                }

                if (table === 'user_credits') {
                    return {
                        insert: vi.fn(async (row) => {
                            inserts[table] = [...(inserts[table] || []), row];
                            return { error: null };
                        }),
                    };
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        const res = createRes();

        await referralsHandler(createReq({ action: 'award_referrer_credits', user_id: 'referee-1' }), res);

        expect(res.statusCode).toBe(200);
        expect(referralUpdateChain.eq).toHaveBeenCalledWith('id', 'referral-1');
        expect(referralUpdateChain.eq).toHaveBeenCalledWith('status', 'pending');
        expect(inserts.user_credits[0]).toMatchObject({
            user_id: 'referrer-1',
            credit_type: 'bonus',
            credits: 3,
            referral_credits: 3,
        });
        expect(res.body).toEqual({ awarded: true });
    });
});
