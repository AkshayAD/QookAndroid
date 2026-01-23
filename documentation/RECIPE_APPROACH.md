# Recipe Feature - Approach Analysis

*Using /analyze workflow to iterate on implementation approach*

---

# VERSION 1 - Current Approach

## How It Works
1. User clicks recipe button on any meal
2. Edge Function searches YouTube: `"{meal name} recipe"`
3. Returns top result with video ID, title, channel, views
4. Caches result in Supabase for efficiency
5. Frontend embeds YouTube player

## No AI Needed For:
| Step | Why No AI |
|------|-----------|
| Finding video | YouTube search returns relevant results |
| Getting video info | YouTube API provides title, channel, views |
| Displaying video | Embedded YouTube player handles everything |
| Video description | Comes from YouTube metadata, shown as-is |

## Where AI Could Be Used (Optional):
| Feature | AI Use | Priority | Cost |
|---------|--------|----------|------|
| Extract ingredients from description | Parse list from text | LOW | ~0.001 credits |
| Calorie estimation | Estimate from meal name | LOW | ~0.001 credits |
| Health pros/cons | Generate from meal name | LOW | ~0.01 credits |
| "Make healthier" tips | Suggest alternatives | LOW | ~0.01 credits |

## Current Cost: $0
- YouTube Data API v3: **FREE** (10,000 units/day)
- Caching: Already using Supabase (no extra cost)
- No AI = No credits spent

---

# CRITICAL ANALYSIS 1

## Issues Found:

### ISSUE 1.1: YouTube API Key Required (HIGH)
- User needs to get a YouTube API key from Google Cloud
- Free but requires setup
- **Status**: Required for this approach

### ISSUE 1.2: API Quota Limit (MEDIUM)
- 10,000 units/day = 100 searches/day (search=100 units)
- Caching mitigates this significantly
- **Status**: Acceptable with caching

### ISSUE 1.3: RecipePanel Calls Wrong Endpoint (HIGH)
- Current code calls `/api/recipe-search`
- Should call Supabase Edge Function URL
- **Fix**: Update fetch URL

### ISSUE 1.4: Ingredients Not Shown in MVP (LOW)
- User wanted ingredients - not in current MVP
- **Fix**: Parse from description or show "See video for details"

### ISSUE 1.5: No AI Analysis By Default (CONFIRMED)
- Current implementation uses NO AI
- All data comes from YouTube
- **Status**: Matches user requirement ✓

---

# VERSION 2 - Refined Approach

## Zero-AI Implementation (Default)

```
User clicks recipe → YouTube search → Cache & display

ALL data from YouTube API:
- Video player (embed)
- Title
- Channel
- View count
- Description
- Thumbnail
```

## AI Add-ons (User Choice, Phase 2+)

IF user wants ingredients/health info in the future:
```
Option A: Regex parse description (FREE, works ~40% of time)
Option B: Single AI call for structured extraction (~0.01 credits)
```

## Endpoint Fix
```typescript
// RecipePanel.tsx - fix the fetch URL
const SUPABASE_URL = 'https://igcmhlfonulqtxsiiisb.supabase.co';
const response = await fetch(`${SUPABASE_URL}/functions/v1/recipe-search`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`
  },
  body: JSON.stringify({ mealName }),
});
```

---

# CRITICAL ANALYSIS 2

## Issues Found:

### ISSUE 2.1: Auth Header for Edge Function (HIGH)
- Edge Function has `verify_jwt: false`
- Good for public recipe searches, no user auth needed
- **Status**: OK

### ISSUE 2.2: YOUTUBE_API_KEY Not Set (HIGH)
- Need to set environment variable in Supabase Edge Functions
- **Fix**: User needs to add their YouTube API key

### ISSUE 2.3: Simpler Alternative? (MEDIUM)
- Do we even need YouTube API?
- Could just construct YouTube search URL and show in iframe
- **Tradeoff**: Less control but no API key needed

---

# VERSION 3 - Simplest Possible (No API Key)

## Alternative: Direct YouTube Search Embed

Instead of YouTube Data API, just:
1. Open YouTube search results in new tab
2. OR embed YouTube search results page

**Pros:**
- No API key needed
- No quota limits
- No Edge Function needed

**Cons:**
- Less polished (shows search page, not specific video)
- User has to click to pick video

## Recommendation

**For MVP that "just works":**
- Use YouTube Data API with caching (current approach)
- Requires one-time API key setup
- Provides clean, embedded experience

**If user wants zero setup:**
- Just link to YouTube search (no embed)
- `https://youtube.com/results?search_query={meal}+recipe`

---

# FINAL DECISION

## Keep Current Approach Because:
1. ✅ Already implemented
2. ✅ Clean UX (embedded video, not search page)
3. ✅ Zero AI cost
4. ✅ Caching reduces API usage
5. ⚠️ Requires YouTube API key (one-time setup)

## AI Not Needed For:
- Basic recipe viewing ❌
- Video display ❌
- Getting video metadata ❌

## AI Only If User Wants (Future):
- Ingredient extraction from description
- Calorie estimation
- Health analysis
