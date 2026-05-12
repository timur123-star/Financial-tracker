import type { Telegraf } from 'telegraf';
import { consumeUndo } from '../../undo.js';
import { deleteTransaction } from '../../transactions.js';
import { log } from '../../logger.js';

export function registerUndoHandler(bot: Telegraf): void {
  bot.action(/^undo:([a-f0-9]{16})$/, async (ctx) => {
    const token = ctx.match[1];
    if (!ctx.from) return;
    try {
      const data = await consumeUndo(token, ctx.from.id);
      if (!data) {
        await ctx.answerCbQuery('Отменить уже нельзя (прошло 5 минут).', { show_alert: true });
        return;
      }
      let deleted = 0;
      for (const id of data.txIds) {
        const row = await deleteTransaction(ctx.from.id, id);
        if (row) deleted += 1;
      }
      await ctx.answerCbQuery(`Удалено: ${deleted}`);
      try {
        if (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message) {
          const original = ctx.callbackQuery.message.text ?? '';
          await ctx.editMessageText(`${original}\n\n🗑 <i>Отменено (${deleted}).</i>`, {
            parse_mode: 'HTML',
          });
        }
      } catch (e) {
        log.debug('editMessageText after undo failed', e);
      }
    } catch (err) {
      log.error('undo handler failed', err);
      try {
        await ctx.answerCbQuery('Не удалось отменить.', { show_alert: true });
      } catch {
        // ignore
      }
    }
  });
}
