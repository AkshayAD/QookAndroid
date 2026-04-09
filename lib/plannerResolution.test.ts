import { describe, expect, it } from 'vitest';
import { buildWeekFromSchedule, resolvePlannerDate } from './plannerResolution';
import type { Schedule } from '../types';

describe('resolvePlannerDate', () => {
    it('returns saved schedule meals for planned dates', () => {
        const schedule: Schedule = {
            '2026-04-05': { day: '2026-04-05', breakfast: 'Idli', lunch: 'Rajma', dinner: 'Khichdi' },
        };

        const resolved = resolvePlannerDate(schedule, '2026-04-05');

        expect(resolved.source).toBe('schedule');
        expect(resolved.day.breakfast).toBe('Idli');
        expect(resolved.hasMeals).toBe(true);
    });

    it('preserves blank schedule slots when a day exists without meals', () => {
        const schedule: Schedule = {
            '2026-04-06': { day: '2026-04-06', breakfast: '', lunch: '', dinner: '' },
        };

        const resolved = resolvePlannerDate(schedule, '2026-04-06');

        expect(resolved.source).toBe('schedule');
        expect(resolved.hasMeals).toBe(false);
        expect(resolved.day.breakfast).toBe('');
    });

    it('returns scheduled meals for any loaded date', () => {
        const schedule: Schedule = {
            '2026-04-12': { day: '2026-04-12', breakfast: '', lunch: 'Rajma', dinner: 'Khichdi' },
        };

        const resolved = resolvePlannerDate(schedule, '2026-04-12');

        expect(resolved.source).toBe('schedule');
        expect(resolved.day.lunch).toBe('Rajma');
        expect(resolved.hasMeals).toBe(true);
    });

    it('returns a blank day when nothing is planned', () => {
        const resolved = resolvePlannerDate({}, '2026-04-20');

        expect(resolved.source).toBe('blank');
        expect(resolved.hasMeals).toBe(false);
        expect(resolved.day).toEqual({
            day: '2026-04-20',
            breakfast: '',
            lunch: '',
            dinner: '',
        });
    });
});

describe('buildWeekFromSchedule', () => {
    it('anchors the derived planner week to the requested start date', () => {
        const schedule: Schedule = {
            '2026-04-08': { day: '2026-04-08', breakfast: 'Upma', lunch: '', dinner: '' },
        };

        const plan = buildWeekFromSchedule(schedule, '2026-04-08');

        expect(plan.weekStartDate).toBe('2026-04-08');
        expect(plan.days).toHaveLength(7);
        expect(plan.days[0].day).toBe('2026-04-08');
        expect(plan.days[0].breakfast).toBe('Upma');
    });
});
