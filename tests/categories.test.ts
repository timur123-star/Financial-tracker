import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryColor, categoryEmoji, normalizeCategory } from '../src/categories.js';

describe('categories', () => {
  it('has exactly the 10 categories from the guide', () => {
    expect(CATEGORIES).toHaveLength(10);
    expect(CATEGORIES).toContain('еда');
    expect(CATEGORIES).toContain('зарплата');
    expect(CATEGORIES).toContain('прочее');
  });

  it('normalizes common aliases', () => {
    expect(normalizeCategory('продукты')).toBe('еда');
    expect(normalizeCategory('такси')).toBe('транспорт');
    expect(normalizeCategory('кофе')).toBe('кафе');
    expect(normalizeCategory('зп')).toBe('зарплата');
    expect(normalizeCategory('food')).toBe('еда');
    expect(normalizeCategory('гарбидж')).toBe('прочее');
  });

  it('returns emoji/color for every category', () => {
    for (const c of CATEGORIES) {
      expect(categoryEmoji(c)).toBeTruthy();
      expect(categoryColor(c)).toMatch(/^#/);
    }
  });
});
