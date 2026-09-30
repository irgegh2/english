import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, AudioLines, Bell, BookOpen, Bookmark, CalendarDays, Camera,
  Check, ChevronDown, ChevronLeft, CircleAlert, CircleUserRound, Clock3, Compass, Flame,
  GraduationCap, Grid2X2, Headphones, Heart, Home, Layers3, LibraryBig,
  Maximize2, MessageCircle, Mic2, Minimize2, Play, RotateCcw, Search, Settings2, Share2, Sparkles,
  Star, Trophy, UserRound, Users, Volume2, WandSparkles, Zap
} from 'lucide-react';
import './styles.css';
import { ASSETS } from './assets.js';
import AdminApp from './admin.jsx';
import { END_SOUND_DATA_URL } from './end-sound.js';

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

const VOICE_PRESETS = [
  { id: 'ella', name: 'Ella', gender: 'Женский', note: 'мягкий · спокойный' },
  { id: 'grace', name: 'Grace', gender: 'Женский', note: 'ясный · нейтральный' },
  { id: 'chloe', name: 'Chloe', gender: 'Женский', note: 'живой · энергичный' },
  { id: 'oliver', name: 'Oliver', gender: 'Мужской', note: 'спокойный · низкий' },
  { id: 'james', name: 'James', gender: 'Мужской', note: 'нейтральный · чёткий' },
  { id: 'theo', name: 'Theo', gender: 'Мужской', note: 'быстрый · разговорный' },
];

function getVoicePreset(id, options = VOICE_PRESETS) {
  return options.find(voice => voice.id === id) || options[0] || VOICE_PRESETS[0];
}

const waitForApi = ms => new Promise(resolve => window.setTimeout(resolve, ms));

async function fetchJsonWithStartupRetry(url, attempts = 5) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();

      const data = await response.json().catch(() => ({}));
      const retryableStartupError = response.status >= 500
        && !data.error
        && attempt < attempts - 1;

      if (!retryableStartupError) {
        throw new Error(data.error || `Request failed: ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) break;
    }

    await waitForApi(250 * (attempt + 1));
  }

  throw lastError || new Error('API unavailable');
}

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

function Topbar({ profile, section, onSectionChange, voicePreset, onVoiceChange, voiceOptions = VOICE_PRESETS }) {
  const [langOpen, setLangOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voices = voiceOptions.length ? voiceOptions : VOICE_PRESETS;
  const selectedVoice = getVoicePreset(voicePreset, voices);

  return (
    <>
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
          <button className="icon-btn settings-trigger" aria-label="Настройки" onClick={() => setSettingsOpen(true)}><Settings2 size={20} /></button>
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

      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Настройки">
            <div className="settings-head">
              <div>
                <span>Настройки</span>
                <h2>Голос озвучки</h2>
                <p>Выбери голос, которым будут звучать слова, фразы и диалоги.</p>
              </div>
              <button className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Закрыть">×</button>
            </div>

            <div className="voice-settings-note">
              <AudioLines size={18} />
              <div><strong>Озвучка берётся из общего аудиословаря.</strong><span>Урок хранит только английскую фразу, а запись автоматически подставляется из словаря для выбранного голоса. Если записи нет — кнопка прослушивания не показывается.</span></div>
            </div>

            <div className="voice-groups">
              {['Женский', 'Мужской'].map(group => (
                <div className="voice-group" key={group}>
                  <div className="voice-group-title">{group === 'Женский' ? 'Женские голоса' : 'Мужские голоса'}</div>
                  <div className="voice-grid">
                    {voices.filter(voice => voice.gender === group).map(voice => (
                      <button
                        className={`voice-card voice-card-button ${voice.id === voicePreset ? 'selected' : ''}`}
                        key={voice.id}
                        data-ui-click="off"
                        onClick={() => {
                          onVoiceChange(voice.id);
                          if (voice.previewUrl) playLessonAudio(voice.previewUrl);
                        }}
                        title={voice.previewUrl ? 'Выбрать и послушать голос' : 'Выбрать голос'}
                      >
                        <span className="voice-select">
                          <span className="voice-avatar">{voice.name[0]}</span>
                          <span className="voice-copy"><strong>{voice.name}</strong><small>{voice.note}</small></span>
                          <span className="voice-radio">{voice.id === voicePreset && <Check size={13} />}</span>
                        </span>
                        {voice.sampleText && <span className="voice-sample-text">“{voice.sampleText}”</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="settings-footer">
              <span>Выбран голос: <strong>{selectedVoice.name}</strong></span>
              <button onClick={() => setSettingsOpen(false)}>Готово</button>
            </div>
          </section>
        </div>
      )}
    </>
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

function ModulesPage({ modules, loading, error, currentModulePosition, onOpenModule, onRetry }) {
  return (
    <main className="main-content learning-page modules-page">
      <section className="learning-head">
        <div>
          <span className="learning-kicker">British English · полный курс</span>
          <h1>Все модули</h1>
          <p>35 модулей курса. Внутри каждого модуля находятся тематические блоки, которые постепенно наполняются уроками.</p>
        </div>
        <div className="course-summary">
          <strong>{modules.length}</strong>
          <span>модулей</span>
          <i />
          <strong>{modules.reduce((sum, item) => sum + (item.blockCount || 0), 0)}</strong>
          <span>блоков</span>
        </div>
      </section>

      {loading ? (
        <div className="course-loading">Загружаем структуру курса из базы…</div>
      ) : error ? (
        <div className="course-load-error">
          <strong>Модули не пропали из интерфейса — сейчас не отвечает источник данных.</strong>
          <span>{error}</span>
          <button onClick={onRetry}><RotateCcw size={15} /> Загрузить ещё раз</button>
        </div>
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
                  <span><BookOpen size={13} /> {block.lessonCount > 0 ? `${block.lessonCount} уроков` : 'содержание позже'}</span>
                  {isCurrentModule && block.position === currentBlockPosition && <span className="block-current-label">текущий блок</span>}
                </div>
                <h3>{block.title}</h3>
                <p>{block.lessonCount > 0 ? 'Структура уроков уже загружена.' : 'Уроки и материалы этого блока пока не добавлены.'}</p>
              </div>
              <span className="block-arrow"><ArrowRight size={17} /></span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}


let activeLessonAudio = null;

const UI_SOUND_VERSION = '20260930-6';
const UI_SOUNDS = {
  click: { url: `/assets/sounds/mclick.mp3?v=${UI_SOUND_VERSION}`, volume: 0.42 },
  success: { url: `/assets/sounds/success.mp3?v=${UI_SOUND_VERSION}`, volume: 0.72 },
  error: { url: `/assets/sounds/error.mp3?v=${UI_SOUND_VERSION}`, volume: 0.72 },
  end: { url: END_SOUND_DATA_URL, volume: 0.86 },
};

let uiAudioContext = null;
const uiSoundBuffers = new Map();
const uiSoundLoading = new Map();
const uiAudioFallback = new Map();

function getUiAudioContext() {
  if (typeof window === 'undefined') return null;
  if (uiAudioContext) return uiAudioContext;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  try {
    uiAudioContext = new AudioContextCtor({ latencyHint: 'interactive' });
  } catch {
    try { uiAudioContext = new AudioContextCtor(); } catch { uiAudioContext = null; }
  }
  return uiAudioContext;
}

function getFallbackAudio(name) {
  if (typeof window === 'undefined') return null;
  if (uiAudioFallback.has(name)) return uiAudioFallback.get(name);

  const config = UI_SOUNDS[name];
  if (!config) return null;

  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = config.url;
  audio.volume = config.volume;
  audio.load();
  uiAudioFallback.set(name, audio);
  return audio;
}

async function loadUiSoundBuffer(name) {
  if (uiSoundBuffers.has(name)) return uiSoundBuffers.get(name);
  if (uiSoundLoading.has(name)) return uiSoundLoading.get(name);

  const config = UI_SOUNDS[name];
  const context = getUiAudioContext();
  if (!config || !context || typeof fetch === 'undefined') return null;

  const loading = fetch(config.url, { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`Failed to preload UI sound: ${name}`);
      return response.arrayBuffer();
    })
    .then(buffer => context.decodeAudioData(buffer.slice(0)))
    .then(decoded => {
      uiSoundBuffers.set(name, decoded);
      uiSoundLoading.delete(name);
      return decoded;
    })
    .catch(error => {
      uiSoundLoading.delete(name);
      console.warn(`UI sound preload ${name} failed:`, error);
      return null;
    });

  uiSoundLoading.set(name, loading);
  return loading;
}

function playUiSoundFallback(name) {
  const config = UI_SOUNDS[name];
  const audio = getFallbackAudio(name);
  if (!config || !audio) return false;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = config.volume;
    const promise = audio.play();
    if (promise?.catch) promise.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function playUiSound(name) {
  const config = UI_SOUNDS[name];
  if (!config || typeof window === 'undefined') return false;

  const context = getUiAudioContext();
  const buffer = uiSoundBuffers.get(name);

  if (!context || !buffer) {
    if (!uiSoundLoading.has(name)) void loadUiSoundBuffer(name);
    return playUiSoundFallback(name);
  }

  const start = () => {
    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = config.volume;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
      return true;
    } catch (error) {
      console.warn(`UI sound ${name} failed:`, error);
      return playUiSoundFallback(name);
    }
  };

  if (context.state === 'suspended') {
    context.resume().then(start).catch(() => playUiSoundFallback(name));
    return true;
  }

  return start();
}

function preloadUiSounds() {
  if (typeof window === 'undefined') return;

  getUiAudioContext();
  Object.keys(UI_SOUNDS).forEach(name => {
    void loadUiSoundBuffer(name);
    getFallbackAudio(name);
  });
}

function installUiAudioLifecycle() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__skladnoAudioLifecycleInstalled) return;
  window.__skladnoAudioLifecycleInstalled = true;

  const restore = () => {
    if (document.visibilityState !== 'visible') return;
    preloadUiSounds();
    const context = getUiAudioContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
  };

  document.addEventListener('visibilitychange', restore);
  window.addEventListener('focus', restore);
  window.addEventListener('pageshow', restore);
}

function installGlobalClickSound() {
  if (typeof document === 'undefined' || window.__skladnoClickSoundInstalled) return;
  window.__skladnoClickSoundInstalled = true;

  document.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('button, a, [role="button"], label.admin-upload-btn, label.admin-media-library-upload');
    if (!control || control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true') return;
    if (control.dataset.uiClick === 'off' || control.closest('[data-ui-click="off"]')) return;

    const context = getUiAudioContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    playUiSound('click');
  }, { capture: true, passive: true });
}

function getScreenAudio(screen, presetId) {
  return screen?.resolvedAudioFiles?.[presetId] || screen?.audioFiles?.[presetId] || '';
}

function getScreenAudioSequence(screen, presetId) {
  const sequence = Array.isArray(screen?.resolvedAudioSequence)
    ? screen.resolvedAudioSequence
      .map(item => item?.audioFiles?.[presetId] || '')
      .filter(Boolean)
    : [];
  if (sequence.length) return sequence;

  const single = getScreenAudio(screen, presetId);
  return single ? [single] : [];
}

function playLessonAudio(url) {
  if (!url || typeof window === 'undefined') return false;

  if (activeLessonAudio) {
    activeLessonAudio.pause();
    activeLessonAudio.currentTime = 0;
  }

  const audio = new Audio(url);
  activeLessonAudio = audio;
  audio.addEventListener('ended', () => {
    if (activeLessonAudio === audio) activeLessonAudio = null;
  }, { once: true });
  audio.play().catch(() => {});
  return true;
}

function LessonAudioButton({ url, large = false, label = 'Послушать' }) {
  if (!url) return null;

  return (
    <button
      className={large ? 'lesson-listen-big' : 'lesson-audio-btn'}
      onClick={() => playLessonAudio(url)}
      title={label}
    >
      <Volume2 size={large ? 28 : 20} />
      <span>{label}</span>
    </button>
  );
}

function playLessonAudioSequence(urls = []) {
  const queue = urls.filter(Boolean);
  if (!queue.length || typeof window === 'undefined') return false;

  if (activeLessonAudio) {
    activeLessonAudio.pause();
    activeLessonAudio.currentTime = 0;
    activeLessonAudio = null;
  }

  let index = 0;
  const playNext = () => {
    if (index >= queue.length) {
      activeLessonAudio = null;
      return;
    }

    const audio = new Audio(queue[index]);
    index += 1;
    activeLessonAudio = audio;
    audio.addEventListener('ended', playNext, { once: true });
    audio.addEventListener('error', playNext, { once: true });
    audio.play().catch(playNext);
  };

  playNext();
  return true;
}

function LessonAudioSequenceButton({ urls = [], large = false, label = 'Послушать' }) {
  if (!urls.length) return null;
  return (
    <button
      className={large ? 'lesson-listen-big' : 'lesson-audio-btn'}
      onClick={() => playLessonAudioSequence(urls)}
      title={label}
    >
      <Volume2 size={large ? 28 : 20} />
      <span>{label}{urls.length > 1 ? ` · ${urls.length}` : ''}</span>
    </button>
  );
}

function SceneArt({ type = 'meeting', compact = false, imageUrl = '' }) {
  const captions = {
    meeting: 'Фото: встреча',
    casual: 'Фото: неформальная встреча',
    goodbye: 'Фото: прощание',
    bye: 'Фото: друзья прощаются',
    meet: 'Фото: знакомство',
    ask: 'Фото: How are you?',
  };

  return (
    <div className={`lesson-photo-slot photo-${type} ${compact ? 'compact' : ''} ${imageUrl ? 'has-image' : ''}`} aria-label={captions[type] || 'Место для фото'}>
      {imageUrl ? (
        <img src={imageUrl} alt="" />
      ) : (
        <>
          <div className="photo-placeholder-mark"><Camera size={compact ? 18 : 28} /></div>
          <div className="photo-placeholder-copy">
            <strong>Фото 1:1</strong>
            <span>{captions[type] || 'Сюда загрузим фотографию'}</span>
          </div>
        </>
      )}
    </div>
  );
}

function CourseLessonCard({ lesson, onOpen }) {
  const ready = lesson.status === 'ready' && lesson.content;
  const done = lesson.progress === 100;

  return (
    <article className={`lesson-card course-lesson-card ${ready ? 'lesson-ready' : 'lesson-outline'}`}>
      <button className="lesson-card-hit" onClick={() => onOpen(lesson)} aria-label={`Открыть урок: ${lesson.title}`} />
      <div className="lesson-image-wrap">
        <img src={ASSETS[lesson.imageKey] || `/assets/${lesson.imageKey}`} className="lesson-image" alt="" />
        <span className="lesson-no">{lesson.position}</span>
        <span className={`lesson-status ${done ? 'status-done' : ready ? 'status-ready' : ''}`}>
          {done ? <Check size={18} /> : ready ? <Play size={14} fill="currentColor" /> : <BookOpen size={15} />}
        </span>
      </div>
      <div className="lesson-body">
        <div className="lesson-card-kicker">{ready ? 'интерактивный урок' : 'план урока'}</div>
        <h3>{lesson.title}</h3>
        <div className="tags">
          <Tag tone="blue">{lesson.tagPrimary}</Tag>
          <Tag tone={lesson.tagSecondary === 'говорение' ? 'peach' : 'green'}>{lesson.tagSecondary}</Tag>
        </div>
        <p>{lesson.description}</p>
        <div className="progress-line">
          <div className="progress-bg"><span className="progress-fill" style={{ width: `${lesson.progress}%` }} /></div>
          <strong>{lesson.progress}%</strong>
        </div>
        <button className={`lesson-btn ${ready ? 'primary' : ''}`} onClick={() => onOpen(lesson)}>
          {ready ? <Play size={14} fill="currentColor" /> : <BookOpen size={15} />}
          {ready ? (lesson.progress > 0 ? 'Продолжить' : 'Начать урок') : 'Открыть план'}
          <ArrowRight size={17} />
        </button>
      </div>
    </article>
  );
}

function BlockPage({ moduleData, block, loading, onBackToModules, onBackToModule, onOpenLesson }) {
  const lessons = block?.lessons || [];

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
              <p>
                {lessons.length
                  ? `${lessons.length} уроков. Уроки 1–6 собраны как полноценные интерактивные сценарии первого блока.`
                  : 'Уроки и материалы этого блока пока не добавлены.'}
              </p>
              <button onClick={onBackToModule}><ChevronLeft size={16} /> Ко всем блокам модуля</button>
            </div>
            <div className="block-detail-image">
              <img src={ASSETS[block.imageKey] || `/assets/${block.imageKey}`} alt="" />
            </div>
          </section>

          {lessons.length ? (
            <section className="lessons-grid block-lessons-grid">
              {lessons.map(lesson => (
                <CourseLessonCard key={lesson.id} lesson={lesson} onOpen={onOpenLesson} />
              ))}
            </section>
          ) : (
            <section className="empty-block-content">
              <div className="empty-block-icon"><BookOpen size={24} /></div>
              <div>
                <span>Содержание блока</span>
                <h2>Уроки пока не добавлены</h2>
                <p>Здесь появятся уроки, когда мы отдельно спроектируем содержание этого блока.</p>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ChoiceOptions({ options, answer, selected, onSelect, confirmed = false, locked = false }) {
  return (
    <div className="lesson-options">
      {options.map(option => {
        const isSelected = selected === option;
        const isCorrect = confirmed && isSelected && option === answer;
        const isWrong = confirmed && isSelected && option !== answer;
        const stateClass = isCorrect ? 'correct' : isWrong ? 'wrong' : isSelected ? 'selected' : '';

        return (
          <button
            key={option}
            className={stateClass}
            onClick={() => !locked && onSelect(option)}
            disabled={locked}
          >
            <span>{option}</span>
            {isCorrect && <Check size={18} />}
          </button>
        );
      })}
    </div>
  );
}


const normalizeAnswerText = value => String(value || '')
  .trim()
  .replace(/^•\s*/, '')
  .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
  .replace(/[.!?]+$/, '')
  .toLocaleLowerCase('en-US');

function inferSpecQuestions(screen) {
  if (Array.isArray(screen?.questions) && screen.questions.length) return screen.questions;

  const lines = Array.isArray(screen?.body) ? screen.body.map(line => String(line || '').trim()).filter(Boolean) : [];
  const questions = [];
  const isMeta = line => /^(варианты|ответ|правильн|неправильн|методическ|что закреп|что происходит|важно|зачем|следующ|результат|пример|картинка|аудио)\b/i.test(line);

  for (let index = 0; index < lines.length;) {
    if (!lines[index].startsWith('• ')) {
      index += 1;
      continue;
    }

    const options = [];
    const runStart = index;
    while (index < lines.length && lines[index].startsWith('• ')) {
      const option = lines[index].replace(/^•\s*/, '').trim();
      if (option) options.push(option);
      index += 1;
    }
    if (options.length < 2) continue;

    let markerIndex = -1;
    let multiple = false;
    for (let look = index; look < Math.min(lines.length, index + 10); look += 1) {
      const value = lines[look].replace(/:$/, '').trim();
      if (/^правильные$/i.test(value)) {
        markerIndex = look;
        multiple = true;
        break;
      }
      if (/^(правильный ответ|правильная фраза|правильный вариант|правильный|ответ|неправильная фраза|неправильная)$/i.test(value)) {
        markerIndex = look;
        break;
      }
      if (lines[look].startsWith('• ')) break;
    }
    if (markerIndex < 0) continue;

    const expected = [];
    for (let look = markerIndex + 1; look < Math.min(lines.length, markerIndex + 8); look += 1) {
      const value = lines[look].replace(/^•\s*/, '').trim();
      if (!value) continue;
      if (isMeta(value) && expected.length) break;
      const option = options.find(item => normalizeAnswerText(item) === normalizeAnswerText(value));
      if (option) {
        expected.push(option);
        if (!multiple) break;
        continue;
      }
      if (expected.length) break;
    }
    if (!expected.length) continue;

    let prompt = '';
    for (let look = runStart - 1; look >= Math.max(0, runStart - 12); look -= 1) {
      const value = lines[look].trim();
      if (!value || /^(варианты|выбери|пример\s*\d*|задание\s*\d*)\s*:?$/i.test(value)) continue;
      if (isMeta(value)) continue;
      prompt = value;
      break;
    }

    questions.push({
      prompt: prompt || screen.title || `Вопрос ${questions.length + 1}`,
      options,
      ...(expected.length > 1 ? { answers: expected } : { answer: expected[0] }),
    });
  }

  return questions;
}

function inferSpecExpectedText(screen) {
  const lines = Array.isArray(screen?.body) ? screen.body.map(line => String(line || '').trim()).filter(Boolean) : [];
  for (let index = 0; index < lines.length; index += 1) {
    const marker = lines[index].replace(/:$/, '').trim();
    if (!/^(результат|правильный ответ|ответ)$/i.test(marker)) continue;
    for (let look = index + 1; look < Math.min(lines.length, index + 5); look += 1) {
      const value = lines[look].replace(/^•\s*/, '').trim();
      if (!value || /^(что |метод|важно|зачем)/i.test(value)) continue;
      return value;
    }
  }
  return '';
}

function MultiSelectOptions({ options, answers = [], selected = [], onSelect, confirmed = false, locked = false }) {
  const selectedValues = Array.isArray(selected) ? selected : [];

  return (
    <div className="lesson-options spec-multiselect">
      {options.map(option => {
        const isSelected = selectedValues.includes(option);
        const shouldBeSelected = answers.includes(option);
        const isCorrect = confirmed && isSelected && shouldBeSelected;
        const isWrong = confirmed && isSelected && !shouldBeSelected;
        const isMissed = confirmed && !isSelected && shouldBeSelected;
        const stateClass = isCorrect ? 'correct' : isWrong || isMissed ? 'wrong' : isSelected ? 'selected' : '';

        return (
          <button
            key={option}
            className={stateClass}
            onClick={() => {
              if (locked) return;
              const next = isSelected
                ? selectedValues.filter(value => value !== option)
                : [...selectedValues, option];
              onSelect(next);
            }}
            disabled={locked}
          >
            <span>{option}</span>
            {isSelected && <Check size={18} />}
          </button>
        );
      })}
    </div>
  );
}

function VoicePracticeRecorder({ done = false, onDone, compact = false }) {
  const [recording, setRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    streamRef.current?.getTracks?.().forEach(track => track.stop());
  }, [previewUrl]);

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Запись голоса недоступна в этом браузере. Можно отметить фразу как произнесённую.');
      return;
    }

    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      });
      mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (blob.size) setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setRecording(false);
        onDone?.();
      }, { once: true });

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setRecording(false);
      setError(err?.name === 'NotAllowedError'
        ? 'Нет доступа к микрофону. Разреши микрофон браузеру или отметь выполнение вручную.'
        : 'Не удалось начать запись голоса.');
    }
  };

  return (
    <div className={`voice-practice-recorder ${compact ? 'compact' : ''} ${done ? 'done' : ''}`}>
      <button
        type="button"
        className={recording ? 'recording' : ''}
        onClick={recording ? stop : start}
        data-ui-click="off"
      >
        {recording ? <AudioLines size={18} /> : <Mic2 size={18} />}
        {recording ? 'Остановить запись' : previewUrl ? 'Записать ещё раз' : 'Записать голос'}
      </button>
      {previewUrl && <audio controls src={previewUrl} preload="metadata" />}
      {!recording && !previewUrl && (
        <button type="button" className="voice-practice-skip" onClick={() => onDone?.()}>
          {done ? <><Check size={15} /> Выполнено</> : 'Я произнёс вслух'}
        </button>
      )}
      {error && <small>{error}</small>}
    </div>
  );
}

function SpecTaskScreen({
  screen,
  voicePreset,
  answers,
  setAnswer,
  ordered,
  setOrder,
  repeated,
  setRepeated,
  spoken,
  setSpoken,
  confirmation,
}) {
  const audioUrls = getScreenAudioSequence(screen, voicePreset);
  const questions = inferSpecQuestions(screen);
  const pairs = screen.pairs || [];
  const sourceMode = screen.mode || 'info';
  const mode = questions.length && ['info', 'dialog', 'text'].includes(sourceMode) ? 'choice' : sourceMode;
  const displayLines = (mode === 'info' || mode === 'study' || mode === 'dialog' || mode === 'speaking' || mode === 'text')
    ? (screen.body || screen.lead || [])
    : (screen.lead || []);
  const locked = confirmation.status === 'correct';

  const renderLines = lines => (
    <div className="spec-copy">
      {(lines || []).slice(0, mode === 'info' ? 28 : 16).map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );

  if (mode === 'study') {
    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.focus || screen.title}</h1>
        {screen.title !== screen.focus && <h2 className="spec-subtitle">{screen.title}</h2>}
        <LessonAudioSequenceButton urls={audioUrls} large label="Послушать" />
        {renderLines(displayLines)}
        {!audioUrls.length && screen.audioPhrases?.length > 0 && (
          <div className="spec-audio-missing">Аудио для этого материала ещё не добавлено в аудиословарь.</div>
        )}
      </div>
    );
  }

  if (['choice', 'listening', 'reading'].includes(mode) && questions.length) {
    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
        {mode === 'listening' && (
          <>
            <LessonAudioSequenceButton urls={audioUrls} large label={audioUrls.length > 1 ? 'Послушать последовательность' : 'Послушать'} />
            {!audioUrls.length && screen.audioPhrases?.length > 0 && <div className="spec-audio-missing">Нужные записи пока не добавлены в аудиословарь.</div>}
          </>
        )}
        {mode === 'reading' && renderLines(displayLines)}
        {mode === 'choice' && screen.resolvedImageUrl && <SceneArt imageUrl={screen.resolvedImageUrl} compact />}
        <div className="lesson-multi-stack">
          {questions.map((item, index) => (
            <div className="lesson-multi-item" key={index}>
              <strong>{item.prompt || `Вопрос ${index + 1}`}</strong>
              {Array.isArray(item.answers) && item.answers.length > 1 ? (
                <MultiSelectOptions
                  options={item.options || []}
                  answers={item.answers}
                  selected={answers[index]}
                  onSelect={value => setAnswer(index, value)}
                  confirmed={confirmation.status !== 'idle'}
                  locked={locked}
                />
              ) : (
                <ChoiceOptions
                  options={item.options || []}
                  answer={item.answer}
                  selected={answers[index]}
                  onSelect={value => setAnswer(index, value)}
                  confirmed={confirmation.status !== 'idle'}
                  locked={locked}
                />
              )}
            </div>
          ))}
        </div>
        {confirmation.status === 'correct' && <p className="lesson-feedback success"><Check size={15} /> Всё верно!</p>}
        {confirmation.status === 'wrong' && <p className="lesson-feedback error">Есть ошибка. Исправь ответ и попробуй ещё раз.</p>}
      </div>
    );
  }

  if (['match', 'classify'].includes(mode) && pairs.length) {
    const choices = [...new Set(pairs.map(pair => pair.slice(1).join(' → ')))];
    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
        {renderLines(screen.lead || [])}
        <div className="spec-pairs">
          {pairs.map((pair, index) => {
            const correct = pair.slice(1).join(' → ');
            const selected = answers[index] || '';
            const state = confirmation.status === 'idle' ? '' : selected === correct ? 'correct' : 'wrong';
            return (
              <div className={`spec-pair-row ${state}`} key={`${pair[0]}-${index}`}>
                <strong>{pair[0]}</strong>
                <span>→</span>
                <select value={selected} onChange={event => !locked && setAnswer(index, event.target.value)} disabled={locked}>
                  <option value="">Выбери…</option>
                  {choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === 'order' && screen.tokens?.length && screen.orderAnswer?.length) {
    const remaining = screen.tokens.filter((token, index) => {
      const selectedCount = ordered.filter(x => x === token).length;
      const before = screen.tokens.slice(0, index + 1).filter(x => x === token).length;
      return selectedCount < before;
    });

    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
        <LessonAudioSequenceButton urls={audioUrls} label="Послушать" />
        <div className={`sentence-builder ${confirmation.status === 'correct' ? 'confirmed-correct' : confirmation.status === 'wrong' ? 'confirmed-wrong' : ''}`}>
          <div className="sentence-built">
            {ordered.length
              ? ordered.map((token, index) => <button key={`${token}-${index}`} disabled={locked} onClick={() => setOrder(current => current.filter((_, i) => i !== index))}>{token}</button>)
              : <span>Нажимай на элементы по порядку</span>}
          </div>
          <div className="sentence-tokens">
            {remaining.map((token, index) => <button key={`${token}-${index}`} disabled={locked} onClick={() => setOrder(current => [...current, token])}>{token}</button>)}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'dialog') {
    const lines = screen.body || screen.lead || [];
    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
        <LessonAudioSequenceButton urls={audioUrls} large label="Послушать диалог" />
        <div className="spec-dialogue">
          {lines.slice(0, 30).map((line, index) => {
            const match = String(line).match(/^([AB]):\s*(.*)$/);
            if (match) {
              return <div className={`spec-dialogue-line speaker-${match[1].toLowerCase()}`} key={index}><span>{match[1]}</span><p>{match[2]}</p></div>;
            }
            return <p className="spec-dialogue-note" key={index}>{line}</p>;
          })}
        </div>
      </div>
    );
  }

  if (mode === 'speaking') {
    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
        <LessonAudioSequenceButton urls={audioUrls} label="Послушать образец" />
        {renderLines(screen.lead || [])}
        <VoicePracticeRecorder
          done={Boolean(spoken[0])}
          onDone={() => setSpoken(prev => ({ ...prev, 0: true }))}
        />
        {spoken[0] && screen.expected?.length > 0 && (
          <div className="spec-expected">
            <span>Возможный вариант</span>
            {screen.expected.map((item, index) => <strong key={index}>{item}</strong>)}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'text') {
    const expectedText = inferSpecExpectedText(screen);
    return (
      <div className="lesson-task spec-task">
        <span className="lesson-eyebrow">{screen.eyebrow}</span>
        <h1>{screen.title}</h1>
        {renderLines(screen.lead || [])}
        <textarea
          className="spec-text-answer"
          value={answers.text || ''}
          onChange={event => setAnswer('text', event.target.value)}
          placeholder="Напиши свой ответ…"
          rows={4}
        />
        {expectedText && confirmation.status === 'correct' && (
          <p className="lesson-feedback success"><Check size={15} /> Верно: {expectedText}</p>
        )}
        {expectedText && confirmation.status === 'wrong' && (
          <p className="lesson-feedback error">Проверь написание и попробуй ещё раз.</p>
        )}
      </div>
    );
  }

  return (
    <div className="lesson-task spec-task">
      <span className="lesson-eyebrow">{screen.eyebrow}</span>
      <h1>{screen.title}</h1>
      <LessonAudioSequenceButton urls={audioUrls} label="Послушать" />
      {renderLines(displayLines)}
    </div>
  );
}

function LessonRunner({ lesson, onProgress, onExit, voicePreset }) {
  const screens = lesson.content?.screens || [];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [ordered, setOrdered] = useState([]);
  const [repeated, setRepeated] = useState({});
  const [spoken, setSpoken] = useState({});
  const [finished, setFinished] = useState(false);
  const [confirmation, setConfirmation] = useState({ status: 'idle' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lessonRunnerRef = useRef(null);
  const completionSoundPlayedRef = useRef(false);

  const screen = screens[step];
  const screenAudio = getScreenAudio(screen, voicePreset);

  useEffect(() => {
    setAnswers({});
    setOrdered([]);
    setRepeated({});
    setSpoken({});
    setConfirmation({ status: 'idle' });
  }, [step]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
    };

    window.scrollTo(0, 0);
    html.classList.add('lesson-scroll-locked');
    body.classList.add('lesson-scroll-locked');
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = '0';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.classList.remove('lesson-scroll-locked');
      body.classList.remove('lesson-scroll-locked');
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(active === lessonRunnerRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  if (!screen) return null;

  const specQuestions = screen.type === 'specTask' ? inferSpecQuestions(screen) : [];
  const specPairs = screen.type === 'specTask' ? (screen.pairs || []) : [];
  const specSourceMode = screen.type === 'specTask' ? (screen.mode || 'info') : '';
  const specMode = specQuestions.length && ['info', 'dialog', 'text'].includes(specSourceMode) ? 'choice' : specSourceMode;
  const specExpectedText = screen.type === 'specTask' && specMode === 'text' ? inferSpecExpectedText(screen) : '';
  const specCheckable = screen.type === 'specTask' && (
    (['choice', 'listening', 'reading'].includes(specMode) && specQuestions.length > 0) ||
    (['match', 'classify'].includes(specMode) && specPairs.length > 0) ||
    (specMode === 'order' && (screen.tokens || []).length > 0 && (screen.orderAnswer || []).length > 0) ||
    (specMode === 'text' && Boolean(specExpectedText))
  );
  const isCheckable = ['choice', 'listeningChoice', 'multiChoice', 'listeningDialog', 'classify', 'order'].includes(screen.type) || specCheckable;

  const clearConfirmation = () => {
    if (confirmation.status !== 'idle') setConfirmation({ status: 'idle' });
  };

  const setAnswer = (key, value) => {
    clearConfirmation();
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const setOrder = updater => {
    clearConfirmation();
    setOrdered(updater);
  };

  const allMultiAnswered = items => items.every((item, index) => {
    const value = answers[index];
    if (Array.isArray(item.answers) && item.answers.length > 1) {
      return Array.isArray(value) && value.length === item.answers.length;
    }
    return value !== undefined && value !== null && value !== '';
  });
  const allMultiCorrect = items => items.every((item, index) => {
    const value = answers[index];
    if (Array.isArray(item.answers) && item.answers.length > 1) {
      if (!Array.isArray(value) || value.length !== item.answers.length) return false;
      const expected = new Set(item.answers);
      return value.every(option => expected.has(option));
    }
    return value === item.answer;
  });

  const selectionReady = (() => {
    if (screen.type === 'choice' || screen.type === 'listeningChoice') return Boolean(answers.single);
    if (screen.type === 'multiChoice' || screen.type === 'listeningDialog') return allMultiAnswered(screen.items || []);
    if (screen.type === 'classify') return allMultiAnswered(screen.items || []);
    if (screen.type === 'order') return ordered.length === (screen.answer || []).length;
    if (screen.type === 'specTask') {
      if (['choice', 'listening', 'reading'].includes(specMode) && specQuestions.length) return allMultiAnswered(specQuestions);
      if (['match', 'classify'].includes(specMode) && specPairs.length) return specPairs.every((_, index) => Boolean(answers[index]));
      if (specMode === 'order') return ordered.length === (screen.orderAnswer || []).length;
      if (specMode === 'text' && specExpectedText) return Boolean(String(answers.text || '').trim());
    }
    return true;
  })();

  const answerIsCorrect = (() => {
    if (screen.type === 'choice' || screen.type === 'listeningChoice') return answers.single === screen.answer;
    if (screen.type === 'multiChoice' || screen.type === 'listeningDialog') return allMultiCorrect(screen.items || []);
    if (screen.type === 'classify') return (screen.items || []).every((item, index) => answers[index] === item.answer);
    if (screen.type === 'order') return ordered.join(' ') === (screen.answer || []).join(' ');
    if (screen.type === 'specTask') {
      if (['choice', 'listening', 'reading'].includes(specMode) && specQuestions.length) return allMultiCorrect(specQuestions);
      if (['match', 'classify'].includes(specMode) && specPairs.length) {
        return specPairs.every((pair, index) => answers[index] === pair.slice(1).join(' → '));
      }
      if (specMode === 'order') return ordered.join(' | ') === (screen.orderAnswer || []).join(' | ');
      if (specMode === 'text' && specExpectedText) {
        return normalizeAnswerText(answers.text) === normalizeAnswerText(specExpectedText);
      }
    }
    return true;
  })();

  const complete = (() => {
    if (isCheckable) return confirmation.status === 'correct';
    if (['intro', 'flashcard'].includes(screen.type)) return true;
    if (screen.type === 'pronunciation') return (screen.phrases || []).every((_, index) => repeated[index]);
    if (screen.type === 'speakingFinal') return (screen.items || []).every((_, index) => spoken[index]);
    if (screen.type === 'specTask' && specMode === 'speaking') return Boolean(spoken[0]);
    if (screen.type === 'specTask' && specMode === 'text' && !specExpectedText) return Boolean(String(answers.text || '').trim());
    return true;
  })();

  const confirmAnswer = () => {
    if (!isCheckable || !selectionReady || confirmation.status !== 'idle') return;

    if (answerIsCorrect) {
      setConfirmation({ status: 'correct' });
      playUiSound('success');
    } else {
      setConfirmation({ status: 'wrong' });
      playUiSound('error');
    }
  };

  const next = () => {
    const progress = Math.round(((step + 1) / screens.length) * 100);
    onProgress(progress);
    if (step >= screens.length - 1) {
      completionSoundPlayedRef.current = true;
      playUiSound('end');
      setFinished(true);
      return;
    }
    setStep(current => current + 1);
  };

  const previous = () => {
    if (step > 0) setStep(current => current - 1);
  };

  const toggleFullscreen = async () => {
    const element = lessonRunnerRef.current;
    if (!element) return;

    const active = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (!active) {
        const request = element.requestFullscreen || element.webkitRequestFullscreen;
        if (request) await request.call(element);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      }
    } catch {
      // Fullscreen can be blocked by browser permissions; the lesson remains usable.
    }
  };

  const exitLesson = async () => {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active === lessonRunnerRef.current) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try { await exit.call(document); } catch {}
      }
    }
    onExit();
  };

  if (finished) {
    return (
      <section className="lesson-runner lesson-finished" ref={lessonRunnerRef}>
        <div className="lesson-finish-burst" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => <i key={index} style={{ '--burst-index': index }} />)}
        </div>
        <div className="lesson-finish-content">
          <div className="lesson-finish-icon"><Check size={38} /></div>
          <span className="lesson-eyebrow">Урок завершён</span>
          <h1>{lesson.title} — готово</h1>
          <p>{screen.finishText || 'Ты прошёл первый интерактивный урок.'}</p>
          <div className="lesson-outcomes">
            {(lesson.content?.outcomes || []).slice(0, 5).map((item, index) => (
              <div key={item} style={{ '--outcome-index': index }}><Check size={15} />{item}</div>
            ))}
          </div>
          <button className="lesson-primary-action lesson-finish-action" onClick={exitLesson}>
            Вернуться к урокам <ArrowRight size={17} />
          </button>
        </div>
      </section>
    );
  }

  const renderScreen = () => {
    if (screen.type === 'specTask') {
      return (
        <SpecTaskScreen
          screen={screen}
          voicePreset={voicePreset}
          answers={answers}
          setAnswer={setAnswer}
          ordered={ordered}
          setOrder={setOrder}
          repeated={repeated}
          setRepeated={setRepeated}
          spoken={spoken}
          setSpoken={setSpoken}
          confirmation={confirmation}
        />
      );
    }

    if (screen.type === 'intro') {
      return (
        <div className="lesson-intro-layout">
          <div>
            <span className="lesson-eyebrow">{screen.eyebrow}</span>
            <h1>{screen.title}</h1>
            <p>{screen.body}</p>
            <LessonAudioButton url={screenAudio} />
            <div className="lesson-chip-row">{screen.chips?.map(chip => <span key={chip}>{chip}</span>)}</div>
          </div>
          <SceneArt type="meeting" imageUrl={screen.resolvedImageUrl || screen.imageUrl} />
        </div>
      );
    }

    if (screen.type === 'flashcard') {
      return (
        <div className="lesson-flash-layout">
          <SceneArt type={screen.scene} imageUrl={screen.resolvedImageUrl || screen.imageUrl} />
          <div className="lesson-flash-copy">
            <span className="lesson-eyebrow">{screen.eyebrow}</span>
            <h1>{screen.phrase}</h1>
            <p className="lesson-translation">{screen.translation}</p>
            <LessonAudioButton url={screenAudio} />
            <div className="lesson-context-note">{screen.sceneText}</div>
            {screen.reply && (
              <div className="lesson-reply">
                <span>Мини-ответ</span>
                <strong>{screen.reply}</strong>
                <small>{screen.replyTranslation}</small>
              </div>
            )}
            {screen.note && <p className="lesson-method-note">{screen.note}</p>}
          </div>
        </div>
      );
    }

    if (screen.type === 'choice' || screen.type === 'listeningChoice') {
      return (
        <div className="lesson-task">
          <span className="lesson-eyebrow">{screen.eyebrow}</span>
          <h1>{screen.title}</h1>
          {screen.type === 'listeningChoice' ? (
            <LessonAudioButton url={screenAudio} large label="Воспроизвести" />
          ) : (
            <>
              <div className="lesson-question-word">{screen.prompt}</div>
              {screenAudio && <LessonAudioButton url={screenAudio} />}
            </>
          )}
          <ChoiceOptions
            options={screen.options}
            answer={screen.answer}
            selected={answers.single}
            onSelect={value => setAnswer('single', value)}
            confirmed={confirmation.status !== 'idle'}
            locked={confirmation.status === 'correct'}
          />
          {confirmation.status === 'correct' && <p className="lesson-feedback success"><Check size={15} /> Верно!</p>}
          {confirmation.status === 'wrong' && <p className="lesson-feedback error">Неверно. Выбери другой вариант и попробуй ещё раз.</p>}
          {screen.hint && <div className="lesson-hint">{screen.hint}</div>}
        </div>
      );
    }

    if (screen.type === 'multiChoice' || screen.type === 'listeningDialog') {
      return (
        <div className="lesson-task">
          <span className="lesson-eyebrow">{screen.eyebrow}</span>
          <h1>{screen.title}</h1>
          {screen.type === 'listeningDialog'
            ? <LessonAudioButton url={screenAudio} large label="Послушать диалог" />
            : screenAudio && <LessonAudioButton url={screenAudio} />}
          <div className="lesson-multi-stack">
            {(screen.items || []).map((item, index) => (
              <div className="lesson-multi-item" key={index}>
                {item.scene && <SceneArt type={item.scene} compact imageUrl={item.imageUrl || ''} />}
                <strong>{item.prompt}</strong>
                <ChoiceOptions
                  options={item.options}
                  answer={item.answer}
                  selected={answers[index]}
                  onSelect={value => setAnswer(index, value)}
                  confirmed={confirmation.status !== 'idle'}
                  locked={confirmation.status === 'correct'}
                />
              </div>
            ))}
          </div>
          {confirmation.status === 'correct' && <p className="lesson-feedback success"><Check size={15} /> Всё верно!</p>}
          {confirmation.status === 'wrong' && <p className="lesson-feedback error">Есть ошибка. Измени выбранный ответ и подтверди ещё раз.</p>}
        </div>
      );
    }

    if (screen.type === 'classify') {
      return (
        <div className="lesson-task">
          <span className="lesson-eyebrow">{screen.eyebrow}</span>
          <h1>{screen.title}</h1>
          {screenAudio && <LessonAudioButton url={screenAudio} />}
          <div className="classify-list">
            {screen.items.map((item, index) => (
              <div className="classify-row" key={item.text}>
                <strong>{item.text}</strong>
                <div>
                  {screen.categories.map(category => (
                    <button
                      key={category}
                      className={answers[index] === category
                        ? confirmation.status === 'idle'
                          ? 'selected'
                          : category === item.answer ? 'correct' : 'wrong'
                        : ''}
                      onClick={() => confirmation.status !== 'correct' && setAnswer(index, category)}
                      disabled={confirmation.status === 'correct'}
                    >
                      {category === 'Greeting' ? 'Приветствие' : 'Прощание'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {confirmation.status === 'correct' && <p className="lesson-feedback success"><Check size={15} /> Всё верно!</p>}
          {confirmation.status === 'wrong' && <p className="lesson-feedback error">Есть ошибка. Исправь распределение и подтверди ещё раз.</p>}
        </div>
      );
    }

    if (screen.type === 'order') {
      const remaining = screen.tokens.filter((token, index) => {
        const selectedCount = ordered.filter(x => x === token).length;
        const before = screen.tokens.slice(0, index + 1).filter(x => x === token).length;
        return selectedCount < before;
      });

      return (
        <div className="lesson-task">
          <span className="lesson-eyebrow">{screen.eyebrow}</span>
          <h1>{screen.title}</h1>
          {screenAudio && <LessonAudioButton url={screenAudio} />}
          <div className={`sentence-builder ${confirmation.status === 'correct' ? 'confirmed-correct' : confirmation.status === 'wrong' ? 'confirmed-wrong' : ''}`}>
            <div className="sentence-built">
              {ordered.length ? ordered.map((token, index) => <button key={`${token}-${index}`} disabled={confirmation.status === 'correct'} onClick={() => setOrder(current => current.filter((_, i) => i !== index))}>{token}</button>) : <span>Нажимай на слова по порядку</span>}
            </div>
            <div className="sentence-tokens">
              {remaining.map((token, index) => <button key={`${token}-${index}`} disabled={confirmation.status === 'correct'} onClick={() => setOrder(current => [...current, token])}>{token}</button>)}
            </div>
          </div>
          {confirmation.status === 'correct' && <p className="lesson-feedback success"><Check size={15} /> Фраза собрана правильно.</p>}
          {confirmation.status === 'wrong' && <p className="lesson-feedback error">Порядок пока неверный. Перестрой фразу и подтверди ещё раз.</p>}
        </div>
      );
    }

    if (screen.type === 'pronunciation') {
      return (
        <div className="lesson-task">
          <span className="lesson-eyebrow">{screen.eyebrow}</span>
          <h1>{screen.title}</h1>
          <p className="lesson-task-lead">{screen.note}</p>
          <LessonAudioButton url={screenAudio} large label="Послушать пример" />
          <div className="pronunciation-list">
            {screen.phrases.map((phrase, index) => (
              <div className={`pronunciation-row ${repeated[index] ? 'done' : ''}`} key={phrase}>
                <strong>{phrase}</strong>
                <VoicePracticeRecorder
                  compact
                  done={Boolean(repeated[index])}
                  onDone={() => setRepeated(prev => ({ ...prev, [index]: true }))}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (screen.type === 'speakingFinal') {
      return (
        <div className="lesson-task">
          <span className="lesson-eyebrow">{screen.eyebrow}</span>
          <h1>{screen.title}</h1>
          <p className="lesson-task-lead">Сначала произнеси реплику сам. После этого отметь выполнение и сравни с вариантом.</p>
          {screenAudio && <LessonAudioButton url={screenAudio} />}
          <div className="speaking-final-list">
            {screen.items.map((item, index) => (
              <div className={`speaking-final-item ${spoken[index] ? 'done' : ''}`} key={item.prompt}>
                <SceneArt type={item.scene} compact />
                <div>
                  <strong>{item.prompt}</strong>
                  {spoken[index] && <p>{item.answers.join(' / ')}</p>}
                </div>
                <VoicePracticeRecorder
                  compact
                  done={Boolean(spoken[index])}
                  onDone={() => setSpoken(prev => ({ ...prev, [index]: true }))}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const lessonPercent = Math.round(((step + 1) / screens.length) * 100);
  const itemCount = Array.isArray(screen.items) ? screen.items.length : 0;
  const specDensity = screen.type === 'specTask'
    ? Math.max((screen.questions || []).length, (screen.pairs || []).length, (screen.body || []).length)
    : 0;
  const isDenseScreen =
    (['multiChoice', 'listeningDialog'].includes(screen.type) && itemCount >= 4) ||
    (screen.type === 'classify' && itemCount >= 5) ||
    (screen.type === 'pronunciation' && (screen.phrases || []).length >= 5) ||
    (screen.type === 'speakingFinal' && itemCount >= 4) ||
    (screen.type === 'specTask' && specDensity >= 8);

  return (
    <section className="lesson-runner" ref={lessonRunnerRef}>
      <div className="lesson-runner-top">
        <button className="lesson-exit-btn" onClick={exitLesson}><ChevronLeft size={19} /> <span>К урокам</span></button>

        <div className="lesson-step-copy">
          <span>Урок</span>
          <strong>{step + 1} / {screens.length}</strong>
          <em><Volume2 size={14} /> {getVoicePreset(voicePreset).name}</em>
        </div>

        <div className="lesson-progress-area">
          <div className="lesson-screen-progress"><i style={{ width: `${lessonPercent}%` }} /></div>
          <strong>{lessonPercent}%</strong>
          <button className="lesson-fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Выйти из полного экрана' : 'На весь экран'}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      <div className={`lesson-stage ${isDenseScreen ? 'dense-screen' : ''} ${confirmation.status === 'correct' ? 'answer-success' : confirmation.status === 'wrong' ? 'answer-error' : ''}`} key={screen.id}>
        {renderScreen()}
      </div>

      <div className={`lesson-runner-footer ${confirmation.status !== 'idle' ? `feedback-${confirmation.status}` : ''}`}>
        <button className="lesson-secondary-action" onClick={previous} disabled={step === 0}>Назад</button>

        {isCheckable && confirmation.status !== 'correct' ? (
          <button
            className="lesson-primary-action lesson-confirm-action"
            data-ui-click="off"
            onClick={confirmAnswer}
            disabled={!selectionReady || confirmation.status === 'wrong'}
          >
            {confirmation.status === 'wrong' ? 'Измени ответ' : 'Подтвердить'} <Check size={19} />
          </button>
        ) : (
          <button
            className="lesson-primary-action"
            data-ui-click={step === screens.length - 1 ? 'off' : undefined}
            onClick={next}
            disabled={!complete}
          >
            {step === screens.length - 1 ? 'Завершить урок' : 'Дальше'} <ArrowRight size={19} />
          </button>
        )}
      </div>
    </section>
  );
}

function LessonPage({ moduleData, block, lesson, loading, onBackToBlock, onProgress, voicePreset }) {
  if (loading || !lesson) {
    return <main className="main-content learning-page"><div className="course-loading">Загружаем урок из базы…</div></main>;
  }

  if (lesson.status !== 'ready' || !lesson.content) {
    return (
      <main className="main-content learning-page">
        <div className="learning-breadcrumbs">
          <button onClick={onBackToBlock}>Блок {block.position}</button><span>/</span><strong>Урок {lesson.position}</strong>
        </div>
        <section className="lesson-outline-page">
          <span className="learning-kicker">Модуль {moduleData.position} · Блок {block.position} · Урок {lesson.position}</span>
          <h1>{lesson.title}</h1>
          <p>{lesson.description}</p>
          <div className="lesson-outline-objective"><strong>Задача урока</strong><span>{lesson.objective}</span></div>
          <div className="lesson-outline-status"><BookOpen size={22} /><div><strong>Структура урока сохранена</strong><span>Подробные экраны и упражнения для этого урока пока не загружены.</span></div></div>
          <button className="lesson-secondary-wide" onClick={onBackToBlock}><ChevronLeft size={17} /> Вернуться к урокам блока</button>
        </section>
      </main>
    );
  }

  return (
    <main className="main-content learning-page lesson-player-page">
      <div className="learning-breadcrumbs">
        <button onClick={onBackToBlock}>Блок {block.position}</button><span>/</span><strong>Урок {lesson.position} · {lesson.title}</strong>
      </div>
      <LessonRunner lesson={lesson} onProgress={onProgress} onExit={onBackToBlock} voicePreset={voicePreset} />
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
  const [voiceOptions, setVoiceOptions] = useState(VOICE_PRESETS);
  const [blocks, setBlocks] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [voicePreset, setVoicePreset] = useState(() => {
    try { return window.localStorage.getItem('skladno-voice') || 'ella'; } catch { return 'ella'; }
  });

  const [section, setSection] = useState('learn');
  const [renderedSection, setRenderedSection] = useState('learn');
  const [switching, setSwitching] = useState(false);
  const [activeItem, setActiveItem] = useState('Все модули');
  const [learningView, setLearningView] = useState('modules');
  const switchTimer = useRef(null);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      setCourseLoading(true);
      setCourseError('');

      const [dashboardResult, modulesResult, voicesResult] = await Promise.allSettled([
        fetchJsonWithStartupRetry('/api/dashboard'),
        fetchJsonWithStartupRetry('/api/course/modules'),
        fetchJsonWithStartupRetry('/api/voices'),
      ]);

      if (!active) return;

      if (dashboardResult.status === 'fulfilled') {
        const dashboardData = dashboardResult.value;
        setDashboard(dashboardData);
        setProfile(dashboardData.profile);
        setVoicePreset(dashboardData.profile.voicePreset || 'ella');
      }

      if (modulesResult.status === 'fulfilled') {
        const modulesData = modulesResult.value;
        setModules(Array.isArray(modulesData) ? modulesData : []);
        if (!Array.isArray(modulesData) || modulesData.length === 0) {
          setCourseError('Структура курса в базе сейчас пустая.');
        }
      } else {
        setCourseError('Не удалось загрузить модули из API.');
      }

      if (voicesResult.status === 'fulfilled' && Array.isArray(voicesResult.value) && voicesResult.value.length) {
        setVoiceOptions(voicesResult.value);
      }

      setCourseLoading(false);
    };

    void loadInitialData();
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (switchTimer.current) window.clearTimeout(switchTimer.current);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('skladno-voice', voicePreset); } catch {}
  }, [voicePreset]);

  const changeVoicePreset = async nextVoice => {
    setVoicePreset(nextVoice);
    try { window.localStorage.setItem('skladno-voice', nextVoice); } catch {}

    try {
      const response = await fetch('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voicePreset: nextVoice }),
      });
      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setDashboard(current => current ? { ...current, profile: updatedProfile } : current);
      }
    } catch {
      // Local preference still works while the API is unavailable.
    }
  };

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
    setSelectedLesson(null);
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
    setSelectedLesson(null);
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

  const openLesson = async lesson => {
    setSelectedLesson(lesson);
    setLessonLoading(true);
    setLearningView('lesson');
    window.history.replaceState({}, '', `/learn/module-${selectedModule.position}/block-${selectedBlock.position}/lesson-${lesson.position}`);

    try {
      const response = await fetch(`/api/course/lessons/${lesson.id}`);
      if (!response.ok) throw new Error('Failed to load lesson');
      setSelectedLesson(await response.json());
    } catch {
      setSelectedLesson(lesson);
    } finally {
      setLessonLoading(false);
    }
  };

  const updateLessonProgress = async progress => {
    if (!selectedLesson?.id) return;
    setSelectedLesson(current => current ? { ...current, progress } : current);
    setSelectedBlock(current => current ? {
      ...current,
      lessons: (current.lessons || []).map(item => item.id === selectedLesson.id ? { ...item, progress } : item),
    } : current);

    try {
      await fetch(`/api/lessons/${selectedLesson.id}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress }),
      });
    } catch {
      // Keep local lesson progress responsive if the API is temporarily unavailable.
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
          onOpenLesson={openLesson}
        />
      );
    }

    if (learningView === 'lesson' && selectedModule && selectedBlock) {
      return (
        <LessonPage
          moduleData={selectedModule}
          block={selectedBlock}
          lesson={selectedLesson}
          loading={lessonLoading}
          onBackToBlock={() => {
            setLearningView('block');
            setSelectedLesson(null);
            window.history.replaceState({}, '', `/learn/module-${selectedModule.position}/block-${selectedBlock.position}`);
          }}
          onProgress={updateLessonProgress}
          voicePreset={voicePreset}
        />
      );
    }

    return (
      <ModulesPage
        modules={modules}
        loading={courseLoading}
        error={courseError}
        currentModulePosition={dashboard?.profile?.currentModulePosition}
        onOpenModule={openModule}
        onRetry={() => window.location.reload()}
      />
    );
  };

  const centerKey = renderedSection === 'learn'
    ? `learn-${learningView}-${selectedModule?.id || 0}-${selectedBlock?.id || 0}-${selectedLesson?.id || 0}`
    : renderedSection;

  const currentLearningLabel = dashboard?.currentModule && dashboard?.currentBlock
    ? `Модуль ${dashboard.currentModule.position} · Блок ${dashboard.currentBlock.position}`
    : 'Текущий блок';

  return (
    <div className="app-shell">
      <Topbar profile={profile} section={section} onSectionChange={navigateSection} voicePreset={voicePreset} onVoiceChange={changeVoicePreset} voiceOptions={voiceOptions} />
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

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
try {
  preloadUiSounds();
  installUiAudioLifecycle();
  installGlobalClickSound();
} catch (error) {
  console.warn('UI audio initialization failed:', error);
}
createRoot(document.getElementById('root')).render(isAdminRoute ? <AdminApp /> : <App />);
