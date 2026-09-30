import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 8787);

const uploadRoot = path.resolve(process.cwd(), 'public/uploads');
fs.mkdirSync(path.join(uploadRoot, 'audio'), { recursive: true });
fs.mkdirSync(path.join(uploadRoot, 'images'), { recursive: true });

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(uploadRoot));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const kind = req.params.kind;
    const valid = kind === 'audio'
      ? file.mimetype.startsWith('audio/')
      : kind === 'image'
        ? file.mimetype.startsWith('image/')
        : kind === 'file';
    cb(valid ? null : new Error('Unsupported media type'), valid);
  },
});

const STORAGE_SETTINGS_ID = 1;
const STORAGE_MASTER_KEY = process.env.STORAGE_MASTER_KEY || '';

function storageEncryptionKey() {
  if (!STORAGE_MASTER_KEY) return null;
  return crypto.createHash('sha256').update(STORAGE_MASTER_KEY).digest();
}

function encryptStorageSecret(value) {
  const key = storageEncryptionKey();
  if (!key) throw new Error('STORAGE_MASTER_KEY не задан. Выполни команду настройки из README и перезапусти сервер.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptStorageSecret(payload) {
  if (!payload) return '';
  const key = storageEncryptionKey();
  if (!key) throw new Error('STORAGE_MASTER_KEY не задан. Невозможно расшифровать Secret Access Key.');
  const [version, ivB64, tagB64, dataB64] = String(payload).split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Неверный формат зашифрованного Secret Access Key');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function getStorageSettings() {
  return prisma.storageSettings.upsert({
    where: { id: STORAGE_SETTINGS_ID },
    update: {},
    create: {
      id: STORAGE_SETTINGS_ID,
      provider: 'reg-s3',
      endpoint: 'https://s3.regru.cloud',
      region: 'us-east-1',
      bucket: 'английский',
      projectId: '9170a58a-2e99-4b39-ba2f-2b0f30c509aa',
      accessKeyId: 'G2EK9ER0Y1IXEHRWJ6QR',
    },
  });
}

function serializeStorageSettings(settings) {
  return {
    id: settings.id,
    provider: settings.provider,
    endpoint: settings.endpoint,
    region: settings.region,
    bucket: settings.bucket,
    projectId: settings.projectId,
    accessKeyId: settings.accessKeyId,
    hasSecretAccessKey: Boolean(settings.secretAccessKeyEncrypted),
    encryptionReady: Boolean(storageEncryptionKey()),
    updatedAt: settings.updatedAt,
  };
}

function createStorageClient(settings) {
  const secretAccessKey = decryptStorageSecret(settings.secretAccessKeyEncrypted);
  if (!settings.endpoint || !settings.bucket || !settings.accessKeyId || !secretAccessKey) {
    throw new Error('S3 настроен не полностью: нужны endpoint, bucket, Access Key и Secret Key.');
  }

  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey,
    },
  });
}

function storageObjectKey(kind, originalName = '') {
  const folder = kind === 'image' ? 'images' : kind === 'audio' ? 'audio' : 'files';
  const ext = path.extname(originalName || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
  return `${folder}/${Date.now()}-${crypto.randomUUID()}${ext || ''}`;
}

function storagePublicUrl(settings, key) {
  const endpoint = String(settings.endpoint || '').replace(/\/+$/, '');
  const bucket = encodeURIComponent(settings.bucket);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${endpoint}/${bucket}/${encodedKey}`;
}

async function uploadBufferToStorage({ kind, buffer, originalName, mimeType }) {
  const settings = await getStorageSettings();
  const client = createStorageClient(settings);
  const key = storageObjectKey(kind, originalName);

  await client.send(new PutObjectCommand({
    Bucket: settings.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType || 'application/octet-stream',
    ACL: 'public-read',
  }));

  return {
    url: storagePublicUrl(settings, key),
    key,
    bucket: settings.bucket,
    provider: 'reg-s3',
  };
}

async function uploadFileToStorage(kind, file) {
  const stored = await uploadBufferToStorage({
    kind,
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
  });

  return {
    ...stored,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function localUploadAbsolutePath(url) {
  if (!String(url || '').startsWith('/uploads/')) return null;
  const relative = String(url).replace(/^\/uploads\//, '');
  const absolute = path.resolve(uploadRoot, relative);
  return absolute.startsWith(uploadRoot) ? absolute : null;
}

async function migrateOneLocalUpload(url) {
  const absolute = localUploadAbsolutePath(url);
  if (!absolute || !fs.existsSync(absolute)) return null;
  const relative = path.relative(uploadRoot, absolute);
  const kind = relative.startsWith(`images${path.sep}`) ? 'image' : 'audio';
  const buffer = await fs.promises.readFile(absolute);
  const stored = await uploadBufferToStorage({
    kind,
    buffer,
    originalName: path.basename(absolute),
    mimeType: kind === 'image' ? 'image/*' : 'audio/*',
  });
  return stored.url;
}

async function deleteStorageUrl(url) {
  const settings = await getStorageSettings();
  const endpoint = String(settings.endpoint || '').replace(/\/+$/, '');
  const prefix = `${endpoint}/${encodeURIComponent(settings.bucket)}/`;
  if (!String(url || '').startsWith(prefix)) return false;

  const encodedKey = String(url).slice(prefix.length);
  const key = encodedKey.split('/').map(decodeURIComponent).join('/');
  const client = createStorageClient(settings);
  await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }));
  return true;
}

async function cleanupMediaUrl(url) {
  if (!url) return false;

  const absolute = localUploadAbsolutePath(url);
  if (absolute) {
    try {
      await fs.promises.unlink(absolute);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return true;
  }

  return deleteStorageUrl(url);
}

async function cleanupMediaUrlQuietly(url) {
  try {
    await cleanupMediaUrl(url);
  } catch (error) {
    console.warn('Failed to remove old media object:', error.message);
  }
}

const clampProgress = value => Math.max(0, Math.min(100, Number(value ?? 0)));
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const asString = (value, fallback = '') => value == null ? fallback : String(value);
const DEFAULT_VOICES = [
  { id: 'ella', position: 1, name: 'Ella', gender: 'Женский', note: 'мягкий · спокойный', sampleText: "Hi! I'm Ella. This is my voice." },
  { id: 'grace', position: 2, name: 'Grace', gender: 'Женский', note: 'ясный · нейтральный', sampleText: "Hi! I'm Grace. This is my voice." },
  { id: 'chloe', position: 3, name: 'Chloe', gender: 'Женский', note: 'живой · энергичный', sampleText: "Hi! I'm Chloe. This is my voice." },
  { id: 'oliver', position: 4, name: 'Oliver', gender: 'Мужской', note: 'спокойный · низкий', sampleText: "Hi! I'm Oliver. This is my voice." },
  { id: 'james', position: 5, name: 'James', gender: 'Мужской', note: 'нейтральный · чёткий', sampleText: "Hi! I'm James. This is my voice." },
  { id: 'theo', position: 6, name: 'Theo', gender: 'Мужской', note: 'быстрый · разговорный', sampleText: "Hi! I'm Theo. This is my voice." },
];
const VOICE_IDS = new Set(DEFAULT_VOICES.map(voice => voice.id));

const normalizeLibraryKey = value => asString(value)
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('en-US')
  .replace(/\s+/g, ' ');

const normalizeAudioPhrase = normalizeLibraryKey;
const normalizeMediaName = normalizeLibraryKey;

const sanitizeAudioFiles = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const files = {};
  for (const voiceId of VOICE_IDS) {
    const url = asString(value[voiceId]).trim();
    if (url) files[voiceId] = url;
  }
  return files;
};

async function hydrateLessonContent(lesson) {
  const content = lesson?.content;
  const screens = content && typeof content === 'object' && Array.isArray(content.screens)
    ? content.screens
    : [];

  const phraseKeys = [...new Set(
    screens
      .map(screen => normalizeAudioPhrase(screen?.audioPhrase))
      .filter(Boolean)
  )];

  const mediaIds = [...new Set(
    screens
      .map(screen => Number(screen?.mediaId))
      .filter(Number.isInteger)
  )];

  if (!phraseKeys.length && !mediaIds.length) return lesson;

  const [audioEntries, mediaEntries] = await Promise.all([
    phraseKeys.length
      ? prisma.audioPhrase.findMany({ where: { key: { in: phraseKeys } } })
      : [],
    mediaIds.length
      ? prisma.mediaAsset.findMany({ where: { id: { in: mediaIds } } })
      : [],
  ]);

  const audioByKey = new Map(audioEntries.map(entry => [entry.key, sanitizeAudioFiles(entry.audioFiles)]));
  const mediaById = new Map(mediaEntries.map(entry => [entry.id, entry]));

  return {
    ...lesson,
    content: {
      ...content,
      screens: screens.map(screen => {
        const next = { ...screen };

        const phraseKey = normalizeAudioPhrase(screen?.audioPhrase);
        const resolvedAudioFiles = phraseKey ? audioByKey.get(phraseKey) : null;
        if (resolvedAudioFiles) next.resolvedAudioFiles = resolvedAudioFiles;

        const mediaId = Number(screen?.mediaId);
        const media = Number.isInteger(mediaId) ? mediaById.get(mediaId) : null;
        if (media) {
          next.resolvedImageUrl = media.url;
          next.resolvedImageName = media.name;
        }

        return next;
      }),
    },
  };
}

async function ensureVoiceProfiles() {
  for (const voice of DEFAULT_VOICES) {
    await prisma.voiceProfile.upsert({
      where: { id: voice.id },
      update: {
        position: voice.position,
        name: voice.name,
        gender: voice.gender,
        note: voice.note,
      },
      create: voice,
    });
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(503).json({ ok: false, database: 'unavailable', message: error.message });
  }
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });
    if (!profile) return res.status(404).json({ error: 'Profile seed data not found' });

    const currentModule = await prisma.courseModule.findUnique({
      where: { position: profile.currentModulePosition },
      include: { _count: { select: { blocks: true } } },
    });

    if (!currentModule) return res.status(404).json({ error: 'Current module not found' });

    const currentBlock = await prisma.courseBlock.findFirst({
      where: {
        moduleId: currentModule.id,
        position: profile.currentBlockPosition,
      },
    });

    res.json({
      profile,
      currentModule: {
        ...currentModule,
        blockCount: currentModule._count.blocks,
        _count: undefined,
      },
      currentBlock,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/course/modules', async (_req, res) => {
  try {
    const modules = await prisma.courseModule.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { blocks: true } } },
    });

    res.json(modules.map(module => ({
      id: module.id,
      position: module.position,
      title: module.title,
      shortTitle: module.shortTitle,
      description: module.description,
      level: module.level,
      progress: module.progress,
      blockCount: module._count.blocks,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/course/modules/:id/blocks', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid module id' });

  try {
    const module = await prisma.courseModule.findUnique({
      where: { id },
      include: {
        blocks: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { lessons: true } } },
        },
      },
    });

    if (!module) return res.status(404).json({ error: 'Module not found' });

    res.json({
      id: module.id,
      position: module.position,
      title: module.title,
      shortTitle: module.shortTitle,
      description: module.description,
      level: module.level,
      progress: module.progress,
      blocks: module.blocks.map(block => ({
        id: block.id,
        position: block.position,
        title: block.title,
        imageKey: block.imageKey,
        progress: block.progress,
        lessonCount: block._count.lessons,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/course/blocks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid block id' });

  try {
    const block = await prisma.courseBlock.findUnique({
      where: { id },
      include: {
        module: true,
        lessons: { orderBy: { position: 'asc' } },
      },
    });

    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/course/lessons/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid lesson id' });

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        module: true,
        block: true,
      },
    });

    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(await hydrateLessonContent(lesson));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/voices', async (_req, res) => {
  try {
    const voices = await prisma.voiceProfile.findMany({ orderBy: { position: 'asc' } });
    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/profile/settings', async (req, res) => {
  const voicePreset = String(req.body.voicePreset || '');

  if (!VOICE_IDS.has(voicePreset)) {
    return res.status(400).json({ error: 'Invalid voice preset' });
  }

  try {
    const profile = await prisma.profile.update({
      where: { id: 1 },
      data: { voicePreset },
    });
    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/lessons/:id/progress', async (req, res) => {
  const id = Number(req.params.id);
  const progress = clampProgress(req.body.progress);

  try {
    const lesson = await prisma.lesson.update({ where: { id }, data: { progress } });
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* ===========================
   Admin API
   =========================== */

app.get('/api/admin/storage-settings', async (_req, res) => {
  try {
    const settings = await getStorageSettings();
    res.json(serializeStorageSettings(settings));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/storage-settings', async (req, res) => {
  try {
    const data = {};
    if ('endpoint' in req.body) data.endpoint = asString(req.body.endpoint).trim();
    if ('region' in req.body) data.region = asString(req.body.region).trim() || 'us-east-1';
    if ('bucket' in req.body) data.bucket = asString(req.body.bucket).trim();
    if ('projectId' in req.body) data.projectId = asString(req.body.projectId).trim();
    if ('accessKeyId' in req.body) data.accessKeyId = asString(req.body.accessKeyId).trim();

    const secretAccessKey = asString(req.body.secretAccessKey).trim();
    if (secretAccessKey) data.secretAccessKeyEncrypted = encryptStorageSecret(secretAccessKey);

    const settings = await prisma.storageSettings.upsert({
      where: { id: STORAGE_SETTINGS_ID },
      update: data,
      create: {
        id: STORAGE_SETTINGS_ID,
        provider: 'reg-s3',
        endpoint: data.endpoint || 'https://s3.regru.cloud',
        region: data.region || 'us-east-1',
        bucket: data.bucket || 'английский',
        projectId: data.projectId || '9170a58a-2e99-4b39-ba2f-2b0f30c509aa',
        accessKeyId: data.accessKeyId || 'G2EK9ER0Y1IXEHRWJ6QR',
        secretAccessKeyEncrypted: data.secretAccessKeyEncrypted || null,
      },
    });

    res.json(serializeStorageSettings(settings));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/storage-settings/test', async (_req, res) => {
  let client = null;
  let settings = null;
  let key = null;

  try {
    settings = await getStorageSettings();
    client = createStorageClient(settings);
    await client.send(new HeadBucketCommand({ Bucket: settings.bucket }));

    key = `healthchecks/${Date.now()}-${crypto.randomUUID()}.txt`;
    await client.send(new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: Buffer.from('skladno-storage-ok', 'utf8'),
      ContentType: 'text/plain; charset=utf-8',
      ACL: 'public-read',
    }));

    const publicUrl = storagePublicUrl(settings, key);
    const response = await fetch(publicUrl, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`S3 принимает загрузку, но публичное чтение не работает (HTTP ${response.status}). Для картинок и аудио нужен публичный доступ к объектам.`);
    }

    res.json({ ok: true, message: 'Подключение к REG.RU S3 работает: запись и публичное чтение проверены.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  } finally {
    if (client && settings && key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: key }));
      } catch {}
    }
  }
});

app.post('/api/admin/storage-settings/migrate-local-uploads', async (_req, res) => {
  try {
    const migrated = new Map();
    const resolveUrl = async url => {
      if (!String(url || '').startsWith('/uploads/')) return url;
      if (migrated.has(url)) return migrated.get(url);
      const next = await migrateOneLocalUpload(url);
      if (!next) return url;
      migrated.set(url, next);
      return next;
    };

    const voices = await prisma.voiceProfile.findMany();
    for (const voice of voices) {
      if (!voice.previewUrl?.startsWith('/uploads/')) continue;
      await prisma.voiceProfile.update({
        where: { id: voice.id },
        data: { previewUrl: await resolveUrl(voice.previewUrl) },
      });
    }

    const audioPhrases = await prisma.audioPhrase.findMany();
    for (const phrase of audioPhrases) {
      const audioFiles = sanitizeAudioFiles(phrase.audioFiles);
      let changed = false;
      for (const voiceId of Object.keys(audioFiles)) {
        if (!audioFiles[voiceId]?.startsWith('/uploads/')) continue;
        audioFiles[voiceId] = await resolveUrl(audioFiles[voiceId]);
        changed = true;
      }
      if (changed) {
        await prisma.audioPhrase.update({ where: { id: phrase.id }, data: { audioFiles } });
      }
    }

    const mediaAssets = await prisma.mediaAsset.findMany();
    for (const asset of mediaAssets) {
      if (!asset.url?.startsWith('/uploads/')) continue;
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { url: await resolveUrl(asset.url) },
      });
    }

    const lessons = await prisma.lesson.findMany({ select: { id: true, content: true } });
    for (const lesson of lessons) {
      const content = lesson.content;
      if (!content || typeof content !== 'object' || !Array.isArray(content.screens)) continue;
      let changed = false;
      const screens = [];
      for (const screen of content.screens) {
        const next = { ...screen };
        if (next.imageUrl?.startsWith('/uploads/')) {
          next.imageUrl = await resolveUrl(next.imageUrl);
          changed = true;
        }
        if (next.audioFiles && typeof next.audioFiles === 'object') {
          const audioFiles = { ...next.audioFiles };
          for (const voiceId of Object.keys(audioFiles)) {
            if (!audioFiles[voiceId]?.startsWith('/uploads/')) continue;
            audioFiles[voiceId] = await resolveUrl(audioFiles[voiceId]);
            changed = true;
          }
          next.audioFiles = audioFiles;
        }
        screens.push(next);
      }
      if (changed) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: { content: { ...content, screens } },
        });
      }
    }

    res.json({ ok: true, migrated: migrated.size });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/voices', async (_req, res) => {
  try {
    const voices = await prisma.voiceProfile.findMany({ orderBy: { position: 'asc' } });
    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/voices/:id', async (req, res) => {
  const id = asString(req.params.id);
  if (!VOICE_IDS.has(id)) return res.status(400).json({ error: 'Invalid voice id' });

  try {
    const current = await prisma.voiceProfile.findUnique({ where: { id } });
    const data = {};
    if ('name' in req.body) data.name = asString(req.body.name);
    if ('gender' in req.body) data.gender = asString(req.body.gender);
    if ('note' in req.body) data.note = asString(req.body.note);
    if ('sampleText' in req.body) data.sampleText = asString(req.body.sampleText);
    if ('previewUrl' in req.body) data.previewUrl = req.body.previewUrl ? asString(req.body.previewUrl) : null;

    const voice = await prisma.voiceProfile.update({ where: { id }, data });
    if ('previewUrl' in data && current?.previewUrl && current.previewUrl !== data.previewUrl) {
      void cleanupMediaUrlQuietly(current.previewUrl);
    }
    res.json(voice);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/media-library', async (_req, res) => {
  try {
    const entries = await prisma.mediaAsset.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/media-library', async (req, res) => {
  const name = asString(req.body.name).trim();
  const key = normalizeMediaName(name);
  const url = asString(req.body.url).trim();

  if (!key) return res.status(400).json({ error: 'Название картинки обязательно' });
  if (!url) return res.status(400).json({ error: 'Сначала загрузи картинку' });

  try {
    const existing = await prisma.mediaAsset.findUnique({ where: { key } });
    if (existing) return res.status(409).json({ error: 'Картинка с таким названием уже есть в медиатеке' });

    const entry = await prisma.mediaAsset.create({
      data: {
        name,
        key,
        url,
        mimeType: req.body.mimeType ? asString(req.body.mimeType) : null,
        originalName: req.body.originalName ? asString(req.body.originalName) : null,
        size: Number.isFinite(Number(req.body.size)) ? Math.max(0, Math.round(Number(req.body.size))) : null,
      },
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/media-library/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid media asset id' });

  try {
    const current = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Картинка не найдена' });

    const data = {};

    if ('name' in req.body) {
      const name = asString(req.body.name).trim();
      const key = normalizeMediaName(name);
      if (!key) return res.status(400).json({ error: 'Название картинки обязательно' });

      const duplicate = await prisma.mediaAsset.findUnique({ where: { key } });
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: 'Картинка с таким названием уже есть в медиатеке' });
      }

      data.name = name;
      data.key = key;
    }

    if ('url' in req.body) {
      const url = asString(req.body.url).trim();
      if (!url) return res.status(400).json({ error: 'URL картинки обязателен' });
      data.url = url;
    }
    if ('mimeType' in req.body) data.mimeType = req.body.mimeType ? asString(req.body.mimeType) : null;
    if ('originalName' in req.body) data.originalName = req.body.originalName ? asString(req.body.originalName) : null;
    if ('size' in req.body) data.size = Number.isFinite(Number(req.body.size)) ? Math.max(0, Math.round(Number(req.body.size))) : null;

    const entry = await prisma.mediaAsset.update({ where: { id }, data });
    if ('url' in data && current.url && current.url !== data.url) {
      void cleanupMediaUrlQuietly(current.url);
    }
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/media-library/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid media asset id' });

  try {
    const entry = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!entry) return res.status(404).json({ error: 'Картинка не найдена' });

    const lessons = await prisma.lesson.findMany({ select: { id: true, content: true } });
    let usages = 0;
    for (const lesson of lessons) {
      const screens = lesson.content && typeof lesson.content === 'object' && Array.isArray(lesson.content.screens)
        ? lesson.content.screens
        : [];
      usages += screens.filter(screen => Number(screen?.mediaId) === id).length;
    }

    if (usages > 0) {
      return res.status(409).json({
        error: `Эта картинка используется в заданиях: ${usages}. Сначала замени её там.`,
      });
    }

    await prisma.mediaAsset.delete({ where: { id } });
    void cleanupMediaUrlQuietly(entry.url);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/audio-dictionary', async (_req, res) => {
  try {
    const entries = await prisma.audioPhrase.findMany({
      orderBy: [{ text: 'asc' }, { id: 'asc' }],
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/audio-dictionary', async (req, res) => {
  const text = asString(req.body.text).trim();
  const key = normalizeAudioPhrase(text);
  if (!key) return res.status(400).json({ error: 'Phrase text is required' });

  try {
    const existing = await prisma.audioPhrase.findUnique({ where: { key } });
    if (existing) return res.status(409).json({ error: 'Эта фраза уже есть в аудиословаре' });

    const entry = await prisma.audioPhrase.create({
      data: {
        text,
        key,
        audioFiles: sanitizeAudioFiles(req.body.audioFiles),
      },
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/audio-dictionary/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid audio phrase id' });

  try {
    const current = await prisma.audioPhrase.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Audio phrase not found' });

    const data = {};
    let renamedPhrase = null;

    if ('text' in req.body) {
      const text = asString(req.body.text).trim();
      const key = normalizeAudioPhrase(text);
      if (!key) return res.status(400).json({ error: 'Phrase text is required' });

      const duplicate = await prisma.audioPhrase.findUnique({ where: { key } });
      if (duplicate && duplicate.id !== id) {
        return res.status(409).json({ error: 'Эта фраза уже есть в аудиословаре' });
      }

      data.text = text;
      data.key = key;
      if (key !== current.key) renamedPhrase = { text, oldKey: current.key };
    }

    let replacedAudioUrls = [];
    if ('audioFiles' in req.body) {
      data.audioFiles = sanitizeAudioFiles(req.body.audioFiles);
      const currentAudioFiles = sanitizeAudioFiles(current.audioFiles);
      replacedAudioUrls = Object.entries(currentAudioFiles)
        .filter(([voiceId, oldUrl]) => oldUrl && oldUrl !== data.audioFiles[voiceId])
        .map(([, oldUrl]) => oldUrl);
    }

    const lessonUpdates = [];
    if (renamedPhrase) {
      const lessons = await prisma.lesson.findMany({ select: { id: true, content: true } });
      for (const lesson of lessons) {
        const content = lesson.content;
        if (!content || typeof content !== 'object' || !Array.isArray(content.screens)) continue;

        let changed = false;
        const screens = content.screens.map(screen => {
          if (normalizeAudioPhrase(screen?.audioPhrase) !== renamedPhrase.oldKey) return screen;
          changed = true;
          return { ...screen, audioPhrase: renamedPhrase.text };
        });

        if (changed) lessonUpdates.push({ id: lesson.id, content: { ...content, screens } });
      }
    }

    const entry = await prisma.$transaction(async tx => {
      const updated = await tx.audioPhrase.update({ where: { id }, data });
      for (const lesson of lessonUpdates) {
        await tx.lesson.update({
          where: { id: lesson.id },
          data: { content: lesson.content },
        });
      }
      return updated;
    });

    replacedAudioUrls.forEach(url => { void cleanupMediaUrlQuietly(url); });
    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/audio-dictionary/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid audio phrase id' });

  try {
    const current = await prisma.audioPhrase.findUnique({ where: { id } });
    await prisma.audioPhrase.delete({ where: { id } });
    Object.values(sanitizeAudioFiles(current?.audioFiles)).forEach(url => { void cleanupMediaUrlQuietly(url); });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/tree', async (_req, res) => {
  try {
    const modules = await prisma.courseModule.findMany({
      orderBy: { position: 'asc' },
      include: {
        blocks: {
          orderBy: { position: 'asc' },
          include: {
            lessons: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    res.json(modules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/modules', async (req, res) => {
  try {
    const last = await prisma.courseModule.findFirst({ orderBy: { position: 'desc' } });
    const position = numberOr(req.body.position, (last?.position || 0) + 1);
    const title = asString(req.body.title, 'Новый модуль').trim() || 'Новый модуль';

    const module = await prisma.courseModule.create({
      data: {
        position,
        title,
        shortTitle: asString(req.body.shortTitle, title),
        description: asString(req.body.description, ''),
        level: asString(req.body.level, 'A1'),
        progress: clampProgress(req.body.progress),
      },
    });
    res.status(201).json(module);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/modules/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const data = {};
    if ('position' in req.body) data.position = numberOr(req.body.position, 1);
    if ('title' in req.body) data.title = asString(req.body.title);
    if ('shortTitle' in req.body) data.shortTitle = asString(req.body.shortTitle);
    if ('description' in req.body) data.description = asString(req.body.description);
    if ('level' in req.body) data.level = asString(req.body.level);
    if ('progress' in req.body) data.progress = clampProgress(req.body.progress);
    const module = await prisma.courseModule.update({ where: { id }, data });
    res.json(module);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/modules/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.courseModule.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/blocks', async (req, res) => {
  const moduleId = Number(req.body.moduleId);
  if (!Number.isInteger(moduleId)) return res.status(400).json({ error: 'moduleId is required' });

  try {
    const last = await prisma.courseBlock.findFirst({ where: { moduleId }, orderBy: { position: 'desc' } });
    const block = await prisma.courseBlock.create({
      data: {
        moduleId,
        position: numberOr(req.body.position, (last?.position || 0) + 1),
        title: asString(req.body.title, 'Новый блок').trim() || 'Новый блок',
        imageKey: asString(req.body.imageKey, 'lesson-1.webp'),
        progress: clampProgress(req.body.progress),
      },
    });
    res.status(201).json(block);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/blocks/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const data = {};
    if ('position' in req.body) data.position = numberOr(req.body.position, 1);
    if ('title' in req.body) data.title = asString(req.body.title);
    if ('imageKey' in req.body) data.imageKey = asString(req.body.imageKey);
    if ('progress' in req.body) data.progress = clampProgress(req.body.progress);
    const block = await prisma.courseBlock.update({ where: { id }, data });
    res.json(block);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/blocks/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.courseBlock.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/lessons', async (req, res) => {
  const blockId = Number(req.body.blockId);
  if (!Number.isInteger(blockId)) return res.status(400).json({ error: 'blockId is required' });

  try {
    const block = await prisma.courseBlock.findUnique({ where: { id: blockId } });
    if (!block) return res.status(404).json({ error: 'Block not found' });

    const last = await prisma.lesson.findFirst({ where: { blockId }, orderBy: { position: 'desc' } });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: block.moduleId,
        blockId,
        position: numberOr(req.body.position, (last?.position || 0) + 1),
        title: asString(req.body.title, 'Новый урок').trim() || 'Новый урок',
        tagPrimary: asString(req.body.tagPrimary, 'лексика'),
        tagSecondary: asString(req.body.tagSecondary, 'практика'),
        description: asString(req.body.description, ''),
        objective: asString(req.body.objective, ''),
        status: asString(req.body.status, 'ready'),
        content: req.body.content ?? { version: 1, outcomes: [], screens: [] },
        progress: clampProgress(req.body.progress),
        duration: numberOr(req.body.duration, 0),
        imageKey: asString(req.body.imageKey, 'lesson-1.webp'),
      },
    });
    res.status(201).json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/admin/lessons/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const data = {};
    const stringFields = ['title', 'tagPrimary', 'tagSecondary', 'description', 'objective', 'status', 'imageKey'];
    for (const field of stringFields) {
      if (field in req.body) data[field] = asString(req.body[field]);
    }
    if ('position' in req.body) data.position = numberOr(req.body.position, 1);
    if ('progress' in req.body) data.progress = clampProgress(req.body.progress);
    if ('duration' in req.body) data.duration = Math.max(0, numberOr(req.body.duration, 0));
    if ('content' in req.body) data.content = req.body.content;

    const lesson = await prisma.lesson.update({ where: { id }, data });
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/lessons/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.lesson.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/upload/:kind', (req, res, next) => {
  if (!['audio', 'image', 'file'].includes(req.params.kind)) return res.status(400).json({ error: 'Invalid media kind' });
  next();
}, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });

  try {
    const stored = await uploadFileToStorage(req.params.kind, req.file);
    res.status(201).json(stored);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/media', async (req, res) => {
  const url = asString(req.body.url);
  if (!url) return res.status(400).json({ error: 'Media URL is required' });

  try {
    const local = Boolean(localUploadAbsolutePath(url));
    const deleted = await cleanupMediaUrl(url);
    res.json({ ok: true, storage: local ? 'local' : deleted ? 's3' : 'external' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(400).json({ error: error.message || 'Request failed' });
});

try {
  await ensureVoiceProfiles();
} catch (error) {
  console.warn('Voice profiles are not initialized yet:', error.message);
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
