# Referral System Guide

> **Last Updated:** January 2026  
> **Maintainer:** QookCommander Team

---

## Overview

The referral system rewards users for inviting friends to QookCommander.

| Party | Reward |
|-------|--------|
| **Referrer** (who shares) | +2 credits when referee signs up |
| **Referee** (who joins) | +2 credits on signup |

---

## User Flow

### Sharing a Referral Link
1. User opens Settings → "Refer a Friend" section
2. Clicks "Share via WhatsApp" or "Copy Link"
3. Link format: `https://qook.in?ref=USERCODE`

### Using a Referral Link
1. New user clicks referral link
2. `ref` parameter captured, stored in localStorage
3. User signs up with Google
4. During onboarding, referral code is detected
5. Credits awarded to both parties

---

## Technical Implementation

### Key Files
| File | Purpose |
|------|---------|
| `services/referralService.ts` | Core referral logic |
| `components/ReferralShareCard.tsx` | Share UI component |
| `components/LandingPage.tsx` | Captures URL parameter |
| `components/NameLocationStep.tsx` | Shows referral code input |

### Referral Code Capture (LandingPage.tsx)
```typescript
// On landing page load
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');
if (refCode) {
  localStorage.setItem('pendingReferralCode', refCode);
}
```

### Applying Referral (referralService.ts)
```typescript
export async function applyReferralCode(userId: string, code: string) {
  // 1. Validate code exists and is active
  // 2. Check user hasn't already used a referral
  // 3. Check anti-fraud (onboarding_completed must be false)
  // 4. Create referral record
  // 5. Award credits to both parties
}
```

---

## Database Tables

### `referral_codes`
Each user gets a unique code on signup.

| Column | Description |
|--------|-------------|
| `code` | 6-character alphanumeric code |
| `uses_count` | Times code was used |
| `is_active` | Code can still be used |

### `referrals`
Tracks referral relationships.

| Column | Description |
|--------|-------------|
| `referrer_id` | User who shared |
| `referee_id` | User who joined |
| `status` | pending → active → converted |
| `referrer_credits_awarded` | Credits given to referrer |
| `referee_credits_awarded` | Credits given to referee |

---

## Anti-Fraud Measures

### 1. One Referral Per User
- `referee_id` is unique in `referrals` table
- Users can only be referred once

### 2. Onboarding Check
- Referral only applies if `onboarding_completed = false`
- Prevents users from gaming the system

### 3. Self-Referral Prevention
- Cannot use own referral code
- Checked in `applyReferralCode()`

### 4. Code Validation
- Code must exist and be active
- Invalid codes rejected silently

---

## Credit Rewards

### When Credits Are Awarded
- Both parties receive credits immediately upon successful referral
- Credits are type `referral` and never expire

### Credit Record
```sql
INSERT INTO user_credits (user_id, credit_type, amount, remaining, source, expires_at)
VALUES (?, 'referral', 2, 2, 'Referral reward', NULL);
```

---

## Referral Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Referee signed up but not onboarded |
| `active` | Referee completed onboarding |
| `converted` | Referee made a purchase (future use) |

---

## Share Message Templates

### WhatsApp Message
```
Hey! Try QookCommander for AI meal planning. Use my code {CODE} for free credits! 
https://qook.in?ref={CODE}
```

### Copy Link
Copies: `https://qook.in?ref={CODE}`

---

## Troubleshooting

### Referral Not Applied
1. Check if user already has a referral record
2. Verify `onboarding_completed` was false
3. Confirm code exists in `referral_codes`

### Credits Not Appearing
1. Check `user_credits` table for referral type
2. Verify both parties have credit records
3. Check for database errors in logs

### Code Not Captured
1. Verify localStorage has `pendingReferralCode`
2. Check if LandingPage.tsx captured the param
3. Ensure page wasn't cached
