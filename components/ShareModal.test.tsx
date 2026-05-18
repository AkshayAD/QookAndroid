import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShareModal from './ShareModal';
import { translateViaProxy } from '../services/aiProxyService';
import type { WeeklyPlan } from '../types';

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: {
    Cache: 'CACHE',
  },
  Filesystem: {
    writeFile: vi.fn(),
  },
}));

vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({
    apiKey: '',
    modelName: 'gemini-test',
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../hooks/useTrustActions', () => ({
  useShareMenuTrustAction: () => vi.fn(),
}));

vi.mock('../utils/platform', () => ({
  isNative: () => false,
}));

vi.mock('../services/aiProxyService', () => ({
  translateViaProxy: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ShareModal', () => {
  it('translates through the proxy with family group context and no local API key requirement', async () => {
    const user = userEvent.setup();
    const plan: WeeklyPlan = {
      days: [
        {
          day: 'Monday',
          breakfast: 'Poha',
          lunch: 'Rajma',
          dinner: 'Soup',
          prepAhead: { forLunch: 'Soak rajma overnight' },
        },
      ],
    };

    vi.mocked(translateViaProxy).mockResolvedValue({
      days: [
        {
          day: 'Somvar',
          breakfast: 'Poha hi',
          lunch: 'Rajma hi',
          dinner: 'Soup hi',
          prepAhead: { forLunch: 'Rajma bhigoen' },
        },
      ],
    });

    render(
      <ShareModal
        isOpen={true}
        onClose={vi.fn()}
        type="plan"
        data={plan}
        dateRange="May 11 - May 17, 2026"
        sourceLanguage="English"
        familyGroupId="family-1"
      />
    );

    await user.click(screen.getByRole('button', { name: /translate to hindi/i }));

    await waitFor(() => {
      expect(translateViaProxy).toHaveBeenCalledWith(
        'user-1',
        plan,
        'hi',
        'plan',
        'family-1',
        undefined
      );
    });
  });
});
