/* ============ STATE & STORAGE ============ */
const STORAGE_KEY = 'student-data';
let DATA = { lessons: [], homework: [], events: [], goals: [], summatives: [], notes: [], activityLog: [] };
let editingId = null;
let editingType = null;
let calDate = new Date();
let selectedDay = null;

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DOWS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const SUBJECTS = [
  'Математика','Физика','Химия','Биология','География',
  'Всемирная история','История Казахстана','Экономика',
  'Казахский язык и литература','Русский язык','Английский язык',
  'ИКТ','ИЗО','Физкультура'
];
let openSubjects = new Set();

/* ============ SCHEDULE (расписание) ============ */
const SCHED_TIMES = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00"];
const SCHED_DAY_KEYS = ["Пн","Вт","Ср","Чт","Пт"];

const SCHED_RUS = {
  "Mathematics":"Математика",
  "Physical and Health Education":"Физкультура",
  "Arts":"ИЗО",
  "Homeroom":"Шаңырақ",
  "English Language Acquisition":"Английский язык",
  "Kazakh Language and Literature":"Казахский язык и литература",
  "Information and communication technology":"ИКТ",
  "Chemistry":"Химия",
  "Physics":"Физика",
  "World History":"Всемирная история",
  "Economics":"Экономика",
  "Kazakh History":"История Казахстана",
  "Russian Language Acquisition":"Русский язык",
  "Biology":"Биология",
  "Geography":"География"
};

const SCHED_COLORS = {
  "Mathematics":"#e88fc7",
  "Physical and Health Education":"#e0a25e",
  "Arts":"#e0776e",
  "Homeroom":"#c9c46a",
  "English Language Acquisition":"#c9c46a",
  "Kazakh Language and Literature":"#e88fc7",
  "Information and communication technology":"#c9c46a",
  "Chemistry":"#e0a25e",
  "Physics":"#e0a25e",
  "World History":"#b7c96a",
  "Economics":"#d97a72",
  "Kazakh History":"#e88fc7",
  "Russian Language Acquisition":"#e0a25e",
  "Biology":"#e0a25e",
  "Geography":"#d97a72"
};

// кабинеты — как в школьном расписании; у остальных предметов кабинет не указан
const SCHED_ROOMS = {
  "Chemistry":"233",
  "Physics":"133",
  "Information and communication technology":"143",
  "Physical and Health Education":"Gym"
};

// SCHED_DATA[pattern][dayKey] = subject per SCHED_TIMES slot, in order
const SCHED_DATA = {
  A: {
    "Пн": ["Mathematics","Physical and Health Education","Arts","Homeroom","English Language Acquisition","Kazakh Language and Literature","Information and communication technology"],
    "Вт": ["Chemistry","Physics","Mathematics","Homeroom","Kazakh Language and Literature","English Language Acquisition","World History"],
    "Ср": ["Arts","Mathematics","Economics","Homeroom","Kazakh History","Russian Language Acquisition","Biology"],
    "Чт": ["Geography","Information and communication technology","Chemistry","Homeroom","Physical and Health Education","Mathematics","Physics"],
    "Пт": ["Russian Language Acquisition","Kazakh Language and Literature","English Language Acquisition","Homeroom","Kazakh History","Biology","Economics"]
  },
  B: {
    "Пн": ["Mathematics","Physical and Health Education","Arts","Homeroom","English Language Acquisition","Kazakh Language and Literature","Information and communication technology"],
    "Вт": ["Chemistry","Physics","Mathematics","Homeroom","Kazakh Language and Literature","English Language Acquisition","World History"],
    "Ср": ["Arts","Mathematics","Geography","Homeroom","Kazakh History","Russian Language Acquisition","Biology"],
    "Чт": ["Geography","Information and communication technology","Chemistry","Homeroom","Physical and Health Education","Mathematics","Physics"],
    "Пт": ["Russian Language Acquisition","Kazakh Language and Literature","English Language Acquisition","Homeroom","Kazakh History","Biology","Economics"]
  }
};

// a Monday known to be a pattern-"A" week — everything alternates from here automatically
const SCHED_ANCHOR_MONDAY = new Date(2026,8,14);

function schedGetMonday(d){
  const day = (d.getDay()+6)%7; // Monday=0
  const m = new Date(d);
  m.setHours(0,0,0,0);
  m.setDate(d.getDate()-day);
  return m;
}
function schedDateKey(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function schedPatternFor(monday){
  const diffDays = Math.round((monday - SCHED_ANCHOR_MONDAY)/(1000*60*60*24));
  const diffWeeks = Math.round(diffDays/7);
  return (((diffWeeks%2)+2)%2===0) ? 'A' : 'B';
}

let scheduleWeekMonday = schedGetMonday(new Date());

function schedShift(deltaWeeks){
  scheduleWeekMonday = new Date(scheduleWeekMonday);
  scheduleWeekMonday.setDate(scheduleWeekMonday.getDate()+7*deltaWeeks);
  renderSchedule();
}
function schedToday(){
  scheduleWeekMonday = schedGetMonday(new Date());
  renderSchedule();
}

function renderSchedule(){
  const grid = document.getElementById('sched-grid');
  const rangeEl = document.getElementById('sched-range');
  if(!grid || !rangeEl) return;

  const monday = scheduleWeekMonday;
  const pattern = schedPatternFor(monday);
  const days = SCHED_DAY_KEYS.map((key,i)=>{
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    return {key, date:d};
  });

  const first = days[0].date, last = days[4].date;
  const fmt = d => d.getDate()+' '+MONTHS[d.getMonth()].slice(0,3);
  rangeEl.textContent = fmt(first)+' — '+fmt(last);

  const today = schedDateKey(new Date());

  grid.innerHTML = '';
  grid.appendChild(document.createElement('div')).className='sched-corner';
  days.forEach(({key,date})=>{
    const h = document.createElement('div');
    h.className = 'sched-head' + (schedDateKey(date)===today ? ' is-today':'');
    h.innerHTML = `<div class="sched-head-day">${DOWS_FULL[key]}</div><div class="sched-head-date">${date.getDate()} ${MONTHS[date.getMonth()].slice(0,3)}</div>`;
    grid.appendChild(h);
  });

  SCHED_TIMES.forEach((time, slotIdx)=>{
    const tcell = document.createElement('div');
    tcell.className = 'sched-time';
    tcell.textContent = time;
    grid.appendChild(tcell);

    days.forEach(({key,date})=>{
      const subj = SCHED_DATA[pattern][key][slotIdx];
      const rus = SCHED_RUS[subj] || subj;
      const isHomeroom = subj === 'Homeroom';
      const dateStr = schedDateKey(date);
      const cell = document.createElement('div');
      cell.className = 'sched-cell' + (isHomeroom ? ' homeroom':'');
      if(!isHomeroom) cell.style.background = hexToRgba(SCHED_COLORS[subj]||'#888', 0.16);
      if(!isHomeroom) cell.style.borderLeft = '3px solid ' + (SCHED_COLORS[subj]||'#888');

      const hw = DATA.homework.filter(h => h.subject===rus && h.due===dateStr);
      const sor = DATA.summatives.filter(s => s.subject===rus && s.due===dateStr);

      const subjEl = document.createElement('div');
      subjEl.className = 'sched-subj';
      subjEl.textContent = rus;
      cell.appendChild(subjEl);

      const room = SCHED_ROOMS[subj];
      if(room){
        const roomEl = document.createElement('div');
        roomEl.className = 'sched-room';
        roomEl.textContent = room;
        cell.appendChild(roomEl);
      }

      [...sor, ...hw].forEach(item=>{
        const isSor = sor.includes(item);
        const tag = document.createElement('div');
        tag.className = 'sched-tag' + (isSor?' sor':'') + (item.done?' done':'');
        tag.textContent = (isSor ? 'СОР · ' : '') + item.title;
        tag.title = isSor ? 'Открыть суммативку' : 'Отметить сделанным';
        tag.addEventListener('click', (e)=>{
          e.stopPropagation();
          if(isSor){ openModal('summatives', item.id); }
          else { toggleDone('homework', item.id, e); }
        });
        cell.appendChild(tag);
      });

      if(!isHomeroom){
        cell.addEventListener('click', (e)=>{
          if(e.target.closest('.sched-tag')) return;
          openModal('homework', null, {subject:rus, due:dateStr});
        });
      }
      grid.appendChild(cell);
    });
  });
}

function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const DOWS_FULL = {"Пн":"Понедельник","Вт":"Вторник","Ср":"Среда","Чт":"Четверг","Пт":"Пятница"};

/* Суммативки, которые уже стоят в школьном расписании.
   Список сверяется со школьным приложением: при новой версии записи,
   которых там больше нет, убираются, а недостающие добавляются.
   Всё, что ты уже отметил, оценил или подписал, остаётся нетронутым. */
const OFFICIAL_SUMMATIVES = [
  ['Математика',                  '2026-09-15'],
  ['ИЗО',                         '2026-09-16'],
  ['ИКТ',                         '2026-09-17'],

  ['Физкультура',                 '2026-09-24'],
  ['География',                   '2026-09-24'],
  ['Казахский язык и литература', '2026-09-25'],
  ['История Казахстана',          '2026-09-25'],
  ['Английский язык',             '2026-09-25'],

  ['Химия',                       '2026-09-29'],
  ['Физкультура',                 '2026-10-01'],

  ['Математика',                  '2026-10-07'],
  ['ИЗО',                         '2026-10-07'],
  ['Русский язык',                '2026-10-07'],
  ['Физкультура',                 '2026-10-08'],
  ['Физика',                      '2026-10-08'],
  ['Экономика',                   '2026-10-09'],
  ['Биология',                    '2026-10-09'],

  ['Казахский язык и литература', '2026-10-12'],
  ['Математика',                  '2026-10-13'],
  ['Химия',                       '2026-10-13'],
  ['Всемирная история',           '2026-10-13'],
  ['Физика',                      '2026-10-15'],
  ['ИКТ',                         '2026-10-15'],

  ['ИЗО',                         '2026-10-19'],
  ['Английский язык',             '2026-10-20'],
  ['ИЗО',                         '2026-10-21'],
  ['ИКТ',                         '2026-10-22'],
  ['География',                   '2026-10-22'],
  ['Биология',                    '2026-10-23']
];

/* то, что добавляли прошлые версии списка — только эти записи можно убирать
   при сверке, чтобы не задеть добавленные вручную */
const PREVIOUS_AUTO_SUMMATIVES = [
  ['Математика','2026-09-15'], ['ИЗО','2026-09-16'], ['ИКТ','2026-09-17'],
  ['Физкультура','2026-09-24'], ['География','2026-09-24'],
  ['Казахский язык и литература','2026-09-25'], ['История Казахстана','2026-09-25'],
  ['Химия','2026-09-29'], ['Физкультура','2026-10-01'], ['Экономика','2026-10-02'],
  ['Математика','2026-10-07'], ['ИЗО','2026-10-07'], ['Русский язык','2026-10-07'],
  ['Физкультура','2026-10-08'], ['Физика','2026-10-08'],
  ['Казахский язык и литература','2026-10-12'], ['Математика','2026-10-13'],
  ['Химия','2026-10-13'], ['Физика','2026-10-15'], ['ИКТ','2026-10-15'],
  ['ИЗО','2026-10-19'], ['ИЗО','2026-10-21'], ['ИКТ','2026-10-22'], ['География','2026-10-22']
];

const SUMM_SYNC_KEY = 'summatives-synced-version';
const SUMM_SYNC_VERSION = 3;

function summKey(subject, due){ return (subject||'') + '|' + (due||''); }
function summTouched(item){
  return item.done
    || (item.score !== null && item.score !== undefined && item.score !== '')
    || String(item.notes||'').trim() !== ''
    || item.title !== 'Суммативная работа';
}

function syncOfficialSummatives(){
  if(Number(localStorage.getItem(SUMM_SYNC_KEY)||0) >= SUMM_SYNC_VERSION) return;

  const official = new Set(OFFICIAL_SUMMATIVES.map(([subj,due]) => summKey(subj,due)));
  const wasAuto  = new Set(PREVIOUS_AUTO_SUMMATIVES.map(([subj,due]) => summKey(subj,due)));

  // убираем то, что раньше добавилось автоматически, а в расписании больше не стоит
  DATA.summatives = DATA.summatives.filter(item=>{
    const key = summKey(item.subject, item.due);
    if(official.has(key)) return true;
    const auto = item.source === 'schedule' || wasAuto.has(key);
    return !auto || summTouched(item);
  });

  const present = new Set(DATA.summatives.map(item => summKey(item.subject, item.due)));
  OFFICIAL_SUMMATIVES.forEach(([subject, due])=>{
    if(present.has(summKey(subject, due))) return;
    present.add(summKey(subject, due));
    DATA.summatives.push({
      id: uid(), subject, due, title: 'Суммативная работа', kind: 'sor',
      score: null, maxScore: 100, notes: '', done: false,
      source: 'schedule', createdAt: Date.now()
    });
  });

  localStorage.setItem(SUMM_SYNC_KEY, String(SUMM_SYNC_VERSION));
  localStorage.removeItem('seeded-sor-v1');
  localStorage.removeItem('seeded-sor-v2');
  saveData();
}

/* move any legacy homework items (old 'kind: sor' scheme) into the dedicated summatives list, once */
function migrateLegacySummatives(){
  const legacy = DATA.homework.filter(h=>h.kind==='sor');
  if(legacy.length===0) return;
  legacy.forEach(h=>{
    DATA.summatives.push({
      id: h.id, subject: h.subject||'', title: h.title||'Суммативная работа',
      kind: 'sor', due: h.due||'', score: null, maxScore: 100,
      notes: h.notes||'', done: !!h.done, createdAt: h.createdAt||Date.now()
    });
  });
  DATA.homework = DATA.homework.filter(h=>h.kind!=='sor');
  saveData();
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

async function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      DATA = Object.assign({lessons:[],homework:[],events:[],goals:[],summatives:[],notes:[],activityLog:[]}, parsed);
      if(!Array.isArray(DATA.summatives)) DATA.summatives = [];
      if(!Array.isArray(DATA.notes)) DATA.notes = [];
      if(!Array.isArray(DATA.activityLog)) DATA.activityLog = [];
    }
  }catch(e){
    console.log('Сохранённых данных нет, начинаем с пустого', e);
  }
  migrateLegacySummatives();
  syncOfficialSummatives();
  renderAll();
  updateSubjectsDatalist();
}

async function saveData(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
    flashSaved();
  }catch(e){
    console.error('Ошибка сохранения', e);
  }
}

function flashSaved(){
  const el = document.getElementById('save-indicator');
  if(!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

/* ---- локальный бэкап: экспорт/импорт JSON-файла ---- */
function exportBackup(){
  const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `moy-organayzer-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      DATA = Object.assign({lessons:[],homework:[],events:[],goals:[],summatives:[],notes:[],activityLog:[]}, parsed);
      if(!Array.isArray(DATA.summatives)) DATA.summatives = [];
      if(!Array.isArray(DATA.notes)) DATA.notes = [];
      if(!Array.isArray(DATA.activityLog)) DATA.activityLog = [];
      migrateLegacySummatives();
      saveData();
      renderAll();
      if(document.querySelector('.tab-btn[data-view="calendar"]').classList.contains('active')) renderCalendar();
    }catch(e){
      alert('Не получилось прочитать файл копии: ' + e.message);
    }
  };
  reader.readAsText(file);
}

/* ============ NAV ============ */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    if(btn.dataset.view === 'calendar') renderCalendar();
    if(btn.dataset.view === 'schedule') renderSchedule();
    closeMobileNav();
  });
});

/* ============ MOBILE NAV DRAWER ============ */
function openMobileNav(){
  document.getElementById('tabs').classList.add('open');
  document.getElementById('nav-scrim').classList.add('open');
}
function closeMobileNav(){
  document.getElementById('tabs').classList.remove('open');
  document.getElementById('nav-scrim').classList.remove('open');
}

/* ============ DASHBOARD ============ */
function greetTime(){
  const h = new Date().getHours();
  if(h < 6) return 'Доброй ночи';
  if(h < 12) return 'Доброе утро';
  if(h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function renderDashboard(){
  document.getElementById('greeting').textContent = greetTime();
  const now = new Date();
  document.getElementById('today-str').textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
  document.getElementById('today-badge').textContent = now.getDate() + ' ' + MONTHS[now.getMonth()];
  const streakEl = document.getElementById('streak-badge');
  if(streakEl) streakEl.textContent = computeStreak() + ' дн. подряд';

  document.getElementById('s-lessons').textContent = DATA.lessons.length;
  const hwLeft = DATA.homework.filter(h=>!h.done).length;
  document.getElementById('s-homework').textContent = hwLeft;
  const summUpcoming = DATA.summatives.filter(s=>!s.done && (!s.due || new Date(s.due) >= new Date(now.toDateString()))).length;
  document.getElementById('s-summatives').textContent = summUpcoming;
  const gradeStats = summativeStats();
  document.getElementById('s-avg-grade').textContent = gradeStats.overall!=null ? gradeStats.overall+'%' : '—';
  const evUpcoming = DATA.events.filter(e=> !e.date || new Date(e.date) >= new Date(now.toDateString())).length;
  document.getElementById('s-events').textContent = evUpcoming;
  const goalsActive = DATA.goals.filter(g=>(g.progress||0) < 100).length;
  document.getElementById('s-goals').textContent = goalsActive;

  // upcoming list: merge homework+summatives+events with dates, sorted, next 5
  let items = [];
  DATA.homework.filter(h=>!h.done && h.due).forEach(h=> items.push({date:h.due, title:h.title, sub:h.subject||'домашка', kind:'hw'}));
  DATA.summatives.filter(s=>!s.done && s.due).forEach(s=> items.push({date:s.due, title:s.title, sub:(s.kind==='soch'?'СОЧ':'СОР')+(s.subject?' · '+s.subject:''), kind:'sor'}));
  DATA.events.filter(e=>e.date).forEach(e=> items.push({date:e.date, title:e.title, sub:e.type||'мероприятие', kind:'ev'}));
  items = items.filter(i => new Date(i.date) >= new Date(now.toDateString()));
  items.sort((a,b)=> new Date(a.date) - new Date(b.date));
  items = items.slice(0,5);

  const list = document.getElementById('upcoming-list');
  list.innerHTML = '';
  if(items.length === 0){
    list.innerHTML = '<div class="empty-note">На ближайшие дни ничего не назначено.</div>';
  } else {
    items.forEach(i=>{
      const d = new Date(i.date);
      const el = document.createElement('div');
      el.className = 'upcoming-item';
      el.innerHTML = `<div class="u-date">${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}</div>
        <div><div class="u-title">${escapeHtml(i.title)}</div><div class="u-sub">${escapeHtml(i.sub)}</div></div>`;
      list.appendChild(el);
    });
  }

  renderOrbit();
}

function renderOrbit(){
  const svg = document.getElementById('orbit-svg');
  const cx=150, cy=150;
  const rings = [
    {r:56, color:'var(--tab1)', items: DATA.homework.filter(h=>!h.done).slice(0,8)},
    {r:84, color:'var(--brick)', items: DATA.summatives.filter(s=>!s.done).slice(0,10)},
    {r:112, color:'var(--tab4)', items: DATA.events.slice(0,10)},
    {r:140, color:'var(--tab2)', items: DATA.goals.filter(g=>(g.progress||0)<100).slice(0,12)}
  ];
  let svgContent = `<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--gold)"/>`;
  rings.forEach((ring, ringIdx)=>{
    svgContent += `<circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 4"/>`;
    const n = Math.max(ring.items.length, 1);
    const dur = 26 + ringIdx*10;
    const dir = ringIdx % 2 === 0 ? 'normal' : 'reverse';
    svgContent += `<g>`;
    if(ring.items.length){
      ring.items.forEach((it, idx)=>{
        const angleOffset = (360/n) * idx;
        svgContent += `<g transform="rotate(${angleOffset} ${cx} ${cy})">
          <circle cx="${cx}" cy="${cy-ring.r}" r="4" fill="${ring.color}">
            <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="${dir==='normal'?360:-360} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>
          </circle>
        </g>`;
      });
    }
    svgContent += `</g>`;
  });
  svg.innerHTML = svgContent;
}

/* ============ LIST RENDERERS ============ */
function fmtDate(d){
  if(!d) return '';
  const dt = new Date(d);
  return dt.getDate() + ' ' + MONTHS[dt.getMonth()];
}

function isOverdue(dateStr, done){
  if(!dateStr || done) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(dateStr) < today;
}

function renderLessons(){
  const wrap = document.getElementById('list-lessons');
  wrap.innerHTML = '';
  if(DATA.lessons.length===0){ wrap.innerHTML = '<div class="empty-note">Уроков пока нет.</div>'; return; }
  DATA.lessons.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <span></span>
      <div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.teacher||'')}${item.schedule? ' · '+escapeHtml(item.schedule):''}</div></div>
      <span class="tag">${escapeHtml(item.room||'')}</span>
      <div class="row-actions">
        <button class="icon-btn" aria-label="Изменить" onclick="openModal('lessons','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
        <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('lessons','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>`;
    wrap.appendChild(row);
  });
}

function renderHomework(){
  renderHwFilterOptions();
  const wrap = document.getElementById('list-homework');
  wrap.innerHTML = '';
  const filtered = hwFilterSubject === 'all' ? DATA.homework : DATA.homework.filter(h => (h.subject||'') === hwFilterSubject);
  if(filtered.length===0){
    wrap.innerHTML = hwFilterSubject === 'all'
      ? '<div class="empty-note">Домашки нет.</div>'
      : '<div class="empty-note">По этому предмету ничего не записано.</div>';
    return;
  }
  const sorted = [...filtered].sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due||0) - new Date(b.due||0);
  });
  sorted.forEach(item=>{
    const overdue = isOverdue(item.due, item.done);
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}', event)"></div>
      <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.subject||'')}</div></div>
      ${priorityTagHtml(item.priority)}
      <span class="tag ${overdue?'overdue':''}">${item.due? fmtDate(item.due) : '—'}</span>
      <div class="row-actions">
        <button class="icon-btn" aria-label="Изменить" onclick="openModal('homework','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
        <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('homework','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>`;
    wrap.appendChild(row);
  });
}

function priorityTagHtml(priority){
  if(priority === 'high') return '<span class="tag priority-high">Высокий</span>';
  if(priority === 'low') return '<span class="tag priority-low">Низкий</span>';
  return '<span></span>';
}

/* ============ SUBJECTS ============ */
function subjectGroups(){
  const used = new Set([...DATA.homework.map(h=>h.subject), ...DATA.summatives.map(s=>s.subject)].filter(Boolean));
  const list = [...SUBJECTS];
  used.forEach(s=>{ if(!list.includes(s)) list.push(s); });
  return list;
}

let hwFilterSubject = 'all';
function setHwFilter(val){
  hwFilterSubject = val;
  renderHomework();
}
function renderHwFilterOptions(){
  const sel = document.getElementById('hw-subject-filter');
  if(!sel) return;
  const prev = hwFilterSubject;
  sel.innerHTML = '<option value="all">Все предметы</option>' +
    subjectGroups().map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  sel.value = prev;
  if(sel.value !== prev){ sel.value = 'all'; hwFilterSubject = 'all'; }
}

let selectedSubject = null;

function renderSubjects(){
  const panel = document.getElementById('subject-panel');
  const detail = document.getElementById('subject-detail');
  if(!panel || !detail) return;

  const groups = subjectGroups();
  if(!selectedSubject || !groups.includes(selectedSubject)) selectedSubject = groups[0] || null;

  let totalOpen = 0;
  panel.innerHTML = '';
  groups.forEach(subj=>{
    const openCount = DATA.homework.filter(h=>h.subject===subj && !h.done).length
      + DATA.summatives.filter(s=>s.subject===subj && !s.done).length;
    totalOpen += openCount;
    const btn = document.createElement('button');
    btn.className = 'subject-pill' + (subj===selectedSubject ? ' active':'');
    btn.innerHTML = `${escapeHtml(subj)}${openCount ? `<span class="subject-pill-count">${openCount}</span>` : ''}`;
    btn.addEventListener('click', ()=>{ selectedSubject = subj; renderSubjects(); });
    panel.appendChild(btn);
  });

  const cnt = document.getElementById('cnt-subjects');
  if(cnt) cnt.textContent = totalOpen;

  detail.innerHTML = '';
  if(!selectedSubject){
    detail.innerHTML = '<div class="empty-note">Пока нет предметов.</div>';
    return;
  }

  const items = DATA.homework.filter(h=>h.subject===selectedSubject)
    .sort((a,b)=>{ if(a.done!==b.done) return a.done?1:-1; return new Date(a.due||0)-new Date(b.due||0); });

  const head = document.createElement('div');
  head.className = 'subject-detail-head';
  head.innerHTML = `<h3>${escapeHtml(selectedSubject)}</h3>`;
  const addBtn = document.createElement('button');
  addBtn.className = 'add-btn';
  addBtn.textContent = '+ добавить в ' + selectedSubject;
  addBtn.addEventListener('click', ()=> openModal('homework', null, {subject:selectedSubject}));
  head.appendChild(addBtn);
  detail.appendChild(head);

  const body = document.createElement('div');
  body.className = 'ledger';
  if(items.length === 0){
    body.innerHTML = '<div class="empty-note">Домашки по этому предмету нет.</div>';
  } else {
    items.forEach(item=>{
      const overdue = isOverdue(item.due, item.done);
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}', event); renderSubjects();"></div>
        <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
          ${item.notes? `<div class="item-meta">${escapeHtml(item.notes)}</div>` : ''}</div>
        ${priorityTagHtml(item.priority)}
        <span class="tag ${overdue?'overdue':''}">${item.due? fmtDate(item.due) : '—'}</span>
        <div class="row-actions">
          <button class="icon-btn" aria-label="Изменить" onclick="openModal('homework','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
          <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('homework','${item.id}'); renderSubjects();"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>`;
      body.appendChild(row);
    });
  }
  detail.appendChild(body);

  const summItems = DATA.summatives.filter(s=>s.subject===selectedSubject)
    .sort((a,b)=>{ if(a.done!==b.done) return a.done?1:-1; return new Date(a.due||0)-new Date(b.due||0); });

  const summHead = document.createElement('div');
  summHead.className = 'subject-detail-head';
  summHead.style.marginTop = '22px';
  summHead.innerHTML = `<h3 style="font-size:15px">Суммативки</h3>`;
  const summAddBtn = document.createElement('button');
  summAddBtn.className = 'add-btn';
  summAddBtn.textContent = '+ суммативка';
  summAddBtn.addEventListener('click', ()=> openModal('summatives', null, {subject:selectedSubject}));
  summHead.appendChild(summAddBtn);
  detail.appendChild(summHead);

  const summBody = document.createElement('div');
  summBody.className = 'ledger';
  if(summItems.length === 0){
    summBody.innerHTML = '<div class="empty-note">Суммативок по этому предмету нет.</div>';
  } else {
    summItems.forEach(item=>{
      summBody.appendChild(makeRow(summativeRowHtml(item, {hideSubject:true, afterToggle:'renderSubjects();', afterDelete:'renderSubjects();'})));
    });
  }
  detail.appendChild(summBody);
}

function renderEvents(){
  const wrap = document.getElementById('list-events');
  wrap.innerHTML = '';
  if(DATA.events.length===0){ wrap.innerHTML = '<div class="empty-note">Мероприятий пока нет.</div>'; return; }
  const sorted = [...DATA.events].sort((a,b)=> new Date(a.date||0) - new Date(b.date||0));
  sorted.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <span></span>
      <div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.type||'')}${item.link? ' · ссылка сохранена':''}</div></div>
      <span class="tag">${item.date? fmtDate(item.date): '—'}</span>
      <div class="row-actions">
        <button class="icon-btn" aria-label="Изменить" onclick="openModal('events','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
        <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('events','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>`;
    wrap.appendChild(row);
  });
}

function renderGoals(){
  const wrap = document.getElementById('list-goals');
  wrap.innerHTML = '';
  if(DATA.goals.length===0){ wrap.innerHTML = '<div class="empty-note">Целей пока нет.</div>'; return; }
  DATA.goals.forEach(item=>{
    const pct = Math.max(0, Math.min(100, item.progress||0));
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-top">
        <div>
          <div class="goal-title">${escapeHtml(item.title)}</div>
          ${item.desc? `<div class="goal-desc">${escapeHtml(item.desc)}</div>`:''}
        </div>
        <div class="row-actions">
          <button class="icon-btn" aria-label="Изменить" onclick="openModal('goals','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
          <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('goals','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
      </div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      <div class="goal-pct">${pct}%</div>`;
    wrap.appendChild(card);
  });
}

/* ============ SUMMATIVES (СОР/СОЧ) ============ */
function makeRow(html){
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = html;
  return row;
}

function summativeStats(){
  const withScore = DATA.summatives.filter(s=> s.score!=null && s.score!=='' && s.maxScore);
  let overall = null;
  if(withScore.length){
    const totalPct = withScore.reduce((acc,s)=> acc + (Number(s.score)/Number(s.maxScore))*100, 0);
    overall = Math.round(totalPct/withScore.length);
  }
  const bySubjectMap = {};
  withScore.forEach(s=>{
    const subj = s.subject || 'Без предмета';
    if(!bySubjectMap[subj]) bySubjectMap[subj] = [];
    bySubjectMap[subj].push((Number(s.score)/Number(s.maxScore))*100);
  });
  const bySubject = Object.keys(bySubjectMap).map(subj=>({
    subject: subj,
    avg: Math.round(bySubjectMap[subj].reduce((a,b)=>a+b,0)/bySubjectMap[subj].length),
    count: bySubjectMap[subj].length
  })).sort((a,b)=> a.avg-b.avg);
  return {overall, bySubject, total: DATA.summatives.length, withScoreCount: withScore.length};
}

function summativeRowHtml(item, opts){
  opts = opts || {};
  const overdue = isOverdue(item.due, item.done);
  const hasScore = item.score!=null && item.score!=='' && item.maxScore;
  const pct = hasScore ? Math.round((Number(item.score)/Number(item.maxScore))*100) : null;
  const kindLabel = item.kind === 'soch' ? 'СОЧ' : 'СОР';
  const gradeTagClass = 'tag sor' + (pct!=null && pct<50 ? ' lowgrade' : '');
  const metaText = opts.hideSubject ? (item.notes ? escapeHtml(item.notes) : '') : escapeHtml(item.subject||'');
  return `
    <div class="check ${item.done?'done':''}" onclick="toggleDone('summatives','${item.id}', event); ${opts.afterToggle||''}"></div>
    <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
      <div class="item-meta">${metaText}</div></div>
    <span class="${gradeTagClass}">${kindLabel}${hasScore? ' · '+escapeHtml(String(item.score))+'/'+escapeHtml(String(item.maxScore))+' ('+pct+'%)' : ' · без оценки'}</span>
    <span class="tag ${overdue?'overdue':''}">${item.due? fmtDate(item.due) : '—'}</span>
    <div class="row-actions">
      <button class="icon-btn" aria-label="Изменить" onclick="openModal('summatives','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
      <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('summatives','${item.id}'); ${opts.afterDelete||''}"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </div>`;
}

let summFilterSubject = 'all';
function setSummFilter(val){
  summFilterSubject = val;
  renderSummatives();
}
function renderSummFilterOptions(){
  const sel = document.getElementById('summ-subject-filter');
  if(!sel) return;
  const prev = summFilterSubject;
  sel.innerHTML = '<option value="all">Все предметы</option>' +
    subjectGroups().map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  sel.value = prev;
  if(sel.value !== prev){ sel.value = 'all'; summFilterSubject = 'all'; }
}

function renderSummatives(){
  renderSummFilterOptions();

  const statsWrap = document.getElementById('summ-stats');
  if(statsWrap){
    const stats = summativeStats();
    statsWrap.innerHTML = `
      <div class="summ-stat-card">
        <div class="summ-stat-label">Средний балл</div>
        <div class="summ-stat-value">${stats.overall!=null? stats.overall+'%' : '—'}</div>
        <div class="summ-stat-sub">${stats.withScoreCount} из ${stats.total} оценено</div>
      </div>
      <div class="summ-subject-list">
        ${stats.bySubject.length ? stats.bySubject.map(s=>`<div class="summ-subject-pill${s.avg<50?' low':''}"><span>${escapeHtml(s.subject)}</span><b>${s.avg}%</b></div>`).join('') : '<div class="empty-note" style="padding:14px 16px">Баллов пока нет. Впиши их, когда получишь результат.</div>'}
      </div>`;
  }

  const wrap = document.getElementById('list-summatives');
  if(!wrap) return;
  wrap.innerHTML = '';
  const filtered = summFilterSubject === 'all' ? DATA.summatives : DATA.summatives.filter(s => (s.subject||'') === summFilterSubject);
  if(filtered.length===0){
    wrap.innerHTML = summFilterSubject === 'all'
      ? '<div class="empty-note">Суммативок пока нет.</div>'
      : '<div class="empty-note">По этому предмету суммативок нет.</div>';
    return;
  }
  const sorted = [...filtered].sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due||0) - new Date(b.due||0);
  });
  sorted.forEach(item=>{
    wrap.appendChild(makeRow(summativeRowHtml(item)));
  });
}

/* ============ NOTES (Заметки) ============ */
function renderNotes(){
  const wrap = document.getElementById('list-notes');
  if(!wrap) return;
  wrap.innerHTML = '';
  if(DATA.notes.length===0){ wrap.innerHTML = '<div class="empty-note">Заметок пока нет.</div>'; return; }
  const sorted = [...DATA.notes].sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  sorted.forEach(item=>{
    const card = document.createElement('div');
    card.className = 'goal-card note-card';
    card.innerHTML = `
      <div class="goal-top">
        <div>
          <div class="goal-title">${escapeHtml(item.title)}</div>
          ${item.text? `<div class="goal-desc">${escapeHtml(item.text)}</div>`:''}
        </div>
        <div class="row-actions">
          <button class="icon-btn" aria-label="Изменить" onclick="openModal('notes','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
          <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('notes','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>
      </div>`;
    wrap.appendChild(card);
  });
}

function renderCounts(){
  document.getElementById('cnt-lessons').textContent = DATA.lessons.length;
  document.getElementById('cnt-homework').textContent = DATA.homework.filter(h=>!h.done).length;
  document.getElementById('cnt-summatives').textContent = DATA.summatives.filter(s=>!s.done).length;
  document.getElementById('cnt-events').textContent = DATA.events.length;
  document.getElementById('cnt-goals').textContent = DATA.goals.filter(g=>(g.progress||0)<100).length;
  document.getElementById('cnt-notes').textContent = DATA.notes.length;
}

function renderAll(){
  renderDashboard();
  renderSchedule();
  renderLessons();
  renderSubjects();
  renderHomework();
  renderSummatives();
  renderEvents();
  renderGoals();
  renderNotes();
  renderCounts();
  renderCalendar();
}

/* ============ CRUD ============ */
function toggleDone(type, id, evt){
  const it = DATA[type].find(x=>x.id===id);
  if(!it) return;
  it.done = !it.done;
  if(it.done){
    logActivity();
    if(evt && evt.currentTarget) burstConfetti(evt.currentTarget);
  }
  saveData();
  renderAll();
}

/* ============ STREAK & CELEBRATION ============ */
function logActivity(){
  const key = schedDateKey(new Date());
  if(!DATA.activityLog.includes(key)) DATA.activityLog.push(key);
}

function computeStreak(){
  const set = new Set(DATA.activityLog);
  const cursor = new Date(); cursor.setHours(0,0,0,0);
  if(!set.has(schedDateKey(cursor))) cursor.setDate(cursor.getDate()-1);
  let streak = 0;
  while(set.has(schedDateKey(cursor))){
    streak++;
    cursor.setDate(cursor.getDate()-1);
  }
  return streak;
}

const CONFETTI_COLORS = ['var(--gold)','var(--tab4)','var(--tab1)','var(--sage)','var(--tab7)'];
function burstConfetti(el){
  if(!el || !el.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
  for(let i=0;i<10;i++){
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = cx+'px';
    p.style.top = cy+'px';
    p.style.setProperty('--dx', (Math.random()*130-65)+'px');
    p.style.setProperty('--dy', (Math.random()*-100-30)+'px');
    p.style.setProperty('--rot', (Math.random()*360)+'deg');
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    document.body.appendChild(p);
    p.addEventListener('animationend', ()=>p.remove());
  }
}

function deleteItem(type, id){
  DATA[type] = DATA[type].filter(x=>x.id!==id);
  saveData();
  renderAll();
}

const FIELD_DEFS = {
  lessons: [
    {key:'title', label:'Предмет', type:'text', required:true},
    {key:'teacher', label:'Преподаватель', type:'text'},
    {key:'schedule', label:'Расписание (напр. Пн, Ср 14:00)', type:'text'},
    {key:'room', label:'Кабинет / ссылка', type:'text'}
  ],
  homework: [
    {key:'title', label:'Задание', type:'text', required:true},
    {key:'subject', label:'Предмет', type:'text', list:'subjects-datalist'},
    {key:'priority', label:'Приоритет', type:'select', options:[{value:'normal',label:'Обычный'},{value:'high',label:'Высокий'},{value:'low',label:'Низкий'}], default:'normal'},
    {key:'due', label:'Срок сдачи', type:'date'},
    {key:'notes', label:'Заметки', type:'textarea'}
  ],
  summatives: [
    {key:'subject', label:'Предмет', type:'text', list:'subjects-datalist', required:true},
    {key:'title', label:'Название', type:'text', required:true},
    {key:'kind', label:'Тип работы', type:'select', options:[{value:'sor',label:'СОР (за раздел)'},{value:'soch',label:'СОЧ (за четверть)'}], default:'sor'},
    {key:'due', label:'Дата', type:'date'},
    {key:'score', label:'Балл (получено)', type:'number'},
    {key:'maxScore', label:'Балл (максимум)', type:'number', default:100},
    {key:'notes', label:'Заметки', type:'textarea'}
  ],
  events: [
    {key:'title', label:'Название', type:'text', required:true},
    {key:'type', label:'Тип (хакатон / олимпиада / встреча)', type:'text'},
    {key:'date', label:'Дата', type:'date'},
    {key:'link', label:'Ссылка', type:'text'}
  ],
  goals: [
    {key:'title', label:'Цель', type:'text', required:true},
    {key:'desc', label:'Описание', type:'textarea'},
    {key:'progress', label:'Прогресс, %', type:'number'}
  ],
  notes: [
    {key:'title', label:'Заголовок', type:'text', required:true},
    {key:'text', label:'Текст', type:'textarea'}
  ]
};

const TITLES = {lessons:'урок', homework:'задание', summatives:'суммативка', events:'событие', goals:'цель', notes:'заметка'};

function openModal(type, id, prefill){
  editingType = type;
  editingId = id || null;
  const existing = id ? DATA[type].find(x=>x.id===id) : null;
  const fields = FIELD_DEFS[type];
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>${existing? 'Изменить' : 'Добавить'} — ${TITLES[type]}</h3>` +
    fields.map(f=>{
      let val;
      if(existing){ val = existing[f.key] ?? ''; }
      else if(prefill && prefill[f.key] !== undefined){ val = prefill[f.key]; }
      else { val = f.default !== undefined ? f.default : ''; }
      if(f.type === 'textarea'){
        return `<div class="field"><label>${f.label}</label><textarea data-key="${f.key}">${escapeHtml(val)}</textarea></div>`;
      }
      if(f.type === 'select'){
        const opts = f.options.map(o=>`<option value="${escapeHtml(o.value)}" ${o.value===val?'selected':''}>${escapeHtml(o.label)}</option>`).join('');
        return `<div class="field"><label>${f.label}</label><select data-key="${f.key}">${opts}</select></div>`;
      }
      const listAttr = f.list ? ` list="${f.list}"` : '';
      return `<div class="field"><label>${f.label}</label><input data-key="${f.key}" type="${f.type}"${listAttr} value="${escapeHtml(String(val))}"></div>`;
    }).join('') +
    `<div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="submitModal()">Сохранить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
  updateSubjectsDatalist();
}

function updateSubjectsDatalist(){
  const dl = document.getElementById('subjects-datalist');
  if(!dl) return;
  dl.innerHTML = SUBJECTS.map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');
}

function closeModal(){
  document.getElementById('overlay').classList.remove('open');
  editingId = null; editingType = null;
}

function submitModal(){
  const box = document.getElementById('modal-box');
  const inputs = box.querySelectorAll('[data-key]');
  const obj = editingId ? DATA[editingType].find(x=>x.id===editingId) : {id: uid(), done:false, createdAt: Date.now()};
  inputs.forEach(inp=>{
    let v = inp.value;
    if(inp.type === 'number') v = Number(v)||0;
    obj[inp.dataset.key] = v;
  });
  if(!obj.title || String(obj.title).trim()===''){ return; }
  if(!editingId){ DATA[editingType].push(obj); }
  saveData();
  renderAll();
  closeModal();
}

document.getElementById('overlay').addEventListener('click', (e)=>{
  if(e.target.id === 'overlay') closeModal();
});
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape') closeModal();
});

/* ============ CALENDAR ============ */
function dayItemsFor(dateObj){
  const ds = dateObj.toDateString();
  const hw = DATA.homework.filter(h=>h.due && new Date(h.due).toDateString()===ds);
  const summ = DATA.summatives.filter(s=>s.due && new Date(s.due).toDateString()===ds);
  const ev = DATA.events.filter(e=>e.date && new Date(e.date).toDateString()===ds);
  return {hw, summ, ev};
}

function renderCalendar(){
  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  document.getElementById('cal-month-label').textContent = MONTHS_NOM[m] + ' ' + y;

  const grid = document.getElementById('cal-grid');
  grid.classList.remove('cal-fade'); void grid.offsetWidth; grid.classList.add('cal-fade');
  grid.innerHTML = '';
  DOWS.forEach(d=>{
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstOfMonth = new Date(y, m, 1);
  let startWeekday = firstOfMonth.getDay(); // 0=Sun
  startWeekday = (startWeekday === 0) ? 6 : startWeekday - 1; // Monday=0
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();

  const today = new Date();
  const cells = [];
  for(let i=0;i<startWeekday;i++){
    const dayNum = daysInPrevMonth - startWeekday + 1 + i;
    cells.push({dayNum, other:true, dateObj: new Date(y, m-1, dayNum)});
  }
  for(let d=1; d<=daysInMonth; d++){
    cells.push({dayNum:d, other:false, dateObj: new Date(y, m, d)});
  }
  while(cells.length % 7 !== 0){
    const dayNum = cells.length - (startWeekday+daysInMonth) + 1;
    cells.push({dayNum, other:true, dateObj: new Date(y, m+1, dayNum)});
  }

  cells.forEach(c=>{
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (c.other? ' other':'') + (c.dateObj.toDateString()===today.toDateString() ? ' today':'');
    if(selectedDay && c.dateObj.toDateString()===selectedDay.toDateString()) cell.classList.add('selected');
    const {hw, summ, ev} = dayItemsFor(c.dateObj);
    let dots = '';
    hw.forEach(()=> dots += `<i style="background:var(--tab1)"></i>`);
    summ.forEach(()=> dots += `<i style="background:var(--brick)"></i>`);
    ev.forEach(()=> dots += `<i style="background:var(--tab4)"></i>`);
    cell.innerHTML = `<div class="cal-daynum">${c.dayNum}</div><div class="cal-dots">${dots}</div>`;
    cell.addEventListener('click', ()=>{ selectedDay = c.dateObj; renderCalendar(); showDayPanel(c.dateObj); });
    grid.appendChild(cell);
  });
}

function showDayPanel(dateObj){
  const panel = document.getElementById('day-panel');
  panel.style.display = 'block';
  document.getElementById('day-panel-title').textContent = dateObj.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
  const {hw, summ, ev} = dayItemsFor(dateObj);
  const listEl = document.getElementById('day-panel-list');
  listEl.innerHTML = '';
  if(hw.length===0 && summ.length===0 && ev.length===0){
    listEl.innerHTML = '<div class="empty-note">На этот день ничего не запланировано.</div>';
    return;
  }
  hw.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}', event); showDayPanel(selectedDay);"></div>
      <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.subject||'домашка')}</div></div>
      <span class="tag">домашка</span><span></span>`;
    listEl.appendChild(row);
  });
  summ.forEach(item=>{
    listEl.appendChild(makeRow(summativeRowHtml(item, {afterToggle:'showDayPanel(selectedDay);', afterDelete:'showDayPanel(selectedDay);'})));
  });
  ev.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<span></span><div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.type||'мероприятие')}</div></div>
      <span class="tag">событие</span><span></span>`;
    listEl.appendChild(row);
  });
}

function calShift(dir){
  calDate = new Date(calDate.getFullYear(), calDate.getMonth()+dir, 1);
  renderCalendar();
}
function calGoToday(){
  calDate = new Date();
  selectedDay = new Date();
  renderCalendar();
  showDayPanel(selectedDay);
}

/* ============ UTIL ============ */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ============ INIT ============ */
loadData();

/* ============ INTRO SPLASH CONTROL ============ */
const SETTINGS_KEY = 'organizer-settings';
let SCENE_SETTINGS = Object.assign({enabled:true, loop:true, duration:16}, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
function saveSceneSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(SCENE_SETTINGS)); }
function openSettings(){
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Заставка при входе</h3>
    <div class="settings-card"><label><input id="scene-enabled" type="checkbox" ${SCENE_SETTINGS.enabled?'checked':''}> Показывать заставку</label></div>
    <div class="settings-card"><label><input id="scene-loop" type="checkbox" ${SCENE_SETTINGS.loop?'checked':''}> Повторять анимацию</label><small>Если выключить — проиграется один раз за вход.</small></div>
    <div class="field"><label>Сколько показывать: <b id="duration-value">${SCENE_SETTINGS.duration} сек.</b></label><input id="scene-duration" type="range" min="8" max="40" step="4" value="${SCENE_SETTINGS.duration}"></div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" onclick="saveSettings()">Сохранить</button></div>`;
  document.getElementById('scene-duration').addEventListener('input', e=>document.getElementById('duration-value').textContent=e.target.value+' сек.');
  document.getElementById('overlay').classList.add('open');
}
function saveSettings(){
  SCENE_SETTINGS={enabled:document.getElementById('scene-enabled').checked,loop:document.getElementById('scene-loop').checked,duration:Number(document.getElementById('scene-duration').value)};
  saveSceneSettings(); closeModal(); launchIntro(true);
}
function launchIntro(force=false){
  const splash=document.getElementById('intro-splash'); if(!splash) return;
  if(!force && (!SCENE_SETTINGS.enabled || sessionStorage.getItem('intro-shown'))) { splash.classList.add('done'); return; }
  splash.classList.remove('done','closing'); document.documentElement.style.setProperty('--scene-duration',SCENE_SETTINGS.duration+'s');
  splash.classList.toggle('intro-loop',SCENE_SETTINGS.loop); sessionStorage.setItem('intro-shown','1');
  let closed=false; const closeIntro=()=>{if(closed)return;closed=true;splash.classList.add('closing');setTimeout(()=>splash.classList.add('done'),1400)};
  const timer=setTimeout(closeIntro,SCENE_SETTINGS.duration*1000); document.getElementById('intro-skip').onclick=()=>{clearTimeout(timer);closeIntro()};
  if(SCENE_SETTINGS.loop){splash.querySelectorAll('.intro-art').forEach(el=>el.style.animationIterationCount='infinite')}
}
launchIntro();

/* ============ THEME ============ */
const THEME_KEY = 'organizer-theme';
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if(btn) btn.textContent = theme === 'light' ? 'тёмная тема' : 'светлая тема';
}
function toggleTheme(){
  const cur = localStorage.getItem(THEME_KEY) || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}
applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

/* ============ COMMAND PALETTE ============ */
const PALETTE_TYPE_LABELS = {
  lessons: 'Урок', homework: 'Домашка', summatives: 'Суммативка',
  events: 'Событие', goals: 'Цель', notes: 'Заметка'
};
let paletteMatches = [];
let paletteActiveIndex = -1;

function openPalette(){
  closeMobileNav();
  const overlay = document.getElementById('palette-overlay');
  const input = document.getElementById('palette-input');
  overlay.classList.add('open');
  input.value = '';
  renderPaletteResults('');
  setTimeout(()=>input.focus(), 30);
}
function closePalette(){
  document.getElementById('palette-overlay').classList.remove('open');
}

function paletteSearch(query){
  const q = query.trim().toLowerCase();
  const results = [];
  const push = (type, item, title, sub) => results.push({type, id:item.id, title, sub});

  DATA.lessons.forEach(i => push('lessons', i, i.title, [i.teacher, i.schedule].filter(Boolean).join(' · ')));
  DATA.homework.forEach(i => push('homework', i, i.title, i.subject||''));
  DATA.summatives.forEach(i => push('summatives', i, i.title, [(i.kind==='soch'?'СОЧ':'СОР'), i.subject].filter(Boolean).join(' · ')));
  DATA.events.forEach(i => push('events', i, i.title, i.type||''));
  DATA.goals.forEach(i => push('goals', i, i.title, i.desc||''));
  DATA.notes.forEach(i => push('notes', i, i.title, i.text||''));

  if(!q) return results.slice(0, 8);
  return results.filter(r => (r.title+' '+r.sub).toLowerCase().includes(q)).slice(0, 30);
}

function renderPaletteResults(query){
  paletteMatches = paletteSearch(query);
  paletteActiveIndex = paletteMatches.length ? 0 : -1;
  paintPaletteResults();
}

function paintPaletteResults(){
  const wrap = document.getElementById('palette-results');
  if(paletteMatches.length === 0){
    wrap.innerHTML = '<div class="palette-empty">Ничего не найдено</div>';
    return;
  }
  wrap.innerHTML = paletteMatches.map((r, idx) => {
    const label = PALETTE_TYPE_LABELS[r.type];
    return `<button class="palette-item${idx===paletteActiveIndex?' active':''}" onclick="paletteOpenResult(${idx})">
      <span><span class="palette-item-title">${escapeHtml(r.title||'(без названия)')}</span>
      <div class="palette-item-sub">${label}${r.sub? ' · '+escapeHtml(r.sub) : ''}</div></span>
    </button>`;
  }).join('');
}

function paletteOpenResult(idx){
  const r = paletteMatches[idx];
  if(!r) return;
  closePalette();
  const btn = document.querySelector(`.tab-btn[data-view="${r.type}"]`);
  if(btn) btn.click();
  setTimeout(()=> openModal(r.type, r.id), 80);
}

function paletteMove(delta){
  if(!paletteMatches.length) return;
  paletteActiveIndex = (paletteActiveIndex + delta + paletteMatches.length) % paletteMatches.length;
  paintPaletteResults();
  const activeEl = document.querySelector('.palette-item.active');
  if(activeEl) activeEl.scrollIntoView({block:'nearest'});
}

document.addEventListener('keydown', (e) => {
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    const overlay = document.getElementById('palette-overlay');
    if(overlay.classList.contains('open')) closePalette(); else openPalette();
  }
});
document.getElementById('palette-input').addEventListener('input', (e) => renderPaletteResults(e.target.value));
document.getElementById('palette-input').addEventListener('keydown', (e) => {
  if(e.key === 'ArrowDown'){ e.preventDefault(); paletteMove(1); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); paletteMove(-1); }
  else if(e.key === 'Enter'){ e.preventDefault(); if(paletteActiveIndex>=0) paletteOpenResult(paletteActiveIndex); }
  else if(e.key === 'Escape'){ closePalette(); }
});
document.getElementById('palette-overlay').addEventListener('click', (e) => {
  if(e.target.id === 'palette-overlay') closePalette();
});

/* ============ POMODORO TIMER ============ */
const POMODORO_DURATIONS = { focus: 25*60, short: 5*60, long: 15*60 };
const POMODORO_LABELS = { focus: 'Учёба', short: 'Короткий перерыв', long: 'Длинный перерыв' };
let pomodoroMode = 'focus';
let pomodoroRemaining = POMODORO_DURATIONS.focus;
let pomodoroRunning = false;
let pomodoroTimer = null;

function pomodoroFormat(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function pomodoroRender(){
  document.getElementById('pomodoro-time').textContent = pomodoroFormat(pomodoroRemaining);
  document.getElementById('pomodoro-mini').textContent = pomodoroFormat(pomodoroRemaining);
  document.getElementById('pomodoro-mode').textContent = POMODORO_LABELS[pomodoroMode];
  document.getElementById('pomodoro-startpause').textContent = pomodoroRunning ? 'Пауза' : 'Старт';
  document.getElementById('pomodoro').classList.toggle('running', pomodoroRunning);
}
function pomodoroTogglePanel(){
  document.getElementById('pomodoro').classList.toggle('open');
}
function pomodoroSetMode(mode){
  pomodoroMode = mode;
  pomodoroRemaining = POMODORO_DURATIONS[mode];
  pomodoroPause();
  pomodoroRender();
}
function pomodoroStartPause(){
  if(pomodoroRunning) pomodoroPause(); else pomodoroStart();
}
function pomodoroStart(){
  if(pomodoroRunning) return;
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
  pomodoroRunning = true;
  pomodoroTimer = setInterval(() => {
    pomodoroRemaining--;
    if(pomodoroRemaining <= 0){
      pomodoroPause();
      pomodoroRemaining = 0;
      pomodoroRender();
      pomodoroNotifyDone();
      return;
    }
    pomodoroRender();
  }, 1000);
  pomodoroRender();
}
function pomodoroPause(){
  pomodoroRunning = false;
  if(pomodoroTimer){ clearInterval(pomodoroTimer); pomodoroTimer = null; }
  pomodoroRender();
}
function pomodoroReset(){
  pomodoroPause();
  pomodoroRemaining = POMODORO_DURATIONS[pomodoroMode];
  pomodoroRender();
}
function pomodoroNotifyDone(){
  burstConfetti(document.querySelector('.pomodoro-toggle'));
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification(pomodoroMode === 'focus' ? '25 минут прошли — можно отдохнуть' : 'Перерыв закончился');
  }
  pomodoroSetMode(pomodoroMode === 'focus' ? 'short' : 'focus');
  document.getElementById('pomodoro').classList.add('open');
}
pomodoroRender();
