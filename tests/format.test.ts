import { describe, it, expect } from 'vitest';
import {
  rublesToKopecks,
  kopecksToRubles,
  formatAmount,
  capitalize,
  escapeHtml,
} from '../src/format.js';

describe('format', () => {
  it('converts rubles ↔ kopecks safely (integer arithmetic)', () => {
    expect(rublesToKopecks(800)).toBe(80000);
    expect(rublesToKopecks(0.1)).toBe(10);
    expect(rublesToKopecks(0.2)).toBe(20);
    // The classic 0.1 + 0.2 ≠ 0.3 problem must not appear:
    expect(rublesToKopecks(0.1) + rublesToKopecks(0.2)).toBe(30);
    expect(kopecksToRubles(80000)).toBe(800);
  });

  it('formats amounts with currency symbol', () => {
    expect(formatAmount(80000, '₽')).toMatch(/800/);
    expect(formatAmount(80050, '₽')).toMatch(/800,5/);
  });

  it('capitalize / escapeHtml', () => {
    expect(capitalize('еда')).toBe('Еда');
    expect(escapeHtml('<b>x&y</b>')).toBe('&lt;b&gt;x&amp;y&lt;/b&gt;');
  });
});
