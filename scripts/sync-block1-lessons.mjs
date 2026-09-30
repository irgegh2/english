import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { blockOneLessonsTwoToSix } from '../prisma/block1-lessons-2-6.js';

const prisma = new PrismaClient();

const normalizeAudioPhrase = value => String(value || '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('en-US')
  .replace(/\s+/g, ' ');

const expandReusableAudioPhrase = value => {
  const phrase = String(value || '').trim();
  if (!phrase) return [];
  const parts = phrase.split(/\s*[—–-]\s*/).map(part => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every(part => /^[A-Za-z][.!?]?$/.test(part))) {
    return parts.map(part => part.replace(/[.!?]+$/, ''));
  }
  return [phrase];
};

function collectLessonAudioPhrases() {
  const phrases = new Map();

  for (const lesson of blockOneLessonsTwoToSix) {
    for (const screen of lesson.content?.screens || []) {
      const raw = [
        ...expandReusableAudioPhrase(screen.audioPhrase),
        ...(Array.isArray(screen.audioPhrases)
          ? screen.audioPhrases.flatMap(expandReusableAudioPhrase)
          : []),
      ];

      for (const phrase of raw) {
        const key = normalizeAudioPhrase(phrase);
        if (key && !phrases.has(key)) phrases.set(key, phrase);
      }
    }
  }

  return phrases;
}

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

  const phrases = collectLessonAudioPhrases();
  let createdPhrases = 0;

  for (const [key, text] of phrases) {
    const existing = await prisma.audioPhrase.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.audioPhrase.create({
      data: { text, key, audioFiles: {} },
    });
    createdPhrases += 1;
  }

  const totalScreens = blockOneLessonsTwoToSix.reduce((sum, lesson) => sum + lesson.content.screens.length, 0);
  console.log(`Готово: уроки 2–6 синхронизированы. Экранов: ${totalScreens}.`);
  console.log(`Аудиословарь: добавлено ${createdPhrases} новых фраз/букв без файлов; существующие записи и аудио не изменены.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
