# Security Rollout Notes — 2026-06-12

Execution record for `artifacts/security-rollout-plan-2026-06-07.html`. Evidence per gate.

## Pre-migration rollback snapshot (live DB igcmhlfonulqtxsiiisb, captured 2026-06-12 before 20260607120000)

Function ACLs (all four had default PUBLIC execute — anon, authenticated, service_role):
- `grant_credits`, `consume_credits`, `verify_razorpay_payment`, `check_rate_limit`:
  `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`

Policies present pre-migration (schemaname=public):
| table | policy | cmd | roles | qual |
|---|---|---|---|---|
| credit_purchases | Users manage own purchases | ALL | public | auth.uid() = user_id |
| fact_generation_events | Users can view own events | SELECT | public | auth.uid() = user_id |
| fact_subscription_events | Users can view own subscription events | SELECT | public | auth.uid() = user_id |
| rate_limit_tracking | Users manage own rate limits | ALL | public | auth.uid() = user_id |
| usage_tracking | Users view own usage | ALL | public | auth.uid() = user_id |
| user_credits | Service can manage all credits | ALL | public | jwt role = service_role OR postgres |
| user_credits | Users can insert own credits | INSERT | public | (null qual) |
| user_credits | Users can update own credits | UPDATE | public | auth.uid() = user_id AND deleted_at IS NULL |
| user_credits | Users can view own credits | SELECT | authenticated | auth.uid() = user_id AND deleted_at IS NULL |
| user_subscriptions | Users can view own subscription | SELECT | authenticated | auth.uid() = user_id AND deleted_at IS NULL |
| user_subscriptions | Users can view own subscriptions | SELECT | public | auth.uid() = user_id |
| user_subscriptions | Users manage own subscription | ALL | public | auth.uid() = user_id |
| weekly_bonus_log | Users manage own bonus log | ALL | public | auth.uid() = user_id |

Pre-migration vulnerabilities confirmed live:
- `grant_credits` executable by `authenticated` (self-credit exploit).
- `authenticated` had INSERT grant + INSERT/UPDATE/ALL policies on billing tables.
- `check_rate_limit` had no cross-user guard.

Migration history note: live history ends at `20260503092407`. The 20260518/20260523/20260524
hardening ran out-of-band. Probes show 20260524* applied (recorded into history), 20260523
applied historically then partially superseded by advisor cleanup (recorded), and
**20260518_payment_hardening search_path hardening NOT present live** (NOT recorded —
pending a live-vs-repo audit; see RECONCILIATION_TRIAGE.md).

## Gate evidence (appended as phases complete)

### P0 Freeze
- Backup dir `D:\Projects\Qook-Android-backup-2026-05-23` verified present.
- Snapshot tags pushed: `snapshot/origin-main-2026-06-12` (QookAndroid), `snapshot/vercel-origin-main-2026-06-12` (QookCommander).
- Vercel env names verified: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_RAZORPAY_KEY_ID, RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY (+VITE_), VITE_GOOGLE_CLIENT_ID (Production only — preview OAuth limitation, pre-existing).
- Supabase function secrets verified by name: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT, YOUTUBE_API_KEY, SUPABASE_DB_URL.

### P2 Local validation (QookAndroid tree)
- `npm test`: 24 files / 67 tests pass (69 after review fixes).
- `npm audit`: 0 vulnerabilities.
- `npm run build`, `npm run build:android`, `gradlew assembleDebug`: all pass.
- Codex security review findings fixed pre-commit: (1) grocery-vision BYOK rate-limit bypass; (2) check_rate_limit cross-user quota burn (guard added to migration, with search_path hardening).

### P3 QookAndroid push
- Branch `security-rollout-20260612` → merged ff into `main` → pushed. main: 822cfbc → 90c875b.
- Commits: bba33dd (security), 3b6b5d4 (docs), 90c875b (ci fallback).

### P4 QookCommander port
- Worktree `D:/Projects/qook-prod-rollout`, branch `security-rollout-20260612-vercel` from 8a0e5a1.
- Hand-ported against prod architecture (lib/supabaseAuth, serverBilling). Payment APIs: auth made mandatory (was optional pass-through). New `api/account.ts` consolidates referrals/trust-actions/billing-preference (12-function deploy limit). pnpm-lock.yaml regenerated (was stale vs package.json — likely cause of prior ERROR deployment from 2026-05-24 branch push).
- Build ✓, tsc: no new errors vs baseline (pre-existing AdminDashboard/Deno/vitest noise).
- Production status before rollout: www.qook.in serving 8a0e5a1 (deployment dpl_3iNSZpTiwWYn1ySRqUty1rPycaXQ, READY). Rollback target if needed.

### P5 Supabase rollout (2026-06-12 ~16:26 UTC)
- Migration `lock_billing_client_writes` applied via MCP (history versions 20260612162607 + 20260607120000 recorded; out-of-band 20260523/20260524090000/20260524090100 recorded as applied).
- Two live-DB incompatibilities found and fixed IN the migration file (both repos updated):
  (1) billing_payment_intents/events tables don't exist live (20260518 lineage never ran) — wrapped in existence guards;
  (2) consume_credits live signature is (uuid,text,integer), not (uuid,text,decimal,uuid) — RPC lockdown made dynamic across overloads.
- Post-migration checks ALL PASS: authenticated INSERT/UPDATE on billing tables = false; SELECT preserved; grant_credits/consume_credits/verify_razorpay_payment EXECUTE: authenticated=false, service_role=true; check_rate_limit guard + search_path present; zero write policies remain.
- recipe-search edge function deployed (version 26, verify_jwt=false as before — function implements own auth): 401 no-token, 401 garbage-token, OPTIONS 200.
- NOT recorded as applied: 20260518_payment_hardening (probe shows its objects absent live — needs live-vs-repo audit before any db push).

### P6 Preview gate (deployment dpl_CWEaezJKARwmZJ7bVU9kr6ieFCNp → fixed → final preview on 0ba5791)
- Found via preview: ERR_MODULE_NOT_FOUND crashes (FUNCTION_INVOCATION_FAILED 500) on api files importing ../lib/supabaseAuth without .js extension. **Pre-existing production bug: prod cancel-subscription was crashing 500 on this before the rollout.** Fixed with explicit .js ESM imports (commit 0ba5791).
- Final preview smoke: landing 200 + CSP; health 200 (db ok); admin-api/account/create-order/create-subscription/cancel-subscription/grocery-vision/verify-payment all 401 unauthenticated; 401 with garbage bearer.

### P7 Production promotion (2026-06-12 ~16:34 UTC)
- Fast-forward push security-rollout-20260612-vercel → vercel_origin/main: 8a0e5a1..0ba5791 (merge-base ancestry verified before push; no force).
- Production deployment dpl_CPRfBFggynAG3itqrLDXBU8mHMqp READY, target=production.
- Prod smoke on www.qook.in: landing 200, CSP active, health 200, all protected APIs 401 unauthenticated (incl. verify-payment with full razorpay fields), apex qook.in → 307 redirect to www, new bundle hash assets/index-DEH8uwbx.js served.
- Rollback: previous production deployment dpl_3iNSZpTiwWYn1ySRqUty1rPycaXQ (commit 8a0e5a1) via Vercel dashboard "Instant Rollback"; DB rollback reference = pre-migration snapshot above.

### P8 Android release (built from QookAndroid main @ 63c9faa + version bump)
- versionCode 12 → 13, versionName 1.0.11 → 1.0.12.
- Built with Vercel production env values (pulled, used, deleted — not committed).
- `npm run build:android` ✓, `cap sync` ✓, `assembleDebug` ✓ (app-debug.apk 22.9 MB), `bundleRelease` ✓ signed via android/keystore.properties (app-release.aab 15.4 MB at android/app/build/outputs/bundle/release/).
- Emulator smoke (AVD qook-test, android-36 x86_64, created manually — no avdmanager on machine): cold launch ✓, native auth screen renders ✓, process stays alive ✓, screenshot captured.
- Merged manifest verified: android:allowBackup = 0x0 (false).
- **Manual step remaining: upload app-release.aab to Play Console internal testing, then staged rollout.** Google sign-in on emulator not exercised (needs Google account + OAuth cert allowances); verify during internal testing.

### Post-deploy monitoring (first ~40 min)
- Vercel production error logs: only expected 401s from the smoke matrix; zero FUNCTION_INVOCATION_FAILED after promotion (the 16:30 cancel-subscription 500 was the OLD deployment, pre-promotion — that bug is now fixed).

### Known degradation window
- Between migration apply (~16:26 UTC) and production promotion (~16:36 UTC), old prod client code attempting direct billing writes / referral RPCs would have failed (~10 minutes). Post-promotion code routes these server-side.

## INCIDENT 2026-06-13 — rollout CSP shipped www.qook.in unstyled (RESOLVED)

**Report:** user found the site visually broken the morning after the rollout.

**Root cause:** the CSP in `vercel.json` was authored against the QookAndroid lineage's
`index.html` (compiled Tailwind, no external fonts) and ported to QookCommander without
re-validating against prod's *different* `index.html`, which loads at runtime:
- `https://cdn.tailwindcss.com` (entire Tailwind styling) — blocked by `script-src` → site rendered with zero styling
- `https://fonts.googleapis.com/css2?family=Inter...` — blocked by `style-src`/`font-src`
- `https://cdn.razorpay.com/.../razorpay-risk-detection/bundle.js` (loaded by checkout.js) — blocked by `script-src`
- `https://accounts.google.com/gsi/style` (GIS stylesheet) — blocked by `style-src`

**Why the gate missed it:** P6/P7 smoke was curl-level (status codes + header presence).
CSP violations only manifest in a browser console. No server-side errors existed
(Vercel runtime logs clean; Supabase all 200s) — the app *functioned*, unstyled.

**Fix (QookCommander):** `ce834e9` (script-src + cdn.tailwindcss.com, razorpay→`*.razorpay.com`,
style-src + fonts.googleapis.com, font-src + fonts.gstatic.com) and `af321c3`
(style-src + accounts.google.com for GIS). Both promoted via ancestry-verified fast-forward;
production deployments `dpl_5wMDnESDV33jqa2eK6V3BWFfjQ2k` → final on `af321c3`.

**Validation (Playwright headless Chromium against preview, then production):**
- landing + `/demo`: HTTP 200, Tailwind active (`window.tailwind` defined, flex/grid layouts rendered), 0 CSP violations, 0 console errors, 0 page errors; screenshots verified visually
- login modal: renders styled; on production `Continue with Google` GIS iframe present, 0 CSP violations
- API matrix re-verified post-fix: health 200; account/grocery-vision 401 on `{}`;
  admin-api/create-order/create-subscription/cancel-subscription/verify-payment 401 with
  well-formed unauthenticated bodies AND with garbage bearer (their 400-before-auth is
  field validation only; no privileged work precedes `authenticateSupabaseUser`)
- known benign leftovers: Tailwind "CDN in production" advisory (tracked: triage item 10),
  Razorpay's own `checkout-static-next.razorpay.com/build/undefined` ORB probe (checkout.js quirk, CSP-independent)

**Prevention:** `scripts/browser-smoke.mjs` added (QookAndroid lineage) and made a MANDATORY
gate in DEPLOYMENT_STATUS.md: preview before promotion, production after. CSP is now
identical in both repos' `vercel.json` (canonical = prod's needs, superset for both lineages).
