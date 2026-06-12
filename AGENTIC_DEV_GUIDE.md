# Agentic Development Guide — Qook (Website + Android)

_Plan only. Date: 2026-05-24. Companion document: `WEBSITE_AND_APP_STRATEGY.md`._

This guide is for AI coding agents (Claude Code, codex, etc.) operating in this repo. It encodes the conventions, guardrails, and verification steps that keep autonomous changes safe in a codebase that has bitten us before.

---

## 0. Read this first

This repo has previously had agents introduce **non-obvious production regressions** because:

1. Two remotes had diverged main branches (see `WEBSITE_AND_APP_STRATEGY.md`). An agent fixed a bug on `origin/main`'s `api/ai-stream.ts` that would have **removed `family_pro` tier support from production** if deployed.
2. The live Supabase project had RLS policies and indexes that did not exist in the repo's migration files. Agents writing migrations assumed the repo was the source of truth; it wasn't.
3. Diffs that "look like cleanup" (removing a function that's actually re-exported, deleting a migration that's actually applied to live) silently destroy load-bearing behavior.

The default mode for an agent in this repo is **read, verify against the live system, then propose** — not "edit and ship."

---

## 1. Repo orientation

Project root is `D:\Projects\Qook-Android\` (confirmed flat layout after 2026-05-23 cleanup).

```
D:\Projects\Qook-Android\
├── android\               Capacitor wrapper for the Play Store build
├── api\                   Vercel serverless functions
├── components\            React components (web + WebView)
├── pages\                 Route-level components
├── services\              Side-effectful integrations (Supabase, Razorpay, Gemini, etc.)
├── lib\                   Pure helpers and reusable logic
│   └── billing\           Server-side billing layer (production canonical)
├── contexts\              React Context providers
├── hooks\                 Custom hooks
├── public\                Static assets
├── scripts\               Build/asset helpers and env validation
├── supabase\
│   ├── schema.sql         Declarative schema (snapshot; may lag live DB)
│   └── migrations\        Ordered migrations (may also lag live DB)
├── docs\                  Architecture / database / api / payments / features / marketing
├── store_assets\          Play Store collateral
├── CLAUDE.md              Agent guardrails (load-bearing — keep up to date)
├── AGENT.md               Index of docs/
├── DEPLOYMENT_STATUS.md   Mandatory read before any production push
├── WEBSITE_AND_APP_STRATEGY.md  Diverged-remotes reconciliation plan
└── AGENTIC_DEV_GUIDE.md   This file
```

### 1.1 Conventions worth respecting

- **No new top-level files** for transient artifacts. Diagnostic output, migration plans, and audit reports go under `artifacts/<topic>-YYYY-MM-DD/`.
- **Tests are colocated** with the file they cover (`Foo.tsx` next to `Foo.test.tsx`). Don't introduce a parallel `tests/` tree for unit tests; the existing `tests/admin-api.test.ts` is the integration-test exception.
- **Services are side-effectful.** If new code touches Supabase, Razorpay, Gemini, or any external API, it lives in `services/` (client) or `api/` (server). Components import from services, never directly from `@supabase/supabase-js`.
- **`lib/` is for pure code.** No `fetch`, no `supabase.auth.*` calls, no `process.env` reads at module scope inside `lib/`. Exceptions: `lib/supabase.ts` (constructs the client), `lib/billing/serverBilling.ts` (server-only).
- **The `@` Vite alias points to the project root**, not `src/`. Use it for cross-tree imports.
- **Path separators in scripts.** This is a Windows host running under Bash; in shell commands prefer forward slashes. In TS/JS, use `path.join` or POSIX-style paths consistently.

---

## 2. Hard guardrails (these belong in `CLAUDE.md`)

These are non-negotiable. An agent that violates one of these is doing something destructive.

1. **Never force-push, non-fast-forward push, `reset --hard`, or rewrite `vercel_origin/main`.** It is the production lineage for www.qook.in and contains ~200 commits that exist nowhere else. The 2026-05-23 backup at `D:\Projects\Qook-Android-backup-2026-05-23` is the only recovery path. _Status: already in `CLAUDE.md` as of commit `822cfbc`._
2. **Never run a migration against the live Supabase project (`igcmhlfonulqtxsiiisb`) without first running the live-vs-repo audit in §5.** Some migrations in the repo are already applied to live; some live state is not in the repo. Re-running an applied migration can corrupt data.
3. **Never commit secrets.** `.env`, `android/app/google-services.json` (if it contains client secrets), `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`. Check `.gitignore` before staging.
4. **Never use `rzp_test_*` Razorpay keys in a production build.** `scripts/validate-env.mjs` hard-fails on this; don't bypass it.
5. **Service-role keys stay server-side.** Any code under `api/` may import `SUPABASE_SERVICE_ROLE_KEY`. Code under `components/`, `pages/`, `services/`, `lib/` (excluding `lib/billing/serverBilling.ts`, which is server-imported) must not.
6. **All Supabase tables have RLS enabled.** Client-side queries must work under the caller's row scope. If a query "doesn't work locally" the answer is rarely "disable RLS."
7. **Payment-mutating API routes validate JWT server-side.** Do not weaken `requireAuthenticatedUser` / `assertRequestUser` in `cancel-subscription`, `create-subscription`, `create-order`, `verify-payment`, `update-billing-preference`, `delete-account`.
8. **Don't `git push --no-verify` or `git commit --no-verify`** unless the user explicitly says so. Pre-commit hooks exist for a reason (env validation, lint, type-check).
9. **Don't delete the 2026-05-23 backup directory** until the website+app reconciliation in `WEBSITE_AND_APP_STRATEGY.md` is signed off.
10. **No mega-merges across the diverged remotes.** Reconciliation is per-file via reviewed PRs, never a `git merge origin/main` into a vercel-rooted branch.

---

## 3. Pre-flight checklist (before any change)

Run through these before writing the first edit:

- [ ] `git status` — clean tree, on a feature branch, not on `main`.
- [ ] `git branch --show-current` — confirm I'm not on `main`.
- [ ] `git fetch origin && git fetch vercel_origin` — know how far behind I am.
- [ ] Read `CLAUDE.md` and the matching topic doc under `docs/` (e.g., for payment work, `docs/payments/RAZORPAY_SETUP.md` + `docs/payments/CREDIT_SYSTEM.md`).
- [ ] Identify which lineage this change targets:
  - Production fix → branch off `vercel_origin/main`.
  - Local-only experiment → branch off `origin/main` is fine, but **it does not deploy**.
- [ ] Search for prior work: `git log --all --grep='<topic>'` and `git log --all -S '<symbol>'`. The repo has been worked on by multiple agents; don't re-invent.
- [ ] If the change touches the database: run the live-vs-repo audit (§5) **first**. The migration file in the repo is a hypothesis until verified against live.
- [ ] If the change is to API code that imports from `lib/billing/serverBilling.ts`: confirm the function signatures match production, not a stale local copy. Production-only file at `lib/billing/serverBilling.ts` does not exist on `origin/main`.

---

## 4. Post-change verification checklist

Before reporting a task complete, verify in this order. Skipping a step is a regression waiting to happen.

1. **Type check / lint.** Whatever the project's TS or eslint config dictates. If unsure: `npx tsc --noEmit`.
2. **Unit tests.** `npm test`. If new code is untested, add at least one failing-then-passing test.
3. **Targeted integration test.** If the change touches a payment flow, run `npx vitest run api/payment-routes.test.ts`. If it touches admin: `npx vitest run tests/admin-api.test.ts`.
4. **Web build.** `npm run build`. Watch for `validate-env` failures — they indicate env drift, not a build bug.
5. **Android build (if `android/`, Capacitor, or platform-branching code was touched).** `npm run build:android && npx cap sync android`. Open in Android Studio and confirm Gradle sync.
6. **UI smoke test (if React/CSS was touched).** `npm run dev`, open `http://localhost:3000`, exercise the golden path and one edge case in a real browser. If you cannot do this, say so out loud rather than reporting success.
7. **Live-vs-repo audit (if DB-touching).** §5.
8. **Read the diff.** `git diff --staged` end-to-end. Are there changes that don't trace back to the user's request? Did I delete a function that's re-exported somewhere? Did I "fix" a comment that I shouldn't have touched?
9. **Confirm guardrails not violated.** Did this change introduce a service-role key on the client? Bypass `requireAuthenticatedUser`? Add a `.env` file to git?

---

## 5. Keeping Supabase live ↔ repo migrations in sync

This is the most common source of drift. A migration that exists in `supabase/migrations/` is **not necessarily applied** to live, and live state is **not necessarily** captured in any migration.

### 5.1 The live-vs-repo audit

Before authoring or applying any migration:

1. **Snapshot live state** for the tables you intend to touch:
   ```sql
   -- Run via Supabase SQL editor against project igcmhlfonulqtxsiiisb
   SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('<table1>', '<table2>')
    ORDER BY table_name, ordinal_position;

   SELECT n.nspname AS schema, c.relname AS table, pol.polname AS policy,
          pol.polcmd AS cmd, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
          pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
     FROM pg_policy pol
     JOIN pg_class c ON c.oid = pol.polrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('<table1>', '<table2>');

   SELECT indexrelname, indexdef
     FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('<table1>', '<table2>');
   ```
2. **Compare to `supabase/schema.sql` + every migration touching those tables.** Write the diff into `artifacts/live-vs-repo-<topic>-<date>/`. This is the document the migration PR cites.
3. **Classify each difference:**
   - **Live has X, repo doesn't** → write a migration that codifies X (even if it's a no-op for live). This is how we close gaps without re-running already-applied SQL.
   - **Repo has X, live doesn't** → either (a) apply the missing migration to live in a controlled window, or (b) the migration was abandoned and should be deleted from the repo.
   - **Both have X but they differ** → highest risk. Resolve manually; do not auto-merge.
4. **Authoring rule:** every new migration must be **idempotent** — `CREATE ... IF NOT EXISTS`, `DROP ... IF EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. If live state is ambiguous, idempotent migrations are safe to re-run.
5. **Application rule:** apply migrations to live via the Supabase SQL editor with a dry-run / transaction wrapper:
   ```sql
   BEGIN;
   -- migration body
   -- intentionally do NOT COMMIT yet; review row counts, then COMMIT or ROLLBACK
   ```
6. **Commit rule:** the migration file goes into `supabase/migrations/` only after it has been applied successfully (or confirmed to be a no-op on live). The PR description includes the audit artifact path and the live run timestamp.

### 5.2 Migration naming

`YYYYMMDD_short_kebab_description.sql`, optionally `YYYYMMDDHHMMSS_…` if multiple land same day. Avoid the mixed conventions visible in the current `migrations/` directory (some files have `HHMMSS`, some don't). Going forward, **always** use the date-only prefix unless ordering within a day matters.

### 5.3 Generated types

After every applied schema change: regenerate `lib/database.types.ts` (Supabase CLI or web dashboard). Commit it in the same PR as the migration. Stale types are how server code starts assuming columns that don't exist.

---

## 6. Env and secret handling

`scripts/validate-env.mjs` is the single source of truth for what env vars are required at build time. Don't sprinkle ad-hoc `process.env.FOO ?? throw` checks across the codebase.

- **Local dev**: `.env` (gitignored). Verify with `git check-ignore -v .env`.
- **CI / Vercel**: secrets configured in the Vercel project dashboard. The `vercel_origin` GitHub repo is where this is wired. `origin` (QookAndroid) does not deploy and does not need server secrets.
- **Android**: `android/app/google-services.json` is currently tracked on `origin/main` but absent on `vercel_origin/main`. **Before porting it (see Strategy §3.3 Stage 7), confirm it doesn't contain a client secret.** Google Services JSON typically contains client IDs (public) and project numbers (public) but no secrets — verify per-file.
- **Rotation**: if a secret is ever committed by mistake, rotate it on the provider side first (Supabase, Razorpay, Google Cloud), then remove from git history. Removing from history is not enough on its own; the leaked key is compromised.

---

## 7. Safe deployment flow (production = www.qook.in)

Production is `vercel_origin/main`. Repeat from `WEBSITE_AND_APP_STRATEGY.md` because this is the load-bearing part:

```bash
# 1. Sync
git fetch origin && git fetch vercel_origin

# 2. Branch off PRODUCTION
git checkout -b fix/my-change vercel_origin/main

# 3. Make the change (re-implement, don't blind-cherry-pick from origin/main
#    if production has a different architecture)
# ... edits ...
git commit -m "fix: …"

# 4. Push to vercel_origin
git push -u vercel_origin fix/my-change

# 5. Open a PR against vercel_origin/main
gh pr create --base main --head fix/my-change --title "…" --body "…"

# 6. Review the diff in the PR (Vercel will build a preview)
# 7. Merge — the merge IS the deploy
```

For the **website**, the merge to `vercel_origin/main` triggers Vercel's deploy to www.qook.in. For the **Android app**, after the merge land, check out that commit locally, run `npm run build:android && npx cap sync android`, bump `versionCode`/`versionName` in `android/app/build.gradle`, build an AAB in Android Studio, and upload to Play Console. Tag the commit `android-vX.Y.Z` so we can trace which TS source is in which APK.

### 7.1 Pre-deploy checklist

- [ ] `git diff vercel_origin/main..HEAD` reviewed end-to-end.
- [ ] No new `console.log` left in API or services.
- [ ] No service-role key on the client side.
- [ ] All affected env vars are configured in Vercel.
- [ ] `npm run build` succeeds locally with prod env.
- [ ] `npm test` is green.
- [ ] If schema changed: live-vs-repo audit done, migration applied to live, types regenerated.
- [ ] PR description names a rollback plan ("revert the PR" is sufficient for most cases).

### 7.2 Rollback

Vercel keeps prior deployments. To roll back the website: in the Vercel dashboard, redeploy the previous successful production deployment. To roll back code: open a "Revert" PR on the merge commit; merging it triggers the redeploy. For Android: roll back is via Play Console's previous APK / staged rollout halt — there is no instant rollback the way Vercel has.

---

## 8. "Looks safe but is destructive here" — a curated list

These patterns are routinely safe in other codebases and routinely catastrophic in this one:

- **`git push origin main` while local main matches `origin/main`** — fine. **`git push vercel_origin main` while local main does NOT match `vercel_origin/main`** — destroys production history. Always verify the target remote.
- **`git push --force` to fix a "small" mistake on `vercel_origin/main`** — never. The mistake is recoverable; the force-push usually isn't.
- **"Cleaning up" a migration file in `supabase/migrations/`** — the file may already be applied to live; deleting it doesn't undo the live change, it just hides it from the next person.
- **Renaming a column in `supabase/schema.sql`** — the schema file is descriptive, not prescriptive. Renaming there does not rename the column in live. The migration is what changes live; the schema file is a snapshot.
- **Removing an `unused` import in `api/ai-stream.ts`** — production imports from `lib/billing/serverBilling.ts` for `ACTION_BILLING`, `assertActionAccess`, `consumeMealCredit`, `getBillingSummary`, `shouldUseByok`, `getSupabaseAdmin`. If you're looking at the QookAndroid version of the file, that helper doesn't exist there; "the import is unused" is the wrong conclusion.
- **Adding `family_pro` to a tier-check enum in QookAndroid code** — the tier exists in production billing but not in `origin/main`'s code. The fix has to land on the production lineage, not QookAndroid's.
- **`npm install` adding a transitive dep that pins a new version** — production uses `pnpm-lock.yaml`, QookAndroid uses `package-lock.json`. Running `npm install` on a vercel-rooted branch can quietly change resolution and break the production build. Use the package manager matching the branch's lockfile.
- **"Just disabling RLS for testing"** — service-role bypasses RLS server-side. There's no legitimate reason to disable RLS on a table; if a query needs to run unrestricted, run it via a service-role-keyed `api/` route.
- **`git clean -fd`** — kills the `D:\Projects\Qook-Android-backup-2026-05-23` directory if it ever lives inside the repo (it doesn't today, but if it ever does, `clean -fd` is unrecoverable).
- **Deleting `artifacts/payment-audit-2026-05-18/`** — looks like cruft, was actually evidence for a payment hardening pass. Confirm with the user before clearing audit folders.
- **Running tests in watch mode for "just a sec" and walking away** — Vitest's watcher can re-trigger on temp files written by other tools; in a long session this can mask real failures. Run `npm test` (one-shot) for verification, watch only during active development.
- **Editing files inside `android/build/`, `dist/`, or `node_modules/`** — these are generated. Edits are lost on next build. If something in there is wrong, fix the source.
- **Touching `.env.example` without updating `scripts/validate-env.mjs`** — they must agree. The validator is what actually enforces; the example is documentation. Out-of-sync example files mislead future agents.

---

## 9. When in doubt

- Ask the user. The cost of a clarifying question is small; the cost of a wrong production push is the 2026-05-23 backup or worse.
- Prefer planning to action. Write the migration plan / refactor plan as a markdown file in the repo root, get sign-off, then apply.
- If the live system disagrees with the repo, the live system is what users experience — treat it as the source of truth until reconciled.
- Read `CLAUDE.md` again. It's load-bearing; it should be updated whenever a new class of mistake is discovered.

---

## 10. Maintenance of this guide

Whenever an agent (or a human) trips over a footgun that isn't listed in §8, add it. Whenever a guardrail in §2 becomes outdated (e.g., after the dual-remote reconciliation in `WEBSITE_AND_APP_STRATEGY.md` closes), update both this file and `CLAUDE.md` in the same PR. This file is only useful if it reflects current reality.
