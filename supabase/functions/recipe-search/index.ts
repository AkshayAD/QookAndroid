import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ... Interfaces (Same as before) ...
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
    isAiGenerated: boolean;
}

function extractMainDish(mealText: string): { mainDish: string; sides: string[] } {
    const cleanedText = mealText.replace(/\s*\([^)]*\)/g, '');
    const separators = /[•·,\n]/;
    const parts = cleanedText.split(separators).map(p => p.trim()).filter(p => p.length > 0);
    let mainDish = parts[0] || cleanedText;
    mainDish = mainDish.replace(/^\d+[\s\-]*(cups?|grams?|g|pcs?|pieces?|slices?|eggs?|ml|liters?|tbsp|tsp|oz|lb|kg|servings?)?\s*/i, '').trim();
    if (!mainDish) mainDish = parts[0] || cleanedText.split('(')[0].trim() || mealText;
    const sides = parts.slice(1).map(s =>
        s.replace(/^\d+[\s\-]*(cups?|grams?|g|pcs?|pieces?|slices?|eggs?|ml|liters?|tbsp|tsp|oz|lb|kg|servings?)?\s*/i, '').trim()
    ).filter(s => s.length > 0);
    return { mainDish, sides };
}

function scoreVideo(video: any, stats: any, searchTerm: string): number {
    let score = 0;
    const title = video.snippet.title.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    if (title.includes('recipe')) score += 50;
    if (title.includes(searchLower)) score += 30;
    const views = parseInt(stats?.statistics?.viewCount || '0');
    score += Math.min(Math.log10(views + 1) * 5, 30);
    const penaltyKeywords = ['shorts', 'vlog', 'mukbang', 'asmr', 'review', 'expired', 'prank'];
    for (const kw of penaltyKeywords) {
        if (title.includes(kw)) score -= 40;
    }
    return score;
}

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
            if (time > 0 && time < 300) return time;
        }
    }
    return null;
}

function inferDifficulty(cookTime: number | null, title: string): 'Easy' | 'Medium' | 'Moderate' | 'Advanced' | null {
    const titleLower = title.toLowerCase();
    if (/easy|simple|quick|beginner|basic|instant/i.test(titleLower)) return 'Easy';
    if (/restaurant|authentic|professional|chef|gourmet/i.test(titleLower)) return 'Advanced';
    if (cookTime !== null) {
        if (cookTime <= 15) return 'Easy';
        if (cookTime <= 30) return 'Medium';
        if (cookTime <= 60) return 'Moderate';
        return 'Advanced';
    }
    return null;
}

function extractIngredients(description: string): string[] {
    const ingredients: string[] = [];
    const lines = description.split(/[\n\r]+/);
    let inIngredientSection = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^(ingredients?|what you need|you['']?ll need)\s*:?$/i.test(trimmed)) {
            inIngredientSection = true;
            continue;
        }
        if (inIngredientSection && /^(instructions?|method|steps?|directions?|procedure)\s*:?$/i.test(trimmed)) {
            break;
        }
        if (inIngredientSection || /^[-*•]\s+/.test(trimmed) || /^\d+[.)]?\s+/.test(trimmed)) {
            const cleaned = trimmed
                .replace(/^[-*•\d.)]+\s*/, '')
                .replace(/\(.*?\)/g, '')
                .trim();
            if (cleaned.length > 2 && cleaned.length < 100) {
                if (/\d|cup|tbsp|tsp|gram|g\b|ml|oz|piece|slice|pinch|handful/i.test(cleaned) ||
                    /salt|pepper|oil|butter|onion|garlic|tomato|chicken|paneer|rice|flour/i.test(cleaned)) {
                    ingredients.push(cleaned);
                    if (!inIngredientSection) inIngredientSection = true;
                }
            }
        }
        if (ingredients.length >= 15) break;
    }
    return ingredients;
}

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
Categories: dairy, vegetables, spices, grains, protein, oils, condiments, other. Time in minutes. Nutrition per serving. Max 10 ingredients.`;

        // DEBUG: Construct URL explicitly
        // If gemini-3-flash-preview fails on v1beta, try v1alpha or other endpoints
        let model = "gemini-3-flash-preview";
        let version = "v1beta";

        // Use v1beta based effectively on ai-proxy.ts which uses @google/genai (defaulting to v1beta)
        // If this 404s, it implies Key/Model mismatch for this endpoint.

        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.1,
                    responseMimeType: "application/json" // Try forcing JSON mode
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText);

            // Mask Key for debug output
            const maskedUrl = url.replace(GEMINI_API_KEY, '***');

            return {
                cookTimeMinutes: 0,
                difficulty: 'Easy',
                ingredients: [
                    {
                        name: `DEBUG_ERR_${response.status}`,
                        quantity: `URL: ${maskedUrl} | Msg: ${errText.substring(0, 100)}`,
                        category: 'error'
                    }
                ],
                nutrition: null
            };
        }

        const data = await response.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(text);

        const cookTime = typeof parsed.time === 'number' ? parsed.time : null;
        const difficulty = parsed.difficulty as any;
        const ingredients = Array.isArray(parsed.ingredients)
            ? parsed.ingredients.map((ing: any) => ({
                name: String(ing.name || '').trim(),
                quantity: String(ing.quantity || '').trim(),
                category: String(ing.category || 'other').toLowerCase().trim()
            })).filter((ing: any) => ing.name.length > 0)
            : [];
        const nutrition = parsed.nutrition ? {
            calories: Number(parsed.nutrition.calories) || 0,
            protein: Number(parsed.nutrition.protein) || 0,
            carbs: Number(parsed.nutrition.carbs) || 0,
            fat: Number(parsed.nutrition.fat) || 0,
        } : null;

        return { cookTimeMinutes: cookTime, difficulty, ingredients, nutrition };
    } catch (error: any) {
        console.error('AI logic error:', error);
        return {
            cookTimeMinutes: 0,
            difficulty: 'Easy',
            ingredients: [
                { name: `DEBUG_CATCH_ERR`, quantity: String(error).substring(0, 100), category: 'error' }
            ],
            nutrition: null
        };
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const { mealName } = await req.json();
        if (!mealName || typeof mealName !== "string") {
            return new Response(JSON.stringify({ error: "mealName required" }), { status: 400, headers: corsHeaders });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { mainDish, sides } = extractMainDish(mealName);
        const cacheKey = mainDish.toLowerCase().trim();

        // 1. Cache
        const { data: cached } = await supabase.from("recipe_cache").select("*").eq("meal_name_lower", cacheKey).single();
        if (cached && cached.ingredients?.length > 0) {
            console.log(`Cache hit: ${mainDish}`);
            return new Response(
                JSON.stringify({
                    mealName, mainDish, sides,
                    youtubeVideoId: cached.youtube_video_id,
                    videoTitle: cached.video_title,
                    channelName: cached.channel_name,
                    viewCount: cached.view_count,
                    thumbnailUrl: cached.thumbnail_url,
                    description: cached.description,
                    cookTimeMinutes: cached.cook_time_minutes,
                    difficulty: cached.difficulty,
                    ingredients: cached.ingredients,
                    nutrition: cached.nutrition,
                    isAiGenerated: cached.is_ai_generated,
                    fromCache: true
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. YouTube
        if (!YOUTUBE_API_KEY) throw new Error("YouTube API not configured");
        const searchQuery = encodeURIComponent(`${mainDish} recipe`);
        const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&videoDuration=medium&maxResults=5&key=${YOUTUBE_API_KEY}`;
        const ytData = await (await fetch(youtubeUrl)).json();

        if (!ytData.items?.length) {
            return new Response(JSON.stringify({ error: "No video found", mainDish }), { status: 404, headers: corsHeaders });
        }

        // 3. Stats & Scoring
        const videoIds = ytData.items.map((v: any) => v.id.videoId).join(',');
        const statsData = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`)).json();
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

        let cookTimeMinutes = extractCookTime(videoTitle, description);
        let difficulty = inferDifficulty(cookTimeMinutes, videoTitle);
        let ingredients: StructuredIngredient[] = extractIngredients(description).map(ing => ({
            name: ing, quantity: '', category: 'other'
        }));
        let nutrition: NutritionInfo | null = null;
        let isAiGenerated = false;

        console.log(`YouTube extraction for ${mainDish}: ing=${ingredients.length}`);

        // 6. AI Fallback
        if (ingredients.length === 0) {
            console.log(`Calling AI fallback...`);
            const aiData = await getAiRecipeDetails(mainDish);
            if (aiData) {
                if (cookTimeMinutes === null) cookTimeMinutes = aiData.cookTimeMinutes;
                if (difficulty === null) difficulty = aiData.difficulty;
                if (ingredients.length === 0 && aiData.ingredients.length > 0) {
                    ingredients = aiData.ingredients;
                    isAiGenerated = true;
                }
                if (aiData.nutrition) nutrition = aiData.nutrition;
            }
        }

        const result: RecipeResult = {
            mealName, mainDish, sides, youtubeVideoId: videoId, videoTitle,
            channelName: bestVideo.snippet.channelTitle, viewCount,
            thumbnailUrl: bestVideo.snippet.thumbnails.high?.url || bestVideo.snippet.thumbnails.default?.url,
            description, cookTimeMinutes, difficulty, ingredients, nutrition, isAiGenerated
        };

        // 7. Cache
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
        }, { onConflict: "meal_name_lower" });

        return new Response(JSON.stringify({ ...result, fromCache: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error) {
        console.error("Recipe search error:", error);
        return new Response(JSON.stringify({ error: "Failed to search for recipe" }), { status: 500, headers: corsHeaders });
    }
});
