import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BarChart3, BookOpen, Check, ChevronLeft, ChevronUp, ChevronDown,
  CirclePlus, Copy, FileAudio, FolderOpen, Image, Layers3, Loader2, PanelLeftClose,
  PanelLeftOpen, Plus, RefreshCw, Search, Settings2, Trash2, Upload, Users, Volume2, X
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
  ['specTask', 'Гибкая учебная механика'],
];

const deepClone = value => JSON.parse(JSON.stringify(value ?? null));
const clamp = value => Math.max(0, Math.min(100, Number(value || 0)));
const normalizeLibraryText = value => String(value || '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('en-US')
  .replace(/\s+/g, ' ');
const normalizeAudioPhrase = normalizeLibraryText;
const normalizeAutoMediaKey = value => normalizeLibraryText(
  String(value || '').trim().replace(/[.!?…,:;]+$/u, '').trim()
);

const looksLikeEnglishAudio = value => {
  const text = String(value || '').trim();
  return Boolean(text) && text.length <= 180 && /[A-Za-z]/.test(text);
};

const collectAutoAudioTexts = screen => {
  const values = [];
  const add = value => {
    const text = String(value || '').trim();
    if (looksLikeEnglishAudio(text)) values.push(text);
  };

  add(screen?.phrase);
  add(screen?.reply);
  add(screen?.prompt);
  add(screen?.focus);
  (screen?.options || []).forEach(add);
  (screen?.tokens || []).forEach(add);
  (screen?.phrases || []).forEach(add);

  if (Array.isArray(screen?.answer)) {
    screen.answer.forEach(add);
    if (screen.answer.length > 1) add(screen.answer.join(' '));
  }
  if (Array.isArray(screen?.orderAnswer)) {
    screen.orderAnswer.forEach(add);
    if (screen.orderAnswer.length > 1) add(screen.orderAnswer.join(' '));
  }

  for (const item of screen?.items || []) {
    add(item?.text);
    (item?.options || []).forEach(add);
    (item?.answers || []).forEach(add);
  }

  for (const question of screen?.questions || []) {
    (question?.options || []).forEach(add);
    add(question?.answer);
    (question?.answers || []).forEach(add);
  }

  for (const pair of screen?.pairs || []) {
    if (Array.isArray(pair)) pair.forEach(add);
  }

  return [...new Set(values)];
};

const findAudioDictionaryEntry = (audioDictionary, value) => {
  const key = normalizeAutoMediaKey(value);
  if (!key) return null;
  return audioDictionary.find(entry =>
    normalizeAutoMediaKey(entry.key) === key ||
    normalizeAutoMediaKey(entry.text) === key
  ) || null;
};

const findAutomaticMedia = (mediaLibrary, screen) => {
  if (screen?.mediaId || screen?.imageUrl) return null;
  const candidates = [screen?.mediaKey, screen?.phrase, screen?.scene, screen?.title, screen?.imageKey]
    .map(normalizeAutoMediaKey)
    .filter(Boolean);
  return mediaLibrary.find(item => candidates.includes(normalizeAutoMediaKey(item.name))) || null;
};
const expandReusableAudioPhrase = value => {
  const phrase = String(value || '').trim();
  if (!phrase) return [];
  const parts = phrase.split(/\s*[—–-]\s*/).map(part => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every(part => /^[A-Za-z][.!?]?$/.test(part))) {
    return parts.map(part => part.replace(/[.!?]+$/, ''));
  }
  return [phrase];
};

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

const api = async (url, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const attempts = method === 'GET' ? 5 : 1;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: options.body instanceof FormData
          ? options.headers
          : { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) return data;

      const retryableStartupError = method === 'GET'
        && response.status >= 500
        && !data.error
        && attempt < attempts - 1;

      if (retryableStartupError) {
        await wait(250 * (attempt + 1));
        continue;
      }

      throw new Error(data.error || `Ошибка запроса (${response.status})`);
    } catch (error) {
      lastError = error;
      if (method !== 'GET' || attempt >= attempts - 1) break;
      await wait(250 * (attempt + 1));
    }
  }

  throw lastError || new Error('API недоступен');
};

const createScreen = (type = 'choice') => {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const base = { id, type, eyebrow: 'Задание', title: '', audioPhrase: '', audioFiles: {}, mediaId: null, imageUrl: '' };

  if (type === 'intro') return { ...base, body: '', chips: [] };
  if (type === 'flashcard') return { ...base, phrase: '', translation: '', scene: 'meeting', sceneText: '', reply: '', replyTranslation: '', note: '' };
  if (type === 'choice') return { ...base, prompt: '', options: ['', ''], answer: '', hint: '' };
  if (type === 'listeningChoice') return { ...base, options: ['', ''], answer: '', hint: '' };
  if (type === 'multiChoice') return { ...base, items: [{ prompt: '', options: ['', ''], answer: '', scene: '' }] };
  if (type === 'classify') return { ...base, items: [{ text: '', answer: 'Greeting' }], categories: ['Greeting', 'Goodbye'] };
  if (type === 'order') return { ...base, tokens: ['', '', ''], answer: ['', '', ''] };
  if (type === 'pronunciation') return { ...base, phrases: ['', ''], note: '' };
  if (type === 'listeningDialog') return { ...base, items: [{ prompt: '', options: ['', ''], answer: '', scene: '' }] };
  if (type === 'speakingFinal') return { ...base, items: [{ prompt: '', scene: 'meeting', answers: [''] }], finishText: '' };
  if (type === 'specTask') return {
    ...base,
    mode: 'info',
    lead: [],
    body: [],
    questions: [],
    pairs: [],
    tokens: [],
    orderAnswer: [],
    expected: [],
    audioPhrases: [],
  };
  return base;
};

const modulePayload = draft => ({
  position: Number(draft.position || 1),
  title: draft.title || '',
  shortTitle: draft.shortTitle || '',
  description: draft.description || '',
  level: draft.level || 'A1',
  progress: clamp(draft.progress),
});

const blockPayload = draft => ({
  position: Number(draft.position || 1),
  title: draft.title || '',
  imageKey: draft.imageKey || 'lesson-1.webp',
  progress: clamp(draft.progress),
});

const lessonPayload = draft => ({
  position: Number(draft.position || 1),
  title: draft.title || '',
  tagPrimary: draft.tagPrimary || '',
  tagSecondary: draft.tagSecondary || '',
  description: draft.description || '',
  objective: draft.objective || '',
  status: draft.status || 'outline',
  duration: Math.max(0, Number(draft.duration || 0)),
  imageKey: draft.imageKey || 'lesson-1.webp',
  content: draft.content || { version: 1, outcomes: [], screens: [] },
});

function Field({ label, children, wide = false, hint = '' }) {
  return (
    <label className={`admin-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function TextInput({ value = '', onChange, ...props }) {
  return <input value={value ?? ''} onChange={event => onChange(event.target.value)} {...props} />;
}

function TextArea({ value = '', onChange, ...props }) {
  return <textarea value={value ?? ''} onChange={event => onChange(event.target.value)} {...props} />;
}

function LinesEditor({ label, value = [], onChange, placeholder = 'Один элемент на строку' }) {
  return (
    <Field label={label} wide>
      <textarea
        rows={4}
        value={(value || []).join('\n')}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value.split('\n').map(item => item.trim()).filter(Boolean))}
      />
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
    <div className={`admin-media-slot ${value ? 'has-file' : ''}`}>
      <div className="admin-media-copy">
        {kind === 'audio' ? <FileAudio size={18} /> : <Image size={18} />}
        <div><strong>{label}</strong><span>{value ? 'загружено' : 'файла нет'}</span></div>
      </div>
      {kind === 'audio' && value && <audio controls preload="none" src={value} />}
      {kind === 'image' && value && <img src={value} alt="" />}
      <div className="admin-media-actions">
        <label className="admin-upload-btn">
          {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
          {busy ? 'Загрузка…' : value ? 'Заменить' : 'Загрузить'}
          <input
            type="file"
            accept={kind === 'audio' ? 'audio/*' : 'image/*'}
            hidden
            disabled={busy}
            onChange={event => upload(event.target.files?.[0])}
          />
        </label>
        {value && <button className="admin-ghost-danger" onClick={() => onChange('')}><Trash2 size={14} /> Убрать</button>}
      </div>
    </div>
  );
}

function ImageLibraryPicker({ screen, onChange, mediaLibrary = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const current = mediaLibrary.find(item => item.id === Number(screen.mediaId)) || null;
  const automatic = findAutomaticMedia(mediaLibrary, screen);
  const previewUrl = current?.url || screen.imageUrl || automatic?.url || '';
  const normalizedQuery = normalizeLibraryText(query);
  const results = mediaLibrary.filter(item => !normalizedQuery || normalizeLibraryText(item.name).includes(normalizedQuery));
  const selected = mediaLibrary.find(item => item.id === selectedId) || null;

  const openPicker = () => {
    setSelectedId(current?.id || null);
    setQuery('');
    setOpen(true);
  };

  const attach = () => {
    if (!selected) return;
    onChange({ ...screen, mediaId: selected.id, imageUrl: selected.url });
    setOpen(false);
  };

  const clear = () => {
    onChange({ ...screen, mediaId: null, imageUrl: '' });
    setOpen(false);
  };

  return (
    <section className="admin-media-section">
      <div className="admin-section-minihead">
        <div><Image size={18} /><strong>Картинка задания</strong></div>
        <span>выбирается из общей медиатеки</span>
      </div>

      <div className={`admin-library-image-field ${previewUrl ? 'has-image' : ''}`}>
        {previewUrl ? (
          <img src={previewUrl} alt={current?.name || ''} />
        ) : (
          <div className="admin-library-image-empty"><Image size={26} /><span>Картинка не выбрана</span></div>
        )}
        <div className="admin-library-image-copy">
          <strong>{current?.name || automatic?.name || (screen.imageUrl ? 'Старая картинка урока' : 'Нет картинки')}</strong>
          <span>{
            current
              ? 'Связана с медиатекой: при замене файла обновится автоматически.'
              : automatic
                ? 'Подставляется автоматически из медиатеки по названию/сцене. Вручную выбирать не обязательно.'
                : screen.imageUrl
                  ? 'Legacy URL. Можно заменить картинкой из медиатеки.'
                  : 'Если название или ключ сцены совпадут с медиатекой, картинка подставится автоматически.'
          }</span>
          <div className="admin-media-actions">
            <button className="admin-media-library-choose" onClick={openPicker}><Search size={15} /> {previewUrl ? 'Выбрать другую' : 'Выбрать картинку'}</button>
            {(current || screen.imageUrl) && <button className="admin-ghost-danger" onClick={clear}><Trash2 size={14} /> Убрать</button>}
          </div>
        </div>
      </div>

      {open && (
        <div className="admin-media-picker-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="admin-media-picker-modal" role="dialog" aria-modal="true" aria-label="Выбор картинки">
            <div className="admin-media-picker-head">
              <div><strong>Выбери картинку</strong><span>Поиск идёт по названию в медиатеке.</span></div>
              <button onClick={() => setOpen(false)} aria-label="Закрыть"><X size={18} /></button>
            </div>

            <label className="admin-media-picker-search">
              <Search size={17} />
              <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Например: Hello" />
              <span>{results.length}</span>
            </label>

            <div className="admin-media-picker-grid">
              {results.map(item => (
                <button
                  key={item.id}
                  className={`admin-media-picker-card ${selectedId === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <img src={item.url} alt="" />
                  <span>{item.name}</span>
                  {selectedId === item.id && <i><Check size={14} /></i>}
                </button>
              ))}
              {!results.length && (
                <div className="admin-media-picker-empty">По запросу «{query}» ничего не найдено. Сначала добавь картинку в раздел «Медиатека».</div>
              )}
            </div>

            <div className="admin-media-picker-footer">
              <span>{selected ? <>Выбрано: <strong>{selected.name}</strong></> : 'Выбери один вариант'}</span>
              <button onClick={attach} disabled={!selected}><Plus size={16} /> Добавить</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function getListeningFallbackPhrases(screen) {
  if (screen?.type === 'listeningChoice') {
    return screen.audio ? [screen.audio] : [];
  }
  if (screen?.type === 'listeningDialog') {
    return Array.isArray(screen.audioLines) ? screen.audioLines.filter(Boolean) : [];
  }
  if (screen?.type === 'specTask' && screen?.mode === 'listening') {
    if (Array.isArray(screen.audioPhrases) && screen.audioPhrases.length) return screen.audioPhrases.filter(Boolean);
    return screen.audio ? [screen.audio] : [];
  }
  return [];
}

function DirectLessonAudioField({ screen, onChange, audioDictionary = [] }) {
  const files = screen.audioFiles || {};
  const fallbackPhrases = getListeningFallbackPhrases(screen);
  const fallbackReadyByVoice = Object.fromEntries(
    VOICES.map(([voiceId]) => [
      voiceId,
      fallbackPhrases.length > 0 && fallbackPhrases.every(phrase => {
        const entry = findAudioDictionaryEntry(audioDictionary, phrase);
        return Boolean(entry?.audioFiles?.[voiceId]);
      }),
    ])
  );
  const fallbackReadyCount = VOICES.filter(([voiceId]) => fallbackReadyByVoice[voiceId]).length;

  const update = (voiceId, url) => {
    const next = { ...files };
    if (url) next[voiceId] = url;
    else delete next[voiceId];
    onChange({ ...screen, audioFiles: next });
  };

  return (
    <section className="admin-media-section admin-direct-audio-section">
      <div className="admin-section-minihead">
        <div><FileAudio size={18} /><strong>Аудио именно этого задания</strong></div>
        <span>имеет приоритет над словарным fallback</span>
      </div>
      <p className="admin-audio-reference-help">
        Используй для аудирования, где ученик сначала слышит конкретную запись. Файл хранится прямо в задании отдельно для каждого голоса. Если конкретный файл ещё не загружен, урок временно попробует взять указанную ниже фразу/реплики из общего аудиословаря.
      </p>

      {fallbackPhrases.length > 0 && (
        <div className={`admin-listening-fallback ${fallbackReadyCount ? 'ready' : 'missing'}`}>
          <div>
            <strong>Fallback из аудиословаря</strong>
            <span>{fallbackPhrases.join(' · ')}</span>
          </div>
          <em>{fallbackReadyCount}/{VOICES.length} голосов полностью готовы</em>
        </div>
      )}

      <div className="admin-audio-grid">
        {VOICES.map(([id, name, gender]) => (
          <MediaUploader
            key={id}
            kind="audio"
            label={`${name} · ${gender}`}
            value={files[id] || ''}
            onChange={url => update(id, url)}
          />
        ))}
      </div>
    </section>
  );
}

function AutoAudioStatus({ screen, audioDictionary = [] }) {
  const phrases = collectAutoAudioTexts(screen);
  if (!phrases.length) return null;

  return (
    <section className="admin-media-section admin-audio-reference-section">
      <div className="admin-section-minihead">
        <div><Volume2 size={18} /><strong>Автоматическая озвучка элементов</strong></div>
        <span>по тексту из общего аудиословаря</span>
      </div>
      <p className="admin-audio-reference-help">
        Ничего привязывать вручную не нужно: английские слова, варианты ответа и токены ищутся в аудиословаре автоматически. Для сборки фразы отдельно ищется и запись всей правильной строки.
      </p>
      <div className="admin-audio-sequence-status">
        {phrases.map(phrase => {
          const entry = findAudioDictionaryEntry(audioDictionary, phrase);
          const count = VOICES.filter(([id]) => entry?.audioFiles?.[id]).length;
          return (
            <div key={phrase} className={count ? 'ready' : 'missing'}>
              <strong>{phrase}</strong>
              <span>{count ? <><Check size={13} /> {count}/{VOICES.length} голосов</> : 'нет в аудиословаре'}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AudioPhraseField({ screen, onChange, audioDictionary = [] }) {
  const audioPhrase = screen.audioPhrase || '';
  const key = normalizeAudioPhrase(audioPhrase);
  const match = key
    ? audioDictionary.find(entry => entry.key === key || normalizeAudioPhrase(entry.text) === key)
    : null;
  const dictionaryFiles = match?.audioFiles || {};
  const audioCount = VOICES.filter(([id]) => dictionaryFiles[id]).length;
  const legacyCount = VOICES.filter(([id]) => screen.audioFiles?.[id]).length;
  const state = !audioPhrase.trim() ? 'empty' : audioCount > 0 ? 'ready' : 'missing';

  return (
    <section className="admin-media-section admin-audio-reference-section">
      <div className="admin-section-minihead">
        <div><Volume2 size={18} /><strong>Озвучка из аудиословаря</strong></div>
        <span>одна фраза переиспользуется во всех уроках</span>
      </div>

      <div className={`admin-audio-reference ${state}`}>
        <Field
          label="Слово или фраза для озвучки"
          wide
          hint="Регистр и лишние пробелы не важны. Пунктуация считается частью фразы."
        >
          <TextInput
            value={audioPhrase}
            placeholder="Например: Hello"
            onChange={value => onChange({ ...screen, audioPhrase: value })}
          />
        </Field>

        <div className="admin-audio-reference-status">
          {!audioPhrase.trim() ? (
            <><span className="dot" /> Укажи фразу, которую нужно озвучивать.</>
          ) : audioCount > 0 ? (
            <><Check size={16} /> Озвучка найдена · {audioCount} из {VOICES.length} голосов</>
          ) : match ? (
            <><span className="dot" /> Фраза есть в словаре, но аудио ещё не загружено.</>
          ) : (
            <><span className="dot" /> Такой фразы пока нет в аудиословаре.</>
          )}
        </div>

        {match && (
          <div className="admin-audio-voice-statuses">
            {VOICES.map(([id, name]) => (
              <span key={id} className={dictionaryFiles[id] ? 'ready' : ''}>
                {dictionaryFiles[id] ? <Check size={12} /> : <span>×</span>} {name}
              </span>
            ))}
          </div>
        )}

        {audioPhrase.trim() && audioCount === 0 && (
          <p className="admin-audio-reference-help">
            Добавь эту фразу в разделе «Аудиословарь» и загрузи хотя бы один голос — после этого урок подхватит запись автоматически.
          </p>
        )}

        {legacyCount > 0 && (
          <p className="admin-audio-legacy-note">
            У этого задания сохранено старое аудио ({legacyCount}/{VOICES.length}). Оно продолжит работать как резервный вариант.
          </p>
        )}
      </div>
    </section>
  );
}

function AudioSequenceStatus({ screen, audioDictionary = [] }) {
  const phrases = [...new Set(
    (screen.audioPhrases || []).flatMap(expandReusableAudioPhrase).filter(Boolean)
  )];

  if (!phrases.length) return null;

  return (
    <section className="admin-media-section admin-audio-reference-section">
      <div className="admin-section-minihead">
        <div><Volume2 size={18} /><strong>Аудио-последовательность</strong></div>
        <span>{phrases.length} элементов · берутся из аудиословаря</span>
      </div>
      <div className="admin-audio-sequence-status">
        {phrases.map(phrase => {
          const key = normalizeAudioPhrase(phrase);
          const entry = audioDictionary.find(item => item.key === key || normalizeAudioPhrase(item.text) === key);
          const count = VOICES.filter(([id]) => entry?.audioFiles?.[id]).length;
          return (
            <div key={phrase} className={count ? 'ready' : 'missing'}>
              <strong>{phrase}</strong>
              <span>{count ? <><Check size={13} /> {count}/{VOICES.length} голосов</> : 'нет аудио'}</span>
            </div>
          );
        })}
      </div>
      <p className="admin-audio-reference-help">
        Добавляй недостающие записи в «Аудиословарь». Для spelling последовательности вроде A — L — E — X автоматически используют отдельные записи букв.
      </p>
    </section>
  );
}

function QuestionsEditor({ items = [], onChange, withScene = false }) {
  const update = (index, patch) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="admin-repeat-editor wide">
      <div className="admin-repeat-head"><strong>Вопросы</strong><button onClick={() => onChange([...items, { prompt: '', options: ['', ''], answer: '', scene: '' }])}><Plus size={14} /> Добавить вопрос</button></div>
      {items.map((item, index) => (
        <div className="admin-repeat-card" key={index}>
          <div className="admin-repeat-number">{index + 1}</div>
          <div className="admin-repeat-fields">
            <Field label="Вопрос"><TextInput value={item.prompt} onChange={value => update(index, { prompt: value })} /></Field>
            {withScene && <Field label="Сцена"><TextInput value={item.scene} onChange={value => update(index, { scene: value })} /></Field>}
            <LinesEditor label="Варианты ответа" value={item.options || []} onChange={value => update(index, { options: value })} />
            <Field label="Правильный ответ" wide><TextInput value={item.answer} onChange={value => update(index, { answer: value })} /></Field>
          </div>
          <button className="admin-repeat-delete" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

function ClassificationEditor({ items = [], categories = [], onItemsChange }) {
  const update = (index, patch) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onItemsChange(next);
  };

  return (
    <div className="admin-repeat-editor wide">
      <div className="admin-repeat-head"><strong>Элементы классификации</strong><button onClick={() => onItemsChange([...items, { text: '', answer: categories[0] || '' }])}><Plus size={14} /> Добавить</button></div>
      {items.map((item, index) => (
        <div className="admin-repeat-card compact" key={index}>
          <div className="admin-repeat-number">{index + 1}</div>
          <div className="admin-repeat-fields two">
            <Field label="Текст"><TextInput value={item.text} onChange={value => update(index, { text: value })} /></Field>
            <Field label="Категория"><select value={item.answer || ''} onChange={event => update(index, { answer: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></Field>
          </div>
          <button className="admin-repeat-delete" onClick={() => onItemsChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

function SpeakingItemsEditor({ items = [], onChange }) {
  const update = (index, patch) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="admin-repeat-editor wide">
      <div className="admin-repeat-head"><strong>Ситуации</strong><button onClick={() => onChange([...items, { prompt: '', scene: 'meeting', answers: [''] }])}><Plus size={14} /> Добавить ситуацию</button></div>
      {items.map((item, index) => (
        <div className="admin-repeat-card" key={index}>
          <div className="admin-repeat-number">{index + 1}</div>
          <div className="admin-repeat-fields">
            <Field label="Ситуация"><TextInput value={item.prompt} onChange={value => update(index, { prompt: value })} /></Field>
            <Field label="Сцена"><TextInput value={item.scene} onChange={value => update(index, { scene: value })} /></Field>
            <LinesEditor label="Допустимые ответы" value={item.answers || []} onChange={value => update(index, { answers: value })} />
          </div>
          <button className="admin-repeat-delete" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

function ScreenFields({ screen, onChange, audioDictionary, mediaLibrary }) {
  const set = (key, value) => onChange({ ...screen, [key]: value });

  return (
    <div className="admin-screen-fields">
      <Field label="Тип задания">
        <select value={screen.type} onChange={event => {
          const next = createScreen(event.target.value);
          onChange({
            ...next,
            id: screen.id,
            audioPhrase: screen.audioPhrase || '',
            audioFiles: screen.audioFiles || {},
            mediaId: screen.mediaId || null,
            imageUrl: screen.imageUrl || '',
            eyebrow: screen.eyebrow || next.eyebrow,
          });
        }}>
          {TASK_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Надпись сверху"><TextInput value={screen.eyebrow} onChange={value => set('eyebrow', value)} /></Field>
      {'title' in screen && <Field label="Заголовок" wide><TextInput value={screen.title} onChange={value => set('title', value)} /></Field>}

      {screen.type === 'intro' && <>
        <Field label="Текст" wide><TextArea rows={4} value={screen.body} onChange={value => set('body', value)} /></Field>
        <LinesEditor label="Чипы" value={screen.chips} onChange={value => set('chips', value)} />
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
        {screen.type === 'listeningChoice' && (
          <Field label="Fallback-фраза из аудиословаря" wide hint="Используется только пока для выбранного голоса не загружено отдельное аудио этого задания.">
            <TextInput value={screen.audio || ''} placeholder="Например: Hi" onChange={value => set('audio', value)} />
          </Field>
        )}
        <LinesEditor label="Варианты ответа" value={screen.options} onChange={value => set('options', value)} />
        <Field label="Правильный ответ"><TextInput value={screen.answer} onChange={value => set('answer', value)} /></Field>
        <Field label="Подсказка"><TextInput value={screen.hint} onChange={value => set('hint', value)} /></Field>
      </>}

      {(screen.type === 'multiChoice' || screen.type === 'listeningDialog') && <>
        {screen.type === 'listeningDialog' && (
          <LinesEditor
            label="Fallback-реплики диалога"
            value={screen.audioLines || []}
            onChange={value => set('audioLines', value)}
            placeholder="Одна реплика на строку"
          />
        )}
        <QuestionsEditor items={screen.items || []} withScene onChange={value => set('items', value)} />
      </>}

      {screen.type === 'classify' && <>
        <LinesEditor label="Категории" value={screen.categories} onChange={value => set('categories', value)} />
        <ClassificationEditor items={screen.items || []} categories={screen.categories || []} onItemsChange={value => set('items', value)} />
      </>}

      {screen.type === 'order' && <>
        <LinesEditor label="Слова / токены" value={screen.tokens} onChange={value => set('tokens', value)} />
        <LinesEditor label="Правильный порядок" value={screen.answer} onChange={value => set('answer', value)} />
      </>}

      {screen.type === 'pronunciation' && <>
        <LinesEditor label="Фразы для повторения" value={screen.phrases} onChange={value => set('phrases', value)} />
        <Field label="Заметка" wide><TextArea rows={3} value={screen.note} onChange={value => set('note', value)} /></Field>
      </>}

      {screen.type === 'speakingFinal' && <>
        <SpeakingItemsEditor items={screen.items || []} onChange={value => set('items', value)} />
        <Field label="Финальный текст" wide><TextArea rows={3} value={screen.finishText} onChange={value => set('finishText', value)} /></Field>
      </>}

      {screen.type === 'specTask' && <>
        <Field label="Базовый движок">
          <select value={screen.mode || 'info'} onChange={event => set('mode', event.target.value)}>
            <option value="info">Информация / теория</option>
            <option value="study">Карточка / изучение</option>
            <option value="choice">Выбор ответа</option>
            <option value="listening">Аудирование</option>
            <option value="reading">Чтение</option>
            <option value="match">Сопоставление</option>
            <option value="classify">Классификация</option>
            <option value="order">Порядок / сборка</option>
            <option value="speaking">Говорение</option>
            <option value="text">Письменный ответ</option>
            <option value="dialog">Диалог / сценарий</option>
          </select>
        </Field>
        <Field label="Фокус / единица"><TextInput value={screen.focus || ''} onChange={value => set('focus', value)} /></Field>
        <LinesEditor label="Краткий контекст" value={screen.lead || []} onChange={value => set('lead', value)} />
        <LinesEditor label="Полная спецификация экрана" value={screen.body || []} onChange={value => set('body', value)} />
        <LinesEditor label="Аудио-последовательность" value={screen.audioPhrases || []} onChange={value => set('audioPhrases', value)} placeholder="Одна фраза/буква на строку" />
        {['choice', 'listening', 'reading'].includes(screen.mode) && (
          <QuestionsEditor items={screen.questions || []} onChange={value => set('questions', value)} />
        )}
        {['match', 'classify'].includes(screen.mode) && (
          <LinesEditor
            label="Пары / цепочки"
            value={(screen.pairs || []).map(pair => pair.join(' → '))}
            onChange={value => set('pairs', value.map(line => line.split('→').map(part => part.trim()).filter(Boolean)).filter(pair => pair.length >= 2))}
            placeholder="France → Paris → French"
          />
        )}
        {screen.mode === 'order' && <>
          <LinesEditor label="Элементы для сборки" value={screen.tokens || []} onChange={value => set('tokens', value)} />
          <LinesEditor label="Правильный порядок" value={screen.orderAnswer || []} onChange={value => set('orderAnswer', value)} />
        </>}
        {screen.mode === 'speaking' && (
          <LinesEditor label="Допустимые / ожидаемые варианты" value={screen.expected || []} onChange={value => set('expected', value)} />
        )}
      </>}

      <ImageLibraryPicker screen={screen} onChange={onChange} mediaLibrary={mediaLibrary} />

      {(screen.type === 'listeningChoice' || screen.type === 'listeningDialog' || (screen.type === 'specTask' && screen.mode === 'listening')) && (
        <DirectLessonAudioField screen={screen} onChange={onChange} audioDictionary={audioDictionary} />
      )}

      <AutoAudioStatus screen={screen} audioDictionary={audioDictionary} />

      {screen.type === 'specTask' && (screen.audioPhrases || []).length && (
        <AudioSequenceStatus screen={screen} audioDictionary={audioDictionary} />
      )}

      {screen.audioPhrase && (
        <AudioPhraseField screen={screen} onChange={onChange} audioDictionary={audioDictionary} />
      )}
    </div>
  );
}

function LessonContentEditor({ draft, setDraft, audioDictionary, mediaLibrary }) {
  const content = draft.content || { version: 1, outcomes: [], screens: [] };
  const screens = content.screens || [];
  const [newType, setNewType] = useState('choice');

  const setContent = next => setDraft(current => ({ ...current, content: next }));
  const updateScreen = (index, nextScreen) => {
    const next = [...screens];
    next[index] = nextScreen;
    setContent({ ...content, screens: next });
  };
  const removeScreen = index => setContent({ ...content, screens: screens.filter((_, itemIndex) => itemIndex !== index) });
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
      <section className="admin-editor-section">
        <div className="admin-editor-title">
          <div><strong>Результаты урока</strong><span>Что ученик должен уметь после завершения</span></div>
        </div>
        <LinesEditor label="Outcomes" value={content.outcomes || []} onChange={value => setContent({ ...content, outcomes: value })} />
      </section>

      <div className="admin-tasks-head">
        <div><strong>Задания урока</strong><span>{screens.length} экранов · изменения сохраняются автоматически</span></div>
        <div className="admin-add-task">
          <select value={newType} onChange={event => setNewType(event.target.value)}>
            {TASK_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={() => setContent({ ...content, screens: [...screens, createScreen(newType)] })}><Plus size={16} /> Добавить задание</button>
        </div>
      </div>

      <div className="admin-task-list">
        {screens.map((screen, index) => (
          <details className="admin-task-card" key={screen.id ?? index} defaultOpen={index === 0}>
            <summary>
              <div className="admin-task-number">{index + 1}</div>
              <div className="admin-task-summary">
                <strong>{TASK_TYPES.find(([value]) => value === screen.type)?.[1] || screen.type}</strong>
                <span>{screen.title || screen.phrase || screen.prompt || screen.eyebrow || 'Без названия'}</span>
              </div>
              <div className="admin-task-tools" onClick={event => event.preventDefault()}>
                <button onClick={() => move(index, -1)} disabled={index === 0} title="Выше"><ChevronUp size={16} /></button>
                <button onClick={() => move(index, 1)} disabled={index === screens.length - 1} title="Ниже"><ChevronDown size={16} /></button>
                <button onClick={() => duplicate(index)} title="Дублировать"><Copy size={16} /></button>
                <button className="danger" onClick={() => {
                  if (window.confirm('Удалить это задание?')) removeScreen(index);
                }} title="Удалить"><Trash2 size={16} /></button>
              </div>
            </summary>
            <ScreenFields screen={screen} onChange={next => updateScreen(index, next)} audioDictionary={audioDictionary} mediaLibrary={mediaLibrary} />
          </details>
        ))}
        {!screens.length && <div className="admin-empty">В уроке пока нет заданий. Выбери тип и добавь первый экран.</div>}
      </div>
    </div>
  );
}

function SaveStatus({ state }) {
  if (state === 'saving') return <span className="admin-save-state saving"><Loader2 size={15} className="spin" /> Сохраняем…</span>;
  if (state === 'error') return <span className="admin-save-state error">Ошибка автосохранения</span>;
  if (state === 'dirty') return <span className="admin-save-state dirty">Есть изменения…</span>;
  return <span className="admin-save-state saved"><Check size={15} /> Всё сохранено</span>;
}

function MediaLibraryPanel({ entries, setEntries, loading, onReload, onSaveState }) {
  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const renameTimers = useRef({});

  const filteredEntries = useMemo(() => {
    const query = normalizeLibraryText(filter);
    if (!query) return entries;
    return entries.filter(entry => normalizeLibraryText(entry.name).includes(query));
  }, [entries, filter]);

  const uploadImage = async file => {
    if (!file) return null;
    const form = new FormData();
    form.append('file', file);
    return api('/api/admin/upload/image', { method: 'POST', body: form });
  };

  const addImage = async file => {
    const name = newName.trim();
    if (!name) {
      window.alert('Сначала дай картинке название.');
      return;
    }
    if (!file) return;

    setUploading(true);
    onSaveState('saving');
    let uploaded = null;
    try {
      uploaded = await uploadImage(file);
      const created = await api('/api/admin/media-library', {
        method: 'POST',
        body: JSON.stringify({
          name,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          originalName: uploaded.originalName,
          size: uploaded.size,
        }),
      });
      setEntries(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name, 'en')));
      setNewName('');
      onSaveState('saved');
    } catch (error) {
      onSaveState('error');
      if (uploaded?.url) {
        api('/api/admin/media', { method: 'DELETE', body: JSON.stringify({ url: uploaded.url }) }).catch(() => {});
      }
      window.alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const scheduleRename = (id, name) => {
    setEntries(list => list.map(entry => entry.id === id ? { ...entry, name } : entry));
    window.clearTimeout(renameTimers.current[id]);
    onSaveState('dirty');

    renameTimers.current[id] = window.setTimeout(async () => {
      onSaveState('saving');
      try {
        const updated = await api(`/api/admin/media-library/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        });
        setEntries(list => list.map(entry => entry.id === id
          ? entry.name === name ? updated : { ...entry, key: normalizeLibraryText(entry.name), updatedAt: updated.updatedAt }
          : entry));
        onSaveState('saved');
      } catch (error) {
        onSaveState('error');
        window.alert(error.message);
        await onReload();
      }
    }, 700);
  };

  const replaceImage = async (entry, file) => {
    if (!file) return;
    onSaveState('saving');
    let uploaded = null;
    try {
      uploaded = await uploadImage(file);
      const updated = await api(`/api/admin/media-library/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          originalName: uploaded.originalName,
          size: uploaded.size,
        }),
      });
      setEntries(list => list.map(item => item.id === entry.id ? { ...updated, name: item.name } : item));
      if (entry.url?.startsWith('/uploads/')) {
        api('/api/admin/media', { method: 'DELETE', body: JSON.stringify({ url: entry.url }) }).catch(() => {});
      }
      onSaveState('saved');
    } catch (error) {
      onSaveState('error');
      if (uploaded?.url) {
        api('/api/admin/media', { method: 'DELETE', body: JSON.stringify({ url: uploaded.url }) }).catch(() => {});
      }
      window.alert(error.message);
    }
  };

  const deleteImage = async entry => {
    if (!window.confirm(`Удалить «${entry.name}» из медиатеки?`)) return;
    onSaveState('saving');
    try {
      await api(`/api/admin/media-library/${entry.id}`, { method: 'DELETE' });
      setEntries(list => list.filter(item => item.id !== entry.id));
      if (entry.url?.startsWith('/uploads/')) {
        api('/api/admin/media', { method: 'DELETE', body: JSON.stringify({ url: entry.url }) }).catch(() => {});
      }
      onSaveState('saved');
    } catch (error) {
      onSaveState('error');
      window.alert(error.message);
    }
  };

  if (loading) {
    return <div className="admin-loading"><Loader2 className="spin" /> Загружаем медиатеку…</div>;
  }

  return (
    <div className="admin-media-library-page">
      <div className="admin-editor-head">
        <div className="admin-editor-heading">
          <div className="admin-editor-path">Общая библиотека изображений</div>
          <h1>Медиатека</h1>
          <p>Загружай картинку один раз, дай ей понятное название и затем находи её поиском в любом задании.</p>
        </div>
      </div>

      <section className="admin-media-library-add">
        <div>
          <strong>Добавить картинку</strong>
          <span>Например: Hello, Hello there, Hello everyone.</span>
        </div>
        <div className="admin-media-library-add-controls">
          <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="Название картинки" />
          <label className={`admin-media-library-upload ${uploading ? 'disabled' : ''}`}>
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            {uploading ? 'Загрузка…' : 'Выбрать файл'}
            <input type="file" accept="image/*" hidden disabled={uploading} onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void addImage(file);
            }} />
          </label>
        </div>
      </section>

      <label className="admin-media-library-filter">
        <Search size={17} />
        <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Поиск по названию…" />
        <span>{filteredEntries.length} из {entries.length}</span>
      </label>

      <div className="admin-media-library-grid">
        {filteredEntries.map(entry => (
          <article className="admin-media-library-card" key={entry.id}>
            <div className="admin-media-library-thumb"><img src={entry.url} alt="" /></div>
            <div className="admin-media-library-card-body">
              <span>Название</span>
              <input value={entry.name} onChange={event => scheduleRename(entry.id, event.target.value)} />
              <small>{entry.originalName || 'изображение'}{entry.size ? ` · ${Math.max(1, Math.round(entry.size / 1024))} КБ` : ''}</small>
              <div className="admin-media-actions">
                <label className="admin-upload-btn">
                  <Upload size={14} /> Заменить файл
                  <input type="file" accept="image/*" hidden onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void replaceImage(entry, file);
                  }} />
                </label>
                <button className="admin-ghost-danger" onClick={() => deleteImage(entry)}><Trash2 size={14} /> Удалить</button>
              </div>
            </div>
          </article>
        ))}
        {!filteredEntries.length && (
          <div className="admin-empty admin-media-library-empty">{entries.length ? 'По этому запросу картинок нет.' : 'Медиатека пока пустая. Добавь первую картинку выше.'}</div>
        )}
      </div>
    </div>
  );
}

function AudioDictionaryPanel({ entries, setEntries, loading, onReload, onSaveState }) {
  const [newPhrase, setNewPhrase] = useState('');
  const [filter, setFilter] = useState('');
  const textTimers = useRef({});

  const filteredEntries = useMemo(() => {
    const query = normalizeAudioPhrase(filter);
    if (!query) return entries;
    return entries.filter(entry => normalizeAudioPhrase(entry.text).includes(query));
  }, [entries, filter]);

  const createEntry = async () => {
    const text = newPhrase.trim();
    if (!text) return;

    onSaveState('saving');
    try {
      const created = await api('/api/admin/audio-dictionary', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setEntries(list => [...list, created].sort((a, b) => a.text.localeCompare(b.text, 'en')));
      setNewPhrase('');
      onSaveState('saved');
    } catch (error) {
      onSaveState('error');
      window.alert(error.message);
    }
  };

  const scheduleTextSave = (id, text) => {
    setEntries(list => list.map(entry => entry.id === id ? { ...entry, text } : entry));
    window.clearTimeout(textTimers.current[id]);
    onSaveState('dirty');

    textTimers.current[id] = window.setTimeout(async () => {
      onSaveState('saving');
      try {
        const updated = await api(`/api/admin/audio-dictionary/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ text }),
        });
        setEntries(list => list.map(entry => {
          if (entry.id !== id) return entry;
          if (entry.text === text) return updated;
          return { ...entry, key: normalizeAudioPhrase(entry.text), updatedAt: updated.updatedAt };
        }));
        onSaveState('saved');
      } catch (error) {
        onSaveState('error');
        window.alert(error.message);
        await onReload();
      }
    }, 700);
  };

  const updateAudio = async (entry, voiceId, url) => {
    const previous = entry;
    const audioFiles = { ...(entry.audioFiles || {}) };
    if (url) audioFiles[voiceId] = url;
    else delete audioFiles[voiceId];

    setEntries(list => list.map(item => item.id === entry.id ? { ...item, audioFiles } : item));
    onSaveState('saving');

    try {
      const updated = await api(`/api/admin/audio-dictionary/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ audioFiles }),
      });
      setEntries(list => list.map(item => item.id === entry.id
        ? { ...updated, text: item.text, key: normalizeAudioPhrase(item.text) }
        : item));
      onSaveState('saved');
    } catch (error) {
      setEntries(list => list.map(item => item.id === entry.id
        ? { ...item, audioFiles: previous.audioFiles || {} }
        : item));
      onSaveState('error');
      window.alert(error.message);
    }
  };

  const deleteEntry = async entry => {
    if (!window.confirm(`Удалить фразу «${entry.text}» из аудиословаря?`)) return;

    onSaveState('saving');
    try {
      await api(`/api/admin/audio-dictionary/${entry.id}`, { method: 'DELETE' });
      setEntries(list => list.filter(item => item.id !== entry.id));
      onSaveState('saved');
    } catch (error) {
      onSaveState('error');
      window.alert(error.message);
    }
  };

  if (loading) {
    return <div className="admin-loading"><Loader2 className="spin" /> Загружаем аудиословарь…</div>;
  }

  return (
    <div className="admin-audio-dictionary-page">
      <div className="admin-editor-head">
        <div className="admin-editor-heading">
          <div className="admin-editor-path">Общая медиатека озвучки</div>
          <h1>Аудиословарь</h1>
          <p>Одна английская фраза хранится один раз и может использоваться в любом количестве уроков. Все изменения сохраняются автоматически.</p>
        </div>
      </div>

      <section className="admin-audio-dict-add">
        <div>
          <strong>Новая фраза</strong>
          <span>Сначала добавь текст, затем загрузи нужные голоса.</span>
        </div>
        <div className="admin-audio-dict-add-controls">
          <input
            value={newPhrase}
            placeholder="Например: Hello"
            onChange={event => setNewPhrase(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void createEntry();
              }
            }}
          />
          <button onClick={createEntry} disabled={!newPhrase.trim()}><Plus size={16} /> Добавить фразу</button>
        </div>
      </section>

      <div className="admin-audio-dict-toolbar">
        <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Фильтр по фразам…" />
        <span>{filteredEntries.length} из {entries.length}</span>
      </div>

      <div className="admin-audio-dict-list">
        {filteredEntries.map(entry => {
          const readyCount = VOICES.filter(([id]) => entry.audioFiles?.[id]).length;
          return (
            <article className="admin-audio-dict-card" key={entry.id}>
              <div className="admin-audio-dict-card-head">
                <div className="admin-audio-dict-phrase">
                  <span>Фраза</span>
                  <input
                    value={entry.text}
                    onChange={event => scheduleTextSave(entry.id, event.target.value)}
                  />
                </div>
                <span className={`admin-audio-dict-state ${readyCount ? 'ready' : 'missing'}`}>
                  {readyCount ? <><Check size={14} /> {readyCount}/{VOICES.length} голосов</> : 'Нет аудио'}
                </span>
                <button className="admin-audio-dict-delete" onClick={() => deleteEntry(entry)} title="Удалить фразу"><Trash2 size={16} /></button>
              </div>

              <div className="admin-audio-grid">
                {VOICES.map(([id, name, gender]) => (
                  <MediaUploader
                    key={id}
                    kind="audio"
                    label={`${name} · ${gender}`}
                    value={entry.audioFiles?.[id] || ''}
                    onChange={url => updateAudio(entry, id, url)}
                  />
                ))}
              </div>
            </article>
          );
        })}

        {!filteredEntries.length && (
          <div className="admin-empty">{entries.length ? 'По этому фильтру ничего не найдено.' : 'Аудиословарь пока пуст. Добавь первую фразу выше.'}</div>
        )}
      </div>
    </div>
  );
}

function StorageSettingsPanel({ settings, setSettings, loading, onReload, onSaveState }) {
  const [draft, setDraft] = useState(settings || {});
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [verifyingCloudOnly, setVerifyingCloudOnly] = useState(false);

  useEffect(() => {
    setDraft(settings || {});
  }, [settings]);

  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));

  const save = async () => {
    onSaveState('saving');
    try {
      const updated = await api('/api/admin/storage-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          endpoint: draft.endpoint || '',
          region: draft.region || 'us-east-1',
          bucket: draft.bucket || '',
          projectId: draft.projectId || '',
          accessKeyId: draft.accessKeyId || '',
          secretAccessKey,
        }),
      });
      setSettings(updated);
      setDraft(updated);
      setSecretAccessKey('');
      onSaveState('saved');
      return updated;
    } catch (error) {
      onSaveState('error');
      window.alert(error.message);
      return null;
    }
  };

  const test = async () => {
    const saved = await save();
    if (!saved) return;
    setTesting(true);
    try {
      const result = await api('/api/admin/storage-settings/test', { method: 'POST' });
      window.alert(result.message || 'Подключение работает.');
    } catch (error) {
      window.alert(error.message);
    } finally {
      setTesting(false);
    }
  };

  const verifyCloudOnly = async () => {
    setVerifyingCloudOnly(true);
    try {
      const result = await api('/api/admin/storage-settings/cloud-only-status');
      if (result.ok) {
        window.alert('Проверка пройдена: в облачной базе нет ссылок на локальные /uploads.');
      } else {
        window.alert(`Найдены локальные ссылки: ${result.localReferenceCount}. Локальную очистку пока выполнять нельзя.`);
      }
    } catch (error) {
      window.alert(error.message);
    } finally {
      setVerifyingCloudOnly(false);
    }
  };

  if (loading) {
    return <div className="admin-loading"><Loader2 className="spin" /> Загружаем настройки…</div>;
  }

  return (
    <div className="admin-storage-settings-page">
      <div className="admin-editor-head">
        <div className="admin-editor-heading">
          <div className="admin-editor-path">Инфраструктура</div>
          <h1>Хранилище REG.RU S3</h1>
          <p>Новые картинки и аудио загружаются напрямую в S3. Secret Access Key хранится в базе только в зашифрованном виде.</p>
        </div>
      </div>

      {!draft.encryptionReady && (
        <section className="admin-storage-warning">
          <strong>Нужно один раз создать STORAGE_MASTER_KEY</strong>
          <span>Без него сервер намеренно не сохраняет Secret Access Key. Команда настройки создаст ключ автоматически.</span>
        </section>
      )}

      <section className="admin-editor-section">
        <div className="admin-editor-title">
          <div><strong>Подключение к S3</strong><span>REG.RU Object Storage</span></div>
          <span className={`admin-storage-secret-state ${draft.hasSecretAccessKey ? 'ready' : ''}`}>
            {draft.hasSecretAccessKey ? <><Check size={14} /> Secret Key сохранён</> : 'Secret Key не задан'}
          </span>
        </div>

        <div className="admin-form-grid">
          <Field label="S3 API Endpoint" wide>
            <TextInput value={draft.endpoint || ''} onChange={value => set('endpoint', value)} placeholder="https://s3.regru.cloud" />
          </Field>
          <Field label="Bucket">
            <TextInput value={draft.bucket || ''} onChange={value => set('bucket', value)} placeholder="angliskii" />
          </Field>
          <Field label="Region">
            <TextInput value={draft.region || 'us-east-1'} onChange={value => set('region', value)} />
          </Field>
          <Field label="Project ID" wide>
            <TextInput value={draft.projectId || ''} onChange={value => set('projectId', value)} />
          </Field>
          <Field label="Access Key ID" wide>
            <TextInput value={draft.accessKeyId || ''} onChange={value => set('accessKeyId', value)} />
          </Field>
          <Field
            label="Secret Access Key"
            wide
            hint={draft.hasSecretAccessKey ? 'Ключ уже сохранён. Оставь поле пустым, чтобы не менять его.' : 'Вставь Secret Access Key из REG.RU. После сохранения он больше не возвращается в браузер.'}
          >
            <input
              type="password"
              autoComplete="new-password"
              value={secretAccessKey}
              onChange={event => setSecretAccessKey(event.target.value)}
              placeholder={draft.hasSecretAccessKey ? '••••••••••••••••••••' : 'Вставь секретный ключ'}
            />
          </Field>
        </div>

        <div className="admin-storage-actions">
          <button onClick={save}><Check size={16} /> Сохранить настройки</button>
          <button className="secondary" onClick={test} disabled={testing}>
            {testing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            Проверить подключение
          </button>
        </div>
      </section>

      <section className="admin-editor-section">
        <div className="admin-editor-title">
          <div><strong>Облачный режим</strong><span>Локальные пользовательские /uploads полностью отключены</span></div>
        </div>
        <p className="admin-storage-explain">
          Сервер больше не раздаёт и не создаёт public/uploads. Новые пользовательские картинки, аудио и файлы загружаются только в REG.RU S3.
        </p>
        <button className="admin-storage-migrate" onClick={verifyCloudOnly} disabled={verifyingCloudOnly}>
          {verifyingCloudOnly ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          {verifyingCloudOnly ? 'Проверяем…' : 'Проверить отсутствие локальных ссылок'}
        </button>
      </section>

      <section className="admin-editor-section">
        <div className="admin-editor-title">
          <div><strong>PostgreSQL REG.RU</strong><span>Подключение базы задаётся через DATABASE_URL</span></div>
          <span className={`admin-storage-secret-state ${draft.database?.cloud ? 'ready' : ''}`}>
            {draft.database?.cloud ? <><Check size={14} /> REG.RU подключена</> : 'Сейчас не REG.RU'}
          </span>
        </div>
        <p className="admin-storage-explain">
          База данных переключается не через браузер, а через локальный .env, чтобы пароль PostgreSQL не попадал в админский API. Скрипт миграции переносит текущую базу целиком и затем меняет DATABASE_URL на облачный PostgreSQL.
        </p>
        {draft.database?.host && (
          <div className="admin-storage-db-grid">
            <span><small>Хост</small><strong>{draft.database.host}</strong></span>
            <span><small>Порт</small><strong>{draft.database.port}</strong></span>
            <span><small>База</small><strong>{draft.database.database}</strong></span>
            <span><small>Пользователь</small><strong>{draft.database.user}</strong></span>
          </div>
        )}
      </section>
    </div>
  );
}

function VoiceAdminPanel({ voices, setVoices, loading, onSaveState }) {
  const updateVoice = async (id, patch) => {
    const current = voices.find(voice => voice.id === id);
    if (!current) return;

    const optimistic = { ...current, ...patch };
    setVoices(list => list.map(voice => voice.id === id ? optimistic : voice));
    onSaveState('saving');

    try {
      const updated = await api(`/api/admin/voices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setVoices(list => list.map(voice => voice.id === id ? updated : voice));
      onSaveState('saved');
    } catch (error) {
      setVoices(list => list.map(voice => voice.id === id ? current : voice));
      onSaveState('error');
      window.alert(error.message);
    }
  };

  if (loading) {
    return <div className="admin-loading"><Loader2 className="spin" /> Загружаем голоса…</div>;
  }

  return (
    <div className="admin-voices-page">
      <div className="admin-editor-head">
        <div className="admin-editor-heading">
          <div className="admin-editor-path">Настройки озвучки</div>
          <h1>Голоса курса</h1>
          <p>Для каждого голоса загрузи короткую английскую демо-фразу. Именно её пользователь услышит при выборе голоса в профиле.</p>
        </div>
      </div>

      <section className="admin-voice-help">
        <Volume2 size={20} />
        <div>
          <strong>Рекомендуемый формат фразы</strong>
          <span><code>Hi! I'm Ella. This is my voice.</code> — коротко, естественно и одинаково по смыслу для всех шести голосов.</span>
        </div>
      </section>

      <div className="admin-voice-cards">
        {voices.map(voice => (
          <article className="admin-voice-card" key={voice.id}>
            <div className="admin-voice-card-head">
              <span className="admin-voice-avatar">{voice.name?.[0] || '?'}</span>
              <div>
                <strong>{voice.name}</strong>
                <span>{voice.gender} · {voice.note}</span>
              </div>
              <span className={`admin-voice-file-state ${voice.previewUrl ? 'ready' : ''}`}>
                {voice.previewUrl ? 'Демо загружено' : 'Нет демо'}
              </span>
            </div>

            <Field label="Текст демо-фразы" wide hint="Фраза должна быть на английском. Это подпись и ориентир для записи.">
              <TextArea
                rows={3}
                value={voice.sampleText || ''}
                onChange={value => setVoices(list => list.map(item => item.id === voice.id ? { ...item, sampleText: value } : item))}
                onBlur={() => updateVoice(voice.id, { sampleText: voices.find(item => item.id === voice.id)?.sampleText || '' })}
              />
            </Field>

            <MediaUploader
              kind="audio"
              label={`Демо голоса ${voice.name}`}
              value={voice.previewUrl || ''}
              onChange={url => updateVoice(voice.id, { previewUrl: url || null })}
            />

            {voice.previewUrl && (
              <button className="admin-voice-preview-btn" onClick={() => {
                const audio = new Audio(voice.previewUrl);
                audio.play().catch(() => {});
              }}>
                <Volume2 size={17} /> Послушать демо
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function AdminApp() {
  const [adminSection, setAdminSection] = useState('course');
  const [tree, setTree] = useState([]);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [audioDictionary, setAudioDictionary] = useState([]);
  const [audioDictionaryLoading, setAudioDictionaryLoading] = useState(true);
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(true);
  const [storageSettings, setStorageSettings] = useState(null);
  const [storageSettingsLoading, setStorageSettingsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('saved');
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [moduleDraft, setModuleDraft] = useState(null);
  const [blockDraft, setBlockDraft] = useState(null);
  const [lessonDraft, setLessonDraft] = useState(null);
  const [browserOpen, setBrowserOpen] = useState(true);
  const [browserLevel, setBrowserLevel] = useState('modules');

  const saveTimers = useRef({});
  const lastSaved = useRef({ module: '', block: '', lesson: '' });

  const selectedModule = useMemo(() => tree.find(item => item.id === selectedModuleId) || null, [tree, selectedModuleId]);
  const selectedBlock = useMemo(() => selectedModule?.blocks?.find(item => item.id === selectedBlockId) || null, [selectedModule, selectedBlockId]);
  const selectedLesson = useMemo(() => selectedBlock?.lessons?.find(item => item.id === selectedLessonId) || null, [selectedBlock, selectedLessonId]);

  const loadTree = async () => {
    setLoading(true);
    try {
      const data = await api('/api/admin/tree');
      setTree(data);
      return data;
    } catch (error) {
      window.alert(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async () => {
    setVoicesLoading(true);
    try {
      const data = await api('/api/admin/voices');
      setVoices(data);
      return data;
    } catch (error) {
      window.alert(error.message);
      return [];
    } finally {
      setVoicesLoading(false);
    }
  };

  const loadAudioDictionary = async () => {
    setAudioDictionaryLoading(true);
    try {
      const data = await api('/api/admin/audio-dictionary');
      setAudioDictionary(data);
      return data;
    } catch (error) {
      window.alert(error.message);
      return [];
    } finally {
      setAudioDictionaryLoading(false);
    }
  };

  const loadMediaLibrary = async () => {
    setMediaLibraryLoading(true);
    try {
      const data = await api('/api/admin/media-library');
      setMediaLibrary(data);
      return data;
    } catch (error) {
      window.alert(error.message);
      return [];
    } finally {
      setMediaLibraryLoading(false);
    }
  };

  const loadStorageSettings = async () => {
    setStorageSettingsLoading(true);
    try {
      const data = await api('/api/admin/storage-settings');
      setStorageSettings(data);
      return data;
    } catch (error) {
      window.alert(error.message);
      return null;
    } finally {
      setStorageSettingsLoading(false);
    }
  };

  useEffect(() => {
    void loadTree();
    void loadVoices();
    void loadAudioDictionary();
    void loadMediaLibrary();
    void loadStorageSettings();
  }, []);

  useEffect(() => {
    if (!selectedModule) {
      setModuleDraft(null);
      lastSaved.current.module = '';
      return;
    }
    const next = deepClone(selectedModule);
    setModuleDraft(next);
    lastSaved.current.module = JSON.stringify(modulePayload(next));
  }, [selectedModuleId]);

  useEffect(() => {
    if (!selectedBlock) {
      setBlockDraft(null);
      lastSaved.current.block = '';
      return;
    }
    const next = deepClone(selectedBlock);
    setBlockDraft(next);
    lastSaved.current.block = JSON.stringify(blockPayload(next));
  }, [selectedBlockId]);

  useEffect(() => {
    if (!selectedLesson) {
      setLessonDraft(null);
      lastSaved.current.lesson = '';
      return;
    }
    const next = deepClone(selectedLesson);
    setLessonDraft(next);
    lastSaved.current.lesson = JSON.stringify(lessonPayload(next));
  }, [selectedLessonId]);

  const updateTreeEntity = (kind, id, updated) => {
    setTree(current => current.map(module => {
      if (kind === 'module' && module.id === id) return { ...module, ...updated };
      if (kind === 'block') {
        return { ...module, blocks: (module.blocks || []).map(block => block.id === id ? { ...block, ...updated } : block) };
      }
      if (kind === 'lesson') {
        return {
          ...module,
          blocks: (module.blocks || []).map(block => ({
            ...block,
            lessons: (block.lessons || []).map(lesson => lesson.id === id ? { ...lesson, ...updated } : lesson),
          })),
        };
      }
      return module;
    }));
  };

  const scheduleAutosave = (kind, id, body, url) => {
    const serialized = JSON.stringify(body);
    if (!id || lastSaved.current[kind] === serialized) return;

    window.clearTimeout(saveTimers.current[kind]);
    setSaveState('dirty');
    saveTimers.current[kind] = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const updated = await api(url, { method: 'PATCH', body: JSON.stringify(body) });
        lastSaved.current[kind] = serialized;
        updateTreeEntity(kind, id, updated);
        setSaveState('saved');
      } catch (error) {
        console.error(error);
        setSaveState('error');
      }
    }, 700);
  };

  useEffect(() => {
    if (moduleDraft?.id) scheduleAutosave('module', moduleDraft.id, modulePayload(moduleDraft), `/api/admin/modules/${moduleDraft.id}`);
  }, [moduleDraft]);

  useEffect(() => {
    if (blockDraft?.id) scheduleAutosave('block', blockDraft.id, blockPayload(blockDraft), `/api/admin/blocks/${blockDraft.id}`);
  }, [blockDraft]);

  useEffect(() => {
    if (lessonDraft?.id) scheduleAutosave('lesson', lessonDraft.id, lessonPayload(lessonDraft), `/api/admin/lessons/${lessonDraft.id}`);
  }, [lessonDraft]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(timer => window.clearTimeout(timer));
  }, []);

  const addModule = async () => {
    try {
      const created = await api('/api/admin/modules', { method: 'POST', body: JSON.stringify({ title: 'Новый модуль' }) });
      await loadTree();
      setSelectedModuleId(created.id);
      setSelectedBlockId(null);
      setSelectedLessonId(null);
      setBrowserLevel('blocks');
      setBrowserOpen(true);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const addBlock = async () => {
    if (!selectedModule) return;
    try {
      const created = await api('/api/admin/blocks', { method: 'POST', body: JSON.stringify({ moduleId: selectedModule.id, title: 'Новый блок' }) });
      await loadTree();
      setSelectedBlockId(created.id);
      setSelectedLessonId(null);
      setBrowserLevel('lessons');
      setBrowserOpen(true);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const addLesson = async () => {
    if (!selectedBlock) return;
    try {
      const created = await api('/api/admin/lessons', { method: 'POST', body: JSON.stringify({ blockId: selectedBlock.id, title: 'Новый урок' }) });
      await loadTree();
      setSelectedLessonId(created.id);
      setBrowserOpen(false);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const deleteEntity = async (kind, id, label) => {
    if (!window.confirm(`Удалить «${label}»? Это действие нельзя отменить.`)) return;
    try {
      await api(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
      if (kind === 'lessons') setSelectedLessonId(null);
      if (kind === 'blocks') {
        setSelectedBlockId(null);
        setSelectedLessonId(null);
        setBrowserLevel('blocks');
      }
      if (kind === 'modules') {
        setSelectedModuleId(null);
        setSelectedBlockId(null);
        setSelectedLessonId(null);
        setBrowserLevel('modules');
      }
      setBrowserOpen(true);
      await loadTree();
    } catch (error) {
      window.alert(error.message);
    }
  };

  const openModule = module => {
    setSelectedModuleId(module.id);
    setSelectedBlockId(null);
    setSelectedLessonId(null);
    setBrowserLevel('blocks');
  };

  const openBlock = block => {
    setSelectedBlockId(block.id);
    setSelectedLessonId(null);
    setBrowserLevel('lessons');
  };

  const openLesson = lesson => {
    setSelectedLessonId(lesson.id);
    setBrowserOpen(false);
  };

  const backBrowser = () => {
    if (browserLevel === 'lessons') {
      setSelectedBlockId(null);
      setSelectedLessonId(null);
      setBrowserLevel('blocks');
      return;
    }
    if (browserLevel === 'blocks') {
      setSelectedModuleId(null);
      setSelectedBlockId(null);
      setSelectedLessonId(null);
      setBrowserLevel('modules');
    }
  };

  const browserTitle = browserLevel === 'modules'
    ? 'Модули'
    : browserLevel === 'blocks'
      ? `Модуль ${selectedModule?.position || ''}`
      : `Блок ${selectedBlock?.position || ''}`;

  const browserItems = browserLevel === 'modules'
    ? tree
    : browserLevel === 'blocks'
      ? selectedModule?.blocks || []
      : selectedBlock?.lessons || [];

  const addAtCurrentLevel = browserLevel === 'modules' ? addModule : browserLevel === 'blocks' ? addBlock : addLesson;

  const renderBrowserItem = item => {
    if (browserLevel === 'modules') {
      return (
        <button className="admin-browser-item" key={item.id} onClick={() => openModule(item)}>
          <span className="admin-browser-index">{String(item.position).padStart(2, '0')}</span>
          <span className="admin-browser-copy"><strong>{item.title}</strong><small>{item.blocks?.length || 0} блоков · {item.level}</small></span>
          <ChevronLeft className="admin-browser-arrow" size={17} />
        </button>
      );
    }

    if (browserLevel === 'blocks') {
      return (
        <button className="admin-browser-item" key={item.id} onClick={() => openBlock(item)}>
          <span className="admin-browser-index">{String(item.position).padStart(2, '0')}</span>
          <span className="admin-browser-copy"><strong>{item.title}</strong><small>{item.lessons?.length || 0} уроков</small></span>
          <ChevronLeft className="admin-browser-arrow" size={17} />
        </button>
      );
    }

    return (
      <button className={`admin-browser-item ${item.id === selectedLessonId ? 'active' : ''}`} key={item.id} onClick={() => openLesson(item)}>
        <span className="admin-browser-index">{String(item.position).padStart(2, '0')}</span>
        <span className="admin-browser-copy"><strong>{item.title}</strong><small>{item.status === 'ready' ? 'готов' : 'план'} · {item.content?.screens?.length || 0} заданий</small></span>
        <ChevronLeft className="admin-browser-arrow" size={17} />
      </button>
    );
  };

  const crumbs = [
    selectedModule && `Модуль ${selectedModule.position}`,
    selectedBlock && `Блок ${selectedBlock.position}`,
    selectedLesson && `Урок ${selectedLesson.position}`,
  ].filter(Boolean);

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <a href="/" className="admin-back"><ArrowLeft size={18} /></a>
          <img src="/assets/skladno-logo.png" alt="" className="admin-brand-logo" />
          <div><strong>Складно · Админка</strong><span>Управление продуктом</span></div>
        </div>
        <div className="admin-top-actions">
          <SaveStatus state={saveState} />
          <button
            onClick={() => adminSection === 'voices'
              ? loadVoices()
              : adminSection === 'audioDictionary'
                ? loadAudioDictionary()
                : adminSection === 'mediaLibrary'
                  ? loadMediaLibrary()
                  : adminSection === 'settings'
                    ? loadStorageSettings()
                    : loadTree()}
            disabled={loading || voicesLoading || audioDictionaryLoading || mediaLibraryLoading || storageSettingsLoading}
          ><RefreshCw size={16} className={(loading || voicesLoading || audioDictionaryLoading || mediaLibraryLoading || storageSettingsLoading) ? 'spin' : ''} /> Обновить данные</button>
          <a href="/">Открыть сайт</a>
        </div>
      </header>

      <div className={`admin-workspace ${adminSection === 'course' && browserOpen ? 'with-browser' : 'focus-editor'}`}>
        <aside className="admin-global-nav">
          <div className="admin-global-label">Разделы</div>
          <button
            className={adminSection === 'course' ? 'active' : ''}
            onClick={() => { setAdminSection('course'); setBrowserOpen(true); }}
          >
            <BookOpen size={19} /><span><strong>Курс</strong><small>модули и уроки</small></span>
          </button>
          <button
            className={adminSection === 'voices' ? 'active' : ''}
            onClick={() => { setAdminSection('voices'); setBrowserOpen(false); }}
          >
            <Volume2 size={19} /><span><strong>Голоса</strong><small>6 демо-записей</small></span>
          </button>
          <button
            className={adminSection === 'audioDictionary' ? 'active' : ''}
            onClick={() => { setAdminSection('audioDictionary'); setBrowserOpen(false); }}
          >
            <FileAudio size={19} /><span><strong>Аудиословарь</strong><small>{audioDictionary.length} фраз</small></span>
          </button>
          <button disabled><Users size={19} /><span><strong>Пользователи</strong><small>скоро</small></span></button>
          <button
            className={adminSection === 'mediaLibrary' ? 'active' : ''}
            onClick={() => { setAdminSection('mediaLibrary'); setBrowserOpen(false); }}
          >
            <Image size={19} /><span><strong>Медиатека</strong><small>{mediaLibrary.length} картинок</small></span>
          </button>
          <button disabled><BarChart3 size={19} /><span><strong>Аналитика</strong><small>скоро</small></span></button>
          <button
            className={adminSection === 'settings' ? 'active' : ''}
            onClick={() => { setAdminSection('settings'); setBrowserOpen(false); }}
          >
            <Settings2 size={19} /><span><strong>Настройки</strong><small>S3 и база</small></span>
          </button>
        </aside>

        {adminSection === 'course' && browserOpen && (
          <aside className="admin-browser">
            <div className="admin-browser-head">
              <div className="admin-browser-head-top">
                {browserLevel !== 'modules'
                  ? <button className="admin-browser-back" onClick={backBrowser}><ChevronLeft size={18} /></button>
                  : <div className="admin-browser-icon"><FolderOpen size={18} /></div>}
                <div><span>Структура курса</span><strong>{browserTitle}</strong></div>
                <button className="admin-browser-add" onClick={addAtCurrentLevel}><Plus size={17} /></button>
              </div>
              {crumbs.length > 0 && <div className="admin-browser-crumbs">{crumbs.join(' / ')}</div>}
            </div>
            <div className="admin-browser-list">
              {browserItems.map(renderBrowserItem)}
              {!browserItems.length && <div className="admin-browser-empty">Здесь пока ничего нет.</div>}
            </div>
          </aside>
        )}

        <main className="admin-editor">
          {adminSection === 'voices' ? (
            <VoiceAdminPanel voices={voices} setVoices={setVoices} loading={voicesLoading} onSaveState={setSaveState} />
          ) : adminSection === 'audioDictionary' ? (
            <AudioDictionaryPanel
              entries={audioDictionary}
              setEntries={setAudioDictionary}
              loading={audioDictionaryLoading}
              onReload={loadAudioDictionary}
              onSaveState={setSaveState}
            />
          ) : adminSection === 'mediaLibrary' ? (
            <MediaLibraryPanel
              entries={mediaLibrary}
              setEntries={setMediaLibrary}
              loading={mediaLibraryLoading}
              onReload={loadMediaLibrary}
              onSaveState={setSaveState}
            />
          ) : adminSection === 'settings' ? (
            <StorageSettingsPanel
              settings={storageSettings}
              setSettings={setStorageSettings}
              loading={storageSettingsLoading}
              onReload={loadStorageSettings}
              onSaveState={setSaveState}
            />
          ) : loading ? (
            <div className="admin-loading"><Loader2 className="spin" /> Загружаем курс…</div>
          ) : lessonDraft ? (
            <>
              <div className="admin-editor-head">
                <div className="admin-editor-heading">
                  <div className="admin-editor-path">{crumbs.join(' / ')}</div>
                  <h1>{lessonDraft.title || 'Без названия'}</h1>
                  <p>Редактируй урок и задания. Озвучка берётся из аудиословаря, картинки — из общей медиатеки. Сохранение происходит автоматически.</p>
                </div>
                <div className="admin-editor-actions">
                  <button className="structure" onClick={() => { setBrowserOpen(true); setBrowserLevel('lessons'); }}><PanelLeftOpen size={17} /> Структура курса</button>
                  <button className="danger" onClick={() => deleteEntity('lessons', lessonDraft.id, lessonDraft.title)}><Trash2 size={16} /> Удалить урок</button>
                </div>
              </div>

              <section className="admin-editor-section">
                <div className="admin-editor-title">
                  <div><strong>Основные данные урока</strong><span>Карточка урока и его общая логика</span></div>
                </div>
                <div className="admin-form-grid">
                  <Field label="Позиция"><TextInput type="number" value={lessonDraft.position} onChange={value => setLessonDraft(draft => ({ ...draft, position: Number(value) }))} /></Field>
                  <Field label="Статус"><select value={lessonDraft.status} onChange={event => setLessonDraft(draft => ({ ...draft, status: event.target.value }))}><option value="ready">Готов</option><option value="outline">План</option></select></Field>
                  <Field label="Название" wide><TextInput value={lessonDraft.title} onChange={value => setLessonDraft(draft => ({ ...draft, title: value }))} /></Field>
                  <Field label="Тег 1"><TextInput value={lessonDraft.tagPrimary} onChange={value => setLessonDraft(draft => ({ ...draft, tagPrimary: value }))} /></Field>
                  <Field label="Тег 2"><TextInput value={lessonDraft.tagSecondary} onChange={value => setLessonDraft(draft => ({ ...draft, tagSecondary: value }))} /></Field>
                  <Field label="Описание" wide><TextArea rows={3} value={lessonDraft.description} onChange={value => setLessonDraft(draft => ({ ...draft, description: value }))} /></Field>
                  <Field label="Задача урока" wide><TextArea rows={3} value={lessonDraft.objective} onChange={value => setLessonDraft(draft => ({ ...draft, objective: value }))} /></Field>
                </div>
              </section>

              <LessonContentEditor draft={lessonDraft} setDraft={setLessonDraft} audioDictionary={audioDictionary} mediaLibrary={mediaLibrary} />
            </>
          ) : blockDraft ? (
            <>
              <div className="admin-editor-head">
                <div className="admin-editor-heading">
                  <div className="admin-editor-path">{selectedModule ? `Модуль ${selectedModule.position}` : ''}</div>
                  <h1>{blockDraft.title}</h1>
                  <p>Настройки блока. Уроки открываются через структуру курса слева.</p>
                </div>
                <div className="admin-editor-actions">
                  {!browserOpen && <button className="structure" onClick={() => { setBrowserOpen(true); setBrowserLevel('lessons'); }}><PanelLeftOpen size={17} /> Структура курса</button>}
                  <button className="danger" onClick={() => deleteEntity('blocks', blockDraft.id, blockDraft.title)}><Trash2 size={16} /> Удалить блок</button>
                </div>
              </div>
              <section className="admin-editor-section">
                <div className="admin-form-grid">
                  <Field label="Позиция"><TextInput type="number" value={blockDraft.position} onChange={value => setBlockDraft(draft => ({ ...draft, position: Number(value) }))} /></Field>
                  <Field label="Прогресс"><TextInput type="number" min="0" max="100" value={blockDraft.progress} onChange={value => setBlockDraft(draft => ({ ...draft, progress: Number(value) }))} /></Field>
                  <Field label="Название" wide><TextInput value={blockDraft.title} onChange={value => setBlockDraft(draft => ({ ...draft, title: value }))} /></Field>
                  <Field label="Ключ картинки" wide><TextInput value={blockDraft.imageKey} onChange={value => setBlockDraft(draft => ({ ...draft, imageKey: value }))} /></Field>
                </div>
              </section>
              <button className="admin-big-add" onClick={addLesson}><CirclePlus size={19} /> Добавить урок в этот блок</button>
            </>
          ) : moduleDraft ? (
            <>
              <div className="admin-editor-head">
                <div className="admin-editor-heading">
                  <div className="admin-editor-path">Модуль {moduleDraft.position}</div>
                  <h1>{moduleDraft.title}</h1>
                  <p>Основные данные модуля. Блоки открываются через структуру курса слева.</p>
                </div>
                <div className="admin-editor-actions">
                  {!browserOpen && <button className="structure" onClick={() => { setBrowserOpen(true); setBrowserLevel('blocks'); }}><PanelLeftOpen size={17} /> Структура курса</button>}
                  <button className="danger" onClick={() => deleteEntity('modules', moduleDraft.id, moduleDraft.title)}><Trash2 size={16} /> Удалить модуль</button>
                </div>
              </div>
              <section className="admin-editor-section">
                <div className="admin-form-grid">
                  <Field label="Позиция"><TextInput type="number" value={moduleDraft.position} onChange={value => setModuleDraft(draft => ({ ...draft, position: Number(value) }))} /></Field>
                  <Field label="Уровень"><TextInput value={moduleDraft.level} onChange={value => setModuleDraft(draft => ({ ...draft, level: value }))} /></Field>
                  <Field label="Название" wide><TextInput value={moduleDraft.title} onChange={value => setModuleDraft(draft => ({ ...draft, title: value }))} /></Field>
                  <Field label="Короткое название" wide><TextInput value={moduleDraft.shortTitle} onChange={value => setModuleDraft(draft => ({ ...draft, shortTitle: value }))} /></Field>
                  <Field label="Описание" wide><TextArea rows={4} value={moduleDraft.description} onChange={value => setModuleDraft(draft => ({ ...draft, description: value }))} /></Field>
                </div>
              </section>
              <button className="admin-big-add" onClick={addBlock}><CirclePlus size={19} /> Добавить блок в этот модуль</button>
            </>
          ) : (
            <div className="admin-empty-editor">
              <PanelLeftClose size={32} />
              <strong>Выбери объект в структуре курса</strong>
              <span>Слева открывай модуль → блок → урок. После выбора урока структура автоматически спрячется и редактор займёт почти весь экран.</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminApp;
