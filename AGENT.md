# AGENT INDEX & ROUTING

When working on specific domains, consult the linked documentation before proceeding if needed.

- **Architecture & Database**
  - [Technical Architecture](docs/architecture/TECHNICAL_ARCHITECTURE.md)
  - [Database Schema](docs/database/DATABASE_SCHEMA.md)
  - [Family Mode Architecture](docs/architecture/FAMILY_MODE_ARCHITECTURE.md)

- **APIs & Setup**
  - [API Reference](docs/api/API_REFERENCE.md)
  - [Environment Setup](docs/deployment/ENVIRONMENT_SETUP.md)
  - [Razorpay Setup](docs/payments/RAZORPAY_SETUP.md)
  - [Razorpay First-Month Discount](docs/payments/RAZORPAY_SETUP_GUIDE.md)

- **Core Features & Logic**
  - [Credit System](docs/payments/CREDIT_SYSTEM.md)
  - [Referral System](docs/payments/REFERRAL_SYSTEM.md)
  - [Pricing & Subscriptions](docs/payments/PRICING_AND_SUBSCRIPTIONS.md)
  - [Cancellation & Account](docs/payments/CANCELLATION_AND_ACCOUNT.md)
  - [Family Mode Specs](docs/features/FAMILY_MODE_SPECIFICATION.md)
  - [Family Mode Planning](docs/features/FAMILY_MODE_PLANNING.md)
  - [Recipe Approach](docs/features/RECIPE_APPROACH.md)
  - [Regenerate Analysis](docs/features/REGENERATE_ANALYSIS.md)
  - [Grocery & Nutrition Analysis](docs/features/GROCERY_NUTRITION_ANALYSIS.md)

- **Deployment**
  - [Deployment Status](DEPLOYMENT_STATUS.md) ← **read this before any production deployment**
  - [Environment Setup](docs/deployment/ENVIRONMENT_SETUP.md)

---

## ⚠️ Deployment Rule (MUST READ)

This project has **two GitHub repos** with diverged histories:
- `origin` → `AkshayAD/QookAndroid` — local dev copy, does NOT trigger Vercel
- `vercel_origin` → `AkshayAD/QookCommander` — **Vercel watches this. Pushes here deploy www.qook.in**

**Always push to `vercel_origin`** when changes must go to production. See `DEPLOYMENT_STATUS.md` for the safe workflow. Never force-push `origin/main` → `vercel_origin/main` directly (histories are ~150 commits apart).

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
