import { describe, expect, it } from 'vitest';
import { buildCompactMealMemory, buildSharedGenerationContext } from './promptContext';

describe('buildCompactMealMemory', () => {
  it('uses explicit slot preferences first, then backfills from history, with tight caps', () => {
    const memory = buildCompactMealMemory(
      {
        breakfastPreferences: ['Poha', 'Idli', 'Upma', 'Paratha'],
        lunchPreferences: ['Rajma Chawal'],
        dinnerPreferences: ['Soup'],
        dislikes: ['Bottle Gourd', 'Bitter Gourd'],
      },
      {
        acceptedBreakfasts: ['Cheela', 'Dosa'],
        acceptedLunches: ['Khichdi', 'Curd Rice'],
        acceptedDinners: ['Paneer Bhurji', 'Soup'],
        softPositiveSignals: ['light meals', 'high protein meals', 'quick meals', 'spicy meals'],
        softNegativeSignals: ['oily meals', 'bitter gourd', 'repeated meals'],
        recentMeals: ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5', 'Meal 6', 'Meal 7', 'Meal 8', 'Meal 9', 'Meal 10'],
      }
    );

    expect(memory.breakfastExamples).toEqual(['Poha', 'Idli', 'Upma']);
    expect(memory.lunchExamples).toEqual(['Rajma Chawal', 'Khichdi', 'Curd Rice']);
    expect(memory.dinnerExamples).toEqual(['Soup', 'Paneer Bhurji']);
    expect(memory.positiveStyleTags).toEqual(['light meals', 'high protein meals', 'quick meals']);
    expect(memory.avoidTags).toEqual(['Bottle Gourd', 'Bitter Gourd', 'oily meals', 'repeated meals']);
    expect(memory.recentMeals).toHaveLength(9);
    expect(memory.promptText).toContain('Breakfast examples to lean toward: Poha, Idli, Upma');
    expect(memory.promptText).not.toContain('spicy meals');
    expect(memory.promptText).not.toContain('Meal 10');
  });
});

describe('buildSharedGenerationContext', () => {
  it('injects compact meal memory instead of the older verbose history block', () => {
    const context = buildSharedGenerationContext(
      {
        dietaryType: 'Vegetarian',
        breakfastPreferences: ['Poha'],
        lunchPreferences: ['Khichdi'],
        dinnerPreferences: ['Soup'],
        dislikes: ['Bottle Gourd'],
        pantryStaples: ['Rice'],
        mealsToPrepare: ['breakfast', 'lunch', 'dinner'],
      },
      {
        acceptedBreakfasts: ['Idli'],
        acceptedLunches: ['Curd Rice'],
        acceptedDinners: ['Paneer Bowl'],
        softPositiveSignals: ['quick meals'],
        softNegativeSignals: ['oily meals'],
        recentMeals: ['Meal 1', 'Meal 2'],
      }
    );

    expect(context.compactMealMemory.breakfastExamples).toEqual(['Poha', 'Idli']);
    expect(context.mealMemoryText).toContain('COMPACT MEAL MEMORY');
    expect(context.mealMemoryText).toContain('Hard avoids or reduce strongly: Bottle Gourd, oily meals');
    expect(context.mealMemoryText).toContain('Avoid repeating too soon: Meal 1, Meal 2');
    expect(context.mealMemoryText).not.toContain('Breakfast patterns:');
  });
});
