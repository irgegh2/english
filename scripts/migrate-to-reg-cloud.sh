#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for tool in node npm psql pg_dump pg_restore; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    for candidate in \
      "/Applications/Postgres.app/Contents/Versions/latest/bin" \
      "/opt/homebrew/opt/libpq/bin" \
      "/usr/local/opt/libpq/bin" \
      "/opt/homebrew/bin" \
      "/usr/local/bin"; do
      if [ -x "$candidate/$tool" ]; then
        export PATH="$candidate:$PATH"
        break
      fi
    done
  fi

  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Не найден $tool. Установи PostgreSQL CLI / Node.js и повтори."
    exit 1
  fi
done

if [ ! -f .env ]; then
  echo "Файл .env не найден. Сначала запусти проект локально хотя бы один раз."
  exit 1
fi

SOURCE_DATABASE_URL="$(node - <<'NODE'
const fs = require('fs');
const text = fs.readFileSync('.env', 'utf8');
const match = text.match(/^DATABASE_URL\s*=\s*(.+)$/m);
if (!match) process.exit(2);
const value = match[1].trim().replace(/^["']|["']$/g, '');
const url = new URL(value);
url.searchParams.delete('schema');
process.stdout.write(url.toString());
NODE
)"

if [[ "$SOURCE_DATABASE_URL" == *"79.174.89.45:19538"* ]]; then
  echo "DATABASE_URL уже указывает на REG.RU (79.174.89.45:19538). Перенос повторно не запускаю."
  exit 0
fi

REG_DB_HOST="${REG_DB_HOST:-79.174.89.45}"
REG_DB_PORT="${REG_DB_PORT:-19538}"
REG_DB_NAME="${REG_DB_NAME:-db1}"
REG_DB_USER="${REG_DB_USER:-user1}"

if [ -z "${REG_DB_PASSWORD:-}" ]; then
  printf "Пароль пользователя %s для PostgreSQL REG.RU: " "$REG_DB_USER"
  IFS= read -r -s REG_DB_PASSWORD
  printf "\n"
fi

if [ -z "$REG_DB_PASSWORD" ]; then
  echo "Пароль не введён."
  exit 1
fi

ENCODED_PASSWORD="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$REG_DB_PASSWORD")"
TARGET_BASE_URL="postgresql://${REG_DB_USER}:${ENCODED_PASSWORD}@${REG_DB_HOST}:${REG_DB_PORT}/${REG_DB_NAME}?sslmode=require"
TARGET_PRISMA_URL="${TARGET_BASE_URL}&schema=public"

echo "1/7 Обновляю локальную схему перед переносом..."
npm install
npm run db:generate
npm run db:push

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="backups/local-before-reg-${STAMP}.dump"
ENV_BACKUP=".env.local-backup-${STAMP}"

echo "2/7 Создаю резервную копию текущей базы: $BACKUP_FILE"
pg_dump --format=custom --no-owner --no-acl --dbname="$SOURCE_DATABASE_URL" --file="$BACKUP_FILE"

echo "3/7 Проверяю подключение к PostgreSQL REG.RU..."
psql "$TARGET_BASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user;' >/dev/null

echo "4/7 Переношу все таблицы и данные..."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --dbname="$TARGET_BASE_URL" \
  "$BACKUP_FILE"

cp .env "$ENV_BACKUP"

MASTER_KEY="$(node - <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const text = fs.readFileSync('.env', 'utf8');
const match = text.match(/^STORAGE_MASTER_KEY\s*=\s*(.+)$/m);
if (match && match[1].trim().replace(/^["']|["']$/g, '')) {
  process.stdout.write(match[1].trim().replace(/^["']|["']$/g, ''));
} else {
  process.stdout.write(crypto.randomBytes(32).toString('hex'));
}
NODE
)"

echo "5/7 Переключаю .env на облачную базу и добавляю ключ шифрования S3..."
TARGET_PRISMA_URL="$TARGET_PRISMA_URL" MASTER_KEY="$MASTER_KEY" node - <<'NODE'
const fs = require('fs');
let text = fs.readFileSync('.env', 'utf8');

const setValue = (key, value) => {
  const line = key + '="' + value + '"';
  const re = new RegExp('^' + key + '\\s*=.*$', 'm');
  if (re.test(text)) text = text.replace(re, line);
  else text += (text.endsWith('\n') ? '' : '\n') + line + '\n';
};

setValue('DATABASE_URL', process.env.TARGET_PRISMA_URL);
setValue('STORAGE_MASTER_KEY', process.env.MASTER_KEY);
if (!/^PORT\s*=/m.test(text)) setValue('PORT', '8787');

fs.writeFileSync('.env', text);
NODE

echo "6/7 Проверяю Prisma уже на REG.RU..."
npm run db:generate
npm run db:push

echo "7/7 Готово."
echo
echo "Текущая база полностью перенесена в REG.RU PostgreSQL."
echo "Резервная копия локальной базы: $BACKUP_FILE"
echo "Старый .env: $ENV_BACKUP"
echo "Теперь DATABASE_URL в .env указывает на REG.RU."
echo "Secret Access Key S3 введи в Админка → Настройки."
