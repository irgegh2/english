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
    const [profile, courseModule] = await Promise.all([
      prisma.profile.findUnique({ where: { id: 1 } }),
      prisma.courseModule.findUnique({ where: { position: 7 }, include: { lessons: { orderBy: { position: 'asc' } } } })
    ]);
    if (!profile || !courseModule) return res.status(404).json({ error: 'Seed data not found' });
    res.json({ profile, module: courseModule });
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
