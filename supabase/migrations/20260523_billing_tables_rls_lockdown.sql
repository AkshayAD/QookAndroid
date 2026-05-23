-- 20260523_billing_tables_rls_lockdown.sql
--
-- Captures the fix applied to production on 2026-05-23 via the Supabase
-- dashboard SQL editor (rls_disabled_in_public advisor findings).
--
-- These three tables are written ONLY by server-side Vercel functions using
-- the service_role key (which bypasses RLS), and by Razorpay webhooks.
-- No client (anon or authenticated) should ever read or write them directly.
--
-- RLS + REVOKE closes the advisor finding without adding any policies —
-- default-deny is intentional here. Do NOT add anon/authenticated policies.
--
-- NOTE: billing_payment_events and billing_webhook_events already had RLS
-- enabled by 20260518_payment_hardening.sql; the ALTER TABLE statements below
-- are no-ops on those tables but are included for documentation and to make
-- this file safely re-runnable.
--
-- billing_action_events was created out-of-band (dashboard) and has no prior
-- migration — this file is its first capture in the repo.

ALTER TABLE public.billing_action_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.billing_action_events  FROM anon, authenticated;
REVOKE ALL ON public.billing_payment_events FROM anon, authenticated;
REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;
