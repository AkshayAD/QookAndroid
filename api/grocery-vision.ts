import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

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

// Initialize Supabase admin client
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return createClient(supabaseUrl, supabaseServiceKey);
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await req.json();
        const { userId, imageData, imageType = 'image/jpeg', userApiKey } = body;

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing userId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!imageData) {
            return new Response(JSON.stringify({ error: 'Missing imageData (base64)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const geminiApiKey = userApiKey || process.env.GEMINI_API_KEY || '';
        if (!geminiApiKey) {
            return new Response(JSON.stringify({ error: 'No API key configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
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
                                mimeType: imageType,
                                data: imageData // base64 encoded
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
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error: any) {
        console.error('Grocery vision error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Failed to process image'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
