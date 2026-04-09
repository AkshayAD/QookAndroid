import { addDays, format, parseISO } from 'date-fns';
import type { DayPlan, PersistedWeeklyPlan, PlannerDateResolution, Schedule } from '../types';

type MealShape = Pick<DayPlan, 'breakfast' | 'lunch' | 'dinner'> | null | undefined;

export function toDateKey(date: Date | string): string {
  return typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
}

export function createBlankDayPlan(dateKey: string): DayPlan {
  return {
    day: dateKey,
    breakfast: '',
    lunch: '',
    dinner: '',
  };
}

export function hasPlannedMeals(day?: MealShape): boolean {
  return Boolean(day?.breakfast?.trim() || day?.lunch?.trim() || day?.dinner?.trim());
}

function normalizeResolvedDay(dateKey: string, day?: DayPlan | null): DayPlan {
  if (!day) {
    return createBlankDayPlan(dateKey);
  }

  return {
    ...createBlankDayPlan(dateKey),
    ...day,
    day: dateKey,
  };
}

export function resolvePlannerDate(
  schedule: Schedule,
  date: Date | string
): PlannerDateResolution {
  const dateKey = toDateKey(date);
  const scheduledDay = schedule[dateKey];
  if (scheduledDay) {
    const normalizedScheduledDay = normalizeResolvedDay(dateKey, scheduledDay);
    return {
      dateKey,
      day: normalizedScheduledDay,
      source: 'schedule',
      hasMeals: hasPlannedMeals(normalizedScheduledDay),
    };
  }

  return {
    dateKey,
    day: createBlankDayPlan(dateKey),
    source: 'blank',
    hasMeals: false,
  };
}

export function buildWeekFromSchedule(schedule: Schedule, weekStartDate: string, length: number = 7): PersistedWeeklyPlan {
  return {
    weekStartDate,
    days: Array.from({ length }, (_, index) => {
      const dateKey = format(addDays(parseISO(weekStartDate), index), 'yyyy-MM-dd');
      return normalizeResolvedDay(dateKey, schedule[dateKey]);
    }),
  };
}
