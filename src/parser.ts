import Groq from 'groq-sdk';
import { z } from 'zod';
import { config } from './config.js';
import { log } from './logger.js';
import { CATEGORIES, normalizeCategory } from './categories.js';

export interface ParsedTransaction {
  amount: number; // rubles (float allowed)
  type: 'expense' | 'income';
  category: string;
  note: string | null;
  confidence: number;
}

export interface ParseSuccess {
  ok: true;
  transactions: ParsedTransaction[];
}

export interface ParseFailure {
  ok: false;
  reason: 'not_financial' | 'no_groq' | 'invalid' | 'error';
  message?: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

const singleSchema = z.object({
  amount: z.number().positive().finite(),
  type: z.enum(['expense', 'income']),
  category: z.string(),
  note: z.string().nullish(),
  confidence: z.number().min(0).max(1).default(0.8),
});

const responseSchema = z.union([
  z.object({ error: z.string() }),
  z.object({
    transactions: z.array(singleSchema).min(1),
  }),
  singleSchema,
]);

let groq: Groq | null = null;
function getGroq(): Groq | null {
  if (!config.hasGroq()) return null;
  if (!groq) groq = new Groq({ apiKey: config.groqApiKey });
  return groq;
}

const SYSTEM_PROMPT = `Ты парсер финансовых сообщений на русском языке. Извлекай транзакции из свободного текста.

Категории (используй только эти): ${CATEGORIES.join(', ')}.

Правила:
- Если в сообщении одна транзакция → верни JSON: {"transactions": [{...}]}
- Если несколько ("такси 200, кофе 150") → верни массив всех в "transactions".
- type = "expense" по умолчанию. type = "income" только если явно доход ("зп пришла", "получил", "доход", "пришли деньги", "зарплата").
- amount — число в рублях (целое или с копейками). Понимай "350р", "350 рублей", "1.2к" = 1200, "5тыс" = 5000.
- category — одна из списка. Если не уверен — "прочее".
- note — короткое описание (1-3 слова) или null.
- confidence — твоя уверенность 0.0..1.0.
- Если сообщение НЕ про деньги — верни {"error": "not_financial"}.

Отвечай ТОЛЬКО валидным JSON, без пояснений.

Примеры:
"потратил 800 на продукты" → {"transactions":[{"amount":800,"type":"expense","category":"еда","note":"продукты","confidence":0.95}]}
"такси 350р, кофе 180" → {"transactions":[{"amount":350,"type":"expense","category":"транспорт","note":"такси","confidence":0.95},{"amount":180,"type":"expense","category":"кафе","note":"кофе","confidence":0.95}]}
"зп пришла 85000" → {"transactions":[{"amount":85000,"type":"income","category":"зарплата","note":null,"confidence":0.95}]}
"привет, как дела" → {"error":"not_financial"}`;

export async function parseTransactions(text: string): Promise<ParseResult> {
  const client = getGroq();
  if (!client) {
    return { ok: false, reason: 'no_groq', message: 'GROQ_API_KEY не настроен' };
  }

  try {
    const res = await client.chat.completions.create({
      model: config.groqModel,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });

    const raw = res.choices[0]?.message?.content ?? '{}';
    log.debug('parser raw response:', raw);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      log.warn('parser: invalid JSON from Groq', raw, e);
      return { ok: false, reason: 'invalid', message: 'некорректный ответ модели' };
    }

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      log.warn('parser: schema mismatch', parsed.error.flatten(), 'json:', json);
      return { ok: false, reason: 'invalid', message: 'модель вернула неожиданную структуру' };
    }

    const data = parsed.data;
    if ('error' in data) {
      return { ok: false, reason: 'not_financial' };
    }

    const items: ParsedTransaction[] = ('transactions' in data ? data.transactions : [data]).map(
      (t) => ({
        amount: t.amount,
        type: t.type,
        category: normalizeCategory(t.category),
        note: t.note ?? null,
        confidence: t.confidence,
      }),
    );

    if (items.length === 0) {
      return { ok: false, reason: 'not_financial' };
    }

    return { ok: true, transactions: items };
  } catch (err) {
    log.error('parser: groq call failed', err);
    return { ok: false, reason: 'error', message: 'ошибка обращения к модели' };
  }
}

/** Best-effort chat reply for non-financial messages (assistant mode). */
export async function chatAssistant(text: string): Promise<string> {
  const client = getGroq();
  if (!client) {
    return (
      'Я финансовый трекер. Напиши, например: "потратил 800 на продукты" — я сохраню трату.\n' +
      'Команды: /today, /week, /month, /advice, /budget, /history, /export, /settings.'
    );
  }
  try {
    const res = await client.chat.completions.create({
      model: config.groqModel,
      temperature: 0.6,
      max_tokens: 250,
      messages: [
        {
          role: 'system',
          content:
            'Ты дружелюбный помощник в финансовом боте. Отвечай коротко (1-3 предложения), на русском. ' +
            'Если пользователь спрашивает что-то про финансы — отвечай по делу. ' +
            'Если хочет поболтать — мягко напомни, что бот предназначен для учёта трат, ' +
            'и подскажи как добавить трату или какую команду использовать (/today, /week, /advice).',
        },
        { role: 'user', content: text },
      ],
    });
    return (
      res.choices[0]?.message?.content?.trim() ||
      'Не понял. Напиши, например: "потратил 350 на такси".'
    );
  } catch (err) {
    log.error('chatAssistant failed', err);
    return 'Не понял. Напиши, например: "потратил 350 на такси", или используй /today, /week.';
  }
}
