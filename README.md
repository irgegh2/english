# Складно

Первый рабочий прототип обучающего веб-приложения по макету «Складно»: React + Vite, Node.js/Express, Prisma и PostgreSQL.

## Один запуск на macOS

Если локальный PostgreSQL работает на `localhost:5432`, пользователь `postgres`, а пароль известен, проект можно клонировать, инициализировать БД, заполнить демо-данными, запустить API + React и открыть браузер одной командой:

```bash
cd ~/Desktop && git clone https://github.com/irgegh2/english.git && cd english && POSTGRES_PASSWORD='ВАШ_ПАРОЛЬ' bash scripts/setup-mac.sh
```

Скрипт создаёт базу `skladno` при необходимости, генерирует Prisma Client, применяет schema, запускает seed и затем открывает `http://localhost:5173`.

Если PostgreSQL работает под текущим macOS-пользователем, скрипт попробует его автоматически. Явно указать пользователя можно через `DB_USER`:

```bash
DB_USER="$USER" POSTGRES_PASSWORD='ВАШ_ПАРОЛЬ' bash scripts/setup-mac.sh
```

`.env` создаётся только локально и исключён из Git — пароль в репозиторий не попадает.

## API

- `GET /api/health`
- `GET /api/dashboard`
- `PATCH /api/lessons/:id/progress`
