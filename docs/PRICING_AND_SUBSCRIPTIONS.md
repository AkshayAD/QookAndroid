# QookCommander Pricing & Subscriptions Guide

> **Last Updated:** January 2026  
> **Maintainer:** QookCommander Team

---

## Table of Contents
1. [Subscription Plans Overview](#subscription-plans-overview)
2. [Pricing Structure](#pricing-structure)
3. [First-Month Discount Logic](#first-month-discount-logic)
4. [Razorpay Integration](#razorpay-integration)
5. [Credit System](#credit-system)
6. [Weekly Bonus Credits](#weekly-bonus-credits)

---

## Subscription Plans Overview

| Plan | Monthly Price | First Month | Credits/Month | Weekly Bonus | Profiles | History |
|------|---------------|-------------|---------------|--------------|----------|---------|
| **Free (Launch Offer)** | ₹0 | ₹0 | 8 trial | +1/week | 2 | 30 days |
| **Basic** | ₹99 | ₹49.50* | 8 | +1/week | 5 | 90 days |
| **Pro** | ₹199 | ₹99.50* | 20 | +2/week | Unlimited | 365 days |
| **BYOK** | ₹59 | ₹29.50* | Unlimited** | +1/week | 2 | 365 days |

> *With 50% UPI offer applied  
> **BYOK requires user's own Gemini API key

---

## Pricing Structure

### Regular Prices (After First Month)
- **Basic:** ₹99 every 4 weeks
- **Pro:** ₹199 every 4 weeks  
- **BYOK:** ₹59 every 4 weeks

### First-Month Prices (With 50% Offer)
- **Basic:** ₹49.50 (50% off ₹99)
- **Pro:** ₹99.50 (50% off ₹199)
- **BYOK:** ₹29.50 (50% off ₹59)

### Billing Cycle
All subscriptions bill **every 4 weeks** (not monthly). This is configured in Razorpay as "Weekly with interval 4".

---

## First-Month Discount Logic

### How It Works
1. Razorpay plans are set at **regular prices** (₹99, ₹199, ₹59)
2. A 50% offer is linked to the subscription
3. Razorpay automatically applies the discount on the first invoice only

### Active Offer
- **Offer ID:** `offer_S49VBMr2hAMZMk` (UPI offer, 50% off)
- **Payment Methods:** Works for all UPI payments
- **Max Discount:** Applied only on first invoice

### Database Configuration
```sql
-- Offer ID is stored in subscription_plans table
SELECT id, razorpay_plan_id, razorpay_offer_id, regular_price, first_month_price
FROM subscription_plans;
```

| Plan | Razorpay Plan ID | Regular Price | First Month Price |
|------|------------------|---------------|-------------------|
| Basic | `plan_S4BLAndK5YDM77` | ₹99 | ₹49 |
| Pro | `plan_S4BKRlvNzR6u6T` | ₹199 | ₹99 |
| BYOK | `plan_S4BLrHH65OLboK` | ₹59 | ₹29 |

---

## Razorpay Integration

### Dashboard Links
- **Plans:** https://dashboard.razorpay.com/app/plans
- **Offers:** https://dashboard.razorpay.com/app/offers
- **Subscriptions:** https://dashboard.razorpay.com/app/subscriptions

### Creating a Subscription (Code Flow)
1. User clicks "Subscribe" → `razorpayService.ts:initializeRazorpayPayment()`
2. API call to `/api/create-subscription` with:
   - `razorpay_plan_id` (from database)
   - `offer_id` (from database)
   - `customer_id` (fetched/created)
3. Razorpay creates subscription and returns `subscription_id`
4. User completes payment in Razorpay checkout
5. Webhook (`/api/razorpay-webhook`) updates subscription status

### Environment Variables
```env
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxx      # Public key (frontend)
RAZORPAY_KEY_SECRET=xxxxx                 # Secret key (backend only)
```

---

## Credit System

### Types of Credits

| Type | Source | Expires | Can Buy |
|------|--------|---------|---------|
| **Subscription Credits** | Monthly plan renewal | End of billing cycle | No |
| **Weekly Bonus** | Awarded every Sunday | Next bonus award | No |
| **Purchased Credits** | Credit pack purchase | **NEVER** | Pro/Basic only |
| **Trial Credits** | Free plan signup | 28 days | No |
| **Referral Credits** | Referral rewards | **NEVER** | N/A |

### Credit Consumption Priority
When a user performs an action, credits are consumed in this order:
1. Weekly bonus credits (expire soonest)
2. Subscription credits (expire at cycle end)
3. Trial credits (expire in 28 days)
4. Purchased credits (never expire)

### Credit Packs (Purchasable)
| Pack | Price | Credits | Per Credit |
|------|-------|---------|------------|
| Starter | ₹49 | 8 | ₹6.13 |
| Value | ₹99 | 20 | ₹4.95 |
| Bulk | ₹249 | 60 | ₹4.15 |

---

## Weekly Bonus Credits

### Award Schedule
- Awards given every **Sunday at midnight IST**
- Handled by database function `award_weekly_bonus_credits()`

### Bonus Amounts
| Plan | Weekly Bonus |
|------|--------------|
| Free | +1 credit |
| Basic | +1 credit |
| Pro | +2 credits |
| BYOK | +1 credit |

### Expiry
Weekly bonus credits expire when the next bonus is awarded (i.e., next Sunday).

---

## Database Tables

### `subscription_plans`
Stores plan definitions including Razorpay IDs and pricing.

### `user_subscriptions`
Tracks user subscription status, dates, and Razorpay subscription ID.

### `user_credits`
Tracks individual credit allocations with source, amount, and expiry.

---

## Key Files

| File | Purpose |
|------|---------|
| `services/subscriptionService.ts` | Subscription management functions |
| `services/razorpayService.ts` | Razorpay checkout initialization |
| `api/create-subscription.ts` | Creates Razorpay subscription |
| `api/razorpay-webhook.ts` | Handles payment events |
| `api/cancel-subscription.ts` | Cancels subscription |
| `components/PricingContent.tsx` | Pricing page UI |
