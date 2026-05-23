# Supabase Security & Data-API Remediation Plan

Project: **QookCommander** · Supabase ref: `igcmhlfonulqtxsiiisb`
Author: Claude · Date: 2026-05-23
Status: **PARTIALLY APPLIED — see §12 for live state as of 2026-05-23.**

---

## 1. What the warnings actually mean

### Issue 1 — `rls_disabled_in_public` (CRITICAL, recurring weekly since late March 2026)

Supabase's Security Advisor has been flagging one or more tables in the `public` schema where Row-Level Security is **not enabled**. Because every Supabase project ships the **anon** key inside the JavaScript bundle (it is in `.env.example` as `VITE_SUPABASE_ANON_KEY`), any table in `public` without RLS is reachable by *anyone* who opens devtools on www.qook.in — they can run `SELECT/INSERT/UPDATE/DELETE` against it from a browser console or a `curl` call to PostgREST.

**Confirmed offenders (from `supabase/migrations/20260111_subscription_system.sql` lines 167–225):**

| Table | What's in it | Worst-case if leaked |
|-------|-------------|----------------------|
| `public.fact_generation_events` | every AI generation event, tokens, cost USD, user_id | competitor scrapes activity + cost; user enumeration |
| `public.fact_subscription_events` | subscribe/upgrade/cancel events, revenue_inr, payment_method | reveals MRR, churn, payment methods per user |
| `public.fact_credit_transactions` | every credit purchase / consumption with revenue_inr | reveals all paid customers + spend |
| `public.dim_users` | denormalized user dim: signup_date, signup_source, current_tier, lifetime_value_inr, last_active_at | user enumeration + LTV per user |

The `ALTER TABLE … ENABLE ROW LEVEL SECURITY` block in that migration listed only the OLTP tables; the analytics tables were never added.

**Additional unknowns.** The codebase references ~16 tables (e.g. `admin_users`, `admin_audit_log`, `blocked_users`, `meal_plans`, `app_settings`, `feature_tier_access`, `saved_recipes`, `recently_viewed_recipes`, `grocery_items`, `referral_codes`, `referrals`, `user_devices`, `feedback`, `grocery_list_history`, `weekly_drafts`, `recipe_cache`) whose `CREATE TABLE` is **not in tracked migrations** — they were created via the Supabase dashboard / out-of-band SQL. Their RLS state cannot be verified from the repo and must be queried live (Section 6, Step 0).

### Issue 2 — Data API auto-exposure removed on 2026-10-30 (BREAKING)

From **2026-10-30**, Supabase stops auto-exposing every `public` table through PostgREST / supabase-js / GraphQL. Existing tables keep whatever GRANTs they have today; **any table created after that date without explicit GRANTs returns PostgREST `42501` (permission denied)**.

The recommended pattern from the warning email is:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;       -- or only SELECT
GRANT SELECT ON <table> TO anon;                                         -- for public reference data
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "…" ON <table> FOR <cmd> TO <role> USING (…);
```

GRANTs control which roles can *reach* the table at all; RLS controls which rows within the table they can see. Both are needed.

### Why this is "two issues, one fix"

The same migration solves both: every `public` table needs (a) `ENABLE ROW LEVEL SECURITY`, (b) policies appropriate to its access pattern, and (c) explicit GRANTs for the roles that actually use it. Once a table has those three, it's compliant with both warnings and future-proof against the Oct-30 cutover.

---

## 2. Risk if we do nothing

| Date | What breaks |
|------|-------------|
| Now | Anyone with the public URL can `SELECT *` from `fact_*` and `dim_users`, exposing user-level revenue and activity. They can also `INSERT` fabricated rows or `DELETE` analytics history. |
| 2026-10-30 | Any NEW table created after that date through the dashboard without GRANTs becomes invisible to the app. Existing tables continue to work, but every future schema change needs explicit GRANTs or the client breaks with `42501`. |

There is no DoS risk from RLS being enabled — the existing OLTP tables already have RLS and the app works — but enabling RLS on a table with **no policies** silently denies all client access, so the ordering of the rollout matters.

---

## 3. Method: how we decide each table's posture

For every `public` table we classify it into one of four buckets based on who actually reads/writes it (mapped from the code audit in §4):

| Bucket | RLS | GRANTs | Policies |
|--------|-----|--------|----------|
| **A. User-owned OLTP** (e.g. `weekly_plans`, `preference_profiles`) | ON | `SELECT, INSERT, UPDATE, DELETE` to `authenticated` | `auth.uid() = user_id` for all four commands |
| **B. User-readable, server-only-writable** (e.g. `user_credits`, `user_subscriptions`, `credit_purchases`, `billing_payment_intents`, billing_payment_events) | ON | `SELECT` to `authenticated` (no INSERT/UPDATE/DELETE) | `SELECT` policy `auth.uid() = user_id` only |
| **C. Public reference / lookup** (e.g. `subscription_plans`, `credit_packs`, `custom_templates`, `user_segments`) | ON | `SELECT` to `anon, authenticated` | `SELECT` policy `USING (true)` (or `is_active = true`) |
| **D. Server-only** (e.g. `fact_*`, `dim_users`, `weekly_bonus_log`, `rate_limit_tracking`, `billing_webhook_events`, `admin_*`, `blocked_users`, `user_push_tokens`) | ON | **no GRANTs to anon/authenticated** | no client policies — only `service_role` accesses these and it bypasses RLS |

Service-role API endpoints (`api/*.ts`) bypass RLS entirely, so anything written exclusively from there goes in bucket D. Family-mode tables are bucket A but with a more complex `USING` clause that consults `family_group_members`.

A table where the audit couldn't conclude the right bucket is flagged in §5 as **decision required**.

---

## 4. Per-table recommendation

Legend: ✅ = current state matches recommendation, ⚠️ = needs change, 🆕 = will be created/altered by the migration in §6.

### Bucket A — User-owned OLTP (full CRUD by owner)

| Table | RLS now | Policies now | Recommendation |
|-------|---------|--------------|----------------|
| `user_profiles` | ON | 1 ALL | ✅ keep; add explicit `GRANT SELECT,INSERT,UPDATE,DELETE TO authenticated` |
| `preference_profiles` | ON | SEL + ALL | ✅ keep |
| `weekly_plans` | ON | 1 ALL (family-aware) | ✅ keep |
| `scheduled_meals` | ON | 1 ALL (family-aware) | ✅ keep |
| `grocery_lists` | ON | 1 ALL (family-aware) | ✅ keep |
| `meal_history` | ON | 1 ALL | ✅ keep |
| `user_settings` | ON | 1 ALL | ✅ keep |
| `inventory_items` | ON | 1 ALL family-aware | ✅ keep |
| `preference_signals` | ON | 1 ALL family-aware | ✅ keep |
| `menu_generation_events` | ON | SEL + INS | ✅ keep |
| `family_groups`, `family_group_members`, `family_credit_pool`, `family_credit_contributions`, `family_activity` | ON | various | ✅ keep |
| `user_template_downloads` | ON | 1 ALL | ✅ keep |
| `user_trust_actions` | ON (assumed) | own-only | verify and confirm |

### Bucket B — User-readable, server-only-writable

| Table | RLS now | Policies now | Recommendation |
|-------|---------|--------------|----------------|
| `user_subscriptions` | ON | SELECT only (`authenticated`) | ✅ keep; `GRANT SELECT TO authenticated` |
| `user_credits` | ON | SELECT only | ✅ keep |
| `usage_tracking` | ON | SELECT only | ✅ keep |
| `credit_purchases` | ON | SELECT only | ✅ keep |
| `billing_payment_intents` | ON | SELECT only | ✅ keep |
| `billing_payment_events` | ON | SELECT only | ✅ keep |

### Bucket C — Public reference

| Table | RLS now | Policies now | Recommendation |
|-------|---------|--------------|----------------|
| `subscription_plans` | ON | SEL `true` | ✅ keep; add `GRANT SELECT TO anon, authenticated` |
| `credit_packs` | ON | SEL `true` | ✅ keep |
| `custom_templates` | ON | SEL active-only | ✅ keep |
| `user_segments` | ON | SEL `true` | ✅ keep |
| `test_accounts` | ON | SEL `true` | ⚠️ Exposes QA email allowlist publicly. **Decision required**: tighten to `service_role` only, or accept the leak. |

### Bucket D — Server-only (RLS on, no client GRANTs)

| Table | RLS now | Recommendation |
|-------|---------|----------------|
| `fact_generation_events` | ✅ **ON + policies** (live DB verified 2026-05-23) | No action needed — repo migration had drifted from live; live DB already correct |
| `fact_subscription_events` | ✅ **ON + policies** (live DB verified 2026-05-23) | same |
| `fact_credit_transactions` | ✅ **ON + policies** (live DB verified 2026-05-23) | same |
| `dim_users` | ✅ **ON + policies** (live DB verified 2026-05-23) | same |
| `weekly_bonus_log` | ON, no policies | ✅ correct posture, but explicitly `REVOKE ALL FROM anon, authenticated` to be safe under Oct-30 rules |
| `rate_limit_tracking` | ON, no policies | ✅ same |
| `billing_webhook_events` | ✅ **ON + REVOKE applied 2026-05-23** | 🆕 captured in `20260523_billing_tables_rls_lockdown.sql` |
| `billing_payment_events` | ✅ **ON + REVOKE applied 2026-05-23** | 🆕 captured in `20260523_billing_tables_rls_lockdown.sql` |
| `billing_action_events` | ✅ **ON + REVOKE applied 2026-05-23** | Out-of-band table (no prior migration). Captured in `20260523_billing_tables_rls_lockdown.sql` |
| `user_push_tokens` | ON | server-only writes; keep existing read policies |
| `admin_notifications` | ON | server-only |
| `admin_users`, `admin_audit_log`, `blocked_users` | unknown (not in migrations) | 🆕 §6 Step 0: verify in dashboard; if RLS is off, enable + lock to service_role |
| `deleted_users` | ON | server-only |
| `test_account_reset_log` | ON | server-only |

### Bucket E — Out-of-band tables (verify live, then bucket appropriately)

These are queried by the client/server but never appear in `supabase/migrations/`. They were created via the dashboard. They need to be inspected in the live database and added to the migration produced by §6.

| Table | Used by | Likely bucket |
|-------|---------|---------------|
| `saved_recipes`, `recently_viewed_recipes` | `components/MealAlternativesSidebar.tsx`, `components/RecipePanel.tsx`, `components/SavedRecipesPanel.tsx` | A (user-owned) |
| `grocery_items` | `components/RecipePanel.tsx` | A |
| `grocery_list_history`, `weekly_drafts`, `feedback` | `services/supabaseService.ts` | A |
| `referral_codes`, `referrals` | `services/referralService.ts` | A (need SELECT-by-code lookup — may need anon SELECT on `referral_codes` with row filter) |
| `user_devices` | `services/deviceFingerprint.ts` | A |
| `meal_plans` | `api/delete-account.ts` (server) | D |
| `app_settings`, `feature_tier_access` | `services/subscriptionService.ts` (client SELECT), `api/admin-api.ts` (server R/W) | C (SELECT to authenticated) |
| `recipe_cache` | `supabase/functions/recipe-search/` edge function | D |

---

## 5. Application-code changes required before the SQL migration

These four code-side fixes prevent the migration from breaking existing flows. They should ship in the same PR as the migration so the deploy is atomic. **Each is a small, surgical edit, not a refactor.**

### 5.A — Move two client inserts into `fact_*` tables to the server

`services/subscriptionService.ts:681` inserts into `fact_generation_events` and `:811` into `fact_subscription_events`. Both succeed today only because RLS is off. After this plan applies, those inserts will fail.

**Fix:** record those events server-side in the same endpoint that originated the action.
- `fact_generation_events` writes should happen in `api/ai-proxy.ts` and `api/ai-stream.ts` after a successful generation (they already use service-role).
- `fact_subscription_events` writes should happen in `api/verify-payment.ts`, `api/cancel-subscription.ts`, and `api/razorpay-webhook.ts` (which already write some of them via `verify_razorpay_payment`).

Delete the client inserts entirely (no fallback) once the server side is verified to fire.

### 5.B — Remove client-side `grant_credits` RPC call

`services/subscriptionService.ts` calls `supabase.rpc('grant_credits', …)` from the client. `20260518_payment_hardening.sql:170` already `REVOKE ALL … FROM PUBLIC` and grants only to `service_role` — so this call is **already silently failing**. Remove it. If the calling code path actually needs to grant credits to the user, route it through a Vercel API endpoint that uses the service-role client.

### 5.C — Fix `from('users')` in `api/ai-stream.ts` ✅ FIXED 2026-05-23

`api/ai-stream.ts` had a `getUserTier()` helper that queried `.from('users')` — a table that does not exist. The function was also entirely redundant: `subscription` (from `user_subscriptions`) was already fetched earlier in the same handler. Fix applied: removed `getUserTier()`, replaced the call with `const isPro = subscription?.plan_id === 'pro'` — matching `ai-proxy.ts` exactly.

### 5.D — Confirm `family_activity` retains explicit GRANT

`20260118_family_activity.sql` already has `GRANT SELECT, INSERT … TO authenticated`. Keep it; just confirm it's not dropped by any later migration.

---

## 6. The migration — exact SQL

The migration is split into two files for safe phased rollout (§7). Both are **idempotent** (re-runnable) and **reversible** (a paired down-migration is in §8).

### Migration file 1 — `20260524_rls_close_advisor_gaps.sql`

Goal: enable RLS on the four offenders + lock them to `service_role`. **No behavior change** for the app because nothing on the client legitimately writes to these tables once §5.A lands. Run this AFTER §5.A has shipped to production.

```sql
-- 20260524_rls_close_advisor_gaps.sql
-- Closes the rls_disabled_in_public advisor for analytics tables.
-- Pre-req: client-side inserts into fact_generation_events and
-- fact_subscription_events have been moved server-side (see plan §5.A).

BEGIN;

-- 1. Enable RLS on the four offenders.
ALTER TABLE IF EXISTS public.fact_generation_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fact_subscription_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fact_credit_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dim_users                 ENABLE ROW LEVEL SECURITY;

-- 2. Belt-and-braces: revoke any default grants from client roles.
REVOKE ALL ON TABLE public.fact_generation_events    FROM anon, authenticated;
REVOKE ALL ON TABLE public.fact_subscription_events  FROM anon, authenticated;
REVOKE ALL ON TABLE public.fact_credit_transactions  FROM anon, authenticated;
REVOKE ALL ON TABLE public.dim_users                 FROM anon, authenticated;

-- 3. service_role bypasses RLS, so no GRANT TO service_role is needed —
-- but be explicit for the Oct-30 Data API cutover.
GRANT  ALL ON TABLE public.fact_generation_events    TO service_role;
GRANT  ALL ON TABLE public.fact_subscription_events  TO service_role;
GRANT  ALL ON TABLE public.fact_credit_transactions  TO service_role;
GRANT  ALL ON TABLE public.dim_users                 TO service_role;

-- 4. Tables that already had RLS-on-but-no-policies: tighten GRANTs for
-- the Oct-30 cutover (RLS already locks them; this is defense-in-depth).
REVOKE ALL ON TABLE public.weekly_bonus_log          FROM anon, authenticated;
REVOKE ALL ON TABLE public.rate_limit_tracking       FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_webhook_events    FROM anon, authenticated;
GRANT  ALL ON TABLE public.weekly_bonus_log          TO service_role;
GRANT  ALL ON TABLE public.rate_limit_tracking       TO service_role;
GRANT  ALL ON TABLE public.billing_webhook_events    TO service_role;

COMMIT;
```

**Why idempotent:** `ALTER TABLE … ENABLE RLS` is a no-op if already enabled; `REVOKE`/`GRANT` on the same role set is also a no-op.

**Why reversible:** down-migration just `DISABLE RLS` and re-grants — see §8.

### Migration file 2 — `20260525_data_api_explicit_grants.sql`

Goal: future-proof every existing `public` table for the 2026-10-30 cutover by adding the same GRANTs Supabase will require for new tables. **No behavior change** because today these tables already work via the auto-grant.

⚠️ This file is a **template** — Section 6 Step 0 (live audit) will tell us if more tables need to be added to it. Do not run until Step 0 is complete.

```sql
-- 20260525_data_api_explicit_grants.sql
-- Explicit per-table GRANTs so the app keeps working after the
-- 2026-10-30 Supabase Data API auto-exposure removal.

BEGIN;

-- ---------- Bucket A: user-owned OLTP (full CRUD by owner) ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preference_profiles      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_plans             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_meals          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grocery_lists            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_history             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preference_signals       TO authenticated;
GRANT SELECT, INSERT                  ON public.menu_generation_events  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_groups            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_group_members     TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.family_credit_pool       TO authenticated;
GRANT SELECT, INSERT                  ON public.family_credit_contributions TO authenticated;
GRANT SELECT, INSERT                  ON public.family_activity         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_template_downloads  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_trust_actions       TO authenticated;

-- ---------- Bucket B: SELECT-only on the client ----------
GRANT SELECT ON public.user_subscriptions       TO authenticated;
GRANT SELECT ON public.user_credits             TO authenticated;
GRANT SELECT ON public.usage_tracking           TO authenticated;
GRANT SELECT ON public.credit_purchases         TO authenticated;
GRANT SELECT ON public.billing_payment_intents  TO authenticated;
GRANT SELECT ON public.billing_payment_events   TO authenticated;

-- ---------- Bucket C: public reference data ----------
GRANT SELECT ON public.subscription_plans  TO anon, authenticated;
GRANT SELECT ON public.credit_packs        TO anon, authenticated;
GRANT SELECT ON public.custom_templates    TO anon, authenticated;
GRANT SELECT ON public.user_segments       TO anon, authenticated;
-- test_accounts: decision pending in §5/§9. Default keeps current public exposure:
GRANT SELECT ON public.test_accounts       TO anon, authenticated;

-- ---------- Function execute grants (Oct-30 also affects RPC defaults) ----------
GRANT EXECUTE ON FUNCTION public.handle_new_user()                              TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_subscription()                 TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_credits_summary(UUID)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_family_group(TEXT)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family_group(TEXT)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_family_group(UUID)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_members_with_emails(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_templates_for_user(UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_template_downloads(UUID)             TO authenticated;
-- (consume_credits, grant_credits, verify_razorpay_payment, soft_delete_user
--  already locked to service_role in 20260518_payment_hardening.sql.)

COMMIT;
```

### Step 0 (run BEFORE writing Migration file 2) — Live audit

Run these queries in the Supabase SQL editor and paste the results back so the migration above can be extended:

```sql
-- 0.a Which public tables have RLS off?
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- 0.b Which public tables have RLS on but no policies?
SELECT c.relname,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
ORDER BY policy_count, c.relname;

-- 0.c Current GRANTs by role
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name, grantee, privilege_type;

-- 0.d Functions and their EXECUTE grants
SELECT p.proname,
       array_agg(DISTINCT acl.grantee) AS grantees
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN LATERAL aclexplode(p.proacl) acl ON TRUE
WHERE n.nspname = 'public'
GROUP BY p.proname
ORDER BY p.proname;
```

Use the output to add any missing tables/functions (especially the §4 Bucket E ones) to migration file 2 before applying it.

---

## 7. Phased rollout

Each phase is independently revertible. Do not proceed to the next phase until the verification step passes.

### Phase 0 — Live audit (read-only, ~30 min)
Run the four queries in §6 Step 0 in the dashboard. Update migration file 2 to cover any tables not in this plan. **No write actions.**

### Phase 1 — Ship the application-code changes from §5 (1 PR, no DB change)
Move the two client `fact_*` inserts to server endpoints; remove the client `grant_credits` RPC call; fix `from('users')`. Deploy to prod. Verify the app behaves identically by smoke-testing: AI generation, subscribe, cancel.

**Verify before moving on:** the four affected flows still write to the analytics tables (check row counts before/after a generation and a subscribe event using the service-role SQL editor).

### Phase 2 — Apply migration file 1 (`20260524_rls_close_advisor_gaps.sql`)
Run in the SQL editor. This closes the advisor warning and locks the `fact_*` / `dim_users` tables.

**Verify:**
1. Supabase dashboard → Security Advisor → re-run → `rls_disabled_in_public` count drops to 0 for these four tables.
2. `SELECT * FROM public.fact_generation_events LIMIT 1;` from the anon role returns permission denied (test with `curl -H "apikey: <anon>" https://<ref>.supabase.co/rest/v1/fact_generation_events`).
3. Smoke-test the production app: AI generation, subscription purchase, credit consumption — all still write analytics rows (confirms server inserts work).
4. Admin dashboard (`/admin`) still loads analytics (service-role read, unaffected).

### Phase 3 — Apply migration file 2 (`20260525_data_api_explicit_grants.sql`)
Run in the SQL editor. This adds explicit GRANTs that mirror what auto-exposure currently provides — **no observable change today**, but the app will keep working after 2026-10-30.

**Verify:**
1. Each Bucket A flow: create a preference profile, edit a weekly plan, save a grocery list, join a family.
2. Each Bucket B flow: dashboard shows subscription, credits, usage history.
3. Each Bucket C flow: pricing page loads plans + packs unauthenticated.
4. Sign out → confirm `curl` to `/rest/v1/user_subscriptions` with the anon key returns `[]` (RLS) or `42501` (no SELECT to anon), NOT real rows.

### Phase 4 — Optional tightening (`test_accounts`)
If §9 decision is to lock down: drop the `SELECT … USING (true)` policy and the `GRANT SELECT TO anon`. Verify QA flows still work (admin uses service-role anyway).

### Rollback at any phase
Run the matching down-migration from §8. RLS toggling is fast (<1s on small tables) and reversible. GRANTs are likewise reversible.

---

## 8. Down-migrations (rollback)

```sql
-- Rollback 20260524_rls_close_advisor_gaps.sql
BEGIN;
ALTER TABLE public.fact_generation_events    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_subscription_events  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_credit_transactions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_users                 DISABLE ROW LEVEL SECURITY;
-- (Leave the service_role GRANTs in place — they are harmless and aid future migrations.)
COMMIT;
```

```sql
-- Rollback 20260525_data_api_explicit_grants.sql
BEGIN;
-- Granting back to PUBLIC restores pre-Oct-30 auto-exposure behavior for the listed tables.
-- Use only if Phase 3 breaks something unexpected and you need to revert quickly.
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
-- … then re-apply the existing default grants that Supabase had before, OR
-- just re-apply migration file 2 once the underlying issue is fixed.
COMMIT;
```

⚠️ The bulk REVOKE is a heavy hammer. Prefer to revert specific tables only.

---

## 9. Decision items — need your input before applying

These are points where the audit could not infer the right answer from code alone.

1. **`test_accounts` exposure.** It currently has `SELECT … USING (true)` to anon. This is the QA email allowlist. Lock it down to `service_role` only? *(Recommended: yes.)*
2. **Out-of-band tables (Bucket E).** Need the live audit output from §6 Step 0 before we can write the final GRANTs / RLS for `saved_recipes`, `recently_viewed_recipes`, `grocery_items`, `grocery_list_history`, `weekly_drafts`, `feedback`, `referral_codes`, `referrals`, `user_devices`, `meal_plans`, `app_settings`, `feature_tier_access`, `recipe_cache`, `admin_users`, `admin_audit_log`, `blocked_users`. The plan in §6 covers the *patterns*; the actual table list will be extended once Step 0 runs.
3. **`fact_*` historical reads.** Do any client features today display per-user analytics? Audit suggests no (only `/admin` reads them via service-role). Confirm.
4. **`from('users')` at `api/ai-stream.ts:42`.** Verify the intended target — probably `user_profiles`. Fix in §5.C.
5. **Edge function `recipe-search`.** Confirm it uses the service-role key (so its access to `recipe_cache` is unaffected). If it uses the anon key, the table needs explicit GRANTs.

---

## 10. Verification checklist (after Phase 3)

- [ ] Supabase dashboard → Security Advisor → "Run advisor" → `rls_disabled_in_public` returns **0 findings**.
- [ ] Anon key can no longer read `fact_*` / `dim_users`:
  ```bash
  curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
    "https://igcmhlfonulqtxsiiisb.supabase.co/rest/v1/fact_generation_events?select=*&limit=1"
  # expect: {"code":"42501",…} or empty array
  ```
- [ ] Smoke-test in production, logged in as a real account:
  - [ ] Onboarding writes preference profile
  - [ ] Generate weekly meal plan (writes weekly_plans, fact_generation_events via server)
  - [ ] Generate grocery list (writes grocery_lists, fact_generation_events via server)
  - [ ] Subscribe to a paid plan via Razorpay (writes user_subscriptions, credit grant, fact_subscription_events via server)
  - [ ] Cancel subscription (writes fact_subscription_events via server)
  - [ ] Family mode: create group, invite, accept
  - [ ] Demo flow loads pricing
- [ ] Admin dashboard at `/admin` still renders all analytics charts.
- [ ] Logged-out marketing page still shows live pricing from `subscription_plans` + `credit_packs`.
- [ ] Run `npm test` — no regressions.
- [ ] Sign in as a *different* user and confirm you cannot see the previous user's data via direct API calls (RLS works).
- [ ] After 2026-10-30, re-verify the smoke-test list — confirms Data API cutover did not break us.

---

## 11. Files / locations to remember

- Migrations directory: `D:\Projects\Qook-Android\supabase\migrations\`
- Existing hardening template (mirror its style): `supabase/migrations/20260518_payment_hardening.sql`
- Client inserts to remove: `services/subscriptionService.ts` lines ~681 (fact_generation_events), ~811 (fact_subscription_events), and the client `rpc('grant_credits', …)` call
- ~~Suspicious table reference: `api/ai-stream.ts:42` (`from('users')`)~~ — **FIXED 2026-05-23** (removed `getUserTier()`, now uses `subscription?.plan_id === 'pro'`)
- Service-role API endpoints (bypass RLS — destination for moved inserts): `api/ai-proxy.ts`, `api/ai-stream.ts`, `api/cancel-subscription.ts`, `api/verify-payment.ts`, `api/razorpay-webhook.ts`
- Service-role client factory: `lib/serverApi.ts`
- Schema source-of-truth: `supabase/schema.sql` (OLTP) + every file under `supabase/migrations/`
- Deployment guard rail: `DEPLOYMENT_STATUS.md` (this DB lives behind both `origin` and `vercel_origin`; the migration itself only runs in Supabase, not Vercel, but the code changes from §5 deploy through `vercel_origin`).

---

## 12. Live state as of 2026-05-23

| Finding | Status |
|---------|--------|
| `billing_action_events` RLS + REVOKE | ✅ Applied via dashboard. Captured in `supabase/migrations/20260523_billing_tables_rls_lockdown.sql` |
| `billing_payment_events` REVOKE (RLS was already on) | ✅ Applied via dashboard. Captured in same migration |
| `billing_webhook_events` REVOKE (RLS was already on) | ✅ Applied via dashboard. Captured in same migration |
| `fact_generation_events` RLS + policies | ✅ Already live in production (repo migration had drifted; no new migration needed) |
| `fact_subscription_events` RLS + policies | ✅ Already live in production |
| `fact_credit_transactions` RLS + policies | ✅ Already live in production |
| `dim_users` RLS + policies | ✅ Already live in production |
| `api/ai-stream.ts` `getUserTier()` / `from('users')` bug | ✅ Fixed in repo (2026-05-23); needs deploy to vercel_origin |
| Migration file 1 (`20260524_rls_close_advisor_gaps.sql`) | ⏳ Pending — analytics tables are already fixed live, but `weekly_bonus_log` / `rate_limit_tracking` REVOKE still to apply |
| Migration file 2 (`20260525_data_api_explicit_grants.sql`) | ⏳ Pending — pre-Oct-30 explicit GRANT work |
| Client inserts into `fact_*` (§5.A) | ⏳ Pending — still client-side; no immediate risk since fact tables now have RLS + policies, but inserts will fail once anon/authenticated GRANTs are revoked. To remove before migration file 1 is applied. |
