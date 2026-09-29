import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BookOpen, MessageCircle, Headphones, Star, Shirt, Search, Flame, ChevronDown,
  Home, Grid2X2, Settings2, Volume2, Bookmark, RotateCcw, Play, ArrowRight,
  Mic2, Heart, Share2, Clock3, Sparkles, CircleUserRound, Check, LibraryBig,
  Trophy, GraduationCap, AudioLines, Gem, Bell, BookMarked
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

const sidebarItems = [
  [LibraryBig, 'Мой план'], [Grid2X2, 'Все модули'], [MessageCircle, 'Разговорная практика'],
  [Settings2, 'Грамматика'], [Headphones, 'Аудио и восприятие'], [BookOpen, 'Словарь'],
  [Bookmark, 'Жизненные ситуации'], [Shirt, 'Экзамены'], [Star, 'Избранное']
];

const recent = [
  ['Полезные связки', 'Модуль 7', '#7a61ff', BookMarked],
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
  return <div className="brand-wrap">
    <div className="logo-mark"><span></span><span></span></div>
    <div>
      <div className="brand">Складно</div>
      <div className="brand-sub">Английский, который<br/>складывается в жизнь</div>
    </div>
  </div>
}

function Tag({children, tone='blue'}) { return <span className={`tag tag-${tone}`}>{children}</span> }

function LessonCard({lesson, onProgress}) {
  const done = lesson.progress === 100;
  const progressTone = done ? 'done' : lesson.progress > 0 ? 'active' : 'idle';
  const secondTone = lesson.tagSecondary === 'практика' || lesson.tagSecondary === 'фразовый глагол' ? 'green' : 'peach';
  const firstTone = lesson.tagPrimary === 'лексика' ? 'violet' : lesson.tagPrimary === 'аудио' ? 'cyan' : 'blue';
  const actionLabel = done ? 'Повторить' : lesson.progress > 0 ? 'Продолжить' : 'Начать урок';

  const click = async () => {
    const next = done ? 100 : Math.min(100, lesson.progress + (lesson.progress ? 20 : 30));
    onProgress(lesson.id, next);
    try {
      await fetch(`/api/lessons/${lesson.id}/progress`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({progress:next})});
    } catch {}
  };

  return <article className="lesson-card">
    <div className="lesson-image-wrap">
      <img src={ASSETS[lesson.imageKey]} className="lesson-image" alt="" />
      <span className="lesson-no">{lesson.position}</span>
      <span className={`lesson-status ${done ? 'status-done' : ''}`}>{done ? <Check size={18}/> : <Play size={14} fill="currentColor"/>}</span>
    </div>
    <div className="lesson-body">
      <h3>{lesson.title}</h3>
      <div className="tags"><Tag tone={firstTone}>{lesson.tagPrimary}</Tag><Tag tone={secondTone}>{lesson.tagSecondary}</Tag></div>
      <p>{lesson.description}</p>
      <div className="progress-line"><div className="progress-bg"><span className={`progress-fill ${progressTone}`} style={{width:`${lesson.progress}%`}}/></div><strong>{lesson.progress}%</strong></div>
      <button className={`lesson-btn ${lesson.progress > 0 && !done ? 'primary' : ''}`} onClick={click}>
        {done ? <RotateCcw size={17}/> : <Play size={14} fill="currentColor"/>}{actionLabel}{lesson.progress > 0 && !done && <ArrowRight size={17}/>} 
      </button>
    </div>
  </article>
}

function Sidebar() {
  return <aside className="sidebar">
    <nav className="side-nav">
      {sidebarItems.map(([Icon,label],idx)=><button key={label} className={idx===1?'active':''}><Icon size={18}/><span>{label}</span></button>)}
    </nav>
    <div className="rhythm-card">
      <div className="rhythm-title">Английский<br/>в твоём ритме</div>
      <p>Короткие уроки.<br/>Реальные ситуации.<br/>Видимый прогресс.</p>
      <div className="plant-art"><span className="pot"></span><i></i><i></i><i></i><i></i></div>
      <button>Продолжить <ArrowRight size={16}/></button>
    </div>
    <div className="recent-card">
      <h4>Недавние уроки</h4>
      {recent.map(([t,s,c,Icon])=><div className="recent-row" key={t}>
        <div className="recent-icon" style={{background:c+'26', color:c}}><Icon size={17}/></div>
        <div><strong>{t}</strong><span>{s}</span></div><ChevronDown size={15} className="rotate"/>
      </div>)}
    </div>
  </aside>
}

function Topbar({profile}) {
  return <header className="topbar">
    <Logo/>
    <nav className="top-nav">
      <button><Home size={16}/>Главная</button>
      <button className="active"><BookOpen size={16}/>Обучение</button>
      <button><GraduationCap size={16}/>Практика</button>
      <button><LibraryBig size={16}/>Словарь</button>
      <button><MessageCircle size={16}/>Сообщество</button>
    </nav>
    <div className="top-actions">
      <div className="streak"><Flame size={25} fill="#ff7b17" color="#ff7b17"/><div><b>{profile.streak} дней</b><span>в серии</span></div></div>
      <div className="top-progress"><div className="tp-label"><span>Мой прогресс</span><b>{profile.overallProgress}%</b></div><div className="tp-track"><i style={{width:`${profile.overallProgress}%`}}/></div></div>
      <button className="icon-btn"><Search size={21}/></button>
      <button className="language"><span className="flag">🇬🇧</span>British English <ChevronDown size={15}/></button>
      <div className="avatar">А<span className="online"></span></div>
    </div>
  </header>
}

function Hero({module}) {
  const completed = module.lessons.filter(x=>x.progress>0).length;
  return <section className="hero">
    <div className="hero-copy">
      <div className="hero-pill"><MessageCircle size={14}/> Разговорный английский</div>
      <h1><span>Модуль 7.</span><br/>Разговорный старт</h1>
      <p>{module.description}</p>
      <div className="module-progress-label"><span>Прогресс модуля</span><b>{completed} из 6 уроков</b></div>
      <div className="module-progress"><i style={{width:`${Math.round(module.lessons.reduce((s,l)=>s+l.progress,0)/6)}%`}}/></div>
    </div>
    <div className="hero-art" aria-hidden="true"><img src={ASSETS['hero-illustration.webp']} alt=""/></div>
  </section>
}

function RightRail() {
  return <aside className="right-rail">
    <section className="widget meme-widget">
      <div className="widget-head"><h3><Sparkles size={18}/> Мем дня</h3><RotateCcw size={17}/></div>
      <img src={ASSETS['meme.webp']} className="meme-image" alt="Мем дня"/>
      <p className="meme-caption">«То самое чувство, когда<br/>наконец-то понял носителя»</p>
      <div className="social-row"><span><Heart size={19}/>432</span><Share2 size={19}/></div>
    </section>
    <section className="widget dict-widget">
      <div className="widget-head"><h3><BookOpen size={18}/> Словарь модуля</h3><button>Смотреть все <ArrowRight size={13}/></button></div>
      <div className="dict-list">
        {dictionary.map(([w,t,icon,c])=><div className="dict-row" key={w}>
          <div className="dict-icon" style={{background:c}}>{icon}</div>
          <div><strong>{w}</strong><span>{t}</span></div><div className="dict-actions"><Volume2 size={18}/><Heart size={18}/></div>
        </div>)}
      </div>
    </section>
    <section className="widget pronunciation">
      <div className="widget-head"><h3><Mic2 size={19}/> Тренировка произношения</h3><ArrowRight size={17}/></div>
      <div className="pron-body">
        <div className="mic-art"><AudioLines size={30}/><Mic2 size={42}/></div>
        <p>Произнеси фразу<br/>и получи обратную связь<br/>от ИИ</p>
      </div>
      <button className="pron-btn">Начать тренировку</button>
    </section>
  </aside>
}

function App() {
  const [profile, setProfile] = useState({name:'Анна', streak:12, overallProgress:62});
  const [module, setModule] = useState({title:'Модуль 7. Разговорный старт', description:'Прокачиваем базовые навыки общения: учимся строить фразы, задавать вопросы, понимать живую речь и говорить увереннее в повседневных ситуациях.', lessons:fallbackLessons});

  useEffect(()=>{
    fetch('/api/dashboard').then(r=>r.ok?r.json():Promise.reject()).then(data=>{setProfile(data.profile); setModule(data.module)}).catch(()=>{});
  },[]);

  const updateProgress = (id, progress) => setModule(m=>({...m, lessons:m.lessons.map(l=>l.id===id?{...l,progress}:l)}));

  return <div className="app-shell">
    <Topbar profile={profile}/>
    <div className="layout">
      <Sidebar/>
      <main className="main-content">
        <Hero module={module}/>
        <section className="lessons-grid">
          {module.lessons.map(l=><LessonCard key={l.id} lesson={l} onProgress={updateProgress}/>) }
        </section>
      </main>
      <RightRail/>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
