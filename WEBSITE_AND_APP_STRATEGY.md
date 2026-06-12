# Website + Android App: Unified Codebase Strategy

_Plan only. Nothing in this document has been applied. Date: 2026-05-24._

## 0. TL;DR

- The repo currently has **two diverged `main` branches on two different GitHub remotes** that share no common commit. They are not "ahead/behind" — they are **separate codebases** that happen to share a project name and most of the React app structure.
- `vercel_origin/main` (AkshayAD/QookCommander) is **what runs at www.qook.in**. 284 commits. It owns the unified billing architecture, PWA install prompt, and a smaller surface area.
- `origin/main` (AkshayAD/QookAndroid) is **what is checked out locally**. 34 commits. It owns the Android-specific stack (native Google auth plugin, Capacitor camera / filesystem / local-notifications / share), substantially more tests, build-time env validation, and many newer Supabase migrations.
- Neither side is a superset of the other. Either side, force-pushed onto the other, would erase real production behavior. The recovery path if that happens is the 2026-05-23 backup directory and nothing else.
- **Recommendation:** keep a single working tree (this folder), make `vercel_origin/main` the canonical production lineage, port QookAndroid's net-new value onto it via branch + PR (never force-push), and abandon `origin/main` as a deploy target. Long-term, keep one remote for production and use `origin` only as a personal mirror.

---

## 1. Current divergence — measured

All numbers from `git fetch` of both remotes on 2026-05-24.

| Metric | `origin/main` (QookAndroid) | `vercel_origin/main` (QookCommander, **production**) |
| --- | --- | --- |
| Total commits | 34 | 284 |
| Tracked files | 350 | 280 |
| Common ancestor | **none** — `git merge-base` returns nothing | same |
| Deploys to | nothing (Vercel doesn't watch it) | **www.qook.in** |
| Locally checked out at | yes (HEAD = `822cfbc`) | no |

`git diff --stat origin/main vercel_origin/main` reports **256 files changed, +13,906 / −25,413 lines**. That count covers files only on one side as well as files that exist on both with different contents.

### 1.1 Files only on `vercel_origin/main` (production has, QookAndroid lacks)

Categorized from `git diff --diff-filter=A`:

- **Billing core:** `lib/billing/serverBilling.ts` — the helper that `api/ai-stream.ts`, `api/ai-proxy.ts`, `api/admin-api.ts` import for `ACTION_BILLING`, `assertActionAccess`, `consumeMealCredit`, `getBillingSummary`, `shouldUseByok`, `getSupabaseAdmin`. This is the **architectural centerpiece** of production billing and the `family_pro` tier lives here.
- **PWA:** `components/InstallPrompt.tsx`, `utils/pwa.ts`, `public/sw.js`.
- **Production-only migrations:** `20260201_fix_handle_new_user_trigger.sql`, `20260220_fix_db_schema_and_triggers.sql`, `20260328_unified_credit_billing.sql` (~1000 lines), `20260329_default_free_credit_assignment_alignment.sql` (~600 lines), `20260329_legacy_non_meal_credit_repair.sql`, `20260330_family_mode_requires_active_family_pro.sql`.
- **Branding:** `QookCommander-home-cook-management-app-logo.png`, `public/qook_applogo.png`, app-screenshot collateral.
- **Tooling:** `pnpm-lock.yaml` (production uses pnpm).
- **Stray:** `services/aiproxyservices copy` — looks like a debugging artifact that shouldn't be there.

### 1.2 Files only on `origin/main` (QookAndroid has, production lacks)

- **Native Android auth stack:** `lib/nativeGoogleAuth.ts`, `pages/NativeAuthPage.tsx`, `pages/AuthCallbackPage.tsx`, `android/app/src/main/java/in/qook/app/NativeGoogleAuthPlugin.java`, `android/app/google-services.json`.
- **Server-side validation + helpers:** `scripts/validate-env.mjs` (used by `prebuild` / `prebuild:android`), `lib/serverApi.ts`, `lib/razorpaySecurity.ts`.
- **Domain libraries with tests:** `lib/mealSelection.ts(+test)`, `lib/dateRange.ts(+test)`, `lib/plannerResolution.ts(+test)`, `lib/preferenceProfile.ts(+test)`, `lib/mealSanitizer.ts`, `lib/appChrome.ts`, `hooks/useAppChrome.ts(+test)`.
- **API:** `api/bootstrap.ts` + `services/bootstrapService.ts` (single round-trip first-load hydration), `api/promptContext.ts(+test)`, `api/update-billing-preference.ts`, `api/payment-routes.test.ts`.
- **Components (UI + tests):** `components/AuthPage.test.tsx`, `components/GoogleSignInButton.test.tsx`, `components/GroceryList.test.tsx`, `components/MealCard.test.tsx`, `components/DayMealPreview.tsx`, `components/MealActionSheet.tsx`, `components/InventoryCaptureModal.tsx`, `components/PlannerActionStrip.tsx(+test)`, `components/PlannerDateStrip.test.tsx`, `components/PlannerStatusRail.tsx`, `components/PreferenceLearningSheet.tsx(+test)`, `components/ShareModal.test.tsx`, `components/SmartEditModal.test.tsx`.
- **Services:** `services/notificationService.ts`, `services/plannerMemoryService.ts`, `services/trustActions.test.ts`.
- **Migrations (production lacks):** `20260124_admin_notifications.sql`, `20260401_inventory_and_preference_signals.sql`, `20260405182940_admin_deleted_user_alignment_apr_2026.sql`, `20260405183059_lock_search_path_for_admin_delete_functions_apr_2026.sql`, `20260405193720_safe_advisor_cleanup_non_billing_apr_2026.sql`, `20260405_credit_summary_alignment.sql`, `20260405_profile_admin_alignment.sql`, `20260405_week_start_date_for_weekly_plans.sql`, `20260406_family_members_rpc_text_casts.sql`, `20260407_menu_generation_events.sql`, `20260407_native_auth_trust_state.sql`, `20260409_resettable_test_account_qa.sql`, `20260503_payment_system_alignment.sql`, `20260518_payment_hardening.sql`, `20260523_billing_tables_rls_lockdown.sql`.
- **Process / docs:** `CLAUDE.md`, `AGENT.md`, `SUPABASE_SECURITY_PLAN.md`, `docs/`, `artifacts/payment-audit-2026-05-18/`, `DEPLOYMENT_STATUS.md`, `.github/workflows/supabase-deploy.yml`.
- **Store assets:** `store_assets/` (Play Store icons / feature graphic / screenshots), `resize-icons.mjs`, asset build scripts.
- **Vitest config:** `vitest.config.ts`, `vitest.setup.ts`, `tailwind.config.js`, `postcss.config.js`.
- **Capacitor extras:** dependencies `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor/share` (in `package.json`).
- **Native runtime:** `android/app/src/main/res/values-v23/styles.xml`, `android/build_output.txt` (the last is a generated file that should never be committed).

### 1.3 Files that exist on both sides but with substantial differences

Most expensive divergences:

| File | Lines changed | Nature of difference |
| --- | --- | --- |
| `App.tsx` | ~3027 | Whole-component churn; different navigation/state shape. |
| `api/ai-proxy.ts` | 896 | Production wires `serverBilling.ts`; QookAndroid wires `promptContext.ts` + `serverApi.ts`. |
| `api/razorpay-webhook.ts` | 677 | Different lifecycle handling. |
| `api/admin-api.ts` | 717 | Different admin surface. |
| `api/ai-stream.ts` | 425 | **Demonstrated regression risk**: production imports `family_pro` tier from `serverBilling.ts`; QookAndroid copy doesn't know that tier exists. A fix written against QookAndroid and force-merged would remove `family_pro` support from prod. |
| `api/verify-payment.ts` | 250 | Different signature / receipt logic. |
| `api/cancel-subscription.ts`, `api/create-subscription.ts`, `api/create-order.ts`, `api/delete-account.ts` | 45–154 each | Same pattern: production uses `serverBilling` helpers, QookAndroid uses its own. |
| `supabase/schema.sql` | 278 | Schemas have drifted; the live DB may match neither file exactly. |
| `Router.tsx` | 120 | Route map differs. |
| `package.json` | many | Different scripts (production has no `prebuild`/`build:android`/`android`/`test` scripts; no `engines.node`), different Capacitor plugin set. |

### 1.4 Risk assessment

- **Catastrophic risk:** force-pushing either main onto the other. Either direction loses production-only logic OR loses Android-only logic plus 14 migrations. The 2026-05-23 backup is the only recovery path; if that backup is ever deleted while the remotes are out of sync, work is gone.
- **High risk:** running migrations from `origin/main`'s `supabase/migrations/` directly against the live Supabase project (`igcmhlfonulqtxsiiisb`). Production was built on a different migration lineage; QookAndroid's migrations were written assuming a state that production may not be in. Some of them likely have already been applied to live, which is why repo migrations and live DB drifted (the situation noted in the task brief).
- **Medium risk:** running QookAndroid locally against production Supabase — type expectations (e.g., `family_pro` tier, `weekly_plans.week_start_date`) may not line up, leading to silent bugs.
- **Low risk:** keeping both remotes around but only deploying via the documented cherry-pick flow. This is the status quo and is what the 2026-05-23 CLAUDE.md guardrail enforces.

---

## 2. Options for a single source of truth

Three viable shapes, with the trade-offs.

### Option A — Production-canonical reconciliation (recommended)

Pick `vercel_origin/main` (QookCommander) as the canonical lineage. Treat `origin/main` (QookAndroid) as a feature-branch backlog to land onto production via reviewed PRs. Once everything valuable is landed, archive `origin/main` (rename it `archive/qookandroid-pre-merge-2026-05-24`) and stop pushing there.

**Pros**
- Production history is preserved bit-for-bit (the unsafe direction is the one we avoid).
- Vercel deploy pipeline keeps working unchanged.
- Every reconciliation step is a PR, fully reviewable, fully revertable.
- The 200-commit production lineage that exists nowhere else is the side that stays load-bearing.

**Cons**
- More PR churn up front: 14 migrations + ~20 new files + several API rewrites must be ported.
- Some QookAndroid changes (e.g., the alternate `api/ai-stream.ts` that doesn't know about `family_pro`) cannot be cherry-picked as-is. They must be re-implemented on top of the production billing layer.
- The native Google auth Capacitor plugin requires a separate decision (see §4).

### Option B — Monorepo with `apps/web` + `apps/android`

Restructure into a workspaces layout where the React app, the API, and the Android wrapper are sibling packages.

**Pros**
- Clean conceptual separation between shipping targets.
- Future native features can have their own `package.json` without polluting the web bundle.

**Cons**
- High up-front cost for no functional change.
- The current Capacitor setup deliberately treats the React build as the Android web bundle. Splitting them and then re-stitching them via a workspace adds moving parts.
- Doesn't actually solve the divergence problem — you still have to pick a side to start from.
- Tooling (Vite alias `@`, `cap sync android`) all has to be reconfigured.
- Vercel project would need its root path updated; high blast radius.

### Option C — Keep both remotes; formalize cherry-pick workflow

The current arrangement plus the 2026-05-23 CLAUDE.md guardrail.

**Pros**
- Zero migration risk now.
- Already documented in `DEPLOYMENT_STATUS.md` and the CLAUDE.md guardrail.

**Cons**
- The divergence keeps growing every time a fix is applied to one side and re-applied to the other. The brief calls out a recent example: a fix built for `origin/main`'s `ai-stream.ts` would have **regressed production** by removing `family_pro`. That class of mistake will recur.
- The repo can't be reasoned about as a single codebase. Every change requires asking "which lineage is this for?"
- Loses the value of having one mental model for `app + website + Android`.

**Choice — Option A.** It's the only option that ends the divergence rather than managing it.

---

## 3. Concrete reconciliation plan (Option A)

The hard constraint: **no force-push, no non-fast-forward push, no `reset --hard`, no rewrite of `vercel_origin/main`.** Every change to production lands as a PR cut from `vercel_origin/main`.

### 3.1 Stage 0 — Freeze and snapshot (Day 0)

1. Confirm the 2026-05-23 backup at `D:\Projects\Qook-Android-backup-2026-05-23` is complete and readable. Do not delete it for the duration of this plan.
2. Run `git fetch origin && git fetch vercel_origin` and write out:
   - `git log vercel_origin/main --format='%H %s' > artifacts/vercel-origin-main-2026-05-24.txt`
   - `git log origin/main --format='%H %s' > artifacts/origin-main-2026-05-24.txt`
   These are the audit baseline for "what existed where on this date." (Commit to a branch on `origin`, not `vercel_origin`.)
3. Tag both heads on their respective remotes (lightweight tags, not refs/heads):
   - `git tag snapshot/origin-main-2026-05-24 origin/main && git push origin snapshot/origin-main-2026-05-24`
   - `git tag snapshot/vercel-origin-main-2026-05-24 vercel_origin/main && git push vercel_origin snapshot/vercel-origin-main-2026-05-24`
4. Announce a soft freeze: no direct edits to `vercel_origin/main` outside the reconciliation PRs until the merge program is complete.

### 3.2 Stage 1 — Inventory and triage (Day 1)

Walk every file from §1.1 (only-in-vercel) and §1.2 (only-in-origin) and §1.3 (different on both). For each, decide one of:

- **KEEP-PROD** — production is correct; QookAndroid's version (if any) is abandoned.
- **PORT** — bring QookAndroid's version into production unchanged (or with a tiny adapter).
- **RE-IMPLEMENT** — the QookAndroid version targets a different architecture; rewrite it against `lib/billing/serverBilling.ts` and the production schema before landing.
- **DROP** — neither side should keep it (e.g., `services/aiproxyservices copy`, `android/build_output.txt`, `artifacts/payment-audit-2026-05-18/`).

Capture this triage as a checked-in table in `RECONCILIATION_TRIAGE.md` on a feature branch off `vercel_origin/main`. The table is the audit trail.

### 3.3 Stage 2 — Land in dependency order

The order matters because production's API code imports `lib/billing/serverBilling.ts`. Anything that touches billing has to be re-implemented, not cherry-picked.

Land in this order, one PR per group, each PR cut from `vercel_origin/main`:

1. **Process & docs (no runtime risk).** PORT `CLAUDE.md`, `AGENT.md`, `docs/` tree, `DEPLOYMENT_STATUS.md`, `SUPABASE_SECURITY_PLAN.md`. These are pure documentation. They give every subsequent PR something to reference.
2. **Build & test scaffolding.** PORT `scripts/validate-env.mjs`, `vitest.config.ts`, `vitest.setup.ts`, the `prebuild` / `prebuild:android` / `test` scripts in `package.json`, `tailwind.config.js`, `postcss.config.js`. Verify production still builds (`npm run build`) and tests pass (`npm test`).
3. **Pure library code with tests.** PORT `lib/dateRange`, `lib/mealSelection`, `lib/mealSanitizer`, `lib/plannerResolution`, `lib/preferenceProfile`, `lib/appChrome`, `hooks/useAppChrome`. These should drop in cleanly; their tests give us confidence.
4. **UI components & their tests.** PORT QookAndroid's component tests against the production component files. Where the components diverge in shape, re-write the tests against production's component (this is the "RE-IMPLEMENT" path for tests).
5. **Migrations missing from production.** This is the largest single chunk and the riskiest. For every migration in §1.2, run the live-vs-repo audit (see `AGENTIC_DEV_GUIDE.md` §5) first to determine whether the migration has already been applied to live Supabase. Then:
   - If applied: commit the migration file to repo only (no execution).
   - If not applied: open a PR that adds the migration file AND a `--dry-run` plan, and apply the migration in a dedicated low-traffic window with manual review.
   - Some of QookAndroid's migrations (e.g., `20260503_payment_system_alignment.sql`) likely conflict with production's `20260328_unified_credit_billing.sql`. Those need re-authoring, not porting.
6. **API surface.** RE-IMPLEMENT `api/bootstrap.ts` + `services/bootstrapService.ts` against production's billing layer. PORT `api/update-billing-preference.ts` after re-pointing it at `serverBilling.ts`. RE-IMPLEMENT `api/promptContext.ts` if production needs prompt-context extraction (currently production inlines it).
7. **Native Android.** Decide on the native Google auth plugin (§4). If keeping: PORT `lib/nativeGoogleAuth.ts`, `pages/NativeAuthPage.tsx`, `pages/AuthCallbackPage.tsx`, `NativeGoogleAuthPlugin.java`, `android/app/google-services.json` (verify it doesn't leak secrets in repo first; if it does, move to env). Update `capacitor.config.ts` and `package.json` for `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor/share`.
8. **Store assets and asset-build scripts.** PORT `store_assets/`, `resize-icons.mjs`, `scripts/build_*.py`.
9. **App-shell wiring (the big one).** Reconcile `App.tsx` and `Router.tsx`. This is the highest-risk PR; do it last and split it across multiple smaller PRs if possible (e.g., one PR per route group).

After each PR merges, redeploy and smoke-test www.qook.in before opening the next one. The merge to `vercel_origin/main` **is** the deploy, so order matters.

### 3.4 Stage 3 — Cut over (Day N)

When the triage table shows zero open items:

1. Open a final PR against `vercel_origin/main` that updates `CLAUDE.md` to remove the "two diverged remotes" guardrail (or to reframe it as historical context).
2. On `origin`, rename `main` → `archive/qookandroid-pre-merge-2026-05-24` and delete the local `main`. Re-create `origin/main` as a mirror of `vercel_origin/main`:
   - `git fetch vercel_origin && git push origin vercel_origin/main:refs/heads/main`
   - Configure `origin/main` as a fast-forward-only mirror going forward.
3. From this point, `origin` is purely a personal mirror; `vercel_origin` is canonical.

### 3.5 What NOT to do

- Do **not** open a single mega-PR that "merges QookAndroid into QookCommander." It will be unreviewable and the merge commit will hide the per-file triage decisions.
- Do **not** `git merge origin/main` into a `vercel_origin/main`-rooted branch. There is no common ancestor; the merge would be a noisy 256-file diff and would silently overwrite production-only behavior in conflicts.
- Do **not** apply QookAndroid's `supabase/migrations/*.sql` files against the live DB without running the live-vs-repo audit first. Some of them assume schema state that production's `20260328_unified_credit_billing.sql` invalidates.
- Do **not** delete the backup directory until the cutover in Stage 3 is signed off.

---

## 4. Web + Android in the target structure

In the consolidated layout (rooted on what is currently `vercel_origin/main`):

- **One web bundle**, built by `vite build`. The same TS/TSX source serves the website AND is wrapped by Capacitor for the Android app.
- **`android/`** stays at the repo root. `npm run android` (after porting that script) runs `vite build --base ./ && npx cap sync android && npx cap run android`.
- **Platform branching** stays in `utils/platform.ts::isNative()`. UI that must differ on native (Google auth popup vs. native plugin, push notifications, file picking) checks `isNative()` rather than building two bundles.
- **Native-only code paths** import from `lib/nativeGoogleAuth.ts`, `services/notificationService.ts`, etc. These should be tree-shaken out of the web build (verify via the bundle analyzer after porting).
- **API (`api/`)** ships only to Vercel and is irrelevant to the Android wrapper at build time. The Android app talks to the same Vercel endpoints over HTTPS via `CapacitorHttp`.
- **Release flows:**
  - _Website:_ merge a PR into `vercel_origin/main` → Vercel auto-deploys to www.qook.in.
  - _Android:_ from the same commit, run `npm run build:android && npx cap sync android`, then bump `android/app/build.gradle` `versionCode`/`versionName`, build an AAB in Android Studio, and upload to Play Console. The Android release is **always a tagged commit on `vercel_origin/main`** so the website and the APK ship from identical TS source.
- **Versioning:** introduce a `version.ts` at the project root exporting `WEB_VERSION` (from `package.json`) and `ANDROID_VERSION_CODE`. Show both in a hidden settings screen so production bugs can be traced to a known build.

The shared-vs-diverged split:

| Concern | Shared (one source) | Diverges per target |
| --- | --- | --- |
| React UI, contexts, services | yes | no |
| AI/billing/payment logic | yes | no |
| Supabase schema and migrations | yes (`supabase/`) | no |
| Auth | mostly shared (`lib/googleAuth.ts`) | web uses GIS popup, native uses `lib/nativeGoogleAuth.ts` + Java plugin |
| Push / local notifications | wrapper code shared | only registers on native |
| Build output | one TS source | website = `dist/`, Android wraps `dist/` into APK/AAB |
| Versioning | semver in `package.json` | Android adds `versionCode` integer in Gradle |
| Env validation | shared (`scripts/validate-env.mjs`) | runs `web` mode for website, `android` mode for app |

---

## 5. Branch & remote strategy going forward

To prevent the divergence from recurring once Stage 3 closes:

- **One canonical remote** — `vercel_origin` (rename to `origin` post-cutover for less confusion). All deploys come from its `main`.
- **No long-lived feature forks at the remote level.** Personal mirrors are fine; deploy targets are not.
- **Branch naming:** `fix/*`, `feat/*`, `chore/*`, `release/*`. All branches cut from `main`. PRs against `main` only.
- **Protect `main`** in GitHub settings: require PR review, require CI green, **disallow force-push**, disallow deletion. (If branch protection isn't already on, that's the single highest-leverage change available.)
- **Releases tag the merged commit:** `web-vYYYY.MM.DD-N` for web, `android-vX.Y.Z` for Android. Same tagged commit serves both.
- **Migrations workflow** — see `AGENTIC_DEV_GUIDE.md` §5. Every PR that adds a migration must also (a) include the migration file under `supabase/migrations/` and (b) link to the run log from when it was applied. No "applied to live but not committed" and no "committed but not applied."
- **CLAUDE.md** retains the "never force-push main" guardrail rephrased as a single-remote rule once the dual-remote situation is resolved.

If a second remote is ever added again (e.g., a public mirror), it must be configured as **mirror-only**: `git push <mirror> main` is allowed but the mirror's main is fast-forward only and is never deployed.

---

## 6. Recommendation, one sentence

Stop treating `origin/main` as a parallel deploy target; freeze it, port its valuable additions onto `vercel_origin/main` via reviewed PRs in the order in §3.3, and after cutover make `vercel_origin/main` the single canonical lineage with branch protection enforcing fast-forward-only updates.
