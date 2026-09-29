import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, AudioLines, Bell, BookOpen, Bookmark, CalendarDays,
  Check, ChevronDown, ChevronLeft, CircleAlert, CircleUserRound, Clock3, Compass, Flame,
  GraduationCap, Grid2X2, Headphones, Heart, Home, Layers3, LibraryBig,
  MessageCircle, Mic2, Play, RotateCcw, Search, Settings2, Share2, Sparkles,
  Star, Trophy, UserRound, Users, Volume2, WandSparkles, Zap
} from 'lucide-react';
import './styles.css';
import { ASSETS } from './assets.js';

const fallbackLessons = [
  { id: 1, position: 1, title: 'Как строить фразы', tagPrimary: 'грамматика', tagSecondary: 'говорение', description: 'Учимся собирать простые и естественные фразы для повседневного общения.', progress: 100, duration: 18, imageKey: 'lesson-1.webp' },
  { id: 2, position: 2, title: 'Настоящее время', tagPrimary: 'грамматика', tagSecondary: 'практика', description: 'Разбираем present simple и учимся говорить о себе, других и своих привычках.', progress: 100, duration: 20, imageKey: 'lesson-2.webp' },
  { id: 3, position: 3, title: 'Вопросы в речи', tagPrimary: 'грамматика', tagSecondary: 'говорение', description: 'Учимся задавать разные типы вопросов и легко использовать их в диалогах.', progress: 60, duration: 17, imageKey: 'lesson-3.webp' },
  { id: 4, position: 4, title: 'Полезные связки', tagPrimary: 'лексика', tagSecondary: 'фразовый глагол', description: 'Выражения, которые делают вашу речь более естественной и живой.', progress: 30, duration: 15, imageKey: 'lesson-4.webp' },
  { id: 5, position: 5, title: 'Сленг в контексте', tagPrimary: 'лексика', tagSecondary: 'мем', description: 'Разбираем популярные выражения из фильмов, сериалов и соцсетей.', progress: 0, duration: 14, imageKey: 'lesson-5.webp' },
  { id: 6, position: 6, title: 'Слушаем и отвечаем', tagPrimary: 'аудио', tagSecondary: 'говорение', description: 'Тренируем восприятие на слух и учимся быстро реагировать в диалогах.', progress: 0, duration: 16, imageKey: 'lesson-6.webp' },
];

const sectionConfig = {
  home: {
    label: 'Главная',
    icon: Home,
    items: [
      [Home, 'Обзор'], [Activity, 'Мой прогресс'], [CalendarDays, 'Расписание'],
      [Trophy, 'Достижения'], [Star, 'Избранное'],
    ],
  },
  learn: {
    label: 'Обучение',
    icon: BookOpen,
    items: [
      [Play, 'Продолжить обучение', 'Модуль 7 · Блок 1'],
      [Grid2X2, 'Все модули'],
      [RotateCcw, 'Повторение'],
      [CircleAlert, 'Мои ошибки'],
      [BookOpen, 'Словарь'],
      [Sparkles, 'Погружение'],
      [GraduationCap, 'Экзамены'],
      [Star, 'Избранное'],
    ],
  },
  community: {
    label: 'Сообщество',
    icon: Users,
    items: [
      [Compass, 'Лента'], [MessageCircle, 'Обсуждения'], [Users, 'Клубы'],
      [CalendarDays, 'События'], [Trophy, 'Рейтинг'], [UserRound, 'Мой профиль'],
    ],
  },
};

const recent = [
  ['Полезные связки', 'Модуль 7', '#7a61ff', BookOpen],
  ['A Day in My Life', 'Модуль 6', '#9bdc42', MessageCircle],
  ['Понимаем на слух', 'Модуль 6', '#4fc7bd', Headphones],
];

const dictionary = [
  ['actually', 'на самом деле', '★', '#b8f167'],
  ['by the way', 'кстати', '●', '#78c8ff'],
  ['to figure out', 'разобраться', 'Q', '#b8f167'],
  ['slang', 'сленг', '♛', '#ffd568'],
  ['to keep in touch', 'оставаться на связи', '●', '#8c75ff'],
];

const moduleTitles = [
  'Старт и знакомство', 'Люди и вещи вокруг', 'Время и привычки', 'Дом и повседневность',
  'Город и движение', 'Я и мой день', 'Разговорный старт', 'Прошлое и истории',
  'Планы и будущее', 'Работа и учёба', 'Еда и кафе', 'Покупки и деньги',
  'Путешествия', 'Здоровье и самочувствие', 'Друзья и отношения',
  'Хобби и свободное время', 'Новости и медиа', 'Мнения и аргументы',
  'Фильмы и сериалы', 'Интернет и технологии', 'Британский быт', 'Сленг и живая речь',
  'Фразовые глаголы I', 'Фразовые глаголы II', 'Условные конструкции',
  'Сложные времена', 'Письмо и стиль', 'Работа с текстом',
  'Аудирование: естественная скорость', 'Разговорная уверенность',
  'Академический английский', 'Дискуссии и дебаты', 'Нюансы и регистр',
  'Продвинутая грамматика', 'Свободная речь'
];

const levelForModule = position => {
  if (position <= 2) return 'A0–A1';
  if (position <= 7) return 'A1–A2';
  if (position <= 13) return 'A2–B1';
  if (position <= 20) return 'B1–B2';
  if (position <= 27) return 'B2–C1';
  return 'C1–C2';
};

const courseModules = moduleTitles.map((title, index) => {
  const position = index + 1;
  const progress = position <= 6 ? 100 : position === 7 ? 42 : 0;
  return {
    id: position,
    position,
    title,
    level: levelForModule(position),
    blockCount: 7 + ((position * 3) % 7),
    progress,
    description: position === 7
      ? 'Строим живую разговорную базу: фразы, вопросы, связки, произношение и понимание речи.'
      : 'Последовательный набор блоков с грамматикой, лексикой, аудированием и практикой речи.'
  };
});

const module7Blocks = [
  { id: 1, position: 1, title: 'Разговорный фундамент', subtitle: 'Собираем базовые фразы и начинаем говорить без перевода в голове.', lessons: 6, progress: 58, duration: 96, imageKey: 'lesson-1.webp' },
  { id: 2, position: 2, title: 'Вопросы и быстрые ответы', subtitle: 'Учимся поддерживать диалог и не теряться после первой реплики.', lessons: 8, progress: 20, duration: 118, imageKey: 'lesson-3.webp' },
  { id: 3, position: 3, title: 'Естественные связки', subtitle: 'Actually, by the way, I mean и другие связки живой речи.', lessons: 7, progress: 0, duration: 105, imageKey: 'lesson-4.webp' },
  { id: 4, position: 4, title: 'Слушаем настоящую речь', subtitle: 'Разбираем скорость, сокращения и знакомимся с британским звучанием.', lessons: 9, progress: 0, duration: 130, imageKey: 'lesson-6.webp' },
  { id: 5, position: 5, title: 'Сленг без кринжа', subtitle: 'Современные выражения из фильмов, мемов и обычных разговоров.', lessons: 6, progress: 0, duration: 88, imageKey: 'lesson-5.webp' },
  { id: 6, position: 6, title: 'Повседневные ситуации', subtitle: 'Кафе, магазин, встреча, дорога — практикуемся в реальных сценариях.', lessons: 8, progress: 0, duration: 112, imageKey: 'lesson-2.webp' },
  { id: 7, position: 7, title: 'Говорим увереннее', subtitle: 'Интонация, реакция, перефразирование и разговорные стратегии.', lessons: 7, progress: 0, duration: 104, imageKey: 'lesson-3.webp' },
  { id: 8, position: 8, title: 'Финальная практика', subtitle: 'Собираем весь модуль в большие диалоги и мини-сценарии.', lessons: 5, progress: 0, duration: 80, imageKey: 'lesson-1.webp' },
];

const blocksForModule = moduleData => moduleData.position === 7
  ? module7Blocks
  : Array.from({ length: moduleData.blockCount }, (_, index) => ({
      id: index + 1,
      position: index + 1,
      title: index === 0 ? `${moduleData.title}: основа` : `Тема ${index + 1}`,
      subtitle: index === 0
        ? 'Ключевые конструкции, слова и практика для старта этого модуля.'
        : 'Грамматика, лексика и практика в одном последовательном блоке.',
      lessons: 5 + ((index + moduleData.position) % 5),
      progress: moduleData.progress === 100 ? 100 : 0,
      duration: 75 + index * 7,
      imageKey: `lesson-${(index % 6) + 1}.webp`,
    }));

function Logo() {
  return (
    <button className="brand-wrap" type="button" aria-label="Складно">
      <img className="brand-logo-image" src="/assets/skladno-logo.png" alt="" />
      <div>
        <div className="brand">Складно</div>
        <div className="brand-sub">Английский, который<br />складывается в жизнь</div>
      </div>
    </button>
  );
}

function Tag({ children, tone = 'blue' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

function LessonCard({ lesson, onProgress }) {
  const done = lesson.progress === 100;
  const secondTone = lesson.tagSecondary === 'практика' || lesson.tagSecondary === 'фразовый глагол' ? 'green' : 'peach';
  const firstTone = lesson.tagPrimary === 'лексика' ? 'violet' : lesson.tagPrimary === 'аудио' ? 'cyan' : 'blue';
  const actionLabel = done ? 'Повторить' : lesson.progress > 0 ? 'Продолжить' : 'Начать урок';

  const click = async () => {
    const next = done ? 100 : Math.min(100, lesson.progress + (lesson.progress ? 20 : 30));
    onProgress(lesson.id, next);
    try {
      await fetch(`/api/lessons/${lesson.id}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: next }),
      });
    } catch {
      // UI remains interactive even if the API is temporarily unavailable.
    }
  };

  return (
    <article className="lesson-card" tabIndex="0">
      <button className="lesson-card-hit" onClick={click} aria-label={`${actionLabel}: ${lesson.title}`} />
      <div className="lesson-image-wrap">
        <img src={ASSETS[lesson.imageKey] || `/assets/${lesson.imageKey}`} className="lesson-image" alt="" />
        <span className="lesson-no">{lesson.position}</span>
        <span className={`lesson-status ${done ? 'status-done' : ''}`}>
          {done ? <Check size={18} /> : <Play size={14} fill="currentColor" />}
        </span>
      </div>
      <div className="lesson-body">
        <h3>{lesson.title}</h3>
        <div className="tags">
          <Tag tone={firstTone}>{lesson.tagPrimary}</Tag>
          <Tag tone={secondTone}>{lesson.tagSecondary}</Tag>
        </div>
        <p>{lesson.description}</p>
        <div className="progress-line">
          <div className="progress-bg"><span className="progress-fill" style={{ width: `${lesson.progress}%` }} /></div>
          <strong>{lesson.progress}%</strong>
        </div>
        <button className={`lesson-btn ${lesson.progress > 0 && !done ? 'primary' : ''}`} onClick={click}>
          {done ? <RotateCcw size={17} /> : <Play size={14} fill="currentColor" />}
          {actionLabel}
          {lesson.progress > 0 && !done && <ArrowRight size={17} />}
        </button>
      </div>
    </article>
  );
}

function Sidebar({ section, activeItem, setActiveItem, switching, onItemSelect }) {
  const config = sectionConfig[section];
  return (
    <aside className={`sidebar ${switching ? 'sidebar-switching' : ''}`}>
      <div className="sidebar-inner sidebar-enter" key={section}>
        <div className="sidebar-context">
          <span>{config.label}</span>
          <strong>{section === 'learn' ? 'Курс British English' : section === 'community' ? 'Учимся вместе' : 'Твоя панель'}</strong>
        </div>
        <nav className="side-nav">
          {config.items.map(([Icon, label, subtitle], index) => (
            <button
              key={label}
              style={{ '--nav-order': index }}
              className={activeItem === label || (!activeItem && index === (section === 'learn' ? 1 : 0)) ? 'active' : ''}
              onClick={() => {
                setActiveItem(label);
                onItemSelect?.(label);
              }}
            >
              <Icon size={18} />
              <span className="side-label">
                <span>{label}</span>
                {subtitle && <small>{subtitle}</small>}
              </span>
              <ArrowRight size={14} className="side-arrow" />
            </button>
          ))}
        </nav>

        {section === 'learn' && (
          <div className="recent-card">
            <div className="recent-title-row"><h4>Недавние уроки</h4><button>Все</button></div>
            {recent.map(([title, subtitle, color, Icon]) => (
              <button className="recent-row" key={title}>
                <div className="recent-icon" style={{ background: `${color}26`, color }}><Icon size={17} /></div>
                <div><strong>{title}</strong><span>{subtitle}</span></div>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        )}

        {section === 'community' && (
          <div className="sidebar-mini-card community-mini">
            <div className="mini-icon"><Users size={20} /></div>
            <strong>12 человек онлайн</strong>
            <span>Зайди в общий чат и попрактикуй разговорный английский.</span>
            <button>Открыть чат <ArrowRight size={14} /></button>
          </div>
        )}

        {section === 'home' && (
          <div className="sidebar-mini-card home-mini">
            <div className="mini-icon"><Zap size={20} /></div>
            <strong>Серия: 12 дней</strong>
            <span>Сегодня достаточно ещё одного короткого урока.</span>
            <button>Продолжить <ArrowRight size={14} /></button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Topbar({ profile, section, onSectionChange }) {
  const [langOpen, setLangOpen] = useState(false);
  return (
    <header className="topbar">
      <Logo />
      <nav className="top-nav" aria-label="Основные разделы">
        {Object.entries(sectionConfig).map(([key, item]) => {
          const Icon = item.icon;
          return (
            <button key={key} className={section === key ? 'active' : ''} onClick={() => onSectionChange(key)}>
              <Icon size={17} />{item.label}
            </button>
          );
        })}
      </nav>
      <div className="top-actions">
        <button className="streak interactive-soft">
          <Flame size={24} fill="#ff7b17" color="#ff7b17" />
          <div><b>{profile.streak} дней</b><span>в серии</span></div>
        </button>
        <div className="top-progress">
          <div className="tp-label"><span>Мой прогресс</span><b>{profile.overallProgress}%</b></div>
          <div className="tp-track"><i style={{ width: `${profile.overallProgress}%` }} /></div>
        </div>
        <button className="icon-btn" aria-label="Поиск"><Search size={21} /></button>
        <div className="language-wrap">
          <button className="language" onClick={() => setLangOpen(v => !v)}>
            <span className="flag">🇬🇧</span>British English <ChevronDown size={15} className={langOpen ? 'chev-open' : ''} />
          </button>
          {langOpen && (
            <div className="language-menu">
              <button className="selected"><span>🇬🇧</span><div><strong>British English</strong><small>Текущий курс</small></div><Check size={16} /></button>
              <button disabled><span>🇪🇸</span><div><strong>Español</strong><small>Скоро</small></div></button>
              <button disabled><span>🇩🇪</span><div><strong>Deutsch</strong><small>Скоро</small></div></button>
            </div>
          )}
        </div>
        <button className="avatar" aria-label="Профиль">А<span className="online" /></button>
      </div>
    </header>
  );
}

function Hero({ module, block }) {
  const moduleProgress = Math.round(module.lessons.reduce((sum, lesson) => sum + lesson.progress, 0) / module.lessons.length);
  const touched = module.lessons.filter(x => x.progress > 0).length;
  const title = block ? `Блок ${block.position}. ${block.title}` : 'Модуль 7. Разговорный старт';
  const description = block?.subtitle || module.description;

  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="hero-pill">
          <Layers3 size={14} />
          {block ? 'Модуль 7 · Разговорный старт' : 'Разговорный английский'}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="module-progress-label">
          <span>{block ? 'Прогресс блока' : 'Прогресс модуля'}</span>
          <b>{touched} из {module.lessons.length} уроков</b>
        </div>
        <div className="module-progress"><i style={{ width: `${moduleProgress}%` }} /></div>
      </div>
      <div className="hero-art" aria-hidden="true"><img src="/assets/hero-module.webp" alt="" /></div>
    </section>
  );
}

function LearningBreadcrumbs({ moduleData, block, onModules, onModule }) {
  return (
    <div className="learning-breadcrumbs">
      <button onClick={onModules}>Все модули</button>
      {moduleData && <><span>/</span>{block ? <button onClick={onModule}>Модуль {moduleData.position}</button> : <strong>Модуль {moduleData.position}</strong>}</>}
      {block && <><span>/</span><strong>Блок {block.position}</strong></>}
    </div>
  );
}

function ModulesPage({ onOpenModule }) {
  return (
    <main className="main-content learning-page modules-page">
      <section className="learning-head">
        <div>
          <span className="learning-kicker">British English · полный курс</span>
          <h1>Все модули</h1>
          <p>Сначала выбираешь модуль. Внутри него — блоки, а уже внутри блока находятся конкретные уроки.</p>
        </div>
        <div className="course-summary">
          <strong>35</strong>
          <span>модулей</span>
          <i />
          <strong>6</strong>
          <span>уровней</span>
        </div>
      </section>
      <section className="module-list">
        {courseModules.map(moduleData => (
          <button
            className={`module-row ${moduleData.position === 7 ? 'current' : ''}`}
            key={moduleData.position}
            onClick={() => onOpenModule(moduleData)}
          >
            <div className="module-index">{String(moduleData.position).padStart(2, '0')}</div>
            <div className="module-row-main">
              <div className="module-row-top">
                <span className="module-level">{moduleData.level}</span>
                {moduleData.progress === 100 && <span className="module-done"><Check size={13} /> пройден</span>}
                {moduleData.position === 7 && <span className="module-now">сейчас</span>}
              </div>
              <h3>{moduleData.title}</h3>
              <p>{moduleData.description}</p>
            </div>
            <div className="module-meta">
              <div><Layers3 size={16} /><span>{moduleData.blockCount} блоков</span></div>
              <div className="module-progress-mini"><i><b style={{ width: `${moduleData.progress}%` }} /></i><strong>{moduleData.progress}%</strong></div>
            </div>
            <span className="module-open"><ArrowRight size={19} /></span>
          </button>
        ))}
      </section>
    </main>
  );
}

function BlocksPage({ moduleData, onBack, onOpenBlock }) {
  const blocks = blocksForModule(moduleData);
  const completed = blocks.filter(block => block.progress === 100).length;
  return (
    <main className="main-content learning-page blocks-page">
      <LearningBreadcrumbs moduleData={moduleData} onModules={onBack} onModule={() => {}} />
      <section className="module-overview">
        <button className="back-round" onClick={onBack}><ChevronLeft size={18} /></button>
        <div className="module-overview-copy">
          <span className="learning-kicker">{moduleData.level} · Модуль {moduleData.position}</span>
          <h1>{moduleData.title}</h1>
          <p>{moduleData.description}</p>
        </div>
        <div className="module-overview-stat"><strong>{blocks.length}</strong><span>блоков</span></div>
        <div className="module-overview-stat"><strong>{completed}</strong><span>пройдено</span></div>
      </section>
      <div className="blocks-title-row">
        <div><span>Содержание модуля</span><h2>Выбери блок</h2></div>
        <p>В каждом блоке — несколько коротких уроков.</p>
      </div>
      <section className="blocks-grid">
        {blocks.map(block => (
          <button className="block-card" key={block.id} onClick={() => onOpenBlock(block)}>
            <div className="block-thumb">
              <img src={ASSETS[block.imageKey] || `/assets/${block.imageKey}`} alt="" />
              <span>{String(block.position).padStart(2, '0')}</span>
            </div>
            <div className="block-copy">
              <div className="block-topline"><span>{block.lessons} уроков</span><span><Clock3 size={13} /> {block.duration} мин</span></div>
              <h3>{block.title}</h3>
              <p>{block.subtitle}</p>
              <div className="block-progress"><i><b style={{ width: `${block.progress}%` }} /></i><strong>{block.progress}%</strong></div>
            </div>
            <span className="block-arrow"><ArrowRight size={17} /></span>
          </button>
        ))}
      </section>
    </main>
  );
}

function LessonsPage({ moduleData, block, module, onBackToModules, onBackToModule, onProgress }) {
  return (
    <main className="main-content learning-page lessons-page">
      <LearningBreadcrumbs moduleData={moduleData} block={block} onModules={onBackToModules} onModule={onBackToModule} />
      <Hero module={module} block={block} />
      <section className="lessons-grid">
        {module.lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} onProgress={onProgress} />)}
      </section>
    </main>
  );
}

function RightRail() {
  const [liked, setLiked] = useState(false);
  const [savedWords, setSavedWords] = useState(() => new Set());
  const [memePulse, setMemePulse] = useState(0);

  const toggleWord = word => setSavedWords(prev => {
    const next = new Set(prev);
    next.has(word) ? next.delete(word) : next.add(word);
    return next;
  });

  return (
    <aside className="right-rail">
      <section className="widget meme-widget interactive-card">
        <div className="widget-head"><h3><Sparkles size={18} /> Мем дня</h3><button className="plain-icon" onClick={() => setMemePulse(v => v + 1)}><RotateCcw size={17} /></button></div>
        <img key={memePulse} src="/assets/meme.webp" className="meme-image refresh-pop" alt="Мем дня" />
        <p className="meme-caption">«То самое чувство, когда<br />наконец-то понял носителя»</p>
        <div className="social-row">
          <button className={liked ? 'liked' : ''} onClick={() => setLiked(v => !v)}><Heart size={19} fill={liked ? 'currentColor' : 'none'} />{432 + (liked ? 1 : 0)}</button>
          <button><Share2 size={19} /></button>
        </div>
      </section>

      <section className="widget dict-widget interactive-card">
        <div className="widget-head"><h3><BookOpen size={18} /> Словарь модуля</h3><button className="link-btn">Смотреть все <ArrowRight size={13} /></button></div>
        <div className="dict-list">
          {dictionary.map(([word, translation, icon, color]) => (
            <div className="dict-row" key={word}>
              <div className="dict-icon" style={{ background: color }}>{icon}</div>
              <button className="dict-copy"><strong>{word}</strong><span>{translation}</span></button>
              <div className="dict-actions">
                <button aria-label={`Прослушать ${word}`}><Volume2 size={18} /></button>
                <button className={savedWords.has(word) ? 'liked' : ''} onClick={() => toggleWord(word)} aria-label={`Сохранить ${word}`}><Heart size={18} fill={savedWords.has(word) ? 'currentColor' : 'none'} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="widget pronunciation interactive-card">
        <div className="widget-head"><h3><Mic2 size={19} /> Тренировка произношения</h3><ArrowRight size={17} /></div>
        <div className="pron-body">
          <div className="mic-art"><AudioLines size={30} /><Mic2 size={42} /></div>
          <p>Произнеси фразу<br />и получи обратную связь<br />от ИИ</p>
        </div>
        <button className="pron-btn">Начать тренировку</button>
      </section>
    </aside>
  );
}

function HomePage({ profile }) {
  return (
    <main className="main-content alt-page">
      <section className="alt-hero home-hero">
        <div><span className="hero-pill"><WandSparkles size={14} /> Доброй ночи, Анна</span><h1>Продолжим<br />с того же места?</h1><p>У тебя отличная серия. Один короткий урок — и сегодняшний день закрыт.</p><button>Продолжить обучение <ArrowRight size={17} /></button></div>
        <div className="home-score"><strong>{profile.overallProgress}%</strong><span>общий прогресс</span></div>
      </section>
      <section className="quick-grid">
        <button><div className="quick-icon mint"><Play size={20} /></div><strong>Последний урок</strong><span>Вопросы в речи · 60%</span><ArrowRight size={16} /></button>
        <button><div className="quick-icon violet"><Headphones size={20} /></div><strong>Аудио на сегодня</strong><span>2 минуты живой речи</span><ArrowRight size={16} /></button>
        <button><div className="quick-icon orange"><Flame size={20} /></div><strong>Серия</strong><span>{profile.streak} дней без перерыва</span><ArrowRight size={16} /></button>
      </section>
    </main>
  );
}

function CommunityPage() {
  const posts = [
    ['Илья', 'Как вы запоминаете difference between “say” и “tell”?', '8 ответов'],
    ['Маша', 'Собрала 10 британских выражений из нового сезона сериала 👀', '24 ответа'],
    ['Никита', 'Кто хочет 15 минут разговорной практики сегодня вечером?', '12 ответов'],
  ];
  return (
    <main className="main-content alt-page">
      <section className="alt-hero community-hero">
        <div><span className="hero-pill"><Users size={14} /> Сообщество Складно</span><h1>Английский проще,<br />когда ты не один.</h1><p>Обсуждения, разговорные клубы, разборы фильмов и люди на твоём уровне.</p><button>Найти разговорный клуб <ArrowRight size={17} /></button></div>
        <div className="community-bubbles"><span>Hi!</span><span>Fancy a chat?</span><span>Let’s go</span></div>
      </section>
      <section className="feed-card">
        <div className="feed-head"><h2>Сейчас обсуждают</h2><button>Вся лента <ArrowRight size={15} /></button></div>
        {posts.map(([name, text, replies]) => <button className="post-row" key={text}><div className="post-avatar">{name[0]}</div><div><strong>{name}</strong><p>{text}</p><span>{replies}</span></div><ArrowRight size={17} /></button>)}
      </section>
    </main>
  );
}

function App() {
  const [profile, setProfile] = useState({ name: 'Анна', streak: 12, overallProgress: 62 });
  const [module, setModule] = useState({
    title: 'Модуль 7. Разговорный старт',
    description: 'Прокачиваем базовые навыки общения: учимся строить фразы, задавать вопросы, понимать живую речь и говорить увереннее в повседневных ситуациях.',
    lessons: fallbackLessons,
  });
  const [section, setSection] = useState('learn');
  const [renderedSection, setRenderedSection] = useState('learn');
  const [switching, setSwitching] = useState(false);
  const [activeItem, setActiveItem] = useState('Все модули');
  const [learningView, setLearningView] = useState('modules');
  const [selectedModule, setSelectedModule] = useState(courseModules.find(item => item.position === 7));
  const [selectedBlock, setSelectedBlock] = useState(module7Blocks[0]);
  const switchTimer = useRef(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setProfile(data.profile); setModule(data.module); })
      .catch(() => {});
  }, []);

  useEffect(() => () => {
    if (switchTimer.current) window.clearTimeout(switchTimer.current);
  }, []);

  const navigateSection = next => {
    if (next === section) return;

    setSection(next);
    setSwitching(true);

    if (switchTimer.current) window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => {
      const defaults = { home: 'Обзор', learn: 'Все модули', community: 'Лента' };
      setRenderedSection(next);
      setActiveItem(defaults[next]);
      if (next === 'learn') setLearningView('modules');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setSwitching(false));
      });
    }, 115);
  };

  const openModules = () => {
    setLearningView('modules');
    setActiveItem('Все модули');
    window.history.replaceState({}, '', '/learn/modules');
  };

  const openModule = moduleData => {
    setSelectedModule(moduleData);
    setSelectedBlock(blocksForModule(moduleData)[0]);
    setLearningView('blocks');
    setActiveItem('Все модули');
    window.history.replaceState({}, '', `/learn/module-${moduleData.position}`);
  };

  const openBlock = block => {
    setSelectedBlock(block);
    setLearningView('lessons');
    window.history.replaceState({}, '', `/learn/module-${selectedModule.position}/block-${block.position}`);
  };

  const handleSidebarItem = label => {
    if (renderedSection !== 'learn') return;

    if (label === 'Все модули') {
      openModules();
      return;
    }

    if (label === 'Продолжить обучение') {
      const currentModule = courseModules.find(item => item.position === 7);
      const currentBlock = module7Blocks[0];
      setSelectedModule(currentModule);
      setSelectedBlock(currentBlock);
      setLearningView('lessons');
      setActiveItem('Продолжить обучение');
      window.history.replaceState({}, '', '/learn/module-7/block-1');
    }
  };

  const updateProgress = (id, progress) => setModule(current => ({
    ...current,
    lessons: current.lessons.map(lesson => lesson.id === id ? { ...lesson, progress } : lesson),
  }));

  const renderLearning = () => {
    if (learningView === 'blocks') {
      return <BlocksPage moduleData={selectedModule} onBack={openModules} onOpenBlock={openBlock} />;
    }
    if (learningView === 'lessons') {
      return (
        <LessonsPage
          moduleData={selectedModule}
          block={selectedBlock}
          module={module}
          onBackToModules={openModules}
          onBackToModule={() => openModule(selectedModule)}
          onProgress={updateProgress}
        />
      );
    }
    return <ModulesPage onOpenModule={openModule} />;
  };

  const centerKey = renderedSection === 'learn'
    ? `learn-${learningView}-${selectedModule?.position || 0}-${selectedBlock?.position || 0}`
    : renderedSection;

  return (
    <div className="app-shell">
      <Topbar profile={profile} section={section} onSectionChange={navigateSection} />
      <div className="layout">
        <Sidebar
          section={renderedSection}
          activeItem={activeItem}
          setActiveItem={setActiveItem}
          switching={switching}
          onItemSelect={handleSidebarItem}
        />
        <div className={`center-slot ${switching ? 'center-switching' : ''}`}>
          <div className="center-page center-enter" key={centerKey}>
            {renderedSection === 'learn'
              ? renderLearning()
              : renderedSection === 'home'
                ? <HomePage profile={profile} />
                : <CommunityPage />}
          </div>
        </div>
        <RightRail />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
