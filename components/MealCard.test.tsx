import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MealCard from './MealCard';

vi.mock('../contexts/FamilyContext', () => ({
  useFamily: () => ({
    isInFamily: false,
    isFamilyModeActive: false,
  }),
}));

vi.mock('../hooks/useFeatureGate', () => ({
  useFeatureGate: () => ({
    canAccess: () => true,
  }),
}));

vi.mock('./FeatureGateModal', () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MealCard', () => {
  it('opens recipes only from the explicit recipe action', async () => {
    const user = userEvent.setup();
    const onOpenRecipe = vi.fn();

    render(
      <MealCard
        dayPlan={{ day: 'Monday', breakfast: 'Poha', lunch: '', dinner: '' }}
        dayIndex={0}
        onRegenerate={vi.fn()}
        onSmartEdit={vi.fn()}
        isLoading={false}
        onOpenRecipe={onOpenRecipe}
      />
    );

    await user.click(screen.getByText('Poha'));
    expect(onOpenRecipe).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /recipe/i }));
    expect(onOpenRecipe).toHaveBeenCalledTimes(1);
    expect(onOpenRecipe).toHaveBeenCalledWith('Poha');
  });

  it('renders one smart edit action on desktop', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);

    render(
      <MealCard
        dayPlan={{ day: 'Monday', breakfast: 'Poha', lunch: 'Rajma', dinner: 'Soup' }}
        dayIndex={0}
        onRegenerate={vi.fn()}
        onSmartEdit={vi.fn()}
        isLoading={false}
        onMealUpdate={vi.fn()}
      />
    );

    expect(screen.getAllByRole('button', { name: /edit with ai/i })).toHaveLength(1);
  });
});
