import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json());

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

app.patch('/api/lessons/:id/progress', async (req, res) => {
  const id = Number(req.params.id);
  const progress = Math.max(0, Math.min(100, Number(req.body.progress ?? 0)));

  try {
    const lesson = await prisma.lesson.update({ where: { id }, data: { progress } });
    res.json(lesson);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
