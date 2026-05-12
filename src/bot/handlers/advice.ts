import type { Telegraf, Context } from 'telegraf';
import { getRangeByCategory } from '../../transactions.js';
import { getOrCreateUser } from '../../users.js';
import { nextWeek, previousWeekRange, startOfWeek } from '../../time.js';
import { generateAdvice } from '../../advisor.js';
import { backToMenuKeyboard } from '../keyboards.js';
import { log } from '../../logger.js';

export async function sendAdvice(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const thisStart = startOfWeek(user.tz);
  const thisEnd = nextWeek(thisStart);
  const prev = previousWeekRange(user.tz);

  let typing: ReturnType<typeof setInterval> | null = null;
  try {
    await ctx.sendChatAction('typing');
    typing = setInterval(() => {
      ctx.sendChatAction('typing').catch(() => {});
    }, 4000);

    const [thisWeek, prevWeek] = await Promise.all([
      getRangeByCategory({ userId: ctx.from.id, tz: user.tz, from: thisStart, to: thisEnd }),
      getRangeByCategory({ userId: ctx.from.id, tz: user.tz, from: prev.from, to: prev.to }),
    ]);

    if (thisWeek.length === 0 && prevWeek.length === 0) {
      await ctx.reply(
        '📭 Пока маловато данных для анализа. Добавь несколько трат и попробуй снова через пару дней.',
        backToMenuKeyboard(),
      );
      return;
    }

    const advice = await generateAdvice(thisWeek, prevWeek);
    await ctx.reply(`🧠 <b>AI-советник</b>\n\n${advice}`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard(),
    });
  } catch (err) {
    log.error('advice failed', err);
    await ctx.reply('⚠️ Не удалось получить советы. Попробуй позже.', backToMenuKeyboard());
  } finally {
    if (typing) clearInterval(typing);
  }
}

export function registerAdvice(bot: Telegraf): void {
  bot.command('advice', sendAdvice);
}
