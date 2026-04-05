import type { DayPlan, MealAlternatives, PrepAhead, WeeklyPlan } from '../types';

export type SelectableMealType = 'breakfast' | 'lunch' | 'dinner';

export const ALL_MEAL_TYPES: SelectableMealType[] = ['breakfast', 'lunch', 'dinner'];

const MEAL_LABELS: Record<SelectableMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

function normalizeMealType(value: unknown): SelectableMealType | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ALL_MEAL_TYPES.includes(normalized as SelectableMealType)
    ? normalized as SelectableMealType
    : null;
}

export function normalizeSelectedMeals(values?: Array<string | null | undefined>): SelectableMealType[] {
  const seen = new Set<SelectableMealType>();
  const meals = (values || [])
    .map((value) => normalizeMealType(value))
    .filter((value): value is SelectableMealType => Boolean(value))
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });

  return meals.length > 0 ? meals : [...ALL_MEAL_TYPES];
}

export function isMealSelected(
  mealType: SelectableMealType,
  values?: Array<string | null | undefined>
): boolean {
  return normalizeSelectedMeals(values).includes(mealType);
}

export function formatSelectedMealsLabel(values?: Array<string | null | undefined>): string {
  return normalizeSelectedMeals(values)
    .map((mealType) => MEAL_LABELS[mealType])
    .join(' + ');
}

export function getCollapsedKitchenMemoryLabel(
  inventoryCount: number,
  pantryCount: number,
  tiffinEnabled: boolean,
  tiffinDays: string[]
): string {
  if (tiffinEnabled) {
    const count = tiffinDays.length;
    return count > 0 ? `Tiffin ${count} day${count === 1 ? '' : 's'}` : 'Tiffin on';
  }

  if (inventoryCount > 0) {
    return `${inventoryCount} at home`;
  }

  if (pantryCount > 0) {
    return `${pantryCount} staple${pantryCount === 1 ? '' : 's'}`;
  }

  return 'No items saved';
}

export function buildMealSelectionInstruction(values?: Array<string | null | undefined>): string {
  const selectedMeals = normalizeSelectedMeals(values);

  if (selectedMeals.length === ALL_MEAL_TYPES.length) {
    return '';
  }

  return `
CRITICAL - MEAL SELECTION:
The user ONLY wants these meals: ${selectedMeals.map((meal) => meal.toUpperCase()).join(', ')}
For meals NOT in this list, you MUST return an empty string "".
${!selectedMeals.includes('breakfast') ? '- breakfast: MUST be empty string ""' : ''}
${!selectedMeals.includes('lunch') ? '- lunch: MUST be empty string ""' : ''}
${!selectedMeals.includes('dinner') ? '- dinner: MUST be empty string ""' : ''}
`;
}

export function normalizePrepAheadForSelectedMeals(
  prepAhead?: PrepAhead | null,
  values?: Array<string | null | undefined>,
  showPrepReminders: boolean = true
): PrepAhead | undefined {
  if (!prepAhead || !showPrepReminders) {
    return undefined;
  }

  const selectedMeals = normalizeSelectedMeals(values);
  const normalized: PrepAhead = {
    forBreakfast: selectedMeals.includes('breakfast') ? prepAhead.forBreakfast : undefined,
    forLunch: selectedMeals.includes('lunch') ? prepAhead.forLunch : undefined,
    forDinner: selectedMeals.includes('dinner') ? prepAhead.forDinner : undefined,
  };

  return normalized.forBreakfast || normalized.forLunch || normalized.forDinner
    ? normalized
    : undefined;
}

export function normalizeDayForSelectedMeals<T extends DayPlan>(
  day: T,
  values?: Array<string | null | undefined>,
  showPrepReminders: boolean = true
): T {
  const selectedMeals = normalizeSelectedMeals(values);

  return {
    ...day,
    breakfast: selectedMeals.includes('breakfast') ? day.breakfast || '' : '',
    lunch: selectedMeals.includes('lunch') ? day.lunch || '' : '',
    dinner: selectedMeals.includes('dinner') ? day.dinner || '' : '',
    prepAhead: normalizePrepAheadForSelectedMeals(day.prepAhead, selectedMeals, showPrepReminders),
  };
}

export function normalizeWeeklyPlanForSelectedMeals(
  plan?: WeeklyPlan | null,
  values?: Array<string | null | undefined>,
  showPrepReminders: boolean = true
): WeeklyPlan {
  return {
    days: (plan?.days || []).map((day) => normalizeDayForSelectedMeals(day, values, showPrepReminders)),
    alternatives: normalizeAlternativesForSelectedMeals(plan?.alternatives, values),
  };
}

export function normalizeAlternativesForSelectedMeals(
  alternatives?: MealAlternatives | null,
  values?: Array<string | null | undefined>
): MealAlternatives {
  const selectedMeals = normalizeSelectedMeals(values);

  return {
    breakfast: selectedMeals.includes('breakfast') ? alternatives?.breakfast || [] : [],
    lunch: selectedMeals.includes('lunch') ? alternatives?.lunch || [] : [],
    dinner: selectedMeals.includes('dinner') ? alternatives?.dinner || [] : [],
  };
}

export function getVisibleMealTypesForDay(
  day: Pick<DayPlan, 'breakfast' | 'lunch' | 'dinner'>,
  values?: Array<string | null | undefined>
): SelectableMealType[] {
  const selectedMeals = normalizeSelectedMeals(values);
  const visibleMeals = ALL_MEAL_TYPES.filter((mealType) => (
    selectedMeals.includes(mealType) || Boolean(day[mealType]?.trim())
  ));

  return visibleMeals.length > 0 ? visibleMeals : selectedMeals;
}
