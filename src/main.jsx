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
      [Play, 'Продолжить обучение', 'current'],
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

function Sidebar({ section, activeItem, setActiveItem, switching, onItemSelect, currentLearningLabel }) {
  const config = sectionConfig[section];
  return (
    <aside className={`sidebar ${switching ? 'sidebar-switching' : ''}`}>
      <div className="sidebar-inner sidebar-enter" key={section}>
        <div className="sidebar-context">
          <span>{config.label}</span>
          <strong>{section === 'learn' ? 'Курс British English' : section === 'community' ? 'Учимся вместе' : 'Твоя панель'}</strong>
        </div>
        <nav className="side-nav">
          {config.items.map(([Icon, label, subtitleKey], index) => {
            const subtitle = subtitleKey === 'current' ? currentLearningLabel : subtitleKey;
            return (
            <button
              key={label}
              style={{ '--nav-order': index }}
              className={`${activeItem === label || (!activeItem && index === (section === 'learn' ? 1 : 0)) ? 'active' : ''} ${subtitle ? 'has-subtitle' : ''}`.trim()}
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
            );
          })}
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

function ModulesPage({ modules, loading, currentModulePosition, onOpenModule }) {
  return (
    <main className="main-content learning-page modules-page">
      <section className="learning-head">
        <div>
          <span className="learning-kicker">British English · полный курс</span>
          <h1>Все модули</h1>
          <p>35 модулей курса. Внутри каждого модуля находятся тематические блоки, а содержание уроков добавим следующим этапом.</p>
        </div>
        <div className="course-summary">
          <strong>{modules.length || 35}</strong>
          <span>модулей</span>
          <i />
          <strong>{modules.reduce((sum, item) => sum + (item.blockCount || 0), 0)}</strong>
          <span>блоков</span>
        </div>
      </section>

      {loading ? (
        <div className="course-loading">Загружаем структуру курса из базы…</div>
      ) : (
        <section className="module-list">
          {modules.map(moduleData => (
            <button
              className={`module-row ${moduleData.position === currentModulePosition ? 'current' : ''}`}
              key={moduleData.id}
              onClick={() => onOpenModule(moduleData)}
            >
              <div className="module-index">{String(moduleData.position).padStart(2, '0')}</div>
              <div className="module-row-main">
                <div className="module-row-top">
                  <span className="module-level">{moduleData.level}</span>
                  {moduleData.progress === 100 && <span className="module-done"><Check size={13} /> пройден</span>}
                  {moduleData.position === currentModulePosition && <span className="module-now">сейчас</span>}
                </div>
                <h3>{moduleData.title}</h3>
              </div>
              <div className="module-meta">
                <div><Layers3 size={16} /><span>{moduleData.blockCount} блоков</span></div>
                <div className="module-progress-mini"><i><b style={{ width: `${moduleData.progress}%` }} /></i><strong>{moduleData.progress}%</strong></div>
              </div>
              <span className="module-open"><ArrowRight size={19} /></span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

function BlocksPage({ moduleData, blocks, loading, currentBlockPosition, isCurrentModule, onBack, onOpenBlock }) {
  return (
    <main className="main-content learning-page blocks-page">
      <LearningBreadcrumbs moduleData={moduleData} onModules={onBack} onModule={() => {}} />
      <section className="module-overview">
        <button className="back-round" onClick={onBack}><ChevronLeft size={18} /></button>
        <div className="module-overview-copy">
          <span className="learning-kicker">{moduleData.level} · Модуль {moduleData.position}</span>
          <h1>{moduleData.title}</h1>
          <p>{blocks.length || moduleData.blockCount || 0} тематических блоков из структуры курса.</p>
        </div>
        <div className="module-overview-stat"><strong>{blocks.length || moduleData.blockCount || 0}</strong><span>блоков</span></div>
        <div className="module-overview-stat"><strong>{moduleData.progress}%</strong><span>прогресс</span></div>
      </section>

      <div className="blocks-title-row">
        <div><span>Содержание модуля</span><h2>Выбери блок</h2></div>
        <p>Сами уроки добавим позже.</p>
      </div>

      {loading ? (
        <div className="course-loading">Загружаем блоки из базы…</div>
      ) : (
        <section className="blocks-grid">
          {blocks.map(block => (
            <button
              className={`block-card ${isCurrentModule && block.position === currentBlockPosition ? 'current' : ''}`}
              key={block.id}
              onClick={() => onOpenBlock(block)}
            >
              <div className="block-thumb">
                <img src={ASSETS[block.imageKey] || `/assets/${block.imageKey}`} alt="" />
                <span>{String(block.position).padStart(2, '0')}</span>
              </div>
              <div className="block-copy">
                <div className="block-topline">
                  <span><BookOpen size={13} /> содержание позже</span>
                  {isCurrentModule && block.position === currentBlockPosition && <span className="block-current-label">текущий блок</span>}
                </div>
                <h3>{block.title}</h3>
                <p>Уроки и материалы этого блока пока не добавлены.</p>
              </div>
              <span className="block-arrow"><ArrowRight size={17} /></span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

function BlockPage({ moduleData, block, loading, onBackToModules, onBackToModule }) {
  return (
    <main className="main-content learning-page block-page">
      <LearningBreadcrumbs moduleData={moduleData} block={block} onModules={onBackToModules} onModule={onBackToModule} />

      {loading || !block ? (
        <div className="course-loading">Открываем блок из базы…</div>
      ) : (
        <>
          <section className="block-detail-hero">
            <div className="block-detail-copy">
              <span className="learning-kicker">{moduleData.level} · Модуль {moduleData.position} · Блок {block.position}</span>
              <h1>{block.title}</h1>
              <p>Блок создан и связан с модулем в базе данных. Содержание уроков добавим отдельно.</p>
              <button onClick={onBackToModule}><ChevronLeft size={16} /> Ко всем блокам модуля</button>
            </div>
            <div className="block-detail-image">
              <img src={ASSETS[block.imageKey] || `/assets/${block.imageKey}`} alt="" />
            </div>
          </section>

          <section className="empty-block-content">
            <div className="empty-block-icon"><BookOpen size={24} /></div>
            <div>
              <span>Содержание блока</span>
              <h2>Уроки пока не добавлены</h2>
              <p>Здесь появятся уроки, когда мы отдельно спроектируем содержание этого блока.</p>
            </div>
          </section>
        </>
      )}
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
  const [dashboard, setDashboard] = useState(null);
  const [modules, setModules] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [section, setSection] = useState('learn');
  const [renderedSection, setRenderedSection] = useState('learn');
  const [switching, setSwitching] = useState(false);
  const [activeItem, setActiveItem] = useState('Все модули');
  const [learningView, setLearningView] = useState('modules');
  const switchTimer = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/course/modules').then(r => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([dashboardData, modulesData]) => {
        setDashboard(dashboardData);
        setProfile(dashboardData.profile);
        setModules(modulesData);
      })
      .catch(() => {})
      .finally(() => setCourseLoading(false));
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
    setSelectedModule(null);
    setSelectedBlock(null);
    setBlocks([]);
    setActiveItem('Все модули');
    window.history.replaceState({}, '', '/learn/modules');
  };

  const fetchBlocks = async moduleData => {
    setBlocksLoading(true);
    try {
      const response = await fetch(`/api/course/modules/${moduleData.id}/blocks`);
      if (!response.ok) throw new Error('Failed to load blocks');
      const data = await response.json();
      setBlocks(data.blocks);
      return data.blocks;
    } catch {
      setBlocks([]);
      return [];
    } finally {
      setBlocksLoading(false);
    }
  };

  const openModule = async moduleData => {
    setSelectedModule(moduleData);
    setSelectedBlock(null);
    setLearningView('blocks');
    setActiveItem('Все модули');
    window.history.replaceState({}, '', `/learn/module-${moduleData.position}`);
    await fetchBlocks(moduleData);
  };

  const openBlock = async block => {
    setSelectedBlock(block);
    setLearningView('block');
    setBlockLoading(true);
    window.history.replaceState({}, '', `/learn/module-${selectedModule.position}/block-${block.position}`);

    try {
      const response = await fetch(`/api/course/blocks/${block.id}`);
      if (!response.ok) throw new Error('Failed to load block');
      setSelectedBlock(await response.json());
    } catch {
      setSelectedBlock(block);
    } finally {
      setBlockLoading(false);
    }
  };

  const openCurrentLearning = async () => {
    if (!dashboard?.currentModule || !dashboard?.currentBlock) return;

    const currentModule = modules.find(item => item.id === dashboard.currentModule.id) || dashboard.currentModule;
    setSelectedModule(currentModule);
    setActiveItem('Продолжить обучение');

    const moduleBlocks = await fetchBlocks(currentModule);
    const currentBlock = moduleBlocks.find(item => item.id === dashboard.currentBlock.id) || dashboard.currentBlock;
    setSelectedBlock(currentBlock);
    setLearningView('block');
    window.history.replaceState({}, '', `/learn/module-${currentModule.position}/block-${currentBlock.position}`);

    setBlockLoading(true);
    try {
      const response = await fetch(`/api/course/blocks/${currentBlock.id}`);
      if (response.ok) setSelectedBlock(await response.json());
    } finally {
      setBlockLoading(false);
    }
  };

  const handleSidebarItem = label => {
    if (renderedSection !== 'learn') return;
    if (label === 'Все модули') openModules();
    if (label === 'Продолжить обучение') void openCurrentLearning();
  };

  const renderLearning = () => {
    if (learningView === 'blocks' && selectedModule) {
      return (
        <BlocksPage
          moduleData={selectedModule}
          blocks={blocks}
          loading={blocksLoading}
          currentBlockPosition={dashboard?.profile?.currentBlockPosition}
          isCurrentModule={selectedModule.position === dashboard?.profile?.currentModulePosition}
          onBack={openModules}
          onOpenBlock={openBlock}
        />
      );
    }

    if (learningView === 'block' && selectedModule) {
      return (
        <BlockPage
          moduleData={selectedModule}
          block={selectedBlock}
          loading={blockLoading}
          onBackToModules={openModules}
          onBackToModule={() => openModule(selectedModule)}
        />
      );
    }

    return (
      <ModulesPage
        modules={modules}
        loading={courseLoading}
        currentModulePosition={dashboard?.profile?.currentModulePosition}
        onOpenModule={openModule}
      />
    );
  };

  const centerKey = renderedSection === 'learn'
    ? `learn-${learningView}-${selectedModule?.id || 0}-${selectedBlock?.id || 0}`
    : renderedSection;

  const currentLearningLabel = dashboard?.currentModule && dashboard?.currentBlock
    ? `Модуль ${dashboard.currentModule.position} · Блок ${dashboard.currentBlock.position}`
    : 'Текущий блок';

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
          currentLearningLabel={currentLearningLabel}
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
