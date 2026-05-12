import type { Telegraf } from 'telegraf';
import { categoryPickerKeyboard } from '../keyboards.js';
import { updateTransactionCategory } from '../../transactions.js';
import { CATEGORIES, categoryEmoji, type Category } from '../../categories.js';
import { capitalize } from '../../format.js';
import { log } from '../../logger.js';

export function registerEditCategory(bot: Telegraf): void {
  bot.action(/^editcat:(\d+)$/, async (ctx) => {
    const txId = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    try {
      const kb = categoryPickerKeyboard(`setcat:${txId}`);
      await ctx.reply('✏️ Выбери правильную категорию:', kb);
    } catch (err) {
      log.error('editcat prompt failed', err);
    }
  });

  bot.action(/^setcat:(\d+):(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const txId = Number(ctx.match[1]);
    const cat = ctx.match[2];
    if (cat === 'cancel') {
      await ctx.answerCbQuery('Отменено');
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore
      }
      return;
    }
    if (!(CATEGORIES as readonly string[]).includes(cat)) {
      await ctx.answerCbQuery('Неизвестная категория', { show_alert: true });
      return;
    }
    try {
      const row = await updateTransactionCategory(ctx.from.id, txId, cat as Category);
      if (!row) {
        await ctx.answerCbQuery('Транзакция не найдена', { show_alert: true });
        return;
      }
      await ctx.answerCbQuery(`✅ ${cat}`);
      try {
        await ctx.editMessageText(
          `✅ Категория обновлена: ${categoryEmoji(cat)} <b>${capitalize(cat)}</b>`,
          { parse_mode: 'HTML' },
        );
      } catch {
        // ignore
      }
    } catch (err) {
      log.error('setcat failed', err);
      try {
        await ctx.answerCbQuery('Не удалось обновить.', { show_alert: true });
      } catch {
        // ignore
      }
    }
  });
}
