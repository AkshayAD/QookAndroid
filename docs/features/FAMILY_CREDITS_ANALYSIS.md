# Family Mode & Credit System - Deep Analysis v2

> **Analysis Workflow**: `/analyze` with iterative improvements
> **Created**: 2026-01-19
> **Status**: Comprehensive multi-iteration analysis

---

# ITERATION 1: CORE STRUCTURE ANALYSIS

## 1.1 User Requirements Summary

Based on user feedback:
1. **Tier Names**: Free, Standard, Pro, Family Pro, BYOK (5 tiers, single family option)
2. **Credit Isolation**: Pro members joining family keep personal credits separate
3. **Feature Parity**: Pro = Family Pro features, except family mode enabled on Family Pro
4. **Profiles by Tier**: Different profile limits per tier
5. **Base Pricing**: Show regular prices, not discounted
6. **Anti-Abuse**: Device fingerprinting + Trust actions (NO payment verification)
7. **Marketing**: "Free trial, no credit card required"
8. **Simplicity**: Keep offering simple and clear

## 1.2 Current Database State (Actual Base Pricing)

| ID | Name | First Month | Regular Price | Monthly Credits | Weekly Bonus | Profiles |
|----|------|-------------|---------------|-----------------|--------------|----------|
| free | Launch Offer | ₹0 | ₹99 | 0 | +1 | 2 |
| basic | Basic | ₹49 | ₹99 | 8 | +1 | 5 |
| pro | Pro | ₹99 | ₹199 | 20 | +2 | 999 |
| byok | BYOK Only | ₹29 | ₹59 | -1 (∞) | +1 | 2 |

## 1.3 Issues Identified

| Issue | Description | Impact | Resolution |
|-------|-------------|--------|------------|
| 🔴 **No Family tier in DB** | Family Pro doesn't exist yet | Critical | Add new plan |
| 🔴 **"Basic" vs "Standard"** | User wants "Standard", DB has "Basic" | Naming | Rename |
| 🟠 **Free tier confusion** | Named "Launch Offer" but is free trial | Medium | Rename to "Free" |
| 🟠 **Profile limits unclear** | 999 for Pro seems arbitrary | Medium | Define properly |

---

# ITERATION 2: REFINED TIER STRUCTURE

## 2.1 Proposed Tier Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          QOOK COMMANDER                               │
│                     "Free trial. No credit card."                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐     │
│   │   FREE    │   │ STANDARD  │   │    PRO    │   │   BYOK    │     │
│   │    ₹0     │   │  ₹99/mo   │   │  ₹199/mo  │   │  ₹59/mo   │     │
│   │  8 trial  │   │ 12 creds  │   │ 25 creds  │   │    ∞      │     │
│   │ 2 profiles│   │ 4 profiles│   │ 8 profiles│   │ 2 profiles│     │
│   └───────────┘   └───────────┘   └─────┬─────┘   └───────────┘     │
│                                         │                            │
│                                         ▼                            │
│                                  ┌─────────────┐                     │
│                                  │ FAMILY PRO  │                     │
│                                  │  ₹299/mo    │                     │
│                                  │ 40 shared   │                     │
│                                  │ 5 members   │                     │
│                                  │ 8 prof/each │                     │
│                                  └─────────────┘                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## 2.2 Complete Tier Table (Base Pricing)

| Feature | Free | Standard | Pro | Family Pro | BYOK |
|---------|------|----------|-----|------------|------|
| **Base Price** | ₹0 | ₹99/mo | ₹199/mo | ₹299/mo | ₹59/mo |
| **Credits** | 8 trial | 12 | 25 | 40 pooled | ∞ |
| **Weekly Bonus** | +1 | +1 | +2 | +4 | +1 |
| **Profiles** | 2 | 4 | 8 | 8 per member | 2 |
| **Family Members** | 1 | 1 | 1 | 5 | 1 |
| **History Days** | 7 | 30 | 90 | 90 | 30 |
| **Buy Credit Packs** | ❌ | ✅ | ✅ | ✅ | ❌ |

---

# ITERATION 3: FEATURE ACCESS MATRIX

## 3.1 Core Features by Tier

| Feature | Free | Standard | Pro | Family Pro | Notes |
|---------|------|----------|-----|------------|-------|
| **Meal Generation** | ✅ (trial) | ✅ | ✅ | ✅ | Core feature |
| **Weekly Planner View** | ✅ | ✅ | ✅ | ✅ | Core feature |
| **Schedule & History** | 7 days | 30 days | 90 days | 90 days | Tier-limited |
| **Single Meal Regen** | ❌ | ✅ | ✅ | ✅ | Standard+ |
| **Smart Edit (AI tweak)** | ❌ | ✅ | ✅ | ✅ | Standard+ |
| **Multiple Profiles** | 2 | 4 | 8 | 8/member | Tier-limited |
| **Recipe Panel (YouTube)** | Basic | Full | Full | Full | Free = thumbnail only |
| **Grocery List Generation** | ❌ | ✅ | ✅ | ✅ | Standard+ |
| **Ingredient Add to Grocery** | ❌ | ❌ | ✅ | ✅ | Pro+ |
| **Nutrition Info** | ❌ | ❌ | ✅ | ✅ | Pro+ |
| **Export (PDF/Share)** | ❌ | ❌ | ✅ | ✅ | Pro+ |
| **Priority Support** | ❌ | ❌ | ✅ | ✅ | Pro+ |
| **Family Mode** | ❌ | ❌ | ❌ | ✅ | Family Pro only |
| **Shared Grocery List** | ❌ | ❌ | ❌ | ✅ | Family Pro only |
| **Family Activity Log** | ❌ | ❌ | ❌ | ✅ | Family Pro only |

## 3.2 Feature Grouping Summary

| Group | Features | Available From |
|-------|----------|----------------|
| **Basic** | Meal gen, planner, 7-day history | Free |
| **Standard** | Single regen, smart edit, grocery gen, full recipe | Standard |
| **Pro** | Nutrition, ingredient grocery, export, priority support | Pro |
| **Family** | Family mode, shared lists, activity log | Family Pro |

## 3.3 Issues Identified

| Issue | Analysis | Fix |
|-------|----------|-----|
| 🟠 **Recipe panel "Basic" unclear** | What does Free see? | Free sees thumbnail + YouTube link, no ingredient list |
| 🟠 **Grocery split confusing** | Generation vs Add ingredients | Keep both, different value props |
| ✅ **Pro = Family Pro features** | Same features, just family enabled | Confirmed aligned |

---

# ITERATION 4: CREDIT SYSTEM FOR FAMILY MODE

## 4.1 Credit Isolation Model (User Requirement)

```
┌───────────────────────────────────────────────────────────────────┐
│  PRO USER JOINS FAMILY PRO                                         │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  BEFORE: User has Pro (₹199/mo)                                    │
│  ┌────────────────────────────────────────┐                        │
│  │ Personal Credits: 25/mo               │                        │
│  │ Weekly Bonus: +2                      │                        │
│  │ Profiles: 8                           │                        │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  AFTER: User joins Family (but keeps Pro subscription active)      │
│  ┌────────────────────────────────────────┐                        │
│  │ PERSONAL MODE:                        │                        │
│  │   Credits: 25/mo (own Pro credits)    │                        │
│  │   For: Personal generations           │                        │
│  ├────────────────────────────────────────┤                        │
│  │ FAMILY MODE:                          │                        │
│  │   Credits: Uses OWNER's pool only     │                        │
│  │   For: Family generations             │                        │
│  │   Own credits: NOT USED               │                        │
│  └────────────────────────────────────────┘                        │
│                                                                    │
│  KEY: Credits stay separate. Toggle determines which to use.       │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

## 4.2 Family Credit Pool Rules

| Rule | Description |
|------|-------------|
| **1. Owner's credits only** | Family pool = Owner's subscription credits ONLY |
| **2. No trial/bonus in pool** | Only regular subscription credits count |
| **3. Members don't contribute** | Members' personal credits stay personal |
| **4. Toggle determines source** | Personal mode = own credits, Family mode = owner's pool |
| **5. Purchased credits portable** | Can use purchased credits in either mode |

## 4.3 Scenarios

| Scenario | Personal Credits | Family Pool |
|----------|-----------------|-------------|
| Owner (Family Pro) | N/A | 40/mo |
| Pro member joins | 25/mo (own) | Uses owner's 40 |
| Standard member joins | 12/mo (own) | Uses owner's 40 |
| Free member joins | 0 (exhausted trial) | Uses owner's 40 |

## 4.4 Issues Identified

| Issue | Analysis | Fix |
|-------|----------|-----|
| 🔴 **What if owner runs out?** | Family blocked mid-month | Allow purchased credits to supplement |
| 🟠 **Owner can be any tier?** | Should owner need Pro first? | Owner must subscribe to Family Pro directly |
| 🟠 **Bonus credits excluded** | Too restrictive? | Keep excluded to prevent abuse |

---

# ITERATION 5: ANTI-ABUSE SYSTEM (No OTP, No Payment)

## 5.1 Strategy: Device Fingerprinting + Trust Actions

**Marketing Message**: "Free trial. No credit card required."

**Anti-Abuse Layers**:
1. ✅ Device Fingerprinting (FingerprintJS)
2. ✅ Progressive Trust Actions
3. ✅ Phone Number Claim (no OTP)
4. ✅ Disposable Email Blocking
5. ✅ IP Rate Limiting
6. ❌ Payment Verification (REMOVED per user request)

## 5.2 Progressive Trust System - Detailed Design

### Initial Credits: Start with 2

| Action | Credits Earned | Total | When Shown |
|--------|----------------|-------|------------|
| **Signup** | 2 | 2 | Immediate |
| **Complete profile** | +1 | 3 | Onboarding nudge |
| **Add phone number** | +2 | 5 | Settings prompt |
| **Return after 24 hours** | +1 | 6 | Welcome back modal |
| **First MANUAL meal save** | +1 | 7 | Toast notification |
| **Install as PWA** | +1 | 8 | Settings prompt |
| **TOTAL** | **8** | **8** | - |

### Key Rules:
- ❌ No email verification (already done via OAuth)
- ❌ Auto-generated meal plan doesn't count
- ✅ Only manually edited/saved plan counts

## 5.3 Trust Action UX - When to Prompt

### Option A: Trust Progress Bar in Dashboard

```
┌────────────────────────────────────────────────────────────────┐
│  🎁 UNLOCK MORE FREE CREDITS                        3/8 ████░░░░  │
│  Complete these steps to get 5 more credits:                    │
│                                                                  │
│  ✅ Create account            +2 credits                        │
│  ✅ Complete profile          +1 credit                         │
│  ☐ Add phone number          +2 credits  [Add Now]             │
│  ☐ Return tomorrow           +1 credit                         │
│  ☐ Save your first meal plan +1 credit                         │
│  ☐ Install app               +1 credit   [Install]             │
│                                                                  │
│                              [Dismiss]                          │
└────────────────────────────────────────────────────────────────┘
```

**Location**: Collapsible card below Weekly Planner header
**Trigger**: Shows for Free tier users only
**Dismissible**: Yes, but returns after 24h if incomplete

### Option B: Settings Page Section

```
┌────────────────────────────────────────────────────────────────┐
│  ACCOUNT                                                        │
├────────────────────────────────────────────────────────────────┤
│  📧 Email               akshay@example.com          Connected  │
│  📱 Phone               Not added                   [Add]      │
│  📲 App Installed       No                          [Install]  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  🎁 FREE CREDITS EARNED                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ✅ Signup bonus       +2                                    │ │
│  │ ✅ Profile complete   +1                                    │ │
│  │ ☐ Phone added        +2 (unlock now!)                      │ │
│  │ ☐ Return visit       +1                                     │ │
│  │ ☐ First save         +1                                     │ │
│  │ ☐ PWA install        +1                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### Option C: Onboarding Flow Integration (RECOMMENDED)

**Strategy**: Integrate trust actions INTO the natural onboarding flow

1. **Signup** → Get 2 credits, explained immediately
2. **Profile wizard** → "Complete to unlock +1 credit" 
3. **After first plan auto-generated** → "Add phone for +2 more credits" modal
4. **Next day visit** → "Welcome back! +1 credit earned" toast
5. **After manual edit** → "+1 credit for saving your first plan" toast
6. **In settings** → "Install app for +1 more credit" banner

**Why C is best**:
- Doesn't clutter dashboard
- Feels like rewards, not tasks
- Natural discovery
- Less overwhelming

## 5.4 Device Fingerprinting Implementation

```typescript
// Using FingerprintJS (free tier: 100k/mo API calls)
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// On signup/login
const fp = await FingerprintJS.load();
const result = await fp.get();
const visitorId = result.visitorId;

// Store with user
await supabase.from('user_devices').upsert({
  user_id: userId,
  device_id: visitorId,
  first_seen: new Date(),
  last_seen: new Date()
});

// Check for abuse
const { data: existingDevice } = await supabase
  .from('user_devices')
  .select('user_id, trial_used')
  .eq('device_id', visitorId)
  .single();

if (existingDevice?.trial_used && existingDevice.user_id !== userId) {
  // Same device, different user - FLAG
  // Give 0 trial credits, can still use paid features
}
```

## 5.5 Issues Identified

| Issue | Analysis | Fix |
|-------|----------|-----|
| 🟠 **PWA install detection** | Hard to detect reliably | Use `beforeinstallprompt` event |
| 🟠 **"Return after 24h" gaming** | User could logout/login | Track by device, not just user |
| 🟠 **Phone without OTP** | Could use fake numbers | Hash + store, block duplicates |
| ✅ **No credit card required** | Aligns with marketing | ✅ Confirmed |

---

# ITERATION 6: JOIN/LEAVE FAMILY FLOWS

## 6.1 Refined Join Flow (Credits Stay Separate)

```
User has Pro subscription
        │
        ▼
  [JOIN FAMILY] clicked
        │
        ▼
┌─────────────────────────────────────────┐
│  JOIN FAMILY                             │
│                                          │
│  You're joining: "The Sharma Family"     │
│  Owner: Priya Sharma                     │
│                                          │
│  What happens:                           │
│  ✓ Access shared family meal plan        │
│  ✓ Your Pro subscription stays active    │
│  ✓ Your personal credits stay personal   │
│                                          │
│  In Family Mode, you'll use the          │
│  family's shared credit pool.            │
│                                          │
│  [Cancel]  [Join Family]                 │
└─────────────────────────────────────────┘
        │
        ▼
  System: Add to family_group_members
  System: No subscription changes
  System: Credits remain separate
```

## 6.2 Toggle Mode Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│  PERSONAL MODE                          FAMILY MODE              │
│  ┌───────────────────┐                  ┌───────────────────┐   │
│  │ Using: YOUR credits │    ◄───►      │ Using: FAMILY pool │   │
│  │ 18/25 remaining    │                │ 32/40 remaining    │   │
│  │ Your profiles      │                │ Shared profiles    │   │
│  │ Your meal plan     │                │ Family meal plan   │   │
│  └───────────────────┘                  └───────────────────┘   │
│                                                                  │
│  Toggle: [Personal ○━━━━━● Family]                              │
│                                                                  │
│  When generating in each mode:                                   │
│  - Personal: Deduct from your user_credits                      │
│  - Family: Deduct from family_credit_pool                        │
└─────────────────────────────────────────────────────────────────┘
```

## 6.3 Leave Family Flow

```
User clicks "Leave Family"
        │
        ▼
┌─────────────────────────────────────────┐
│  LEAVE FAMILY?                           │
│                                          │
│  You'll be removed from:                 │
│  "The Sharma Family"                     │
│                                          │
│  What happens:                           │
│  ✓ Your Pro subscription continues       │
│  ✓ Your personal credits intact          │
│  ✓ Switch to personal mode only          │
│  ✗ Lose access to family plan/grocery    │
│                                          │
│  [Stay]  [Leave Family]                  │
└─────────────────────────────────────────┘
```

---

# ITERATION 7: IMPLEMENTATION SIMPLICITY CHECK

## 7.1 Complexity Audit

| Component | Complexity | Can Simplify? |
|-----------|------------|---------------|
| 5 tiers | Medium | No - user requirement |
| Credit isolation | Low | Already simple |
| Device fingerprinting | Low | Single library |
| Trust actions | Medium | UI work, but clear rules |
| Feature gating | Medium | Need clear matrix |
| Family toggle | Low | Already exists |

## 7.2 Quick Wins (Already Implemented or Easy)

| Feature | Status | Effort |
|---------|--------|--------|
| Recipe Panel enhanced | ✅ Done | - |
| Ingredient Add to Grocery | ✅ Done | - |
| Nutrition Pills | ✅ Done | - |
| Family mode toggle | ✅ Done | - |
| Family activity log | ✅ Done | - |
| Shared grocery list | ✅ Done | - |

## 7.3 Needs Implementation

| Feature | Priority | Effort |
|---------|----------|--------|
| Trust action system | High | Medium (2-3 days) |
| Device fingerprinting | High | Low (1 day) |
| Family Pro subscription tier | High | Low (1 day) |
| Tier rename (Basic → Standard) | Medium | Low (1 hour) |
| Feature gating by tier | High | Medium (2 days) |
| Profile limits enforcement | Medium | Low (1 day) |

---

# ITERATION 8: FINAL RECOMMENDATIONS

## 8.1 Tier Structure (Final)

| Tier | Base Price | Credits | Weekly Bonus | Profiles | History | Family |
|------|------------|---------|--------------|----------|---------|--------|
| **Free** | ₹0 | 2→8 (trust) | +1 | 2 | 7 days | ❌ |
| **Standard** | ₹99/mo | 12 | +1 | 4 | 30 days | ❌ |
| **Pro** | ₹199/mo | 25 | +2 | 8 | 90 days | ❌ |
| **Family Pro** | ₹299/mo | 40 pooled | +4 | 8/member | 90 days | ✅ |
| **BYOK** | ₹59/mo | ∞ | +1 | 2 | 30 days | ❌ |

## 8.2 Feature Matrix (Final)

| Feature | Free | Standard | Pro | Family Pro |
|---------|------|----------|-----|------------|
| Meal generation | ✅ | ✅ | ✅ | ✅ |
| Single meal regen | ❌ | ✅ | ✅ | ✅ |
| Smart edit | ❌ | ✅ | ✅ | ✅ |
| Grocery list gen | ❌ | ✅ | ✅ | ✅ |
| Full recipe panel | ❌ | ✅ | ✅ | ✅ |
| Nutrition info | ❌ | ❌ | ✅ | ✅ |
| Ingredient add | ❌ | ❌ | ✅ | ✅ |
| Export/Share | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ |
| Family mode | ❌ | ❌ | ❌ | ✅ |

## 8.3 Trust Actions (Final)

| Action | Credits | Prompt Location |
|--------|---------|-----------------|
| Signup | +2 | Immediate |
| Complete profile | +1 | Onboarding wizard |
| Add phone | +2 | Post-first-gen modal |
| Return 24h | +1 | Welcome back toast |
| First manual save | +1 | Save confirmation toast |
| Install PWA | +1 | Settings banner |

## 8.4 Anti-Abuse Stack (Final)

1. ✅ Device fingerprinting (block same device second trial)
2. ✅ Phone number hash (block duplicate phones)
3. ✅ Progressive trust (start with 2, earn to 8)
4. ✅ Disposable email blocking
5. ✅ IP rate limiting (max 3 signups/IP/24h)
6. ❌ No payment verification
7. ❌ No email OTP

## 8.5 Family Credit Rules (Final)

1. Owner subscribes to Family Pro (₹299/mo)
2. Owner gets 40 pooled credits/month
3. Members use owner's pool in family mode
4. Members keep personal credits for personal mode
5. Toggle determines credit source
6. Purchased credits work in both modes

---

# IMPLEMENTATION CHECKLIST

## Phase 1: Database & Backend
- [ ] Rename "Basic" → "Standard"
- [ ] Rename "Launch Offer" → "Free"
- [ ] Add "family_pro" plan to subscription_plans
- [ ] Create user_devices table for fingerprinting
- [ ] Create user_trust_actions table
- [ ] Update profile limits per tier

## Phase 2: Anti-Abuse
- [ ] Integrate FingerprintJS
- [ ] Implement trust action tracking
- [ ] Create phone number hash storage
- [ ] Add disposable email blocklist
- [ ] Implement IP rate limiting

## Phase 3: Trust Action UX
- [ ] Add trust progress to onboarding
- [ ] Add phone prompt modal
- [ ] Add "welcome back" credit toast
- [ ] Add "first save" credit toast
- [ ] Add PWA install prompt
- [ ] Add settings trust section

## Phase 4: Feature Gating
- [ ] Gate single regen (Standard+)
- [ ] Gate smart edit (Standard+)
- [ ] Gate grocery gen (Standard+)
- [ ] Gate nutrition (Pro+)
- [ ] Gate ingredient add (Pro+)
- [ ] Gate export (Pro+)
- [ ] Gate family mode (Family Pro)

## Phase 5: Pricing Page
- [ ] Update tiers to new names
- [ ] Show base pricing
- [ ] Highlight "Free trial, no credit card"
