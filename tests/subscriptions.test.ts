import { describe, it, expect } from 'vitest';
import { advance } from '../src/subscriptions.js';

describe('subscriptions.advance', () => {
  it('advances by one day', () => {
    const from = new Date('2026-05-12T00:00:00Z');
    expect(advance(from, 'daily').toISOString()).toBe('2026-05-13T00:00:00.000Z');
  });

  it('advances by seven days for weekly', () => {
    const from = new Date('2026-05-12T00:00:00Z');
    expect(advance(from, 'weekly').toISOString()).toBe('2026-05-19T00:00:00.000Z');
  });

  it('advances by one calendar month, preserving day of month', () => {
    const from = new Date('2026-05-12T00:00:00Z');
    expect(advance(from, 'monthly').toISOString()).toBe('2026-06-12T00:00:00.000Z');
  });

  it('rolls year-end correctly', () => {
    const from = new Date('2026-12-31T00:00:00Z');
    // adding 1 month to Dec 31 → Jan 31 next year
    expect(advance(from, 'monthly').toISOString()).toBe('2027-01-31T00:00:00.000Z');
  });

  it('advances by one year', () => {
    const from = new Date('2026-05-12T00:00:00Z');
    expect(advance(from, 'yearly').toISOString()).toBe('2027-05-12T00:00:00.000Z');
  });
});
