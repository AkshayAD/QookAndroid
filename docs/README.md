# QookCommander Documentation

> **Comprehensive documentation for maintaining and understanding the QookCommander application.**

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) | System overview, tech stack, folder structure |
| [Pricing & Subscriptions](./PRICING_AND_SUBSCRIPTIONS.md) | Plans, pricing logic, Razorpay integration |
| [Credit System](./CREDIT_SYSTEM.md) | Types of credits, expiry rules, consumption |
| [Cancellation & Account](./CANCELLATION_AND_ACCOUNT.md) | Cancel flow, account deletion, lifecycle |
| [Database Schema](./DATABASE_SCHEMA.md) | Tables, relationships, RLS policies |
| [API Reference](./API_REFERENCE.md) | All API endpoints and service functions |
| [Referral System](./REFERRAL_SYSTEM.md) | How referrals work, anti-fraud measures |
| [Environment Setup](./ENVIRONMENT_SETUP.md) | Developer onboarding guide |
| [Razorpay Setup](./RAZORPAY_SETUP_GUIDE.md) | Dashboard configuration |

---

## Key Information Summary

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind
- **Backend:** Vercel Serverless Functions
- **Database:** Supabase (PostgreSQL)
- **Payments:** Razorpay
- **AI:** Google Gemini

### Subscription Plans
| Plan | Price/4 weeks | First Month* | Monthly Credits |
|------|---------------|--------------|-----------------|
| Free | ₹0 | ₹0 | 8 (trial) |
| Basic | ₹99 | ₹49.50 | 8 |
| Pro | ₹199 | ₹99.50 | 20 |
| BYOK | ₹59 | ₹29.50 | Unlimited** |

*With 50% UPI offer  
**Requires own Gemini API key

### Critical Razorpay IDs
| Plan | Razorpay Plan ID |
|------|------------------|
| Basic | `plan_S4BLAndK5YDM77` |
| Pro | `plan_S4BKRlvNzR6u6T` |
| BYOK | `plan_S4BLrHH65OLboK` |
| UPI Offer | `offer_S49VBMr2hAMZMk` |

### Important URLs
- **Production:** https://qook.in
- **Supabase:** https://supabase.com/dashboard/project/igcmhlfonulqtxsiiisb
- **Razorpay:** https://dashboard.razorpay.com
- **Vercel:** https://vercel.com (deployment)

---

## For New Team Members

1. Start with [Environment Setup](./ENVIRONMENT_SETUP.md)
2. Read [Technical Architecture](./TECHNICAL_ARCHITECTURE.md)
3. Understand [Database Schema](./DATABASE_SCHEMA.md)
4. Review [Pricing & Subscriptions](./PRICING_AND_SUBSCRIPTIONS.md)

---

## Document Maintenance

When updating the codebase, please update the relevant documentation:

| Code Change | Update Document |
|-------------|-----------------|
| New API endpoint | API_REFERENCE.md |
| Pricing changes | PRICING_AND_SUBSCRIPTIONS.md |
| New database table | DATABASE_SCHEMA.md |
| Credit logic changes | CREDIT_SYSTEM.md |
| Auth/subscription changes | CANCELLATION_AND_ACCOUNT.md |

---

## Quick Reference

### Key Files
```
api/
  create-subscription.ts    # Create Razorpay subscription
  cancel-subscription.ts    # Cancel subscription
  razorpay-webhook.ts       # Payment webhooks

services/
  subscriptionService.ts    # Subscription logic
  razorpayService.ts        # Checkout integration
  supabaseService.ts        # Database operations
  referralService.ts        # Referral system

components/
  PricingContent.tsx        # Pricing page
  SettingsModal.tsx         # User settings
  OnboardingWizard.tsx      # New user flow
```

### Environment Variables
```env
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY  # Supabase admin key
VITE_RAZORPAY_KEY_ID       # Razorpay public key
RAZORPAY_KEY_SECRET        # Razorpay secret
VITE_GEMINI_API_KEY        # Gemini API key
```
