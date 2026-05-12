import cron from 'node-cron';
import type { Telegraf } from 'telegraf';
import { Input } from 'telegraf';
import { listActiveUsers, type UserRow } from './users.js';
import {
  getDayTotals,
  getRangeByCategory,
  getRangeTotals,
  insertTransaction,
} from './transactions.js';
import { previousWeekRange } from './time.js';
import { renderCategoryDonut } from './chart.js';
import { generateAdvice } from './advisor.js';
import { capitalize, escapeHtml, formatAmount } from './format.js';
import { categoryEmoji } from './categories.js';
import { config } from './config.js';
import { log } from './logger.js';
import { metrics } from './metrics.js';
import { advance, bumpNextCharge, dueSubscriptions, type SubRow } from './subscriptions.js';

const tasks: cron.ScheduledTask[] = [];

export function startScheduler(bot: Telegraf): void {
  if (config.disableCron) {
    log.info('cron disabled via DISABLE_CRON');
    return;
  }

  const tz = config.defaultTz;

  // Evening reminder: every day at 21:00 local time.
  tasks.push(
    cron.schedule(
      '0 21 * * *',
      async () => {
        try {
          const users = await listActiveUsers();
          for (const u of users) {
            try {
              const totals = await getDayTotals(u.id, u.tz);
              if (totals.count === 0) {
                await bot.telegram.sendMessage(
                  u.id,
                  '🌙 Не забудь записать траты за сегодня! Напиши, например: "обед 450, кофе 180".',
                );
              }
            } catch (err) {
              log.warn('evening reminder failed for user', u.id, err);
            }
          }
        } catch (err) {
          log.error('evening reminder job failed', err);
        }
      },
      { timezone: tz },
    ),
  );

  // Weekly report: Sunday at 20:00 local time.
  tasks.push(
    cron.schedule(
      '0 20 * * 0',
      async () => {
        try {
          const users = await listActiveUsers();
          for (const u of users) {
            try {
              await sendWeeklyReport(bot, u);
            } catch (err) {
              log.warn('weekly report failed for user', u.id, err);
            }
          }
        } catch (err) {
          log.error('weekly report job failed', err);
        }
      },
      { timezone: tz },
    ),
  );

  // Subscription auto-charge: every 5 minutes, in UTC (don't tie to user tz so it
  // still ticks if a user's clock is across midnight). Each subscription has its
  // own `next_charge` cursor so we don't double-charge.
  tasks.push(
    cron.schedule(
      '*/5 * * * *',
      async () => {
        try {
          await chargeDueSubscriptions(bot);
        } catch (err) {
          log.error('subscription cron failed', err);
        }
      },
      { timezone: 'UTC' },
    ),
  );

  log.info(
    `scheduler started (tz=${tz}, evening 21:00 reminder + weekly Sunday 20:00 report + subscriptions every 5 min)`,
  );
}

/**
 * Walk through all subscriptions whose `next_charge` has passed, insert a transaction
 * for each, advance the cursor, and notify the user. Designed to be idempotent and
 * safe to re-run.
 */
export async function chargeDueSubscriptions(bot: Telegraf): Promise<void> {
  const now = new Date();
  const due = await dueSubscriptions(now);
  if (due.length === 0) return;
  log.info(`charging ${due.length} due subscription(s)`);
  for (const sub of due) {
    try {
      await chargeOne(bot, sub, now);
    } catch (err) {
      log.warn('subscription charge failed', sub.id, err);
    }
  }
}

async function chargeOne(bot: Telegraf, sub: SubRow, now: Date): Promise<void> {
  // Catch up if the bot was down longer than a single cadence step.
  let cursor = sub.next_charge;
  let inserted = 0;
  while (cursor <= now && inserted < 50) {
    await insertTransaction({
      userId: sub.user_id,
      amount: sub.amount,
      type: sub.type,
      category: sub.category,
      note: sub.note,
      rawText: `[subscription #${sub.id}]`,
    });
    inserted += 1;
    cursor = advance(cursor, sub.cadence);
  }
  await bumpNextCharge(sub.id, cursor);
  if (inserted > 0) {
    metrics.subscriptionsCharged.inc({}, inserted);
    metrics.transactions.inc({ type: sub.type }, inserted);
  }

  // Send a single notification summarising the charge.
  if (inserted > 0) {
    try {
      const sign = sub.type === 'income' ? '+' : '−';
      const note = sub.note ? ` <i>(${escapeHtml(sub.note)})</i>` : '';
      const symbol = '₽'; // notify uses default symbol; per-user symbol resolved by /menu
      const head = inserted > 1 ? `🔁 Списано <b>×${inserted}</b>` : '🔁 Списано по подписке';
      await bot.telegram.sendMessage(
        sub.user_id,
        `${head}\n${categoryEmoji(sub.category)} <b>${escapeHtml(capitalize(sub.category))}</b> ` +
          `<code>${sign}${escapeHtml(formatAmount(sub.amount, symbol))}</code>${note}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      log.warn('subscription notify failed', sub.id, err);
    }
  }
}

export function stopScheduler(): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;
}

/** Reusable function (also called from /advice if desired). */
export async function sendWeeklyReport(bot: Telegraf, u: UserRow): Promise<void> {
  // "This week so far" = current Mon..now. For Sunday 20:00 this is essentially the full week.
  const prev = previousWeekRange(u.tz);
  const thisRange = { from: prev.to, to: new Date() };
  const [thisCats, thisTotals, prevCats] = await Promise.all([
    getRangeByCategory({ userId: u.id, tz: u.tz, from: thisRange.from, to: thisRange.to }),
    getRangeTotals({ userId: u.id, tz: u.tz, from: thisRange.from, to: thisRange.to }),
    getRangeByCategory({ userId: u.id, tz: u.tz, from: prev.from, to: prev.to }),
  ]);

  if (thisTotals.expense === 0 && prevCats.length === 0) {
    // Skip silently — nothing to report.
    return;
  }

  const title = `Расходы за неделю`;
  if (thisTotals.expense > 0) {
    const chart = await renderCategoryDonut(title, thisCats, thisTotals.expense, u.currency_symbol);
    const lines = thisCats
      .slice(0, 8)
      .map(
        (c) =>
          `${categoryEmoji(c.category)} <b>${escapeHtml(capitalize(c.category))}</b>: ` +
          `${escapeHtml(formatAmount(c.total, u.currency_symbol))}`,
      );
    const caption =
      `📊 <b>Итого за неделю:</b> ${escapeHtml(formatAmount(thisTotals.expense, u.currency_symbol))}\n` +
      lines.join('\n');
    await bot.telegram.sendPhoto(u.id, Input.fromBuffer(chart), {
      caption,
      parse_mode: 'HTML',
    });
  }

  const advice = await generateAdvice(thisCats, prevCats);
  await bot.telegram.sendMessage(u.id, `🤖 <b>AI-советник:</b>\n\n${advice}`, {
    parse_mode: 'HTML',
  });
}
