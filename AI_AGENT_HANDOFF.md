# AI Agent Handoff Prompt - QookCommander Deployment Completion

## Context
You are continuing the deployment of **QookCommander**, an AI-powered home cook management web application. The previous agent completed most of the setup, but there are remaining tasks to finalize the deployment to production.

## Project Overview
- **App:** QookCommander - AI meal planning and grocery list generator
- **Stack:** Vite + React + TypeScript + Supabase (Auth & Database)
- **Domain:** qook.in (registered on GoDaddy)
- **Hosting:** Vercel
- **Repo:** https://github.com/AkshayAD/QookCommander

## What Has Been Completed
1. ✅ All code changes pushed to GitHub (commit `e0d2fe8`)
2. ✅ Supabase URL configuration updated with qook.in redirect URLs
3. ✅ Vercel project `qook-commander` created and deployed
4. ✅ Domain `www.qook.in` added to Vercel project

## Remaining Tasks (Your Work)

### Task 1: Delete Duplicate Vercel Project
There's a duplicate project that needs to be removed:
- **DELETE:** Project `qookcommander` at https://vercel.com/akshay-dewalwars-projects/qookcommander
- **KEEP:** Project `qook-commander` at https://vercel.com/akshay-dewalwars-projects/qook-commander

### Task 2: Verify Environment Variables
Ensure these environment variables are set in the **qook-commander** Vercel project:
```
VITE_SUPABASE_URL=https://igcmhlfonulqtxsiiisb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnY21obGZvbnVscXR4c2lpaXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTcxOTAsImV4cCI6MjA3OTk5MzE5MH0.N1cXt7xBOF3E8FYnBBsJyNq0LYR8g9gnNJZcxkJYnHc
```
Go to: Settings → Environment Variables in the Vercel project

### Task 3: Verify DNS Configuration (GoDaddy)
Ensure these DNS records are set for `qook.in`:
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

GoDaddy DNS Management: https://dcc.godaddy.com/control/dnsmanagement?domainName=qook.in

### Task 4: Verify Root Domain in Vercel
Add `qook.in` (without www) to Vercel domains if not already added.
Go to: https://vercel.com/akshay-dewalwars-projects/qook-commander/settings/domains

### Task 5: Test Production Deployment
1. Visit https://qook.in and https://www.qook.in
2. Test Google OAuth login
3. Verify app loads correctly after login
4. Check that the landing page shows logged-in state when returning

## Key Dashboard URLs
- **Vercel (KEEP):** https://vercel.com/akshay-dewalwars-projects/qook-commander
- **Supabase:** https://supabase.com/dashboard/project/igcmhlfonulqtxsiiisb
- **GoDaddy:** https://dcc.godaddy.com/control/dnsmanagement?domainName=qook.in
- **GitHub:** https://github.com/AkshayAD/QookCommander

## Notes
- The app uses Google OAuth for authentication (configured in Supabase)
- Supabase redirect URLs are already configured for qook.in
- The Vercel project is connected to GitHub for automatic deployments
- Any push to `main` branch will trigger a new deployment

## Success Criteria
- Site loads at https://qook.in
- Google login works and redirects back correctly
- No duplicate Vercel projects exist
- DNS is properly configured with no errors in Vercel domains

---
*Documentation generated: January 10, 2026*
