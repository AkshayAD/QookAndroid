# QookCommander Technical Architecture

> **Last Updated:** January 2026  
> **Maintainer:** QookCommander Team

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Data Flow](#data-flow)
4. [External Services](#external-services)
5. [Key Components](#key-components)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript |
| **Styling** | Tailwind CSS |
| **Build Tool** | Vite |
| **Backend** | Vercel Serverless Functions |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Google OAuth) |
| **Payments** | Razorpay |
| **AI** | Google Gemini API |
| **Hosting** | Vercel |
| **Domain** | qook.in (GoDaddy) |

---

## Project Structure

```
Cook-Commander/
├── api/                    # Vercel serverless functions
│   ├── cancel-subscription.ts
│   ├── create-subscription.ts
│   ├── razorpay-webhook.ts
│   └── ...
│
├── components/             # React components
│   ├── App.tsx             # Main app component
│   ├── LandingPage.tsx     # Public landing page
│   ├── PricingContent.tsx  # Pricing page
│   ├── SettingsModal.tsx   # User settings
│   ├── OnboardingWizard.tsx
│   ├── MealCard.tsx
│   ├── WeeklyPlan.tsx
│   └── ...
│
├── contexts/               # React contexts
│   ├── AuthContext.tsx     # Authentication state
│   └── ...
│
├── services/               # API & business logic
│   ├── supabaseService.ts  # Database operations
│   ├── subscriptionService.ts
│   ├── razorpayService.ts
│   ├── referralService.ts
│   └── geminiService.ts    # AI integration
│
├── types/                  # TypeScript types
│   └── subscription.ts
│
├── docs/                   # Documentation
│   ├── PRICING_AND_SUBSCRIPTIONS.md
│   ├── CANCELLATION_AND_ACCOUNT.md
│   └── ...
│
├── supabase/               # Database config
│   └── migrations/         # SQL migrations
│
├── public/                 # Static assets
├── index.html             # Entry point
├── vite.config.ts         # Vite configuration
├── vercel.json            # Deployment config
└── package.json
```

---

## Data Flow

### Authentication Flow
```
User → Google OAuth → Supabase Auth → Session Token → App
                                          ↓
                               user_profiles table created
```

### Meal Generation Flow
```
User Request → geminiService.ts → Gemini API
                    ↓
              Parse Response → Save to weekly_plans → Display UI
                    ↓
              Consume Credit (user_credits update)
```

### Payment Flow
```
User clicks Subscribe → razorpayService.ts
         ↓
    /api/create-subscription → Razorpay API
         ↓
    Razorpay Checkout → Payment
         ↓
    Razorpay Webhook → /api/razorpay-webhook
         ↓
    Update user_subscriptions → Award credits
```

---

## External Services

### Supabase
- **Project ID:** `igcmhlfonulqtxsiiisb`
- **Dashboard:** https://supabase.com/dashboard/project/igcmhlfonulqtxsiiisb
- **Functions:**
  - Auth (Google OAuth)
  - PostgreSQL database
  - Row Level Security (RLS)
  - Edge Functions (if used)

### Razorpay
- **Mode:** Live
- **Dashboard:** https://dashboard.razorpay.com
- **Webhook URL:** `https://qook.in/api/razorpay-webhook`

### Google Gemini
- **Model:** gemini-1.5-flash
- **Used for:** Meal plan generation, recipe suggestions

### Vercel
- **Dashboard:** https://vercel.com/dashboard
- **Domain:** qook.in
- **Deployment:** Auto-deploy on push to main

---

## Key Components

### App.tsx
Main application component with routing logic. Handles:
- Authentication state
- Route rendering
- Global state management

### AuthContext.tsx
React context for authentication:
- Manages Supabase session
- Provides user object
- Handles sign-in/sign-out

### SettingsModal.tsx
User settings panel:
- API key management
- Billing preferences
- Subscription management (cancel)
- Account deletion

### PricingContent.tsx
Pricing page:
- Displays subscription plans
- Triggers Razorpay checkout
- Shows current plan info

### OnboardingWizard.tsx
New user onboarding:
- Collects preferences
- Dietary restrictions
- Referral code input

---

## Environment Variables

### Required for Development
```env
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Razorpay
VITE_RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx

# Gemini
VITE_GEMINI_API_KEY=xxx

# Optional
VITE_APP_URL=https://qook.in
```

### Setting in Vercel
1. Go to Project Settings → Environment Variables
2. Add each variable with appropriate scope (Production/Preview/Development)

---

## Database Overview

### Core Tables
| Table | Purpose |
|-------|---------|
| `user_profiles` | Basic user info, referral tracking |
| `preference_profiles` | Dietary preferences per household member |
| `user_settings` | App settings (API key, etc.) |
| `user_subscriptions` | Subscription status and dates |
| `subscription_plans` | Plan definitions |
| `user_credits` | Credit balance and history |
| `weekly_plans` | Generated meal plans |
| `referral_codes` | User referral codes |
| `referrals` | Referral relationships |
| `subscription_events` | Payment/event logs |

### RLS (Row Level Security)
All tables have RLS enabled. Users can only access their own data.

---

## Deployment

### Automatic Deployment
Push to `main` branch triggers Vercel deployment.

### Manual Deployment
```bash
vercel --prod
```

### Vercel Configuration (vercel.json)
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
```
