# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

`D:/Projects/Qook-Android` **is** the project root (the double-nesting `QookCommander-main/QookCommander-main/` was flattened on 2026-05-23). Run all commands from this directory.

```
D:\Projects\Qook-Android\           ← project root (git repo here)
├── android\                         ← Capacitor Android wrapper
├── api\                             ← Vercel serverless functions
├── components\ pages\ services\ ... ← shared React app (web + Android WebView)
├── public\                          ← static assets
├── docs\                            ← consolidated docs (architecture/, database/, api/,
│   deployment/, payments/, features/, marketing/)
├── scripts\                         ← one-off build/asset helpers
├── supabase\                        ← schema + migrations
└── CLAUDE.md, CLEANUP_PLAN.md       ← workspace-level meta files (untracked by git)
```

## Commands

Run from `D:/Projects/Qook-Android` (the project root):

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server (port 3000, host 0.0.0.0) | `npm run dev` |
| Web build (validates web env first) | `npm run build` |
| Android web build (relative base) | `npm run build:android` |
| Build + sync + run on Android | `npm run android` (= `build:android` → `npx cap sync android` → `npx cap run android`) |
| Run all tests | `npm test` (Vitest, jsdom) |
| Run a single test file | `npx vitest run path/to/file.test.ts` |
| Run tests in watch mode | `npx vitest` |

`prebuild` and `prebuild:android` run `scripts/validate-env.mjs`, which hard-fails the build on missing env vars (see below) and rejects `rzp_test_*` Razorpay keys in production builds.

## Environment Variables

Validated in `scripts/validate-env.mjs`. Always required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID`. In CI / Vercel / `--server` target, additionally required: `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`.

`vite.config.ts` injects `GEMINI_API_KEY` into both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time — client code reads it via `process.env`, not `import.meta.env`.

The `@` Vite alias points to the project root.

## ⚠️ Deployment: Two-Repo Architecture (read before pushing)

This is the #1 source of production failures. See `DEPLOYMENT_STATUS.md` for the full workflow.

| Remote | GitHub | Role |
|--------|--------|------|
| `origin` | `AkshayAD/QookAndroid` (public) | Local dev record. Does **not** deploy. |
| `vercel_origin` | `AkshayAD/QookCommander` (private) | **Vercel watches this. Pushes here deploy www.qook.in.** |

The two `main` branches have **diverged ~150 commits**. **Never** run `git push vercel_origin main:main` — it will destroy QookCommander history. To deploy, cherry-pick / re-apply changes onto a branch cut from `vercel_origin/main` and push that branch to `vercel_origin/main`.

## Architecture

**Stack:** React 19 + TypeScript + Vite, Tailwind, React Router 7, Supabase (auth + Postgres + RLS), Vercel serverless functions for API, Razorpay for payments, Google Gemini for AI, Capacitor 8 for the Android wrapper (`appId: in.qook.app`).

### Web vs Native split

`utils/platform.ts` exposes `isNative()`. The router (`Router.tsx`) uses it to swap the landing route between the web `LandingContent` (inside `AppShell`) and a Capacitor-only `AuthPage`. Google auth has separate paths: `lib/googleAuth.ts` for web (GIS popup, requires `VITE_GOOGLE_CLIENT_ID`) and `lib/nativeGoogleAuth.ts` + `pages/NativeAuthPage.tsx` for Capacitor. Capacitor's `CapacitorHttp` plugin is enabled so `fetch()` bypasses WebView CORS.

### Routing (`Router.tsx`)

All routes are lazy-loaded under a single `BrowserRouter`. Three wrappers control access:
- `PublicRoute` — redirects to `/dashboard` if logged in (skippable via `redirectIfAuth={false}`).
- `ProtectedRoute` — redirects to `/` if not logged in.
- `AdminRoute` — gates `/admin` on top of `ProtectedRoute`.

Special routes: `/demo` (no auth, demo data, forced onboarding), `/testing` (auth + forced onboarding), `/join-family` (invite acceptance), `/auth/callback` (OAuth return), `/auth/native` (Capacitor OAuth).

`ReferralCapture` wraps all routes and persists any `?ref=CODE` URL param to `localStorage.pendingReferralCode` for use during signup.

### State via React Context

Four contexts in `contexts/` hold cross-cutting state — read these before adding new global state:
- `AuthContext` — Supabase session, user, sign-in/out.
- `SubscriptionContext` — plan, credits, billing prefs.
- `FamilyContext` — family-mode membership and shared planner state.
- `SettingsContext` — user-configurable app settings (API keys, etc.).

### Services layer (`services/`)

Side-effectful integrations live here, not in components. Notable: `supabaseService.ts` (all DB ops), `geminiService.ts` + `aiProxyService.ts` (AI calls — proxy via `/api/ai-*` when a server-side key is needed), `razorpayService.ts` (checkout), `subscriptionService.ts`, `referralService.ts`, `familyService.ts`, `bootstrapService.ts` (first-load hydration via `/api/bootstrap`), `realtimeSync.ts`, `offlineCache.ts`, `notificationService.ts`, `trustActions.ts`, `plannerMemoryService.ts`, `deviceFingerprint.ts` (FingerprintJS).

### API (`api/`)

Vercel serverless functions. Payment-mutating endpoints (`cancel-subscription`, `create-subscription`, `create-order`, `verify-payment`, `update-billing-preference`, `delete-account`) are JWT-validated server-side — do not weaken this. `razorpay-webhook.ts` handles subscription lifecycle (`halted`, `past_due`, etc. — the DB CHECK constraint was widened by migration `20260503_payment_system_alignment.sql`). `ai-proxy.ts` / `ai-stream.ts` proxy Gemini calls so the server key isn't shipped to clients. `bootstrap.ts` returns initial app state in one round trip.

Tests for API routes live next to them (`api/payment-routes.test.ts`, `api/promptContext.test.ts`) plus `tests/admin-api.test.ts`.

### Database

Supabase project `igcmhlfonulqtxsiiisb`. Schema in `supabase/schema.sql`, migrations in `supabase/migrations/`, generated types in `lib/database.types.ts`. **All tables have RLS enabled** — write queries assuming the caller can only see their own rows; service-role keys bypass this and must stay server-side. See `docs/database/DATABASE_SCHEMA.md` for the table catalog.

### Tests

Vitest + jsdom + Testing Library, setup in `vitest.setup.ts`. Tests are colocated with the file under test (`*.test.ts(x)`). Coverage is partial — many components and most services are untested. When fixing a bug, prefer adding a failing test next to the file before fixing.

## Project-specific docs

Before working in a domain, check the matching doc:
- Architecture: `docs/architecture/TECHNICAL_ARCHITECTURE.md`, `docs/architecture/FAMILY_MODE_ARCHITECTURE.md`
- DB: `docs/database/DATABASE_SCHEMA.md`
- APIs / env / payments: `docs/api/API_REFERENCE.md`, `docs/deployment/ENVIRONMENT_SETUP.md`, `docs/payments/RAZORPAY_SETUP.md`, `docs/payments/RAZORPAY_SETUP_GUIDE.md`
- Feature logic: `docs/payments/CREDIT_SYSTEM.md`, `docs/payments/REFERRAL_SYSTEM.md`, `docs/payments/PRICING_AND_SUBSCRIPTIONS.md`, `docs/features/FAMILY_MODE_SPECIFICATION.md`, `docs/features/RECIPE_APPROACH.md`, `docs/features/REGENERATE_ANALYSIS.md`
- Deployment: `DEPLOYMENT_STATUS.md` (mandatory before any prod push)

`AGENT.md` is the canonical index of the above.
