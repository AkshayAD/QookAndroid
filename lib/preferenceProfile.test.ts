import { describe, expect, it } from 'vitest';
import type { PreferenceProfile } from '../types';
import { mergePreferenceSummaryIntoProfile } from './preferenceProfile';

describe('mergePreferenceSummaryIntoProfile', () => {
  it('merges only the learned preference fields case-insensitively', () => {
    const profile: PreferenceProfile = {
      id: 'profile-1',
      name: 'Home',
      dietaryType: 'Vegetarian',
      allergies: ['Peanut'],
      dislikes: ['Bottle Gourd'],
      breakfastPreferences: ['Poha'],
      lunchPreferences: ['Rajma Chawal'],
      dinnerPreferences: ['Soup'],
      specialInstructions: 'Less oil',
      pantryStaples: ['Rice'],
    };

    const merged = mergePreferenceSummaryIntoProfile(profile, {
      signalIds: [],
      meaningfulSignalCount: 4,
      breakfastPreferences: ['poha', 'Idli'],
      lunchPreferences: ['rajma chawal', 'Khichdi'],
      dinnerPreferences: ['SOUP', 'Paneer Bhurji'],
      dislikes: ['bottle gourd', 'Bitter Gourd'],
      positiveFocus: [],
      negativeFocus: [],
      summary: '',
    });

    expect(merged.breakfastPreferences).toEqual(['Poha', 'Idli']);
    expect(merged.lunchPreferences).toEqual(['Rajma Chawal', 'Khichdi']);
    expect(merged.dinnerPreferences).toEqual(['Soup', 'Paneer Bhurji']);
    expect(merged.dislikes).toEqual(['Bottle Gourd', 'Bitter Gourd']);
    expect(merged.specialInstructions).toBe('Less oil');
    expect(merged.pantryStaples).toEqual(['Rice']);
  });
});
