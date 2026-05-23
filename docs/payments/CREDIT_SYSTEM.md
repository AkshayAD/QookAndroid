# Credit System Guide

> **Last Updated:** January 2026  
> **Maintainer:** QookCommander Team

---

## Overview

Credits are the currency for AI features in QookCommander. Each AI generation consumes 1 credit.

---

## Credit Types

| Type | Source | Expires | Purchasable |
|------|--------|---------|-------------|
| `subscription` | Monthly plan renewal | End of billing cycle | No |
| `bonus` | Weekly bonus award | Next bonus (Sunday) | No |
| `trial` | Free plan signup | 28 days | No |
| `purchased` | Credit pack purchase | **Never** | Yes |
| `referral` | Referral rewards | **Never** | No |

---

## Credit Consumption Priority

When a user generates content, credits are consumed in this order:

1. **Bonus credits** (expire soonest - next Sunday)
2. **Subscription credits** (expire at billing cycle end)
3. **Trial credits** (expire after 28 days)
4. **Purchased credits** (never expire)
5. **Referral credits** (never expire)

This ensures users always use expiring credits first.

---

## Credit Amounts by Plan

| Plan | Monthly Credits | Weekly Bonus | Can Buy |
|------|-----------------|--------------|---------|
| Free | 8 (trial only) | +1 | ❌ |
| Basic | 8 | +1 | ✅ |
| Pro | 20 | +2 | ✅ |
| BYOK | Unlimited* | +1 | ❌ |

*BYOK uses user's own API key, doesn't consume credits

---

## Credit Packs (Purchasable)

| Pack | Credits | Price | Per Credit |
|------|---------|-------|------------|
| Starter | 8 | ₹49 | ₹6.13 |
| Value | 20 | ₹99 | ₹4.95 |
| Bulk | 60 | ₹249 | ₹4.15 |

---

## Weekly Bonus System

### When
Every Sunday at midnight IST (automatic cron job)

### How It Works
1. Database function `award_weekly_bonus_credits()` runs
2. Checks each user's plan for `weekly_bonus` amount
3. Awards credits with expiry = next Sunday

### Implementation
```sql
INSERT INTO user_credits (user_id, credit_type, amount, remaining, source, expires_at)
SELECT 
  u.id,
  'bonus',
  sp.weekly_bonus,
  sp.weekly_bonus,
  'Weekly bonus',
  NOW() + INTERVAL '7 days'
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
JOIN auth.users u ON us.user_id = u.id
WHERE us.status = 'active';
```

---

## Credit Operations

### Consuming Credits
```typescript
// In supabaseService.ts
async function consumeCredit(userId: string): Promise<boolean> {
  // 1. Find oldest expiring credit with remaining > 0
  // 2. Decrement remaining by 1
  // 3. If remaining = 0, set consumed_at
  // 4. Return success/failure
}
```

### Checking Balance
```typescript
async function getCreditBalance(userId: string): Promise<number> {
  // Sum all remaining credits where expires_at is null or > now
}
```

### Awarding Credits
```typescript
async function awardCredits(userId: string, amount: number, type: string) {
  // Insert into user_credits with appropriate expiry
}
```

---

## Credit Expiry Rules

| Scenario | Behavior |
|----------|----------|
| User cancels subscription | Subscription credits remain until period ends |
| Billing cycle renews | Old subscription credits expire, new ones awarded |
| User upgrades | New credits added, old credits remain |
| User downgrades | Old credits remain until expiry |

---

## BYOK Mode

BYOK (Bring Your Own Key) users:
- Don't consume platform credits
- Use their own Gemini API key
- Still receive weekly bonus (for backup)

### How BYOK Detection Works
```typescript
const userSettings = await getUserSettings(userId);
if (userSettings.use_own_api_key && userSettings.gemini_api_key) {
  // Use user's API key, don't consume credits
} else {
  // Use platform API key, consume credits
}
```

---

## Database Queries

### Get all credits for a user
```sql
SELECT * FROM user_credits 
WHERE user_id = 'user-id' 
ORDER BY expires_at ASC NULLS LAST;
```

### Get active (non-expired) credit balance
```sql
SELECT SUM(remaining) 
FROM user_credits 
WHERE user_id = 'user-id'
  AND remaining > 0
  AND (expires_at IS NULL OR expires_at > NOW());
```

### Get credits expiring soon
```sql
SELECT * FROM user_credits 
WHERE user_id = 'user-id'
  AND remaining > 0
  AND expires_at <= NOW() + INTERVAL '3 days';
```

---

## Troubleshooting

### User says credits disappeared
1. Check `expires_at` - likely expired
2. Check `remaining` vs `amount`
3. Verify subscription status

### Weekly bonus not awarded
1. Check cron job is running
2. Verify user's subscription is 'active'
3. Check `weekly_bonus` in their plan

### Purchased credits expired
- Purchased credits should NEVER expire
- Check `expires_at` is NULL for 'purchased' type
- May indicate a bug in purchase flow
