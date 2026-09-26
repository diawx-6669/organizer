/* ============ STATE & STORAGE ============ */
const STORAGE_KEY = 'student-data';
let DATA = { lessons: [], homework: [], events: [], goals: [], summatives: [], notes: [],
             activityLog: {}, extraSubjects: [], hiddenSubjects: [], subjectInfo: {} };
let editingId = null;
let editingType = null;
let calDate = new Date();
let selectedDay = null;

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DOWS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

/* Предметы из расписания — их убрать нельзя, они приходят из сетки уроков.
   Свои добавляются в DATA.extraSubjects, спрятанные лежат в DATA.hiddenSubjects. */
const BASE_SUBJECTS = [
  'Математика','Физика','Химия','Биология','География',
  'Всемирная история','История Казахстана','Экономика',
  'Казахский язык и литература','Русский язык','Английский язык',
  'ИКТ','ИЗО','Физкультура'
];
let openSubjects = new Set();

/* ============ SCHEDULE (расписание) ============ */
const SCHED_TIMES = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00"];
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
    "Пн": ["Mathematics","Physical and Health Education","Arts","Homeroom","English Language Acquisition","Kazakh Language and Literature","Information and communication technology","Homeroom"],
    "Вт": ["Chemistry","Physics","Mathematics","Homeroom","Kazakh Language and Literature","English Language Acquisition","World History","Homeroom"],
    "Ср": ["Arts","Mathematics","Economics","Homeroom","Kazakh History","Russian Language Acquisition","Biology","Homeroom"],
    "Чт": ["Geography","Information and communication technology","Chemistry","Homeroom","Physical and Health Education","Mathematics","Physics","Homeroom"],
    "Пт": ["Russian Language Acquisition","Kazakh Language and Literature","English Language Acquisition","Homeroom","Kazakh History","Biology","Economics","Homeroom"]
  },
  B: {
    "Пн": ["Mathematics","Physical and Health Education","Arts","Homeroom","English Language Acquisition","Kazakh Language and Literature","Information and communication technology","Homeroom"],
    "Вт": ["Chemistry","Physics","Mathematics","Homeroom","Kazakh Language and Literature","English Language Acquisition","World History","Homeroom"],
    "Ср": ["Arts","Mathematics","Geography","Homeroom","Kazakh History","Russian Language Acquisition","Biology","Homeroom"],
    "Чт": ["Geography","Information and communication technology","Chemistry","Homeroom","Physical and Health Education","Mathematics","Physics","Homeroom"],
    "Пт": ["Russian Language Acquisition","Kazakh Language and Literature","English Language Acquisition","Homeroom","Kazakh History","Biology","Economics","Homeroom"]
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
/* Чередование А/Б вычислено по скриншотам школьного расписания.
   Если школа сдвинет неделю (каникулы, перенос), флажок это правит. */
function schedFlipped(){
  return !!DATA.schedFlip;
}

function schedPatternFor(monday){
  const diffDays = Math.round((monday - SCHED_ANCHOR_MONDAY)/(1000*60*60*24));
  const diffWeeks = Math.round(diffDays/7);
  const even = ((diffWeeks % 2) + 2) % 2 === 0;
  return (even !== schedFlipped()) ? 'A' : 'B';
}

function toggleSchedFlip(){
  DATA.schedFlip = !DATA.schedFlip;
  saveData();
  renderAll();
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
  rangeEl.innerHTML = escapeHtml(fmt(first)+' — '+fmt(last)) +
    `<button class="sched-week-tag" onclick="toggleSchedFlip()"
      title="Если неделя не та, нажми — чередование А и Б сдвинется на одну">неделя ${pattern}</button>`;

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

      const room = subjectRoom(rus, SCHED_ROOMS[subj]);
      const teacher = subjectTeacher(rus);
      if(teacher) cell.title = rus + ' · ' + teacher;
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


/* ---- уроки на конкретную дату ---- */
const SCHED_SLOT_MINUTES = 40;

function schedLessonsOn(date){
  const key = SCHED_DAY_KEYS[(date.getDay()+6)%7];
  if(!key) return [];                       // суббота и воскресенье
  const pattern = schedPatternFor(schedGetMonday(date));
  return SCHED_DATA[pattern][key].map((subj, idx)=>({
    slot: idx,
    time: SCHED_TIMES[idx],
    subject: SCHED_RUS[subj] || subj,
    room: subjectRoom(SCHED_RUS[subj] || subj, SCHED_ROOMS[subj]),
    teacher: subjectTeacher(SCHED_RUS[subj] || subj),
    isHomeroom: subj === 'Homeroom'
  }));
}

function slotMinutes(time){
  const [h,m] = time.split(':').map(Number);
  return h*60 + m;
}

/* какой урок идёт прямо сейчас и какой следующий */
function schedNowInfo(lessons, now){
  const mins = now.getHours()*60 + now.getMinutes();
  let current = null, next = null;
  lessons.forEach(l=>{
    const from = slotMinutes(l.time), to = from + SCHED_SLOT_MINUTES;
    if(mins >= from && mins < to) current = {...l, leftMin: to - mins};
    else if(mins < from && !next) next = {...l, inMin: from - mins};
  });
  return {current, next};
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
      DATA = normalizeData(JSON.parse(raw));
    }
  }catch(e){
    console.log('Сохранённых данных нет, начинаем с пустого', e);
  }
  migrateActivityLog();
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


/* ============ ЭКСПОРТ В КАЛЕНДАРЬ (.ics) ============ */
/* Файл можно открыть в Календаре на телефоне или импортировать в Google Calendar. */

function icsEscape(text){
  return String(text||'')
    .replace(/\\/g,'\\\\')
    .replace(/;/g,'\\;')
    .replace(/,/g,'\\,')
    .replace(/\r?\n/g,'\\n');
}

/* по стандарту строка не длиннее 75 октетов, продолжение — с пробела */
function icsFold(line){
  const bytes = new TextEncoder().encode(line);
  if(bytes.length <= 75) return line;
  const out = [];
  let cur = '', curLen = 0, limit = 75;
  for(const ch of line){
    const size = new TextEncoder().encode(ch).length;
    if(curLen + size > limit){ out.push(cur); cur = ' '; curLen = 1; limit = 75; }
    cur += ch; curLen += size;
  }
  if(cur) out.push(cur);
  return out.join('\r\n');
}

function icsDate(dateStr){
  return String(dateStr).replace(/-/g,'');
}
function icsDatePlusDay(dateStr){
  const d = new Date(dateStr);
  d.setDate(d.getDate()+1);
  return icsDate(schedDateKey(d));
}
function icsStamp(){
  return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
}

function collectIcsEvents(){
  const events = [];
  DATA.homework.filter(h=>h.due).forEach(h=>{
    const steps = Array.isArray(h.steps) && h.steps.length
      ? '\nШаги: ' + h.steps.map(st=>st.text).join('; ') : '';
    events.push({
      uid: 'hw-' + h.id,
      date: h.due,
      summary: 'Домашка: ' + h.title + (h.subject ? ' (' + h.subject + ')' : ''),
      description: (h.notes||'') + steps
    });
  });
  DATA.summatives.filter(x=>x.due).forEach(x=>{
    events.push({
      uid: 'sor-' + x.id,
      date: x.due,
      summary: (x.kind === 'soch' ? 'СОЧ' : 'СОР') + (x.subject ? ': ' + x.subject : ''),
      description: x.title + (x.notes ? '\n' + x.notes : '')
    });
  });
  DATA.events.filter(e=>e.date).forEach(e=>{
    events.push({
      uid: 'ev-' + e.id,
      date: e.date,
      summary: e.title,
      description: [e.type, e.link].filter(Boolean).join('\n')
    });
  });
  return events;
}

function buildIcs(){
  const stamp = icsStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//moy-organayzer//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Мой органайзер'
  ];
  collectIcsEvents().forEach(ev=>{
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + ev.uid + '@moy-organayzer',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + icsDate(ev.date),
      'DTEND;VALUE=DATE:' + icsDatePlusDay(ev.date),
      'SUMMARY:' + icsEscape(ev.summary),
      'DESCRIPTION:' + icsEscape(ev.description),
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/* ---- уроки как повторяющиеся события ----
   Недели А и Б чередуются, поэтому обычное «каждую неделю» не годится:
   на каждый урок ставим повтор раз в две недели от ближайшей подходящей
   недели. Время пишем без Z и без часового пояса — это «плавающее» время
   по стандарту, урок в 08:00 останется в 08:00 в любом поясе. */

const LESSONS_WEEKS_AHEAD = 18;

function icsLocalStamp(dateStr, time){
  const [h, m] = time.split(':');
  return dateStr.replace(/-/g,'') + 'T' + h + m + '00';
}

function addMinutesToTime(time, minutes){
  const total = slotMinutes(time) + minutes;
  return String(Math.floor(total/60)).padStart(2,'0') + ':' + String(total%60).padStart(2,'0');
}

function collectLessonEvents(){
  const events = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const firstMonday = schedGetMonday(today);

  const until = new Date(firstMonday);
  until.setDate(until.getDate() + LESSONS_WEEKS_AHEAD*7);
  const untilStamp = icsDate(schedDateKey(until)) + 'T235959Z';

  ['A','B'].forEach(pattern=>{
    // ближайший понедельник с нужным чередованием
    let monday = new Date(firstMonday);
    if(schedPatternFor(monday) !== pattern) monday.setDate(monday.getDate() + 7);

    SCHED_DAY_KEYS.forEach((dayKey, dayIdx)=>{
      SCHED_DATA[pattern][dayKey].forEach((subj, slot)=>{
        const date = new Date(monday);
        date.setDate(monday.getDate() + dayIdx);
        const dateStr = schedDateKey(date);
        const time = SCHED_TIMES[slot];
        const room = SCHED_ROOMS[subj];
        events.push({
          uid: `lesson-${pattern}-${dayIdx}-${slot}`,
          start: icsLocalStamp(dateStr, time),
          end:   icsLocalStamp(dateStr, addMinutesToTime(time, SCHED_SLOT_MINUTES)),
          summary: SCHED_RUS[subj] || subj,
          location: room || '',
          teacher: subjectTeacher(SCHED_RUS[subj] || subj),
          rrule: 'FREQ=WEEKLY;INTERVAL=2;UNTIL=' + untilStamp
        });
      });
    });
  });
  return events;
}

function buildLessonsIcs(){
  const stamp = icsStamp();
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//moy-organayzer//RU',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Расписание уроков'
  ];
  collectLessonEvents().forEach(ev=>{
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + ev.uid + '@moy-organayzer',
      'DTSTAMP:' + stamp,
      'DTSTART:' + ev.start,
      'DTEND:' + ev.end,
      'RRULE:' + ev.rrule,
      'SUMMARY:' + icsEscape(ev.summary),
      'LOCATION:' + icsEscape(ev.location),
      'DESCRIPTION:' + icsEscape(ev.teacher || ''),
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

function openIcsExport(){
  const deadlines = collectIcsEvents().length;
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Выгрузить в календарь</h3>
    <p class="import-note">Файл .ics открывается в Календаре на телефоне или
      импортируется в Google Calendar.</p>
    <div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap">
      <button class="btn-secondary" onclick="downloadIcs('deadlines')">Дедлайны (${deadlines})</button>
      <button class="btn-secondary" onclick="downloadIcs('lessons')">Расписание уроков</button>
    </div>
    <p class="import-note">Уроки выгружаются на ${LESSONS_WEEKS_AHEAD} недель вперёд,
      с повтором раз в две недели — чередование А и Б сохраняется.</p>
    <div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Закрыть</button></div>`;
  document.getElementById('overlay').classList.add('open');
}

function downloadIcs(which){
  const stamp = schedDateKey(new Date());
  if(which === 'lessons'){
    downloadFile(buildLessonsIcs(), `raspisanie-${stamp}.ics`, 'text/calendar;charset=utf-8');
    return;
  }
  if(collectIcsEvents().length === 0){
    alert('Пока нечего выгружать — нет ни одной записи с датой.');
    return;
  }
  downloadFile(buildIcs(), `dedlayny-${stamp}.ics`, 'text/calendar;charset=utf-8');
}

/* общая выгрузка файла — её же использует бэкап */
function downloadFile(content, filename, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


/* ============ ВЫГРУЗКА В CSV ============ */
/* Открывается в Numbers и Excel. Разделитель — точка с запятой: в русской
   локали Excel запятая считается десятичным разделителем и всё съезжает
   в один столбец. BOM в начале — иначе Excel показывает кириллицу кракозябрами. */

function csvCell(value){
  const text = String(value === null || value === undefined ? '' : value);
  return /[";\n\r]/.test(text) ? '"' + text.replace(/"/g,'""') + '"' : text;
}

function csvFrom(headers, rows){
  const lines = [headers, ...rows].map(row => row.map(csvCell).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function exportHomeworkCsv(){
  const rows = [...DATA.homework]
    .sort((a,b)=> String(a.due||'').localeCompare(String(b.due||'')))
    .map(h => [
      h.due || '', h.subject || '', h.title || '',
      h.done ? 'сделано' : 'не сделано',
      {high:'высокий', low:'низкий'}[h.priority] || 'обычный',
      Array.isArray(h.steps) ? h.steps.map(st => (st.done ? '[x] ' : '[ ] ') + st.text).join(' | ') : '',
      h.notes || ''
    ]);
  return csvFrom(['Срок','Предмет','Задание','Статус','Приоритет','Шаги','Заметки'], rows);
}

function exportSummativesCsv(){
  const rows = [...DATA.summatives]
    .sort((a,b)=> String(a.due||'').localeCompare(String(b.due||'')))
    .map(x => {
      const has = x.score !== null && x.score !== undefined && x.score !== '' && Number(x.maxScore) > 0;
      return [
        x.due || '', x.subject || '', x.kind === 'soch' ? 'СОЧ' : 'СОР', x.title || '',
        has ? x.score : '', x.maxScore || '',
        has ? Math.round((Number(x.score)/Number(x.maxScore))*100) + '%' : '',
        x.notes || ''
      ];
    });
  return csvFrom(['Дата','Предмет','Тип','Название','Балл','Максимум','Процент','Заметки'], rows);
}

function openCsvExport(){
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Выгрузить таблицей</h3>
    <p class="import-note">Файл .csv откроется в Numbers, Excel или Google Таблицах.</p>
    <div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap">
      <button class="btn-secondary" onclick="downloadCsv('homework')">Домашка (${DATA.homework.length})</button>
      <button class="btn-secondary" onclick="downloadCsv('summatives')">Суммативки (${DATA.summatives.length})</button>
    </div>
    <div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Закрыть</button></div>`;
  document.getElementById('overlay').classList.add('open');
}

function downloadCsv(which){
  const stamp = schedDateKey(new Date());
  if(which === 'homework'){
    downloadFile(exportHomeworkCsv(), `domashka-${stamp}.csv`, 'text/csv;charset=utf-8');
  } else {
    downloadFile(exportSummativesCsv(), `summativki-${stamp}.csv`, 'text/csv;charset=utf-8');
  }
}

/* ---- локальный бэкап: экспорт/импорт JSON-файла ---- */
function exportBackup(){
  downloadFile(JSON.stringify(DATA, null, 2),
    `moy-organayzer-backup-${schedDateKey(new Date())}.json`, 'application/json');
}

const DATA_LISTS = ['lessons','homework','events','goals','summatives','notes'];
const DATA_SETS = ['extraSubjects','hiddenSubjects'];

function emptyData(){
  return {lessons:[], homework:[], events:[], goals:[], summatives:[], notes:[],
          activityLog:{}, extraSubjects:[], hiddenSubjects:[], schedFlip:false, subjectInfo:{}};
}

function normalizeData(raw){
  const data = Object.assign(emptyData(), raw);
  [...DATA_LISTS, ...DATA_SETS].forEach(k => { if(!Array.isArray(data[k])) data[k] = []; });
  return data;
}

/* Импорт больше не затирает всё молча: сначала показываем, что в файле,
   и спрашиваем — заменить или добавить к тому, что уже есть. */
function importBackup(file){
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try{
      incoming = normalizeData(JSON.parse(reader.result));
    }catch(e){
      alert('Не получилось прочитать файл копии: ' + e.message);
      return;
    }
    askImportMode(incoming);
  };
  reader.readAsText(file);
}

function countRows(data){
  return DATA_LISTS.reduce((sum,k)=> sum + data[k].length, 0);
}

let pendingImport = null;

function askImportMode(incoming){
  pendingImport = incoming;
  const rows = DATA_LISTS
    .map(k => ({k, n: incoming[k].length}))
    .filter(x => x.n > 0)
    .map(x => `<div class="import-row"><span>${IMPORT_LABELS[x.k]}</span><b>${x.n}</b></div>`)
    .join('') || '<div class="import-row"><span>Записей нет</span><b>0</b></div>';

  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Что в файле</h3>
    <div class="import-list">${rows}</div>
    <p class="import-note">Сейчас у тебя ${countRows(DATA)} ${plural(countRows(DATA),'запись','записи','записей')}.
      «Добавить» оставит их на месте и дольёт недостающее, «Заменить» сотрёт и поставит то, что в файле.</p>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-secondary" onclick="applyImport('replace')">Заменить</button>
      <button class="btn-primary" onclick="applyImport('merge')">Добавить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
}

const IMPORT_LABELS = {
  lessons:'Уроки', homework:'Домашка', events:'Мероприятия',
  goals:'Цели', summatives:'Суммативки', notes:'Заметки'
};

function applyImport(mode){
  if(!pendingImport) return;
  const incoming = pendingImport;
  pendingImport = null;

  if(mode === 'replace'){
    DATA = incoming;
  } else {
    DATA_LISTS.forEach(key=>{
      const seen = new Set(DATA[key].map(x => x.id));
      incoming[key].forEach(item=>{
        if(seen.has(item.id)) return;           // тот же самый — пропускаем
        seen.add(item.id);
        DATA[key].push(item);
      });
    });
    DATA.subjectInfo = Object.assign({}, incoming.subjectInfo || {}, DATA.subjectInfo || {});
    DATA_SETS.forEach(key=>{
      incoming[key].forEach(v => { if(!DATA[key].includes(v)) DATA[key].push(v); });
    });
    // активность складываем по дням, берём большее
    Object.entries(incoming.activityLog || {}).forEach(([day, n])=>{
      DATA.activityLog[day] = Math.max(DATA.activityLog[day] || 0, n);
    });
  }

  migrateActivityLog();
  migrateLegacySummatives();
  saveData();
  renderAll();
  closeModal();
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
    syncBottomNav();
  });
});


/* ---- нижняя панель на телефоне ---- */
function syncBottomNav(){
  const active = document.querySelector('.view.active');
  const current = active ? active.id.replace('view-','') : '';
  document.querySelectorAll('.bottom-nav button[data-view]').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.view === current);
  });
  const hw = DATA.homework.filter(h=>!h.done).length;
  const sm = DATA.summatives.filter(x=>!x.done).length;
  setBottomBadge('bn-homework', hw);
  setBottomBadge('bn-summatives', sm);
}

function setBottomBadge(id, count){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = count > 99 ? '99+' : count;
  el.classList.toggle('on', count > 0);
}

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
  const goalsActive = DATA.goals.filter(g=>goalPercent(g) < 100).length;
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

  renderTodayLessons();
  renderWorkload();
  renderActivityHeatmap();
  renderOrbit();
}



/* ============ КАРТА АКТИВНОСТИ ============ */
/* Одна краска, четыре ступени — чем больше закрыто за день, тем плотнее.
   Ступени проверены на монотонность светлоты отдельно для каждой темы. */
const HEAT_WEEKS = 18;

function heatLevel(count){
  if(!count) return 0;
  if(count === 1) return 1;
  if(count === 2) return 2;
  if(count <= 4) return 3;
  return 4;
}

function renderActivityHeatmap(){
  const wrap = document.getElementById('activity-heatmap');
  if(!wrap) return;

  const days = activityDays();
  const today = new Date(); today.setHours(0,0,0,0);
  const start = schedGetMonday(today);
  start.setDate(start.getDate() - 7*(HEAT_WEEKS-1));

  let total = 0, cells = '';
  const monthMarks = [];
  for(let w = 0; w < HEAT_WEEKS; w++){
    let col = '';
    for(let d = 0; d < 7; d++){
      const date = new Date(start);
      date.setDate(start.getDate() + w*7 + d);
      if(date > today){ col += '<i class="heat-cell heat-void"></i>'; continue; }
      const key = schedDateKey(date);
      const n = days[key] || 0;
      total += n;
      const title = `${date.getDate()} ${MONTHS[date.getMonth()]}: ` +
        (n ? `${n} ${plural(n,'задача','задачи','задач')}` : 'ничего не закрыто');
      col += `<i class="heat-cell heat-${heatLevel(n)}" title="${escapeHtml(title)}"></i>`;
      if(d === 0) monthMarks.push(date.getDate() <= 7 ? MONTHS_NOM[date.getMonth()].slice(0,3).toLowerCase() : '');
    }
    cells += `<div class="heat-col">${col}</div>`;
  }

  const streak = computeStreak();
  wrap.innerHTML = `
    <div class="heat-head">
      <div><strong>Что закрыто за ${HEAT_WEEKS} недель</strong>
        <small>${total} ${plural(total,'задача','задачи','задач')} · подряд: ${streak} ${plural(streak,'день','дня','дней')}</small></div>
      <div class="heat-legend"><span>реже</span>
        <i class="heat-cell heat-0"></i><i class="heat-cell heat-1"></i><i class="heat-cell heat-2"></i><i class="heat-cell heat-3"></i><i class="heat-cell heat-4"></i>
        <span>чаще</span></div>
    </div>
    <div class="heat-grid">${cells}</div>
    <div class="heat-months">${monthMarks.map(m=>`<span>${m}</span>`).join('')}</div>`;
}


/* ============ НАГРУЗКА ПО ДНЯМ ============ */
/* Сколько работы на каждый день: сумма оценок времени по несделанным
   заданиям. У заданий без оценки берём DEFAULT_TASK_MINUTES, иначе день
   с пятью безымянными по времени задачами выглядел бы пустым. */

const DEFAULT_TASK_MINUTES = 30;
const WORKLOAD_DAYS = 14;

function taskMinutes(item){
  const n = Number(item.minutes);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TASK_MINUTES;
}

function formatMinutes(total){
  if(total <= 0) return '—';
  const h = Math.floor(total/60), m = total % 60;
  if(!h) return m + ' мин';
  if(!m) return h + ' ч';
  return h + ' ч ' + m + ' мин';
}

/* по дню: несделанная домашка + суммативки на эту дату */
function workloadFor(dateStr){
  const hw = DATA.homework.filter(h => !h.done && h.due === dateStr);
  const sor = DATA.summatives.filter(x => !x.done && x.due === dateStr);
  return {
    minutes: hw.reduce((sum, h) => sum + taskMinutes(h), 0),
    tasks: hw.length,
    sor: sor.length
  };
}

function renderWorkload(){
  const wrap = document.getElementById('workload');
  if(!wrap) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const days = [];
  for(let i = 0; i < WORKLOAD_DAYS; i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = schedDateKey(d);
    days.push({date: d, key, ...workloadFor(key)});
  }

  const busiest = Math.max(...days.map(d => d.minutes), 1);
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  if(total === 0){
    wrap.innerHTML = '<div class="workload-head"><div><strong>Нагрузка на две недели</strong>' +
      '<small>появится, когда будут задания со сроком</small></div></div>';
    return;
  }

  const overdue = DATA.homework.filter(h => !h.done && h.due && daysUntil(h.due) < 0);
  const overdueMin = overdue.reduce((sum, h) => sum + taskMinutes(h), 0);

  const bars = days.map(d=>{
    const height = Math.round((d.minutes / busiest) * 100);
    const weekend = [5,6].includes((d.date.getDay()+6)%7);
    const title = `${d.date.getDate()} ${MONTHS[d.date.getMonth()]}: ` +
      (d.minutes ? `${formatMinutes(d.minutes)}, ${d.tasks} ${plural(d.tasks,'задача','задачи','задач')}` : 'свободно') +
      (d.sor ? `, СОР: ${d.sor}` : '');
    // пустой день — ничего не рисуем; СОР без домашки помечаем точкой,
    // иначе полоска в пару пикселей читалась бы как «немного работы»
    const inner = d.minutes > 0
      ? `<div class="wl-bar${d.sor?' has-sor':''}" style="height:${Math.max(height, 4)}%"></div>`
      : (d.sor ? '<i class="wl-dot"></i>' : '');
    return `<div class="wl-col${weekend?' weekend':''}" title="${escapeHtml(title)}">
      <div class="wl-bar-wrap">${inner}</div>
      <span class="wl-day">${d.date.getDate()}</span>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="workload-head">
      <div><strong>Нагрузка на две недели</strong>
        <small>всего ${formatMinutes(total)}${overdueMin ? ' · просрочено на ' + formatMinutes(overdueMin) : ''}</small></div>
      <div class="wl-legend"><i class="wl-swatch"></i>домашка<i class="wl-swatch sor"></i>день с СОР</div>
    </div>
    <div class="wl-grid">${bars}</div>`;
}

/* ---- блок "уроки на сегодня" ---- */
function renderTodayLessons(){
  const wrap = document.getElementById('today-lessons');
  if(!wrap) return;
  const now = new Date();
  const lessons = schedLessonsOn(now).filter(l=>!l.isHomeroom);

  if(lessons.length === 0){
    wrap.innerHTML = '<div class="today-lessons-head"><span>сегодня</span><strong>Уроков нет</strong></div>' +
      '<div class="empty-note">Выходной — по расписанию сегодня ничего нет.</div>';
    return;
  }

  const {current, next} = schedNowInfo(lessons, now);
  let status = 'Уроки на сегодня';
  if(current) status = 'Сейчас: ' + current.subject + ', осталось ' + current.leftMin + ' мин';
  else if(next) status = 'Следующий: ' + next.subject + ' через ' + next.inMin + ' мин';
  else status = 'Уроки на сегодня закончились';

  const dateStr = schedDateKey(now);
  const rows = lessons.map(l=>{
    const hw = DATA.homework.filter(h => h.subject === l.subject && h.due === dateStr && !h.done).length;
    const sor = DATA.summatives.filter(x => x.subject === l.subject && x.due === dateStr).length;
    const marks = [];
    if(sor) marks.push('<span class="today-mark sor">СОР</span>');
    if(hw)  marks.push('<span class="today-mark">домашка ' + hw + '</span>');
    const isNow = current && current.slot === l.slot;
    const past = !isNow && slotMinutes(l.time) + SCHED_SLOT_MINUTES <= now.getHours()*60 + now.getMinutes();
    return '<div class="today-row' + (isNow?' now':'') + (past?' past':'') + '">' +
      '<span class="today-time">' + l.time + '</span>' +
      '<span class="today-subject">' + escapeHtml(l.subject) + '</span>' +
      '<span class="today-room">' + escapeHtml([l.room, l.teacher].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="today-marks">' + marks.join('') + '</span></div>';
  }).join('');

  wrap.innerHTML = '<div class="today-lessons-head"><span>сегодня</span><strong>' + escapeHtml(status) + '</strong></div>' + rows;
}

function renderOrbit(){
  const svg = document.getElementById('orbit-svg');
  const cx=150, cy=150;
  const rings = [
    {r:56, color:'var(--tab1)', items: DATA.homework.filter(h=>!h.done).slice(0,8)},
    {r:84, color:'var(--brick)', items: DATA.summatives.filter(s=>!s.done).slice(0,10)},
    {r:112, color:'var(--tab4)', items: DATA.events.slice(0,10)},
    {r:140, color:'var(--tab2)', items: DATA.goals.filter(g=>goalPercent(g)<100).slice(0,12)}
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


/* ---- сколько дней до срока ---- */
function daysUntil(dateStr){
  if(!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  return Math.round((due - today)/(1000*60*60*24));
}

function plural(n, one, few, many){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5) return few;
  if(b === 1) return one;
  return many;
}

/* подпись вида «сегодня», «завтра», «через 3 дня», «просрочено на 2 дня» */
function dueLabel(dateStr){
  const d = daysUntil(dateStr);
  if(d === null) return '';
  if(d === 0) return 'сегодня';
  if(d === 1) return 'завтра';
  if(d === 2) return 'послезавтра';
  if(d < 0){ const n = -d; return 'просрочено на ' + n + ' ' + plural(n,'день','дня','дней'); }
  return 'через ' + d + ' ' + plural(d,'день','дня','дней');
}

/* тег со сроком: дата + сколько осталось */
function dueTagHtml(dateStr, done){
  if(!dateStr) return '<span class="tag">—</span>';
  const d = daysUntil(dateStr);
  let cls = 'tag due-tag';
  if(!done){
    if(d < 0) cls += ' overdue';
    else if(d === 0) cls += ' due-today';
    else if(d <= 2) cls += ' due-soon';
  }
  const rel = done ? '' : '<i>' + escapeHtml(dueLabel(dateStr)) + '</i>';
  return '<span class="' + cls + '">' + escapeHtml(fmtDate(dateStr)) + rel + '</span>';
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

/* ---- фильтр по статусу и сортировка ---- */
const HW_STATUSES = [
  {key:'active',  label:'Активные',    test: h => !h.done},
  {key:'overdue', label:'Просроченные',test: h => !h.done && h.due && daysUntil(h.due) < 0},
  {key:'today',   label:'На сегодня',  test: h => !h.done && h.due && daysUntil(h.due) === 0},
  {key:'week',    label:'На неделю',   test: h => !h.done && h.due && daysUntil(h.due) >= 0 && daysUntil(h.due) <= 7},
  {key:'done',    label:'Сделанные',   test: h => h.done},
  {key:'all',     label:'Все',         test: () => true}
];

let hwStatus = 'active';
let hwSort = 'due';

function setHwStatus(key){ hwStatus = key; renderHomework(); }
function setHwSort(val){ hwSort = val; renderHomework(); }

function hwStatusTest(key){
  const st = HW_STATUSES.find(s=>s.key===key);
  return st ? st.test : (()=>true);
}

function renderHwStatusChips(counts){
  const wrap = document.getElementById('hw-status-chips');
  if(!wrap) return;
  wrap.innerHTML = HW_STATUSES.map(st=>
    `<button class="status-chip${st.key===hwStatus?' active':''}" onclick="setHwStatus('${st.key}')">` +
    `${st.label}<span>${counts[st.key]}</span></button>`
  ).join('');
}

const HW_PRIORITY_RANK = {high:0, normal:1, low:2};

function sortHomework(list){
  const byDue = (a,b)=>{
    if(!a.due && !b.due) return 0;
    if(!a.due) return 1;
    if(!b.due) return -1;
    return a.due.localeCompare(b.due);
  };
  const sorters = {
    due: byDue,
    priority: (a,b)=>{
      const d = (HW_PRIORITY_RANK[a.priority]??1) - (HW_PRIORITY_RANK[b.priority]??1);
      return d !== 0 ? d : byDue(a,b);
    },
    subject: (a,b)=>{
      const d = (a.subject||'я').localeCompare(b.subject||'я','ru');
      return d !== 0 ? d : byDue(a,b);
    },
    added: (a,b)=> (b.createdAt||0) - (a.createdAt||0)
  };
  return [...list].sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;   // сделанное всегда внизу
    return (sorters[hwSort] || byDue)(a,b);
  });
}


/* ---- массовые действия над отфильтрованной домашкой ---- */
function currentHomeworkFiltered(){
  const bySubject = hwFilterSubject === 'all'
    ? DATA.homework
    : DATA.homework.filter(h => (h.subject||'') === hwFilterSubject);
  return bySubject.filter(hwStatusTest(hwStatus));
}

function bulkMarkDone(){
  const open = currentHomeworkFiltered().filter(h => !h.done);
  if(open.length === 0) return;
  open.forEach(h=>{ h.done = true; });
  logActivity();
  saveData();
  renderAll();
}

function bulkDeleteDone(){
  const done = currentHomeworkFiltered().filter(h => h.done);
  if(done.length === 0) return;
  deleteMany('homework', done.map(h => h.id));
}

function renderHwBulk(list){
  const wrap = document.getElementById('hw-bulk');
  if(!wrap) return;
  const open = list.filter(h => !h.done).length;
  const done = list.filter(h => h.done).length;
  const parts = [];
  if(open) parts.push(`<button onclick="bulkMarkDone()">Отметить ${open} сделанными</button>`);
  if(done) parts.push(`<button onclick="bulkDeleteDone()">Удалить ${done} сделанных</button>`);
  wrap.innerHTML = parts.join('');
  wrap.classList.toggle('on', parts.length > 0);
}

function renderHomework(){
  renderHwFilterOptions();
  const wrap = document.getElementById('list-homework');
  wrap.innerHTML = '';

  const bySubject = hwFilterSubject === 'all' ? DATA.homework : DATA.homework.filter(h => (h.subject||'') === hwFilterSubject);

  const counts = {};
  HW_STATUSES.forEach(st => counts[st.key] = bySubject.filter(st.test).length);
  renderHwStatusChips(counts);

  const filtered = bySubject.filter(hwStatusTest(hwStatus));
  renderHwBulk(filtered);
  if(filtered.length===0){
    const st = HW_STATUSES.find(x=>x.key===hwStatus);
    wrap.innerHTML = `<div class="empty-note">Ничего не подходит под фильтр «${st?st.label.toLowerCase():hwStatus}».</div>`;
    return;
  }
  const sorted = sortHomework(filtered);
  sorted.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}', event)"></div>
      <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}${
        item.repeat && item.repeat !== 'none'
          ? `<span class="repeat-mark" title="Повторяется ${escapeHtml(REPEAT_LABELS[item.repeat]||'')}">↻</span>` : ''
      }</div>
        <div class="item-meta">${escapeHtml(item.subject||'')}</div>${stepsHtml(item)}</div>
      ${item.minutes ? `<span class="tag mins">${escapeHtml(formatMinutes(Number(item.minutes)))}</span>` : '<span></span>'}
      ${priorityTagHtml(item.priority)}
      ${dueTagHtml(item.due, item.done)}
      <div class="row-actions">
        ${snoozeBtnHtml('homework', item.id)}
        <button class="icon-btn" aria-label="Изменить" onclick="openModal('homework','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
        <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('homework','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>`;
    wrap.appendChild(row);
  });
}


/* ---- шаги задания ---- */
function toggleStep(hwId, index){
  const item = DATA.homework.find(h=>h.id===hwId);
  if(!item || !Array.isArray(item.steps) || !item.steps[index]) return;
  item.steps[index].done = !item.steps[index].done;
  // все шаги отмечены — считаем задание сделанным
  const all = item.steps.every(st=>st.done);
  if(all && !item.done){ item.done = true; logActivity(); }
  else if(!all && item.done){ item.done = false; }
  saveData();
  renderAll();
}

function stepsHtml(item){
  if(!Array.isArray(item.steps) || item.steps.length === 0) return '';
  const done = item.steps.filter(st=>st.done).length;
  const rows = item.steps.map((st,i)=>
    `<button class="step${st.done?' done':''}" onclick="event.stopPropagation(); toggleStep('${item.id}', ${i})">` +
    `<i></i><span>${escapeHtml(st.text)}</span></button>`
  ).join('');
  return `<div class="steps"><div class="steps-count">${done} из ${item.steps.length}</div>${rows}</div>`;
}

function priorityTagHtml(priority){
  if(priority === 'high') return '<span class="tag priority-high">Высокий</span>';
  if(priority === 'low') return '<span class="tag priority-low">Низкий</span>';
  return '<span></span>';
}



/* ============ ПЕРЕНОС СРОКА ============ */
/* Задание не сделано к сроку — не обязательно лезть в форму,
   можно сдвинуть дату в два клика, в том числе на следующий урок. */

function shiftDate(dateStr, days){
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setHours(0,0,0,0);
  base.setDate(base.getDate() + days);
  return schedDateKey(base);
}

/* когда по этому предмету следующий урок по расписанию */
function nextLessonDate(subject, fromDateStr){
  if(!subject) return null;
  const from = fromDateStr ? new Date(fromDateStr) : new Date();
  from.setHours(0,0,0,0);
  for(let i = 1; i <= 21; i++){                 // дальше трёх недель не ищем
    const day = new Date(from);
    day.setDate(from.getDate() + i);
    const hit = schedLessonsOn(day).some(l => !l.isHomeroom && l.subject === subject);
    if(hit) return schedDateKey(day);
  }
  return null;
}

let snoozeTarget = null;

function openSnooze(type, id, event){
  event.stopPropagation();
  const item = DATA[type].find(x => x.id === id);
  if(!item) return;
  snoozeTarget = {type, id};

  const today = schedDateKey(new Date());
  const dueField = type === 'events' ? 'date' : 'due';
  const from = item[dueField] && item[dueField] > today ? item[dueField] : today;

  const options = [
    {label: 'На сегодня',    date: today},
    {label: 'На завтра',     date: shiftDate(today, 1)},
    {label: 'Через неделю',  date: shiftDate(today, 7)},
    {label: 'Ещё день',      date: shiftDate(from, 1)}
  ];

  // «Следующий физика» по-русски не звучит — предмет уже виден в строке
  const lesson = nextLessonDate(item.subject, today);
  if(lesson) options.unshift({label: 'К следующему уроку', date: lesson});

  const menu = ensureSnoozeMenu();
  menu.innerHTML = options.map(o=>
    `<button onclick="applySnooze('${o.date}')">
      <span>${escapeHtml(o.label)}</span><em>${escapeHtml(fmtDate(o.date))}</em></button>`
  ).join('');

  const rect = event.currentTarget.getBoundingClientRect();
  menu.classList.add('open');
  const top = rect.bottom + 6;
  menu.style.top = Math.min(top, window.innerHeight - menu.offsetHeight - 10) + 'px';
  menu.style.left = Math.max(10, Math.min(rect.left - menu.offsetWidth + rect.width,
                                          window.innerWidth - menu.offsetWidth - 10)) + 'px';
}

function ensureSnoozeMenu(){
  let menu = document.getElementById('snooze-menu');
  if(!menu){
    menu = document.createElement('div');
    menu.id = 'snooze-menu';
    menu.className = 'snooze-menu';
    document.body.appendChild(menu);
    document.addEventListener('click', e=>{
      if(!e.target.closest('#snooze-menu') && !e.target.closest('.snooze-btn')) closeSnooze();
    });
    document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeSnooze(); });
  }
  return menu;
}

function closeSnooze(){
  const menu = document.getElementById('snooze-menu');
  if(menu) menu.classList.remove('open');
  snoozeTarget = null;
}

function applySnooze(date){
  if(!snoozeTarget) return;
  const {type, id} = snoozeTarget;
  const item = DATA[type].find(x => x.id === id);
  if(item) item[type === 'events' ? 'date' : 'due'] = date;
  closeSnooze();
  saveData();
  renderAll();
}

const SNOOZE_ICON = '<svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true">' +
  '<circle cx="8" cy="8.5" r="5.5"/><path d="M8 5.5v3l2 1.2M5.5 1.8 3 3.4M10.5 1.8 13 3.4"/></svg>';

function snoozeBtnHtml(type, id){
  return `<button class="icon-btn snooze-btn" aria-label="Перенести срок" title="Перенести срок"
    onclick="openSnooze('${type}','${id}', event)">${SNOOZE_ICON}</button>`;
}


/* ============ УЧИТЕЛЯ И КАБИНЕТЫ ============ */
/* Кабинеты из расписания лежат в SCHED_ROOMS и меняться не могут.
   Здесь — то, что вписал сам: учитель и кабинет-уточнение по предмету. */

function subjectInfo(subject){
  return (DATA.subjectInfo && DATA.subjectInfo[subject]) || {};
}

function subjectTeacher(subject){
  return subjectInfo(subject).teacher || '';
}

/* кабинет: сначала свой, если вписан, иначе из расписания */
function subjectRoom(subject, scheduleRoom){
  return subjectInfo(subject).room || scheduleRoom || '';
}

function setSubjectInfo(subject, teacher, room){
  DATA.subjectInfo = DATA.subjectInfo || {};
  const clean = {teacher: String(teacher||'').trim(), room: String(room||'').trim()};
  if(!clean.teacher && !clean.room) delete DATA.subjectInfo[subject];
  else DATA.subjectInfo[subject] = clean;
}

function openTeachers(){
  const rows = subjectGroups().map(subj=>{
    const info = subjectInfo(subj);
    const key = encodeURIComponent(subj);
    return `<div class="teacher-row">
      <span title="${escapeHtml(subj)}">${escapeHtml(subj)}</span>
      <input data-subject="${key}" data-field="teacher" type="text"
             placeholder="учитель" value="${escapeHtml(info.teacher||'')}">
      <input data-subject="${key}" data-field="room" type="text"
             placeholder="каб." value="${escapeHtml(info.room||'')}">
    </div>`;
  }).join('');

  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Учителя и кабинеты</h3>
    <p class="import-note">Показываются в расписании, в блоке «сегодня» и на странице предмета.
      Кабинет можно не заполнять — тогда берётся тот, что стоит в расписании.</p>
    <div class="teacher-list">${rows}</div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveTeachers()">Сохранить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
}

function saveTeachers(){
  const box = document.getElementById('modal-box');
  const values = {};
  box.querySelectorAll('[data-subject]').forEach(input=>{
    const subj = decodeURIComponent(input.dataset.subject);
    values[subj] = values[subj] || {};
    values[subj][input.dataset.field] = input.value;
  });
  Object.entries(values).forEach(([subj, v]) => setSubjectInfo(subj, v.teacher, v.room));
  saveData();
  renderAll();
  closeModal();
}

/* ============ БЫСТРЫЙ ВВОД ОДНОЙ СТРОКОЙ ============ */
/* «матем параграф 12 пт !» -> предмет, срок, приоритет и название */

const QUICK_SUBJECT_ALIASES = [
  ['Математика',                  ['матем','алгебра','геом','матика']],
  ['Физика',                      ['физика','физ']],
  ['Химия',                       ['химия','хим']],
  ['Биология',                    ['биология','био']],
  ['География',                   ['география','гео']],
  ['Всемирная история',           ['всемирная','всемирка','всемир']],
  ['История Казахстана',          ['история','истор']],
  ['Экономика',                   ['экономика','эконом']],
  ['Казахский язык и литература', ['казахский','каз','қазақ']],
  ['Русский язык',                ['русский','рус']],
  ['Английский язык',             ['английский','англ','инглиш']],
  ['ИКТ',                         ['икт','информатика','инфо']],
  ['ИЗО',                         ['изо','искусство']],
  ['Физкультура',                 ['физкультура','фк','физра']]
];

const QUICK_WEEKDAYS = {
  'пн':0,'понедельник':0,'вт':1,'вторник':1,'ср':2,'среда':2,'среду':2,
  'чт':3,'четверг':3,'пт':4,'пятница':4,'пятницу':4,'сб':5,'суббота':5,'субботу':5,'вс':6,'воскресенье':6
};

const QUICK_MONTHS = {
  'янв':0,'фев':1,'мар':2,'апр':3,'мая':4,'май':4,'июн':5,'июл':6,
  'авг':7,'сен':8,'окт':9,'ноя':10,'дек':11
};

function quickDateFromWeekday(idx, from){
  const cur = (from.getDay()+6)%7;           // понедельник = 0
  let delta = idx - cur;
  if(delta <= 0) delta += 7;                 // всегда ближайший будущий
  const d = new Date(from);
  d.setDate(from.getDate()+delta);
  return d;
}

/* Разбор идёт по словам, а не регулярками со \b: в JavaScript граница слова
   не срабатывает на кириллице, поэтому «завтра» и «пт» просто не находились. */
function parseQuickTask(input, now){
  now = now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = {title:'', subject:'', due:'', priority:'normal'};

  const tokens = String(input).trim().split(/\s+/).filter(Boolean);
  if(!tokens.length) return out;

  const norm = t => t.toLowerCase().replace(/^[«"(]+|[».,;:!?")]+$/g,'');
  const used = new Array(tokens.length).fill(false);
  const take = (...idx) => idx.forEach(i => used[i] = true);
  const setDue = d => { out.due = schedDateKey(d); };
  const shift = n => { const d = new Date(today); d.setDate(today.getDate()+n); return d; };

  // приоритет
  tokens.forEach((t,i)=>{
    const n = norm(t);
    if(t === '!' || n === 'срочно' || n === '!'){ out.priority = 'high'; take(i); }
  });

  // срок — первое подходящее совпадение
  for(let i=0; i<tokens.length && !out.due; i++){
    if(used[i]) continue;
    const n = norm(tokens[i]);
    let m;

    if((m = n.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?$/))){
      let year = m[3] ? Number(m[3]) : today.getFullYear();
      if(year < 100) year += 2000;
      let d = new Date(year, Number(m[2])-1, Number(m[1]));
      if(!m[3] && d < today) d = new Date(year+1, Number(m[2])-1, Number(m[1]));
      setDue(d); take(i); continue;
    }

    if(n === 'сегодня'){ setDue(today); take(i); continue; }
    if(n === 'завтра'){ setDue(shift(1)); take(i); continue; }
    if(n === 'послезавтра'){ setDue(shift(2)); take(i); continue; }

    // «через 3 дня»
    if(n === 'через' && tokens[i+1] && /^\d{1,2}$/.test(norm(tokens[i+1]))){
      setDue(shift(Number(norm(tokens[i+1]))));
      take(i, i+1);
      if(tokens[i+2] && /^(дн|день|дня|дней)$/.test(norm(tokens[i+2]))) take(i+2);
      continue;
    }

    // «15 окт»
    if(/^\d{1,2}$/.test(n) && tokens[i+1]){
      const mon = QUICK_MONTHS[norm(tokens[i+1]).slice(0,3)];
      if(mon !== undefined){
        let d = new Date(today.getFullYear(), mon, Number(n));
        if(d < today) d = new Date(today.getFullYear()+1, mon, Number(n));
        setDue(d); take(i, i+1); continue;
      }
    }

    // «пт», «в среду», «до пятницы»
    const wd = QUICK_WEEKDAYS[n];
    if(wd !== undefined){
      setDue(quickDateFromWeekday(wd, today));
      take(i);
      const prev = i > 0 ? norm(tokens[i-1]) : '';
      if(['к','на','до','в','во'].includes(prev)) take(i-1);
      continue;
    }
  }

  // предмет — ищем только в первых трёх словах, там его пишут почти всегда
  let best = null;
  for(let i=0; i<Math.min(tokens.length, 3); i++){
    if(used[i]) continue;
    const n = norm(tokens[i]);
    QUICK_SUBJECT_ALIASES.forEach(([subject, aliases])=>{
      aliases.forEach(alias=>{
        if(!n.startsWith(alias)) return;
        // после алиаса допускаем только окончание из букв: «матем», «математика», «истории»
        if(!/^[а-яёa-z]*$/.test(n.slice(alias.length))) return;
        if(!best || alias.length > best.alias.length) best = {subject, alias, index:i};
      });
    });
    if(best) break;
  }
  if(best){ out.subject = best.subject; take(best.index); }

  out.title = tokens.filter((_,i)=>!used[i]).join(' ').replace(/^[:,\s]+|[:,\s]+$/g,'');
  return out;
}

function submitQuickTask(){
  const input = document.getElementById('quick-task-input');
  if(!input) return;
  const parsed = parseQuickTask(input.value);
  if(!parsed.title){
    renderQuickPreview();
    return;
  }
  DATA.homework.push({
    id: uid(), done: false, createdAt: Date.now(), notes: '', steps: [],
    title: parsed.title, subject: parsed.subject, due: parsed.due, priority: parsed.priority
  });
  input.value = '';
  saveData();
  renderAll();
  renderQuickPreview();
  input.focus();
}

function renderQuickPreview(){
  const input = document.getElementById('quick-task-input');
  const hint = document.getElementById('quick-task-hint');
  if(!input || !hint) return;
  const raw = input.value.trim();
  if(!raw){
    hint.textContent = 'Например: «матем параграф 12 пт !» — предмет, срок и приоритет разберутся сами.';
    hint.classList.remove('ready');
    return;
  }
  const p = parseQuickTask(raw);
  const parts = [];
  parts.push(p.title ? '«' + p.title + '»' : 'без названия');
  if(p.subject) parts.push(p.subject);
  if(p.due) parts.push(fmtDate(p.due) + ', ' + dueLabel(p.due));
  if(p.priority === 'high') parts.push('высокий приоритет');
  hint.textContent = parts.join(' · ');
  hint.classList.toggle('ready', !!p.title);
}

/* ============ SUBJECTS ============ */
/* предмет занят, если он есть в записях — такой не прячем */
function subjectInUse(subject){
  return DATA.homework.some(h=>h.subject===subject)
      || DATA.summatives.some(x=>x.subject===subject)
      || DATA.notes.some(n=>n.subject===subject);
}

function subjectGroups(){
  const hidden = new Set(DATA.hiddenSubjects || []);
  const list = [];
  const add = s => { if(s && !list.includes(s)) list.push(s); };

  BASE_SUBJECTS.forEach(s => { if(!hidden.has(s) || subjectInUse(s)) add(s); });
  (DATA.extraSubjects || []).forEach(add);
  // всё, что уже используется в записях, должно быть в списке в любом случае
  [...DATA.homework, ...DATA.summatives, ...DATA.notes].forEach(x => add(x.subject));
  return list;
}

function addSubject(name){
  const clean = String(name||'').trim();
  if(!clean) return false;
  if(subjectGroups().some(s => s.toLowerCase() === clean.toLowerCase())) return false;
  DATA.extraSubjects = DATA.extraSubjects || [];
  DATA.extraSubjects.push(clean);
  DATA.hiddenSubjects = (DATA.hiddenSubjects || []).filter(s => s !== clean);
  saveData();
  return true;
}

function removeSubject(name){
  if(subjectInUse(name)) return false;
  DATA.extraSubjects = (DATA.extraSubjects || []).filter(s => s !== name);
  if(BASE_SUBJECTS.includes(name)){
    DATA.hiddenSubjects = DATA.hiddenSubjects || [];
    if(!DATA.hiddenSubjects.includes(name)) DATA.hiddenSubjects.push(name);
  }
  if(selectedSubject === name) selectedSubject = null;
  saveData();
  return true;
}

function openSubjectsManager(){
  const box = document.getElementById('modal-box');
  const rows = subjectGroups().map(subj=>{
    const used = subjectInUse(subj);
    const fromSchedule = Object.values(SCHED_RUS).includes(subj);
    const lock = used ? 'есть записи' : (fromSchedule ? 'из расписания' : '');
    return `<div class="subj-row">
      <span>${escapeHtml(subj)}</span>
      ${used
        ? `<em>${lock}</em>`
        : `<button class="subj-del" onclick="removeSubjectFromManager('${escapeHtml(subj).replace(/'/g,"\\'")}')">убрать</button>`}
    </div>`;
  }).join('');

  box.innerHTML = `<h3>Предметы</h3>
    <div class="field">
      <label>Добавить свой</label>
      <input id="new-subject" type="text" placeholder="Например: Робототехника">
    </div>
    <div class="subj-list">${rows}</div>
    <p class="import-note">Предмет, по которому уже есть домашка, суммативка или заметка,
      убрать нельзя — сначала удали или перенеси эти записи.</p>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Закрыть</button>
      <button class="btn-primary" onclick="addSubjectFromManager()">Добавить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
  const input = document.getElementById('new-subject');
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addSubjectFromManager(); } });
  setTimeout(()=>input.focus(), 40);
}

function addSubjectFromManager(){
  const input = document.getElementById('new-subject');
  if(!input) return;
  if(addSubject(input.value)){
    renderAll();
    updateSubjectsDatalist();
    openSubjectsManager();
  } else {
    input.select();
  }
}

function removeSubjectFromManager(name){
  if(removeSubject(name)){
    renderAll();
    updateSubjectsDatalist();
    openSubjectsManager();
  }
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
  const info = subjectInfo(selectedSubject);
  const meta = [info.teacher, info.room].filter(Boolean).join(' · ');
  head.innerHTML = `<h3>${escapeHtml(selectedSubject)}${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</h3>`;
  const addBtn = document.createElement('button');
  addBtn.className = 'add-btn';
  addBtn.textContent = '+ добавить в ' + selectedSubject;
  addBtn.addEventListener('click', ()=> openModal('homework', null, {subject:selectedSubject}));
  head.appendChild(addBtn);
  detail.appendChild(head);

  const fc = document.createElement('div');
  fc.innerHTML = forecastHtml(selectedSubject);
  detail.appendChild(fc);

  const body = document.createElement('div');
  body.className = 'ledger';
  if(items.length === 0){
    body.innerHTML = '<div class="empty-note">Домашки по этому предмету нет.</div>';
  } else {
    items.forEach(item=>{
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}', event); renderSubjects();"></div>
        <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
          ${item.notes? `<div class="item-meta">${escapeHtml(item.notes)}</div>` : ''}${stepsHtml(item)}</div>
        ${priorityTagHtml(item.priority)}
        ${dueTagHtml(item.due, item.done)}
        <div class="row-actions">
          ${snoozeBtnHtml('homework', item.id)}
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


/* Ссылку из формы вставляем в href только если это http, https или mailto —
   иначе туда можно было бы записать javascript: и получить выполнение кода. */
function safeUrl(raw){
  const value = String(raw||'').trim();
  if(!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : 'https://' + value;
  let url;
  try{ url = new URL(withScheme); }catch(e){ return null; }
  return ['http:','https:','mailto:'].includes(url.protocol) ? url.href : null;
}

function linkHtml(raw, label){
  const href = safeUrl(raw);
  if(!href) return '';
  return `<a class="item-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
    onclick="event.stopPropagation()">${escapeHtml(label || 'открыть')}</a>`;
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
        <div class="item-meta">${escapeHtml(item.type||'')}${item.link? ' · ' + linkHtml(item.link) : ''}</div></div>
      ${dueTagHtml(item.date, false)}
      <div class="row-actions">
        <button class="icon-btn" aria-label="Изменить" onclick="openModal('events','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
        <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('events','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>`;
    wrap.appendChild(row);
  });
}

/* Если у цели есть шаги, процент считается по ним, а не руками —
   иначе полоса и галочки показывали бы разное. */
function goalPercent(goal){
  if(Array.isArray(goal.steps) && goal.steps.length){
    const done = goal.steps.filter(st=>st.done).length;
    return Math.round((done / goal.steps.length) * 100);
  }
  return Math.max(0, Math.min(100, Number(goal.progress) || 0));
}

function toggleGoalStep(goalId, index){
  const goal = DATA.goals.find(g=>g.id===goalId);
  if(!goal || !Array.isArray(goal.steps) || !goal.steps[index]) return;
  goal.steps[index].done = !goal.steps[index].done;
  if(goal.steps[index].done) logActivity();
  saveData();
  renderAll();
}

function goalStepsHtml(goal){
  if(!Array.isArray(goal.steps) || goal.steps.length === 0) return '';
  return '<div class="steps">' + goal.steps.map((st,i)=>
    `<button class="step${st.done?' done':''}" onclick="toggleGoalStep('${goal.id}', ${i})">` +
    `<i></i><span>${escapeHtml(st.text)}</span></button>`
  ).join('') + '</div>';
}

function renderGoals(){
  const wrap = document.getElementById('list-goals');
  wrap.innerHTML = '';
  if(DATA.goals.length===0){ wrap.innerHTML = '<div class="empty-note">Целей пока нет.</div>'; return; }

  const sorted = [...DATA.goals].sort((a,b)=>{
    const da = goalPercent(a) >= 100, db = goalPercent(b) >= 100;
    if(da !== db) return da ? 1 : -1;           // достигнутые вниз
    if(!!a.due !== !!b.due) return a.due ? -1 : 1;
    if(a.due && b.due) return a.due.localeCompare(b.due);
    return 0;
  });

  sorted.forEach(item=>{
    const pct = goalPercent(item);
    const card = document.createElement('div');
    card.className = 'goal-card' + (pct >= 100 ? ' reached' : '');
    card.innerHTML = `
      <div class="goal-top">
        <div>
          <div class="goal-title">${escapeHtml(item.title)}</div>
          ${item.desc? `<div class="goal-desc">${escapeHtml(item.desc)}</div>`:''}
          ${item.due? `<div class="goal-due">${escapeHtml(fmtDate(item.due))} · ${escapeHtml(dueLabel(item.due))}</div>`:''}
          ${goalStepsHtml(item)}
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


/* ============ ПРОГНОЗ ЧЕТВЕРТНОЙ ОЦЕНКИ ============ */
/* Считаем по обычной схеме: СОР — половина итога, СОЧ — вторая половина.
   В разных школах вес может отличаться, поэтому это именно прогноз. */

const SOR_WEIGHT = 0.5;
const SOCH_WEIGHT = 0.5;

function gradeFromPercent(pct){
  if(pct >= 85) return 5;
  if(pct >= 65) return 4;
  if(pct >= 40) return 3;
  return 2;
}

function sumScored(list){
  const scored = list.filter(x => x.score !== null && x.score !== undefined && x.score !== '' && Number(x.maxScore) > 0);
  if(!scored.length) return null;
  const got = scored.reduce((a,x)=> a + Number(x.score), 0);
  const max = scored.reduce((a,x)=> a + Number(x.maxScore), 0);
  return {got, max, pct: (got/max)*100, count: scored.length};
}

function forecastForSubject(subject){
  const all = DATA.summatives.filter(x => x.subject === subject);
  const sor  = sumScored(all.filter(x => x.kind !== 'soch'));
  const soch = sumScored(all.filter(x => x.kind === 'soch'));
  if(!sor && !soch) return null;

  let pct, basis;
  if(sor && soch){
    pct = sor.pct * SOR_WEIGHT + soch.pct * SOCH_WEIGHT;
    basis = 'СОР и СОЧ';
  } else if(sor){
    pct = sor.pct;                       // считаем, что СОЧ будет написан так же
    basis = 'только СОР, СОЧ ещё нет';
  } else {
    pct = soch.pct;
    basis = 'только СОЧ, СОР ещё нет';
  }

  const pending = all.filter(x => x.score === null || x.score === undefined || x.score === '').length;
  return {pct: Math.round(pct), grade: gradeFromPercent(pct), sor, soch, basis, pending};
}

function forecastHtml(subject){
  const f = forecastForSubject(subject);
  if(!f){
    return '<div class="forecast empty">Прогноза пока нет — впиши баллы хотя бы за одну суммативку.</div>';
  }
  const rows = [];
  if(f.sor)  rows.push(`<span>СОР <b>${f.sor.got}/${f.sor.max}</b> (${Math.round(f.sor.pct)}%)</span>`);
  if(f.soch) rows.push(`<span>СОЧ <b>${f.soch.got}/${f.soch.max}</b> (${Math.round(f.soch.pct)}%)</span>`);
  if(f.pending) rows.push(`<span>без балла: <b>${f.pending}</b></span>`);

  return `<div class="forecast grade-${f.grade}">
    <div class="forecast-main">
      <div class="forecast-grade">${f.grade}</div>
      <div>
        <div class="forecast-pct">${f.pct}%</div>
        <div class="forecast-basis">прогноз по: ${escapeHtml(f.basis)}</div>
      </div>
    </div>
    <div class="forecast-rows">${rows.join('')}</div>
  </div>`;
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
    ${dueTagHtml(item.due, item.done)}
    <div class="row-actions">
      ${snoozeBtnHtml('summatives', item.id)}
      <button class="icon-btn" aria-label="Изменить" onclick="openModal('summatives','${item.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.3 2.7a1.4 1.4 0 0 1 2 2L6 12l-2.7.7.7-2.7z"/></svg></button>
      <button class="icon-btn del" aria-label="Удалить" onclick="deleteItem('summatives','${item.id}'); ${opts.afterDelete||''}"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </div>`;
}


/* ============ ГРАФИКИ ПО СУММАТИВКАМ ============ */
/* Цвета марок проверены валидатором палитры для обоих режимов:
   тёмный — #2ca79b и #d9534a на #191b21, светлый — #0f9e8f и #d1483a на белом.
   Одна серия, одна краска: длина полосы и так показывает величину,
   красный оставлен только под статус «двойка» и всегда идёт с цифрой оценки. */

let chartsAsTable = false;
function toggleChartsView(){ chartsAsTable = !chartsAsTable; renderSummCharts(); }

function chartPalette(){
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  return light
    ? {mark:'#0f9e8f', critical:'#d1483a', surface:'#ffffff'}
    : {mark:'#2ca79b', critical:'#d9534a', surface:'#191b21'};
}

function scoredSummatives(){
  return DATA.summatives
    .filter(x => x.score !== null && x.score !== undefined && x.score !== '' && Number(x.maxScore) > 0 && x.due)
    .map(x => ({
      date: x.due,
      subject: x.subject || 'Без предмета',
      kind: x.kind === 'soch' ? 'СОЧ' : 'СОР',
      pct: Math.round((Number(x.score)/Number(x.maxScore))*100)
    }))
    .sort((a,b) => a.date.localeCompare(b.date));
}

/* линия: как менялся процент от работы к работе */
function trendChartSvg(points){
  const c = chartPalette();
  const W = 720, H = 240, L = 34, R = 14, T = 14, B = 30;
  const plotW = W - L - R, plotH = H - T - B;
  const x = i => points.length === 1 ? L + plotW/2 : L + (plotW * i)/(points.length-1);
  const y = pct => T + plotH * (1 - pct/100);

  let svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Процент по суммативкам во времени">`;

  // сетка и подписи оси — тонкие, сплошные, не спорят с данными
  [0,25,50,75,100].forEach(v=>{
    svg += `<line class="chart-grid" x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}"/>`;
    svg += `<text class="chart-axis" x="${L-8}" y="${y(v)+3.5}" text-anchor="end">${v}</text>`;
  });

  const path = points.map((p,i)=> `${i?'L':'M'}${x(i).toFixed(1)} ${y(p.pct).toFixed(1)}`).join(' ');
  svg += `<path d="${path}" fill="none" stroke="${c.mark}" stroke-width="2"
    stroke-linejoin="round" stroke-linecap="round"/>`;

  points.forEach((p,i)=>{
    const crit = p.pct < 40;
    svg += `<circle class="chart-dot" cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="4.5"
      fill="${crit ? c.critical : c.mark}" stroke="${c.surface}" stroke-width="2"
      data-tip="${escapeHtml(p.subject + ' · ' + p.kind + ' · ' + fmtDate(p.date) + ' · ' + p.pct + '%')}"/>`;
  });

  // подписываем только последнюю точку — значение у каждой превращается в кашу
  const last = points[points.length-1];
  svg += `<text class="chart-label" x="${(x(points.length-1)-8).toFixed(1)}" y="${(y(last.pct)-11).toFixed(1)}"
    text-anchor="end">${last.pct}%</text>`;

  // крайние даты по оси X
  svg += `<text class="chart-axis" x="${L}" y="${H-9}">${escapeHtml(fmtDate(points[0].date))}</text>`;
  if(points.length > 1){
    svg += `<text class="chart-axis" x="${W-R}" y="${H-9}" text-anchor="end">${escapeHtml(fmtDate(last.date))}</text>`;
  }
  return svg + '</svg>';
}

/* полосы: средний процент по предметам, снизу вверх */
function subjectBarsSvg(rows){
  const c = chartPalette();
  const W = 720, rowH = 30, barH = 18, L = 180, R = 46, T = 6;
  const H = T*2 + rows.length*rowH;
  const plotW = W - L - R;

  let svg = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Средний процент по предметам">`;
  rows.forEach((r,i)=>{
    const yTop = T + i*rowH + (rowH-barH)/2;
    const w = Math.max(2, plotW * r.pct/100);
    const crit = r.grade === 2;
    svg += `<text class="chart-axis chart-rowname" x="${L-12}" y="${yTop+barH/2+4}" text-anchor="end">${escapeHtml(r.subject)}</text>`;
    svg += `<rect class="chart-track" x="${L}" y="${yTop}" width="${plotW}" height="${barH}" rx="4"/>`;
    svg += `<rect class="chart-bar" x="${L}" y="${yTop}" width="${w.toFixed(1)}" height="${barH}" rx="4"
      fill="${crit ? c.critical : c.mark}"
      data-tip="${escapeHtml(r.subject + ' · ' + r.pct + '% · оценка ' + r.grade + ' · работ: ' + r.count)}"/>`;
    svg += `<text class="chart-label" x="${W-R+8}" y="${yTop+barH/2+4}">${r.pct}% · ${r.grade}</text>`;
  });
  return svg + '</svg>';
}

function chartTableHtml(points, rows){
  const head = '<tr><th>Предмет</th><th>Средний</th><th>Оценка</th><th>Работ</th></tr>';
  const body = rows.map(r=>`<tr><td>${escapeHtml(r.subject)}</td><td>${r.pct}%</td><td>${r.grade}</td><td>${r.count}</td></tr>`).join('');
  const head2 = '<tr><th>Дата</th><th>Предмет</th><th>Тип</th><th>Процент</th></tr>';
  const body2 = points.map(p=>`<tr><td>${escapeHtml(fmtDate(p.date))}</td><td>${escapeHtml(p.subject)}</td><td>${p.kind}</td><td>${p.pct}%</td></tr>`).join('');
  return `<table class="chart-table">${head}${body}</table>
          <table class="chart-table">${head2}${body2}</table>`;
}

function renderSummCharts(){
  const wrap = document.getElementById('summ-charts');
  if(!wrap) return;

  const points = scoredSummatives();
  if(points.length === 0){
    wrap.innerHTML = '<div class="empty-note">Графики появятся, когда будет хотя бы один балл.</div>';
    return;
  }

  const stats = summativeStats();
  const rows = stats.bySubject.map(s=>({
    subject: s.subject, pct: s.avg, count: s.count, grade: gradeFromPercent(s.avg)
  }));

  const toggle = `<button class="chart-toggle" onclick="toggleChartsView()">${chartsAsTable ? 'графиком' : 'таблицей'}</button>`;

  if(chartsAsTable){
    wrap.innerHTML = `<div class="chart-card"><div class="chart-head">
      <div><strong>Все баллы</strong><small>те же числа таблицей</small></div>${toggle}</div>
      ${chartTableHtml(points, rows)}</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="chart-card">
      <div class="chart-head">
        <div><strong>Как менялся процент</strong><small>каждая точка — одна суммативка, по порядку дат</small></div>${toggle}
      </div>
      ${trendChartSvg(points)}
    </div>
    <div class="chart-card">
      <div class="chart-head">
        <div><strong>Средний процент по предметам</strong><small>снизу — где слабее всего; красным отмечена двойка</small></div>
      </div>
      ${subjectBarsSvg(rows)}
    </div>`;

  attachChartTips(wrap);
}

/* подсказка при наведении — у графика в вебе она должна быть по умолчанию */
function attachChartTips(wrap){
  let tip = document.getElementById('chart-tip');
  if(!tip){
    tip = document.createElement('div');
    tip.id = 'chart-tip';
    tip.className = 'chart-tip';
    document.body.appendChild(tip);
  }
  wrap.querySelectorAll('[data-tip]').forEach(el=>{
    el.addEventListener('mouseenter', ()=>{
      tip.textContent = el.getAttribute('data-tip');
      tip.classList.add('open');
    });
    el.addEventListener('mousemove', e=>{
      tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10) + 'px';
      tip.style.top  = (e.clientY - tip.offsetHeight - 10) + 'px';
    });
    el.addEventListener('mouseleave', ()=> tip.classList.remove('open'));
  });
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
  renderSummCharts();

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
/* закреплённые заметки всегда наверху */
function togglePin(id){
  const note = DATA.notes.find(n=>n.id===id);
  if(!note) return;
  note.pinned = !note.pinned;
  saveData();
  renderNotes();
}

function renderNotes(){
  const wrap = document.getElementById('list-notes');
  if(!wrap) return;
  wrap.innerHTML = '';
  if(DATA.notes.length===0){ wrap.innerHTML = '<div class="empty-note">Заметок пока нет.</div>'; return; }

  const sorted = [...DATA.notes].sort((a,b)=>{
    if(!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.createdAt||0)-(a.createdAt||0);
  });

  sorted.forEach(item=>{
    const card = document.createElement('div');
    card.className = 'goal-card note-card' + (item.pinned ? ' pinned' : '');
    card.innerHTML = `
      <div class="goal-top">
        <div>
          <div class="goal-title">${escapeHtml(item.title)}</div>
          ${item.subject? `<div class="note-subject">${escapeHtml(item.subject)}</div>`:''}
          ${item.text? `<div class="goal-desc">${escapeHtml(item.text)}</div>`:''}
        </div>
        <div class="row-actions">
          <button class="icon-btn pin-btn${item.pinned?' on':''}" aria-label="${item.pinned?'Открепить':'Закрепить'}"
                  title="${item.pinned?'Открепить':'Закрепить наверху'}" onclick="togglePin('${item.id}')">
            <svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V14M5 2h6l-.8 4.2 2 2.1V10H3.8V8.3l2-2.1z"/></svg>
          </button>
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
  document.getElementById('cnt-goals').textContent = DATA.goals.filter(g=>goalPercent(g)<100).length;
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
  syncBottomNav();
}

/* ============ CRUD ============ */
/* ---- повторяющиеся задания ----
   Закрытое задание остаётся в истории, а рядом появляется следующее.
   Поэтому «снять галочку» ничего не ломает: копия уже создана и
   повторно не создастся — проверяем, нет ли её уже. */

const REPEAT_LABELS = {weekly:'каждую неделю', biweekly:'раз в две недели', lesson:'к каждому уроку'};

function nextRepeatDate(item){
  if(!item.due) return null;
  if(item.repeat === 'weekly')   return shiftDate(item.due, 7);
  if(item.repeat === 'biweekly') return shiftDate(item.due, 14);
  if(item.repeat === 'lesson')   return nextLessonDate(item.subject, item.due);
  return null;
}

function spawnRepeat(item){
  const next = nextRepeatDate(item);
  if(!next) return;
  const exists = DATA.homework.some(h =>
    h.id !== item.id && h.title === item.title && (h.subject||'') === (item.subject||'') && h.due === next);
  if(exists) return;

  DATA.homework.push({
    id: uid(), createdAt: Date.now(), done: false,
    title: item.title, subject: item.subject || '', due: next,
    priority: item.priority || 'normal', minutes: item.minutes || '',
    repeat: item.repeat, notes: item.notes || '',
    // шаги переезжают снятыми — это новый раз
    steps: Array.isArray(item.steps) ? item.steps.map(st => ({text: st.text, done: false})) : []
  });
}

function toggleDone(type, id, evt){
  const it = DATA[type].find(x=>x.id===id);
  if(!it) return;
  it.done = !it.done;
  if(it.done){
    logActivity();
    if(type === 'homework' && it.repeat && it.repeat !== 'none') spawnRepeat(it);
    if(evt && evt.currentTarget) burstConfetti(evt.currentTarget);
  }
  saveData();
  renderAll();
}

/* ============ STREAK & CELEBRATION ============ */
/* Раньше лог был массивом дат без повторов — теперь это карта
   «дата -> сколько закрыто за день», чтобы рисовать карту активности. */
function migrateActivityLog(){
  if(Array.isArray(DATA.activityLog)){
    const map = {};
    DATA.activityLog.forEach(d => { map[d] = (map[d]||0) + 1; });
    DATA.activityLog = map;
  } else if(!DATA.activityLog || typeof DATA.activityLog !== 'object'){
    DATA.activityLog = {};
  }
}

function logActivity(){
  migrateActivityLog();
  const key = schedDateKey(new Date());
  DATA.activityLog[key] = (DATA.activityLog[key] || 0) + 1;
}

function activityDays(){
  migrateActivityLog();
  return DATA.activityLog;
}

function computeStreak(){
  const set = new Set(Object.keys(activityDays()));
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

/* Удаление не спрашивает подтверждения, но и не теряет запись:
   вместо диалога снизу появляется плашка «вернуть» на 8 секунд. */
const UNDO_MS = 8000;
let lastDeleted = null;
let undoTimer = null;

const TYPE_TITLES_ACC = {
  lessons:'урок', homework:'задание', summatives:'суммативку',
  events:'событие', goals:'цель', notes:'заметку'
};

function deleteItem(type, id){
  const index = DATA[type].findIndex(x=>x.id===id);
  if(index === -1) return;
  const item = DATA[type][index];

  DATA[type] = DATA[type].filter(x=>x.id!==id);
  lastDeleted = {type, entries: [{item, index}]};
  saveData();
  renderAll();

  showUndo('Удалил ' + (TYPE_TITLES_ACC[type]||'запись') + ' «' + (item.title||'без названия') + '»');
}

/* удаление пачкой — отменяется так же, как одиночное */
function deleteMany(type, ids){
  const set = new Set(ids);
  const entries = [];
  DATA[type].forEach((item, index)=>{ if(set.has(item.id)) entries.push({item, index}); });
  if(entries.length === 0) return;

  DATA[type] = DATA[type].filter(x => !set.has(x.id));
  lastDeleted = {type, entries};
  saveData();
  renderAll();

  showUndo('Удалил ' + entries.length + ' ' + plural(entries.length,'запись','записи','записей'));
}

function undoDelete(){
  if(!lastDeleted) return;
  const {type, entries} = lastDeleted;
  // вставляем с начала, чтобы индексы следующих не съезжали
  [...entries].sort((a,b)=>a.index-b.index).forEach(({item, index})=>{
    DATA[type].splice(Math.min(index, DATA[type].length), 0, item);
  });
  lastDeleted = null;
  hideUndo();
  saveData();
  renderAll();
}

function showUndo(text){
  let bar = document.getElementById('undo-bar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'undo-bar';
    bar.className = 'undo-bar';
    bar.innerHTML = '<span id="undo-text"></span><button onclick="undoDelete()">Вернуть</button>';
    document.body.appendChild(bar);
  }
  document.getElementById('undo-text').textContent = text;
  bar.classList.add('open');

  clearTimeout(undoTimer);
  undoTimer = setTimeout(()=>{ lastDeleted = null; hideUndo(); }, UNDO_MS);
}

function hideUndo(){
  const bar = document.getElementById('undo-bar');
  if(bar) bar.classList.remove('open');
  clearTimeout(undoTimer);
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
    {key:'repeat', label:'Повторять', type:'select', default:'none', options:[
      {value:'none',    label:'Не повторять'},
      {value:'weekly',  label:'Каждую неделю'},
      {value:'biweekly',label:'Раз в две недели'},
      {value:'lesson',  label:'К каждому уроку по предмету'}
    ]},
    {key:'minutes', label:'Сколько займёт, минут', type:'number'},
    {key:'steps', label:'Шаги — по одному в строке', type:'steps'},
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
    {key:'due', label:'К какому числу', type:'date'},
    {key:'steps', label:'Шаги — по одному в строке', type:'steps'},
    {key:'progress', label:'Прогресс вручную, % (если шагов нет)', type:'number'}
  ],
  notes: [
    {key:'title', label:'Заголовок', type:'text', required:true},
    {key:'subject', label:'Предмет (не обязательно)', type:'text', list:'subjects-datalist'},
    {key:'text', label:'Текст', type:'textarea'}
  ]
};

const TITLES = {lessons:'урок', homework:'задание', summatives:'суммативка', events:'событие', goals:'цель', notes:'заметка'};


/* ---- копия записи ---- */
function duplicateItem(type, id){
  const src = DATA[type].find(x => x.id === id);
  if(!src) return;

  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.createdAt = Date.now();
  copy.done = false;
  copy.title = (src.title || 'Без названия') + ' (копия)';
  // шаги и баллы начинаем заново — это другая работа
  if(Array.isArray(copy.steps)) copy.steps = copy.steps.map(st => ({text: st.text, done: false}));
  if('score' in copy) copy.score = null;

  const index = DATA[type].findIndex(x => x.id === id);
  DATA[type].splice(index + 1, 0, copy);
  saveData();
  renderAll();
  openModal(type, copy.id);      // сразу открываем копию, чтобы поправить
}

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
      if(f.type === 'steps'){
        const text = Array.isArray(val) ? val.map(st=>st.text).join('\n') : '';
        return `<div class="field"><label>${f.label}</label><textarea data-key="${f.key}" data-steps="1" rows="3" placeholder="Решить №1&#10;Оформить в тетради">${escapeHtml(text)}</textarea></div>`;
      }
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
      ${existing ? `<button class="btn-ghost" onclick="duplicateItem('${type}','${id}')">Дублировать</button>` : ''}
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="submitModal()">Сохранить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
  updateSubjectsDatalist();
}

function updateSubjectsDatalist(){
  const dl = document.getElementById('subjects-datalist');
  if(!dl) return;
  dl.innerHTML = subjectGroups().map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');
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
    if(inp.dataset.steps){
      const was = Array.isArray(obj[inp.dataset.key]) ? obj[inp.dataset.key] : [];
      v = v.split('\n').map(line=>line.trim()).filter(Boolean).map(text=>{
        const prev = was.find(st=>st.text === text);
        return {text, done: prev ? prev.done : false};
      });
    }
    else if(inp.type === 'number') v = Number(v)||0;
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

  // уроки по расписанию на этот день — без них панель показывала только дедлайны
  const lessons = schedLessonsOn(dateObj).filter(l => !l.isHomeroom);
  if(lessons.length){
    const block = document.createElement('div');
    block.className = 'day-lessons';
    block.innerHTML = '<div class="day-lessons-title">уроки по расписанию</div>' +
      lessons.map(l =>
        `<div class="day-lesson"><span>${l.time}</span><b>${escapeHtml(l.subject)}</b>` +
        `<em>${escapeHtml([l.room, l.teacher].filter(Boolean).join(' · '))}</em></div>`
      ).join('');
    listEl.appendChild(block);
  }

  if(hw.length===0 && summ.length===0 && ev.length===0){
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.textContent = lessons.length
      ? 'Дедлайнов на этот день нет.'
      : 'На этот день ничего не запланировано.';
    listEl.appendChild(note);
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
    row.innerHTML = `<span></span><div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.type||'мероприятие')}${item.link? ' · ' + linkHtml(item.link) : ''}</div></div>
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
const THEME_ORDER = ['dark','light','auto'];
const THEME_LABELS = {dark:'тёмная тема', light:'светлая тема', auto:'как в системе'};

const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function storedTheme(){
  const v = localStorage.getItem(THEME_KEY);
  return THEME_ORDER.includes(v) ? v : 'dark';
}

/* «auto» — не отдельная тема, а выбор системной: подставляем ту, что сейчас в ОС */
function resolveTheme(theme){
  if(theme !== 'auto') return theme;
  return (systemDark && systemDark.matches) ? 'dark' : 'light';
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', resolveTheme(theme));
  const btn = document.getElementById('theme-toggle');
  if(btn){
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    btn.textContent = THEME_LABELS[next];
    const hint = theme === 'auto'
      ? ' (сейчас ' + (resolveTheme(theme) === 'dark' ? 'тёмная' : 'светлая') + ')'
      : '';
    btn.title = 'Тема: ' + THEME_LABELS[theme] + hint + '. Нажми, чтобы переключить.';
  }
}

function toggleTheme(){
  const next = THEME_ORDER[(THEME_ORDER.indexOf(storedTheme()) + 1) % THEME_ORDER.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  renderSummCharts();
}

/* если выбрано «как в системе», реагируем на переключение тёмного режима в ОС */
if(systemDark && systemDark.addEventListener){
  systemDark.addEventListener('change', ()=>{
    if(storedTheme() === 'auto'){ applyTheme('auto'); renderSummCharts(); }
  });
}

applyTheme(storedTheme());

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
  paletteType = 'all';
  renderPaletteResults('');
  setTimeout(()=>input.focus(), 30);
}
function closePalette(){
  document.getElementById('palette-overlay').classList.remove('open');
}

let paletteType = 'all';
let paletteQuery = '';

const PALETTE_TYPES = [
  {key:'all',        label:'Всё'},
  {key:'homework',   label:'Домашка'},
  {key:'summatives', label:'Суммативки'},
  {key:'events',     label:'Мероприятия'},
  {key:'goals',      label:'Цели'},
  {key:'notes',      label:'Заметки'},
  {key:'lessons',    label:'Уроки'}
];

function setPaletteType(key){
  paletteType = key;
  renderPaletteResults(paletteQuery);
  const input = document.getElementById('palette-input');
  if(input) input.focus();
}

function paletteSearch(query){
  const q = query.trim().toLowerCase();
  const results = [];
  /* haystack — то, по чему ищем; в выдаче оно не показывается,
     поэтому туда можно класть заметки и шаги */
  const push = (type, item, title, sub, extra) =>
    results.push({type, id:item.id, title: title||'', sub: sub||'',
                  haystack: [title, sub, extra].filter(Boolean).join(' ').toLowerCase()});

  DATA.lessons.forEach(i => push('lessons', i, i.title, [i.teacher, i.schedule, i.room].filter(Boolean).join(' · ')));
  DATA.homework.forEach(i => push('homework', i, i.title, i.subject,
    [i.notes, (i.steps||[]).map(st=>st.text).join(' ')].filter(Boolean).join(' ')));
  DATA.summatives.forEach(i => push('summatives', i, i.title,
    [(i.kind==='soch'?'СОЧ':'СОР'), i.subject].filter(Boolean).join(' · '), i.notes));
  DATA.events.forEach(i => push('events', i, i.title, i.type, i.link));
  DATA.goals.forEach(i => push('goals', i, i.title, i.desc,
    (i.steps||[]).map(st=>st.text).join(' ')));
  DATA.notes.forEach(i => push('notes', i, i.title, [i.subject, i.text].filter(Boolean).join(' · ')));

  const byType = paletteType === 'all' ? results : results.filter(r => r.type === paletteType);
  if(!q) return byType.slice(0, 10);
  return byType.filter(r => r.haystack.includes(q)).slice(0, 40);
}

/* подсветка совпадения — экранируем до вставки, ищем уже в экранированном тексте */
function highlight(text, query){
  const safe = escapeHtml(text || '');
  const q = query.trim();
  if(!q) return safe;
  const needle = escapeHtml(q);
  const at = safe.toLowerCase().indexOf(needle.toLowerCase());
  if(at === -1) return safe;
  return safe.slice(0, at) + '<mark>' + safe.slice(at, at + needle.length) + '</mark>' + safe.slice(at + needle.length);
}

function renderPaletteResults(query){
  paletteQuery = query;
  paletteMatches = paletteSearch(query);
  paletteActiveIndex = paletteMatches.length ? 0 : -1;
  paintPaletteTypes();
  paintPaletteResults();
}

function paintPaletteTypes(){
  const wrap = document.getElementById('palette-types');
  if(!wrap) return;
  wrap.innerHTML = PALETTE_TYPES.map(t =>
    `<button class="palette-type${t.key===paletteType?' active':''}" onclick="setPaletteType('${t.key}')">${t.label}</button>`
  ).join('');
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
      <span><span class="palette-item-title">${highlight(r.title||'(без названия)', paletteQuery)}</span>
      <div class="palette-item-sub">${label}${r.sub? ' · '+highlight(r.sub, paletteQuery) : ''}</div></span>
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
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && lastDeleted && !isTyping(e.target)){
    e.preventDefault();
    undoDelete();
    return;
  }
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

/* статус текущего урока обновляем раз в минуту */
setInterval(renderTodayLessons, 60*1000);

/* ---- быстрый ввод: Enter добавляет, подсказка обновляется на лету ---- */
(function(){
  const input = document.getElementById('quick-task-input');
  if(!input) return;
  input.addEventListener('input', renderQuickPreview);
  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); submitQuickTask(); }
    if(e.key === 'Escape'){ input.value = ''; renderQuickPreview(); input.blur(); }
  });
  renderQuickPreview();
})();

/* ============ УСТАНОВКА НА ТЕЛЕФОН (PWA) ============ */
/* Service worker живёт только на https или localhost — при открытии
   файла напрямую с диска регистрация просто пропускается. */
if('serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('Офлайн-режим не включился:', err.message);
    });
  });
}

/* ============ ГОРЯЧИЕ КЛАВИШИ ============ */
const HOTKEYS = [
  {keys:'1 … 9',   label:'Перейти к разделу по номеру'},
  {keys:'N',       label:'Новое задание'},
  {keys:'S',       label:'Новая суммативка'},
  {keys:'G',       label:'Новая цель'},
  {keys:'Z',       label:'Новая заметка'},
  {keys:'/',       label:'Поиск (то же, что ⌘K)'},
  {keys:'T',       label:'Переключить тему'},
  {keys:'P',       label:'Таймер фокуса: старт или пауза'},
  {keys:'?',       label:'Эта шпаргалка'},
  {keys:'⌘Z',      label:'Вернуть удалённое'},
  {keys:'Esc',     label:'Закрыть окно или поиск'}
];

/* печатаем в поле — клавиши не перехватываем */
function isTyping(el){
  if(!el) return false;
  if(el.isContentEditable) return true;
  return ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
}

function goToView(name){
  const btn = document.querySelector(`.tab-btn[data-view="${name}"]`);
  if(btn) btn.click();
}

function openHotkeys(){
  const box = document.getElementById('modal-box');
  box.innerHTML = '<h3>Горячие клавиши</h3><div class="hotkey-list">' +
    HOTKEYS.map(h=>`<div class="hotkey-row"><kbd>${escapeHtml(h.keys)}</kbd><span>${escapeHtml(h.label)}</span></div>`).join('') +
    '</div><div class="modal-actions"><button class="btn-primary" onclick="closeModal()">Понятно</button></div>';
  document.getElementById('overlay').classList.add('open');
}

document.addEventListener('keydown', (e)=>{
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  if(isTyping(e.target)) return;
  if(document.getElementById('overlay').classList.contains('open')) return;
  if(document.getElementById('palette-overlay').classList.contains('open')) return;

  const views = ['dashboard','schedule','lessons','subjects','homework','summatives','events','goals','notes','calendar'];
  if(/^[1-9]$/.test(e.key)){ e.preventDefault(); goToView(views[Number(e.key)-1]); return; }

  switch(e.key){
    case '/': e.preventDefault(); openPalette(); break;
    case '?': e.preventDefault(); openHotkeys(); break;
    case 'n': case 'N': case 'т': case 'Т':
      e.preventDefault(); goToView('homework');
      setTimeout(()=>{ const q = document.getElementById('quick-task-input'); if(q) q.focus(); }, 60);
      break;
    case 's': case 'S': case 'ы': case 'Ы': e.preventDefault(); openModal('summatives'); break;
    case 'g': case 'G': case 'п': case 'П': e.preventDefault(); openModal('goals'); break;
    case 'z': case 'Z': case 'я': case 'Я': e.preventDefault(); openModal('notes'); break;
    case 't': case 'T': case 'е': case 'Е': e.preventDefault(); toggleTheme(); break;
    case 'p': case 'P': case 'з': case 'З':
      e.preventDefault();
      document.getElementById('pomodoro').classList.add('open');
      pomodoroStartPause();
      break;
  }
});
