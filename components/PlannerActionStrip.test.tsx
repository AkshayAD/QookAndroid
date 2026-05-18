import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlannerActionStrip from './PlannerActionStrip';

afterEach(() => {
  cleanup();
});

describe('PlannerActionStrip', () => {
  it('omits planner setup and renders share as an icon action', () => {
    render(
      <PlannerActionStrip
        currentProfileId="profile-1"
        profiles={[{ id: 'profile-1', name: 'Default' }]}
        hasVisibleWeekMeals={true}
        loading={false}
        onProfileChange={vi.fn()}
        onGeneratePlan={vi.fn()}
        onOpenSavedRecipes={vi.fn()}
        onShare={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /setup/i })).toBeNull();
    expect(screen.getByRole('button', { name: /share plan/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Share$/)).toBeNull();
  });
});
