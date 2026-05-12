import Groq from 'groq-sdk';
import { config } from './config.js';
import { log } from './logger.js';
import { kopecksToRubles } from './format.js';
import type { CategoryTotal } from './transactions.js';

let groq: Groq | null = null;
function getGroq(): Groq | null {
  if (!config.hasGroq()) return null;
  if (!groq) groq = new Groq({ apiKey: config.groqApiKey });
  return groq;
}

function formatStats(stats: CategoryTotal[]): string {
  if (stats.length === 0) return '(нет данных)';
  return stats
    .map((s) => `- ${s.category}: ${kopecksToRubles(s.total).toFixed(0)}₽ (${s.count} операций)`)
    .join('\n');
}

export async function generateAdvice(
  thisWeek: CategoryTotal[],
  prevWeek: CategoryTotal[],
): Promise<string> {
  const client = getGroq();
  if (!client) {
    return (
      '🤖 AI-советник отключён: не задан GROQ_API_KEY.\n' +
      'Добавь переменную окружения GROQ_API_KEY (бесплатный ключ на console.groq.com/keys) ' +
      'и команда /advice заработает.'
    );
  }

  const thisTotal = thisWeek.reduce((s, c) => s + c.total, 0);
  const prevTotal = prevWeek.reduce((s, c) => s + c.total, 0);
  const delta = prevTotal === 0 ? null : ((thisTotal - prevTotal) / prevTotal) * 100;
  const deltaLine =
    delta === null
      ? 'на прошлой неделе трат не было.'
      : `по сравнению с прошлой неделей: ${delta > 0 ? '+' : ''}${delta.toFixed(0)}%.`;

  try {
    const res = await client.chat.completions.create({
      model: config.groqModel,
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `Ты личный финансовый советник пользователя. Анализируй траты и давай 3 конкретных практичных совета.
Тон: дружелюбный, как от умного друга. Никакой воды и банальностей вроде "ведите учёт".
Каждый совет — отдельным абзацем, начинай с эмодзи и короткого тезиса жирным (markdown *жирный*).
Опирайся на конкретные цифры и категории из данных, замечай аномалии и разницу между неделями.
Отвечай на русском, не более 4 абзацев. В конце короткий итог (1 предложение).`,
        },
        {
          role: 'user',
          content: `Траты этой недели (общий итог: ${kopecksToRubles(thisTotal).toFixed(0)}₽):
${formatStats(thisWeek)}

Траты прошлой недели (общий итог: ${kopecksToRubles(prevTotal).toFixed(0)}₽):
${formatStats(prevWeek)}

Динамика: ${deltaLine}

Дай 3 конкретных совета.`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    return text || 'Пока недостаточно данных для анализа. Добавь больше трат за неделю.';
  } catch (err) {
    log.error('generateAdvice failed', err);
    return '⚠️ Не удалось получить советы от AI. Попробуй позже.';
  }
}
