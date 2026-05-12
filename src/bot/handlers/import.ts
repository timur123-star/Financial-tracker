/**
 * CSV import handler — accepts a document upload (CSV) and bulk-inserts
 * transactions. Round-trips with `/export` perfectly: export a CSV from one
 * deployment, import into another, get identical state.
 */

import type { Telegraf, Context } from 'telegraf';
import { config } from '../../config.js';
import { log } from '../../logger.js';
import { metrics } from '../../metrics.js';
import { backToMenuKeyboard } from '../keyboards.js';
import { parseCsv } from '../../csvImport.js';
import { insertTransaction } from '../../transactions.js';
import { setPending } from '../../pendingInput.js';

async function downloadDocument(ctx: Context, fileId: string): Promise<Buffer> {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.toString());
  if (!res.ok) throw new Error(`document download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function showImportHelp(ctx: Context): Promise<void> {
  const text =
    '📥 <b>Импорт CSV</b>\n\n' +
    'Пришли .csv файл с такими колонками:\n' +
    '<code>id, datetime_local, type, category, amount, currency, note, raw_text</code>\n\n' +
    'Это ровно та же схема, что выдаёт <b>/export</b>. ' +
    'Удобно для переноса между серверами или восстановления из резервной копии.\n\n' +
    `• Максимум <b>${config.csvImportMaxRows}</b> строк за раз\n` +
    `• Максимальный размер файла — <b>${Math.round(
      config.csvImportMaxBytes / (1024 * 1024),
    )} МБ</b>\n` +
    '• Если поле <code>datetime_local</code> пустое — запишу как «сейчас»';
  const opts = { parse_mode: 'HTML' as const, ...backToMenuKeyboard() };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (err) {
      log.debug('import help edit failed', err);
    }
  }
  await ctx.reply(text, opts);
}

export function registerImport(bot: Telegraf): void {
  bot.command('import', async (ctx) => {
    if (!ctx.from) return;
    await setPending(ctx.from.id, { kind: 'csv_import_expect' });
    await showImportHelp(ctx);
  });

  bot.action('menu:import', async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    await setPending(ctx.from.id, { kind: 'csv_import_expect' });
    await showImportHelp(ctx);
  });

  bot.on('document', async (ctx) => {
    if (!ctx.from) return;
    const msg = ctx.message;
    if (!msg || !('document' in msg) || !msg.document) return;
    const doc = msg.document;
    const filename = doc.file_name ?? 'upload';
    const isCsv =
      filename.toLowerCase().endsWith('.csv') ||
      (doc.mime_type ?? '').toLowerCase().includes('csv');
    if (!isCsv) {
      // Don't interfere with non-CSV uploads (could be other handlers).
      return;
    }
    if (doc.file_size && doc.file_size > config.csvImportMaxBytes) {
      metrics.csvImports.inc({ result: 'too_big' });
      await ctx.reply(
        `📥 Файл слишком большой. Лимит — ${Math.round(
          config.csvImportMaxBytes / (1024 * 1024),
        )} МБ.`,
        backToMenuKeyboard(),
      );
      return;
    }

    let csv: string;
    try {
      const buf = await downloadDocument(ctx, doc.file_id);
      csv = buf.toString('utf8');
    } catch (err) {
      log.error('csv download failed', err);
      metrics.csvImports.inc({ result: 'download_failed' });
      await ctx.reply('⚠️ Не получилось скачать файл из Telegram.', backToMenuKeyboard());
      return;
    }

    const parsed = parseCsv(csv, config.csvImportMaxRows);

    if (parsed.rows.length === 0) {
      metrics.csvImports.inc({ result: 'empty' });
      const errorPreview = parsed.errors.slice(0, 5).map((e) => `· строка ${e.line}: ${e.reason}`);
      await ctx.reply(
        '⚠️ Не нашёл валидных строк для импорта.\n\n' + errorPreview.join('\n'),
        backToMenuKeyboard(),
      );
      return;
    }

    let inserted = 0;
    for (const row of parsed.rows) {
      try {
        await insertTransaction({
          userId: ctx.from.id,
          amount: row.amountKopecks,
          type: row.type,
          category: row.category,
          note: row.note,
          rawText: row.rawText ?? '[import]',
          occurredAt: row.occurredAt,
        });
        metrics.transactions.inc({ type: row.type });
        inserted += 1;
      } catch (err) {
        log.warn('csv row insert failed', err);
        parsed.errors.push({
          line: -1,
          reason: 'не удалось записать в БД',
        });
      }
    }

    metrics.csvImports.inc({ result: 'ok' });
    const summary =
      `✅ <b>Импорт завершён</b>\n\n` +
      `Записал: <b>${inserted}</b> из ${parsed.totalRows} строк\n` +
      (parsed.errors.length > 0
        ? `Ошибок: <b>${parsed.errors.length}</b>\n\n` +
          parsed.errors
            .slice(0, 5)
            .map((e) => `· строка ${e.line}: ${e.reason}`)
            .join('\n') +
          (parsed.errors.length > 5 ? `\n…и ещё ${parsed.errors.length - 5}` : '')
        : '');
    await ctx.reply(summary, { parse_mode: 'HTML', ...backToMenuKeyboard() });
  });
}
