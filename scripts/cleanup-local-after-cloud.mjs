import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const projectRoot = process.cwd();
const prisma = new PrismaClient();

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

function assertCloudDatabase() {
  const raw = process.env.DATABASE_URL || '';
  const url = new URL(raw);
  const port = url.port || '5432';
  if (url.hostname !== '79.174.89.45' || port !== '19538' || url.pathname.replace(/^\//, '') !== 'db1') {
    throw new Error(`Остановка: текущий DATABASE_URL не указывает на REG.RU db1 (сейчас ${url.hostname}:${port}${url.pathname}).`);
  }
  return url;
}

async function findLocalReferences() {
  const [voices, phrases, assets, lessons] = await Promise.all([
    prisma.voiceProfile.findMany({ select: { id: true, previewUrl: true } }),
    prisma.audioPhrase.findMany({ select: { id: true, text: true, audioFiles: true } }),
    prisma.mediaAsset.findMany({ select: { id: true, name: true, url: true } }),
    prisma.lesson.findMany({ select: { id: true, title: true, content: true } }),
  ]);

  const refs = [];
  for (const voice of voices) {
    if (voice.previewUrl?.startsWith('/uploads/')) refs.push(`voice:${voice.id} -> ${voice.previewUrl}`);
  }
  for (const phrase of phrases) {
    const files = phrase.audioFiles && typeof phrase.audioFiles === 'object' ? phrase.audioFiles : {};
    for (const [voiceId, url] of Object.entries(files)) {
      if (String(url || '').startsWith('/uploads/')) refs.push(`audio:${phrase.text}/${voiceId} -> ${url}`);
    }
  }
  for (const asset of assets) {
    if (asset.url?.startsWith('/uploads/')) refs.push(`media:${asset.name} -> ${asset.url}`);
  }
  for (const lesson of lessons) {
    const screens = lesson.content && typeof lesson.content === 'object' && Array.isArray(lesson.content.screens)
      ? lesson.content.screens
      : [];
    screens.forEach((screen, index) => {
      if (screen?.imageUrl?.startsWith('/uploads/')) refs.push(`lesson:${lesson.title}#${index + 1} image -> ${screen.imageUrl}`);
      if (screen?.audioFiles && typeof screen.audioFiles === 'object') {
        for (const [voiceId, url] of Object.entries(screen.audioFiles)) {
          if (String(url || '').startsWith('/uploads/')) refs.push(`lesson:${lesson.title}#${index + 1}/${voiceId} -> ${url}`);
        }
      }
    });
  }
  return refs;
}

function latestLocalEnvBackup() {
  const names = fs.readdirSync(projectRoot)
    .filter(name => name.startsWith('.env.local-backup-'))
    .sort()
    .reverse();
  return names.length ? path.join(projectRoot, names[0]) : null;
}

function findDropdb() {
  const candidates = [
    'dropdb',
    '/Applications/Postgres.app/Contents/Versions/latest/bin/dropdb',
    '/opt/homebrew/opt/libpq/bin/dropdb',
    '/usr/local/opt/libpq/bin/dropdb',
    '/opt/homebrew/bin/dropdb',
    '/usr/local/bin/dropdb',
  ];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (!result.error && result.status === 0) return candidate;
  }
  throw new Error('Не найден dropdb. PostgreSQL CLI должен быть установлен.');
}

function dropLocalDatabase(backupEnvPath) {
  const env = parseEnvFile(backupEnvPath);
  if (!env.DATABASE_URL) throw new Error(`В ${path.basename(backupEnvPath)} нет DATABASE_URL.`);

  const url = new URL(env.DATABASE_URL);
  const host = url.hostname;
  const port = url.port || '5432';
  const database = url.pathname.replace(/^\//, '');
  const user = decodeURIComponent(url.username || '');
  const password = decodeURIComponent(url.password || '');

  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Остановка: backup .env указывает не на локальную БД, а на ${host}.`);
  }
  if (database !== 'skladno') {
    throw new Error(`Остановка: ожидалась локальная база skladno, но найдена ${database}.`);
  }
  if (!user) throw new Error('В backup .env не найден пользователь локальной PostgreSQL.');

  const dropdb = findDropdb();
  console.log(`Удаляю локальную PostgreSQL: ${database} @ ${host}:${port} (user ${user})...`);
  const result = spawnSync(dropdb, [
    '--if-exists',
    '--host', host,
    '--port', port,
    '--username', user,
    database,
  ], {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: password },
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`dropdb завершился с кодом ${result.status}.`);
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? countFiles(full) : 1;
  }
  return total;
}

function cleanupLocalArtifacts() {
  const uploads = path.join(projectRoot, 'public', 'uploads');
  const uploadCount = countFiles(uploads);
  fs.rmSync(uploads, { recursive: true, force: true });

  const backups = path.join(projectRoot, 'backups');
  const backupCount = countFiles(backups);
  fs.rmSync(backups, { recursive: true, force: true });

  const envBackups = fs.readdirSync(projectRoot).filter(name => name.startsWith('.env.local-backup-'));
  for (const name of envBackups) fs.rmSync(path.join(projectRoot, name), { force: true });

  console.log(`Удалено локальных upload-файлов: ${uploadCount}`);
  console.log(`Удалено файлов DB-backup: ${backupCount}`);
  console.log(`Удалено старых .env backup: ${envBackups.length}`);
}

async function main() {
  const cloud = assertCloudDatabase();
  console.log(`Облачная БД подтверждена: ${cloud.hostname}:${cloud.port}/${cloud.pathname.replace(/^\//, '')}`);

  const refs = await findLocalReferences();
  if (refs.length) {
    console.error('В облачной базе ещё есть ссылки на /uploads/:');
    refs.forEach(ref => console.error(' -', ref));
    throw new Error('Очистка отменена. Сначала исправь локальные ссылки в облачной базе.');
  }
  console.log('Проверка ссылок: локальных /uploads/ в облачной базе нет.');

  const backupEnv = latestLocalEnvBackup();
  if (!backupEnv) {
    throw new Error('Не найден .env.local-backup-* с параметрами старой локальной БД. Локальную БД автоматически не удаляю.');
  }

  dropLocalDatabase(backupEnv);
  cleanupLocalArtifacts();

  console.log('');
  console.log('Готово: локальная база skladno удалена, public/uploads удалён, миграционные backup-файлы удалены.');
  console.log('Проект использует REG.RU PostgreSQL + REG.RU S3.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
