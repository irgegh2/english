import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { blockOneLessonsTwoToSix } from '../prisma/block1-lessons-2-6.js';

const prisma = new PrismaClient();

async function main() {
  const moduleOne = await prisma.courseModule.findUnique({ where: { position: 1 } });
  if (!moduleOne) throw new Error('Модуль 1 не найден.');

  const blockOne = await prisma.courseBlock.findFirst({
    where: { moduleId: moduleOne.id, position: 1 },
  });
  if (!blockOne) throw new Error('Модуль 1 / Блок 1 не найден.');

  for (const lesson of blockOneLessonsTwoToSix) {
    const existing = await prisma.lesson.findFirst({
      where: { blockId: blockOne.id, position: lesson.position },
    });

    const data = {
      moduleId: moduleOne.id,
      blockId: blockOne.id,
      position: lesson.position,
      title: lesson.title,
      tagPrimary: lesson.tagPrimary,
      tagSecondary: lesson.tagSecondary,
      description: lesson.description,
      objective: lesson.objective,
      status: 'ready',
      content: lesson.content,
      duration: lesson.duration,
      imageKey: lesson.imageKey,
    };

    if (existing) {
      await prisma.lesson.update({ where: { id: existing.id }, data });
      console.log(`Урок ${lesson.position}: обновлён — ${lesson.title} (${lesson.content.screens.length} экранов)`);
    } else {
      await prisma.lesson.create({ data: { ...data, progress: 0 } });
      console.log(`Урок ${lesson.position}: создан — ${lesson.title} (${lesson.content.screens.length} экранов)`);
    }
  }

  const totalScreens = blockOneLessonsTwoToSix.reduce((sum, lesson) => sum + lesson.content.screens.length, 0);
  console.log(`Готово: уроки 2–6 синхронизированы. Экранов: ${totalScreens}.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
