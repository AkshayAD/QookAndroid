/**
 * AI Proxy Service
 * 
 * Client-side service to call the secure server-side AI proxy.
 * All AI operations go through /api/ai-proxy which:
 * - Validates user credits
 * - Keeps API keys secure
 * - Consumes credits on success
 */

import { MealAlternatives, GroceryItem } from '../types';
import { getApiBaseUrl } from '../utils/platform';

// Use centralized API URL (handles native vs web)
const getApiUrl = getApiBaseUrl;

interface ProxyResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    required?: number;
    available?: number;
    creditType?: string;
}

// Generic proxy call function
async function callAiProxy<T>(
    action: string,
    userId: string,
    payload: any,
    userApiKey?: string
): Promise<T> {
    // Create AbortController for client-side timeout (200 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 200000);

    try {
        const response = await fetch(`${getApiUrl()}/api/ai-proxy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                userId,
                payload,
                userApiKey
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle non-JSON responses (e.g., Vercel error pages on timeout)
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response from AI proxy:', text.substring(0, 200));
            throw new Error('The AI request took too long. Please try again.');
        }

        let result: ProxyResponse<T>;
        try {
            result = await response.json();
        } catch {
            throw new Error('The AI response was invalid. Please try again.');
        }

        if (!response.ok) {
            // Handle specific error codes
            if (response.status === 402) {
                throw new Error(`Insufficient credits. You need ${result.required} ${result.creditType} credit(s) but have ${result.available}. Please upgrade or buy more credits.`);
            }
            if (response.status === 401) {
                throw new Error(result.error || 'Authentication failed. Please log in again.');
            }
            throw new Error(result.error || 'AI generation failed');
        }

        if (!result.success) {
            throw new Error(result.error || 'Unknown error');
        }

        return result.data as T;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('The request timed out. AI generation is taking longer than expected. Please try again.');
        }
        throw error;
    }
}

// =====================================================
// Exported AI Functions (Match geminiService interface)
// =====================================================

export interface WeeklyPlanResult {
    days: Array<{
        day: string;
        breakfast: string;
        lunch: string;
        dinner: string;
    }>;
}



export async function generatePlanViaProxy(
    userId: string,
    preferences: any,
    learningSummary?: any,
    userApiKey?: string
): Promise<WeeklyPlanResult> {
    return callAiProxy<WeeklyPlanResult>('generate_plan', userId, {
        preferences,
        learningSummary
    }, userApiKey);
}

export async function regenerateMealViaProxy(
    userId: string,
    currentMeal: string,
    mealType: string,
    preferences: any,
    dayName: string,
    existingMeals: string[] = [],
    userApiKey?: string
): Promise<string> {
    const result = await callAiProxy<{ meal: string }>('regenerate_meal', userId, {
        currentMeal,
        mealType,
        preferences,
        dayName,
        existingMeals
    }, userApiKey);
    return result.meal;
}

export async function smartEditViaProxy(
    userId: string,
    currentMeals: Record<string, string>,
    instruction: string,
    mealTypes: string[],
    preferences: any,
    userApiKey?: string
): Promise<{ options: Record<string, string[]> }> {
    const result = await callAiProxy<{ options: Record<string, string[]> }>('smart_edit', userId, {
        currentMeals,
        instruction,
        mealTypes,
        preferences
    }, userApiKey);
    return result;
}

export async function generateGroceryViaProxy(
    userId: string,
    meals: Array<{ day?: string; date?: string; breakfast: string; lunch: string; dinner: string }>,
    preferences: any,
    userApiKey?: string
): Promise<GroceryItem[]> {
    return callAiProxy<GroceryItem[]>('generate_grocery', userId, {
        meals,
        preferences
    }, userApiKey);
}

export async function parsePreferencesViaProxy(
    userId: string,
    text: string,
    userApiKey?: string
): Promise<any> {
    return callAiProxy<any>('parse_preferences', userId, { text }, userApiKey);
}

export async function validateApiKeyViaProxy(
    userId: string,
    apiKey: string
): Promise<boolean> {
    try {
        await callAiProxy<{ valid: boolean }>('validate_key', userId, {}, apiKey);
        return true;
    } catch {
        return false;
    }
}



export async function generateAlternativesViaProxy(
    userId: string,
    preferences: any,
    currentPlan: any,
    userApiKey?: string
): Promise<MealAlternatives> {
    return callAiProxy<MealAlternatives>('generate_alternatives', userId, {
        preferences,
        currentPlan
    }, userApiKey);
}

export async function translateViaProxy(
    userId: string,
    content: any,
    targetLanguage: 'hi' | 'en',
    type: 'plan' | 'grocery',
    userApiKey?: string
): Promise<any> {
    return callAiProxy<any>('translate_content', userId, {
        content,
        targetLanguage,
        type
    }, userApiKey);
}

export async function getLearningSuggestionsViaProxy(
    userId: string,
    preferences: any,
    history: any[],
    userApiKey?: string
): Promise<any> {
    return callAiProxy<any>('learning_suggestions', userId, {
        preferences,
        history
    }, userApiKey);
}

export async function optimizePreferencesViaProxy(
    userId: string,
    preferences: any,
    history: any[],
    userApiKey?: string
): Promise<any> {
    return callAiProxy<any>('optimize_preferences', userId, {
        preferences,
        history
    }, userApiKey);
}

// =====================================================
// Credit Check Helper (for UI to show available credits)
// =====================================================

export async function checkCreditsBeforeAction(
    userId: string,
    actionType: 'meal' | 'grocery' | 'edit' | 'regen'
): Promise<{ canProceed: boolean; available: number; required: number }> {
    // This is handled by SubscriptionContext - this is just a helper
    // The actual enforcement happens server-side
    return { canProceed: true, available: 0, required: 1 };
}
