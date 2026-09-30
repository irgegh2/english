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


## Аудиословарь

В админке есть общий аудиословарь: английская фраза хранится один раз, а уроки ссылаются на неё через поле `audioPhrase`. Для каждого из шести голосов можно загрузить свой файл. При открытии урока API автоматически подставляет актуальную запись из словаря; старые `audioFiles` в существующих уроках остаются резервным вариантом.

После обновления проекта с этой функцией нужно применить новую Prisma schema:

```bash
npm run db:generate
npm run db:push
```

При запуске через `scripts/setup-mac.sh` эти команды выполняются автоматически.
