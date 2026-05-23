# Razorpay Integration Setup Guide

## Step 1: Create Razorpay Account

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Sign up with your business email
3. Complete KYC verification (required for live payments)

## Step 2: Get API Keys

### Test Mode (for development)
1. Log in to Razorpay Dashboard
2. Click your profile → **Test Mode** toggle (top-right)
3. Go to **Account & Settings** → **API Keys**
4. Click **Generate Key**
5. **Copy both values immediately** (Key Secret shown only once!):
   - `Key ID`: `rzp_test_xxxxx...`
   - `Key Secret`: `xxxxxxxxxxxx...`

### Live Mode (for production - needs KYC)
1. Repeat above steps with **Live Mode** toggle ON
2. You'll get production keys: `rzp_live_xxxxx...`

## Step 3: Add to Environment Variables

### Local Development (.env)
```bash
# Add to .env in project root
VITE_RAZORPAY_KEY_ID=rzp_test_yourKeyId
RAZORPAY_KEY_SECRET=yourKeySecret
```

### Vercel Production
1. Go to [Vercel Dashboard](https://vercel.com/) → Your Project → **Settings**
2. Click **Environment Variables**
3. Add:
   - `VITE_RAZORPAY_KEY_ID` = `rzp_live_yourLiveKeyId` (use live key)
   - `RAZORPAY_KEY_SECRET` = `yourLiveKeySecret` 
4. Select "Production" environment only for live keys

## Step 4: Create Subscription Plans in Razorpay

1. In Razorpay Dashboard → **Subscriptions** → **Plans**
2. Create plans matching your tiers:

| Plan Name | Period | Amount (₹) | Plan ID (save this) |
|-----------|--------|------------|---------------------|
| Basic Monthly | monthly | 49 | plan_xxxxx |
| Pro Monthly | monthly | 99 | plan_xxxxx |

3. Save the Plan IDs for use in your code

## Step 5: Update Supabase with Plan IDs

After creating Razorpay plans, run this SQL:

```sql
UPDATE public.subscription_plans 
SET razorpay_plan_id = 'plan_xxxxx' 
WHERE id = 'basic';

UPDATE public.subscription_plans 
SET razorpay_plan_id = 'plan_xxxxx' 
WHERE id = 'pro';
```

## Step 6: Test the Integration

1. Use Test Mode keys first
2. Test with Razorpay's test card: `4111 1111 1111 1111`
3. Any expiry date (future), any CVV
4. Verify webhook receives payment confirmation

## Quick Checklist

- [ ] Razorpay account created
- [ ] Test API keys generated
- [ ] Keys added to .env file
- [ ] Keys added to Vercel (production)
- [ ] Subscription plans created in Razorpay
- [ ] Plan IDs updated in Supabase
- [ ] Test payment successful

## Security Notes

> [!CAUTION]
> **Never commit API keys to Git!** Ensure `.env` is in `.gitignore`

> [!IMPORTANT]
> The `RAZORPAY_KEY_SECRET` should ONLY be used server-side (Supabase Edge Functions).
> The `VITE_RAZORPAY_KEY_ID` is safe for client-side as it's the public key.
