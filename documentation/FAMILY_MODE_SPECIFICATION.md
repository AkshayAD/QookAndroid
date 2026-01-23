# Family Mode Complete Specification

*This document contains 5 iterative versions with critical analysis after each, building to a comprehensive final specification.*

---

# VERSION 1 - Initial Plan

## 1. Overview

Family Mode allows multiple users to share a meal plan. One user creates/owns the family group, others join as members. All family members see and can edit the same meal plan.

---

## 2. User Roles

### Owner
- Creates the family group
- Can invite members (share code)
- Can delete the family group
- Can generate, edit, swap, delete meals
- Has full control

### Member
- Joins via invite code
- Can view all family meals
- Can edit, swap, delete meals
- Cannot manage membership or delete group

---

## 3. UI Elements Affected

### 3.1 Header/Navigation
| Element | Personal Mode | Family Mode |
|---------|--------------|-------------|
| Mode Badge | Gray "Personal" | Purple "Family" + group name |
| Profile Avatar | User initial | User initial (unchanged) |
| Credits Display | Personal credits | Personal credits (unchanged) |

### 3.2 Weekly Planner Tab
| Element | Personal Mode | Family Mode |
|---------|--------------|-------------|
| Generate Button | Uses personal credits | Uses personal credits |
| Meal Cards | Shows personal meals | Shows family meals |
| Edit Text | Saves to personal | Saves to family |
| Swap Button | Opens personal alternatives | Opens family alternatives |
| Day Headers | Plain text | Badge "Family" or Users icon |

### 3.3 Calendar/Schedule Tab
| Element | Personal Mode | Family Mode |
|---------|--------------|-------------|
| Date Dots | Orange for meals | Purple for family meals |
| Click Date | Shows personal meals | Shows family meals |
| Inline Edit | Saves to personal | Saves to family |

### 3.4 Grocery List Tab
| Element | Personal Mode | Family Mode |
|---------|--------------|-------------|
| List Source | From personal meals | From family meals |
| Regenerate | From personal plan | From family plan |

---

## 4. User Actions & Effects

### 4.1 Generate Plan
| Step | Effect on Owner | Effect on Member |
|------|-----------------|------------------|
| Click Generate | Plan generates | N/A (owner's action) |
| Plan appears | Sees new plan | Real-time: sees new plan |
| Credits deducted | From owner's credits | No change to member |

### 4.2 Edit Meal (Change Text)
| Step | Effect on Owner | Effect on Member |
|------|-----------------|------------------|
| Type new text | UI updates | N/A |
| Blur field | Saves to DB | Real-time: sees update |

### 4.3 Swap Meal (Select Alternative)
| Step | Effect on Owner | Effect on Member |
|------|-----------------|------------------|
| Click swap | Opens alternatives | N/A |
| Select one | Meal changes | Real-time: sees update |

### 4.4 Delete Meal (Clear Text)
| Step | Effect on Owner | Effect on Member |
|------|-----------------|------------------|
| Clear text | Meal becomes empty | Real-time: sees empty |

---

## 5. Calendar Icons

### Personal Mode:
- No meals: Empty circle
- Has meals: Orange filled dot

### Family Mode:
- No meals: Empty circle  
- Has family meals: Purple filled dot

### Both Modes Available:
- N/A (user is either in Personal OR Family mode, not both simultaneously)

---

## 6. Data Isolation

### Personal Data:
- `family_group_id = NULL`
- Only visible when in Personal Mode
- Not affected by Family Mode changes

### Family Data:
- `family_group_id = {uuid}`
- Visible to all family members
- Editable by all family members

---

## 7. Real-Time Sync

### What Syncs:
- scheduled_meals changes
- weekly_plans changes (during active generation)

### What Doesn't Sync:
- Grocery list (regenerated manually)
- User preferences (personal)
- Credits (personal)

---

## 8. Mode Switching

### Personal → Family:
1. Clear current weeklyPlan state
2. Clear grocery list
3. Load schedule for family_group_id
4. Build weeklyPlan from family schedule

### Family → Personal:
1. Clear current weeklyPlan state
2. Clear grocery list
3. Load schedule for family_group_id = NULL
4. Build weeklyPlan from personal schedule

---

# CRITICAL ANALYSIS 1

## Flaws Identified:

### FLAW 1.1: Credits Usage Ambiguity
- Who pays when member generates?
- Current plan says "personal credits" but whose?
- **Fix**: Clarify - member uses THEIR OWN credits

### FLAW 1.2: Alternatives Source Not Specified
- Where are alternatives stored for family?
- How are they generated?
- **Fix**: Define alternatives storage location

### FLAW 1.3: No Conflict Handling
- Two people edit same meal simultaneously
- What happens?
- **Fix**: Define conflict resolution (last write wins + toast)

### FLAW 1.4: Grocery List Scope Unclear
- Is grocery shared or per-user in family mode?
- **Fix**: Define - shared list, all members see same

### FLAW 1.5: No Visual Distinction for Edits By Others
- Can't tell who made a change
- **Fix**: Add "last modified by" indicator (future)

### FLAW 1.6: Missing Prep Ahead Handling
- prepAhead field not mentioned
- **Fix**: Add to edit/sync specification

### FLAW 1.7: No Error States
- What if save fails?
- What if sync disconnects?
- **Fix**: Add error handling section

### FLAW 1.8: Transfer/Copy Meals Between Modes
- Can user copy meal from personal to family?
- **Fix**: Define transfer behavior

### FLAW 1.9: Notification Preferences
- Does member get notified of changes?
- **Fix**: Define notification behavior

### FLAW 1.10: Empty State UX
- What shows when family has no plan?
- **Fix**: Define empty state

---

# VERSION 2 - Improved Plan

## Additions from Analysis 1:

### 2.1 Credits Clarification
- **Rule**: Each user uses their OWN credits
- Owner generates → Owner's credits deducted
- Member generates → Member's credits deducted
- Family group does NOT share credits

### 2.2 Alternatives Storage
- Stored in `scheduled_meals.alternatives` (JSON column)
- Per-day, not per-week
- Shared across family (all see same alternatives)

### 2.3 Conflict Resolution
- **Rule**: Last write wins
- On save, overwrite previous value
- Other users see update via real-time sync
- No merge or conflict dialog
- Toast notification: "Menu updated" when sync occurs

### 2.4 Grocery List Scope
- In Family Mode: Grocery list is SHARED
- All family members see same list
- Generated from family meal plan
- Regenerate affects all members

### 2.5 Prep Ahead Handling
- `prepAhead` field syncs with other fields
- Edited same way as meals
- Visible to all family members

### 2.6 Error States
| Error | UI Behavior | Recovery |
|-------|-------------|----------|
| Save fails | Toast "Failed to save" + red border | Retry on blur again |
| Sync disconnects | Silent reconnect attempt | Auto-refetch on reconnect |
| Load fails | Toast "Failed to load" | Retry button |

### 2.7 Transfer Between Modes
- **Copy**: Meal from Personal → Family (or vice versa)
- Uses existing transfer modal
- `targetFamilyGroupId` param determines destination
- Source meal unchanged (copy, not move by default)

### 2.8 Notification Behavior
- Real-time UI updates (no push notifications)
- Toast "Menu updated by [name]" when sync fires
- No email/SMS notifications (out of scope)

### 2.9 Empty State UX
- When Family has no meals:
  - Show empty meal cards with placeholder text
  - "Generate your first family meal plan" CTA
  - No stale data from Personal mode shown

---

# CRITICAL ANALYSIS 2

## Flaws Identified:

### FLAW 2.1: Member Generate Creates Whose Plan?
- If member generates, is it the FAMILY plan?
- Yes - member's generation goes to family schedule
- **Already correct, just needs emphasis**

### FLAW 2.2: Alternatives Per-Day vs Per-Week Inconsistency
- Weekly Planner shows alternatives as week-level
- But storage is per-day
- **Fix**: Clarify alternatives UI shows all from current week

### FLAW 2.3: Real-Time "Updated by [name]" Needs Data
- `last_modified_by` column exists but UI doesn't show
- **Fix**: Add to toast message from payload

### FLAW 2.4: Swap Modal Source
- Does swap modal show alternatives from memory or DB?
- **Fix**: Load from schedule on open

### FLAW 2.5: Regenerate Alternatives
- Does this work in family mode?
- Uses whose credits?
- **Fix**: Uses caller's credits, saves to family

### FLAW 2.6: Manual Planning Mode
- User can plan manually without AI
- How does this interact with family mode?
- **Fix**: Same rules - saves to family schedule

### FLAW 2.7: Week Navigation
- When viewing past/future weeks
- Does sync still work for all weeks?
- **Fix**: Sync applies to ALL weeks, not just current

### FLAW 2.8: Meal Ideas Feature
- Meal ideas sidebar
- Is it personal or family scoped?
- **Fix**: Personal (not family-scoped)

### FLAW 2.9: History/Audit Trail
- No way to see who changed what when
- **Fix**: Out of scope for MVP, note for future

### FLAW 2.10: Invite Code Expiry
- Does invite code expire?
- **Fix**: Document - codes don't expire currently

---

# VERSION 3 - Improved Plan

## Additions from Analysis 2:

### 3.1 Member Generation Clarification
- ANY family member can generate a plan
- Plan goes to FAMILY schedule (family_group_id set)
- Credits deducted from the user who clicked Generate
- All other members see new plan via sync

### 3.2 Alternatives UI Clarification
- Alternatives sidebar shows alternatives for current week
- Aggregated from all 7 days' `alternatives` fields
- Or generated fresh on "Regenerate Alternatives"

### 3.3 Last Modified By Display
- On sync event, show toast: "Menu updated by [email]"
- Email comes from `last_modified_by` → lookup user
- Future: Show avatar/name in meal card footer

### 3.4 Swap Modal Behavior
- On open: Load alternatives from schedule for that day
- If none exist: Show "Regenerate" button
- On select: Save to scheduled_meals immediately

### 3.5 Regenerate Alternatives (Family)
- Uses caller's credits
- Saves new alternatives to family schedule
- All members see updated alternatives

### 3.6 Manual Planning Mode
- Works same as AI generation
- All edits save to family schedule
- Real-time sync applies

### 3.7 Week Navigation Sync
- Real-time sync applies to ALL weeks
- Subscription filter is on `family_group_id`, not date
- Any change to family data triggers refresh

### 3.8 Meal Ideas Feature
- Meal Ideas are PERSONAL feature
- Not shared with family
- Selecting a meal idea saves to CURRENT mode (personal or family)

### 3.9 Audit Trail (Future)
- Out of scope for MVP
- Future: Add `meal_changes` table with history

### 3.10 Invite Code Behavior
- Codes do not expire
- Owner can regenerate code (invalidates old one)
- Future: Add expiry option

---

# CRITICAL ANALYSIS 3

## Flaws Identified:

### FLAW 3.1: Performance on Full Refetch
- Sync handler refetches entire schedule
- Could be slow for months of data
- **Fix**: Refetch only current view week + month range

### FLAW 3.2: Debounce on Edits
- Multiple rapid edits → multiple saves
- **Fix**: Debounce save by 500ms

### FLAW 3.3: Optimistic Update Rollback
- If save fails, should revert UI
- Current code doesn't store original
- **Fix**: Store original before edit, revert on error

### FLAW 3.4: Date Calculation Edge Cases
- What if user edits while viewing past week?
- dayIndex + planStartDate must be correct
- **Fix**: Already handled via planStartDate state

### FLAW 3.5: Multiple Browser Tabs
- User has 2 tabs open
- Edit in tab 1 → tab 2 doesn't update
- **Fix**: Real-time subscription handles this already

### FLAW 3.6: Mobile Responsiveness
- Family badge size on mobile
- Calendar dots visibility on small screens
- **Fix**: Existing responsive classes, review needed

### FLAW 3.7: Accessibility
- Screen reader announcements for sync updates
- **Fix**: Add aria-live region for toast (future)

### FLAW 3.8: Offline Mode
- What happens when offline?
- **Fix**: Document - no offline support, requires network

### FLAW 3.9: Session Expiry
- If session expires mid-edit
- **Fix**: Re-auth prompt on 401 error

### FLAW 3.10: Rate Limiting
- Rapid edits → rate limit hit
- **Fix**: Debounce + rate limit toasts

---

# VERSION 4 - Improved Plan

## Additions from Analysis 3:

### 4.1 Optimized Refetch
- On sync event: Refetch only current view range
- Use `planStartDate` + 7 days for weekly planner
- Use visible month for calendar view

### 4.2 Debounce Specification
- **Where**: MealCard input onBlur (not onChange)
- **Timing**: 0ms debounce (instant on blur)
- **Rationale**: Blur already batches edits naturally

### 4.3 Optimistic Update with Rollback
```typescript
const handleMealUpdate = async (...) => {
  const originalPlan = JSON.parse(JSON.stringify(weeklyPlan));
  try {
    // optimistic update
    setWeeklyPlan(updatedPlan);
    await saveScheduledMeal(...);
  } catch (error) {
    // rollback on failure
    setWeeklyPlan(originalPlan);
    toast.error("Failed to save");
  }
};
```

### 4.4 Multiple Tabs
- Handled by Supabase real-time subscription
- Same browser, different tabs = both update
- Different devices = both update

### 4.5 Mobile Responsiveness
| Element | Desktop | Mobile |
|---------|---------|--------|
| Family Badge | Full text "Family - [name]" | Icon only |
| Calendar Dots | 8px | 6px |
| Meal Cards | Full height | Compact |

### 4.6 Offline Behavior
- No offline support
- If network unavailable: Save fails, toast shown
- User must reconnect and retry

### 4.7 Session Expiry
- On 401 response: Redirect to login
- Preserve current URL for post-login redirect

### 4.8 Rate Limiting
- Handled server-side
- On 429 response: Toast "Too many requests, please wait"

---

# CRITICAL ANALYSIS 4

## Flaws Identified:

### FLAW 4.1: Subscription Memory Leak
- Channel not properly unsubscribed on unmount
- **Fix**: Already handled via useEffect cleanup

### FLAW 4.2: Edge Case - Generate While Viewing Old Week
- User viewing Jan 1-7, generates new plan
- Where does new plan go? Current week or viewed week?
- **Fix**: Generate uses planStartDate (viewed week)

### FLAW 4.3: Regenerate Single Meal
- Not covered in family mode
- Uses handleRegenerateMeal → saves where?
- **Fix**: Should save to scheduled_meals like handleMealUpdate

### FLAW 4.4: Smart Edit Feature
- AI-powered multi-meal edit
- Works with family mode?
- **Fix**: Same rules - saves to family schedule

### FLAW 4.5: Share Menu Feature
- Shares to WhatsApp/social
- Shows family or personal?
- **Fix**: Shows current mode's menu

### FLAW 4.6: Print/Export
- Not explicitly covered
- **Fix**: Uses current mode's data

### FLAW 4.7: Analytics
- Track family mode usage?
- **Fix**: Out of scope, future feature

### FLAW 4.8: Family Group Size Limit
- How many members?
- **Fix**: Document - currently unlimited

### FLAW 4.9: Leave Family
- Member wants to leave
- **Fix**: Use "Leave Family" button, removes from membership

### FLAW 4.10: Kick Member
- Owner removes member
- **Fix**: Use member list, kick button for owner

---

# VERSION 5 - FINAL COMPREHENSIVE PLAN

## Complete Feature Matrix

### 5.1 Authentication & Authorization

| Feature | Owner | Member | Guest |
|---------|-------|--------|-------|
| Edit Meals | ✅ | ✅ | ❌ |
| Generate Plan | ✅ | ✅ | ❌ |
| Swap Meals | ✅ | ✅ | ❌ |
| View Meals | ✅ | ✅ | ❌ |
| Invite Members | ✅ | ❌ | ❌ |
| Kick Members | ✅ | ❌ | ❌ |
| Delete Group | ✅ | ❌ | ❌ |
| Leave Group | ❌ | ✅ | ❌ |

### 5.2 Complete Data Flow

```
[User Action] → [UI Update (Optimistic)] → [Save to scheduled_meals]
                                                   ↓
                                         [Real-time broadcast]
                                                   ↓
                                    [Other family members receive]
                                                   ↓
                                          [Their UI updates]
```

### 5.3 All Save Operations

| Operation | Saves To | With familyGroupId |
|-----------|----------|-------------------|
| Generate Plan | scheduled_meals | ✅ |
| Edit Meal | scheduled_meals | ✅ |
| Swap Meal | scheduled_meals | ✅ |
| Delete Meal | scheduled_meals (empty) | ✅ |
| Regenerate Single | scheduled_meals | ✅ |
| Smart Edit | scheduled_meals | ✅ |
| Manual Planning | scheduled_meals | ✅ |
| Transfer Copy | scheduled_meals | target mode |

### 5.4 UI Elements Complete

| Element | Personal | Family | Implementation Status |
|---------|----------|--------|----------------------|
| Mode Toggle | Gray badge | Purple badge | ✅ Done |
| Meal Cards | Orange border | Purple border | ⚠️ Partial |
| Calendar Dots | Orange | Purple | ⚠️ Partial |
| Generate Button | Standard | Standard | ✅ Done |
| Grocery List | Personal | Shared | ✅ Done |
| Alternatives | Personal | Shared | ✅ Done |

### 5.5 Sync Behavior Complete

| Event | Trigger | Sync Action |
|-------|---------|-------------|
| Meal edited | saveScheduledMeal | Broadcast to family |
| Plan generated | archivePlanToSchedule | Broadcast to family |
| Alternative selected | saveScheduledMeal | Broadcast to family |
| Grocery regenerated | (none) | Not synced - local to device |

### 5.6 Error Handling Complete

| Error | Detection | Recovery |
|-------|-----------|----------|
| Save failed | try/catch | Rollback + toast |
| Network lost | subscription error | Auto-reconnect |
| Rate limited | 429 response | Retry after delay |
| Session expired | 401 response | Redirect to login |
| Permission denied | 403 response | Toast + no action |

### 5.7 Implementation Checklist

#### Completed ✅
- [x] DB constraint for family isolation
- [x] handleMealUpdate saves to scheduled_meals
- [x] Real-time subscription for scheduled_meals
- [x] Mode switch reloads data
- [x] Generate plan passes familyGroupId

#### Pending ⚠️
- [ ] Purple border for family mode cards
- [ ] Purple dots on calendar for family
- [ ] "Updated by [name]" toast on sync
- [ ] Regenerate single meal → scheduled_meals
- [ ] Smart Edit → scheduled_meals
- [ ] Optimistic rollback on save failure

---

## Summary

This document captures the complete Family Mode specification through 5 iterative versions. The core persistence fix has been implemented. Remaining work includes visual differentiation (purple styling) and edge case handlers.

---

# CRITICAL ANALYSIS 6

## Flaws Found (Priority-Ordered):

### HIGH Priority:
| # | Flaw | Current State | Fix Required |
|---|------|---------------|--------------|
| 6.1 | handleSmartEditConfirm uses savePlan | Line 1018: `savePlan()` | Change to `saveScheduledMeal()` |
| 6.2 | handleRegenerateMeal unknown | Need to verify | Check code |
| 6.3 | Page load doesn't guarantee schedule-first | Mode switch effect | Verify line 253-279 |

### MEDIUM Priority:
| # | Flaw | Status |
|---|------|--------|
| 6.4 | Purple border not implemented | Visual only |
| 6.5 | Calendar dots colors | Visual only |
| 6.6 | Grocery sync UX | Needs "regenerate" prompt |

### LOW Priority:
| # | Flaw | Status |
|---|------|--------|
| 6.7 | Alternatives preservation | Already in handleMealUpdate |
| 6.8 | prepAhead field | No UI for editing |
| 6.9 | Toast "Updated by [name]" | Nice to have |
| 6.10 | Save loading indicator | Nice to have |

---

# VERSION 6 - HIGH Priority Fixes

## 6.1 handleSmartEditConfirm Fix

**VERIFIED BUG at Line 1018:**
```typescript
// CURRENT (BROKEN):
await supabaseService.savePlan(updatedPlan, userId, currentProfileId, activeFamilyGroupId);

// FIXED:
Object.entries(updates).forEach(async ([type, meal]) => {
  const mealDate = format(addDays(planStartDate, smartEditData.index), 'yyyy-MM-dd');
  await supabaseService.saveScheduledMeal(mealDate, updatedPlan.days[smartEditData.index], userId, activeFamilyGroupId);
});
```

## 6.2 handleRegenerateMeal - Needs Verification

Look for function that regenerates a single meal via AI and verify it saves correctly.

## 6.3 Page Load Verification - CONFIRMED OK

```typescript
// Lines 253-279: Mode change effect correctly:
// 1. Gets schedule with familyGroupId
// 2. Gets weekFromSchedule with familyGroupId
// 3. Sets weeklyPlan from schedule
```

---

# CRITICAL ANALYSIS 7

Flaw count dropping - focusing on remaining edge cases:

| # | Item | Status |
|---|------|--------|
| 7.1 | Race condition during sync | Accept for MVP |
| 7.2 | Owner deletion cascade | Document: family deleted |
| 7.3 | Invite code security | Acceptable for meal planning |
| 7.4 | All other items from v6 | Mostly marked OK |

**CONVERGENCE OBSERVED**: Only 2-3 real issues remain.

---

# VERSION 7 - Edge Case Decisions

## Owner Account Deletion
- **Decision**: Delete entire family group
- **Notification**: Members see "Family no longer exists" 
- **Implementation**: CASCADE delete in database

## Race Condition During Edit
- **Scenario**: User typing when sync fires
- **Behavior**: Their unsaved text is replaced
- **Decision**: Accept for MVP - last write wins

---

# CRITICAL ANALYSIS 8 - UX OPTIMIZATION FOCUS

Per user request, analyzing for best UX while maintaining efficiency:

### UX Issue 8.1: No Visual Feedback on Save
- User edits, but no indication of success
- **Fix**: Add brief green border flash on save success

### UX Issue 8.2: Family Mode Not Obvious
- User might not realize they're in Family Mode
- **Fix**: Purple accent color throughout (cards, buttons, headers)

### UX Issue 8.3: Who Made Changes?
- Can't tell who edited what
- **Fix**: Show "Last edited by [name]" on meal cards

### UX Issue 8.4: Stale Grocery List
- Meals change but grocery doesn't auto-update
- **Fix**: Show banner "Meals changed - update grocery list?"

### UX Issue 8.5: Mode Switch Jarring
- Switching modes clears everything abruptly
- **Fix**: Add transition animation

### Frontend Efficiency:
- **Current**: Deep clone weeklyPlan on every edit
- **Optimal**: Use immer.js for immutable updates
- **Decision**: Deep clone is fine for 7-day plan

### Backend Efficiency:
- **Current**: saveScheduledMeal is one DB call per meal
- **Optimal**: Batch updates for smart edit
- **Decision**: Single calls acceptable for now

### Data Efficiency:
- **Current**: Real-time subscription on entire table
- **Optimal**: Subscription on specific date range
- **Decision**: Filter by family_group_id is sufficient

---

# VERSION 8 - UX OPTIMIZED DESIGN

## Visual Feedback System

| Action | Feedback | Duration |
|--------|----------|----------|
| Editing | Blue border | While focused |
| Saved | Green flash | 1 second |
| Failed | Red border + toast | Until retry |
| Syncing from other user | Purple pulse | 0.5 second |

## Family Mode Visual Language

| Element | Personal | Family |
|---------|----------|--------|
| Mode badge | Gray "Personal" | Purple "Family" |
| Card border | Gray | Purple tint |
| Calendar dots | Orange | Purple |
| Save icon | Standard | Users icon |

## "Last Edited By" Display
- Small text below meal name
- Show first name only
- "Edited by John, 2 min ago"

## Grocery Stale Banner
```jsx
{groceryNeedsUpdate && (
  <div className="bg-amber-50 p-3 rounded-lg">
    Meals have changed. 
    <button>Update Grocery List</button>
  </div>
)}
```

---

# CRITICAL ANALYSIS 9 - FINAL VERIFICATION

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9.1 | handleMealUpdate | ✅ FIXED | Saves to scheduled_meals |
| 9.2 | handleSmartEditConfirm | ❌ NEEDS FIX | Still uses savePlan |
| 9.3 | handleRegenerateMeal | ⚠️ UNKNOWN | Need to find and verify |
| 9.4 | Real-time subscription | ✅ WORKING | scheduled_meals filter |
| 9.5 | Mode switch reload | ✅ WORKING | Lines 253-279 |
| 9.6 | DB constraint | ✅ DONE | family_group_id included |
| 9.7 | UX: Visual feedback | ❌ NOT DONE | Needs implementation |
| 9.8 | UX: Purple styling | ❌ NOT DONE | Needs implementation |
| 9.9 | UX: Last edited by | ❌ NOT DONE | Needs implementation |
| 9.10 | UX: Grocery stale | ❌ NOT DONE | Needs implementation |

**Issues found: 1 code bug, 4 UX enhancements pending**

---

# CRITICAL ANALYSIS 10 - CONVERGENCE CHECK

Analyzing if we've reached zero remaining specification gaps:

**CORE FUNCTIONALITY**: ✅ COMPLETE
- Data model defined
- Save flows defined  
- Sync behavior defined
- Permissions defined

**CODE BUGS IDENTIFIED**: 1 remaining
- handleSmartEditConfirm (MUST FIX)

**UX ENHANCEMENTS**: 4 identified (NICE TO HAVE)
- Visual feedback
- Purple styling
- Last edited by
- Grocery stale banner

**EDGE CASES**: All documented
- Owner deletion → cascade
- Race condition → last write wins
- Offline → no support

**CONVERGENCE ACHIEVED**: ✅
- No new specification gaps found
- Only 1 code bug to fix
- UX items are enhancements, not requirements

---

# FINAL VERSION - COMPLETE SPECIFICATION

## Implementation Checklist

### MUST FIX (Bugs):
- [ ] `handleSmartEditConfirm` → use `saveScheduledMeal`
- [ ] Verify `handleRegenerateMeal` saves correctly

### SHOULD DO (UX):
- [ ] Add save success visual feedback
- [ ] Add purple accent for Family Mode
- [ ] Show "Grocery needs update" banner

### COULD DO (Future):
- [ ] Show "Last edited by [name]"
- [ ] Smooth mode switch animation
- [ ] Offline support

## Complete Function Reference

| Function | Save Target | familyGroupId | Status |
|----------|-------------|---------------|--------|
| handleMealUpdate | scheduled_meals | ✅ | FIXED |
| handleScheduleMealUpdate | scheduled_meals | ✅ | OK |
| handleSmartEditConfirm | ~~weekly_plans~~ | - | NEEDS FIX |
| handleGeneratePlan | scheduled_meals | ✅ | OK |
| archivePlanToSchedule | scheduled_meals | ✅ | FIXED |

## Data Flow Diagram

```
USER ACTION
    │
    ├─► handleMealUpdate ──────┐
    ├─► handleScheduleMealUpdate ─┤
    ├─► handleSmartEditConfirm ───┤  (NEEDS FIX)
    ├─► handleGeneratePlan ───────┤
    │                             │
    │                             ▼
    │                    saveScheduledMeal()
    │                             │
    │                             ▼
    │                   scheduled_meals table
    │                             │
    │                             ▼
    │                  Real-time subscription
    │                             │
    │                             ▼
    └─────────────────── Other family members see update
```

## Database Schema (Family Mode Columns)

```sql
scheduled_meals:
  - family_group_id UUID (nullable)
  - last_modified_by UUID (FK to users)

weekly_plans:
  - family_group_id UUID (nullable)

Constraint:
  UNIQUE (user_id, date, COALESCE(family_group_id, '00000000-...'))
```

---

*Document complete. 10 iterations performed. Specification is comprehensive and convergent.*

