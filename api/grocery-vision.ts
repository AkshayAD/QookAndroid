import { GoogleGenAI } from "@google/genai";
import {
    ApiError,
    assertRequestUser,
    edgeCorsHeaders,
    getErrorMessage,
    getErrorStatus,
    getSupabaseAdminClient,
    requireAuthenticatedUser,
} from '../lib/serverApi';

/**
 * Grocery Vision API
 * 
 * Processes images of fridges, pantries, grocery lists, or order screenshots
 * to extract available groceries using Gemini Vision.
 */

export const config = {
    runtime: 'edge',
    maxDuration: 30,
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);

function normalizeImageType(imageType: unknown): string {
    const normalized = String(imageType || 'image/jpeg').trim().toLowerCase();
    return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

function extractBase64Image(imageData: unknown): string {
    return String(imageData || '').replace(/^data:[^,]*,/i, '').replace(/\s/g, '');
}

function estimateBase64Bytes(base64Data: string): number {
    const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
    return Math.floor((base64Data.length * 3) / 4) - padding;
}

async function assertGroceryVisionRateLimit(userId: string) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: userId,
        p_action_type: 'grocery_vision',
        p_window_minutes: 1,
        p_max_requests: 8,
    });

    if (error) {
        console.error('Grocery vision rate limit check failed:', error);
        throw new ApiError(500, 'Unable to verify request limits');
    }

    if (data !== true) {
        throw new ApiError(429, 'Too many image analysis requests. Please try again shortly.');
    }
}

export default async function handler(req: Request) {
    const corsHeaders = edgeCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const authUserId = await requireAuthenticatedUser(req.headers.get('authorization'));
        const body = await req.json();
        const { userId: requestedUserId, imageData, imageType = 'image/jpeg', userApiKey } = body;
        const userId = assertRequestUser(authUserId, requestedUserId);
        const normalizedImageType = normalizeImageType(imageType);
        const base64ImageData = extractBase64Image(imageData);

        if (!base64ImageData) {
            return new Response(JSON.stringify({ error: 'Missing imageData (base64)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!ALLOWED_IMAGE_TYPES.has(normalizedImageType)) {
            throw new ApiError(415, 'Unsupported image type');
        }

        if (estimateBase64Bytes(base64ImageData) > MAX_IMAGE_BYTES) {
            throw new ApiError(413, 'Image is too large');
        }

        await assertGroceryVisionRateLimit(userId);

        const geminiApiKey = userApiKey || process.env.GEMINI_API_KEY || '';
        if (!geminiApiKey) {
            return new Response(JSON.stringify({ error: 'No API key configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        // Use Gemini 2.0 Flash for vision - fast and capable
        const model = "gemini-2.0-flash";

        const prompt = `Analyze this image and extract a list of groceries/food items visible.

This could be:
- A photo of a fridge or pantry
- A screenshot of a grocery order
- A handwritten or printed shopping list
- A receipt from a grocery store

For each item you can identify, provide:
1. The item name (in English)
2. Approximate quantity if visible

IMPORTANT:
- Be thorough - list EVERY food item you can see
- Use common grocery names (e.g., "tomatoes" not "Solanum lycopersicum")
- If quantities are unclear, use "some" or "a few"
- Group similar items (e.g., "mixed vegetables")
- If this is NOT a grocery-related image, return an empty list

Return ONLY a JSON response in this exact format:
{
  "groceries": [
    { "item": "string", "quantity": "string" }
  ],
  "imageType": "fridge|pantry|list|receipt|order|other",
  "confidence": 0.0-1.0
}`;

        // Call Gemini with image input
        const response = await ai.models.generateContent({
            model,
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: normalizedImageType,
                                data: base64ImageData // base64 encoded
                            }
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
                temperature: 0.3, // Lower for more accurate extraction
            }
        });

        const text = response.text || '{}';

        // Parse the response
        let result;
        try {
            // Clean up the response if needed
            const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            result = JSON.parse(cleanText);
        } catch {
            result = {
                groceries: [],
                error: 'Could not parse grocery list from image'
            };
        }

        return new Response(JSON.stringify({
            success: true,
            ...result
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            }
        });

    } catch (error: any) {
        console.error('Grocery vision error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: getErrorMessage(error, 'Failed to process image')
        }), {
            status: getErrorStatus(error),
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
