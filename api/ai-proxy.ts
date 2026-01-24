import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side AI Proxy for QookCommander
 * 
 * This endpoint handles all Gemini API requests securely:
 * 1. Validates user authentication via Supabase
 * 2. Checks credit balance before processing
 * 3. Consumes credits on successful generation
 * 4. Keeps API key secure (never exposed to client)
 * 
 * Supported actions:
 * - generate_plan: Generate weekly meal plan
 * - regenerate_meal: Regenerate single meal
 * - smart_edit: Edit meals with AI
 * - generate_grocery: Generate grocery list
 * - parse_preferences: Parse text to preferences
 * - validate_key: Validate user's BYOK key
 */

// Frontend credit costs (visible to user) - only meal generation costs
const FRONTEND_CREDIT_COSTS: Record<string, { type: string; cost: number }> = {
    generate_plan: { type: 'meal_generation', cost: 1 },
    regenerate_meal: { type: 'single_regen', cost: 0 },      // FREE to user
    smart_edit: { type: 'smart_edit', cost: 0 },             // FREE to user
    generate_grocery: { type: 'grocery_generation', cost: 0 }, // FREE to user
    generate_alternatives: { type: 'single_regen', cost: 0 },  // FREE to user
    translate_content: { type: 'smart_edit', cost: 0 },
    learning_suggestions: { type: 'smart_edit', cost: 0 },
    optimize_preferences: { type: 'smart_edit', cost: 0 },
    parse_preferences: { type: 'smart_edit', cost: 0 },
    validate_key: { type: 'smart_edit', cost: 0 },
};

// Backend credit costs - DISABLED (all features now free except meal generation)
// All backend tracking disabled as per user request
const BACKEND_CREDIT_COSTS: Record<string, number> = {
    generate_plan: 0,             // Only frontend credits matter
    regenerate_meal: 0,
    smart_edit: 0,
    generate_grocery: 0,
    generate_alternatives: 0,
    translate_content: 0,
    learning_suggestions: 0,
    optimize_preferences: 0,
    parse_preferences: 0,
    validate_key: 0,
};

// Keep old name for compatibility
const CREDIT_COSTS = FRONTEND_CREDIT_COSTS;

export default async function handler(req: any, res: any) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, userId, payload, userApiKey } = req.body;

    if (!action || !userId) {
        return res.status(400).json({ error: 'Missing action or userId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Get all user credits (don't filter by expires_at - some might be null or format mismatch)
        const { data: creditRows, error: creditsError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId);

        // Debug logging
        console.log('Credit query for userId:', userId);
        console.log('Credit rows found:', creditRows?.length || 0);
        if (creditsError) {
            console.log('Credit query error:', creditsError);
        }

        // Filter expired credits in code (more reliable than DB date comparison)
        const now = new Date();
        const validCredits = creditRows?.filter(row => {
            if (!row.expires_at) return true; // No expiry = valid
            const expiry = new Date(row.expires_at);
            return expiry > now;
        }) || [];

        // Sort credits so FREE credits are consumed FIRST
        // Priority: bonus -> trial -> pack (purchased credits last)
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

        console.log('Valid (non-expired) credits sorted by priority:', validCredits.length);

        // Sum up credits from all valid rows
        let credits: any = null;
        if (validCredits.length > 0) {
            credits = {
                total_meal_credits: validCredits.reduce((sum, row) => sum + (row.meal_credits || 0), 0),
                total_grocery_credits: validCredits.reduce((sum, row) => sum + (row.grocery_credits || 0), 0),
                total_edit_credits: validCredits.reduce((sum, row) => sum + (row.edit_credits || 0), 0),
                total_regen_credits: validCredits.reduce((sum, row) => sum + (row.regen_credits || 0), 0),
                byok_enabled: false
            };
            console.log('Aggregated credits:', credits);
        } else {
            console.log('No valid credit rows found for user');
        }

        // Also check subscription for BYOK status and user preference
        const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('plan_id, billing_preference')
            .eq('user_id', userId)
            .single();

        // BYOK flag logic:
        // 1. If plan is 'byok', user MUST use their own key
        // 2. If user has a key AND billing_preference = 'byok', use their key
        // 3. Otherwise use platform credits
        const userWantsByok = subscription?.billing_preference === 'byok';
        const isPlanByok = subscription?.plan_id === 'byok';

        if (isPlanByok || userWantsByok) {
            if (credits) credits.byok_enabled = true;
        }

        if (creditsError && creditsError.code !== 'PGRST116') {
            console.error('Credits check error:', creditsError);
        }

        // 2. Determine which API key to use
        let apiKeyToUse = '';
        let isByok = false;

        // Check if user provided their own key (BYOK) and wants to use it
        if (userApiKey && (credits?.byok_enabled || userWantsByok)) {
            apiKeyToUse = userApiKey;
            isByok = true;
        } else {
            // Use platform key - but check credits first
            const creditConfig = CREDIT_COSTS[action as keyof typeof CREDIT_COSTS];

            if (!creditConfig) {
                return res.status(400).json({ error: 'Invalid action' });
            }

            // Check if user has enough frontend credits (only for meal generation)
            const { type, cost } = creditConfig;

            if (cost > 0) {
                const availableCredits = credits?.total_meal_credits ?? 0;

                if (availableCredits < cost) {
                    return res.status(402).json({
                        error: 'Insufficient credits',
                        required: cost,
                        available: availableCredits,
                        creditType: 'meal_generation'
                    });
                }
            }

            // Backend credit checks DISABLED - all AI features are free except meal generation\n            // (which is handled by frontend credits above)

            // Use platform API key from environment
            const platformKey = process.env.GEMINI_API_KEY;
            if (!platformKey) {
                return res.status(500).json({ error: 'Platform API key not configured' });
            }
            apiKeyToUse = platformKey;
        }

        // Determine if user is on Pro tier (for model selection and alternatives count)
        const isPro = subscription?.plan_id === 'pro';

        // 3. Execute the AI action
        const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
        let result;

        switch (action) {
            case 'generate_plan':
                result = await executeGeneratePlan(ai, payload, isPro);
                break;
            case 'regenerate_meal':
                result = await executeRegenerateMeal(ai, payload, isPro);
                break;
            case 'smart_edit':
                result = await executeSmartEdit(ai, payload);
                break;
            case 'generate_grocery':
                result = await executeGenerateGrocery(ai, payload);
                break;
            case 'parse_preferences':
                result = await executeParsePreferences(ai, payload);
                break;
            case 'validate_key':
                result = await executeValidateKey(ai);
                break;
            case 'generate_alternatives':
                result = await executeGenerateAlternatives(ai, payload, isPro);
                break;
            case 'translate_content':
                result = await executeTranslateContent(ai, payload);
                break;
            case 'learning_suggestions':
                result = await executeGetLearningSuggestions(ai, payload);
                break;
            case 'optimize_preferences':
                result = await executeOptimizePreferences(ai, payload);
                break;
            default:
                return res.status(400).json({ error: 'Unknown action' });
        }

        // 4. Consume credits if using platform key
        if (!isByok && validCredits && validCredits.length > 0) {
            const creditConfig = CREDIT_COSTS[action as keyof typeof CREDIT_COSTS];

            // Only deduct frontend credits for meal generation (cost > 0)
            if (creditConfig.cost > 0) {
                // Find first row with available meal credits and deduct
                let creditsToDeduct = creditConfig.cost;
                for (const row of validCredits) {
                    if (creditsToDeduct <= 0) break;
                    const available = row.meal_credits || 0;
                    if (available > 0) {
                        const deduct = Math.min(available, creditsToDeduct);
                        const newValue = available - deduct;

                        const { error: updateError } = await supabase
                            .from('user_credits')
                            .update({ meal_credits: newValue })
                            .eq('id', row.id);

                        if (updateError) {
                            console.error('Credit consumption error:', updateError);
                        } else {
                            creditsToDeduct -= deduct;
                        }
                    }
                }
            }

            // Backend credit consumption DISABLED

            // Track usage (backend cost is always 0 now)
            try {
                await supabase.from('usage_tracking').insert({
                    user_id: userId,
                    action_type: creditConfig.type || action,
                    credits_used: creditConfig.cost,
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
                    action_type: CREDIT_COSTS[action as keyof typeof CREDIT_COSTS]?.type || action,
                    credits_used: 0,
                    backend_credit_cost: 0,
                    api_source: 'byok'
                });
            } catch (e) {
                console.error('BYOK usage tracking error:', e);
            }
        }

        return res.status(200).json({ success: true, data: result });

    } catch (error: any) {
        console.error('AI Proxy error:', error);

        // Handle Gemini API errors specifically
        if (error?.message?.includes('API key') || error?.status === 401 || error?.status === 403) {
            return res.status(401).json({ error: 'Invalid API key', details: error.message });
        }

        return res.status(500).json({ error: 'AI generation failed', details: error.message });
    }
}

// =====================================================
// AI Action Implementations
// =====================================================

// ==========================================
// Helper: Seasonal Context
// ==========================================
const getSeasonalContext = (): { season: string; month: string; availableVegetables: string } => {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const monthNum = now.getMonth();

    let season: string;
    let vegetables: string;

    // Northern hemisphere seasons (adjust for India's climate)
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

async function executeGeneratePlan(ai: GoogleGenAI, payload: any, isPro: boolean = false) {
    const { preferences, learningSummary } = payload;

    // Pro users get the better model
    const model = isPro ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

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
                            description: "Overnight prep reminders for the next day's meals",
                            properties: {
                                forBreakfast: { type: Type.STRING, description: "Prep needed tonight for tomorrow's breakfast (e.g., soak idli batter)" },
                                forLunch: { type: Type.STRING, description: "Prep needed in morning for today's lunch (e.g., soak rajma)" },
                                forDinner: { type: Type.STRING, description: "Prep needed at lunch for today's dinner (e.g., marinate chicken)" },
                            },
                            nullable: true
                        },
                    },
                    required: ["day", "breakfast", "lunch", "dinner", "prepAhead"],
                },
            },
            alternatives: {
                type: Type.OBJECT,
                properties: {
                    breakfast: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lunch: { type: Type.ARRAY, items: { type: Type.STRING } },
                    dinner: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["breakfast", "lunch", "dinner"],
            },
        },
        required: ["days"],
    };

    const prompt = buildMealPlanPrompt(preferences, learningSummary);

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.8,
        }
    });

    return JSON.parse(response.text || '{}');
}

async function executeRegenerateMeal(ai: GoogleGenAI, payload: any, isPro: boolean = false) {
    const { currentMeal, mealType, preferences, dayName, existingMeals = [] } = payload;
    const { season, availableVegetables } = getSeasonalContext();

    // Pro users get the better model
    const model = isPro ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

    const isHindi = preferences.language === 'Hindi';
    const languageInstruction = isHindi
        ? `
        CRITICAL LANGUAGE REQUIREMENT:
        - Output the new meal in HINDI DEVANAGARI SCRIPT (हिंदी में)
        - If current meal is in Hindi, keep it in Hindi
        - Example format: "पनीर भुर्जी पराठे के साथ", "दाल तड़का चावल के साथ"
        - Include accompaniments in Hindi like "के साथ" (with), "और" (and)
        - DO NOT output in English
        `
        : `
        LANGUAGE REQUIREMENT:
        - Output the meal name in English
        - Include accompaniments like "with roti", "served with raita"
        `;

    const prompt = `Regenerate the ${mealType} for ${dayName}.
    Current meal to replace: ${currentMeal}
    
    Preferences:
    Dietary: ${preferences.dietaryType}
    Must avoid: ${preferences.dislikes?.join(', ') || 'None'}
    Allergies: ${preferences.allergies?.join(', ') || 'None'}
    
    Current Season: ${season}
    Available Vegetables: ${availableVegetables}
    
    IMPORTANT: Do NOT suggest any of these already planned meals (avoid duplicates):
    ${existingMeals.join(', ') || 'None'}
    
    FORMAT MATCHING - CRITICAL:
    - Study the current meal format: "${currentMeal}"
    - Match the SAME structural pattern (length, detail level, accompaniments style)
    - If the current meal is simple like "Poha", output a simple format like "Upma" 
    - If the current meal has accompaniments like "Dal Chawal with Salad", include similar accompaniments
    - If the current meal has NO roti/bread, do NOT add roti/bread to the new meal
    - If it's ${mealType === 'breakfast' ? 'a breakfast, avoid adding heavy items like rice/roti unless the original has it' : mealType === 'lunch' ? 'lunch, typically includes rice or roti but stick to actual pattern of original meal' : 'dinner, can be lighter than lunch  but stick to actual pattern of original meal'}
    
    ${languageInstruction}
    
    Output ONLY the name/description of the new meal as a plain string. Match the format of the original.`;

    // Use fast model with minimal thinking for fast single meal regeneration
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            temperature: 0.9,  // Higher temperature for variety
            maxOutputTokens: 1000,  // Enough for detailed meal description
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }  // Minimal thinking for speed
        }
    });

    return { meal: response.text?.trim() || currentMeal };
}

async function executeSmartEdit(ai: GoogleGenAI, payload: any) {
    const { currentMeals, instruction, mealTypes, preferences } = payload;

    // Get seasonal context for relevant suggestions
    const { season, availableVegetables } = getSeasonalContext();

    const isHindi = preferences?.language === 'Hindi';
    const languageInstruction = isHindi
        ? `
        CRITICAL LANGUAGE REQUIREMENT:
    - All new/edited meals MUST be in HINDI DEVANAGARI SCRIPT (हिंदी में)
        - Example: "पनीर भुर्जी पराठे के साथ", "दाल तड़का चावल के साथ"
            - DO NOT output in English
                `
        : `
        LANGUAGE REQUIREMENT:
    - Output all meals in English with full descriptions
        `;

    // Schema using explicit properties for each meal type (additionalProperties not well-supported)
    const schema = {
        type: Type.OBJECT,
        properties: {
            breakfast: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 breakfast options if breakfast was requested",
                nullable: true
            },
            lunch: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 lunch options if lunch was requested",
                nullable: true
            },
            dinner: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 dinner options if dinner was requested",
                nullable: true
            }
        }
    };

    // Build comprehensive context
    const householdSize = preferences?.householdSize || 4;
    const portionSize = preferences?.portionSize || 'regular';
    const cuisineStyle = preferences?.cuisineStyle || 'pan-indian';
    const mealComplexity = preferences?.mealComplexity || 'balanced';
    const country = preferences?.country || 'India';

    const prompt = `Edit the meal plan based on this instruction: "${instruction}"
    
    Target Meals to Edit: ${mealTypes.join(", ")}
    
    Current Meals:
    ${Object.entries(currentMeals).map(([k, v]) => `${k}: ${v}`).join('\n')}
    
    USER CONTEXT:
    - Country: ${country}
    - Season: ${season}
    - Seasonal Vegetables: ${availableVegetables}
    - Household Size: ${householdSize} people
    - Portion Preference: ${portionSize}
    - Cuisine Style: ${cuisineStyle}
    - Meal Complexity: ${mealComplexity}
    
    DIETARY REQUIREMENTS (VERY IMPORTANT):
    - Diet Type: ${preferences?.dietaryType || 'Standard'}
    - Foods to AVOID: ${preferences?.dislikes?.join(", ") || 'None'}
    - ALLERGIES (DO NOT INCLUDE): ${preferences?.allergies?.join(", ") || 'None'}
    - Health Goals: ${preferences?.healthGoals?.join(", ") || 'None'}
    - Special Instructions: ${preferences?.specialInstructions || 'None'}
    
    ${languageInstruction}
    
    FORMAT MATCHING - CRITICAL:
    - Study each current meal's format and style
    - Match the SAME structural pattern (length, detail level, accompaniments)
    - Include quantities scaled for ${householdSize} people with ${portionSize} portions
    - For breakfast: Keep it light unless original has rice/roti
    - If original is simple like "Poha", keep options simple like "Upma"
    - If original has sides, include similar accompaniments
    
    EXAMPLE FORMAT (for household of ${householdSize}):
    "• Main Dish (quantity)
    • Side 1 (quantity)
    • Side 2
    • Beverage/Salad"
    
    IMPORTANT: Provide EXACTLY 3 different options for EACH requested meal type.
    Only include the meal types that were requested: ${mealTypes.join(", ")}.
    Each option should match the FORMAT of the original meal while applying the change.
    Use seasonal ingredients when possible: ${availableVegetables}
    
    Return JSON with meal type keys (breakfast, lunch, dinner) each containing an array of 3 meal strings.
    Only include the meal types that were requested in the target meals.
    Example for lunch only: { "lunch": ["Option 1", "Option 2", "Option 3"] }`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.8
        }
    });

    // Wrap the response in options key for backward compatibility with frontend
    const rawResult = JSON.parse(response.text || '{}');
    return { options: rawResult };
}

async function executeGenerateGrocery(ai: GoogleGenAI, payload: any) {
    const { meals, preferences } = payload;

    const schema = {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        item: { type: Type.STRING },
                        quantity: { type: Type.STRING },
                        category: { type: Type.STRING },
                        forDays: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Days this item is needed for" },
                        forMeals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Meal names this item is used in" },
                    },
                    required: ["item", "quantity", "category"],
                },
            },
        },
        required: ["items"],
    };

    // Build day-by-day breakdown
    const dayBreakdown = meals.map((m: any) => {
        const day = m.day || m.date;
        return `${day}:
  - Breakfast: ${m.breakfast}
  - Lunch: ${m.lunch}
  - Dinner: ${m.dinner}`;
    }).join('\n\n');

    const householdSize = preferences.householdSize || 4;
    const portionSize = preferences.portionSize || 'regular';

    const prompt = `Generate a grocery list for the following weekly meal plan.

STEP 1: For EACH day, identify ALL ingredients needed with exact quantities for ${householdSize} people.

MEAL PLAN BY DAY:
${dayBreakdown}

STEP 2: Combine duplicate items across all days, summing their quantities.

STEP 3: For each final item, track which days and meals it's for.

HOUSEHOLD CONTEXT:
- Household size: ${householdSize} people
- Portion preference: ${portionSize} (${portionSize === 'light' ? 'reduce by 20%' : portionSize === 'hearty' ? 'increase by 30%' : 'standard'})

ITEMS TO EXCLUDE (already in pantry):
${preferences.pantryStaples?.join(', ') || 'Basic spices, salt, oil, water'}

INSTRUCTIONS:
1. Be CONSISTENT - same meal should always need same base ingredients
2. Include forDays (e.g., ["Monday", "Wednesday"]) and forMeals (e.g., ["Dal Tadka", "Poha"])
3. Round to practical shopping amounts (500g, 1kg, 1 dozen, 1 bunch)
4. Categories: Vegetables, Fruits, Dairy, Grains & Pulses, Proteins, Spices, Oils & Condiments, Other

Output a consolidated grocery list with day/meal tracking.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.3, // Lower temperature for more consistency
        }
    });

    const result = JSON.parse(response.text || '{"items":[]}');
    return result.items.map((item: any) => ({
        ...item,
        checked: false,
        forDays: item.forDays || [],
        forMeals: item.forMeals || []
    }));
}

async function executeParsePreferences(ai: GoogleGenAI, payload: any) {
    const { text } = payload;

    const schema = {
        type: Type.OBJECT,
        properties: {
            dietaryType: { type: Type.STRING },
            dislikes: { type: Type.ARRAY, items: { type: Type.STRING } },
            allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
            breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            specialInstructions: { type: Type.STRING },
        },
        required: [],
    };

    const prompt = `Extract meal preferences from this text:
    "${text}"

Return structured preferences including dietary type, dislikes, allergies, meal preferences, and any special instructions.`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.3,
        }
    });

    return JSON.parse(response.text || '{}');
}

async function executeValidateKey(ai: GoogleGenAI) {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Say 'OK'",
        config: { maxOutputTokens: 10 }
    });

    return { valid: true, response: response.text };
}

async function executeGenerateAlternatives(ai: GoogleGenAI, payload: any, isPro: boolean = false) {
    const { preferences, currentPlan } = payload;
    const country = preferences?.country || 'India';
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const isHindi = preferences?.language === 'Hindi';

    // Pro users get better model and more alternatives
    const model = isPro ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
    const alternativesCount = isPro ? 10 : 5;

    const schema = {
        type: Type.OBJECT,
        properties: {
            breakfast: { type: Type.ARRAY, items: { type: Type.STRING } },
            lunch: { type: Type.ARRAY, items: { type: Type.STRING } },
            dinner: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["breakfast", "lunch", "dinner"],
    };

    // Build a list of current meals to avoid repetition
    const existingMeals: string[] = [];
    if (currentPlan?.days) {
        currentPlan.days.forEach((day: any) => {
            if (day.breakfast) existingMeals.push(day.breakfast);
            if (day.lunch) existingMeals.push(day.lunch);
            if (day.dinner) existingMeals.push(day.dinner);
        });
    }

    const languageInstruction = isHindi
        ? 'Output ALL meal names in HINDI DEVANAGARI script.'
        : 'Output meal names in English with descriptive accompaniments.';

    const prompt = `Generate ${alternativesCount} unique meal alternatives for each of breakfast, lunch, and dinner.

        LOCATION: ${country}
    SEASON: ${month} (Use seasonal ingredients available in ${country} now)
    DIETARY: ${preferences?.dietaryType || 'Vegetarian'}
    DISLIKES: ${preferences?.dislikes?.join(', ') || 'None'}
    ALLERGIES: ${preferences?.allergies?.join(', ') || 'None'}
SPECIAL INSTRUCTIONS: ${preferences?.specialInstructions || 'None'}
${languageInstruction}

DO NOT REPEAT these meals which are already in the plan:
${existingMeals.slice(0, 21).join(', ') || 'None'}

CRITICAL MEAL FORMATTING - EACH ALTERNATIVE MUST USE THIS FORMAT:
Each meal should be a CLEAN MULTI-LINE list with bullet points (•):
"• Main Dish (quantity for ${preferences?.householdSize || 4} people)
• Side 1 (quantity)
• Side 2 (quantity)
• Beverage or Salad"

EXAMPLE with quantities:
"• Masala Dosa (${preferences?.householdSize || 4} pieces)
• Sambar (1 bowl)
• Coconut Chutney (100g)
• Filter Coffee (${preferences?.householdSize || 4} cups)"

RULES:
1. Start each item with • bullet
2. One item per line with quantity in parentheses
3. 3-5 items per meal
4. ALWAYS include quantities for household of ${preferences?.householdSize || 4} people
5. Combine salad ingredients: "Onion Cucumber Salad (1 bowl)" NOT separate items

Generate ${alternativesCount} unique, varied, practical, and delicious alternatives per category.
All meals must be appropriate for ${country} cuisine, include quantities, and respect all dietary preferences.`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.8,
        }
    });

    return JSON.parse(response.text || '{"breakfast":[],"lunch":[],"dinner":[]}');
}

// =====================================================
// Helper Functions
// =====================================================

function buildMealPlanPrompt(preferences: any, learningSummary?: any) {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const { season, availableVegetables } = getSeasonalContext();

    // Check if Hindi output is requested
    const isHindi = preferences.language === 'Hindi';

    // Build language instruction
    const languageInstruction = isHindi ? `
LANGUAGE REQUIREMENT:
- Output ALL meal names in HINDI DEVANAGARI script (हिंदी में)
- Day names MUST be in Hindi: सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार, रविवार
- Write DESCRIPTIVE meal names with quantities like: "पोहा (2 कप) और चाय"
- Include meal descriptions with sides/accompaniments just like English
- IMPORTANT: Hindi output should be EQUALLY DETAILED as English
` : `
LANGUAGE REQUIREMENT:
- Output meal names in English with descriptions
- Day names: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- Include descriptive meal names with accompaniments and quantities
`;

    // Determine which meals to generate
    const mealsToGenerate = preferences.mealsToPrepare?.length
        ? preferences.mealsToPrepare
        : ['breakfast', 'lunch', 'dinner'];

    // Build meal selection instructions if not all meals selected
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

    const country = preferences.country || 'India';
    const householdSize = preferences.householdSize || 4;
    const portionSize = preferences.portionSize || 'regular';
    const mealComplexity = preferences.mealComplexity || 'balanced';
    const cuisineStyle = preferences.cuisineStyle || 'pan-indian';

    // Build complexity instructions
    const complexityInstructions = mealComplexity === 'quick'
        ? 'Focus on quick recipes (under 30 mins). Prefer one-pot meals, minimal ingredients.'
        : mealComplexity === 'elaborate'
            ? 'Include elaborate recipes with multiple components. Traditional multi-dish thalis are welcome.'
            : 'Mix of quick and elaborate meals. Weekdays simpler, weekends can be elaborate.';

    // Build cuisine instructions
    const cuisineInstructions = cuisineStyle === 'regional'
        ? 'Focus on authentic regional recipes from the user\'s area. Traditional preparations.'
        : cuisineStyle === 'fusion'
            ? 'Include fusion dishes, Indo-Chinese, international flavors adapted for Indian palate.'
            : 'Pan-Indian variety - mix of North, South, East, West Indian cuisines.';

    // Build tiffin instructions if applicable
    let tiffinInstructions = '';
    if (preferences.hasTiffin && preferences.tiffinDays?.length > 0) {
        tiffinInstructions = `
TIFFIN/PACKED LUNCH REQUIREMENT:
On these days: ${preferences.tiffinDays.join(', ')}
For: ${preferences.tiffinFor?.join(', ') || 'office/school'}
- Make lunch items that travel well (no soup, no items that get soggy)
- Prefer dry rotis, parathas, rice dishes, sandwiches, dry curries
- Avoid: curries with too much gravy, items requiring immediate consumption
`;
    }

    // Build non-veg instructions if applicable
    let nonVegInstructions = '';
    if (preferences.nonVegPreferences?.length > 0 && preferences.dietaryType !== 'Vegetarian') {
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

    // Build prep-ahead instruction
    const prepAheadInstruction = preferences.showPrepReminders !== false ? `
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
- Portion preference: ${portionSize} (${portionSize === 'light' ? 'smaller portions' : portionSize === 'hearty' ? 'generous portions' : 'standard portions'})

DIETARY PREFERENCES:
- Diet type: ${preferences.dietaryType || 'Vegetarian'}
- Foods to avoid: ${preferences.dislikes?.join(', ') || 'None'}
- Allergies: ${preferences.allergies?.join(', ') || 'None'}
- Health goals: ${preferences.healthGoals?.join(', ') || 'None'}
- Special instructions: ${preferences.specialInstructions || 'None'}

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

Output 7 days: ${isHindi ? 'सोमवार through रविवार' : 'Monday through Sunday'} with breakfast, lunch, dinner for each.
Keep meals practical, varied, and seasonally appropriate for ${country}.

ALTERNATIVES REQUIREMENT:
Also generate an "alternatives" object with:
- "breakfast": 5 unique alternatives (different from main plan)
- "lunch": 5 unique alternatives
- "dinner": 5 unique alternatives
All alternatives must include quantities like the main plan.`;
}

// ==========================================
// New Proxy Functions (Ported from geminiService)
// ==========================================

async function executeTranslateContent(ai: GoogleGenAI, payload: any) {
    const { content, targetLanguage, type } = payload;

    // Schema definition depends on type
    const schema = type === 'plan' ? {
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
                    },
                    required: ["day", "breakfast", "lunch", "dinner"],
                },
            },
        },
        required: ["days"],
    } : {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                item: { type: Type.STRING },
                quantity: { type: Type.STRING },
                category: { type: Type.STRING },
                checked: { type: Type.BOOLEAN },
            },
            required: ["item", "quantity", "category", "checked"],
        },
    };

    const prompt = type === 'plan'
        ? `
        Translate this meal plan to ${targetLanguage === 'hi' ? 'Hindi (Devanagari script)' : 'English'}.
        
        Input Plan:
        ${JSON.stringify(content)}

    Requirements:
        ${targetLanguage === 'hi'
            ? '- Translate Day names (Monday -> सोमवार)'
            : '- Translate Day names to English'
        }
        ${targetLanguage === 'hi'
            ? '- Translate Meal names to Hindi (e.g. "Poha" -> "पोहा")'
            : '- Translate Meal names to English'
        }
    - Keep the JSON structure EXACTLY the same.
        - Return ONLY JSON.
        `
        : `
        Translate this grocery list to ${targetLanguage === 'hi' ? 'Hindi (Devanagari script)' : 'English'}.
        
        Input List:
        ${JSON.stringify(content)}

    Requirements:
    - Translate item names and quantities
        - Keep categories in English for sorting, but you can translate them if displayed
            - Keep the JSON structure EXACTLY the same.
        `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.3,
        }
    });

    return JSON.parse(response.text || (type === 'plan' ? "{ \"days\": [] }" : "[]"));
}

async function executeGetLearningSuggestions(ai: GoogleGenAI, payload: any) {
    const { preferences: currentPrefs, history } = payload;

    // Simple filtering logic
    const liked = history.filter((h: any) => h.rating === 'liked').map((h: any) => h.mealName);
    const disliked = history.filter((h: any) => h.rating === 'disliked').map((h: any) => h.mealName);

    if (liked.length === 0 && disliked.length === 0) {
        return {
            summary: "No rated meals found.",
            likedPatterns: [],
            dislikedPatterns: [],
            suggestedAdditions: { breakfastPreferences: [], lunchPreferences: [], dinnerPreferences: [], dislikes: [] },
            totalMealsAnalyzed: 0
        };
    }

    const schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING },
            likedPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
            dislikedPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAdditions: {
                type: Type.OBJECT,
                properties: {
                    breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                    lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                    dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                    dislikes: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["breakfastPreferences", "lunchPreferences", "dinnerPreferences", "dislikes"]
            }
        },
        required: ["summary", "likedPatterns", "dislikedPatterns", "suggestedAdditions"]
    };

    const prompt = `
        Analyze this user's meal history feedback and provide learning suggestions.
        
        Liked Meals: ${liked.join(", ")}
        Disliked Meals: ${disliked.join(", ")}
        
        Current Preferences: ${JSON.stringify(currentPrefs)}

    Task:
    1. Identify patterns in liked meals
    2. Identify patterns in disliked meals
    3. Suggest NEW items to add to preferences
    4. Write a friendly 1 - 2 sentence summary
        `;

    const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.4,
        }
    });

    const result = JSON.parse(response.text || "{}");
    return { ...result, totalMealsAnalyzed: liked.length + disliked.length };
}

async function executeOptimizePreferences(ai: GoogleGenAI, payload: any) {
    const { preferences: currentPrefs, history } = payload;

    const liked = history.filter((h: any) => h.rating === 'liked').map((h: any) => h.mealName);
    const disliked = history.filter((h: any) => h.rating === 'disliked').map((h: any) => h.mealName);

    const schema = {
        type: Type.OBJECT,
        properties: {
            dietaryType: { type: Type.STRING },
            allergies: { type: Type.ARRAY, items: { type: Type.STRING } },
            dislikes: { type: Type.ARRAY, items: { type: Type.STRING } },
            breakfastPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            lunchPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            dinnerPreferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            specialInstructions: { type: Type.STRING },
            pantryStaples: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["dietaryType", "allergies", "dislikes", "breakfastPreferences", "lunchPreferences", "dinnerPreferences", "specialInstructions", "pantryStaples"]
    };

    const prompt = `
        Analyze the user's feedback to OPTIMIZE their preferences.
        
        Current Preferences: ${JSON.stringify(currentPrefs)}

    Likeds: ${liked.join(", ")}
    Dislikes: ${disliked.join(", ")}

    Task:
    1. Add traits of liked meals to preferences
    2. Add traits of disliked meals to 'Dislikes' list
    3. Refine dietary type if needed
        
        Return the complete updated preference profile JSON.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.3,
        }
    });

    return JSON.parse(response.text || JSON.stringify(currentPrefs));
}
