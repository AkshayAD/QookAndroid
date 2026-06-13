# QookCommander Deployment Status Documentation

**Updated:** 2026-06-12  
**Project:** QookCommander - AI Home Cook Management App

---

## Current Deployment Status

### Production State

| Task | Status | Details |
|------|--------|---------|
| Production deploy | Complete | `www.qook.in` serves QookCommander `main` commit `4403e42` (2026-06-13 payment+hardening releases, browser-smoke + API-matrix verified). |
| Payment hardening | Complete | 2026-06-13: server-side price binding + payment intents, idempotency, delete-account auth, cancel-at-period-end, no-expiry credits, webhook fail-closed/dedupe, AI rate limiting, complete account deletion, atomic referral. Commits `58e3c2d`+`4403e42`. Live DB migrations applied+verified. |
| Security rollout | Complete | 2026-06-12 rollout completed across GitHub, Vercel, and Supabase. See `artifacts/security-rollout-notes-2026-06-12.md`. |
| Supabase migration | Complete | Migration `20260607120000` applied. |
| Recipe search | Complete | `recipe-search` v26 deployed. |
| QookAndroid record repo | Current | QookAndroid `main` is at `63c9faa`; it is the Android/dev record repo and does not deploy production. |

### Needs Attention

| Task | Status | Details |
|------|--------|---------|
| Duplicate Vercel Project | Verify/delete | Project `qookcommander` at `qookcommander.vercel.app` is a duplicate if still present. |
| Root Domain DNS | Verify | `qook.in` A record should point to Vercel IP `76.76.21.21`. |
| Environment Variables | Verify | Confirm Vercel production env vars match the current security rollout notes. |

---

## How to Deploy

Production deploys only through QookCommander:

1. Branch from `vercel_origin/main`.
2. Push the branch and review the Vercel preview.
3. **Browser-validate the preview** (MANDATORY — curl smoke is not enough): `node scripts/browser-smoke.mjs <preview-url> "_vercel_jwt=<cookie>"`. Must report 0 CSP violations, 0 console/page errors, styled rendering. The 2026-06-13 incident (site shipped unstyled because the CSP blocked prod's `cdn.tailwindcss.com` script) passed every curl check and was only visible in a real browser.
4. Fast-forward merge to `main`; never force-push or rewrite `main`.
5. Re-run `node scripts/browser-smoke.mjs https://www.qook.in` against production; on prod the login modal must show the Google sign-in iframe (`gisIframes>=1`).

**CSP caveat:** prod's `index.html` differs from QookAndroid's — it loads Tailwind from `cdn.tailwindcss.com` and fonts from `fonts.googleapis.com` at runtime. Any CSP change must be validated against the deployed lineage's actual HTML, in a browser. The canonical CSP lives identically in both repos' `vercel.json` since `af321c3`.

QookAndroid is the Android/dev record repo. Do not treat it as the production deploy source.

`D:/Projects/Cook Commander` is deprecated: it is stale since 2026-03-30, has diverged history, and has been superseded by later changes. Do not work there, and do not delete it without owner sign-off.

---

## Project URLs

### Live Deployments

- **Production Site:** https://www.qook.in (or https://qook.in)
- **Vercel Preview:** https://qook-commander.vercel.app

### Configuration Dashboards

- **Vercel (KEEP):** https://vercel.com/akshay-dewalwars-projects/qook-commander
- **Vercel (DELETE):** https://vercel.com/akshay-dewalwars-projects/qookcommander
- **GoDaddy DNS:** https://dcc.godaddy.com/control/dnsmanagement?domainName=qook.in
- **Supabase:** https://supabase.com/dashboard/project/igcmhlfonulqtxsiiisb
- **GitHub Repo:** https://github.com/AkshayAD/QookCommander

---

## Supabase Configuration

### API Keys (for Vercel Environment Variables)

```
VITE_SUPABASE_URL=https://igcmhlfonulqtxsiiisb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnY21obGZvbnVscXR4c2lpaXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTcxOTAsImV4cCI6MjA3OTk5MzE5MH0.N1cXt7xBOF3E8FYnBBsJyNq0LYR8g9gnNJZcxkJYnHc
```

### Redirect URLs (Already Configured in Supabase)

- `https://qook.in/*`
- `https://www.qook.in/*`
- `https://qookcommander.vercel.app/*`
- `http://localhost:3000/*`

---

## DNS Configuration (GoDaddy to Vercel)

### Required DNS Records for qook.in

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 76.76.21.21 | 600 |
| CNAME | www | cname.vercel-dns.com | 600 |

### Current Status

- CNAME for `www` appears configured.
- A record for `@` should point to Vercel's IP.

---

## Remaining Tasks for Next Agent

1. Delete duplicate Vercel project `qookcommander` if it still exists.
2. Verify environment variables in the `qook-commander` project against the 2026-06-12 rollout notes.
3. Verify DNS propagation for both `qook.in` and `www.qook.in`.
4. Test Google OAuth login flow on production.
5. Test full application flow: login, preferences, meal generation.

---
