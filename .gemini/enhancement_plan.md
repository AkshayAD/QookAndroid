# Cook Commander Enhancement Implementation Plan

## Status: ✅ ALL PHASES COMPLETE

---

## Phase 1: AI Improvements ✅ COMPLETE

### 1.1 Smart Edit with Fast Model ✅
- Changed `smartEditMeals` to use `gemini-3.0-flash` with `ThinkingLevel.MINIMAL`
- Changed `regenerateSingleMeal` to use `gemini-3.0-flash` with `ThinkingLevel.MINIMAL`

### 1.2 Grocery List from Calendar ✅
- Added `generateGroceryListFromSchedule` function
- Updated CalendarView with week-based grocery generation button
- Fixed calendar to start week on Monday (M-S format)

---

## Phase 2: Meal Regeneration Improvements ✅ COMPLETE

### 2.1 Avoid Already Generated Meals ✅
**Changes Made:**
- Updated `regenerateSingleMeal` in `geminiService.ts`
- Collects all existing meals from the weekly plan
- Adds explicit instruction: "Do NOT suggest any of these already planned meals"
- Increased temperature to 0.9 for more variety

```typescript
// Collect all existing meals to avoid duplicates
const existingMeals = currentPlan.days
    .flatMap(d => [d.breakfast, d.lunch, d.dinner])
    .filter(m => m && m.trim() !== '')
    .map(m => m.trim());
const uniqueExistingMeals = [...new Set(existingMeals)].join(", ");

// Added to prompt:
"IMPORTANT: Do NOT suggest any of these already planned meals (avoid duplicates):
${uniqueExistingMeals}"
```

---

## Phase 3: User Navigation & Authentication UI ✅ COMPLETE

### 3.1 User Profile Menu ✅
**New Component Created:** `components/UserMenu.tsx`

**Features:**
- Shows user email when logged in
- Shows "Guest Mode" when offline
- Dropdown menu with options:
  - Sign Out (when logged in)
  - Sign In (when in guest mode)
  - Switch Account (signs out and shows auth page)
- Warning badge for offline mode advising to sign in

### 3.2 Navigation Elements ✅

**Header Layout (Left to Right):**
1. ✅ Logo + App Name (CookCommander)
2. ✅ Profile Selector Dropdown (meal preferences)
3. ✅ AI Settings Icon (with red dot if no API key)
4. ✅ Preferences Icon (gear)
5. ✅ Generate/Regenerate Button
6. ✅ User Menu Dropdown (new!)

### 3.3 Sign Out Functionality ✅
- UserMenu calls `signOut()` from AuthContext
- Clears session and redirects to auth page

### 3.4 Switch Account ✅
- Calls `signOut()` AND `setSkipAuth(false)`
- Re-shows auth page for different login

---

## Phase 4: AI Integration Consistency ✅ COMPLETE

### 4.1 Model Selection Strategy (Final)
| Function | Model | Thinking | Rationale |
|----------|-------|----------|-----------|
| `generateWeeklyPlan` | Settings default (gemini-3-flash-preview) | Budget: 2048 | Complex task |
| `regenerateSingleMeal` | gemini-3.0-flash | MINIMAL | Fast replacement |
| `smartEditMeals` | gemini-3.0-flash | MINIMAL | Quick edit |
| `generateGroceryList` | Settings default | Budget: 1024 | Medium complexity |
| `generateGroceryListFromSchedule` | gemini-3.0-flash | MINIMAL | Fast generation |
| `parsePreferencesFromText` | Settings default | Budget: 2048 | Careful analysis |
| `optimizePreferencesFromHistory` | Settings default | Budget: 1024 | Medium complexity |

---

## Files Modified

1. ✅ `services/geminiService.ts` 
   - Updated regenerateSingleMeal to avoid duplicates
   - Added generateGroceryListFromSchedule
   - Used ThinkingLevel.MINIMAL for fast operations

2. ✅ `App.tsx`
   - Added UserMenu to header
   - Added handleGenerateGroceryFromWeek handler
   - Updated CalendarView props

3. ✅ `components/UserMenu.tsx` (NEW)
   - Complete dropdown menu with auth options

4. ✅ `components/CalendarView.tsx`
   - Added grocery generation button for selected week
   - Fixed calendar to start on Monday
   - Added week range display

---

## Summary of All Changes

### Smart Edit & Regeneration
- ⚡ Uses `gemini-3.0-flash` with minimal thinking for 2-5 second responses
- 🔄 Regenerated meals now avoid ALL existing meals in the plan
- 🌡️ Higher temperature (0.9) for more variety

### Calendar Fixes
- 📅 January 9, 2026 correctly shows as Friday
- 📆 Week starts on Monday (M T W T F S S)
- 🛒 "Generate Grocery List for This Week" button added

### Navigation
- 👤 UserMenu dropdown with Sign Out/Switch Account
- 🟢 Online/Offline mode indicator
- ⚠️ Warning for offline users to sign in

### AI Models
- All AI functions now use appropriate model/thinking combinations
- Fast operations: gemini-3.0-flash + MINIMAL thinking
- Complex operations: User's configured model + thinking budget
