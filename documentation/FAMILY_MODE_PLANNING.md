# Family/Partner Mode - Updated Implementation Plan

> **Updated:** January 18, 2026  
> **Status:** Approved - Ready for Implementation  
> **Branch:** `family-mode` (deploy to Vercel preview)

---

## Approved Decisions

| Decision | Resolution |
|----------|------------|
| Collaboration Model | Primary Owner + Linked Access |
| Invitation Method | Link sharing only (no email invites) |
| Real-time Sync | Yes - include in MVP (simple with Supabase Realtime) |
| Groups per User | One family group only |
| Subscription Cancellation | Menus become personal, tagged as "ex-family" in DB |
| Credits | Anyone can contribute to family pool |

---

## Credit System Options

When users with individual subscriptions join a family group, we need to handle their credits thoughtfully.

### Option A: Credit Pool Merge (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│  When Pro User Joins Family Group:                           │
├─────────────────────────────────────────────────────────────┤
│  1. User's existing credits MERGE into family pool          │
│  2. Their subscription CONTINUES (credits go to pool)       │
│  3. All family members consume from shared pool             │
│  4. On exit: User leaves with proportional share or zero    │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Simple mental model: "All credits go to family"
- Any member can contribute
- Encourages family upgrade
- Bonus or free credits cannot be brought into family credits, only the paid credits are merged
- When user exists, their free credits go back to them

**Cons:**
- Complex exit calculation
- User "loses" credits if they leave

---

### Option B: Dual Pool System

```
┌─────────────────────────────────────────────────────────────┐
│  When Pro User Joins Family Group:                           │
├─────────────────────────────────────────────────────────────┤
│  1. User KEEPS personal credits separate                     │
│  2. Family has a SHARED pool (from Family Add-on)           │
│  3. User chooses which pool to use per action               │
│  4. On exit: User takes personal credits, leaves family's   │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- Clean exit (keep what's yours)
- No complex calculations

**Cons:**
- Confusing UX ("which credits?")
- Less "family" feel

---

### Option C: Subscription Pause (For Joining Members)

```
┌─────────────────────────────────────────────────────────────┐
│  When Pro User Joins Family Group:                           │
├─────────────────────────────────────────────────────────────┤
│  1. User's individual subscription is PAUSED                │
│  2. Unused credits converted to family credits              │
│  3. User uses family plan features                          │
│  4. On exit: Subscription resumes from pause point          │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- No wasted money
- Clean transition both ways

**Cons:**
- Complex billing integration
- Razorpay pause/resume needed

---

### Recommendation: Option A (Credit Pool Merge)

With a simple rule: **When leaving, user gets 0 credits** (they contributed to family). 

This is fair because:
- They benefited from family's combined resources
- Avoids gaming (join, take credits, leave)
- Simple to implement

---

## Pricing Structure

### Current Plans Reference
| Plan | Price | Credits/Month |
|------|-------|---------------|
| Basic | ₹99 | 8 |
| Pro | ₹199 | 20 |
| BYOK | ₹59 | Unlimited* |

### Family Mode Pricing Options

#### Model 1: Add-On to Existing Plans

| Add-On | Price | Who Pays | Linked Users | Extra Credits |
|--------|-------|----------|--------------|---------------|
| Partner Mode | ₹79/month | Owner | +1 user | +5 bonus |
| Family Mode | ₹149/month | Owner | +4 users | +10 bonus |

*Any linked member can also purchase credit packs that go to family pool*

**Example Scenarios:**
- Pro (₹199) + Partner (₹79) = ₹278/month for 25 credits, 2 users
- Pro (₹199) + Family (₹149) = ₹348/month for 30 credits, 5 users
- Basic (₹99) + Partner (₹79) = ₹178/month for 13 credits, 2 users

---

#### Model 2: Standalone Family Plan

| Plan | Price | Credits | Users | Features |
|------|-------|---------|-------|----------|
| Family | ₹299/month | 30 | Up to 5 | All Pro features + sharing |
| Family+ | ₹449/month | 50 | Up to 8 | Pro features + priority support |

**First Month (50% Launch Discount):**
- Family: ₹149.50
- Family+: ₹224.50

---

#### Model 3: Hybrid (Both Options Available)

Offer BOTH:
1. **Upgrade Path:** Basic/Pro can add Partner/Family add-on
2. **Direct Path:** New users can subscribe directly to Family Plan

This gives flexibility and captures different user journeys.

---

### Pricing Recommendation

**Hybrid Model (Model 3)** with these specific prices:

| Option | Price | Credits | Users | Best For |
|--------|-------|---------|-------|----------|
| Partner Add-On | ₹79 | +5 | +1 | Couples already on Pro |
| Family Add-On | ₹149 | +10 | +4 | Families on any plan |
| Family Plan (new) | ₹299 | 30 | 5 | New family signups |

---

## Technical Implementation

### Real-Time Sync Complexity Assessment

**Verdict: LOW COMPLEXITY ✅**

Supabase Realtime requires:
1. Enable Realtime for tables in dashboard (one-time)
2. Add tables to `supabase_realtime` publication
3. Subscribe via JS client:

```typescript
supabase
  .channel('family-menu-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'weekly_plans', 
      filter: `family_group_id=eq.${groupId}` },
    (payload) => {
      // Update React state with new data
      setWeeklyPlan(payload.new);
    }
  )
  .subscribe();
```

**Estimated time:** 4-6 hours (including testing)

---

### Database Schema Changes

```sql
-- Family Groups
CREATE TABLE family_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  invite_code TEXT UNIQUE, -- For link-based invites
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family Members
CREATE TABLE family_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One group per user
);

-- Modify weekly_plans for family support
ALTER TABLE weekly_plans 
  ADD COLUMN family_group_id UUID REFERENCES family_groups(id),
  ADD COLUMN was_family_plan BOOLEAN DEFAULT FALSE; -- Tag for exited plans

-- Modify scheduled_meals
ALTER TABLE scheduled_meals
  ADD COLUMN family_group_id UUID REFERENCES family_groups(id),
  ADD COLUMN was_family_plan BOOLEAN DEFAULT FALSE;

-- Family credit pool
CREATE TABLE family_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  amount INTEGER DEFAULT 0,
  contributor_id UUID REFERENCES auth.users(id), -- Who added credits
  source TEXT, -- 'subscription', 'member_contribution', 'purchase'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### RLS Policies for Family Access

```sql
-- Family members can access shared plans
CREATE POLICY "Family access to weekly_plans" ON weekly_plans
  FOR ALL USING (
    auth.uid() = user_id 
    OR (family_group_id IS NOT NULL AND family_group_id IN (
      SELECT group_id FROM family_group_members 
      WHERE user_id = auth.uid()
    ))
  );

-- Same pattern for scheduled_meals, grocery_lists
```

---

## Subscription Cancellation Flow

When owner cancels or subscription expires:

```
1. Mark subscription as ended
2. For all weekly_plans with this family_group_id:
   - SET was_family_plan = TRUE
   - SET family_group_id = NULL (detach from group)
   - Keep user_id pointing to whoever created it
3. Do same for scheduled_meals
4. Disable family group (soft delete)
5. Members see their plans as "personal" going forward
```

---

## Deployment Strategy

### Branch & Preview Setup

1. Create `family-mode` branch from `main`
2. Implement feature on branch
3. Push to GitHub → Vercel auto-creates preview
4. Preview URL: `family-mode-<project>.vercel.app`
5. Test in isolation before merging

### Database Considerations

- Supabase changes are shared (no branch isolation)
- Use feature flags to hide UI from production users
- Or: Create branch database (Supabase branching feature)

---

## Implementation Phases

| Phase | Scope | Duration |
|-------|-------|----------|
| 1 | DB schema, RLS policies, basic backend | 1 week |
| 2 | Invite link flow, member management UI | 1 week |
| 3 | Real-time sync, shared editing | 3-4 days |
| 4 | Credit pooling, contribution tracking | 3-4 days |
| 5 | Testing on Vercel preview | 2-3 days |

**Total Estimated:** 3-4 weeks

---

## Open Questions (Resolved)

| Question | Answer |
|----------|--------|
| Multiple groups? | No - one group per user |
| Personal menus alongside family? | No - focus on family first |
| Owner cancel? | Menus become personal + tagged |
| Invite method? | Link only |
| Real-time in MVP? | Yes |
