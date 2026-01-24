import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
// Check both possible secret names for Gemini API key
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface StructuredIngredient {
    name: string;
    quantity: string;
    category: string;
}

interface NutritionInfo {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface RecipeResult {
    mealName: string;
    mainDish: string;
    sides: string[];
    youtubeVideoId: string;
    videoTitle: string;
    channelName: string;
    viewCount: number;
    thumbnailUrl: string;
    description: string;
    cookTimeMinutes: number | null;
    difficulty: 'Easy' | 'Medium' | 'Moderate' | 'Advanced' | null;
    ingredients: StructuredIngredient[];
    nutrition: NutritionInfo | null;
    isAiGenerated: boolean; // True if cook time/ingredients came from AI
}

/**
 * Extract the main dish name from a full meal text that may include sides.
 * Examples:
 *   "Boiled Egg Sandwich • Masala Chai • Cut Apple" → "Boiled Egg Sandwich"
 *   "Matar Paneer (250g paneer), Rice" → "Matar Paneer"
 *   "Methi Thepla (12 pieces)" → "Methi Thepla"
 */
function extractMainDish(mealText: string): { mainDish: string; sides: string[] } {
    // First, remove all parenthetical content (quantities like "(250g paneer)")
    const cleanedText = mealText.replace(/\s*\([^)]*\)/g, '');

    // Common separators: bullet, dot, comma, newline
    const separators = /[•·,\n]/;
    const parts = cleanedText.split(separators).map(p => p.trim()).filter(p => p.length > 0);

    // First item is the main dish
    let mainDish = parts[0] || cleanedText;

    // Strip any remaining leading quantities (e.g., "4 eggs" → "eggs", "2 cups rice" → "rice")
    mainDish = mainDish.replace(/^\d+[\s\-]*(cups?|grams?|g|pcs?|pieces?|slices?|eggs?|ml|liters?|tbsp|tsp|oz|lb|kg|servings?)?\s*/i, '').trim();

    // If still empty, use original (without parentheses)
    if (!mainDish) mainDish = parts[0] || cleanedText.split('(')[0].trim() || mealText;

    // Remaining items are sides (also clean them)
    const sides = parts.slice(1).map(s =>
        s.replace(/^\d+[\s\-]*(cups?|grams?|g|pcs?|pieces?|slices?|eggs?|ml|liters?|tbsp|tsp|oz|lb|kg|servings?)?\s*/i, '').trim()
    ).filter(s => s.length > 0);

    return { mainDish, sides };
}

/**
 * Score a video result to pick the best recipe match.
 * Higher score = better match.
 */
function scoreVideo(video: any, stats: any, searchTerm: string): number {
    let score = 0;
    const title = video.snippet.title.toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    // Strong preference for "recipe" in title
    if (title.includes('recipe')) score += 50;

    // Preference for search term in title
    if (title.includes(searchLower)) score += 30;

    // View count as quality signal (log scale)
    const views = parseInt(stats?.statistics?.viewCount || '0');
    score += Math.min(Math.log10(views + 1) * 5, 30);

    // Penalty for non-recipe content keywords
    const penaltyKeywords = ['shorts', 'vlog', 'mukbang', 'asmr', 'review', 'expired', 'prank'];
    for (const kw of penaltyKeywords) {
        if (title.includes(kw)) score -= 40;
    }

    return score;
}

/**
 * Extract cook time from video title or description.
 * Patterns: "20 min", "in 15 minutes", "30-minute recipe"
 */
function extractCookTime(title: string, description: string): number | null {
    const text = `${title} ${description}`.toLowerCase();
    const patterns = [
        /(\d+)\s*(?:min|mins|minute|minutes)/i,
        /in\s*(\d+)\s*(?:min|$)/i,
        /(\d+)-minute/i,
        /ready in\s*(\d+)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const time = parseInt(match[1]);
            if (time > 0 && time < 300) return time; // Sanity check
        }
    }
    return null;
}

/**
 * Infer difficulty from cook time and keywords.
 */
function inferDifficulty(cookTime: number | null, title: string): 'Easy' | 'Medium' | 'Moderate' | 'Advanced' | null {
    const titleLower = title.toLowerCase();

    // Keyword-based inference
    if (/easy|simple|quick|beginner|basic|instant/i.test(titleLower)) return 'Easy';
    if (/restaurant|authentic|professional|chef|gourmet/i.test(titleLower)) return 'Advanced';

    // Time-based inference
    if (cookTime !== null) {
        if (cookTime <= 15) return 'Easy';
        if (cookTime <= 30) return 'Medium';
        if (cookTime <= 60) return 'Moderate';
        return 'Advanced';
    }

    return null;
}

/**
 * Extract ingredients from video description.
 * Looks for common patterns like ingredient lists.
 */
function extractIngredients(description: string): string[] {
    const ingredients: string[] = [];
    const lines = description.split(/[\n\r]+/);

    let inIngredientSection = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Check if we're entering ingredients section
        if (/^(ingredients?|what you need|you['']?ll need)\s*:?$/i.test(trimmed)) {
            inIngredientSection = true;
            continue;
        }

        // Check if we're exiting ingredients section
        if (inIngredientSection && /^(instructions?|method|steps?|directions?|procedure)\s*:?$/i.test(trimmed)) {
            break;
        }

        // Parse ingredient lines (start with -, *, •, or number)
        if (inIngredientSection || /^[-*•]\s+/.test(trimmed) || /^\d+[.)]?\s+/.test(trimmed)) {
            // Clean up the line
            const cleaned = trimmed
                .replace(/^[-*•\d.)]+\s*/, '') // Remove bullets/numbers
                .replace(/\(.*?\)/g, '') // Remove parentheticals
                .trim();

            // Only add if it looks like an ingredient (has quantity words or food words)
            if (cleaned.length > 2 && cleaned.length < 100) {
                if (/\d|cup|tbsp|tsp|gram|g\b|ml|oz|piece|slice|pinch|handful/i.test(cleaned) ||
                    /salt|pepper|oil|butter|onion|garlic|tomato|chicken|paneer|rice|flour/i.test(cleaned)) {
                    ingredients.push(cleaned);
                    if (!inIngredientSection) inIngredientSection = true;
                }
            }
        }

        // Stop if we've collected enough
        if (ingredients.length >= 15) break;
    }

    return ingredients;
}

/**
 * Use Gemini 3 Flash to generate cook time, ingredients with structure, and nutrition.
 * Uses minimal prompts to save tokens.
 */
async function getAiRecipeDetails(dishName: string): Promise<{
    cookTimeMinutes: number | null;
    difficulty: 'Easy' | 'Medium' | 'Moderate' | 'Advanced' | null;
    ingredients: Array<{ name: string; quantity: string; category: string }>;
    nutrition: { calories: number; protein: number; carbs: number; fat: number } | null;
} | null> {
    if (!GEMINI_API_KEY) return null;

    try {
        const prompt = `For Indian dish "${dishName}", respond ONLY with valid JSON:
{
  "time": 30,
  "difficulty": "Medium",
  "ingredients": [
    {"name": "paneer", "quantity": "250g", "category": "dairy"},
    {"name": "tomatoes", "quantity": "4 medium", "category": "vegetables"}
  ],
  "nutrition": {"calories": 400, "protein": 15, "carbs": 30, "fat": 20}
}

Categories: dairy, vegetables, spices, grains, protein, oils, condiments, other
Time in minutes. Nutrition per serving. Max 10 ingredients.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 500,
                        temperature: 0.1,
                    },
                }),
            }
        );

        if (!response.ok) {
            console.error('Gemini API error:', response.status);
            return null;
        }

        const data = await response.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Clean up the response - remove markdown code blocks if present
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON response
        const parsed = JSON.parse(text);

        const cookTime = typeof parsed.time === 'number' ? parsed.time : null;
        const difficulty = ['Easy', 'Medium', 'Moderate', 'Advanced'].includes(parsed.difficulty)
            ? parsed.difficulty as 'Easy' | 'Medium' | 'Moderate' | 'Advanced'
            : null;

        // Parse structured ingredients
        const ingredients = Array.isArray(parsed.ingredients)
            ? parsed.ingredients
                .slice(0, 10)
                .map((ing: any) => ({
                    name: String(ing.name || '').trim(),
                    quantity: String(ing.quantity || '').trim(),
                    category: String(ing.category || 'other').toLowerCase().trim()
                }))
                .filter((ing: any) => ing.name.length > 0)
            : [];

        // Parse nutrition
        const nutrition = parsed.nutrition && typeof parsed.nutrition === 'object'
            ? {
                calories: Number(parsed.nutrition.calories) || 0,
                protein: Number(parsed.nutrition.protein) || 0,
                carbs: Number(parsed.nutrition.carbs) || 0,
                fat: Number(parsed.nutrition.fat) || 0,
            }
            : null;

        console.log(`AI generated for ${dishName}: ${cookTime}min, ${difficulty}, ${ingredients.length} ingredients, nutrition: ${nutrition ? 'yes' : 'no'}`);
        return { cookTimeMinutes: cookTime, difficulty, ingredients, nutrition };
    } catch (error) {
        console.error('AI recipe details error:', error);
        return null;
    }
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { mealName } = await req.json();

        if (!mealName || typeof mealName !== "string") {
            return new Response(
                JSON.stringify({ error: "mealName is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Extract main dish from full meal text
        const { mainDish, sides } = extractMainDish(mealName);
        const cacheKey = mainDish.toLowerCase().trim();

        // 1. Check cache first (using main dish as key)
        const { data: cached } = await supabase
            .from("recipe_cache")
            .select("*")
            .eq("meal_name_lower", cacheKey)
            .single();

        if (cached) {
            console.log(`Cache hit for: ${mainDish}`);
            return new Response(
                JSON.stringify({
                    mealName: mealName,
                    mainDish: mainDish,
                    sides: sides,
                    youtubeVideoId: cached.youtube_video_id,
                    videoTitle: cached.video_title,
                    channelName: cached.channel_name,
                    viewCount: cached.view_count,
                    thumbnailUrl: cached.thumbnail_url,
                    description: cached.description,
                    cookTimeMinutes: cached.cook_time_minutes || null,
                    difficulty: cached.difficulty || null,
                    ingredients: cached.ingredients || [],
                    nutrition: cached.nutrition || null,
                    isAiGenerated: cached.is_ai_generated || false,
                    fromCache: true,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Search YouTube API
        if (!YOUTUBE_API_KEY) {
            return new Response(
                JSON.stringify({ error: "YouTube API not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Search for main dish + "recipe", filter medium-length videos (no Shorts)
        const searchQuery = encodeURIComponent(`${mainDish} recipe`);
        const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&videoDuration=medium&maxResults=5&key=${YOUTUBE_API_KEY}`;

        const ytResponse = await fetch(youtubeUrl);
        const ytData = await ytResponse.json();

        if (!ytData.items || ytData.items.length === 0) {
            return new Response(
                JSON.stringify({
                    error: "No recipe video found",
                    mainDish: mainDish,
                    sides: sides,
                    searchUrl: `https://www.youtube.com/results?search_query=${searchQuery}`
                }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Get statistics for all videos to score them
        const videoIds = ytData.items.map((v: any) => v.id.videoId).join(',');
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
        const statsResponse = await fetch(statsUrl);
        const statsData = await statsResponse.json();

        // 4. Score and pick best video
        let bestVideo = ytData.items[0];
        let bestScore = -Infinity;
        let bestStats = statsData.items?.[0];

        for (let i = 0; i < ytData.items.length; i++) {
            const video = ytData.items[i];
            const stats = statsData.items?.find((s: any) => s.id === video.id.videoId);
            const score = scoreVideo(video, stats, mainDish);

            if (score > bestScore) {
                bestScore = score;
                bestVideo = video;
                bestStats = stats;
            }
        }

        const videoId = bestVideo.id.videoId;
        const viewCount = parseInt(bestStats?.statistics?.viewCount || "0");
        const videoTitle = bestVideo.snippet.title;
        const description = bestVideo.snippet.description;

        // 5. Extract additional data from video
        let cookTimeMinutes = extractCookTime(videoTitle, description);
        let difficulty = inferDifficulty(cookTimeMinutes, videoTitle);
        const rawIngredients = extractIngredients(description);
        // Convert raw ingredients to structured format
        let ingredients: StructuredIngredient[] = rawIngredients.map(ing => ({
            name: ing,
            quantity: '',
            category: 'other'
        }));
        let nutrition: NutritionInfo | null = null;
        let isAiGenerated = false;

        console.log(`YouTube extraction for ${mainDish}: cookTime=${cookTimeMinutes}, difficulty=${difficulty}, ingredients=${ingredients.length}`);

        // 6. If missing data, use AI fallback (Gemini 2.0 Flash)
        if (cookTimeMinutes === null || difficulty === null || ingredients.length === 0) {
            console.log(`Missing metadata for ${mainDish}, calling AI fallback... (GEMINI_API_KEY set: ${!!GEMINI_API_KEY})`);
            const aiData = await getAiRecipeDetails(mainDish);
            if (aiData) {
                if (cookTimeMinutes === null && aiData.cookTimeMinutes) {
                    cookTimeMinutes = aiData.cookTimeMinutes;
                    isAiGenerated = true;
                }
                if (difficulty === null && aiData.difficulty) {
                    difficulty = aiData.difficulty;
                    isAiGenerated = true;
                }
                if (ingredients.length === 0 && aiData.ingredients.length > 0) {
                    ingredients = aiData.ingredients;
                    isAiGenerated = true;
                }
                if (aiData.nutrition) {
                    nutrition = aiData.nutrition;
                }
                console.log(`AI result for ${mainDish}: cookTime=${cookTimeMinutes}, difficulty=${difficulty}, ingredients=${ingredients.length}, nutrition=${nutrition ? 'yes' : 'no'}, isAiGenerated=${isAiGenerated}`);
            } else {
                console.log(`AI fallback returned null for ${mainDish}`);
            }
        }

        const result: RecipeResult = {
            mealName: mealName,
            mainDish: mainDish,
            sides: sides,
            youtubeVideoId: videoId,
            videoTitle: videoTitle,
            channelName: bestVideo.snippet.channelTitle,
            viewCount: viewCount,
            thumbnailUrl: bestVideo.snippet.thumbnails.high?.url || bestVideo.snippet.thumbnails.default?.url,
            description: description,
            cookTimeMinutes: cookTimeMinutes,
            difficulty: difficulty,
            ingredients: ingredients,
            nutrition: nutrition,
            isAiGenerated: isAiGenerated,
        };

        // 7. Cache the result (keyed by main dish)
        await supabase.from("recipe_cache").upsert({
            meal_name: mainDish,
            meal_name_lower: cacheKey,
            youtube_video_id: result.youtubeVideoId,
            video_title: result.videoTitle,
            channel_name: result.channelName,
            view_count: result.viewCount,
            thumbnail_url: result.thumbnailUrl,
            description: result.description,
            cook_time_minutes: cookTimeMinutes,
            difficulty: difficulty,
            ingredients: ingredients,
            nutrition: nutrition,
            is_ai_generated: isAiGenerated,
        }, {
            onConflict: "meal_name_lower"
        });

        console.log(`Cached new recipe for: ${mainDish} (score: ${bestScore}, time: ${cookTimeMinutes}min, diff: ${difficulty}, AI: ${isAiGenerated})`);

        return new Response(
            JSON.stringify({ ...result, fromCache: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Recipe search error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to search for recipe" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
