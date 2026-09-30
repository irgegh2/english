import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

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
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const folder = req.params.kind === 'image' ? 'images' : 'audio';
      const destination = path.join(uploadRoot, folder);
      fs.mkdirSync(destination, { recursive: true });
      cb(null, destination);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext || ''}`);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const kind = req.params.kind;
    const valid = kind === 'audio'
      ? file.mimetype.startsWith('audio/')
      : kind === 'image'
        ? file.mimetype.startsWith('image/')
        : false;
    cb(valid ? null : new Error('Unsupported media type'), valid);
  },
});

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

const normalizeAudioPhrase = value => asString(value)
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('en-US')
  .replace(/\s+/g, ' ');

const sanitizeAudioFiles = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const files = {};
  for (const voiceId of VOICE_IDS) {
    const url = asString(value[voiceId]).trim();
    if (url) files[voiceId] = url;
  }
  return files;
};

async function hydrateLessonAudio(lesson) {
  const content = lesson?.content;
  const screens = content && typeof content === 'object' && Array.isArray(content.screens)
    ? content.screens
    : [];

  const keys = [...new Set(
    screens
      .map(screen => normalizeAudioPhrase(screen?.audioPhrase))
      .filter(Boolean)
  )];

  if (!keys.length) return lesson;

  const entries = await prisma.audioPhrase.findMany({
    where: { key: { in: keys } },
  });
  const byKey = new Map(entries.map(entry => [entry.key, sanitizeAudioFiles(entry.audioFiles)]));

  return {
    ...lesson,
    content: {
      ...content,
      screens: screens.map(screen => {
        const key = normalizeAudioPhrase(screen?.audioPhrase);
        const resolvedAudioFiles = key ? byKey.get(key) : null;
        return resolvedAudioFiles ? { ...screen, resolvedAudioFiles } : screen;
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
    res.json(await hydrateLessonAudio(lesson));
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
    const data = {};
    if ('name' in req.body) data.name = asString(req.body.name);
    if ('gender' in req.body) data.gender = asString(req.body.gender);
    if ('note' in req.body) data.note = asString(req.body.note);
    if ('sampleText' in req.body) data.sampleText = asString(req.body.sampleText);
    if ('previewUrl' in req.body) data.previewUrl = req.body.previewUrl ? asString(req.body.previewUrl) : null;

    const voice = await prisma.voiceProfile.update({ where: { id }, data });
    res.json(voice);
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

    if ('audioFiles' in req.body) {
      data.audioFiles = sanitizeAudioFiles(req.body.audioFiles);
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

    res.json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/audio-dictionary/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid audio phrase id' });

  try {
    await prisma.audioPhrase.delete({ where: { id } });
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
  if (!['audio', 'image'].includes(req.params.kind)) return res.status(400).json({ error: 'Invalid media kind' });
  next();
}, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  const folder = req.params.kind === 'image' ? 'images' : 'audio';
  res.status(201).json({
    url: `/uploads/${folder}/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

app.delete('/api/admin/media', async (req, res) => {
  const url = asString(req.body.url);
  if (!url.startsWith('/uploads/')) return res.status(400).json({ error: 'Invalid media URL' });

  const relative = url.replace(/^\/uploads\//, '');
  const absolute = path.resolve(uploadRoot, relative);
  if (!absolute.startsWith(uploadRoot)) return res.status(400).json({ error: 'Invalid media path' });

  try {
    await fs.promises.unlink(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') return res.status(400).json({ error: error.message });
  }
  res.json({ ok: true });
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
