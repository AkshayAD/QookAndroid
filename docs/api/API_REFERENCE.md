# API Reference

> **Last Updated:** January 2026  
> **Base URL:** `https://qook.in/api`

---

## Authentication
All API endpoints use Supabase Auth session tokens. The frontend automatically includes the session in requests.

---

## Endpoints

### POST `/api/create-subscription`
Creates a new Razorpay subscription.

**Request:**
```json
{
  "razorpay_plan_id": "plan_xxx",
  "customer_id": "cust_xxx",          // optional, created if not provided
  "customer_email": "user@example.com",
  "customer_phone": "9999999999",
  "internal_plan_id": "pro",          // to fetch offer_id from database
  "apply_first_month_discount": true
}
```

**Response:**
```json
{
  "subscriptionId": "sub_xxx",
  "customerId": "cust_xxx"
}
```

---

### POST `/api/cancel-subscription`
Cancels the user's active subscription at end of billing cycle.

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

---

### POST `/api/razorpay-webhook`
Handles Razorpay payment events. Called by Razorpay, not by frontend.

**Events Handled:**
| Event | Action |
|-------|--------|
| `subscription.activated` | Set status to 'active', award credits |
| `subscription.charged` | Log payment, refresh subscription credits |
| `subscription.cancelled` | Set status to 'cancelled' |
| `subscription.completed` | Set status to 'expired' |
| `subscription.halted` | Set status to 'halted' |
| `payment.failed` | Log failure |

**Security:**
Verifies Razorpay signature using webhook secret.

---

### POST `/api/verify-payment`
Verifies a Razorpay payment signature after checkout.

**Request:**
```json
{
  "razorpay_payment_id": "pay_xxx",
  "razorpay_subscription_id": "sub_xxx",
  "razorpay_signature": "signature_string"
}
```

**Response:**
```json
{
  "verified": true
}
```

---

### POST `/api/create-customer`
Creates a Razorpay customer if one doesn't exist.

**Request:**
```json
{
  "email": "user@example.com",
  "phone": "9999999999",
  "name": "User Name"
}
```

**Response:**
```json
{
  "customerId": "cust_xxx"
}
```

---

## Supabase Direct Operations

These operations go directly to Supabase via the client SDK, not through API routes.

### Authentication
- `supabase.auth.signInWithOAuth()` - Google OAuth login
- `supabase.auth.signOut()` - Logout
- `supabase.auth.getSession()` - Get current session

### User Data
- `supabase.from('user_profiles').select()` - Get user profile
- `supabase.from('preference_profiles').select()` - Get dietary profiles
- `supabase.from('user_settings').select()` - Get settings

### Subscriptions
- `supabase.from('user_subscriptions').select()` - Get subscription
- `supabase.from('subscription_plans').select()` - Get all plans

### Credits
- `supabase.from('user_credits').select()` - Get credit balance

### Meal Plans
- `supabase.from('weekly_plans').select()` - Get meal plans
- `supabase.from('weekly_plans').insert()` - Save new plan

---

## Service Functions

### `subscriptionService.ts`

| Function | Purpose |
|----------|---------|
| `getSubscriptionPlans()` | Fetch all subscription plans |
| `getUserSubscription(userId)` | Get user's active subscription |
| `getUserCredits(userId)` | Get credit balance summary |
| `cancelSubscriptionAPI(userId)` | Cancel subscription |

### `razorpayService.ts`

| Function | Purpose |
|----------|---------|
| `initializeRazorpayPayment(props)` | Open Razorpay checkout |
| `getOrCreateCustomer(email, phone, name)` | Get/create Razorpay customer |

### `supabaseService.ts`

| Function | Purpose |
|----------|---------|
| `getUserSettings(userId)` | Get user settings |
| `saveUserSettings(userId, settings)` | Save user settings |
| `getPreferenceProfiles(userId)` | Get dietary profiles |
| `savePreferenceProfile(profile)` | Save dietary profile |

### `referralService.ts`

| Function | Purpose |
|----------|---------|
| `applyReferralCode(userId, code)` | Apply referral code |
| `getUserReferralCode(userId)` | Get user's referral code |
| `generateReferralLink(code)` | Generate share link |

---

## Error Handling

All API endpoints return errors in this format:
```json
{
  "error": "Error message here",
  "details": "Optional additional details"
}
```

Common HTTP status codes:
- `400` - Bad request (missing params)
- `401` - Unauthorized
- `404` - Not found
- `500` - Server error
