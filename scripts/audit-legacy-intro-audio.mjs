import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function assertRegDatabase() {
  const raw = process.env.DATABASE_URL || '';
  const url = new URL(raw);
  const port = url.port || '5432';
  const database = url.pathname.replace(/^\//, '');
  if (url.hostname !== '79.174.89.45' || port !== '19538' || database !== 'db1') {
    throw new Error(`Остановка: DATABASE_URL должен указывать на REG.RU db1, сейчас ${url.hostname}:${port}/${database}`);
  }
}

function sanitizeAudioFiles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([voiceId, url]) => [String(voiceId), String(url || '').trim()])
      .filter(([, url]) => Boolean(url))
  );
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

function collectLessonDirectAudioReferences(lesson, skipTarget = null) {
  const refs = [];
  const screens = lesson?.content && typeof lesson.content === 'object' && Array.isArray(lesson.content.screens)
    ? lesson.content.screens
    : [];

  screens.forEach((screen, index) => {
    if (skipTarget && lesson.id === skipTarget.lessonId && screen.id === skipTarget.screenId) return;
    const files = sanitizeAudioFiles(screen?.audioFiles);
    for (const [voiceId, url] of Object.entries(files)) {
      refs.push({
        source: `lesson:${lesson.title} / screen ${screen.id ?? index + 1} / ${voiceId}`,
        url,
      });
    }
  });

  return refs;
}

async function collectAllAudioReferences(skipTarget) {
  const [voices, phrases, lessons] = await Promise.all([
    prisma.voiceProfile.findMany({ select: { id: true, previewUrl: true } }),
    prisma.audioPhrase.findMany({ select: { id: true, text: true, audioFiles: true } }),
    prisma.lesson.findMany({ select: { id: true, title: true, content: true } }),
  ]);

  const refs = [];

  for (const voice of voices) {
    if (voice.previewUrl) refs.push({ source: `voice-preview:${voice.id}`, url: voice.previewUrl });
  }

  for (const phrase of phrases) {
    for (const [voiceId, url] of Object.entries(sanitizeAudioFiles(phrase.audioFiles))) {
      refs.push({ source: `audio-dictionary:${phrase.text} / ${voiceId}`, url });
    }
  }

  for (const lesson of lessons) refs.push(...collectLessonDirectAudioReferences(lesson, skipTarget));

  return refs;
}

async function main() {
  assertRegDatabase();

  const moduleOne = await prisma.courseModule.findUnique({ where: { position: 1 } });
  if (!moduleOne) throw new Error('Модуль 1 не найден');

  const blockOne = await prisma.courseBlock.findFirst({
    where: { moduleId: moduleOne.id, position: 1 },
  });
  if (!blockOne) throw new Error('Модуль 1 / Блок 1 не найден');

  const lesson = await prisma.lesson.findFirst({
    where: { blockId: blockOne.id, position: 1 },
  });
  if (!lesson) throw new Error('Урок 1 не найден');

  const content = lesson.content && typeof lesson.content === 'object' ? lesson.content : {};
  const screens = Array.isArray(content.screens) ? content.screens : [];
  const targetIndex = screens.findIndex(screen => Number(screen?.id) === 1);

  if (targetIndex < 0) throw new Error('Экран 1 урока 1 не найден');

  const target = screens[targetIndex];
  if (target.type !== 'intro' || String(target.title || '').trim() !== 'Hello!') {
    throw new Error(`Остановка: ожидался intro-экран 1 «Hello!», получено type=${target.type}, title=${target.title}`);
  }

  const legacyFiles = sanitizeAudioFiles(target.audioFiles);
  const candidates = [...new Set(Object.values(legacyFiles))];

  console.log('Целевой экран подтверждён: Модуль 1 → Блок 1 → Урок 1 → Экран 1 «Hello!»');
  console.log('По каноническому сценарию этот intro-экран НЕ должен иметь учебного аудио.');
  console.log('');
  console.log(`Старых прямых audioFiles на этом экране: ${Object.keys(legacyFiles).length}`);

  for (const [voiceId, url] of Object.entries(legacyFiles)) {
    console.log(` - ${voiceId}: ${url}`);
  }

  if (target.audioPhrase) console.log(`Дополнительно найден audioPhrase: ${target.audioPhrase}`);
  if (Array.isArray(target.audioPhrases) && target.audioPhrases.length) {
    console.log(`Дополнительно найдены audioPhrases: ${target.audioPhrases.join(', ')}`);
  }

  const otherRefs = await collectAllAudioReferences({ lessonId: lesson.id, screenId: target.id });
  const referencedElsewhere = new Map();

  for (const url of candidates) {
    const refs = otherRefs.filter(ref => ref.url === url);
    if (refs.length) referencedElsewhere.set(url, refs);
  }

  console.log('');
  if (referencedElsewhere.size) {
    console.log('Часть файлов используется ещё где-то и физически удалена НЕ будет:');
    for (const [url, refs] of referencedElsewhere) {
      console.log(` - ${url}`);
      refs.forEach(ref => console.log(`   ↳ ${ref.source}`));
    }
  } else if (candidates.length) {
    console.log('Все найденные прямые файлы уникальны для неправильного intro-экрана.');
  }

  const deletable = candidates.filter(url => !referencedElsewhere.has(url));
  console.log('');
  console.log(`Можно безопасно удалить из S3 после отвязки: ${deletable.length}`);
  console.log(`Нужно оставить физически, потому что есть другие ссылки: ${candidates.length - deletable.length}`);

  if (!apply) {
    console.log('');
    console.log('Режим проверки: база и S3 НЕ изменены.');
    console.log('Для применения после проверки запусти: npm run audio:clean:intro');
    return;
  }

  const nextScreen = { ...target };
  delete nextScreen.audioFiles;
  delete nextScreen.audioPhrase;
  delete nextScreen.audioPhrases;
  delete nextScreen.audio;
  delete nextScreen.audioLines;

  const nextScreens = screens.map((screen, index) => index === targetIndex ? nextScreen : screen);

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { content: { ...content, screens: nextScreens } },
  });

  console.log('');
  console.log('Старые аудиопривязки с intro-экрана удалены из облачной базы.');

  if (!deletable.length) {
    console.log('Уникальных S3-файлов для физического удаления нет.');
    return;
  }

  const settings = await prisma.storageSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error('Настройки S3 не найдены');

  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: decryptSecret(settings.secretAccessKeyEncrypted),
    },
  });

  let deleted = 0;
  for (const url of deletable) {
    const key = s3KeyFromUrl(settings, url);
    if (!key) {
      console.log(`Пропускаю внешний URL, это не объект текущего REG.RU S3: ${url}`);
      continue;
    }
    await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }));
    deleted += 1;
    console.log(`Удалён S3 object: ${key}`);
  }

  console.log('');
  console.log(`Готово. Физически удалено S3-файлов: ${deleted}.`);
  console.log('Другие аудио первого урока и шесть preview-файлов голосов не затронуты.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
