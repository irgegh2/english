#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm не найдены. Установи Node.js 20+ (например, brew install node) и повтори команду."
  exit 1
fi

# PostgreSQL CLI can live outside PATH on macOS (notably Postgres.app / Homebrew libpq).
if ! command -v psql >/dev/null 2>&1; then
  for candidate in \
    "/Applications/Postgres.app/Contents/Versions/latest/bin" \
    "/opt/homebrew/opt/libpq/bin" \
    "/usr/local/opt/libpq/bin" \
    "/opt/homebrew/bin" \
    "/usr/local/bin"; do
    if [ -x "$candidate/psql" ]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql не найден. PostgreSQL должен быть установлен и запущен; если используешь Homebrew: brew install libpq && brew link --force libpq"
  exit 1
fi

DB_NAME="${DB_NAME:-skladno}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "Передай пароль PostgreSQL через POSTGRES_PASSWORD."
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c 'select 1' >/dev/null 2>&1; then
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$USER" -d postgres -c 'select 1' >/dev/null 2>&1; then
    DB_USER="$USER"
  else
    echo "Не удалось подключиться к PostgreSQL. Проверь, что сервер запущен, а DB_USER/DB_HOST/DB_PORT и пароль верны."
    exit 1
  fi
fi

if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
fi

ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$POSTGRES_PASSWORD")
cat > .env <<ENV
DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
PORT=8787
ENV

npm install
npm run db:generate
npm run db:push
npm run db:seed

( sleep 3; open "http://localhost:5173" ) >/dev/null 2>&1 &
exec npm run dev
