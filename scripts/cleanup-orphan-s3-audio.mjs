import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

function assertRegDatabase() {
  const raw = process.env.DATABASE_URL || '';
  const url = new URL(raw);
  const port = url.port || '5432';
  const database = url.pathname.replace(/^\//, '');

  if (url.hostname !== '79.174.89.45' || port !== '19538' || database !== 'db1') {
    throw new Error(`Остановка: DATABASE_URL должен указывать на REG.RU db1, сейчас ${url.hostname}:${port}/${database}`);
  }
}

function encryptionKey() {
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

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivB64, 'base64'),
  );
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

async function getReferencedAudioKeys(settings) {
  const [voices, phrases, lessons] = await Promise.all([
    prisma.voiceProfile.findMany({ select: { id: true, previewUrl: true } }),
    prisma.audioPhrase.findMany({ select: { id: true, text: true, audioFiles: true } }),
    prisma.lesson.findMany({ select: { id: true, title: true, content: true } }),
  ]);

  const keys = new Set();
  const references = [];

  const addUrl = (source, url) => {
    if (!url) return;
    const key = s3KeyFromUrl(settings, url);
    if (!key) return;
    if (!key.startsWith('audio/')) return;
    keys.add(key);
    references.push({ source, key });
  };

  for (const voice of voices) {
    addUrl(`voice:${voice.id}`, voice.previewUrl);
  }

  for (const phrase of phrases) {
    const files = phrase.audioFiles && typeof phrase.audioFiles === 'object' && !Array.isArray(phrase.audioFiles)
      ? phrase.audioFiles
      : {};
    for (const [voiceId, url] of Object.entries(files)) {
      addUrl(`audioPhrase:${phrase.text}/${voiceId}`, url);
    }
  }

  for (const lesson of lessons) {
    const screens = lesson.content && typeof lesson.content === 'object' && Array.isArray(lesson.content.screens)
      ? lesson.content.screens
      : [];

    screens.forEach((screen, index) => {
      if (!screen?.audioFiles || typeof screen.audioFiles !== 'object' || Array.isArray(screen.audioFiles)) return;
      for (const [voiceId, url] of Object.entries(screen.audioFiles)) {
        addUrl(`lesson:${lesson.title}#${index + 1}/${voiceId}`, url);
      }
    });
  }

  return { keys, references };
}

async function listAudioObjects(client, bucket) {
  const objects = [];
  let continuationToken;

  do {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'audio/',
      ContinuationToken: continuationToken,
    }));

    for (const item of result.Contents || []) {
      if (item.Key) objects.push({
        key: item.Key,
        size: Number(item.Size || 0),
        lastModified: item.LastModified || null,
      });
    }

    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function main() {
  assertRegDatabase();

  const settings = await prisma.storageSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error('Настройки S3 не найдены');
  if (!settings.endpoint || !settings.bucket || !settings.accessKeyId) {
    throw new Error('Настройки S3 заполнены не полностью');
  }

  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: decryptSecret(settings.secretAccessKeyEncrypted),
    },
  });

  const [{ keys: referencedKeys, references }, objects] = await Promise.all([
    getReferencedAudioKeys(settings),
    listAudioObjects(client, settings.bucket),
  ]);

  const orphaned = objects.filter(item => !referencedKeys.has(item.key));

  console.log(`Аудио-объектов в S3: ${objects.length}`);
  console.log(`Уникальных используемых S3-аудио в базе: ${referencedKeys.size}`);
  console.log(`Найдено неиспользуемых S3-аудио: ${orphaned.length}`);

  if (!orphaned.length) {
    console.log('Удалять нечего.');
    return;
  }

  console.log('');
  console.log('Удаляю только объекты, на которые нет ссылок в VoiceProfile, AudioPhrase и Lesson:');
  for (const item of orphaned) {
    console.log(` - ${item.key} (${item.size} bytes)`);
  }

  for (const item of orphaned) {
    await client.send(new DeleteObjectCommand({
      Bucket: settings.bucket,
      Key: item.key,
    }));
  }

  console.log('');
  console.log(`Удалено неиспользуемых S3-аудиофайлов: ${orphaned.length}`);
  console.log(`Сохранено используемых S3-аудиофайлов: ${referencedKeys.size}`);

  const demoKeys = new Set(
    references
      .filter(item => item.source.startsWith('voice:'))
      .map(item => item.key),
  );
  console.log(`Из них демо голосов: ${demoKeys.size}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
