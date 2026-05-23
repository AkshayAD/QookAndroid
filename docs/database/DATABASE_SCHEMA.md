# Database Schema Reference

> **Last Updated:** January 2026  
> **Database:** Supabase (PostgreSQL)  
> **Project ID:** `igcmhlfonulqtxsiiisb`

---

## Core Tables

### `user_profiles`
User account information and referral tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Links to auth.users |
| `display_name` | text | User's display name |
| `referred_by` | uuid (FK) | User who referred them |
| `referral_code_used` | varchar | Code they used to sign up |
| `created_at` | timestamptz | Account creation |
| `updated_at` | timestamptz | Last update |

---

### `preference_profiles`
Dietary preferences for household members.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Profile ID |
| `user_id` | uuid (FK) | Owner user |
| `name` | text | Profile name (e.g., "Mom", "Dad") |
| `dietary_type` | text | veg, non-veg, vegan, etc. |
| `allergies` | text[] | List of allergies |
| `dislikes` | text[] | Foods to avoid |
| `breakfast_preferences` | text[] | Preferred breakfast items |
| `lunch_preferences` | text[] | Preferred lunch items |
| `dinner_preferences` | text[] | Preferred dinner items |
| `special_instructions` | text | Additional notes |
| `cuisine_preferences` | text[] | Preferred cuisines |
| `location` | text | Location for regional cuisine |
| `is_active` | boolean | Include in meal planning |

---

### `user_settings`
Application settings per user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Settings ID |
| `user_id` | uuid (FK) | Owner user |
| `gemini_api_key` | text | User's Gemini API key (encrypted) |
| `use_own_api_key` | boolean | Use BYOK mode |
| `billing_mode` | text | 'subscription' or 'credits' |
| `onboarding_completed` | boolean | Finished onboarding wizard |

---

### `subscription_plans`
Plan definitions (system table).

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Plan ID: 'free', 'basic', 'pro', 'byok' |
| `name` | text | Display name |
| `regular_price` | int | Price after first month (INR) |
| `first_month_price` | int | Discounted first month price |
| `unified_credits` | int | Monthly credits (-1 = unlimited) |
| `weekly_bonus` | int | Weekly bonus credits |
| `trial_credits` | int | One-time trial credits |
| `trial_expiry_days` | int | Days until trial expires |
| `max_profiles` | int | Max preference profiles |
| `history_days` | int | Days of history kept |
| `byok_enabled` | boolean | Can use own API key |
| `can_buy_credits` | boolean | Can purchase credit packs |
| `priority_support` | boolean | Has priority support |
| `features` | text[] | Feature list for UI |
| `razorpay_plan_id` | text | Razorpay plan ID |
| `razorpay_offer_id` | text | Linked offer ID |

---

### `user_subscriptions`
Active subscription records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Subscription record ID |
| `user_id` | uuid (FK) | Subscriber |
| `plan_id` | text (FK) | Plan type |
| `status` | text | active, cancelled, expired, halted |
| `razorpay_subscription_id` | text | Razorpay subscription ID |
| `razorpay_customer_id` | text | Razorpay customer ID |
| `current_period_start` | timestamptz | Current billing period start |
| `current_period_end` | timestamptz | Current billing period end |
| `cancelled_at` | timestamptz | When user cancelled |
| `trial_ends_at` | timestamptz | Trial end date |

---

### `user_credits`
Credit balance and transactions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Credit record ID |
| `user_id` | uuid (FK) | Credit owner |
| `credit_type` | text | subscription, bonus, purchased, trial, referral |
| `amount` | int | Credit amount |
| `remaining` | int | Credits not yet used |
| `source` | text | How credits were earned |
| `expires_at` | timestamptz | Expiry date (null = never) |
| `consumed_at` | timestamptz | When fully used |

---

### `credit_packs`
Purchasable credit packages.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | Pack ID |
| `name` | text | Display name |
| `credits` | int | Credits in pack |
| `price_inr` | int | Price in INR |
| `razorpay_plan_id` | text | For payment |
| `is_active` | boolean | Available for purchase |

---

### `weekly_plans`
Generated meal plans.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Plan ID |
| `user_id` | uuid (FK) | Owner |
| `week_start_date` | date | Week start |
| `plan_data` | jsonb | Full meal plan JSON |
| `grocery_list` | jsonb | Generated grocery list |
| `generated_at` | timestamptz | Creation time |

---

### `referral_codes`
User referral codes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Code record ID |
| `user_id` | uuid (FK) | Code owner |
| `code` | varchar | The referral code string |
| `uses_count` | int | Times code was used |
| `is_active` | boolean | Code is active |
| `created_at` | timestamptz | Creation time |

---

### `referrals`
Referral relationships and rewards.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Referral ID |
| `referrer_id` | uuid (FK) | Who shared the code |
| `referee_id` | uuid (FK) | Who used the code |
| `referral_code_id` | uuid (FK) | Code used |
| `status` | varchar | pending, active, converted |
| `referrer_credits_awarded` | int | Credits given to referrer |
| `referee_credits_awarded` | int | Credits given to referee |

---

### `subscription_events`
Payment and subscription event logs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Event ID |
| `user_id` | uuid (FK) | Related user |
| `subscription_id` | uuid (FK) | Related subscription |
| `event_type` | text | created, charged, cancelled, etc. |
| `event_data` | jsonb | Raw event payload |
| `razorpay_event_id` | text | Razorpay event ID |
| `created_at` | timestamptz | Event time |

---

## Row Level Security (RLS)

All tables have RLS enabled. General policies:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own data" ON table_name
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON table_name
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON table_name
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## Useful Queries

### Check user subscription status
```sql
SELECT us.*, sp.name as plan_name
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = 'user-uuid-here';
```

### Get user's total remaining credits
```sql
SELECT SUM(remaining) as total_credits
FROM user_credits
WHERE user_id = 'user-uuid-here'
  AND remaining > 0
  AND (expires_at IS NULL OR expires_at > NOW());
```

### Find referrals made by a user
```sql
SELECT r.*, up.display_name as referee_name
FROM referrals r
JOIN user_profiles up ON r.referee_id = up.id
WHERE r.referrer_id = 'user-uuid-here';
```
