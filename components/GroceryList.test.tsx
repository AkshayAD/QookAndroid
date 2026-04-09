import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GroceryList from './GroceryList';

vi.mock('../services/supabaseService', () => ({
  getGroceryListHistory: vi.fn().mockResolvedValue([
    {
      id: 'saved-1',
      name: 'Saved List',
      items: [{ item: 'Milk', quantity: '1 litre', category: 'Dairy', checked: false }],
      dateRange: 'Apr 7 - Apr 13, 2026',
      createdAt: '2026-04-07T09:00:00.000Z',
    },
  ]),
  deleteGroceryList: vi.fn().mockResolvedValue(undefined),
  saveGroceryListToHistory: vi.fn().mockResolvedValue(undefined),
}));

describe('GroceryList', () => {
  it('shows the active grocery header range using the compact DDMMMYYYY format', () => {
    render(
      <GroceryList
        items={[{ item: 'Tomatoes', quantity: '4', category: 'Produce', checked: false }]}
        currentDateRange="07APR2026 - 13APR2026"
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('07APR2026 - 13APR2026')).toBeInTheDocument();
  });

  it('shows saved grocery lists using the normalized compact range label', async () => {
    const user = userEvent.setup();

    render(
      <GroceryList
        items={[]}
        onToggle={vi.fn()}
        userId="user-1"
      />
    );

    await user.click(await screen.findByRole('button', { name: /saved lists/i }));
    expect(await screen.findByRole('button', { name: /07APR2026 - 13APR2026/i })).toBeInTheDocument();
  });
});
