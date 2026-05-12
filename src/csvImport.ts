/**
 * CSV import — accepts the same shape that `/export` produces:
 *
 *     id, datetime_local, type, category, amount, currency, note, raw_text
 *
 * Returns parsed rows ready for insertion. Anything unparseable is returned in
 * `errors` (line number + reason) so the caller can summarise the result for
 * the user without aborting the entire upload.
 */

import { CATEGORIES, normalizeCategory } from './categories.js';
import { rublesToKopecks } from './format.js';

export interface ParsedCsvRow {
  type: 'expense' | 'income';
  category: string;
  amountKopecks: number;
  note: string | null;
  rawText: string | null;
  occurredAt: Date | null;
}

export interface CsvImportError {
  line: number;
  reason: string;
}

export interface CsvImportResult {
  rows: ParsedCsvRow[];
  errors: CsvImportError[];
  totalRows: number;
}

const REQUIRED_FIELDS = ['type', 'category', 'amount'];

/** Minimal RFC4180-ish CSV line splitter (handles quoted fields + `""` escape). */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  result.push(cur);
  return result;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9,.-]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d;
  // Try `YYYY-MM-DD HH:mm:ss` (export format) → coerce to ISO.
  const iso = raw.replace(' ', 'T');
  const d2 = new Date(iso);
  return Number.isFinite(d2.getTime()) ? d2 : null;
}

export function parseCsv(content: string, maxRows: number): CsvImportResult {
  // Strip UTF-8 BOM (Excel adds one).
  const stripped = content.replace(/^\uFEFF/, '');
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, reason: 'файл пуст' }], totalRows: 0 };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const colIdx = new Map<string, number>();
  header.forEach((name, i) => colIdx.set(name, i));

  for (const required of REQUIRED_FIELDS) {
    if (!colIdx.has(required)) {
      return {
        rows: [],
        errors: [
          {
            line: 1,
            reason: `в заголовке нет столбца «${required}». Жду: ${REQUIRED_FIELDS.join(', ')}.`,
          },
        ],
        totalRows: 0,
      };
    }
  }

  const rows: ParsedCsvRow[] = [];
  const errors: CsvImportError[] = [];

  const dataLines = lines.slice(1, 1 + maxRows);
  for (let i = 0; i < dataLines.length; i++) {
    const lineNo = i + 2; // header is line 1
    const cells = splitCsvLine(dataLines[i]);
    const get = (name: string): string => (cells[colIdx.get(name) ?? -1] ?? '').trim();

    const typeRaw = get('type').toLowerCase();
    if (typeRaw !== 'expense' && typeRaw !== 'income') {
      errors.push({
        line: lineNo,
        reason: `тип «${typeRaw}» не expense/income`,
      });
      continue;
    }
    const categoryRaw = get('category');
    if (!categoryRaw) {
      errors.push({ line: lineNo, reason: 'пустая категория' });
      continue;
    }
    const cat = normalizeCategory(categoryRaw);
    if (!CATEGORIES.includes(cat)) {
      errors.push({ line: lineNo, reason: `неизвестная категория «${categoryRaw}»` });
      continue;
    }
    const amount = parseAmount(get('amount'));
    if (!amount) {
      errors.push({ line: lineNo, reason: `некорректная сумма «${get('amount')}»` });
      continue;
    }
    const noteRaw = get('note');
    const rawTextRaw = get('raw_text');
    const occurredAt = parseDate(get('datetime_local'));

    rows.push({
      type: typeRaw,
      category: cat,
      amountKopecks: rublesToKopecks(amount),
      note: noteRaw ? noteRaw : null,
      rawText: rawTextRaw ? rawTextRaw : null,
      occurredAt,
    });
  }

  if (lines.length - 1 > maxRows) {
    errors.push({
      line: maxRows + 2,
      reason: `файл превышает лимит ${maxRows} строк — оставлены только первые`,
    });
  }

  return { rows, errors, totalRows: lines.length - 1 };
}
