# Razorpay First-Month Discount Setup Guide

## Overview

This guide explains how to configure Razorpay subscriptions with a 50% first-month discount for Qook Commander.

## Current State

| Plan | First Month Price | Regular Price | Razorpay Plan ID |
|------|------|------|------|
| BYOK | ₹29 | ₹58 | `plan_S2gAmmac6kYp3K` |
| Basic | ₹49 | ₹98 | `plan_S2gDLCUgikn3o8` |
| Pro | ₹99 | ₹198 | `plan_S2gFXIuHu5rDoS` |

> **Note**: Current Razorpay plans are set at first-month prices. For proper recurring billing with offers, plans need to be updated to regular prices.

---

## Step 1: Update Razorpay Plans to Regular Prices

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to **Payment Products** → **Subscriptions** → **Plans**
3. For each plan, update the amount to the regular (full) price:
   - BYOK: ₹58 (5800 paise)
   - Basic: ₹98 (9800 paise)
   - Pro: ₹198 (19800 paise)

> **Important**: Razorpay doesn't allow editing existing plans. You may need to create new plans and update the `razorpay_plan_id` in Supabase.

---

## Step 2: Create First-Month Discount Offers

For each plan, create an offer:

1. Go to **Payment Products** → **Subscriptions** → **Offers**
2. Click **+ Create Offer**
3. Configure each offer:

### BYOK First Month Offer
- **Offer Name**: `BYOK 50% First Month`
- **Display Text**: `₹29 for first month`
- **Discount Type**: Flat ₹29 OFF
- **Redemption Type**: Limited to 1 cycle
- **Applicable Payment Methods**: All (UPI, Card, NetBanking)
- **Validity**: Set appropriate dates

### Basic First Month Offer
- **Offer Name**: `Basic 50% First Month`
- **Display Text**: `₹49 for first month`
- **Discount Type**: Flat ₹49 OFF
- **Redemption Type**: Limited to 1 cycle

### Pro First Month Offer
- **Offer Name**: `Pro 50% First Month`
- **Display Text**: `₹99 for first month`
- **Discount Type**: Flat ₹99 OFF
- **Redemption Type**: Limited to 1 cycle

---

## Step 3: Update Database with Offer IDs

After creating offers, copy each `offer_id` and update Supabase:

```sql
-- Update subscription_plans with offer IDs
UPDATE subscription_plans 
SET razorpay_offer_id = 'offer_XXXXXXXXX' 
WHERE id = 'byok';

UPDATE subscription_plans 
SET razorpay_offer_id = 'offer_XXXXXXXXX' 
WHERE id = 'basic';

UPDATE subscription_plans 
SET razorpay_offer_id = 'offer_XXXXXXXXX' 
WHERE id = 'pro';
```

---

## Step 4: (If creating new plans) Update Plan IDs

If you created new Razorpay plans at regular prices:

```sql
UPDATE subscription_plans 
SET razorpay_plan_id = 'plan_NEWPLANID' 
WHERE id = 'byok';

-- Repeat for basic and pro
```

---

## How It Works

1. **Frontend** calls `/api/create-subscription` with:
   - `plan_id`: Razorpay plan ID
   - `internal_plan_id`: Internal plan ID (basic/pro/byok)

2. **API** looks up `razorpay_offer_id` from database

3. **Subscription created** with offer applied → First month at 50% off

4. **Subsequent months** charged at regular plan price

---

## Testing

1. Use Razorpay Test Mode keys
2. Create test offers in Test Mode
3. Verify subscription shows discounted first charge
4. Check that second charge would be at regular price

---

## Related Files

- `api/create-subscription.ts` - API that applies offers
- `services/razorpayService.ts` - Frontend service
- `services/subscriptionService.ts` - Plan lookup functions
