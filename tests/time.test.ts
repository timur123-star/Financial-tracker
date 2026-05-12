import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  nextMonth,
  previousWeekRange,
} from '../src/time.js';

describe('time helpers', () => {
  const tz = 'Europe/Moscow';
  // Tue 2026-05-12 12:37 UTC = 2026-05-12 15:37 MSK
  const now = new Date('2026-05-12T12:37:00Z');

  it('startOfDay for MSK', () => {
    // 2026-05-12 00:00 MSK = 2026-05-11 21:00 UTC
    expect(startOfDay(tz, now).toISOString()).toBe('2026-05-11T21:00:00.000Z');
  });

  it('startOfWeek (Monday) for MSK', () => {
    // 2026-05-11 00:00 MSK = 2026-05-10 21:00 UTC
    expect(startOfWeek(tz, now).toISOString()).toBe('2026-05-10T21:00:00.000Z');
  });

  it('startOfMonth and nextMonth', () => {
    const m = startOfMonth(tz, now);
    // 2026-05-01 00:00 MSK = 2026-04-30 21:00 UTC
    expect(m.toISOString()).toBe('2026-04-30T21:00:00.000Z');
    const n = nextMonth(tz, m);
    // 2026-06-01 00:00 MSK = 2026-05-31 21:00 UTC
    expect(n.toISOString()).toBe('2026-05-31T21:00:00.000Z');
  });

  it('previousWeekRange covers exactly the prior 7 days', () => {
    const p = previousWeekRange(tz, now);
    const diff = (p.to.getTime() - p.from.getTime()) / (24 * 3600 * 1000);
    expect(diff).toBe(7);
    expect(p.to.toISOString()).toBe('2026-05-10T21:00:00.000Z');
  });
});
