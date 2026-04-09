import { describe, expect, it } from 'vitest';
import { applySparseMealUpdatesToDay, normalizeSparseAlternativesForSelectedMeals } from './mealSelection';

describe('normalizeSparseAlternativesForSelectedMeals', () => {
  it('returns only requested meal keys for sparse smart-edit results', () => {
    const alternatives = normalizeSparseAlternativesForSelectedMeals(
      {
        breakfast: ['Oats Chilla'],
        lunch: ['Dal Khichdi'],
        dinner: ['Paneer Bowl'],
      },
      ['breakfast', 'dinner']
    );

    expect(alternatives).toEqual({
      breakfast: ['Oats Chilla'],
      dinner: ['Paneer Bowl'],
    });
  });
});

describe('applySparseMealUpdatesToDay', () => {
  it('preserves untouched meals when only one slot is updated', () => {
    const updatedDay = applySparseMealUpdatesToDay(
      {
        day: '2026-04-06',
        breakfast: 'Poha',
        lunch: 'Rajma Chawal',
        dinner: 'Soup',
      },
      { breakfast: 'Moong Chilla' }
    );

    expect(updatedDay).toEqual({
      day: '2026-04-06',
      breakfast: 'Moong Chilla',
      lunch: 'Rajma Chawal',
      dinner: 'Soup',
    });
  });
});
