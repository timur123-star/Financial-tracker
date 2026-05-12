import { describe, it, expect } from 'vitest';

/**
 * Pure unit test of the forecast formula used in src/bot/services/reports.ts.
 * Kept as a local helper so we can test the math without spinning up Postgres.
 */
function forecast(opts: { expense: number; startMs: number; endMs: number; nowMs: number }): {
  forecast: number | null;
  daysElapsed: number;
  daysTotal: number;
} {
  const periodMs = opts.endMs - opts.startMs;
  const elapsedMs = Math.min(Math.max(opts.nowMs - opts.startMs, 0), periodMs);
  const daysTotal = Math.max(Math.round(periodMs / (24 * 3600 * 1000)), 1);
  const daysElapsedFractional = elapsedMs / (24 * 3600 * 1000);
  const daysElapsed = Math.max(Math.floor(daysElapsedFractional), 0);
  const result =
    daysElapsedFractional >= 0.5 && daysElapsedFractional < daysTotal && opts.expense > 0
      ? Math.round(opts.expense * (daysTotal / daysElapsedFractional))
      : null;
  return { forecast: result, daysElapsed, daysTotal };
}

const DAY = 24 * 3600 * 1000;

describe('forecast math', () => {
  it('projects linearly when partway through the period', () => {
    const start = new Date('2026-05-01T00:00:00Z').getTime();
    const end = new Date('2026-06-01T00:00:00Z').getTime(); // 31 days
    // 10 days in, spent 30 000 kopecks.
    const now = start + 10 * DAY;
    const r = forecast({ expense: 30_000, startMs: start, endMs: end, nowMs: now });
    expect(r.daysElapsed).toBe(10);
    expect(r.daysTotal).toBe(31);
    expect(r.forecast).toBe(Math.round((30_000 * 31) / 10));
  });

  it('returns null before half a day has elapsed', () => {
    const start = new Date('2026-05-01T00:00:00Z').getTime();
    const end = new Date('2026-06-01T00:00:00Z').getTime();
    const now = start + 1000 * 60 * 30; // 30 minutes in
    const r = forecast({ expense: 5000, startMs: start, endMs: end, nowMs: now });
    expect(r.forecast).toBeNull();
  });

  it('returns null when expense is zero', () => {
    const start = new Date('2026-05-01T00:00:00Z').getTime();
    const end = new Date('2026-06-01T00:00:00Z').getTime();
    const now = start + 5 * DAY;
    expect(forecast({ expense: 0, startMs: start, endMs: end, nowMs: now }).forecast).toBeNull();
  });

  it('returns null at end of period (no remaining days)', () => {
    const start = new Date('2026-05-01T00:00:00Z').getTime();
    const end = new Date('2026-05-02T00:00:00Z').getTime();
    const now = end; // exactly at end
    expect(forecast({ expense: 100, startMs: start, endMs: end, nowMs: now }).forecast).toBeNull();
  });
});
