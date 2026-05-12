import { describe, it, expect } from 'vitest';
import { parseCsv } from '../src/csvImport.js';

describe('csvImport.parseCsv', () => {
  it('parses an export-shaped CSV round-trip', () => {
    const csv =
      'id,datetime_local,type,category,amount,currency,note,raw_text\n' +
      '1,2026-05-12 14:30:00,expense,еда,800.00,RUB,продукты,потратил 800 на продукты\n' +
      '2,2026-05-12 18:00:00,expense,транспорт,350,RUB,такси,такси 350\n' +
      '3,2026-05-13 09:00:00,income,зарплата,85000,RUB,,зп пришла 85000\n';
    const r = parseCsv(csv, 1000);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({
      type: 'expense',
      category: 'еда',
      amountKopecks: 80000,
      note: 'продукты',
    });
    expect(r.rows[2]).toMatchObject({
      type: 'income',
      category: 'зарплата',
      amountKopecks: 8_500_000,
    });
  });

  it('rejects missing required columns', () => {
    const csv = 'id,foo,bar\n1,2,3\n';
    const r = parseCsv(csv, 1000);
    expect(r.rows).toEqual([]);
    expect(r.errors[0].reason).toMatch(/нет столбца/);
  });

  it('skips invalid rows but keeps valid ones (normalises unknown category to "прочее")', () => {
    const csv =
      'type,category,amount\n' +
      'expense,еда,800\n' +
      'expense,unknown_cat,500\n' +
      'expense,еда,not_a_number\n' +
      ',еда,100\n' +
      'income,зарплата,90000\n';
    const r = parseCsv(csv, 1000);
    // 3 valid rows (unknown_cat normalises to "прочее"); 2 errors (bad amount, bad type).
    expect(r.rows.length).toBe(3);
    expect(r.errors.length).toBe(2);
    expect(r.rows[0].category).toBe('еда');
    expect(r.rows[1].category).toBe('прочее');
    expect(r.rows[2].category).toBe('зарплата');
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = 'type,category,amount,note\nexpense,еда,800,"продукты, потом кофе"\n';
    const r = parseCsv(csv, 1000);
    expect(r.rows[0].note).toBe('продукты, потом кофе');
  });

  it('caps imports at maxRows', () => {
    const head = 'type,category,amount\n';
    const lines = Array.from({ length: 20 }, () => 'expense,еда,100').join('\n');
    const r = parseCsv(head + lines, 5);
    expect(r.rows.length).toBe(5);
    expect(r.errors.some((e) => /превышает лимит/.test(e.reason))).toBe(true);
  });

  it('strips UTF-8 BOM produced by Excel', () => {
    const csv = '\uFEFFtype,category,amount\nexpense,еда,123\n';
    const r = parseCsv(csv, 1000);
    expect(r.rows.length).toBe(1);
  });
});
