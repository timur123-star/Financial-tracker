# Personal Financial Tracker — Telegram-бот

Профессиональный Telegram-бот для учёта личных финансов: понимает свободный текст
через **NLP**, парсит траты в категории, ведёт бюджеты и цели, рисует **PNG-графики**
и даёт **AI-советы** по реальной истории трат. Portfolio piece.

`Node 22` · `TypeScript 5 strict` · `Telegraf 4` · `Groq (Llama 3.3 70B)` · `PostgreSQL 16` · `Redis 7` · `chartjs-node-canvas`

[![CI](https://github.com/timur123-star/Personal-Financial-Tracker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/timur123-star/Personal-Financial-Tracker/actions/workflows/ci.yml)
[![CodeQL](https://github.com/timur123-star/Personal-Financial-Tracker/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/timur123-star/Personal-Financial-Tracker/actions/workflows/codeql.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%20%C2%B7%20strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Telegraf](https://img.shields.io/badge/Telegraf-4-26A5E4?logo=telegram&logoColor=white)](https://telegraf.js.org/)
[![Postgres](https://img.shields.io/badge/Postgres-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Vitest](https://img.shields.io/badge/tests-vitest%20%C2%B7%2036-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)
[![ESLint](https://img.shields.io/badge/lint-eslint%20v9-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Railway](https://img.shields.io/badge/Deploy-Railway-7c3aed?logo=railway&logoColor=white)](https://railway.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Source](https://github.com/timur123-star/Personal-Financial-Tracker) · [Architecture](./docs/ARCHITECTURE.md) · [Changelog](./CHANGELOG.md) · [Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md)

---

## About this project

Personal Financial Tracker — портфолио-проект: финансовый трекер в виде Telegram-бота,
который ведёт себя как нормальный продукт. Никаких слеш-команд «впишите сумму через пробел» —
вместо этого:

- свободный текст (`«потратил 800 на продукты, такси 350, кофе 180»`) → бот сам распарсит
  три транзакции, разложит по категориям, нарисует график недели и пришлёт AI-совет;
- весь UX — inline-кнопками: главное меню, навигация по периодам, бюджеты, подписки, цели;
- продакшен-обвес — структурные логи, health/ready-эндпоинты, rate-limit, миграции,
  graceful shutdown — собран как для боевого сервиса, а не «MVP на коленке».

Каждый модуль, тест, миграция и блок документации написан вручную: ни CMS, ни no-code,
ни шаблонных туториалов.

> **Disclaimer.** Категории, бюджеты, валюты и таймзоны рассчитаны на ru-IL/ru-RU/СНГ-аудиторию.
> Архитектура и код переносятся на любую территорию заменой `categories.ts` и пресетов в `tzKeyboard()`.
>
> Designed and built by **Тимур Валерьевич**.

> **Companion-проекты.** Portfolio-вселенная:
>
> - **AI-консультант для онлайн-магазина** — RAG + pgvector Telegram-бот →
>   [github.com/timur123-star/AI-consultant-for-the-store](https://github.com/timur123-star/AI-consultant-for-the-store)
> - **NOVA Agency** — маркетинговый сайт студии (Next.js 14 + Tailwind + Framer Motion) →
>   [github.com/timur123-star/Landing-page-for-an-agency](https://github.com/timur123-star/Landing-page-for-an-agency)

---

## Что внутри

### Поведение бота

- **Свободный текст с AI**. `«такси 350, кофе 180»` → две записи в нужных категориях.
  Поддерживается несколько транзакций в одном сообщении, доходы (`«зп пришла 85000»`) и
  уточнения (`«обед 650»` → категория `кафе`).
- **Полностью inline-UI**. `/menu` открывает 12-кнопочную панель: Сегодня · Неделя · Месяц ·
  AI-совет · Стата · Цель · Бюджеты · Подписки · История · Поиск · Экспорт · Настройки.
- **Навигация по периодам** — у `/today`, `/week`, `/month` есть кнопки `◀ Назад / Вперёд ▶`,
  можно листать прошлые недели/месяцы прямо из чата.
- **PNG-графики** — donut по категориям с процентами и подписями сумм + bar-chart дневной
  динамики недели, тёмный фон `#15171c`, кириллица + эмодзи.
- **AI-советник** на Groq Llama-3.3-70B — анализирует неделю и даёт 3–5 конкретных советов
  («такси перерасход против прошлой недели — переходи на метро по утрам», …).
- **Бюджеты на месяц** по 10 категориям, с прогресс-баром и алёртами на 80% и 100%.
  Кастомные суммы — `✏️ Своя сумма` → ввод числа в чат.
- **🎯 Цели** — общий месячный лимит расходов, прогресс показывается в `/stats` и `/goal`.
- **🔁 Подписки** — повторяющиеся транзакции (зарплата, рента, Netflix, iCloud).
  Cron каждые 5 минут списывает по `next_charge` и шлёт уведомление в чат.
- **🔎 Поиск по истории** — full-text по `note`, `raw_text` и категории (case-insensitive `ILIKE`).
- **/stats** с переключателем периода (`Неделя / Месяц / Квартал / Год`): главные метрики,
  серия дней подряд (`streak`), сравнение с предыдущим периодом, прогресс цели и
  **🔮 прогноз** трат на конец периода при текущем темпе («при таком темпе потратишь
  N₽ к концу месяца — это N% от цели»).
- **Экспорт CSV** за неделю / месяц / квартал / год / всё время. BOM для Excel.
- **Импорт CSV** (`/import`) — обратная операция: пришли файл такой же схемы, бот
  вставит транзакции, оставив исходный timestamp. Удобно для миграции между серверами
  или восстановления из бэкапа.
- **🎙 Голосовые сообщения** — наговори «потратил 800 на продукты», бот транскрибирует
  через **Groq Whisper** (`whisper-large-v3`), парсит и сохраняет точно так же, как
  текст. Лимиты по длительности и размеру настраиваются.
- **Отмена транзакции** inline-кнопкой `❌ Отменить` (Redis TTL 5 мин) + правка категории
  через `✏️ Категория` без удаления записи.
- **Серия дней подряд** (`streak`) — мотивация записывать траты каждый день.
- **Уведомления**: ежевечернее напоминание (21:00) и недельный отчёт (вс 20:00) — в
  таймзоне пользователя.

### Что под капотом

- **Telegraf 4** с middleware-цепочкой: per-user rate-limit (Redis INCR, 30/мин) → структурное
  логирование → handlers.
- **Groq SDK** в JSON-mode с заточенным system-промптом: парсер не выдумывает сумм/категорий,
  при `not_financial` ответе бот переключается на обычный chat-режим.
- **PostgreSQL 16**: `users`, `transactions`, `budgets`, `subscriptions`, `goals`. Все суммы
  в копейках (`bigint`), никаких `float`-ошибок арифметики (`0.1 + 0.2 = 30 копеек`).
- **Redis 7** в виде shared client (`src/redis.ts`): `undo:<token>`, `pending:<user>` (для
  inline-flows ввода сумм/поиска), `rl:<user>:<window>` (rate-limit).
- **chartjs-node-canvas** + системные шрифты (`DejaVu Sans`, `Noto Color Emoji`) → PNG прямо
  в Telegram без сторонних API.
- **node-cron** с тремя джобами: вечернее напоминание (21:00 tz юзера), недельный отчёт
  (вс 20:00 tz юзера), субскрипшен-чарджи (`*/5 * * * *` UTC).
- **Pending-input машина** в Redis для UX-flows «нажми кнопку → введи сумму»: бюджеты,
  цели, добавление подписки, поиск.

### Качество и инфраструктура

- **TypeScript 5 со strict-mode** — весь runtime, тесты и скрипты на TS. Прод-сборка через
  `tsc`, dev через `tsx`. CI прогоняет `tsc --noEmit` на Node 20 и 22.
- **ESLint v9 flat-config** + **Prettier 3** + **husky + lint-staged**: pre-commit прогоняет
  линт и формат только по staged-файлам, в CI отдельный `lint` job блокирует мердж при
  предупреждениях.
- **CodeQL** security scanning (`security-and-quality` queries) на каждый push и pull request,
  плюс еженедельная плановая прогонка по понедельникам.
- **36 vitest тестов** (8 файлов) — пуленепробиваемая арифметика копеек, синонимы категорий,
  хелперы времени и таймзон, продвинутые периоды (квартал/год), `subscriptions.advance()`,
  прогноз в `/stats`, CSV-импорт (round-trip с `/export`), Prometheus exposition.
- **CI matrix Node 20 + 22** (`.github/workflows/ci.yml`) с `concurrency: cancel-in-progress`,
  отдельные job-ы `lint` + `test` + `build`. Сборка `node-canvas` имеет все системные либы.
- **Dependabot** — еженедельные апдейты npm / actions / docker.
- **Два режима работы** — long polling (дефолт) или webhook. Установи `WEBHOOK_URL` +
  `WEBHOOK_SECRET_TOKEN` — тот же HTTP-сервер начнёт принимать обновления Telegram на
  `/tg/webhook`, валидируя секретный header.
- **Prometheus `/metrics` endpoint** — встроенный zero-dep экспортёр считает обновления
  по типу, сохранённые транзакции, ошибки по компонентам, drop-ы rate-limiter, голосовые
  транскрипции, импорты CSV + histogram длительности хендлеров. Готов к скрейпу Grafana.
- **Migrations** — простой `migrate.ts` рантаймер: применяет `migrations/*.sql` по порядку,
  ведёт `schema_migrations`. Идемпотентно.
- **Observability**: `GET /healthz` (liveness) + `GET /readyz` (Postgres + Redis) + `/metrics`.
  Структурные логи с уровнем через `LOG_LEVEL`. Graceful shutdown по SIGINT/SIGTERM.
- **Документация**: `README.md`, [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (схема, пайплайн,
  решения), [`CHANGELOG.md`](./CHANGELOG.md) (Keep a Changelog), [`SECURITY.md`](./SECURITY.md)
  (disclosure policy + hardening), [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **Безопасность**: бот не пишет токены/ключи в логи, в PR никогда не коммитятся `.env`,
  webhook валидируется секретным header-ом, запросы text/voice/CSV ограничены per-user.

---

## Архитектура

```
                ┌────────────────────────────────────────────┐
                │           Telegram (Bot API · long poll)    │
                └────────────────────────────┬──────────────┘
                                             │
                                             ▼
        ┌───────────────────────────────────────────────────────────┐
        │            src/bot/index.ts (Telegraf 4)                   │
        │  rateLimit → logging → handlers → text NLP (last)          │
        └──┬──────────────┬──────────────┬──────────────┬───────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
       parser.ts    transactions.ts  budgets.ts   subscriptions.ts
       (Groq JSON)        │              │              │
                          │              │              │
                          ▼              ▼              ▼
                  ┌────────────────────────────────────────┐
                  │            Postgres 16                  │
                  └────────────────────────────────────────┘
                          ▲
                          │
        ┌─────────────────┴──────────────┐
        │                                │
   chart.ts (donut + bar)           advisor.ts (Groq Llama)
        │                                │
        ▼                                ▼
   PNG → Telegram                    text → Telegram
```

Более подробное описание — [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Быстрый старт

### 1. Сервисы

```bash
docker compose up -d postgres redis
```

### 2. Зависимости и миграции

```bash
npm install
cp .env.example .env       # вписать TELEGRAM_BOT_TOKEN и GROQ_API_KEY
npm run migrate
```

### 3. Бот

```bash
npm run dev    # tsx + watch
# или
npm run build && npm start
```

### Переменные окружения

| Имя                       | Обязательная | Значение                                                                          |
| ------------------------- | :----------: | --------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`      |      ✅      | Токен из [@BotFather](https://t.me/BotFather)                                     |
| `GROQ_API_KEY`            |      —       | [console.groq.com/keys](https://console.groq.com/keys). Без него NLP/AI отключены |
| `DATABASE_URL`            |      ✅      | Например `postgres://finance:finance@localhost:5432/finance`                      |
| `REDIS_URL`               |      —       | По умолчанию `redis://localhost:6379`                                             |
| `DEFAULT_TZ`              |      —       | IANA таймзона, по умолчанию `Europe/Moscow`                                       |
| `DEFAULT_CURRENCY`        |      —       | По умолчанию `RUB`                                                                |
| `DEFAULT_CURRENCY_SYMBOL` |      —       | По умолчанию `₽`                                                                  |
| `DISABLE_CRON`            |      —       | `true` чтобы выключить расписания (удобно в dev)                                  |
| `PORT`                    |      —       | По умолчанию `8080` (для `/healthz`/`/readyz`/`/metrics`)                         |
| `HEALTH_HOST`             |      —       | По умолчанию `0.0.0.0`. Поставь `127.0.0.1` для внутреннего мониторинга           |
| `WEBHOOK_URL`             |      —       | Если задан — бот переходит в webhook-режим, polling выключается                   |
| `WEBHOOK_SECRET_TOKEN`    |      —       | Header `X-Telegram-Bot-Api-Secret-Token`, автогенерируется при отсутствии         |
| `DISABLE_METRICS`         |      —       | `true` чтобы спрятать `/metrics` (полезно на публичных host-ах)                   |
| `DISABLE_VOICE`           |      —       | `true` чтобы отключить транскрипцию голосовых через Groq Whisper                  |
| `RATE_LIMIT_MAX`          |      —       | Сообщений в окно на юзера (дефолт `30`)                                           |
| `LOG_LEVEL`               |      —       | `debug` / `info` / `warn` / `error`                                               |

---

## Команды

| Команда           | Что делает                                                        |
| ----------------- | ----------------------------------------------------------------- |
| `/start`          | Онбординг + меню + кнопка «✨ Заполнить демо-данными»             |
| `/menu`           | Главное inline-меню                                               |
| `/today`          | Расход и доход за сегодня, навигация по дням                      |
| `/week`           | Donut по категориям + bar-chart дневной динамики                  |
| `/month`          | Месячный отчёт с прогрессом цели                                  |
| `/stats`          | Метрики с переключателем периода (неделя / месяц / квартал / год) |
| `/advice`         | AI-анализ трат с конкретными советами                             |
| `/budget`         | Бюджеты по категориям, прогресс-бары, кастомные суммы             |
| `/goal`           | Цель на месяц (общий лимит расходов)                              |
| `/subs`           | Подписки: добавление, пауза, удаление, авто-списания              |
| `/search <текст>` | Поиск по истории — категория / нота / raw_text                    |
| `/history`        | История транзакций с пагинацией и удалением                       |
| `/export`         | CSV за неделю / месяц / квартал / год / всё время                 |
| `/import`         | Импорт CSV (обратная операция `/export`)                          |
| `/settings`       | Таймзона, валюта, тумблер уведомлений                             |
| `🎙 Голос`        | Наговори voice-message: Whisper транскрибирует → NLP парсит       |
| `/help`           | Справка                                                           |

---

## Скрипты

| `npm run …`     | Что                                                     |
| --------------- | ------------------------------------------------------- |
| `dev`           | Запуск через `tsx watch src/index.ts`                   |
| `build`         | Прод-сборка в `dist/` (`tsc -p tsconfig.json`)          |
| `start`         | Запуск собранного `dist/index.js`                       |
| `migrate`       | Применить миграции из `migrations/*.sql`                |
| `typecheck`     | `tsc --noEmit` strict                                   |
| `lint`          | `eslint . --max-warnings 0`                             |
| `lint:fix`      | `eslint . --fix`                                        |
| `format`        | `prettier --write "**/*.{ts,js,json,md,yml,yaml}"`      |
| `format:check`  | `prettier --check "**/*.{ts,js,json,md,yml,yaml}"`      |
| `test`          | `vitest run`                                            |
| `test:coverage` | `vitest run --coverage` (требует `@vitest/coverage-v8`) |

---

## Деплой на Railway

1. **New Project → Deploy from GitHub Repo →** выбрать `timur123-star/Personal-Financial-Tracker`.
   Railway сам найдёт [`railway.json`](./railway.json) + [`Dockerfile`](./Dockerfile).
2. Добавить плагины **PostgreSQL** и **Redis** — `DATABASE_URL` и `REDIS_URL` подставятся
   автоматически.
3. В Variables сервиса прописать `TELEGRAM_BOT_TOKEN` и `GROQ_API_KEY` (опц.). По желанию
   переопределить `DEFAULT_TZ` / `DEFAULT_CURRENCY` / `LOG_LEVEL`.
4. Deploy. Миграции применяются на старте автоматически.

Если `GROQ_API_KEY` не задан, бот стартует и работает на командах/кнопках, но NLP/AI
вежливо отвечают, что нужно прописать ключ.

---

## Project layout

```
.
├── migrations/                 # SQL миграции (применяются по порядку)
│   ├── 001_init.sql
│   └── 002_subscriptions_goals.sql
├── src/
│   ├── index.ts                # entrypoint (HTTP + bot + scheduler)
│   ├── config.ts               # env config с дефолтами
│   ├── db.ts                   # pg pool
│   ├── redis.ts                # shared redis client
│   ├── categories.ts           # 10 категорий + словарь синонимов + эмодзи
│   ├── transactions.ts         # CRUD + aggregations + search
│   ├── budgets.ts              # бюджеты на месяц
│   ├── budgetCheck.ts          # пост-вставка алёрты 80%/100%
│   ├── subscriptions.ts        # CRUD подписок + advance()
│   ├── goals.ts                # CRUD целей
│   ├── parser.ts               # Groq JSON-mode парсер транзакций
│   ├── advisor.ts              # Groq AI-советник
│   ├── chart.ts                # donut + bar (chartjs-node-canvas)
│   ├── time.ts                 # tz-aware периоды (день/нед/мес/кварт/год)
│   ├── undo.ts                 # Redis-токены для отмены
│   ├── pendingInput.ts         # inline-flow «жди следующее сообщение»
│   ├── scheduler.ts            # cron: напоминания + субскрипшены
│   ├── format.ts               # копейки ↔ рубли, capitalize, escapeHtml
│   ├── logger.ts               # структурный логгер
│   └── bot/
│       ├── index.ts            # buildBot() — middleware + register всех handlers
│       ├── keyboards.ts        # inline-клавиатуры (≈15 keyboard-функций)
│       ├── middleware/
│       │   └── rateLimit.ts    # per-user Redis rate-limit
│       └── handlers/
│           ├── start.ts        # /start + демо-данные
│           ├── menu.ts         # /menu + navigation callbacks
│           ├── today.ts        # /today с навигацией по дням
│           ├── week.ts         # /week + donut + bar-chart
│           ├── month.ts        # /month с навигацией по месяцам
│           ├── stats.ts        # /stats + переключатель периода
│           ├── advice.ts       # /advice AI-анализ
│           ├── budget.ts       # /budget пресеты + кастомные суммы
│           ├── subs.ts         # /subs + 3-шаговый flow добавления
│           ├── goal.ts         # /goal с прогресс-баром
│           ├── search.ts       # /search + inline prompt
│           ├── history.ts      # /history с пагинацией
│           ├── export.ts       # /export CSV
│           ├── settings.ts     # /settings (tz, валюта, уведомления)
│           ├── editCategory.ts # ✏️ исправление категории inline
│           ├── undo.ts         # ❌ отмена через токен
│           └── text.ts         # NLP + pending-input dispatch (last)
├── tests/                      # vitest unit-тесты (22 шт)
├── docs/
│   └── ARCHITECTURE.md         # подробная архитектура
├── .github/
│   ├── workflows/ci.yml        # matrix Node 20 + 22
│   └── dependabot.yml          # weekly updates
├── Dockerfile
├── docker-compose.yml          # postgres + redis для локала
├── railway.json
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

---

## License

[MIT](./LICENSE) © Тимур Валерьевич
