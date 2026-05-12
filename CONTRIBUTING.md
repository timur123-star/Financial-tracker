# Contributing

Спасибо за интерес! Этот проект — портфолио, но PR-ы по делу welcome.

## Запуск локально

```bash
# 1. Сервисы (Postgres 16 + Redis 7)
docker compose up -d postgres redis

# 2. Зависимости
npm install

# 3. .env (см. .env.example)
cp .env.example .env

# 4. Миграции
npm run migrate

# 5. Бот
npm run dev
```

## Что проверяется в CI

- `npm run typecheck` — TypeScript 5 strict-mode, ноль ошибок.
- `npm test` — vitest, все unit-тесты должны проходить.
- `npm run build` — `tsc -p tsconfig.build.json` собирает прод-выхлоп в `dist/`.
- CI matrix Node 20 + 22.

## Style

- TypeScript strict; никаких `any`, `as unknown`, `// @ts-ignore` без крайней нужды.
- Все деньги — `bigint` (копейки), никаких `float`-ов в арифметике.
- Все даты приходят в UTC; в `tz` пользователя конвертируются только на дисплее.
- Бот-хендлеры регистрируются в `src/bot/index.ts`; новый хендлер кладём в `src/bot/handlers/`.
- Перед коммитом: `npm run typecheck && npm test`.

## Структура коммитов

Conventional commits приветствуются (`feat:`, `fix:`, `chore:`, `docs:`, …),
но обязательной полиции нет.
