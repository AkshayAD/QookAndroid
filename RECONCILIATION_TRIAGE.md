# Reconciliation Triage

Purpose: working tracker for unifying QookAndroid (`origin`, local lineage) with QookCommander (`vercel_origin`, production lineage), which have no common ancestor.

Decision: Option A from [WEBSITE_AND_APP_STRATEGY.md](WEBSITE_AND_APP_STRATEGY.md) is canonical: keep QookCommander production history and port QookAndroid value onto branches cut from `vercel_origin/main`.

Status date: 2026-06-12

## Triage Table

| Item | Side(s) | Decision (KEEP-PROD / PORT / RE-IMPLEMENT / DROP / DONE) | Notes |
| --- | --- | --- | --- |
| Production billing core (`lib/billing/serverBilling.ts`) | QookCommander | KEEP-PROD | Architectural center of production billing, including `family_pro`; API work must build on this. |
| PWA install stack | QookCommander | KEEP-PROD | `components/InstallPrompt.tsx`, `utils/pwa.ts`, `public/sw.js`. |
| Production billing migrations | QookCommander | KEEP-PROD | Includes unified credit billing and family-mode alignment through 20260330. |
| Production branding and app collateral | QookCommander | KEEP-PROD | Keep deployed brand assets unless superseded by store asset PRs. |
| `pnpm-lock.yaml` | QookCommander | KEEP-PROD | Production currently uses pnpm lockfile. |
| `services/aiproxyservices copy` | QookCommander | DROP | Debug artifact. |
| Native Google auth stack | QookAndroid | PORT | Includes TS pages/helpers, Java plugin, and `google-services.json`; verify secret posture before landing. |
| Server-side validation and helper libs | QookAndroid | PORT | `scripts/validate-env.mjs`, `lib/serverApi.ts`, `lib/razorpaySecurity.ts`; adapt to production runtime as needed. |
| Pure domain libraries and tests | QookAndroid | PORT | Meal selection, date ranges, planner resolution, preference profile, sanitizer, app chrome. |
| Bootstrap and prompt-context API surface | QookAndroid | RE-IMPLEMENT | Rebuild on production billing/server architecture, not by copying divergent API files. |
| Billing preference and payment route tests | QookAndroid | RE-IMPLEMENT | Useful coverage, but align with production endpoint contracts. |
| Component tests and net-new UI pieces | QookAndroid | PORT | Port tests first where possible; rewrite assertions where production component shape differs. |
| QookAndroid-only Supabase migrations | QookAndroid | RE-IMPLEMENT | Requires live-vs-repo audit before any migration application. |
| Process and documentation set | QookAndroid | PORT | `CLAUDE.md`, `AGENT.md`, docs, security plans, deployment docs. |
| Store assets and asset scripts | QookAndroid | PORT | Play Store icons, feature graphic, screenshots, resize/build helpers. |
| Vitest/build config | QookAndroid | PORT | Test and build scaffolding; verify production build remains green when implemented. |
| Capacitor extras | QookAndroid | PORT | Camera, filesystem, local-notifications, share; confirm web bundle impact. |
| `android/build_output.txt` | QookAndroid | DROP | Generated build artifact. |
| `App.tsx` / app shell | Both | RE-IMPLEMENT | Highest-risk divergence; reconcile last in small route/workflow batches. |
| Production API files using `serverBilling.ts` | Both | KEEP-PROD | `ai-stream`, `ai-proxy`, admin, payments, account deletion; QookAndroid versions risk losing production billing behavior. |
| `supabase/schema.sql` | Both | RE-IMPLEMENT | Live DB may match neither repo exactly. |
| `Router.tsx` | Both | RE-IMPLEMENT | Route maps differ; reconcile after native/API decisions. |
| `package.json` scripts and dependency set | Both | RE-IMPLEMENT | Merge Android/test scripts without breaking production deploy/runtime assumptions. |
| JWT auth for admin, grocery vision, and payment APIs | Both | DONE | Done 2026-06-12 across both lineages. |
| Server-side referrals | Both | DONE | Done 2026-06-12; production uses `api/account.ts`, Android lineage uses `api/referrals.ts`; path divergence remains a reconciliation item. |
| Recipe-search auth | Both | DONE | Done 2026-06-12; recipe-search v26 deployed. |
| Billing client-write lockdown | Both | DONE | Done 2026-06-12 via migration `20260607120000`. |
| CSP in `vercel.json` | Both | DONE | Done 2026-06-12. |
| Android backup hardening | Both | DONE | Done 2026-06-12 with `allowBackup=false`. |
| Vercel ESM `.js` import fix | QookCommander | DONE | Done 2026-06-12 on production lineage; required to avoid runtime import failures. |

## Migration Lineage Audit

Live DB history now records `20260523`, `20260524090000`, `20260524090100`, `20260607120000`, plus timestamped duplicate `20260612162607`.

`20260518_payment_hardening` is not applied live: `billing_payment_intents` and `billing_payment_events` are absent, and search-path hardening is absent. Run a live-vs-repo audit before any `supabase db push`.

Many older migration filenames use 8-digit prefixes that do not match the 14-digit history versions. `supabase db push` stays manual-dispatch only until `supabase_migrations.schema_migrations` is reconciled.

## Next PR Batches

1. Docs -> done when production has the current guardrails, deployment state, and triage tracker.
2. Build scaffolding -> done when env validation, test config, and scripts are ported and production still builds/tests.
3. Pure libs -> done when domain libraries and their tests pass unchanged or with minimal adapters.
4. Component tests -> done when production UI has equivalent regression coverage.
5. Migrations -> done when each missing migration has a live-vs-repo audit and an apply/no-op decision.
6. API surface -> done when bootstrap, prompt context, and billing preference APIs run on production billing primitives.
7. Native -> done when Android auth/plugins are ported and secret handling is verified.
8. Store assets -> done when Play Store collateral and asset-build scripts are present on production lineage.
9. App shell -> done when `App.tsx` and `Router.tsx` are reconciled and www.qook.in smoke tests pass.
