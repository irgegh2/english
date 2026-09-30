import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const TARGET_KEY = 'hello';

function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

function assertRegDatabase() {
  const raw = process.env.DATABASE_URL || '';
  const url = new URL(raw);
  const port = url.port || '5432';
  const database = url.pathname.replace(/^\//, '');
  if (url.hostname !== '79.174.89.45' || port !== '19538' || database !== 'db1') {
    throw new Error(`Остановка: DATABASE_URL должен указывать на REG.RU db1, сейчас ${url.hostname}:${port}/${database}`);
  }
}

function getEncryptionKey() {
  const master = process.env.STORAGE_MASTER_KEY || '';
  if (!master) throw new Error('STORAGE_MASTER_KEY не найден в .env');
  return crypto.createHash('sha256').update(master).digest();
}

function decryptSecret(payload) {
  if (!payload) throw new Error('Secret Access Key S3 не сохранён в базе');
  const [version, ivB64, tagB64, dataB64] = String(payload).split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Неверный формат зашифрованного Secret Access Key');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function s3KeyFromUrl(settings, url) {
  const endpoint = String(settings.endpoint || '').replace(/\/+$/, '');
  const prefix = `${endpoint}/${encodeURIComponent(settings.bucket)}/`;
  if (!String(url || '').startsWith(prefix)) return null;
  return String(url)
    .slice(prefix.length)
    .split('/')
    .map(decodeURIComponent)
    .join('/');
}

async function main() {
  assertRegDatabase();

  const phrase = await prisma.audioPhrase.findUnique({ where: { key: TARGET_KEY } });
  if (!phrase) {
    console.log('Записи "Hello" в аудиословаре уже нет. Ничего удалять не нужно.');
    return;
  }

  const lessons = await prisma.lesson.findMany({ select: { id: true, title: true, content: true } });
  const usages = [];

  for (const lesson of lessons) {
    const screens = lesson.content && typeof lesson.content === 'object' && Array.isArray(lesson.content.screens)
      ? lesson.content.screens
      : [];
    screens.forEach((screen, index) => {
      if (normalize(screen?.audioPhrase) === TARGET_KEY) {
        usages.push({ lessonId: lesson.id, title: lesson.title, screen: index + 1 });
      }
    });
  }

  if (usages.length) {
    console.error('"Hello" всё ещё используется в уроках:');
    usages.forEach(item => console.error(` - урок #${item.lessonId} «${item.title}», экран ${item.screen}`));
    throw new Error('Очистка отменена: сначала отвяжи Hello от этих заданий.');
  }

  const settings = await prisma.storageSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error('Настройки S3 не найдены');

  const secretAccessKey = decryptSecret(settings.secretAccessKeyEncrypted);
  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey,
    },
  });

  const files = phrase.audioFiles && typeof phrase.audioFiles === 'object' && !Array.isArray(phrase.audioFiles)
    ? phrase.audioFiles
    : {};

  const urls = [...new Set(Object.values(files).map(value => String(value || '').trim()).filter(Boolean))];
  let deletedFiles = 0;

  for (const url of urls) {
    const key = s3KeyFromUrl(settings, url);
    if (!key) {
      throw new Error(`У Hello найден неожиданный URL вне текущего S3: ${url}`);
    }
    await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }));
    deletedFiles += 1;
  }

  await prisma.audioPhrase.delete({ where: { id: phrase.id } });

  console.log(`Удалена неиспользуемая фраза: "${phrase.text}"`);
  console.log(`Удалено S3-аудиофайлов: ${deletedFiles}`);
  console.log('Демо шести голосов не затронуты.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
