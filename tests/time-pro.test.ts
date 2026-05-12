import { describe, it, expect } from 'vitest';
import {
  startOfQuarter,
  startOfYear,
  nextQuarter,
  nextYear,
  previousDay,
  previousWeek,
  previousMonth,
  formatMonthName,
  formatRangeLabel,
} from '../src/time.js';

const tz = 'Europe/Moscow';
// Tue 2026-05-12 12:37 UTC = 2026-05-12 15:37 MSK
const now = new Date('2026-05-12T12:37:00Z');

describe('time-pro helpers', () => {
  it('startOfQuarter → Q2 starts 2026-04-01 MSK', () => {
    expect(startOfQuarter(tz, now).toISOString()).toBe('2026-03-31T21:00:00.000Z');
  });

  it('startOfYear → 2026-01-01 MSK', () => {
    expect(startOfYear(tz, now).toISOString()).toBe('2025-12-31T21:00:00.000Z');
  });

  it('nextQuarter advances by 3 calendar months', () => {
    const q = startOfQuarter(tz, now);
    const nq = nextQuarter(tz, q);
    expect(nq.toISOString()).toBe('2026-06-30T21:00:00.000Z');
  });

  it('nextYear advances by one year', () => {
    const y = startOfYear(tz, now);
    expect(nextYear(tz, y).toISOString()).toBe('2026-12-31T21:00:00.000Z');
  });

  it('previousDay/Week/Month return start of previous unit (MSK)', () => {
    // start of yesterday 00:00 MSK = 2026-05-10 21:00 UTC
    expect(previousDay(tz, now).toISOString()).toBe('2026-05-10T21:00:00.000Z');
    // start of last week's Monday 00:00 MSK = 2026-05-03 21:00 UTC
    expect(previousWeek(tz, now).toISOString()).toBe('2026-05-03T21:00:00.000Z');
    // start of previous month (April) 00:00 MSK = 2026-03-31 21:00 UTC
    expect(previousMonth(tz, now).toISOString()).toBe('2026-03-31T21:00:00.000Z');
  });

  it('formatMonthName returns localised Russian month name', () => {
    expect(formatMonthName(tz, now).toLowerCase()).toContain('май');
  });

  it('formatRangeLabel produces a short range label', () => {
    const from = new Date('2026-05-04T21:00:00Z');
    const to = new Date('2026-05-11T20:59:59Z');
    const label = formatRangeLabel(tz, from, to);
    expect(label).toMatch(/05/);
  });
});
