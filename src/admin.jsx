import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BookOpen, Boxes, Check, ChevronDown, ChevronUp, CirclePlus,
  Copy, FileAudio, Image, Layers3, Loader2, Pencil, Play, Plus, RefreshCw,
  Save, Trash2, Upload, Volume2
} from 'lucide-react';
import './admin.css';

const VOICES = [
  ['ella', 'Ella', 'женский'],
  ['grace', 'Grace', 'женский'],
  ['chloe', 'Chloe', 'женский'],
  ['oliver', 'Oliver', 'мужской'],
  ['james', 'James', 'мужской'],
  ['theo', 'Theo', 'мужской'],
];

const TASK_TYPES = [
  ['intro', 'Вступление'],
  ['flashcard', 'Карточка / chunk'],
  ['choice', 'Один вариант ответа'],
  ['listeningChoice', 'Аудирование + выбор'],
  ['multiChoice', 'Несколько вопросов'],
  ['classify', 'Классификация'],
  ['order', 'Собрать фразу'],
  ['pronunciation', 'Произношение'],
  ['listeningDialog', 'Диалог на слух'],
  ['speakingFinal', 'Финальное говорение'],
];

const deepClone = value => JSON.parse(JSON.stringify(value ?? null));

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
};

const createScreen = (type = 'choice') => {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const base = { id, type, eyebrow: 'Задание', title: '', audioFiles: {}, imageUrl: '' };

  if (type === 'intro') return { ...base, body: '', chips: [] };
  if (type === 'flashcard') return { ...base, phrase: '', translation: '', scene: 'meeting', sceneText: '', reply: '', replyTranslation: '', note: '' };
  if (type === 'choice') return { ...base, prompt: '', options: ['', ''], answer: '', hint: '' };
  if (type === 'listeningChoice') return { ...base, options: ['', ''], answer: '', hint: '' };
  if (type === 'multiChoice') return { ...base, items: [{ prompt: '', options: ['', ''], answer: '' }] };
  if (type === 'classify') return { ...base, items: [{ text: '', answer: 'Greeting' }], categories: ['Greeting', 'Goodbye'] };
  if (type === 'order') return { ...base, tokens: ['', '', ''], answer: ['', '', ''] };
  if (type === 'pronunciation') return { ...base, phrases: ['', ''], note: '' };
  if (type === 'listeningDialog') return { ...base, items: [{ prompt: '', options: ['', ''], answer: '' }] };
  if (type === 'speakingFinal') return { ...base, items: [{ prompt: '', scene: 'meeting', answers: [''] }], finishText: '' };
  return base;
};

function Field({ label, children, wide = false }) {
  return <label className={`admin-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}

function TextInput({ value = '', onChange, ...props }) {
  return <input value={value ?? ''} onChange={event => onChange(event.target.value)} {...props} />;
}

function TextArea({ value = '', onChange, ...props }) {
  return <textarea value={value ?? ''} onChange={event => onChange(event.target.value)} {...props} />;
}

function ListEditor({ label, value = [], onChange, placeholder = 'Один элемент на строку' }) {
  return (
    <Field label={label} wide>
      <textarea
        rows={4}
        value={(value || []).join('\n')}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value.split('\n').map(x => x.trim()).filter(Boolean))}
      />
    </Field>
  );
}

function JsonEditor({ label, value, onChange }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(JSON.stringify(value ?? [], null, 2));
    setError('');
  }, [value]);

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
      setError('');
    } catch {
      setError('JSON сейчас невалидный');
    }
  };

  return (
    <Field label={label} wide>
      <textarea className="admin-json" rows={9} value={text} onChange={event => setText(event.target.value)} onBlur={apply} />
      {error && <small className="admin-error">{error}</small>}
    </Field>
  );
}

function MediaUploader({ kind, value, onChange, label }) {
  const [busy, setBusy] = useState(false);

  const upload = async file => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api(`/api/admin/upload/${kind}`, { method: 'POST', body: form });
      onChange(result.url);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-media-slot">
      <div className="admin-media-copy">
        {kind === 'audio' ? <FileAudio size={16} /> : <Image size={16} />}
        <div><strong>{label}</strong><span>{value ? 'файл загружен' : 'файла нет'}</span></div>
      </div>
      {kind === 'audio' && value && <audio controls preload="none" src={value} />}
      {kind === 'image' && value && <img src={value} alt="" />}
      <div className="admin-media-actions">
        <label className="admin-upload-btn">
          {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          {busy ? 'Загрузка…' : value ? 'Заменить' : 'Загрузить'}
          <input
            type="file"
            accept={kind === 'audio' ? 'audio/*' : 'image/*'}
            hidden
            disabled={busy}
            onChange={event => upload(event.target.files?.[0])}
          />
        </label>
        {value && <button className="admin-ghost-danger" onClick={() => onChange('')}><Trash2 size={13} />Убрать</button>}
      </div>
    </div>
  );
}

function AudioMatrix({ screen, onChange }) {
  const audioFiles = screen.audioFiles || {};
  return (
    <div className="admin-audio-section">
      <div className="admin-section-minihead">
        <div><Volume2 size={16} /><strong>Озвучка задания</strong></div>
        <span>по одному файлу для каждого из 6 голосов</span>
      </div>
      <div className="admin-audio-grid">
        {VOICES.map(([id, name, gender]) => (
          <MediaUploader
            key={id}
            kind="audio"
            label={`${name} · ${gender}`}
            value={audioFiles[id] || ''}
            onChange={url => onChange({ ...screen, audioFiles: { ...audioFiles, [id]: url } })}
          />
        ))}
      </div>
    </div>
  );
}

function ScreenFields({ screen, onChange }) {
  const set = (key, value) => onChange({ ...screen, [key]: value });

  return (
    <div className="admin-screen-fields">
      <Field label="Тип задания">
        <select value={screen.type} onChange={event => {
          const next = createScreen(event.target.value);
          onChange({ ...next, id: screen.id, audioFiles: screen.audioFiles || {}, imageUrl: screen.imageUrl || '', eyebrow: screen.eyebrow || next.eyebrow });
        }}>
          {TASK_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Надпись сверху"><TextInput value={screen.eyebrow} onChange={value => set('eyebrow', value)} /></Field>
      {'title' in screen && <Field label="Заголовок" wide><TextInput value={screen.title} onChange={value => set('title', value)} /></Field>}

      {screen.type === 'intro' && <>
        <Field label="Текст" wide><TextArea rows={4} value={screen.body} onChange={value => set('body', value)} /></Field>
        <ListEditor label="Чипы" value={screen.chips} onChange={value => set('chips', value)} />
      </>}

      {screen.type === 'flashcard' && <>
        <Field label="Фраза"><TextInput value={screen.phrase} onChange={value => set('phrase', value)} /></Field>
        <Field label="Перевод"><TextInput value={screen.translation} onChange={value => set('translation', value)} /></Field>
        <Field label="Сцена / ключ"><TextInput value={screen.scene} onChange={value => set('scene', value)} /></Field>
        <Field label="Мини-ответ"><TextInput value={screen.reply} onChange={value => set('reply', value)} /></Field>
        <Field label="Перевод ответа"><TextInput value={screen.replyTranslation} onChange={value => set('replyTranslation', value)} /></Field>
        <Field label="Контекст" wide><TextArea rows={3} value={screen.sceneText} onChange={value => set('sceneText', value)} /></Field>
        <Field label="Методическая заметка" wide><TextArea rows={3} value={screen.note} onChange={value => set('note', value)} /></Field>
      </>}

      {(screen.type === 'choice' || screen.type === 'listeningChoice') && <>
        {screen.type === 'choice' && <Field label="Вопрос / слово" wide><TextInput value={screen.prompt} onChange={value => set('prompt', value)} /></Field>}
        <ListEditor label="Варианты ответа" value={screen.options} onChange={value => set('options', value)} />
        <Field label="Правильный ответ"><TextInput value={screen.answer} onChange={value => set('answer', value)} /></Field>
        <Field label="Подсказка"><TextInput value={screen.hint} onChange={value => set('hint', value)} /></Field>
      </>}

      {screen.type === 'order' && <>
        <ListEditor label="Слова / токены" value={screen.tokens} onChange={value => set('tokens', value)} />
        <ListEditor label="Правильный порядок" value={screen.answer} onChange={value => set('answer', value)} />
      </>}

      {screen.type === 'pronunciation' && <>
        <ListEditor label="Фразы для повторения" value={screen.phrases} onChange={value => set('phrases', value)} />
        <Field label="Заметка" wide><TextArea rows={3} value={screen.note} onChange={value => set('note', value)} /></Field>
      </>}

      {screen.type === 'classify' && <>
        <ListEditor label="Категории" value={screen.categories} onChange={value => set('categories', value)} />
        <JsonEditor label="Элементы классификации (JSON)" value={screen.items} onChange={value => set('items', value)} />
      </>}

      {(screen.type === 'multiChoice' || screen.type === 'listeningDialog') &&
        <JsonEditor label="Вопросы и ответы (JSON)" value={screen.items} onChange={value => set('items', value)} />
      }

      {screen.type === 'speakingFinal' && <>
        <JsonEditor label="Ситуации (JSON)" value={screen.items} onChange={value => set('items', value)} />
        <Field label="Финальный текст" wide><TextArea rows={3} value={screen.finishText} onChange={value => set('finishText', value)} /></Field>
      </>}

      <div className="admin-image-section">
        <div className="admin-section-minihead">
          <div><Image size={16} /><strong>Фото задания</strong></div>
          <span>основной формат 1:1</span>
        </div>
        <MediaUploader kind="image" label="Фото 1:1" value={screen.imageUrl || ''} onChange={url => set('imageUrl', url)} />
      </div>

      <AudioMatrix screen={screen} onChange={onChange} />
    </div>
  );
}

function LessonContentEditor({ draft, setDraft }) {
  const content = draft.content || { version: 1, outcomes: [], screens: [] };
  const screens = content.screens || [];
  const [newType, setNewType] = useState('choice');

  const setContent = next => setDraft(current => ({ ...current, content: next }));
  const updateScreen = (index, nextScreen) => {
    const next = [...screens];
    next[index] = nextScreen;
    setContent({ ...content, screens: next });
  };
  const removeScreen = index => setContent({ ...content, screens: screens.filter((_, i) => i !== index) });
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= screens.length) return;
    const next = [...screens];
    [next[index], next[target]] = [next[target], next[index]];
    setContent({ ...content, screens: next });
  };
  const duplicate = index => {
    const copy = deepClone(screens[index]);
    copy.id = Date.now() + Math.floor(Math.random() * 1000);
    const next = [...screens];
    next.splice(index + 1, 0, copy);
    setContent({ ...content, screens: next });
  };

  return (
    <div className="admin-lesson-content">
      <div className="admin-editor-section">
        <div className="admin-editor-title"><div><strong>Результаты урока</strong><span>Что ученик должен уметь после завершения</span></div></div>
        <ListEditor label="Outcomes" value={content.outcomes || []} onChange={value => setContent({ ...content, outcomes: value })} />
      </div>

      <div className="admin-tasks-head">
        <div><strong>Задания урока</strong><span>{screens.length} экранов</span></div>
        <div className="admin-add-task">
          <select value={newType} onChange={event => setNewType(event.target.value)}>
            {TASK_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={() => setContent({ ...content, screens: [...screens, createScreen(newType)] })}><Plus size={15} /> Добавить</button>
        </div>
      </div>

      <div className="admin-task-list">
        {screens.map((screen, index) => (
          <details className="admin-task-card" key={screen.id ?? index} open={index === 0}>
            <summary>
              <div className="admin-task-number">{index + 1}</div>
              <div className="admin-task-summary">
                <strong>{TASK_TYPES.find(([value]) => value === screen.type)?.[1] || screen.type}</strong>
                <span>{screen.title || screen.phrase || screen.prompt || screen.eyebrow || 'Без названия'}</span>
              </div>
              <div className="admin-task-tools" onClick={event => event.preventDefault()}>
                <button onClick={() => move(index, -1)} disabled={index === 0}><ChevronUp size={14} /></button>
                <button onClick={() => move(index, 1)} disabled={index === screens.length - 1}><ChevronDown size={14} /></button>
                <button onClick={() => duplicate(index)}><Copy size={14} /></button>
                <button className="danger" onClick={() => {
                  if (window.confirm('Удалить это задание?')) removeScreen(index);
                }}><Trash2 size={14} /></button>
              </div>
            </summary>
            <ScreenFields screen={screen} onChange={next => updateScreen(index, next)} />
          </details>
        ))}
        {!screens.length && <div className="admin-empty">В уроке пока нет заданий. Выбери тип выше и добавь первый экран.</div>}
      </div>
    </div>
  );
}

function AdminApp() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [moduleDraft, setModuleDraft] = useState(null);
  const [blockDraft, setBlockDraft] = useState(null);
  const [lessonDraft, setLessonDraft] = useState(null);

  const selectedModule = useMemo(() => tree.find(item => item.id === selectedModuleId) || null, [tree, selectedModuleId]);
  const selectedBlock = useMemo(() => selectedModule?.blocks?.find(item => item.id === selectedBlockId) || null, [selectedModule, selectedBlockId]);
  const selectedLesson = useMemo(() => selectedBlock?.lessons?.find(item => item.id === selectedLessonId) || null, [selectedBlock, selectedLessonId]);

  const loadTree = async (keep = true) => {
    setLoading(true);
    try {
      const data = await api('/api/admin/tree');
      setTree(data);
      const moduleId = keep && selectedModuleId && data.some(x => x.id === selectedModuleId) ? selectedModuleId : data[0]?.id ?? null;
      const module = data.find(x => x.id === moduleId);
      const blockId = keep && selectedBlockId && module?.blocks?.some(x => x.id === selectedBlockId) ? selectedBlockId : module?.blocks?.[0]?.id ?? null;
      const block = module?.blocks?.find(x => x.id === blockId);
      const lessonId = keep && selectedLessonId && block?.lessons?.some(x => x.id === selectedLessonId) ? selectedLessonId : block?.lessons?.[0]?.id ?? null;
      setSelectedModuleId(moduleId);
      setSelectedBlockId(blockId);
      setSelectedLessonId(lessonId);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadTree(false); }, []);

  useEffect(() => setModuleDraft(selectedModule ? deepClone(selectedModule) : null), [selectedModule?.id, selectedModule?.updatedAt]);
  useEffect(() => setBlockDraft(selectedBlock ? deepClone(selectedBlock) : null), [selectedBlock?.id, selectedBlock?.updatedAt]);
  useEffect(() => setLessonDraft(selectedLesson ? deepClone(selectedLesson) : null), [selectedLesson?.id, selectedLesson?.updatedAt]);

  const flash = message => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  };

  const saveEntity = async (kind, id, body) => {
    setSaving(true);
    try {
      await api(`/api/admin/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await loadTree(true);
      flash('Сохранено');
    } catch (error) {
      window.alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const addModule = async () => {
    const created = await api('/api/admin/modules', { method: 'POST', body: JSON.stringify({ title: 'Новый модуль' }) });
    await loadTree(false);
    setSelectedModuleId(created.id);
    setSelectedBlockId(null);
    setSelectedLessonId(null);
  };

  const addBlock = async () => {
    if (!selectedModule) return;
    const created = await api('/api/admin/blocks', { method: 'POST', body: JSON.stringify({ moduleId: selectedModule.id, title: 'Новый блок' }) });
    await loadTree(true);
    setSelectedBlockId(created.id);
    setSelectedLessonId(null);
  };

  const addLesson = async () => {
    if (!selectedBlock) return;
    const created = await api('/api/admin/lessons', { method: 'POST', body: JSON.stringify({ blockId: selectedBlock.id, title: 'Новый урок' }) });
    await loadTree(true);
    setSelectedLessonId(created.id);
  };

  const deleteEntity = async (kind, id, label) => {
    if (!window.confirm(`Удалить «${label}»? Это действие нельзя отменить.`)) return;
    await api(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
    await loadTree(false);
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <a href="/" className="admin-back"><ArrowLeft size={17} /></a>
          <div className="admin-logo">S</div>
          <div><strong>Складно · Админка</strong><span>Курс, уроки и медиа</span></div>
        </div>
        <div className="admin-top-actions">
          {notice && <span className="admin-notice"><Check size={14} />{notice}</span>}
          <button onClick={() => loadTree(true)} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Обновить</button>
          <a href="/">Открыть сайт</a>
        </div>
      </header>

      <div className="admin-workspace">
        <aside className="admin-tree-column">
          <div className="admin-column-head"><div><Boxes size={17} /><strong>Модули</strong><span>{tree.length}</span></div><button onClick={addModule}><Plus size={15} /></button></div>
          <div className="admin-entity-list">
            {tree.map(module => (
              <button key={module.id} className={module.id === selectedModuleId ? 'active' : ''} onClick={() => {
                setSelectedModuleId(module.id);
                setSelectedBlockId(module.blocks?.[0]?.id ?? null);
                setSelectedLessonId(module.blocks?.[0]?.lessons?.[0]?.id ?? null);
              }}>
                <span>{String(module.position).padStart(2, '0')}</span><div><strong>{module.title}</strong><small>{module.blocks?.length || 0} блоков</small></div>
              </button>
            ))}
          </div>
        </aside>

        <aside className="admin-tree-column">
          <div className="admin-column-head"><div><Layers3 size={17} /><strong>Блоки</strong><span>{selectedModule?.blocks?.length || 0}</span></div><button onClick={addBlock} disabled={!selectedModule}><Plus size={15} /></button></div>
          <div className="admin-entity-list">
            {(selectedModule?.blocks || []).map(block => (
              <button key={block.id} className={block.id === selectedBlockId ? 'active' : ''} onClick={() => {
                setSelectedBlockId(block.id);
                setSelectedLessonId(block.lessons?.[0]?.id ?? null);
              }}>
                <span>{String(block.position).padStart(2, '0')}</span><div><strong>{block.title}</strong><small>{block.lessons?.length || 0} уроков</small></div>
              </button>
            ))}
          </div>
        </aside>

        <aside className="admin-tree-column">
          <div className="admin-column-head"><div><BookOpen size={17} /><strong>Уроки</strong><span>{selectedBlock?.lessons?.length || 0}</span></div><button onClick={addLesson} disabled={!selectedBlock}><Plus size={15} /></button></div>
          <div className="admin-entity-list lessons">
            {(selectedBlock?.lessons || []).map(lesson => (
              <button key={lesson.id} className={lesson.id === selectedLessonId ? 'active' : ''} onClick={() => setSelectedLessonId(lesson.id)}>
                <span>{String(lesson.position).padStart(2, '0')}</span><div><strong>{lesson.title}</strong><small>{lesson.status === 'ready' ? 'готов' : 'план'} · {lesson.content?.screens?.length || 0} заданий</small></div>
              </button>
            ))}
          </div>
        </aside>

        <main className="admin-editor">
          {loading ? (
            <div className="admin-loading"><Loader2 className="spin" /> Загружаем структуру курса…</div>
          ) : lessonDraft ? (
            <>
              <div className="admin-editor-head">
                <div><span>Урок {lessonDraft.position}</span><h1>{lessonDraft.title || 'Без названия'}</h1><p>Редактирование урока, заданий, фото и шести вариантов озвучки.</p></div>
                <div className="admin-editor-actions">
                  <button className="danger" onClick={() => deleteEntity('lessons', lessonDraft.id, lessonDraft.title)}><Trash2 size={15} /> Удалить</button>
                  <button className="primary" disabled={saving} onClick={() => saveEntity('lessons', lessonDraft.id, {
                    position: lessonDraft.position,
                    title: lessonDraft.title,
                    tagPrimary: lessonDraft.tagPrimary,
                    tagSecondary: lessonDraft.tagSecondary,
                    description: lessonDraft.description,
                    objective: lessonDraft.objective,
                    status: lessonDraft.status,
                    duration: lessonDraft.duration,
                    imageKey: lessonDraft.imageKey,
                    content: lessonDraft.content,
                  })}>{saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Сохранить урок</button>
                </div>
              </div>

              <section className="admin-editor-section">
                <div className="admin-editor-title"><div><strong>Основные данные</strong><span>То, что видно в карточке урока и структуре блока</span></div></div>
                <div className="admin-form-grid">
                  <Field label="Позиция"><TextInput type="number" value={lessonDraft.position} onChange={value => setLessonDraft(d => ({ ...d, position: Number(value) }))} /></Field>
                  <Field label="Статус"><select value={lessonDraft.status} onChange={event => setLessonDraft(d => ({ ...d, status: event.target.value }))}><option value="ready">ready</option><option value="outline">outline</option></select></Field>
                  <Field label="Название" wide><TextInput value={lessonDraft.title} onChange={value => setLessonDraft(d => ({ ...d, title: value }))} /></Field>
                  <Field label="Тег 1"><TextInput value={lessonDraft.tagPrimary} onChange={value => setLessonDraft(d => ({ ...d, tagPrimary: value }))} /></Field>
                  <Field label="Тег 2"><TextInput value={lessonDraft.tagSecondary} onChange={value => setLessonDraft(d => ({ ...d, tagSecondary: value }))} /></Field>
                  <Field label="Описание" wide><TextArea rows={3} value={lessonDraft.description} onChange={value => setLessonDraft(d => ({ ...d, description: value }))} /></Field>
                  <Field label="Задача урока" wide><TextArea rows={3} value={lessonDraft.objective} onChange={value => setLessonDraft(d => ({ ...d, objective: value }))} /></Field>
                </div>
              </section>

              <LessonContentEditor draft={lessonDraft} setDraft={setLessonDraft} />
            </>
          ) : blockDraft ? (
            <>
              <div className="admin-editor-head">
                <div><span>Блок {blockDraft.position}</span><h1>{blockDraft.title}</h1><p>Редактирование блока. Выбери урок слева или создай новый.</p></div>
                <div className="admin-editor-actions">
                  <button className="danger" onClick={() => deleteEntity('blocks', blockDraft.id, blockDraft.title)}><Trash2 size={15} /> Удалить</button>
                  <button className="primary" disabled={saving} onClick={() => saveEntity('blocks', blockDraft.id, {
                    position: blockDraft.position, title: blockDraft.title, imageKey: blockDraft.imageKey, progress: blockDraft.progress,
                  })}><Save size={15} /> Сохранить блок</button>
                </div>
              </div>
              <section className="admin-editor-section">
                <div className="admin-form-grid">
                  <Field label="Позиция"><TextInput type="number" value={blockDraft.position} onChange={value => setBlockDraft(d => ({ ...d, position: Number(value) }))} /></Field>
                  <Field label="Прогресс"><TextInput type="number" min="0" max="100" value={blockDraft.progress} onChange={value => setBlockDraft(d => ({ ...d, progress: Number(value) }))} /></Field>
                  <Field label="Название" wide><TextInput value={blockDraft.title} onChange={value => setBlockDraft(d => ({ ...d, title: value }))} /></Field>
                  <Field label="Ключ картинки" wide><TextInput value={blockDraft.imageKey} onChange={value => setBlockDraft(d => ({ ...d, imageKey: value }))} /></Field>
                </div>
              </section>
              <button className="admin-big-add" onClick={addLesson}><CirclePlus size={18} /> Добавить урок в этот блок</button>
            </>
          ) : moduleDraft ? (
            <>
              <div className="admin-editor-head">
                <div><span>Модуль {moduleDraft.position}</span><h1>{moduleDraft.title}</h1><p>Редактирование метаданных модуля. Выбери блок слева или создай новый.</p></div>
                <div className="admin-editor-actions">
                  <button className="danger" onClick={() => deleteEntity('modules', moduleDraft.id, moduleDraft.title)}><Trash2 size={15} /> Удалить</button>
                  <button className="primary" disabled={saving} onClick={() => saveEntity('modules', moduleDraft.id, {
                    position: moduleDraft.position, title: moduleDraft.title, shortTitle: moduleDraft.shortTitle,
                    description: moduleDraft.description, level: moduleDraft.level, progress: moduleDraft.progress,
                  })}><Save size={15} /> Сохранить модуль</button>
                </div>
              </div>
              <section className="admin-editor-section">
                <div className="admin-form-grid">
                  <Field label="Позиция"><TextInput type="number" value={moduleDraft.position} onChange={value => setModuleDraft(d => ({ ...d, position: Number(value) }))} /></Field>
                  <Field label="Уровень"><TextInput value={moduleDraft.level} onChange={value => setModuleDraft(d => ({ ...d, level: value }))} /></Field>
                  <Field label="Название" wide><TextInput value={moduleDraft.title} onChange={value => setModuleDraft(d => ({ ...d, title: value }))} /></Field>
                  <Field label="Короткое название" wide><TextInput value={moduleDraft.shortTitle} onChange={value => setModuleDraft(d => ({ ...d, shortTitle: value }))} /></Field>
                  <Field label="Описание" wide><TextArea rows={4} value={moduleDraft.description} onChange={value => setModuleDraft(d => ({ ...d, description: value }))} /></Field>
                </div>
              </section>
              <button className="admin-big-add" onClick={addBlock}><CirclePlus size={18} /> Добавить блок в этот модуль</button>
            </>
          ) : (
            <div className="admin-empty-editor">
              <Pencil size={28} /><strong>Выбери модуль, блок или урок</strong><span>Здесь появится редактор выбранного объекта.</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminApp;
