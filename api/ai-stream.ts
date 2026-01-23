import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

/**
 * Streaming AI Proxy for QookCommander
 * 
 * This Edge function handles streaming meal plan generation using SSE.
 * It uses the FULL prompt (same as ai-proxy.ts) for quality.
 * Also streams thinking tokens for user engagement.
 */

export const config = {
    runtime: 'edge',
    maxDuration: 300, // 5 minutes max for streaming (Pro plan feature, beneficial for Hobby too if supported)
};

// Initialize Supabase admin client
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return createClient(supabaseUrl, supabaseServiceKey);
};

// Get user's tier to determine model
async function getUserTier(userId: string): Promise<string> {
    try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('id', userId)
            .single();
        return data?.subscription_tier || 'free';
    } catch {
        return 'free';
    }
}

// Get household settings from user_settings table
async function getHouseholdSettings(userId: string): Promise<any> {
    try {
        const supabase = getSupabaseAdmin();
        const { data } = await supabase
            .from('user_settings')
            .select('country, household_size, portion_size, pantry_staples, has_tiffin, tiffin_days, tiffin_for, show_prep_reminders, show_quantities, preferred_language')
            .eq('user_id', userId)
            .single();

        if (!data) return null;

        return {
            country: data.country || 'India',
            language: data.preferred_language || 'English',
            householdSize: data.household_size || 4,
            portionSize: data.portion_size || 'regular',
            pantryStaples: data.pantry_staples || [],
            hasTiffin: data.has_tiffin ?? false,
            tiffinDays: data.tiffin_days || [],
            tiffinFor: data.tiffin_for || [],
            showPrepReminders: data.show_prep_reminders ?? true,
            showQuantities: data.show_quantities ?? true,
        };
    } catch {
        return null;
    }
}

// Get seasonal context (SAME as ai-proxy.ts)
const getSeasonalContext = (): { season: string; month: string; availableVegetables: string } => {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const monthNum = now.getMonth();

    let season: string;
    let vegetables: string;

    if (monthNum >= 2 && monthNum <= 4) {
        season = "Spring/Summer (March-May)";
        vegetables = "tomatoes, cucumbers, bottle gourd (lauki), ridge gourd (tori), bitter gourd (karela), okra (bhindi), brinjal, green beans, capsicum, watermelon, mango, muskmelon";
    } else if (monthNum >= 5 && monthNum <= 8) {
        season = "Monsoon/Rainy (June-September)";
        vegetables = "leafy greens (spinach, fenugreek), corn, mushrooms, bottle gourd, snake gourd, ivy gourd (tindora), drumstick, turmeric leaves, colocasia (arbi), yam";
    } else if (monthNum >= 9 && monthNum <= 10) {
        season = "Autumn/Post-Monsoon (October-November)";
        vegetables = "carrots, beetroot, radish, cauliflower, cabbage, peas, beans, broccoli, sweet potato, turnip, pumpkin";
    } else {
        season = "Winter (December-February)";
        vegetables = "cauliflower, cabbage, peas, carrots, radish (mooli), spinach (palak), mustard greens (sarson), fenugreek (methi), green garlic, broccoli, turnip, beetroot, parsnip";
    }

    return { season, month, availableVegetables: vegetables };
};

// Build meal plan prompt (SAME comprehensive prompt as ai-proxy.ts)
function buildMealPlanPrompt(preferences: any, learningSummary?: any) {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const { season, availableVegetables } = getSeasonalContext();

    const isHindi = preferences?.language === 'Hindi';

    const languageInstruction = isHindi ? `
LANGUAGE REQUIREMENT:
- Output ALL meal names in HINDI DEVANAGARI script (हिंदी में)
- Day names MUST be in Hindi: सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार, रविवार
- Write DESCRIPTIVE meal names with quantities like: "पोहा (2 कप) और चाय"
- Include meal descriptions with sides/accompaniments just like English
` : `
LANGUAGE REQUIREMENT:
- Output meal names in English with descriptions
- Day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- Include descriptive meal names with accompaniments and quantities
`;

    const mealsToGenerate = preferences?.mealsToPrepare?.length
        ? preferences.mealsToPrepare
        : ['breakfast', 'lunch', 'dinner'];

    const mealSelectionInstructions = mealsToGenerate.length < 3 ? `
CRITICAL - MEAL SELECTION:
The user ONLY wants these meals: ${mealsToGenerate.join(', ').toUpperCase()}
For meals NOT in this list, you MUST return an empty string "".
${!mealsToGenerate.includes('breakfast') ? '- breakfast: MUST be empty string ""' : ''}
${!mealsToGenerate.includes('lunch') ? '- lunch: MUST be empty string ""' : ''}
${!mealsToGenerate.includes('dinner') ? '- dinner: MUST be empty string ""' : ''}
` : '';

    let learningContext = '';
    if (learningSummary?.totalMealCount > 0) {
        learningContext = `
LEARNED FROM HISTORY (${learningSummary.totalMealCount} meals):
Breakfast patterns: ${learningSummary.acceptedBreakfasts?.slice(0, 8).join(', ') || 'N/A'}
Lunch patterns: ${learningSummary.acceptedLunches?.slice(0, 8).join(', ') || 'N/A'}
Dinner patterns: ${learningSummary.acceptedDinners?.slice(0, 8).join(', ') || 'N/A'}
DO NOT REPEAT: ${learningSummary.recentMeals?.join(', ') || 'N/A'}
`;
    }

    const country = preferences?.country || 'India';
    const householdSize = preferences?.householdSize || 4;
    const portionSize = preferences?.portionSize || 'normal';
    const mealComplexity = preferences?.mealComplexity || 'balanced';
    const cuisineStyle = preferences?.cuisineStyle || 'pan-indian';

    const complexityInstructions = mealComplexity === 'quick'
        ? 'Focus on quick recipes (under 30 mins). Prefer one-pot meals, minimal ingredients.'
        : mealComplexity === 'elaborate'
            ? 'Include elaborate recipes with multiple components. Traditional multi-dish thalis are welcome.'
            : 'Mix of quick and elaborate meals. Weekdays simpler, weekends can be elaborate.';

    const cuisineInstructions = cuisineStyle === 'regional'
        ? 'Focus on authentic regional recipes from the user\'s area. Traditional preparations.'
        : cuisineStyle === 'fusion'
            ? 'Include fusion dishes, Indo-Chinese, international flavors adapted for Indian palate.'
            : 'Pan-Indian variety - mix of North, South, East, West Indian cuisines.';

    let tiffinInstructions = '';
    if (preferences?.hasTiffin && preferences?.tiffinDays?.length > 0) {
        tiffinInstructions = `
TIFFIN/PACKED LUNCH REQUIREMENT:
On these days: ${preferences.tiffinDays.join(', ')}
For: ${preferences.tiffinFor?.join(', ') || 'office/school'}
- Make lunch items that travel well (no soup, no items that get soggy)
- Prefer dry rotis, parathas, rice dishes, sandwiches, dry curries
`;
    }

    let nonVegInstructions = '';
    if (preferences?.nonVegPreferences?.length > 0 && preferences?.dietaryType !== 'Vegetarian') {
        const freq = preferences.nonVegFrequency || '1-2x/week';
        nonVegInstructions = `
NON-VEG PREFERENCES:
Preferred proteins: ${preferences.nonVegPreferences.join(', ')}
Frequency: ${freq}
${freq === 'daily' ? 'Include non-veg in at least one meal every day.' : ''}
${freq === '3-4x/week' ? 'Include non-veg 3-4 times across the week.' : ''}
${freq === '1-2x/week' ? 'Include non-veg 1-2 times across the week.' : ''}
${freq === 'weekends' ? 'Include non-veg ONLY on Saturday and Sunday.' : ''}
`;
    }

    const prepAheadInstruction = preferences?.showPrepReminders !== false ? `
PREP-AHEAD ANALYSIS (BE SELECTIVE - ONLY TRULY NECESSARY PREP):
For each day, analyze if any meal REQUIRES advance preparation that takes 30+ minutes or needs overnight time.

MANDATORY PREP TASKS - these MUST be mentioned if the dish is included:
- LEGUMES (8-12 hours soaking): Chole, Rajma, Chana, Lobia, Kabuli Chana, Dried Peas, etc.
- DAL (2-4 hours soaking): Whole urad dal, Chana dal, Moong sabut (NOT regular moong/masoor), etc.
- BATTER (6-8 hours fermentation): Idli, Dosa, Uttapam, Appam, Dhokla, etc.
- DAHI/CURD: Only if recipe needs HOMEMADE curd (store-bought is instant)
- MEAT MARINATION: Chicken tikka, tandoori, kebabs, biryani (2+ hours), etc.
- PANEER MARINATION: Paneer tikka, grilled paneer (1+ hour), etc.
- POTATOES (only if needs cooling): Aloo paratha, aloo tikki (need boiled & cooled potatoes), etc.
- SPROUTING: Moong sprouts, matki sprouts (12-24 hours), etc.

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
Therefore, prep for BOTH tomorrow's breakfast AND tomorrow's lunch must be done TONIGHT!

PREP TIMING (when to start):
- forBreakfast: Prep TONIGHT for tomorrow's breakfast
  (e.g., "Prepare idli batter tonight" if tomorrow has idli)
- forLunch: Prep TONIGHT for tomorrow's lunch (since cook comes in morning!)
  (e.g., "Soak chole overnight" if tomorrow has chole for lunch)
- forDinner: Prep in morning/afternoon for today's dinner
  (e.g., "Marinate chicken in the morning" for dinner tikka)

EXAMPLE PREP REMINDERS:
- Tomorrow has Chole Bhature for LUNCH → forLunch: "Soak 2 cups chole overnight"
- Tomorrow has Rajma Chawal for LUNCH → forLunch: "Soak rajma overnight"
- Tomorrow has Idli for BREAKFAST → forBreakfast: "Prepare idli batter tonight"
- Tomorrow has Aloo Paratha for BREAKFAST → forBreakfast: "Boil 4 potatoes tonight (need to cool)"
- Today has Chicken Tikka for DINNER → forDinner: "Marinate chicken in the morning"

WRONG (do NOT include these):
- "Boil eggs tonight" ❌ (eggs take 10 mins, do in morning)
- "Chop vegetables" ❌ (quick task, do while cooking)
- "Prepare salad" ❌ (takes 5 minutes)

BE SELECTIVE: Only include prep that genuinely saves morning time or CANNOT be done quickly.
If a day has no dishes requiring overnight/long prep, leave prepAhead fields empty or null.

CRITICAL EXCEPTION FOR LAST DAY:
For the FINAL day of this 7-day plan (Day 7):
- DO NOT generate 'forBreakfast' or 'forLunch' prep instructions (as these are for Day 8, which is unknown).
- ONLY generate 'forDinner' instructions if needed (as this is for Day 7 itself).
` : '';

    return `Generate a 7-day ${country} meal plan for ${month}.

HOUSEHOLD CONTEXT:
- Location: ${country}
- Season: ${season} (${month})
- Available produce: ${availableVegetables}
- Household size: ${householdSize} people
- Portion preference: ${portionSize}

DIETARY PREFERENCES:
- Diet type: ${preferences?.dietaryType || 'Vegetarian'}
- Foods to avoid: ${preferences?.dislikes?.join(', ') || 'None'}
- Allergies: ${preferences?.allergies?.join(', ') || 'None'}
- Health goals: ${preferences?.healthGoals?.join(', ') || 'None'}

COOKING STYLE:
- Complexity: ${mealComplexity} - ${complexityInstructions}
- Cuisine style: ${cuisineStyle} - ${cuisineInstructions}
${tiffinInstructions}
${nonVegInstructions}
${languageInstruction}
${mealSelectionInstructions}
${learningContext}
${prepAheadInstruction}

CRITICAL MEAL FORMATTING - FOLLOW EXACTLY:
Each meal should be formatted as a CLEAN MULTI-LINE list with bullet points AND quantities:
• Main dish (quantity for ${householdSize} people)
• Accompaniment 1 (quantity)
• Accompaniment 2 (quantity)
• Side/Salad (quantity)

EXAMPLE WITH QUANTITIES (for household of ${householdSize}):
"• Paneer Butter Masala (${Math.round(householdSize * 60)}g paneer)
• Jeera Rice (${Math.round(householdSize * 0.5)} cups)
• Butter Naan (${householdSize * 2} pieces)
• Onion Cucumber Salad"

"• Masala Dosa (${householdSize} dosas)
• Sambar (1 bowl)
• Coconut Chutney
• Filter Coffee (${householdSize} cups)"

QUANTITY RULES:
1. Include quantity for main ingredients (grams, cups, pieces)
2. Scale quantities appropriately for ${householdSize} people with ${portionSize} portions
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
Keep meals practical, varied, and seasonally appropriate for ${country}.`;
}

export default async function handler(req: Request) {
    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    const encoder = new TextEncoder();

    try {
        const body = await req.json();
        const { userId, preferences, learningSummary, userApiKey } = body;

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const supabase = getSupabaseAdmin();

        // =====================================================
        // CREDIT VALIDATION - Check if user can generate
        // =====================================================

        // Get all user credits
        const { data: creditRows, error: creditsError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId);

        // Filter expired credits
        const now = new Date();
        const validCredits = creditRows?.filter(row => {
            if (!row.expires_at) return true;
            const expiry = new Date(row.expires_at);
            return expiry > now;
        }) || [];

        // Sum up meal credits
        const totalMealCredits = validCredits.reduce((sum, row) => sum + (row.meal_credits || 0), 0);

        // Check subscription for BYOK status
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('plan_id, billing_preference')
            .eq('user_id', userId)
            .single();

        const userWantsByok = subscription?.billing_preference === 'byok';
        const isPlanByok = subscription?.plan_id === 'byok';
        const isByok = (isPlanByok || userWantsByok) && userApiKey;

        // If not BYOK, check credits
        if (!isByok) {
            if (totalMealCredits < 1) {
                return new Response(JSON.stringify({
                    error: 'Insufficient credits',
                    required: 1,
                    available: totalMealCredits,
                    creditType: 'meal_generation'
                }), {
                    status: 402,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        const geminiApiKey = userApiKey || process.env.GEMINI_API_KEY || '';
        if (!geminiApiKey) {
            return new Response(JSON.stringify({ error: 'No API key configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // =====================================================
        // CONSUME CREDITS (if not BYOK)
        // =====================================================
        if (!isByok && validCredits.length > 0) {
            // Sort credits so FREE credits are consumed FIRST
            const creditTypePriority: Record<string, number> = {
                'bonus': 0,      // Weekly bonuses - use first
                'trial': 1,      // Trial credits - use second
                'pack': 2,       // Purchased credits - use last
            };
            validCredits.sort((a, b) => {
                const priorityA = creditTypePriority[a.credit_type] ?? 1;
                const priorityB = creditTypePriority[b.credit_type] ?? 1;
                return priorityA - priorityB;
            });

            // Deduct 1 meal credit from first available row
            for (const row of validCredits) {
                const available = row.meal_credits || 0;
                if (available > 0) {
                    const { error: updateError } = await supabase
                        .from('user_credits')
                        .update({ meal_credits: available - 1 })
                        .eq('id', row.id);

                    if (updateError) {
                        console.error('Credit consumption error:', updateError);
                    } else {
                        console.log(`Consumed 1 meal credit from row ${row.id} (was ${available}, now ${available - 1})`);
                    }
                    break;
                }
            }

            // Track usage
            try {
                await supabase.from('usage_tracking').insert({
                    user_id: userId,
                    action_type: 'meal_generation',
                    credits_used: 1,
                    backend_credit_cost: 0,
                    api_source: 'platform'
                });
            } catch (e) {
                console.error('Usage tracking error:', e);
            }
        } else if (isByok) {
            // BYOK users: unlimited usage, just track
            try {
                await supabase.from('usage_tracking').insert({
                    user_id: userId,
                    action_type: 'meal_generation',
                    credits_used: 0,
                    backend_credit_cost: 0,
                    api_source: 'byok'
                });
            } catch (e) {
                console.error('BYOK usage tracking error:', e);
            }
        }

        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const tier = await getUserTier(userId);
        const isPro = tier === 'pro' || tier === 'enterprise';
        const model = isPro ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

        // Fetch household settings and merge with profile preferences
        // Household settings take priority for global settings
        const householdSettings = await getHouseholdSettings(userId);
        const mergedPreferences = {
            ...preferences,
            // Household settings override profile settings where applicable
            ...(householdSettings ? {
                country: householdSettings.country,
                language: householdSettings.language,
                householdSize: householdSettings.householdSize,
                portionSize: householdSettings.portionSize,
                pantryStaples: householdSettings.pantryStaples,
                hasTiffin: householdSettings.hasTiffin,
                tiffinDays: householdSettings.tiffinDays,
                tiffinFor: householdSettings.tiffinFor,
                showPrepReminders: householdSettings.showPrepReminders,
            } : {})
        };

        // Build the FULL comprehensive prompt with merged preferences
        const prompt = buildMealPlanPrompt(mergedPreferences, learningSummary);

        // Schema for structured output
        const schema = {
            type: Type.OBJECT,
            properties: {
                days: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            day: { type: Type.STRING },
                            breakfast: { type: Type.STRING },
                            lunch: { type: Type.STRING },
                            dinner: { type: Type.STRING },
                            prepAhead: {
                                type: Type.OBJECT,
                                properties: {
                                    forBreakfast: { type: Type.STRING },
                                    forLunch: { type: Type.STRING },
                                    forDinner: { type: Type.STRING },
                                },
                                nullable: true
                            },
                        },
                        required: ["day", "breakfast", "lunch", "dinner"],
                    },
                },
            },
            required: ["days"],
        };

        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        (async () => {
            try {
                // Send initial event
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'start', message: 'Generating meal plan...' })}\n\n`));

                // Call Gemini with streaming AND thinking enabled
                const response = await ai.models.generateContentStream({
                    model,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        temperature: 0.8,
                        // Enable thinking for better quality
                        thinkingConfig: {
                            thinkingLevel: ThinkingLevel.MEDIUM,
                            includeThoughts: true
                        }
                    }
                });

                let fullText = '';
                let lastDayCount = 0;
                let thinkingProgress = [
                    "Analyzing your preferences...",
                    "Considering seasonal vegetables...",
                    "Planning variety across the week...",
                    "Balancing nutrition and taste...",
                    "Calculating portions for your household...",
                    "Adding prep-ahead reminders...",
                    "Finalizing your personalized menu..."
                ];
                let thinkingIndex = 0;

                for await (const chunk of response) {
                    // Check for thinking content
                    if (chunk.candidates?.[0]?.content?.parts) {
                        for (const part of chunk.candidates[0].content.parts) {
                            // If this is a thought part, stream it
                            if (part.thought && thinkingIndex < thinkingProgress.length) {
                                await writer.write(encoder.encode(`data: ${JSON.stringify({
                                    type: 'thinking',
                                    message: thinkingProgress[thinkingIndex]
                                })}\n\n`));
                                thinkingIndex++;
                            }
                        }
                    }

                    const text = chunk.text || '';
                    fullText += text;

                    // Count days from raw JSON
                    const dayMatches = fullText.match(/"day"\s*:\s*"[^"]+"/g) || [];
                    const currentDayCount = dayMatches.length;

                    if (currentDayCount > lastDayCount) {
                        lastDayCount = currentDayCount;
                        await writer.write(encoder.encode(`data: ${JSON.stringify({
                            type: 'progress',
                            day: currentDayCount,
                            message: `Planning ${dayNames[Math.min(currentDayCount, 6)]}...`
                        })}\n\n`));
                    }

                    // Send chunk for progressive display
                    if (text) {
                        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`));
                    }
                }

                // Parse final result
                try {
                    const result = JSON.parse(fullText);
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`));
                } catch (parseError) {
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to parse response' })}\n\n`));
                }
            } catch (error: any) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Generation failed' })}\n\n`));
            } finally {
                await writer.close();
            }
        })();

        return new Response(stream.readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'X-Accel-Buffering': 'no', // Critical for Vercel to not buffer SSE
            },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
