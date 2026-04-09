import { describe, expect, it } from 'vitest';
import { formatCompactDate, formatCompactDateRange, normalizeCompactDateRangeLabel } from './dateRange';

describe('dateRange helpers', () => {
  it('formats single dates and ranges as DDMMMYYYY', () => {
    expect(formatCompactDate('2026-04-07')).toBe('07APR2026');
    expect(formatCompactDateRange('2026-04-07', '2026-04-13')).toBe('07APR2026 - 13APR2026');
  });

  it('normalizes legacy grocery range labels into the compact uppercase format', () => {
    expect(normalizeCompactDateRangeLabel('Apr 7 - Apr 13, 2026')).toBe('07APR2026 - 13APR2026');
    expect(normalizeCompactDateRangeLabel('07APR2026 - 13APR2026')).toBe('07APR2026 - 13APR2026');
  });
});
