# Regenerate Feature - Complete Analysis & Improvement Plan

## Table of Contents
1. [Current Implementation Analysis](#current-implementation-analysis)
2. [Identified Issues](#identified-issues)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Language Detection & Preservation](#language-detection--preservation)
5. [Improvement Plan](#improvement-plan)
6. [Implementation Details](#implementation-details)

---

## Current Implementation Analysis

### 1. Regenerate Flow Overview

When a user clicks the "regenerate" button on a meal:

#### Client Side (App.tsx - Line 344-374)
```
handleRegenerateMeal(dayIndex, mealType)
  ↓
regenerateMealViaProxy(userId, currentMeal, mealType, preferences, dayName, apiKey)
  ↓
API Proxy: /api/ai-proxy (action: 'regenerate_meal')
  ↓
executeRegenerateMeal(ai, payload)
```

#### Server Side (api/ai-proxy.ts - Line 309-331)
```javascript
async function executeRegenerateMeal(ai: GoogleGenAI, payload: any) {
    const { currentMeal, mealType, preferences, dayName } = payload;

    const prompt = `Generate a single ${mealType} meal for ${dayName}. 
Current meal to replace: ${currentMeal}
Dietary preferences: ${preferences.dietaryType}
Must avoid: ${preferences.dislikes?.join(', ') || 'None'}

Generate a COMPLETE meal description with:
- Main dish name with preparation style
- Side dishes or accompaniments
- Example format: "Paneer Butter Masala with Jeera Rice, Raita and Papad" or "Masala Dosa with Sambar, Coconut Chutney and Filter Coffee"

Provide ONLY the meal description, nothing else.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { temperature: 0.9, maxOutputTokens: 150 }
    });

    return { meal: response.text?.trim() || currentMeal };
}
```

### 2. Share Modal Translation Flow

The ShareModal handles language translation for displaying meal plans:

#### Language Detection (ShareModal.tsx - Line 32-46)
```javascript
const detectOriginalLanguage = useCallback((): 'hi' | 'en' => {
    if (sourceLanguage === 'Hindi') return 'hi';
    if (sourceLanguage === 'English') return 'en';

    // Auto-detect from content
    if (type === 'plan') {
        const planData = data as WeeklyPlan;
        const sampleText = planData.days.map(d => `${d.breakfast} ${d.lunch} ${d.dinner}`).join(' ');
        return /[\u0900-\u097F]/.test(sampleText) ? 'hi' : 'en';
    } 
    // ...
}, [data, type, sourceLanguage]);
```

### 3. Local Regenerate (geminiService.ts - Line 221-308)

The local `regenerateSingleMeal` function (not used via proxy currently) **does have language detection**:

```javascript
// Detect if the plan is in Hindi by checking for Devanagari characters
const sampleMeals = [day.breakfast, day.lunch, day.dinner].filter(Boolean).join(' ');
const isHindiPlan = /[\u0900-\u097F]/.test(sampleMeals);

// Use profile language if available, otherwise detect from content
const useHindi = preferences.language === 'Hindi' || isHindiPlan;

const languageInstruction = useHindi
    ? `CRITICAL LANGUAGE REQUIREMENT:
    - The existing meals are in HINDI (Devanagari script)
    - You MUST output the new meal in HINDI DEVANAGARI SCRIPT (हिंदी में)
    ...`
    : `LANGUAGE REQUIREMENT:
    - Output the meal name in English
    ...`;
```

---

## Identified Issues

### Issue 1: ❌ Proxy Regenerate Missing Language Detection

**Location:** `api/ai-proxy.ts` - `executeRegenerateMeal()` (Line 309-331)

**Problem:** The server-side regeneration prompt **completely ignores language**. It:
- Does not check `preferences.language`
- Does not detect Hindi from `currentMeal` content
- Always outputs English examples
- Has no Hindi language instruction

**Evidence:**
```javascript
// Current prompt - NO language handling!
const prompt = `Generate a single ${mealType} meal for ${dayName}...
// Example format: "Paneer Butter Masala with Jeera Rice..." (English only)
```

### Issue 2: ❌ Incomplete Text Output (maxOutputTokens: 150)

**Location:** `api/ai-proxy.ts` Line 327

**Problem:** `maxOutputTokens: 150` is too restrictive for Hindi text. Devanagari script with accompaniments can easily exceed this, causing truncation.

**Example:**
- English: "Paneer Butter Masala with Jeera Rice, Raita and Papad" = ~12 tokens
- Hindi: "पनीर बटर मसाला जीरा चावल, रायते और पापड़ के साथ" = ~25+ tokens

### Issue 3: ❌ Day Name Language Mismatch

**Location:** `api/ai-proxy.ts` Line 310, 312

**Problem:** The prompt uses `dayName` from the plan directly but then gives English examples. If the plan was generated in Hindi, `dayName` could be "सोमवार" but the AI is being told to output English-style meals.

### Issue 4: ❌ Current Meal Content Not Used for Language Detection

Even though `currentMeal` is passed (e.g., "पोहा और चाय"), the system doesn't detect the Devanagari script and set the output language accordingly.

---

## Root Cause Analysis

### Why Hindi → English Swap Happens:

1. **Server-side regenerate lacks language logic entirely**
   - No `preferences.language` check
   - No Devanagari detection on `currentMeal`
   - Hardcoded English examples in prompt

2. **Example contamination in prompt**
   - Prompt shows only English examples: "Paneer Butter Masala..."
   - AI follows examples regardless of current meal's language

3. **Token limit truncates Hindi**
   - Hindi needs more tokens per concept
   - 150 token limit cuts output mid-sentence

### Data Flow Gap:

```
Client                          Server
─────────────────────────────────────────
preferences.language ─────────→ NOT USED
currentMeal (हिंदी)  ─────────→ NOT ANALYZED
dayName (सोमवार)     ─────────→ Used but ignored context
                      ↓
              Generate English ← Examples are English
```

---

## Language Detection & Preservation

### When to Show Hindi vs English:

| Scenario | Current Behavior | Correct Behavior |
|----------|------------------|------------------|
| Profile language = Hindi | ✅ Initial plan in Hindi | ✅ Same |
| Regenerate on Hindi meal | ❌ Returns English | ⚡ Hindi |
| Regenerate on English meal | ✅ Returns English | ✅ Same |
| Share modal - Hindi plan | ✅ Shows Hindi | ✅ Same |
| Share toggle to English | ✅ Translates via AI | ✅ Same |

### Detection Algorithm:

```javascript
function detectMealLanguage(content: string): 'hi' | 'en' {
    // Devanagari Unicode range: \u0900-\u097F
    const hasDevanagari = /[\u0900-\u097F]/.test(content);
    return hasDevanagari ? 'hi' : 'en';
}

function getOutputLanguage(preferences: any, currentMeal: string): 'hi' | 'en' {
    // Priority 1: Detect from current meal content
    const contentLanguage = detectMealLanguage(currentMeal);
    
    // If current meal is in Hindi, regenerate must be in Hindi
    if (contentLanguage === 'hi') return 'hi';
    
    // Otherwise, use profile preference
    return preferences.language === 'Hindi' ? 'hi' : 'en';
}
```

---

## Improvement Plan

### Phase 1: Fix Server-Side Regenerate (CRITICAL)

**File:** `api/ai-proxy.ts`

**Changes:**
1. Add language detection from `currentMeal` content
2. Add language detection from `preferences.language`
3. Create language-specific prompts with proper examples
4. Increase `maxOutputTokens` to 250 for Hindi content
5. Add Hindi day name mapping

### Phase 2: Enhanced Language Consistency

**Files:**
- `services/geminiService.ts` - Already has good logic (reference)
- `api/ai-proxy.ts` - Apply similar patterns

### Phase 3: Share Modal Improvements

**File:** `components/ShareModal.tsx`

**Changes:**
1. Preserve detected language state
2. Show clear language indicator
3. Handle partial translations gracefully

---

## Implementation Details

### Updated `executeRegenerateMeal` Function:

```javascript
async function executeRegenerateMeal(ai: GoogleGenAI, payload: any) {
    const { currentMeal, mealType, preferences, dayName } = payload;

    // LANGUAGE DETECTION: Check Devanagari in currentMeal or preferences
    const hasDevanagari = /[\u0900-\u097F]/.test(currentMeal);
    const useHindi = preferences?.language === 'Hindi' || hasDevanagari;

    // Hindi day name mapping
    const hindiDayMap: Record<string, string> = {
        'Monday': 'सोमवार', 'Tuesday': 'मंगलवार', 'Wednesday': 'बुधवार',
        'Thursday': 'गुरुवार', 'Friday': 'शुक्रवार', 'Saturday': 'शनिवार', 'Sunday': 'रविवार',
        'सोमवार': 'सोमवार', 'मंगलवार': 'मंगलवार', 'बुधवार': 'बुधवार',
        'गुरुवार': 'गुरुवार', 'शुक्रवार': 'शुक्रवार', 'शनिवार': 'शनिवार', 'रविवार': 'रविवार'
    };

    const displayDayName = useHindi ? (hindiDayMap[dayName] || dayName) : dayName;

    // Build language-specific instructions
    const languageInstruction = useHindi
        ? `
CRITICAL LANGUAGE REQUIREMENT:
- The current meal "${currentMeal}" is in HINDI
- You MUST output the new meal in HINDI DEVANAGARI SCRIPT (हिंदी में)
- Example format: "पोहा प्याज और मूंगफली के साथ", "दाल तड़का चावल और सलाद के साथ", "पनीर टिक्का मसाला रोटी और रायता के साथ"
- Include accompaniments using Hindi connectors: "के साथ" (with), "और" (and)
- DO NOT output in English - output MUST be in Hindi Devanagari script
`
        : `
LANGUAGE REQUIREMENT:
- Output the meal name in English
- Include accompaniments like "with roti", "served with raita"
- Example format: "Paneer Butter Masala with Jeera Rice, Raita and Papad"
`;

    const prompt = `Generate a single ${mealType} meal for ${displayDayName}. 
Current meal to replace: ${currentMeal}
Dietary preferences: ${preferences?.dietaryType || 'Vegetarian'}
Must avoid: ${preferences?.dislikes?.join(', ') || 'None'}

${languageInstruction}

Generate a COMPLETE meal description with:
- Main dish name with preparation style
- Side dishes or accompaniments (2-3 items)
- Make it DIFFERENT from the current meal

Provide ONLY the meal description, nothing else.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
            temperature: 0.9, 
            maxOutputTokens: 250  // Increased for Hindi content
        }
    });

    return { meal: response.text?.trim() || currentMeal };
}
```

### Test Cases:

| Input | Expected Output |
|-------|-----------------|
| currentMeal: "पोहा" | Hindi meal: "उपमा सांभर और चटनी के साथ" |
| currentMeal: "Poha" | English meal: "Upma with Sambar and Chutney" |
| currentMeal: "दाल चावल" | Hindi meal: "राजमा चावल सलाद और पापड़ के साथ" |
| currentMeal: "Dal Rice" | English meal: "Rajma Rice with Salad and Papad" |
| preferences.language: "Hindi", any input | Hindi output |

---

## Action Items

1. ✅ **Update `api/ai-proxy.ts`** - Fixed `executeRegenerateMeal` with language detection
   - Added Devanagari detection regex: `/[\u0900-\u097F]/`
   - Added `preferences.language` check
   - Added Hindi day name mapping
   - Added language-specific prompts with Hindi examples
   - Increased `maxOutputTokens` from 150 to 300
2. ⬜ **Test with Hindi meal plan** - Verify regenerated meals stay in Hindi
3. ⬜ **Test with English meal plan** - Verify still works correctly
4. ⬜ **Verify token limits** - Ensure 300 tokens is sufficient for full Hindi meals
5. ⬜ **Add logging** - Log detected language for debugging
6. ⬜ **Document behavior** - Update user-facing documentation

---

## Implementation Status

### Changes Made (2026-01-12)

#### File: `api/ai-proxy.ts`

**1. Function:** `executeRegenerateMeal()` (Lines 309-376)

**Key Changes:**
- **Language Detection**: Added Devanagari regex `/[\u0900-\u097F]/.test(currentMeal)`
- **Hindi Day Mapping**: Monday → सोमवार, Tuesday → मंगलवार, etc.
- **Language-Specific Prompts**: Hindi vs English examples
- **Token Limit**: Increased from 150 to 300

---

**2. Function:** `executeSmartEdit()` (Lines 378-433)

**Key Changes:**
- Added language detection from all current meal content
- Added language-specific instructions for Hindi/English output
- Ensures edited meals stay in the same language as original

---

**3. Function:** `executeGenerateGrocery()` (Lines 436-502)

**Key Changes:**
- Added language detection from meal content
- Hindi grocery items: "प्याज" instead of "Onion"
- Categories remain in English for consistency
- Quantities in English (500 g, 1 kg)

---

## Summary

The core issue was that the **server-side proxy functions** were implemented without any language awareness, causing all AI-generated content to default to English regardless of the original plan's language.

### Fixed Functions:
| Function | Issue | Fix |
|----------|-------|-----|
| `executeRegenerateMeal` | Always output English | Detects language, uses Hindi prompts |
| `executeSmartEdit` | Ignored original language | Preserves language in edits |
| `executeGenerateGrocery` | English-only items | Outputs items in detected language |

### The fix involves:
1. Detecting language from content (Devanagari detection regex)
2. Respecting user's profile language preference
3. Providing language-appropriate prompts and examples to the AI
4. Increasing token limits to accommodate Hindi output length (300 tokens)
5. Mapping day names to Hindi when appropriate

