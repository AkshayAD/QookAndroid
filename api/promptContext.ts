import { sanitizeMealAlternatives, sanitizeWeeklyPlan } from '../lib/mealSanitizer';
import {
  buildMealSelectionInstruction,
  normalizeAlternativesForSelectedMeals,
  normalizeSelectedMeals,
  normalizeWeeklyPlanForSelectedMeals,
} from '../lib/mealSelection';

const EMPTY_VALUE_PATTERN = /^(null|undefined|none|n\/a)$/i;

function sanitizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const cleaned = value.replace(/\s+/g, ' ').trim();
  return EMPTY_VALUE_PATTERN.test(cleaned) ? '' : cleaned;
}

function sanitizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const cleaned = sanitizeText(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(cleaned);
  });

  return result;
}

export function getSeasonalContext(): { season: string; month: string; availableVegetables: string } {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const monthNum = now.getMonth();

  let season: string;
  let vegetables: string;

  if (monthNum >= 2 && monthNum <= 4) {
    season = 'Spring/Summer (March-May)';
    vegetables = 'tomatoes, cucumbers, bottle gourd (lauki), ridge gourd (tori), bitter gourd (karela), okra (bhindi), brinjal, green beans, capsicum, watermelon, mango, muskmelon';
  } else if (monthNum >= 5 && monthNum <= 8) {
    season = 'Monsoon/Rainy (June-September)';
    vegetables = 'leafy greens (spinach, fenugreek), corn, mushrooms, bottle gourd, snake gourd, ivy gourd (tindora), drumstick, turmeric leaves, colocasia (arbi), yam';
  } else if (monthNum >= 9 && monthNum <= 10) {
    season = 'Autumn/Post-Monsoon (October-November)';
    vegetables = 'carrots, beetroot, radish, cauliflower, cabbage, peas, beans, broccoli, sweet potato, turnip, pumpkin';
  } else {
    season = 'Winter (December-February)';
    vegetables = 'cauliflower, cabbage, peas, carrots, radish (mooli), spinach (palak), mustard greens (sarson), fenugreek (methi), green garlic, broccoli, turnip, beetroot, parsnip';
  }

  return { season, month, availableVegetables: vegetables };
}

function buildLearningContextText(learningSummary: any, softPositiveSignals: string[], softNegativeSignals: string[]): string {
  let learningContext = '';

  if (learningSummary?.totalMealCount > 0) {
    learningContext = `
LEARNED FROM HISTORY (${learningSummary.totalMealCount} meals):
Breakfast patterns: ${sanitizeList(learningSummary.acceptedBreakfasts).slice(0, 8).join(', ') || 'N/A'}
Lunch patterns: ${sanitizeList(learningSummary.acceptedLunches).slice(0, 8).join(', ') || 'N/A'}
Dinner patterns: ${sanitizeList(learningSummary.acceptedDinners).slice(0, 8).join(', ') || 'N/A'}
DO NOT REPEAT: ${sanitizeList(learningSummary.recentMeals).join(', ') || 'N/A'}
`;
  }

  if (softPositiveSignals.length > 0 || softNegativeSignals.length > 0) {
    learningContext += `
SOFT SIGNALS FROM RECENT ACTIONS:
Lean into: ${softPositiveSignals.slice(0, 8).join(', ') || 'None'}
Reduce or avoid: ${softNegativeSignals.slice(0, 8).join(', ') || 'None'}
`;
  }

  return learningContext;
}

export function buildSharedGenerationContext(preferences: any, learningSummary?: any) {
  const pantryStaples = sanitizeList(preferences?.pantryStaples);
  const activeInventoryItems = sanitizeList([
    ...(preferences?.activeInventoryItems || []),
    ...(learningSummary?.activeInventoryItems || []),
  ]);
  const softPositiveSignals = sanitizeList(learningSummary?.softPositiveSignals);
  const softNegativeSignals = sanitizeList(learningSummary?.softNegativeSignals);
  const kitchenMemoryItems = sanitizeList([...pantryStaples, ...activeInventoryItems]);
  const tiffinDays = sanitizeList(preferences?.tiffinDays);
  const tiffinFor = sanitizeList(preferences?.tiffinFor);
  const nonVegPreferences = sanitizeList(preferences?.nonVegPreferences);

  return {
    country: sanitizeText(preferences?.country) || 'India',
    language: sanitizeText(preferences?.language) || 'English',
    dietaryType: sanitizeText(preferences?.dietaryType) || 'Vegetarian',
    dietaryTypes: sanitizeList(preferences?.dietaryTypes),
    dislikes: sanitizeList(preferences?.dislikes),
    allergies: sanitizeList(preferences?.allergies),
    healthGoals: sanitizeList(preferences?.healthGoals),
    specialInstructions: sanitizeText(preferences?.specialInstructions),
    pantryStaples,
    activeInventoryItems,
    kitchenMemoryItems,
    householdSize: Number(preferences?.householdSize) || 4,
    portionSize: sanitizeText(preferences?.portionSize) || 'regular',
    mealComplexity: sanitizeText(preferences?.mealComplexity) || 'balanced',
    cuisineStyle: sanitizeText(preferences?.cuisineStyle) || 'pan-indian',
    hasTiffin: Boolean(preferences?.hasTiffin && tiffinDays.length > 0),
    tiffinDays,
    tiffinFor,
    nonVegPreferences,
    nonVegFrequency: sanitizeText(preferences?.nonVegFrequency) || '1-2x/week',
    mealsToPrepare: normalizeSelectedMeals(preferences?.mealsToPrepare),
    softPositiveSignals,
    softNegativeSignals,
    showPrepReminders: preferences?.showPrepReminders !== false,
    showQuantities: preferences?.showQuantities !== false,
    learningSummary,
    learningContextText: buildLearningContextText(learningSummary, softPositiveSignals, softNegativeSignals),
    kitchenContextText: `
KITCHEN MEMORY:
- Pantry staples always on hand: ${pantryStaples.join(', ') || 'None'}
- Active inventory currently at home: ${activeInventoryItems.join(', ') || 'None'}
- Use pantry staples + current inventory before suggesting extra purchases when practical
`,
  };
}

function buildLanguageInstruction(language: string, householdSize: number): string {
  if (language === 'Hindi') {
    return `
LANGUAGE REQUIREMENT:
- Output ALL meal names in HINDI DEVANAGARI script (हिंदी में)
- Day names MUST be in Hindi: सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार, रविवार
- Write DESCRIPTIVE meal names with quantities like: "पोहा (2 कप) और चाय"
- Include meal descriptions with sides/accompaniments just like English
- IMPORTANT: Hindi output should be EQUALLY DETAILED as English
- Keep quantities appropriate for ${householdSize} people
`;
  }

  return `
LANGUAGE REQUIREMENT:
- Output meal names in English with descriptions
- Day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- Include descriptive meal names with accompaniments and quantities
`;
}

function buildComplexityInstructions(mealComplexity: string): string {
  if (mealComplexity === 'quick') {
    return 'Focus on quick recipes (under 30 mins). Prefer one-pot meals, minimal ingredients.';
  }

  if (mealComplexity === 'elaborate') {
    return 'Include elaborate recipes with multiple components. Traditional multi-dish thalis are welcome.';
  }

  return 'Mix of quick and elaborate meals. Weekdays simpler, weekends can be elaborate.';
}

function buildCuisineInstructions(cuisineStyle: string): string {
  if (cuisineStyle === 'regional') {
    return 'Focus on authentic regional recipes from the user\'s area. Traditional preparations.';
  }

  if (cuisineStyle === 'fusion') {
    return 'Include fusion dishes, Indo-Chinese, international flavors adapted for Indian palate.';
  }

  return 'Pan-Indian variety - mix of North, South, East, West Indian cuisines.';
}

function buildTiffinInstructions(context: ReturnType<typeof buildSharedGenerationContext>): string {
  if (!context.hasTiffin) {
    return '';
  }

  return `
TIFFIN/PACKED LUNCH REQUIREMENT:
On these days: ${context.tiffinDays.join(', ')}
For: ${context.tiffinFor.join(', ') || 'office/school'}
- Make lunch items that travel well (no soup, no items that get soggy)
- Prefer dry rotis, parathas, rice dishes, sandwiches, dry curries
- Avoid: curries with too much gravy, items requiring immediate consumption
`;
}

function buildNonVegInstructions(context: ReturnType<typeof buildSharedGenerationContext>): string {
  if (context.nonVegPreferences.length === 0 || context.dietaryType === 'Vegetarian') {
    return '';
  }

  const frequency = context.nonVegFrequency || '1-2x/week';

  return `
NON-VEG PREFERENCES:
Preferred proteins: ${context.nonVegPreferences.join(', ')}
Frequency: ${frequency}
${frequency === 'daily' ? 'Include non-veg in at least one meal every day.' : ''}
${frequency === '3-4x/week' ? 'Include non-veg 3-4 times across the week.' : ''}
${frequency === '1-2x/week' ? 'Include non-veg 1-2 times across the week.' : ''}
${frequency === 'weekends' ? 'Include non-veg ONLY on Saturday and Sunday.' : ''}
`;
}

function buildPrepAheadInstructions(showPrepReminders: boolean): string {
  if (!showPrepReminders) {
    return `
PREP-AHEAD REMINDERS:
- Do not include prepAhead instructions.
- Return prepAhead as null or empty for every day.
`;
  }

  return `
PREP-AHEAD ANALYSIS (BE SELECTIVE - ONLY TRULY NECESSARY PREP):
For each day, analyze if any meal REQUIRES advance preparation that takes 30+ minutes or needs overnight time.

MANDATORY PREP TASKS - these MUST be mentioned if the dish is included:
- LEGUMES (8-12 hours soaking): Chole, Rajma, Chana, Lobia, Kabuli Chana, Dried Peas
- DAL (2-4 hours soaking): Whole urad dal, Chana dal, Moong sabut (NOT regular moong/masoor)
- BATTER (6-8 hours fermentation): Idli, Dosa, Uttapam, Appam, Dhokla
- DAHI/CURD: Only if recipe needs HOMEMADE curd (store-bought is instant)
- MEAT MARINATION: Chicken tikka, tandoori, kebabs, biryani (2+ hours)
- PANEER MARINATION: Paneer tikka, grilled paneer (1+ hour)
- POTATOES (only if needs cooling): Aloo paratha, aloo tikki (need boiled & cooled potatoes)
- SPROUTING: Moong sprouts, matki sprouts (12-24 hours)

⛔ DO NOT INCLUDE PREP REMINDERS FOR:
- Eggs (boiling takes only 10-15 minutes - can be done while cooking)
- Regular quick-cook dals (moong, masoor, toor - cook in 20-30 minutes)
- Vegetables that cook in under 20 minutes
- Rice (can be soaked for 30 mins before cooking if needed)
- Tea, coffee, or simple beverages
- Salads that just need chopping
- Papad, pickles, store-bought items
- ANY task that takes less than 30 minutes total

IMPORTANT CONTEXT: Cooks typically visit ONCE in the morning to prepare BOTH breakfast AND lunch together.
Therefore, prep for BOTH tomorrow's breakfast AND tomorrow's lunch must be done TONIGHT.

PREP TIMING (when to start):
- forBreakfast: Prep TONIGHT for tomorrow's breakfast
- forLunch: Prep TONIGHT for tomorrow's lunch
- forDinner: Prep in morning/afternoon for today's dinner

CRITICAL EXCEPTION FOR LAST DAY:
For the FINAL day of this 7-day plan (Day 7):
- DO NOT generate 'forBreakfast' or 'forLunch' prep instructions.
- ONLY generate 'forDinner' instructions if needed.
`;
}

export function buildMealPlanPrompt(preferences: any, learningSummary?: any): string {
  const context = buildSharedGenerationContext(preferences, learningSummary);
  const { season, month, availableVegetables } = getSeasonalContext();

  return `Generate a 7-day ${context.country} meal plan for ${month}.

HOUSEHOLD CONTEXT:
- Location: ${context.country}
- Season: ${season} (${month})
- Available produce: ${availableVegetables}
- Household size: ${context.householdSize} people
- Portion preference: ${context.portionSize}

DIETARY PREFERENCES:
- Diet type: ${context.dietaryType}
- Foods to avoid: ${context.dislikes.join(', ') || 'None'}
- Allergies: ${context.allergies.join(', ') || 'None'}
- Health goals: ${context.healthGoals.join(', ') || 'None'}
- Special instructions: ${context.specialInstructions || 'None'}

COOKING STYLE:
- Complexity: ${context.mealComplexity} - ${buildComplexityInstructions(context.mealComplexity)}
- Cuisine style: ${context.cuisineStyle} - ${buildCuisineInstructions(context.cuisineStyle)}
${buildTiffinInstructions(context)}
${buildNonVegInstructions(context)}
${buildLanguageInstruction(context.language, context.householdSize)}
${buildMealSelectionInstruction(context.mealsToPrepare)}
${context.learningContextText}
${context.kitchenContextText}
${buildPrepAheadInstructions(context.showPrepReminders)}

CRITICAL MEAL FORMATTING - FOLLOW EXACTLY:
Each meal should be formatted as a CLEAN MULTI-LINE list with bullet points AND quantities:
• Main dish (quantity for ${context.householdSize} people)
• Accompaniment 1 (quantity)
• Accompaniment 2 (quantity)
• Side/Salad (quantity)

EXAMPLE WITH QUANTITIES (for household of ${context.householdSize}):
"• Paneer Butter Masala (${Math.round(context.householdSize * 60)}g paneer)
• Jeera Rice (${Math.round(context.householdSize * 0.5)} cups)
• Butter Naan (${context.householdSize * 2} pieces)
• Onion Cucumber Salad"

"• Masala Dosa (${context.householdSize} dosas)
• Sambar (1 bowl)
• Coconut Chutney
• Filter Coffee (${context.householdSize} cups)"

QUANTITY RULES:
1. Include quantity for main ingredients (grams, cups, pieces)
2. Scale quantities appropriately for ${context.householdSize} people with ${context.portionSize} portions
3. For curries: mention protein/vegetable quantity (e.g., "200g chicken", "2 cups mixed veg")
4. For rice: use cups; for rotis: use count
5. Small items like chutney don't need quantities

FORMAT RULES:
1. Start each item with bullet point (•)
2. One item per line
3. 3-5 items per meal
4. Main dish first, then sides
5. Keep item names short and clear
6. NO nested bullets or sub-items

Output 7 days with breakfast, lunch, dinner for each.
Keep meals practical, varied, and seasonally appropriate for ${context.country}.`;
}

export function normalizeGeneratedWeeklyPlan(plan: any, preferences: any) {
  const sanitizedPlan = sanitizeWeeklyPlan(plan);
  return normalizeWeeklyPlanForSelectedMeals(
    sanitizedPlan,
    preferences?.mealsToPrepare,
    preferences?.showPrepReminders !== false
  );
}

export function normalizeGeneratedAlternatives(alternatives: any, preferences: any) {
  const sanitizedAlternatives = sanitizeMealAlternatives(alternatives) || {
    breakfast: [],
    lunch: [],
    dinner: [],
  };

  return normalizeAlternativesForSelectedMeals(sanitizedAlternatives, preferences?.mealsToPrepare);
}
