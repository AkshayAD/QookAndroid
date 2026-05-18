import { describe, expect, it } from 'vitest';
import { createTrustProgress, deriveMenuGenerationCount } from './trustActions';

describe('createTrustProgress', () => {
  it('excludes legacy install_pwa from active trust progress while keeping active totals intact', () => {
    const progress = createTrustProgress([
      { action_type: 'signup', credits_awarded: 2, completed_at: '2026-04-07T00:00:00.000Z' },
      { action_type: 'install_pwa', credits_awarded: 1, completed_at: '2026-04-07T00:00:00.000Z' },
    ]);

    expect(progress.completed.map((action) => action.action_type)).toEqual(['signup']);
    expect(progress.pending).toContain('generate_second_menu');
    expect(progress.pending).not.toContain('install_pwa');
    expect(progress.totalCreditsEarned).toBe(2);
    expect(progress.maxPossibleCredits).toBe(6);
  });
});

describe('deriveMenuGenerationCount', () => {
  it('prefers the durable event count when available', () => {
    expect(deriveMenuGenerationCount({
      durableCount: 3,
      legacyCount: 1,
      hasOnboardingCompleted: true,
      hasSavedSchedule: true,
    })).toBe(3);
  });

  it('falls back to legacy weekly plan history when durable events are absent', () => {
    expect(deriveMenuGenerationCount({
      durableCount: 0,
      legacyCount: 2,
      hasOnboardingCompleted: false,
      hasSavedSchedule: true,
    })).toBe(2);
  });

  it('seeds onboarding baseline as menu #1 when history is otherwise empty', () => {
    expect(deriveMenuGenerationCount({
      durableCount: 0,
      legacyCount: 0,
      hasOnboardingCompleted: true,
      hasSavedSchedule: true,
    })).toBe(1);
  });

  it('does not seed onboarding baseline without both onboarding completion and a saved schedule', () => {
    expect(deriveMenuGenerationCount({
      durableCount: 0,
      legacyCount: 0,
      hasOnboardingCompleted: true,
      hasSavedSchedule: false,
    })).toBe(0);
  });
});
