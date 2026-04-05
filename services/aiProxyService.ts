/**
 * AI Proxy Service
 *
 * Client-side service to call the secure server-side AI proxy.
 * The website backend now requires Supabase bearer auth and accepts
 * familyGroupId so shared-credit requests are billed correctly.
 */

import { supabase } from '../lib/supabase';
import { sanitizeGroceryItems, sanitizeMealAlternatives, sanitizeMealText, sanitizeWeeklyPlan } from '../lib/mealSanitizer';
import { GroceryItem, MealAlternatives, MealHistoryEntry, UserPreferences, WeeklyPlan } from '../types';
import type { LearningSuggestions } from './geminiService';
import { getApiBaseUrl } from '../utils/platform';

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface ProxyResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  required?: number;
  available?: number;
  creditType?: string;
}

function looksLikeFamilyGroupId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || value.startsWith('family_')
    || value.startsWith('group_');
}

function normalizeOptionalArgs(
  familyGroupId?: string | null,
  userApiKey?: string
): { familyGroupId?: string | null; userApiKey?: string } {
  if (familyGroupId && !userApiKey && !looksLikeFamilyGroupId(familyGroupId)) {
    return {
      familyGroupId: null,
      userApiKey: familyGroupId,
    };
  }

  return { familyGroupId, userApiKey };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication required. Please sign in again.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function callAiProxy<T>(
  action: string,
  userId: string,
  payload: unknown,
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/ai-proxy`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        action,
        userId,
        familyGroupId: familyGroupId ?? null,
        payload,
        userApiKey,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
      if (response.status === 401 || response.status === 403) {
        throw new Error(result.error || 'Authentication failed. Please log in again.');
      }

      if (response.status === 402) {
        throw new Error(
          `Insufficient credits. You need ${result.required} ${result.creditType} credit(s) but have ${result.available}. Please upgrade or buy more credits.`
        );
      }

      if (response.status === 429) {
        throw new Error(result.error || 'Too many requests. Please wait a moment and try again.');
      }

      throw new Error(result.error || 'AI generation failed');
    }

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    return result.data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error?.name === 'AbortError') {
      throw new Error('The request timed out. AI generation is taking longer than expected. Please try again.');
    }

    throw error;
  }
}

export async function generatePlanViaProxy(
  userId: string,
  preferences: unknown,
  learningSummary?: unknown,
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<WeeklyPlan> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  const plan = await callAiProxy<WeeklyPlan>(
    'generate_plan',
    userId,
    { preferences, learningSummary },
    normalized.familyGroupId,
    normalized.userApiKey
  );

  return sanitizeWeeklyPlan(plan);
}

export async function regenerateMealViaProxy(
  userId: string,
  currentMeal: string,
  mealType: MealType,
  preferences: unknown,
  dayName: string,
  existingMeals: string[] = [],
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<string> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  const result = await callAiProxy<{ meal: string }>(
    'regenerate_meal',
    userId,
    { currentMeal, mealType, preferences, dayName, existingMeals },
    normalized.familyGroupId,
    normalized.userApiKey
  );

  return sanitizeMealText(result.meal) || currentMeal;
}

export async function smartEditViaProxy(
  userId: string,
  currentMeals: Record<string, string>,
  instruction: string,
  mealTypes: string[],
  preferences: unknown,
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<{ options: Record<string, string[]> }> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  const result = await callAiProxy<{ options: Record<string, string[]> }>(
    'smart_edit',
    userId,
    { currentMeals, instruction, mealTypes, preferences },
    normalized.familyGroupId,
    normalized.userApiKey
  );

  return {
    options: Object.fromEntries(
      Object.entries(result.options || {}).map(([key, values]) => [
        key,
        (values || []).map((value) => sanitizeMealText(value)).filter(Boolean),
      ])
    ),
  };
}

export async function generateGroceryViaProxy(
  userId: string,
  meals: Array<{ day?: string; date?: string; breakfast: string; lunch: string; dinner: string }>,
  preferences: unknown,
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<GroceryItem[]> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  const items = await callAiProxy<GroceryItem[]>(
    'generate_grocery',
    userId,
    { meals, preferences },
    normalized.familyGroupId,
    normalized.userApiKey
  );

  return sanitizeGroceryItems(items);
}

export async function parsePreferencesViaProxy(
  userId: string,
  text: string,
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<Partial<UserPreferences>> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  return callAiProxy(
    'parse_preferences',
    userId,
    { text },
    normalized.familyGroupId,
    normalized.userApiKey
  );
}

export async function validateApiKeyViaProxy(
  userId: string,
  apiKey: string,
  familyGroupId?: string | null
): Promise<boolean> {
  try {
    await callAiProxy<{ valid: boolean }>(
      'validate_key',
      userId,
      {},
      familyGroupId,
      apiKey
    );
    return true;
  } catch {
    return false;
  }
}

export async function generateAlternativesViaProxy(
  userId: string,
  preferences: unknown,
  currentPlan: unknown,
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<MealAlternatives> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  const alternatives = await callAiProxy<MealAlternatives>(
    'generate_alternatives',
    userId,
    { preferences, currentPlan },
    normalized.familyGroupId,
    normalized.userApiKey
  );

  return sanitizeMealAlternatives(alternatives) || { breakfast: [], lunch: [], dinner: [] };
}

export async function translateViaProxy(
  userId: string,
  content: WeeklyPlan,
  targetLanguage: 'hi' | 'en',
  type: 'plan',
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<WeeklyPlan>;
export async function translateViaProxy(
  userId: string,
  content: GroceryItem[],
  targetLanguage: 'hi' | 'en',
  type: 'grocery',
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<GroceryItem[]>;
export async function translateViaProxy(
  userId: string,
  content: WeeklyPlan | GroceryItem[],
  targetLanguage: 'hi' | 'en',
  type: 'plan' | 'grocery',
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<WeeklyPlan | GroceryItem[]> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  const translated = await callAiProxy(
    'translate_content',
    userId,
    { content, targetLanguage, type },
    normalized.familyGroupId,
    normalized.userApiKey
  );

  return type === 'plan'
    ? sanitizeWeeklyPlan(translated as WeeklyPlan)
    : sanitizeGroceryItems(translated as GroceryItem[]);
}

export async function getLearningSuggestionsViaProxy(
  userId: string,
  preferences: UserPreferences,
  history: MealHistoryEntry[],
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<LearningSuggestions> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  return callAiProxy(
    'learning_suggestions',
    userId,
    { preferences, history },
    normalized.familyGroupId,
    normalized.userApiKey
  );
}

export async function optimizePreferencesViaProxy(
  userId: string,
  preferences: UserPreferences,
  history: MealHistoryEntry[],
  familyGroupId?: string | null,
  userApiKey?: string
): Promise<UserPreferences> {
  const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

  return callAiProxy(
    'optimize_preferences',
    userId,
    { preferences, history },
    normalized.familyGroupId,
    normalized.userApiKey
  );
}

export async function checkCreditsBeforeAction(
  userId: string,
  actionType: 'meal' | 'grocery' | 'edit' | 'regen'
): Promise<{ canProceed: boolean; available: number; required: number }> {
  void userId;
  void actionType;

  return { canProceed: true, available: 0, required: 1 };
}
