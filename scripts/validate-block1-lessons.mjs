import { blockOneLessonsTwoToSix } from '../prisma/block1-lessons-2-6.js';

const expected = new Map([
  [2, { title: 'My name is…', screens: 34 }],
  [3, { title: 'I’m from…', screens: 44 }],
  [4, { title: 'Country, city, language', screens: 50 }],
  [5, { title: 'Alphabet & spelling', screens: 56 }],
  [6, { title: 'First conversation', screens: 55 }],
]);

const supportedModes = new Set([
  'info', 'study', 'choice', 'listening', 'reading',
  'match', 'classify', 'order', 'speaking', 'text', 'dialog',
]);

const errors = [];

for (const lesson of blockOneLessonsTwoToSix) {
  const spec = expected.get(lesson.position);
  if (!spec) {
    errors.push(`Неожиданная позиция урока: ${lesson.position}`);
    continue;
  }
  if (lesson.title !== spec.title) errors.push(`Урок ${lesson.position}: ожидалось название «${spec.title}», получено «${lesson.title}»`);
  if (lesson.status !== 'ready') errors.push(`Урок ${lesson.position}: status должен быть ready`);

  const screens = lesson.content?.screens || [];
  if (screens.length !== spec.screens) errors.push(`Урок ${lesson.position}: ожидалось ${spec.screens} экранов, получено ${screens.length}`);

  const ids = new Set();
  for (const screen of screens) {
    if (ids.has(screen.id)) errors.push(`Урок ${lesson.position}: повторяющийся id экрана ${screen.id}`);
    ids.add(screen.id);

    if (screen.type !== 'specTask') errors.push(`Урок ${lesson.position}, экран ${screen.id}: неизвестный type ${screen.type}`);
    if (!supportedModes.has(screen.mode)) errors.push(`Урок ${lesson.position}, экран ${screen.id}: неподдерживаемый mode ${screen.mode}`);
    if (!String(screen.title || '').trim()) errors.push(`Урок ${lesson.position}, экран ${screen.id}: нет title`);
    if (!String(screen.eyebrow || '').trim()) errors.push(`Урок ${lesson.position}, экран ${screen.id}: нет методического типа`);
  }
}

for (const position of expected.keys()) {
  if (!blockOneLessonsTwoToSix.some(lesson => lesson.position === position)) {
    errors.push(`Нет урока ${position}`);
  }
}

const totalScreens = blockOneLessonsTwoToSix.reduce((sum, lesson) => sum + (lesson.content?.screens?.length || 0), 0);
if (totalScreens !== 239) errors.push(`Ожидалось 239 экранов уроков 2–6, получено ${totalScreens}`);

if (errors.length) {
  console.error('Проверка контента не пройдена:');
  errors.forEach(error => console.error(' -', error));
  process.exit(1);
}

console.log('Контент блока проверен.');
for (const lesson of blockOneLessonsTwoToSix) {
  console.log(`Урок ${lesson.position}: ${lesson.title} — ${lesson.content.screens.length} экранов`);
}
console.log(`Всего новых экранов: ${totalScreens}`);
