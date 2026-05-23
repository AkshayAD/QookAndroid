# Cancellation & Account Management Guide

> **Last Updated:** January 2026  
> **Maintainer:** QookCommander Team

---

## Table of Contents
1. [Subscription Cancellation](#subscription-cancellation)
2. [Account Deletion](#account-deletion)
3. [Subscription Lifecycle](#subscription-lifecycle)
4. [Edge Cases](#edge-cases)

---

## Subscription Cancellation

### User Flow
1. User opens **Settings** (gear icon in dashboard)
2. Scrolls to "Subscription Management" section
3. Clicks "Cancel Subscription" button
4. Confirms in alert dialog
5. Subscription marked for cancellation

### Technical Flow

```
User clicks Cancel → SettingsModal.tsx
                   → cancelSubscriptionAPI() in subscriptionService.ts
                   → POST /api/cancel-subscription
                   → Razorpay API: cancel with cancel_at_cycle_end=true
                   → Database update: status='cancelled'
                   → Success response → Page reload
```

### Key Behavior: `cancel_at_cycle_end: true`

When cancelling, we use Razorpay's `cancel_at_cycle_end: true` parameter:
- ✅ User keeps access until current billing period ends
- ✅ No refund is processed
- ✅ No more invoices are generated
- ✅ Subscription terminates automatically at period end

### API Endpoint: `/api/cancel-subscription`

**Request:**
```json
{
  "userId": "uuid-of-user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "razorpayCancelled": true
}
```

### Database Changes on Cancellation
```sql
UPDATE user_subscriptions 
SET status = 'cancelled', 
    cancelled_at = NOW(),
    updated_at = NOW()
WHERE user_id = ?;
```

### What Happens to Credits
- **Subscription credits:** Remain valid until billing period ends
- **Weekly bonus:** No more bonus credits awarded after cancellation
- **Purchased credits:** Remain valid indefinitely (never expire)

---

## Account Deletion

### Current Implementation
Account deletion is handled via the Settings modal with an `onDeleteAccount` prop.

### Deletion Flow
1. Cancel any active Razorpay subscription first
2. Delete user data from Supabase tables
3. Delete auth user from Supabase Auth

### Tables to Clear (in order)
Due to foreign key constraints, delete in this order:

1. `user_credits` - Credit records
2. `weekly_plans` - Meal plan history
3. `preference_profiles` - Dietary profiles
4. `user_settings` - App settings
5. `referrals` - Referral records (where referee)
6. `referral_codes` - User's referral code
7. `subscription_events` - Transaction logs
8. `user_subscriptions` - Subscription record
9. `user_profiles` - Profile info
10. Auth user (via Supabase Admin API)

### Important: Cancel Before Delete
Always cancel the Razorpay subscription before deleting user data to avoid:
- Orphaned subscriptions in Razorpay
- Continued billing attempts
- Webhook errors

---

## Subscription Lifecycle

### Status Values

| Status | Meaning |
|--------|---------|
| `active` | Subscription is current and paid |
| `cancelled` | User cancelled, access until period ends |
| `expired` | Billing period ended, no longer active |
| `past_due` | Payment failed, grace period |
| `halted` | Multiple failed payments |

### Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION LIFECYCLE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [New User] ──► [Free Plan]                               │
│                      │                                      │
│                      ▼                                      │
│               [Subscribe] ──► [Active] ◄────────────┐      │
│                                  │                   │      │
│              ┌───────────────────┼───────────────────┘      │
│              │                   │                          │
│              ▼                   ▼                          │
│      [Payment Success]    [Payment Failed]                  │
│              │                   │                          │
│              │                   ▼                          │
│              │            [Past Due] ──► [Halted]          │
│              │                   │                          │
│              │                   ▼                          │
│              ▼            [Retry Success]                   │
│       [Cycle Renews] ─────────────┘                        │
│                                                             │
│        [User Cancels] ──► [Cancelled] ──► [Expired]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Webhook Events Tracked

| Event | Action |
|-------|--------|
| `subscription.activated` | Set status to 'active' |
| `subscription.charged` | Log payment, refresh credits |
| `subscription.cancelled` | Set status to 'cancelled' |
| `subscription.completed` | Set status to 'expired' |
| `subscription.halted` | Set status to 'halted' |
| `payment.failed` | Log failure, may set 'past_due' |

---

## Edge Cases

### 1. User Cancels Then Wants to Resubscribe
- User can subscribe again at any time
- New subscription creates fresh record
- Old credits from previous subscription are lost at expiry

### 2. Payment Fails During Renewal
- Razorpay retries automatically (configurable in dashboard)
- After retry limit, subscription is halted
- User must update payment method

### 3. User Upgrades Mid-Cycle
- Not currently implemented
- Would require prorating logic
- **Recommendation:** User should cancel and resubscribe

### 4. User Downgrades Mid-Cycle
- Not currently implemented
- Same recommendation as upgrade

### 5. Subscription Already Cancelled in Razorpay
- API handles gracefully
- Logs warning but continues
- Database still updated to 'cancelled'

---

## Key Files

| File | Purpose |
|------|---------|
| `api/cancel-subscription.ts` | Cancel API endpoint |
| `api/razorpay-webhook.ts` | Payment event handler |
| `services/subscriptionService.ts` | Client-side helpers |
| `components/SettingsModal.tsx` | Cancel button UI |

---

## Testing Cancellation

### In Test Mode (Razorpay)
1. Create test subscription
2. Call cancel endpoint
3. Verify Razorpay dashboard shows "Cancelled"
4. Verify database status is "cancelled"

### Manual Database Check
```sql
SELECT id, user_id, plan_id, status, cancelled_at, current_period_end
FROM user_subscriptions
WHERE user_id = 'your-user-id';
```
