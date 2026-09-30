#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm не найдены. Установи Node.js 20+ и повтори."
  exit 1
fi

if [ ! -f .env ]; then
  echo "Файл .env не найден. Проект в cloud-only режиме: DATABASE_URL должен указывать на REG.RU PostgreSQL."
  exit 1
fi

node - <<'NODE'
const fs = require('fs');
const text = fs.readFileSync('.env', 'utf8');
const match = text.match(/^DATABASE_URL\s*=\s*(.+)$/m);
if (!match) {
  console.error('DATABASE_URL не найден в .env');
  process.exit(1);
}
const value = match[1].trim().replace(/^["']|["']$/g, '');
const url = new URL(value);
const port = url.port || '5432';
if (url.hostname !== '79.174.89.45' || port !== '19538') {
  console.error(`Cloud-only режим: DATABASE_URL должен указывать на REG.RU, сейчас ${url.hostname}:${port}`);
  process.exit(1);
}
NODE

npm install
npm run db:generate
npm run db:push

( sleep 3; open "http://localhost:5173" ) >/dev/null 2>&1 &
exec npm run dev
