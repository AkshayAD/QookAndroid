import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PreferenceLearningSheet from './PreferenceLearningSheet';

describe('PreferenceLearningSheet', () => {
  it('routes the empty-state preferences action through the provided callback', async () => {
    const user = userEvent.setup();
    const onOpenPreferences = vi.fn();
    const onApply = vi.fn();

    render(
      <PreferenceLearningSheet
        isOpen={true}
        summary={{
          signalIds: ['signal-1'],
          meaningfulSignalCount: 1,
          breakfastPreferences: [],
          lunchPreferences: [],
          dinnerPreferences: [],
          dislikes: [],
          positiveFocus: ['quick meals'],
          negativeFocus: [],
          summary: 'Qook noticed you keep choosing quick meals.',
        }}
        onClose={vi.fn()}
        onApply={onApply}
        onDismiss={vi.fn()}
        onOpenPreferences={onOpenPreferences}
      />
    );

    await user.click(screen.getByRole('button', { name: /open full preferences/i }));
    await user.click(screen.getByRole('button', { name: /apply to preferences/i }));

    expect(onOpenPreferences).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /apply to preferences/i })).toBeEnabled();
  });
});
