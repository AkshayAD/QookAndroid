import type { PreferenceProfile, PreferenceSignalSummary } from '../types';

function normalizePreferenceValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function mergeCaseInsensitivePreferenceValues(
  existing: string[] = [],
  additions: string[] = []
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  [...existing, ...additions].forEach((value) => {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return;
    }

    const normalized = normalizePreferenceValue(cleaned);
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    merged.push(cleaned);
  });

  return merged;
}

export function mergePreferenceSummaryIntoProfile(
  profile: PreferenceProfile,
  summary: Pick<PreferenceSignalSummary, 'breakfastPreferences' | 'lunchPreferences' | 'dinnerPreferences' | 'dislikes'>
): PreferenceProfile {
  return {
    ...profile,
    breakfastPreferences: mergeCaseInsensitivePreferenceValues(
      profile.breakfastPreferences,
      summary.breakfastPreferences
    ),
    lunchPreferences: mergeCaseInsensitivePreferenceValues(
      profile.lunchPreferences,
      summary.lunchPreferences
    ),
    dinnerPreferences: mergeCaseInsensitivePreferenceValues(
      profile.dinnerPreferences,
      summary.dinnerPreferences
    ),
    dislikes: mergeCaseInsensitivePreferenceValues(
      profile.dislikes,
      summary.dislikes
    ),
  };
}
