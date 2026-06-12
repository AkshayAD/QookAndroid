import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260607120000_lock_billing_client_writes.sql'),
    'utf8'
);

describe('billing RLS write lockdown migration', () => {
    it('drops the client-side subscription and credit mutation policies from the advisor cleanup', () => {
        expect(migration).toContain('DROP POLICY IF EXISTS "Users can insert own subscription"');
        expect(migration).toContain('DROP POLICY IF EXISTS "Users can update own subscription"');
        expect(migration).toContain('DROP POLICY IF EXISTS "Users can delete own subscription"');
        expect(migration).toContain('DROP POLICY IF EXISTS "Users can insert own credits"');
        expect(migration).toContain('DROP POLICY IF EXISTS "Users can update own credits"');
    });

    it('revokes direct client mutations on billing and entitlement tables', () => {
        expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM anon, authenticated');
        expect(migration).toContain("'user_subscriptions'");
        expect(migration).toContain("'user_credits'");
        expect(migration).toContain("'credit_purchases'");
        expect(migration).toContain("'weekly_bonus_log'");
        expect(migration).toContain("'rate_limit_tracking'");
        expect(migration).toContain("'billing_payment_intents'");
        expect(migration).toContain("'billing_payment_events'");
    });

    it('does not grant client reads to server-only fact or webhook ledgers', () => {
        expect(migration).toContain('REVOKE ALL ON TABLE public.%I FROM anon, authenticated');
        expect(migration).toContain("'billing_webhook_events'");
        expect(migration).toContain("'fact_subscription_events'");
        expect(migration).toContain("'fact_generation_events'");
    });

    it('guards check_rate_limit from authenticated cross-user quota burns', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.check_rate_limit(');
        expect(migration).toContain('p_user_id UUID');
        expect(migration).toContain('p_action_type TEXT');
        expect(migration).toContain('p_window_minutes INTEGER DEFAULT 1');
        expect(migration).toContain('p_max_requests INTEGER DEFAULT 15');
        expect(migration).toContain('RETURNS BOOLEAN AS $$');
        expect(migration).toContain('IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN');
        expect(migration).toContain("RAISE EXCEPTION 'check_rate_limit: cannot act for another user' USING ERRCODE = '42501';");
        expect(migration).toContain('$$ LANGUAGE plpgsql SECURITY DEFINER\nSET search_path = public, auth;');
    });
});
