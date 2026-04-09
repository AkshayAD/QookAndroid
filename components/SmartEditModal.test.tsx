import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SmartEditModal from './SmartEditModal';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: {
    Base64: 'base64',
  },
  CameraSource: {
    Camera: 'camera',
    Photos: 'photos',
  },
}));

afterEach(() => {
  cleanup();
});

describe('SmartEditModal', () => {
  it('submits only the selected meal keys instead of dense blank updates', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onAnalyze = vi.fn().mockResolvedValue({
      options: {
        breakfast: ['Moong Chilla'],
      },
    });

    render(
      <SmartEditModal
        dayPlan={{ day: 'Monday', breakfast: 'Poha', lunch: 'Rajma', dinner: 'Soup' }}
        enabledMealTypes={['breakfast', 'lunch']}
        onAnalyze={onAnalyze}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    await user.type(screen.getAllByRole('textbox')[0], 'Make breakfast lighter');
    await user.click(screen.getAllByTitle(/generate meal options/i)[0]);
    await screen.findByText(/option 1/i);
    await user.click(screen.getByRole('button', { name: /apply selected options/i }));

    expect(onConfirm).toHaveBeenCalledWith({ breakfast: 'Moong Chilla' });
  });

  it('blocks apply when a selected meal did not receive any options', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onAnalyze = vi.fn().mockResolvedValue({
      options: {
        breakfast: ['Moong Chilla'],
      },
    });

    render(
      <SmartEditModal
        dayPlan={{ day: 'Monday', breakfast: 'Poha', lunch: 'Rajma', dinner: 'Soup' }}
        enabledMealTypes={['breakfast', 'lunch']}
        onAnalyze={onAnalyze}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /^Lunch$/i })[0]);
    await user.type(screen.getAllByRole('textbox')[0], 'Lighten breakfast and lunch');
    await user.click(screen.getAllByTitle(/generate meal options/i)[0]);
    await screen.findByText(/no lunch options came back/i);
    await user.click(screen.getByRole('button', { name: /apply selected options/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/could not generate a lunch option/i)).toBeTruthy();
  });
});
