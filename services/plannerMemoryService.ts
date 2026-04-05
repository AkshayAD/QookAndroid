import {
  InventoryItem,
  PreferenceSignal,
  PreferenceSignalActionType,
  PreferenceSignalSummary,
  UserPreferences,
} from '../types';

type MealBucket = 'breakfast' | 'lunch' | 'dinner';

interface DraftSignalInput {
  mealType?: MealBucket | null;
  actionType: PreferenceSignalActionType;
  originalValue?: string | null;
  newValue?: string | null;
  rawInstruction?: string | null;
  positiveTags?: string[];
  negativeTags?: string[];
  confidence?: number;
  requiresConfirmation?: boolean;
}

const POSITIVE_RULES: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /\b(high protein|more protein|protein-rich)\b/i, tags: ['high protein meals'] },
  { pattern: /\b(light|lighter)\b/i, tags: ['light meals'] },
  { pattern: /\b(quick|faster|easy)\b/i, tags: ['quick meals'] },
  { pattern: /\b(spicy|spicier)\b/i, tags: ['spicy meals'] },
  { pattern: /\b(less oil|minimal oil|low oil)\b/i, tags: ['less oil meals'] },
  { pattern: /\b(veg|vegetarian)\b/i, tags: ['vegetarian meals'] },
];

const NEGATIVE_RULES: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /\b(less oil|minimal oil|low oil)\b/i, tags: ['oily meals'] },
  { pattern: /\b(light|lighter)\b/i, tags: ['heavy meals'] },
  { pattern: /\b(mild|less spicy|not spicy)\b/i, tags: ['spicy meals'] },
  { pattern: /\b(no repeat|different every day)\b/i, tags: ['repeated meals'] },
];

function normalizeTag(tag: string): string | null {
  const cleaned = tag
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.toLowerCase();
}

function uniqueNormalized(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();

  values.forEach((value) => {
    const normalized = normalizeTag(value || '');
    if (!normalized) {
      return;
    }

    if (!seen.has(normalized)) {
      seen.set(normalized, normalized);
    }
  });

  return Array.from(seen.values());
}

function extractNoTags(text: string): string[] {
  const matches = Array.from(text.matchAll(/\bno\s+([a-z][a-z\s-]{1,40})/gi));

  return matches
    .map((match) => match[1])
    .map((value) => value.replace(/\b(for|with|in|at)\b.*$/i, '').trim())
    .filter(Boolean);
}

export function extractSignalTagsFromInstruction(instruction: string): {
  positiveTags: string[];
  negativeTags: string[];
} {
  const positiveTags = POSITIVE_RULES
    .filter((rule) => rule.pattern.test(instruction))
    .flatMap((rule) => rule.tags);
  const negativeTags = NEGATIVE_RULES
    .filter((rule) => rule.pattern.test(instruction))
    .flatMap((rule) => rule.tags);

  const noTags = extractNoTags(instruction);

  return {
    positiveTags: uniqueNormalized(positiveTags),
    negativeTags: uniqueNormalized([...negativeTags, ...noTags]),
  };
}

export function createPreferenceSignal(input: DraftSignalInput): Omit<PreferenceSignal, 'id' | 'createdAt'> {
  return {
    mealType: input.mealType ?? null,
    actionType: input.actionType,
    originalValue: input.originalValue?.trim() || null,
    newValue: input.newValue?.trim() || null,
    rawInstruction: input.rawInstruction?.trim() || null,
    positiveTags: uniqueNormalized([
      ...(input.positiveTags || []),
      input.actionType === 'save_recipe' ? input.newValue || '' : null,
    ]),
    negativeTags: uniqueNormalized(input.negativeTags || []),
    confidence: input.confidence ?? 0.72,
    requiresConfirmation: input.requiresConfirmation ?? true,
    appliedAt: null,
    familyGroupId: null,
  };
}

export function createRegenerateSignal(mealType: MealBucket, mealName: string) {
  return createPreferenceSignal({
    mealType,
    actionType: 'regenerate',
    originalValue: mealName,
    negativeTags: [mealName],
    confidence: 0.78,
    requiresConfirmation: true,
  });
}

export function createMealReplacementSignal(
  actionType: 'swap' | 'manual_edit',
  mealType: MealBucket,
  originalMeal: string,
  newMeal: string
) {
  return createPreferenceSignal({
    mealType,
    actionType,
    originalValue: originalMeal,
    newValue: newMeal,
    positiveTags: [newMeal],
    negativeTags: originalMeal ? [originalMeal] : [],
    confidence: actionType === 'swap' ? 0.8 : 0.74,
    requiresConfirmation: true,
  });
}

export function createSmartEditSignal(
  mealType: MealBucket | null,
  originalMeal: string,
  newMeal: string,
  instruction: string
) {
  const tags = extractSignalTagsFromInstruction(instruction);

  return createPreferenceSignal({
    mealType,
    actionType: 'smart_edit',
    originalValue: originalMeal,
    newValue: newMeal,
    rawInstruction: instruction,
    positiveTags: [...tags.positiveTags, newMeal],
    negativeTags: [...tags.negativeTags, ...(originalMeal ? [originalMeal] : [])],
    confidence: 0.84,
    requiresConfirmation: true,
  });
}

export function createRecipeSaveSignal(mealName: string) {
  return createPreferenceSignal({
    actionType: 'save_recipe',
    newValue: mealName,
    positiveTags: [mealName],
    confidence: 0.6,
    requiresConfirmation: false,
  });
}

function addWeighted(map: Map<string, number>, values: string[], weight: number) {
  values.forEach((value) => {
    const normalized = normalizeTag(value);
    if (!normalized) {
      return;
    }

    map.set(normalized, (map.get(normalized) || 0) + weight);
  });
}

function toRankedList(map: Map<string, number>, minimumWeight: number, limit: number): string[] {
  return Array.from(map.entries())
    .filter(([, weight]) => weight >= minimumWeight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export function summarizePreferenceSignals(
  signals: PreferenceSignal[],
  preferences?: UserPreferences | null
): PreferenceSignalSummary {
  const breakfast = new Map<string, number>();
  const lunch = new Map<string, number>();
  const dinner = new Map<string, number>();
  const dislikes = new Map<string, number>();
  const positiveFocus = new Map<string, number>();
  const negativeFocus = new Map<string, number>();

  const existingBreakfast = new Set((preferences?.breakfastPreferences || []).map((value) => normalizeTag(value) || ''));
  const existingLunch = new Set((preferences?.lunchPreferences || []).map((value) => normalizeTag(value) || ''));
  const existingDinner = new Set((preferences?.dinnerPreferences || []).map((value) => normalizeTag(value) || ''));
  const existingDislikes = new Set((preferences?.dislikes || []).map((value) => normalizeTag(value) || ''));

  signals.forEach((signal) => {
    const weight = signal.confidence || 0.7;

    addWeighted(positiveFocus, signal.positiveTags, weight);
    addWeighted(negativeFocus, signal.negativeTags, weight);
    addWeighted(dislikes, signal.negativeTags, weight);

    if (signal.mealType === 'breakfast') {
      addWeighted(breakfast, signal.positiveTags, weight);
    } else if (signal.mealType === 'lunch') {
      addWeighted(lunch, signal.positiveTags, weight);
    } else if (signal.mealType === 'dinner') {
      addWeighted(dinner, signal.positiveTags, weight);
    }
  });

  const breakfastPreferences = toRankedList(breakfast, 1.1, 6).filter((value) => !existingBreakfast.has(value));
  const lunchPreferences = toRankedList(lunch, 1.1, 6).filter((value) => !existingLunch.has(value));
  const dinnerPreferences = toRankedList(dinner, 1.1, 6).filter((value) => !existingDinner.has(value));
  const dislikeSuggestions = toRankedList(dislikes, 1.1, 8).filter((value) => !existingDislikes.has(value));
  const positiveHighlights = toRankedList(positiveFocus, 0.6, 6);
  const negativeHighlights = toRankedList(negativeFocus, 0.6, 6);

  const meaningfulSignalCount =
    positiveHighlights.length +
    negativeHighlights.length +
    breakfastPreferences.length +
    lunchPreferences.length +
    dinnerPreferences.length +
    dislikeSuggestions.length;

  const summaryParts: string[] = [];
  if (positiveHighlights.length > 0) {
    summaryParts.push(`You keep choosing ${positiveHighlights.slice(0, 3).join(', ')}`);
  }
  if (negativeHighlights.length > 0) {
    summaryParts.push(`You often move away from ${negativeHighlights.slice(0, 3).join(', ')}`);
  }

  return {
    signalIds: signals.map((signal) => signal.id),
    meaningfulSignalCount,
    breakfastPreferences,
    lunchPreferences,
    dinnerPreferences,
    dislikes: dislikeSuggestions,
    positiveFocus: positiveHighlights,
    negativeFocus: negativeHighlights,
    summary: summaryParts.join('. ') || 'Qook can learn from your swaps, edits, regenerations, and saved recipes.',
  };
}

export function buildInventorySummary(items: InventoryItem[]): {
  names: string[];
  label: string;
} {
  const activeNames = items
    .filter((item) => item.status === 'active')
    .map((item) => item.name.trim())
    .filter(Boolean);

  const names = Array.from(new Set(activeNames));

  return {
    names,
    label: names.length > 0
      ? `Using ${names.length} item${names.length === 1 ? '' : 's'} you already have`
      : 'No saved inventory yet',
  };
}
