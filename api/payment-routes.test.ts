import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { authenticateSupabaseUser } from '../lib/supabaseAuth';
import { createClient } from '@supabase/supabase-js';
import createOrder from './create-order';
import createSubscription from './create-subscription';
import verifyPayment from './verify-payment';
import cancelSubscription from './cancel-subscription';

vi.mock('../lib/supabaseAuth', () => ({
    authenticateSupabaseUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}));

const razorpayMock = vi.hoisted(() => ({
    orders: { create: vi.fn() },
    subscriptions: { create: vi.fn(), fetch: vi.fn() },
    payments: { fetch: vi.fn() },
}));

vi.mock('razorpay', () => ({
    default: vi.fn(function Razorpay() {
        return razorpayMock;
    }),
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

function singleResult(data: any, error: any = null) {
    const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        single: vi.fn(async () => ({ data, error })),
        maybeSingle: vi.fn(async () => ({ data, error })),
    };
    return chain;
}

function insertResult(error: any = null) {
    return {
        insert: vi.fn(async () => ({ error })),
        update: vi.fn(() => ({
            eq: vi.fn(() => ({
                in: vi.fn(async () => ({ error })),
            })),
        })),
    };
}

describe('payment API route hardening', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
        process.env.VITE_RAZORPAY_KEY_ID = 'rzp_test_public';
        process.env.RAZORPAY_KEY_SECRET = 'test_secret';
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: 'user-1', token: 'token' });
    });

    it('requires auth before creating a credit order', async () => {
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: null, token: null });
        const res = createRes();

        await createOrder(createReq({ pack_id: 'mega' }, ''), res);

        expect(res.statusCode).toBe(401);
        expect(razorpayMock.orders.create).not.toHaveBeenCalled();
    });

    it('uses server-side pack price instead of client-supplied amount', async () => {
        const pack = { id: 'mega', name: 'Mega Pack', credits: 200, price_inr: 199, validity_days: 180, is_active: true };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'credit_packs') return singleResult(pack);
                return insertResult();
            }),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        razorpayMock.orders.create.mockResolvedValue({ id: 'order_1', amount: 19900, currency: 'INR' });
        const res = createRes();

        await createOrder(createReq({ user_id: 'user-1', pack_id: 'mega', amount_inr: 1 }), res);

        expect(res.statusCode).toBe(200);
        expect(razorpayMock.orders.create).toHaveBeenCalledWith(expect.objectContaining({
            amount: 19900,
            currency: 'INR',
            notes: expect.objectContaining({ pack_id: 'mega', user_id: 'user-1' }),
        }));
    });

    it('resolves Razorpay subscription plan from the internal plan only', async () => {
        const plan = {
            id: 'pro',
            name: 'Pro',
            price_inr: 99,
            first_month_price: 99,
            regular_price: 199,
            monthly_credits: 60,
            razorpay_plan_id: 'plan_real_pro',
            razorpay_offer_id: null,
            razorpay_upi_offer_id: null,
            is_active: true,
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'subscription_plans') return singleResult(plan);
                return insertResult();
            }),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        razorpayMock.subscriptions.create.mockResolvedValue({ id: 'sub_1' });
        const res = createRes();

        await createSubscription(createReq({
            user_id: 'user-1',
            plan_id: 'plan_attacker_supplied',
            internal_plan_id: 'pro',
        }), res);

        expect(res.statusCode).toBe(200);
        expect(razorpayMock.subscriptions.create).toHaveBeenCalledWith(expect.objectContaining({
            plan_id: 'plan_real_pro',
            notes: expect.objectContaining({ internal_plan_id: 'pro' }),
        }));
    });

    it('rejects invalid Razorpay order signatures before granting credits', async () => {
        const supabase = {
            from: vi.fn(() => singleResult(null)),
            rpc: vi.fn(),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        const res = createRes();

        await verifyPayment(createReq({
            user_id: 'user-1',
            type: 'pack',
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'bad',
        }), res);

        expect(res.statusCode).toBe(400);
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('accepts valid order signature only after matching a pending purchase', async () => {
        const signature = crypto
            .createHmac('sha256', 'test_secret')
            .update('order_1|pay_1')
            .digest('hex');
        const purchase = {
            id: 'purchase-1',
            user_id: 'user-1',
            pack_id: 'mega',
            credits_added: 200,
            amount_inr: 199,
            status: 'pending',
            razorpay_order_id: 'order_1',
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'credit_purchases') return {
                    select: vi.fn(() => singleResult(purchase)),
                    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
                };
                return {
                    update: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
                        })),
                    })),
                };
            }),
            rpc: vi.fn(async () => ({ data: { success: true }, error: null })),
        };
        vi.mocked(createClient).mockReturnValue(supabase as any);
        razorpayMock.payments.fetch.mockResolvedValue({
            id: 'pay_1',
            order_id: 'order_1',
            amount: 19900,
            currency: 'INR',
            status: 'captured',
        });
        const res = createRes();

        await verifyPayment(createReq({
            user_id: 'user-1',
            type: 'pack',
            razorpay_order_id: 'order_1',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: signature,
        }), res);

        expect(res.statusCode).toBe(200);
        expect(supabase.rpc).toHaveBeenCalledWith('verify_razorpay_payment', expect.objectContaining({
            p_user_id: 'user-1',
            p_plan_id: 'mega',
            p_type: 'pack',
        }));
    });

    it('requires auth before cancellation', async () => {
        vi.mocked(authenticateSupabaseUser).mockResolvedValue({ userId: null, token: null });
        const res = createRes();

        await cancelSubscription(createReq({ user_id: 'user-1' }, ''), res);

        expect(res.statusCode).toBe(401);
    });
});
