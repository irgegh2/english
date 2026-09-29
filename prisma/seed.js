import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const lessons = [
  { position: 1, title: 'Как строить фразы', tagPrimary: 'грамматика', tagSecondary: 'говорение', description: 'Учимся собирать простые и естественные фразы для повседневного общения.', progress: 100, duration: 18, imageKey: 'lesson-1.webp' },
  { position: 2, title: 'Настоящее время', tagPrimary: 'грамматика', tagSecondary: 'практика', description: 'Разбираем present simple и учимся говорить о себе, других и своих привычках.', progress: 100, duration: 20, imageKey: 'lesson-2.webp' },
  { position: 3, title: 'Вопросы в речи', tagPrimary: 'грамматика', tagSecondary: 'говорение', description: 'Учимся задавать разные типы вопросов и легко использовать их в диалогах.', progress: 60, duration: 17, imageKey: 'lesson-3.webp' },
  { position: 4, title: 'Полезные связки', tagPrimary: 'лексика', tagSecondary: 'фразовый глагол', description: 'Выражения, которые делают вашу речь более естественной и живой.', progress: 30, duration: 15, imageKey: 'lesson-4.webp' },
  { position: 5, title: 'Сленг в контексте', tagPrimary: 'лексика', tagSecondary: 'мем', description: 'Разбираем популярные выражения из фильмов, сериалов и соцсетей.', progress: 0, duration: 14, imageKey: 'lesson-5.webp' },
  { position: 6, title: 'Слушаем и отвечаем', tagPrimary: 'аудио', tagSecondary: 'говорение', description: 'Тренируем восприятие на слух и учимся быстро реагировать в диалогах.', progress: 0, duration: 16, imageKey: 'lesson-6.webp' }
];

await prisma.profile.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

const module7 = await prisma.courseModule.upsert({
  where: { position: 7 },
  update: {
    title: 'Модуль 7. Разговорный старт',
    shortTitle: 'Разговорный старт',
    description: 'Прокачиваем базовые навыки общения: учимся строить фразы, задавать вопросы, понимать живую речь и говорить увереннее в повседневных ситуациях.',
    level: 'A1–A2'
  },
  create: {
    position: 7,
    title: 'Модуль 7. Разговорный старт',
    shortTitle: 'Разговорный старт',
    description: 'Прокачиваем базовые навыки общения: учимся строить фразы, задавать вопросы, понимать живую речь и говорить увереннее в повседневных ситуациях.',
    level: 'A1–A2'
  }
});

for (const lesson of lessons) {
  await prisma.lesson.upsert({
    where: { moduleId_position: { moduleId: module7.id, position: lesson.position } },
    update: lesson,
    create: { ...lesson, moduleId: module7.id }
  });
}

await prisma.$disconnect();
console.log('Seed complete');
