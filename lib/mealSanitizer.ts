import type { DayPlan, GroceryItem, MealAlternatives, PrepAhead, WeeklyPlan } from '../types';

const EMPTY_VALUE_PATTERN = /^(null|undefined|none|n\/a)$/i;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizePlainText(value?: string | null): string {
  if (!value) {
    return '';
  }

  const cleaned = collapseWhitespace(
    value
      .replace(/\r/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/^[\s•*\-]+/, '')
  );

  return EMPTY_VALUE_PATTERN.test(cleaned) ? '' : cleaned;
}

function sanitizeMealLine(value: string): string | null {
  const cleaned = sanitizePlainText(value);

  if (!cleaned) {
    return null;
  }

  const withoutBulletOnly = cleaned.replace(/^[•*\-]+\s*/, '').trim();
  if (!withoutBulletOnly || EMPTY_VALUE_PATTERN.test(withoutBulletOnly)) {
    return null;
  }

  return withoutBulletOnly;
}

export function sanitizeMealText(value?: string | null): string {
  if (!value) {
    return '';
  }

  const normalized = value.replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const splitByBullets = normalized.includes('\n')
    ? normalized.split(/\n+/)
    : normalized.split(/[•·]/);

  const items = splitByBullets
    .map((line) => sanitizeMealLine(line))
    .filter((line): line is string => Boolean(line));

  return items.join('\n');
}

function sanitizePrepAheadEntry(value?: string | null): string | undefined {
  const cleaned = sanitizePlainText(value);
  return cleaned || undefined;
}

export function sanitizePrepAhead(prepAhead?: PrepAhead | null): PrepAhead | undefined {
  if (!prepAhead) {
    return undefined;
  }

  const sanitized: PrepAhead = {
    forBreakfast: sanitizePrepAheadEntry(prepAhead.forBreakfast),
    forLunch: sanitizePrepAheadEntry(prepAhead.forLunch),
    forDinner: sanitizePrepAheadEntry(prepAhead.forDinner),
  };

  return sanitized.forBreakfast || sanitized.forLunch || sanitized.forDinner
    ? sanitized
    : undefined;
}

export function sanitizeMealAlternatives(alternatives?: MealAlternatives | null): MealAlternatives | null {
  if (!alternatives) {
    return null;
  }

  const sanitizeBucket = (items?: string[]) => (
    (items || [])
      .map((item) => sanitizeMealText(item))
      .filter(Boolean)
  );

  return {
    breakfast: sanitizeBucket(alternatives.breakfast),
    lunch: sanitizeBucket(alternatives.lunch),
    dinner: sanitizeBucket(alternatives.dinner),
  };
}

export function sanitizeDayPlan(day: DayPlan): DayPlan {
  return {
    ...day,
    day: sanitizePlainText(day.day) || day.day,
    breakfast: sanitizeMealText(day.breakfast),
    lunch: sanitizeMealText(day.lunch),
    dinner: sanitizeMealText(day.dinner),
    prepAhead: sanitizePrepAhead(day.prepAhead),
    alternatives: sanitizeMealAlternatives(day.alternatives) || undefined,
  };
}

export function sanitizeWeeklyPlan<T extends WeeklyPlan>(plan: T): T;
export function sanitizeWeeklyPlan(plan?: WeeklyPlan | null): WeeklyPlan;
export function sanitizeWeeklyPlan<T extends WeeklyPlan>(plan?: T | WeeklyPlan | null): T | WeeklyPlan {
  return {
    ...(plan || {}),
    days: (plan?.days || []).map((day) => sanitizeDayPlan(day)),
    alternatives: sanitizeMealAlternatives(plan?.alternatives) || undefined,
  } as T | WeeklyPlan;
}

export function sanitizeGroceryItems(items?: GroceryItem[] | null): GroceryItem[] {
  return (items || [])
    .map((item) => ({
      ...item,
      category: sanitizePlainText(item.category) || 'Other',
      item: sanitizePlainText(item.item),
      quantity: sanitizePlainText(item.quantity),
      checked: Boolean(item.checked),
      homeStatus: item.homeStatus || 'none',
    }))
    .filter((item) => Boolean(item.item));
}
