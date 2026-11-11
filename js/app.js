/* ============ STATE & STORAGE ============ */
const STORAGE_KEY = 'student-data';
let DATA = { lessons: [], homework: [], events: [], goals: [], summatives: [], notes: [], fun: [],
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
/* Время уроков и длина урока взяты приблизительно: в школьном приложении
   блоки не подписаны временем, видна только сетка часов. Поэтому и то,
   и другое можно поправить — правки лежат в DATA. */
const SCHED_TIMES_DEFAULT = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00"];
const SLOT_MINUTES_DEFAULT = 40;

function schedTimes(){
  const custom = DATA.schedTimes;
  return (Array.isArray(custom) && custom.length === SCHED_TIMES_DEFAULT.length)
    ? custom : SCHED_TIMES_DEFAULT;
}

function slotLength(){
  const n = Number(DATA.slotMinutes);
  return Number.isFinite(n) && n >= 20 && n <= 120 ? n : SLOT_MINUTES_DEFAULT;
}
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

/* Личное расписание (какие уроки, кабинеты, от какой недели считать А/Б)
   в коде больше не лежит — сайт публичный, и кто угодно мог его прочитать.
   Теперь оно хранится в DATA.schedule, то есть только в этом браузере:
   { anchor: 'ГГГГ-ММ-ДД' (понедельник недели А),
     weeks: { A: {Пн:[...], ...}, B: {...} },
     rooms: { 'Chemistry': '233', ... } }
   Попадает оно туда по ключу (см. «ПРИВАТНОСТЬ» ниже) или из файла копии. */

function hasSchedule(){
  const s = DATA.schedule;
  return !!(s && s.weeks && s.weeks.A && s.weeks.B);
}

function schedDay(pattern, dayKey){
  if(!hasSchedule()) return [];
  const list = DATA.schedule.weeks[pattern] && DATA.schedule.weeks[pattern][dayKey];
  return Array.isArray(list) ? list : [];
}

function schedRoomFor(subj){
  const rooms = (DATA.schedule && DATA.schedule.rooms) || {};
  return rooms[subj] || '';
}

// понедельник недели «А» — от него чередование считается само
function schedAnchorMonday(){
  const m = DATA.schedule && /^(\d{4})-(\d{2})-(\d{2})$/.exec(DATA.schedule.anchor || '');
  return m ? new Date(Number(m[1]), Number(m[2])-1, Number(m[3])) : new Date(2024,0,1);
}

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
  const diffDays = Math.round((monday - schedAnchorMonday())/(1000*60*60*24));
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
  grid.classList.toggle('is-empty', !hasSchedule());
  if(!hasSchedule()){
    const note = document.createElement('div');
    note.className = 'sched-missing';
    note.innerHTML = `Расписания на этом устройстве нет. Если органайзер твой —
      <button class="link-btn" onclick="openPrivacy()">введи ключ</button> или загрузи свою копию.`;
    grid.appendChild(note);
    return;
  }
  grid.appendChild(document.createElement('div')).className='sched-corner';
  days.forEach(({key,date})=>{
    const h = document.createElement('div');
    h.className = 'sched-head' + (schedDateKey(date)===today ? ' is-today':'');
    h.innerHTML = `<div class="sched-head-day">${DOWS_FULL[key]}</div><div class="sched-head-date">${date.getDate()} ${MONTHS[date.getMonth()].slice(0,3)}</div>`;
    grid.appendChild(h);
  });

  schedTimes().forEach((time, slotIdx)=>{
    const tcell = document.createElement('div');
    tcell.className = 'sched-time';
    tcell.textContent = time;
    grid.appendChild(tcell);

    days.forEach(({key,date})=>{
      const subj = schedDay(pattern, key)[slotIdx];
      if(!subj){ grid.appendChild(document.createElement('div')).className = 'sched-cell sched-empty'; return; }
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

      const room = subjectRoom(rus, schedRoomFor(subj));
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

function schedLessonsOn(date){
  const key = SCHED_DAY_KEYS[(date.getDay()+6)%7];
  if(!key) return [];                       // суббота и воскресенье
  const pattern = schedPatternFor(schedGetMonday(date));
  return schedDay(pattern, key).map((subj, idx)=>({
    slot: idx,
    time: schedTimes()[idx],
    subject: SCHED_RUS[subj] || subj,
    room: subjectRoom(SCHED_RUS[subj] || subj, schedRoomFor(subj)),
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
    const from = slotMinutes(l.time), to = from + slotLength();
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

/* Школьные даты СОР раньше были вписаны прямо в код — их видел любой,
   кто открывал сайт. Теперь они лежат в зашифрованном блоке вместе с
   расписанием и добавляются в DATA.summatives только после ввода ключа,
   один раз на устройство. Новые СОР заводятся как обычно: вручную или
   строкой «физика сор 15 окт». */
const SUMM_SYNC_KEY = 'summatives-synced-version';
const SUMM_SYNC_VERSION = 3;

function summKey(subject, due){ return (subject||'') + '|' + (due||''); }

function addOfficialSummatives(list){
  if(!Array.isArray(list)) return 0;
  if(Number(localStorage.getItem(SUMM_SYNC_KEY)||0) >= SUMM_SYNC_VERSION) return 0;
  const present = new Set(DATA.summatives.map(item => summKey(item.subject, item.due)));
  let added = 0;
  list.forEach(([subject, due])=>{
    if(present.has(summKey(subject, due))) return;
    present.add(summKey(subject, due));
    DATA.summatives.push({
      id: uid(), subject, due, title: 'Суммативная работа', kind: 'sor',
      score: null, maxScore: 100, notes: '', done: false,
      source: 'schedule', createdAt: Date.now()
    });
    added++;
  });
  localStorage.setItem(SUMM_SYNC_KEY, String(SUMM_SYNC_VERSION));
  return added;
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

/* DATA_READY — пока данные не прочитаны (например, ждём пароль),
   ничего не сохраняем: иначе пустой DATA затёр бы зашифрованную копию. */
let DATA_READY = false;

async function loadData(){
  let parsed = null;
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) parsed = JSON.parse(raw);
  }catch(e){
    console.log('Сохранённых данных нет, начинаем с пустого', e);
  }
  if(isLockedEnvelope(parsed)){
    parsed = await askPassword(parsed);       // ждём, пока введут пароль
  }
  if(parsed) DATA = normalizeData(parsed);
  DATA_READY = true;
  migrateActivityLog();
  migrateLegacySummatives();
  renderAll();
  updateSubjectsDatalist();
  await refreshPlan();
  await unlockFromLink();
}

/* в коде новая версия плана — подтягиваем её сохранённым ключом,
   чтобы не вводить ключ заново после каждого обновления */
async function refreshPlan(){
  if(!hasPlan() || !DATA.plan.key || !cryptoAvailable()) return;
  try{
    const key = await crypto.subtle.importKey('raw', b64uToBytes(DATA.plan.key), 'AES-GCM', false, ['decrypt']);
    const plan = await openBlob(key, PLAN_BLOB);
    if(!plan) return;
    const needSchedule = plan.schedule && !hasSchedule();
    if((plan.v || 1) <= (DATA.plan.v || 1) && !needSchedule) return;
    if(needSchedule) applySchedule(plan);
    mergePlan(plan);
    await saveData();
    renderAll();
  }catch(e){ /* ключ не подошёл — оставляем то, что есть */ }
}

/* сохранения идут строго по очереди: шифрование асинхронное, и без
   очереди более старая версия могла бы записаться поверх новой */
let saveQueue = Promise.resolve();

function saveData(){
  if(!DATA_READY) return saveQueue;
  const json = JSON.stringify(DATA);
  saveQueue = saveQueue.then(async ()=>{
    try{
      const value = LOCK_KEY ? JSON.stringify(await sealData(json)) : json;
      localStorage.setItem(STORAGE_KEY, value);
      flashSaved();
    }catch(e){
      console.error('Ошибка сохранения', e);
    }
  });
  return saveQueue;
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
      schedDay(pattern, dayKey).forEach((subj, slot)=>{
        const date = new Date(monday);
        date.setDate(monday.getDate() + dayIdx);
        const dateStr = schedDateKey(date);
        const time = schedTimes()[slot];
        const room = schedRoomFor(subj);
        events.push({
          uid: `lesson-${pattern}-${dayIdx}-${slot}`,
          start: icsLocalStamp(dateStr, time),
          end:   icsLocalStamp(dateStr, addMinutesToTime(time, slotLength())),
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

const DATA_LISTS = ['lessons','homework','events','goals','summatives','notes','fun'];
const DATA_SETS = ['extraSubjects','hiddenSubjects'];

function emptyData(){
  return {lessons:[], homework:[], events:[], goals:[], summatives:[], notes:[], fun:[],
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
    if(!hasSchedule() && incoming.schedule) DATA.schedule = incoming.schedule;
    if(!hasPlan() && incoming.plan && Array.isArray(incoming.plan.items)) DATA.plan = incoming.plan;
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
    document.querySelectorAll('.tab-btn').forEach(b=>{ b.classList.remove('active'); b.removeAttribute('aria-current'); });
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    if(btn.dataset.view === 'calendar'){ calAnim = 'fade'; renderCalendar(); }
    if(btn.dataset.view === 'plan'){ planEnter = true; renderPlan(); }
    if(btn.dataset.view === 'schedule') renderSchedule();
    closeMobileNav();
    syncBottomNav();
    const label = btn.querySelector('.label');
    document.title = (label ? label.textContent + ' — ' : '') + 'Мой органайзер';
  });
});


/* ---- нижняя панель на телефоне ---- */
function syncBottomNav(){
  const active = document.querySelector('.view.active');
  const current = active ? active.id.replace('view-','') : '';
  document.querySelectorAll('.bottom-nav button[data-view]').forEach(btn=>{
    const isActive = btn.dataset.view === current;
    btn.classList.toggle('active', isActive);
    if(isActive){ btn.setAttribute('aria-current', 'page'); } else { btn.removeAttribute('aria-current'); }
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

  renderUrgent();
  renderMobileTitle();
  renderTodayLessons();
  renderWorkload();
  renderActivityHeatmap();
  renderOrbit();
  renderTicker();
}

/* бегущая строка внизу героя: живые цифры вместо декоративного текста */
function renderTicker(){
  const el = document.getElementById('hero-ticker');
  if(!el) return;
  const hw = DATA.homework.filter(h=>!h.done).length;
  const sm = DATA.summatives.filter(x=>!x.done).length;
  const ev = DATA.events.filter(e => !e.date || daysUntil(e.date) >= 0).length;
  const gl = DATA.goals.filter(g=>goalPercent(g)<100).length;
  const streak = computeStreak();
  const now = new Date();
  const parts = [
    now.toLocaleDateString('ru-RU', {weekday:'long'}),
    now.getDate() + ' ' + MONTHS[now.getMonth()],
    hw + ' ' + plural(hw,'задание','задания','заданий'),
    sm + ' ' + plural(sm,'суммативка','суммативки','суммативок'),
    ev + ' ' + plural(ev,'событие','события','событий'),
    gl + ' ' + plural(gl,'цель','цели','целей'),
    streak + ' ' + plural(streak,'день','дня','дней') + ' подряд'
  ];
  const run = parts.map(t => `<span>${escapeHtml(t)}</span><i></i>`).join('');
  const html = `<div class="ticker-run">${run}</div>`.repeat(3);    // три копии: на широком экране без разрыва
  if(el.dataset.sig === html) return;      // не перезапускаем бег, если ничего не изменилось
  el.dataset.sig = html;
  el.innerHTML = html;
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
    cells += `<div class="heat-col" style="--i:${cells.split('heat-col').length - 1}">${col}</div>`;
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

  const bars = days.map((d, di)=>{
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
    return `<div class="wl-col${weekend?' weekend':''}" style="--i:${di}" title="${escapeHtml(title)}">
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


/* ============ СВОДКА «ЧТО ГОРИТ» ============ */
/* Полоса наверху обзора. Показывается только когда есть о чём
   предупредить — пустую плашку «всё хорошо» видеть каждый день незачем. */

function urgentBuckets(){
  const open = DATA.homework.filter(h => !h.done && h.due);
  const sor  = DATA.summatives.filter(x => !x.done && x.due);
  const by = (list, test) => list.filter(i => test(daysUntil(i.due)));
  return {
    overdue: by(open, d => d < 0),
    today:   by(open, d => d === 0),
    tomorrow:by(open, d => d === 1),
    sorSoon: by(sor,  d => d >= 0 && d <= 2)
  };
}

function renderUrgent(){
  const wrap = document.getElementById('urgent');
  if(!wrap) return;
  const b = urgentBuckets();

  const parts = [];
  if(b.overdue.length)  parts.push({cls:'bad',  n:b.overdue.length,  word:['просрочена','просрочены','просрочено'], tail:''});
  if(b.today.length)    parts.push({cls:'warn', n:b.today.length,    word:['задача','задачи','задач'], tail:' на сегодня'});
  if(b.tomorrow.length) parts.push({cls:'soft', n:b.tomorrow.length, word:['задача','задачи','задач'], tail:' на завтра'});
  if(b.sorSoon.length)  parts.push({cls:'bad',  n:b.sorSoon.length,  word:['СОР','СОР','СОР'], tail:' в ближайшие дни'});

  const hot = planHot();
  if(parts.length === 0 && hot.length === 0){
    wrap.classList.remove('on');
    wrap.innerHTML = '';
    return;
  }

  const minutes = [...b.overdue, ...b.today].reduce((sum, h) => sum + taskMinutes(h), 0);
  wrap.classList.add('on');
  wrap.innerHTML =
    parts.map(p => `<span class="urgent-chip ${p.cls}"><b>${p.n}</b> ${plural(p.n, ...p.word)}${p.tail}</span>`).join('') +
    (minutes ? `<span class="urgent-time">≈ ${escapeHtml(formatMinutes(minutes))} работы</span>` : '') +
    (hot.length ? `<button class="urgent-chip warn urgent-plan" onclick="goToView('plan')"><b>${hot.length}</b> в плане горит →</button>` : '') +
    (parts.length ? `<button class="urgent-go" onclick="goToView('homework')">Открыть</button>` : '');
}


/* ---- шапка на телефоне: что сейчас ----
   Место в шапке одно и занято названием приложения, хотя оно и так
   написано в меню. Полезнее видеть текущий урок. */
function renderMobileTitle(){
  const el = document.getElementById('mobile-topbar-title');
  if(!el) return;

  const now = new Date();
  const lessons = schedLessonsOn(now).filter(l => !l.isHomeroom);
  const {current, next} = lessons.length ? schedNowInfo(lessons, now) : {current:null, next:null};

  if(current){
    el.innerHTML = `<b>${escapeHtml(current.subject)}</b><small>осталось ${current.leftMin} мин</small>`;
  } else if(next){
    el.innerHTML = `<b>${escapeHtml(next.subject)}</b><small>в ${escapeHtml(next.time)}</small>`;
  } else {
    el.innerHTML = '<b>Мой органайзер</b>';
  }
}

/* ============ СКОПИРОВАТЬ ДЕНЬ ТЕКСТОМ ============ */
/* Чтобы скинуть однокласснику в мессенджер. */

function dayAsText(date){
  const lessons = schedLessonsOn(date).filter(l => !l.isHomeroom);
  const key = schedDateKey(date);
  const hw  = DATA.homework.filter(h => h.due === key);
  const sor = DATA.summatives.filter(x => x.due === key);

  const lines = [date.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'})];

  if(lessons.length){
    lines.push('');
    lessons.forEach(l=>{
      const room = l.room ? ' (' + l.room + ')' : '';
      lines.push(l.time + '  ' + l.subject + room);
    });
  } else {
    lines.push('', 'Уроков нет');
  }

  if(sor.length){
    lines.push('', 'СОР:');
    sor.forEach(x => lines.push('- ' + (x.subject ? x.subject + ': ' : '') + x.title));
  }

  if(hw.length){
    lines.push('', 'Домашка:');
    hw.forEach(h => lines.push((h.done ? '+ ' : '- ') + (h.subject ? h.subject + ': ' : '') + h.title));
  }

  return lines.join('\n');
}

/* navigator.clipboard работает только на https, поэтому держим запасной путь */
async function copyText(text){
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){ /* не вышло — пробуем старым способом ниже */ }

  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }catch(e){ return false; }
}

async function copyDay(dateStr){
  const date = dateStr ? new Date(dateStr) : new Date();
  const ok = await copyText(dayAsText(date));
  lastDeleted = null;          // плашка снизу тут просто уведомление, возвращать нечего
  showUndo(ok ? 'День скопирован — можно вставлять' : 'Не получилось скопировать');
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
    const past = !isNow && slotMinutes(l.time) + slotLength() <= now.getHours()*60 + now.getMinutes();
    return '<div class="today-row' + (isNow?' now':'') + (past?' past':'') + '">' +
      '<span class="today-time">' + l.time + '</span>' +
      '<span class="today-subject">' + escapeHtml(l.subject) + '</span>' +
      '<span class="today-room">' + escapeHtml([l.room, l.teacher].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="today-marks">' + marks.join('') + '</span></div>';
  }).join('');

  wrap.innerHTML = '<div class="today-lessons-head"><span>сегодня</span><strong>' + escapeHtml(status) + '</strong>' +
    '<button class="copy-day" onclick="copyDay()">скопировать день</button></div>' + rows;
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
/* Сделанное старше месяца уходит в «Архив»: за учебный год список
   иначе разрастётся так, что в «Сделанных» ничего не найти. */
const ARCHIVE_AFTER_DAYS = 30;

function isArchived(item){
  if(!item.done) return false;
  const when = item.due || (item.createdAt ? schedDateKey(new Date(item.createdAt)) : null);
  if(!when) return false;
  return daysUntil(when) < -ARCHIVE_AFTER_DAYS;
}

const HW_STATUSES = [
  {key:'active',  label:'Активные',    test: h => !h.done},
  {key:'overdue', label:'Просроченные',test: h => !h.done && h.due && daysUntil(h.due) < 0},
  {key:'today',   label:'На сегодня',  test: h => !h.done && h.due && daysUntil(h.due) === 0},
  {key:'week',    label:'На неделю',   test: h => !h.done && h.due && daysUntil(h.due) >= 0 && daysUntil(h.due) <= 7},
  {key:'done',    label:'Сделанные',   test: h => h.done && !isArchived(h)},
  {key:'archive', label:'Архив',       test: h => isArchived(h)},
  {key:'all',     label:'Все',         test: h => !isArchived(h)}
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
  menu.innerHTML = options.map(o=>{
    // подсказываем, что уже стоит на этот день, чтобы не свалить всё в один
    const load = workloadFor(o.date);
    const marks = [];
    if(load.sor) marks.push('СОР');
    if(load.minutes) marks.push(formatMinutes(load.minutes));
    const busy = load.sor || load.minutes >= 120;
    return `<button onclick="applySnooze('${o.date}')">
      <span>${escapeHtml(o.label)}</span>
      <em class="${busy ? 'busy' : ''}">${escapeHtml(fmtDate(o.date))}${
        marks.length ? ' · ' + escapeHtml(marks.join(', ')) : ''}</em></button>`;
  }).join('');

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



/* ---- правка времени уроков ---- */
function openTimesEditor(){
  const times = schedTimes();
  const rows = times.map((t, i)=>
    `<div class="time-row"><span>${i+1}-й урок</span>
      <input data-slot="${i}" type="time" value="${escapeHtml(t)}"></div>`
  ).join('');

  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Время уроков</h3>
    <p class="import-note">В школьном расписании блоки не подписаны временем, поэтому
      сейчас стоит примерная сетка. Поправь, если звонки другие.</p>
    <div class="time-list">${rows}</div>
    <div class="field"><label>Длительность урока, минут</label>
      <input id="slot-minutes" type="number" min="20" max="120" value="${slotLength()}"></div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="resetTimes()">Сбросить</button>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="saveTimes()">Сохранить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
}

function saveTimes(){
  const box = document.getElementById('modal-box');
  const times = [];
  box.querySelectorAll('[data-slot]').forEach(input=>{
    times[Number(input.dataset.slot)] = /^\d{2}:\d{2}$/.test(input.value) ? input.value : SCHED_TIMES_DEFAULT[Number(input.dataset.slot)];
  });
  DATA.schedTimes = times;
  DATA.slotMinutes = Number(document.getElementById('slot-minutes').value) || SLOT_MINUTES_DEFAULT;
  saveData();
  renderAll();
  closeModal();
}

function resetTimes(){
  delete DATA.schedTimes;
  delete DATA.slotMinutes;
  saveData();
  renderAll();
  closeModal();
}

/* ============ УЧИТЕЛЯ И КАБИНЕТЫ ============ */
/* Кабинеты из расписания лежат в DATA.schedule.rooms и здесь не меняются.
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
  const out = {title:'', subject:'', due:'', priority:'normal', kind:'homework'};

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

  // СОР и СОЧ — только точным словом, иначе «сорт» и «сочинение» ломали бы разбор
  tokens.forEach((t,i)=>{
    if(used[i]) return;
    const n = norm(t);
    if(n === 'сор'){ out.kind = 'sor'; take(i); }
    else if(n === 'соч'){ out.kind = 'soch'; take(i); }
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

  // «физика сор 15 окт» — названия нет, и это нормально: у суммативки
  // важны предмет и дата, название подставляем стандартное
  if(parsed.kind !== 'homework' && !parsed.title && parsed.subject){
    parsed.title = 'Суммативная работа';
  }
  if(!parsed.title){
    renderQuickPreview();
    return;
  }

  if(parsed.kind === 'homework'){
    DATA.homework.push({
      id: uid(), done: false, createdAt: Date.now(), notes: '', steps: [], repeat: 'none',
      title: parsed.title, subject: parsed.subject, due: parsed.due, priority: parsed.priority
    });
  } else {
    DATA.summatives.push({
      id: uid(), done: false, createdAt: Date.now(), notes: '',
      title: parsed.title, subject: parsed.subject, due: parsed.due,
      kind: parsed.kind, score: null, maxScore: 100
    });
  }

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
    hint.textContent = 'Например: «матем параграф 12 пт !» — предмет, срок и приоритет разберутся сами. Слово «сор» или «соч» заведёт суммативку.';
    hint.classList.remove('ready');
    return;
  }
  const p = parseQuickTask(raw);
  const parts = [];
  parts.push({homework:'Домашка', sor:'СОР', soch:'СОЧ'}[p.kind]);
  const shownTitle = p.title || (p.kind !== 'homework' && p.subject ? 'Суммативная работа' : '');
  parts.push(shownTitle ? '«' + shownTitle + '»' : 'без названия');
  if(p.subject) parts.push(p.subject);
  if(p.due) parts.push(fmtDate(p.due) + ', ' + dueLabel(p.due));
  if(p.priority === 'high') parts.push('высокий приоритет');
  hint.textContent = parts.join(' · ');
  hint.classList.toggle('ready', !!shownTitle);
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
  svg += `<path class="chart-line" pathLength="1" d="${path}" fill="none" stroke="${c.mark}" stroke-width="2"
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
    svg += `<rect class="chart-bar" style="--i:${i}" x="${L}" y="${yTop}" width="${w.toFixed(1)}" height="${barH}" rx="4"
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


/* ---- фильтр по статусу для суммативок ---- */
const SUMM_STATUSES = [
  {key:'upcoming', label:'Впереди',      test: x => !x.done && x.due && daysUntil(x.due) >= 0},
  {key:'noscore',  label:'Без оценки',   test: x => x.score === null || x.score === undefined || x.score === ''},
  {key:'low',      label:'Ниже 50%',     test: x => {
      const has = x.score !== null && x.score !== undefined && x.score !== '' && Number(x.maxScore) > 0;
      return has && (Number(x.score)/Number(x.maxScore))*100 < 50;
    }},
  {key:'past',     label:'Прошедшие',    test: x => x.due && daysUntil(x.due) < 0},
  {key:'all',      label:'Все',          test: () => true}
];

let summStatus = 'upcoming';
function setSummStatus(key){ summStatus = key; renderSummatives(); }

function summStatusTest(key){
  const st = SUMM_STATUSES.find(s => s.key === key);
  return st ? st.test : (() => true);
}

function renderSummStatusChips(counts){
  const wrap = document.getElementById('summ-status-chips');
  if(!wrap) return;
  wrap.innerHTML = SUMM_STATUSES.map(st=>
    `<button class="status-chip${st.key===summStatus?' active':''}" onclick="setSummStatus('${st.key}')">` +
    `${st.label}<span>${counts[st.key]}</span></button>`
  ).join('');
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

  const bySubject = summFilterSubject === 'all'
    ? DATA.summatives
    : DATA.summatives.filter(s => (s.subject||'') === summFilterSubject);

  const counts = {};
  SUMM_STATUSES.forEach(st => counts[st.key] = bySubject.filter(st.test).length);
  renderSummStatusChips(counts);

  const filtered = bySubject.filter(summStatusTest(summStatus));
  if(filtered.length===0){
    const st = SUMM_STATUSES.find(x => x.key === summStatus);
    wrap.innerHTML = `<div class="empty-note">Ничего не подходит под фильтр «${st?st.label.toLowerCase():summStatus}».</div>`;
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

/* ============ ПРОСТОЕ ФОРМАТИРОВАНИЕ ЗАМЕТОК ============ */
/* Сначала экранируем весь текст, и только потом расставляем разметку —
   иначе вписанный в заметку html выполнился бы. */

function renderRichText(raw){
  const safe = escapeHtml(String(raw || ''));
  if(!safe.trim()) return '';

  const inline = text => text
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?)]|$)/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/[^\s<]+)/g, (m)=>{
      const href = safeUrl(m);
      return href
        ? `<a class="item-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${m}</a>`
        : m;
    });

  const out = [];
  let list = null;

  safe.split('\n').forEach(line=>{
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    if(bullet){
      list = list || [];
      list.push('<li>' + inline(bullet[1]) + '</li>');
      return;
    }
    if(list){ out.push('<ul>' + list.join('') + '</ul>'); list = null; }
    if(line.trim()) out.push('<p>' + inline(line) + '</p>');
  });
  if(list) out.push('<ul>' + list.join('') + '</ul>');

  return out.join('');
}

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
          ${item.text? `<div class="goal-desc rich">${renderRichText(item.text)}</div>`:''}
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


/* ============ РАЗВЛЕЧЕНИЯ ============ */
/* Свой список того, что посмотреть и поиграть. Ссылки вписываются
   вручную и открываются через safeUrl — в href попадают только http,
   https и mailto. */

const FUN_KINDS = {
  film:'Фильм', series:'Сериал', cartoon:'Мультфильм', video:'Видео',
  game:'Игра', music:'Музыка', book:'Книга', other:'Другое'
};

const FUN_LANGS = {
  'orig-sub':'ориг. + субтитры', 'orig':'в оригинале', 'dub':'дубляж', 'any':''
};

/* Куда идти смотреть. Ссылки на главные страницы, не на конкретные фильмы. */
const FUN_SOURCES = [
  {name:'Inoriginal',  url:'https://inoriginal.cc/',            note:'в оригинале с субтитрами'},
  {name:'YouTube',     url:'https://www.youtube.com/',          note:'ролики и фильмы'},
  {name:'TED',         url:'https://www.ted.com/talks',         note:'лекции с субтитрами'},
  {name:'Кинопоиск',   url:'https://www.kinopoisk.ru/',         note:'что вообще посмотреть'},
  {name:'IMDb',        url:'https://www.imdb.com/',             note:'рейтинги и списки'}
];

let funFilter = 'todo';

const FUN_FILTERS = [
  {key:'todo',  label:'Не смотрел', test: i => !i.done},
  {key:'done',  label:'Посмотрел',  test: i => !!i.done},
  {key:'film',  label:'Фильмы',     test: i => i.kind === 'film' || i.kind === 'cartoon'},
  {key:'series',label:'Сериалы',    test: i => i.kind === 'series'},
  {key:'game',  label:'Игры',       test: i => i.kind === 'game'},
  {key:'fav',   label:'Любимое',    test: i => (Number(i.rating)||0) >= 4},
  {key:'all',   label:'Всё',        test: () => true}
];

function setFunFilter(key){ funFilter = key; renderFun(); }

function funTest(key){
  const f = FUN_FILTERS.find(x => x.key === key);
  return f ? f.test : (() => true);
}

/* «Что посмотреть?» — случайное из того, что ещё не смотрел */
let funRollTimer = null;
function pickRandomFun(){
  const pool = DATA.fun.filter(i => !i.done);
  if(pool.length === 0) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  funFilter = 'todo';
  renderFun();
  clearTimeout(funRollTimer);
  const card = document.querySelector(`.fun-card[data-id="${pick.id}"]`);
  if(!card) return;
  document.querySelectorAll('.fun-card.picked, .fun-card.roll').forEach(el => el.classList.remove('picked', 'roll'));

  const land = ()=>{
    document.querySelectorAll('.fun-card.roll').forEach(el => el.classList.remove('roll'));
    card.classList.add('picked');
    card.scrollIntoView({block:'center', behavior:'smooth'});
    burstConfetti(card);
  };

  /* рулетка: подсветка бежит по карточкам, замедляется и останавливается на выбранной */
  const cards = [...document.querySelectorAll('#list-fun .fun-card')];
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce || cards.length < 3){ land(); return; }
  const target = cards.indexOf(card), STEPS = 14;
  let k = 0, delay = 55;
  const step = ()=>{
    cards.forEach(c => c.classList.remove('roll'));
    if(k >= STEPS){ land(); return; }
    const idx = (((target - STEPS + k) % cards.length) + cards.length) % cards.length;
    cards[idx].classList.add('roll');
    k++;
    delay *= 1.14;
    funRollTimer = setTimeout(step, delay);
  };
  step();
}

function toggleFunDone(id, evt){
  const item = DATA.fun.find(i => i.id === id);
  if(!item) return;
  item.done = !item.done;
  if(item.done && evt && evt.currentTarget) burstConfetti(evt.currentTarget);
  saveData();
  renderFun();
  renderCounts();
}


/* ============ СЕРИИ: КАКАЯ СЕЙЧАС ============ */
/* У сериала отмечать «посмотрел» целиком бессмысленно — считаем серии. */

function funProgressText(item){
  if(item.kind !== 'series') return '';
  const season = Number(item.season) || 1;
  const ep = Number(item.episode) || 0;
  return ep ? `сезон ${season}, серия ${ep}` : `сезон ${season}`;
}

function bumpEpisode(id, delta){
  const item = DATA.fun.find(i => i.id === id);
  if(!item) return;
  item.season = Number(item.season) || 1;
  item.episode = Math.max(0, (Number(item.episode) || 0) + delta);
  saveData();
  renderFun();
}

function nextSeason(id){
  const item = DATA.fun.find(i => i.id === id);
  if(!item) return;
  item.season = (Number(item.season) || 1) + 1;
  item.episode = 0;
  saveData();
  renderFun();
}


/* ---- оценка от 1 до 5 ---- */
function setFunRating(id, value, evt){
  if(evt){ evt.preventDefault(); evt.stopPropagation(); }
  const item = DATA.fun.find(i => i.id === id);
  if(!item) return;
  // повторный клик по той же звезде снимает оценку
  item.rating = (Number(item.rating) === value) ? 0 : value;
  saveData();
  renderFun();
}

function funStarsHtml(item){
  const rating = Number(item.rating) || 0;
  const stars = [1,2,3,4,5].map(n=>
    `<button class="fun-star${n <= rating ? ' on' : ''}" title="${n} из 5"
      onclick="setFunRating('${item.id}', ${n}, event)">★</button>`
  ).join('');
  return `<div class="fun-stars" role="group" aria-label="Оценка">${stars}</div>`;
}

function renderFunSources(){
  const wrap = document.getElementById('fun-sources');
  if(!wrap) return;
  wrap.innerHTML = '<div class="fun-sources-title">где смотреть</div>' +
    FUN_SOURCES.map(src=>{
      const href = safeUrl(src.url);
      if(!href) return '';
      return `<a class="fun-source" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
        <b>${escapeHtml(src.name)}</b><span>${escapeHtml(src.note)}</span></a>`;
    }).join('');
}

function renderFun(){
  renderFunSources();
  const wrap = document.getElementById('list-fun');
  if(!wrap) return;

  const counts = {};
  FUN_FILTERS.forEach(f => counts[f.key] = DATA.fun.filter(f.test).length);
  const chips = document.getElementById('fun-chips');
  if(chips){
    chips.innerHTML = FUN_FILTERS.map(f=>
      `<button class="status-chip${f.key===funFilter?' active':''}" onclick="setFunFilter('${f.key}')">` +
      `${f.label}<span>${counts[f.key]}</span></button>`
    ).join('');
  }

  wrap.innerHTML = '';
  if(DATA.fun.length === 0){
    wrap.innerHTML = '<div class="empty-note">Пока пусто. Добавь фильм, сериал или игру — ' +
      'ссылку можно взять на любом сайте из списка выше.</div>';
    return;
  }

  const list = DATA.fun.filter(funTest(funFilter))
    .sort((a,b)=>{
      if(!!a.done !== !!b.done) return a.done ? 1 : -1;
      // в «Любимом» сверху то, что оценено выше
      if(funFilter === 'fav'){
        const d = (Number(b.rating)||0) - (Number(a.rating)||0);
        if(d !== 0) return d;
      }
      return (b.createdAt||0) - (a.createdAt||0);
    });

  if(list.length === 0){
    const f = FUN_FILTERS.find(x => x.key === funFilter);
    wrap.innerHTML = `<div class="empty-note">Ничего не подходит под фильтр «${f?f.label.toLowerCase():funFilter}».</div>`;
    return;
  }

  list.forEach(item=>{
    const href = safeUrl(item.link);
    const lang = FUN_LANGS[item.lang] || '';
    const card = document.createElement(href ? 'a' : 'div');
    card.className = 'fun-card' + (item.done ? ' seen' : '');
    card.dataset.id = item.id;
    if(href){
      card.href = href;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }
    card.innerHTML = `
      <div class="fun-top">
        <span class="fun-kind">${escapeHtml(FUN_KINDS[item.kind] || 'Другое')}</span>
        ${lang ? `<span class="fun-lang">${escapeHtml(lang)}</span>` : ''}
      </div>
      <div class="fun-title">${escapeHtml(item.title)}</div>
      ${item.note ? `<div class="fun-note">${escapeHtml(item.note)}</div>` : ''}
      ${item.kind === 'series' ? `<div class="fun-progress">
        <button onclick="event.preventDefault(); event.stopPropagation(); bumpEpisode('${item.id}', -1)"
          title="Назад на серию">−</button>
        <span>${escapeHtml(funProgressText(item))}</span>
        <button onclick="event.preventDefault(); event.stopPropagation(); bumpEpisode('${item.id}', 1)"
          title="Следующая серия">+</button>
        <button class="season" onclick="event.preventDefault(); event.stopPropagation(); nextSeason('${item.id}')"
          title="Перейти к следующему сезону">сезон +</button>
      </div>` : ''}
      ${item.done ? funStarsHtml(item) : ''}
      <div class="fun-actions">
        <button class="fun-btn${item.done?' on':''}" title="${item.done?'Вернуть в список':'Отметить просмотренным'}"
          onclick="event.preventDefault(); event.stopPropagation(); toggleFunDone('${item.id}', event)">
          ${item.done ? 'посмотрел' : 'отметить'}
        </button>
        <button class="fun-btn" title="Изменить"
          onclick="event.preventDefault(); event.stopPropagation(); openModal('fun','${item.id}')">править</button>
        <button class="fun-btn del" title="Удалить"
          onclick="event.preventDefault(); event.stopPropagation(); deleteItem('fun','${item.id}')">убрать</button>
      </div>
      ${href ? '<span class="fun-go">открыть →</span>' : '<span class="fun-go muted">ссылки нет</span>'}`;
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
  document.getElementById('cnt-fun').textContent = DATA.fun.filter(i=>!i.done).length;
  const cntPlan = document.getElementById('cnt-plan');
  if(cntPlan) cntPlan.textContent = hasPlan() ? DATA.plan.items.filter(i => !i.done && i.kind !== 'idea').length : 0;
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
  renderFun();
  renderPlan();
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

const CONFETTI_COLORS = ['var(--gold)','var(--tab4)','var(--tab1)','var(--sage)','var(--tab7)','#ffffff'];
function burstConfetti(el){
  if(!el || !el.getBoundingClientRect) return;
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;

  const ring = document.createElement('span');
  ring.className = 'confetti-ring';
  ring.style.left = cx+'px';
  ring.style.top = cy+'px';
  document.body.appendChild(ring);
  ring.addEventListener('animationend', ()=>ring.remove());

  const SHAPES = ['', ' dot', ' strip'];
  for(let i=0;i<24;i++){
    const p = document.createElement('span');
    const angle = Math.random() * Math.PI * 2;
    const dist = 46 + Math.random()*110;
    p.className = 'confetti-piece' + SHAPES[i % SHAPES.length];
    p.style.left = cx+'px';
    p.style.top = cy+'px';
    p.style.setProperty('--dx', (Math.cos(angle)*dist).toFixed(0)+'px');
    p.style.setProperty('--dy', (Math.sin(angle)*dist - 36).toFixed(0)+'px');
    p.style.setProperty('--fall', (50 + Math.random()*90).toFixed(0)+'px');
    p.style.setProperty('--rot', (Math.random()*720-360).toFixed(0)+'deg');
    p.style.animationDuration = (0.9 + Math.random()*0.5).toFixed(2)+'s';
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
  events:'событие', goals:'цель', notes:'заметку', fun:'запись'
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
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<span id="undo-text"></span><button onclick="undoDelete()">Вернуть</button>';
    document.body.appendChild(bar);
  }
  document.getElementById('undo-text').textContent = text;
  // «Вернуть» показываем, только когда есть что возвращать
  const undoBtn = bar.querySelector('button');
  if(undoBtn) undoBtn.style.display = lastDeleted ? '' : 'none';
  bar.classList.add('open');
  bar.style.setProperty('--undo-ms', UNDO_MS + 'ms');
  bar.classList.remove('tick'); void bar.offsetWidth; bar.classList.add('tick');   // полоска-таймер заново

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
  fun: [
    {key:'title', label:'Название', type:'text', required:true},
    {key:'kind', label:'Что это', type:'select', default:'film', options:[
      {value:'film',   label:'Фильм'},
      {value:'series', label:'Сериал'},
      {value:'cartoon',label:'Мультфильм'},
      {value:'video',  label:'Видео'},
      {value:'game',   label:'Игра'},
      {value:'music',  label:'Музыка'},
      {value:'book',   label:'Книга'},
      {value:'other',  label:'Другое'}
    ]},
    {key:'link', label:'Ссылка', type:'text'},
    {key:'season', label:'Сезон (для сериала)', type:'number', default:1},
    {key:'episode', label:'На какой серии остановился', type:'number'},
    {key:'lang', label:'Язык', type:'select', default:'orig-sub', options:[
      {value:'orig-sub', label:'Оригинал с субтитрами'},
      {value:'orig',     label:'Оригинал без субтитров'},
      {value:'dub',      label:'Дубляж'},
      {value:'any',      label:'Не важно'}
    ]},
    {key:'note', label:'Заметка', type:'textarea'}
  ],
  notes: [
    {key:'title', label:'Заголовок', type:'text', required:true},
    {key:'subject', label:'Предмет (не обязательно)', type:'text', list:'subjects-datalist'},
    {key:'text', label:'Текст', type:'textarea'}
  ]
};

const TITLES = {lessons:'урок', homework:'задание', summatives:'суммативка', events:'событие', goals:'цель', notes:'заметка', fun:'что посмотреть'};


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

/* Копия окна доигрывает анимацию ухода и удаляется. Само окно закрыто сразу,
   поэтому «закрыть и тут же открыть другое» работает как раньше. */
function fxGhostOut(el){
  if(!el || !el.classList.contains('open')) return;
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ghost = el.cloneNode(true);
  const src = el.querySelectorAll('input,textarea,select');
  const dst = ghost.querySelectorAll('input,textarea,select');
  src.forEach((n, i)=>{
    if(!dst[i] || n.type === 'file') return;
    if(n.type === 'checkbox' || n.type === 'radio') dst[i].checked = n.checked; else dst[i].value = n.value;
  });
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  ghost.classList.add('fx-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  document.body.appendChild(ghost);
  setTimeout(()=> ghost.remove(), 260);
}

function closeModal(){
  fxGhostOut(document.getElementById('overlay'));
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
  if(e.key === 'Escape'){ closeModal(); closeMobileNav(); }
});

/* ============ CALENDAR ============ */
function dayItemsFor(dateObj){
  const ds = dateObj.toDateString();
  const hw = DATA.homework.filter(h=>h.due && new Date(h.due).toDateString()===ds);
  const summ = DATA.summatives.filter(s=>s.due && new Date(s.due).toDateString()===ds);
  const ev = DATA.events.filter(e=>e.date && new Date(e.date).toDateString()===ds);
  const plan = hasPlan()
    ? DATA.plan.items.filter(p=>p.date && !p.when && p.kind !== 'idea' && new Date(p.date).toDateString()===ds)
    : [];
  return {hw, summ, ev, plan};
}

function renderCalendar(){
  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  document.getElementById('cal-month-label').textContent = MONTHS_NOM[m] + ' ' + y;

  const grid = document.getElementById('cal-grid');
  /* каскад ячеек — только при входе в раздел и листании месяца,
     а не при каждой перерисовке после клика по дню */
  grid.classList.remove('cal-fade', 'cal-next', 'cal-prev');
  if(calAnim){ void grid.offsetWidth; grid.classList.add('cal-' + calAnim); calAnim = ''; }
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

  cells.forEach((c, idx)=>{
    const cell = document.createElement('div');
    cell.style.setProperty('--i', Math.floor(idx / 7) + idx % 7);
    cell.className = 'cal-cell' + (c.other? ' other':'') + (c.dateObj.toDateString()===today.toDateString() ? ' today':'');
    if(selectedDay && c.dateObj.toDateString()===selectedDay.toDateString()) cell.classList.add('selected');
    const {hw, summ, ev, plan} = dayItemsFor(c.dateObj);
    let dots = '';
    hw.forEach(()=> dots += `<i style="background:var(--tab1)"></i>`);
    summ.forEach(()=> dots += `<i style="background:var(--brick)"></i>`);
    ev.forEach(()=> dots += `<i style="background:var(--tab4)"></i>`);
    plan.forEach(p=> dots += `<i style="background:var(--gold)${p.done ? ';opacity:.35' : ''}"></i>`);
    cell.innerHTML = `<div class="cal-daynum">${c.dayNum}</div><div class="cal-dots">${dots}</div>`;
    cell.addEventListener('click', ()=>{ selectedDay = c.dateObj; renderCalendar(); showDayPanel(c.dateObj); });
    grid.appendChild(cell);
  });
}

function showDayPanel(dateObj){
  const panel = document.getElementById('day-panel');
  panel.style.display = 'block';
  document.getElementById('day-panel-title').innerHTML =
    escapeHtml(dateObj.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'})) +
    `<button class="copy-day" onclick="copyDay('${schedDateKey(dateObj)}')">скопировать</button>`;
  const {hw, summ, ev, plan} = dayItemsFor(dateObj);
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

  if(hw.length===0 && summ.length===0 && ev.length===0 && plan.length===0){
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
  plan.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<div class="check ${item.done?'done':''}" onclick="togglePlanDone('${item.id}', event); showDayPanel(selectedDay);"></div>
      <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml([item.time, item.summary].filter(Boolean).join(' · ') || (item.kind === 'todo' ? 'дело' : 'дедлайн'))}</div></div>
      <button class="tag plan-cal-tag" onclick="openPlanItem('${item.id}')">план →</button><span></span>`;
    listEl.appendChild(row);
  });
}

let calAnim = '';   // 'fade' | 'next' | 'prev' — как показать сетку при следующей отрисовке
function calShift(dir){
  calDate = new Date(calDate.getFullYear(), calDate.getMonth()+dir, 1);
  calAnim = dir > 0 ? 'next' : 'prev';
  renderCalendar();
}
function calGoToday(){
  calDate = new Date();
  selectedDay = new Date();
  calAnim = 'fade';
  renderCalendar();
  showDayPanel(selectedDay);
}

/* ============ UTIL ============ */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ============ ПРИВАТНОСТЬ ============ */
/* Две защиты.
   1. Личное расписание и школьные даты СОР лежат в коде только в
      зашифрованном виде (AES-GCM). Ключа в репозитории нет — без него
      это набор случайных символов. Ключ вводится один раз на устройство
      (или открывается ссылка вида …/#key=КЛЮЧ), после чего расписание
      хранится в DATA этого браузера, как и всё остальное.
   2. Пароль на вход (по желанию). Тогда DATA в localStorage тоже лежит
      зашифрованным: ключ выводится из пароля (PBKDF2, 310 000 итераций),
      живёт только в памяти вкладки и пропадает при закрытии. */

const PERSONAL_BLOB = {
  iv: 'jdF-V4IkZneE5Gnw',
  ct: 'VLksTvS2DZ2IiDbPGbQeZt_idHPxVDHrLUUcOB4V2NAwHU6zmXZ3-pGXG5ZJaPkA8WoFu_uJeqXRk-wthxUqQ_VMvMV6QYSu' +
      'wczOid-sbr1owgW-2ADKbe8c4x6IvgYE0-h3VsGgnSQ9RVHK0_b5gfat3yLZfNK-80frCfxbqNcMR9iMJJWAwnj1R2qpYXGO' +
      'gezOZ3-brqOFymG9wR0eISPEHDPcMU3Zoz44mJUox-97KdHrABUIitykefiDUAniiN1nQ5seTflLlmZck46-sFcjjJfFYj75' +
      'gMg1STccB9KfmKwyCcbj72FBjWkLrTc60AxvYUIoUusx8iL4lVtAPqsEkzm3MZEq-uOK3GrCJ1mPy5d6Lal4Ig1CJZknnlyy' +
      'AOm4ZnXRQufjgP2HfKpIRVWBJRJMSQCRekR4zUyN5xMf0yge8t8vUUwJ6WZq6hQDhIKXttnU84uNX3Vu3onYHFbkMeUry3m3' +
      'q_NsV5WWmsHUSHIYWlRGDnYdB0VSxnEJ-Kbed8IZiMkE5dkM7_oBw-RAevUab8Qnv2ZyNYm-se7ICSRowAJbGVIIkBKkqFwc' +
      '0kXQTyPo7Vw05eH-u7HcdtRkxVpuo-ejnFzpwBA37dkeBuiAjPVjLj1gSNl30MDj6UC0TF5IVUyd7Tg9JbIV5GRHHIKlSIuc' +
      'x4JreS6pLtBfvsVdPfWN5x7_yomZP3dlKfuNSNVlG4zuhy_FBevf0P5jqe6miupUppY5HmSMWUSyZ4sSYqkwWtlyOXl5RXtA' +
      'uLrGzEW25EsNbGZF3wGKA8MqHRgHxUBL-3e2A8dsnAKEITKKRSl-xqm-_-Atf3vLX2hq_ER8C3i0c8bYpWE4CDA5-8auRFYT' +
      'PEyEBYLKDFW8wNk0yqDo4Ug_cyVdUA2V_PH6yf7XbWZt3NHIp26_ENe9rseDco8hEoEtUEM42y8UBdJHHoRRTxBPwMUs5Z7m' +
      'lPAuWsTe5gI_ffT4mnBX1wr-q0RHNZXjAvPoDn-i85XKsHP-z7ItDu5oSzPYfQPrF3FMA6jB1X70REy1Fn3_RAdSP03vDz5g' +
      '-H3DNr4y_iOk-s-TC8YF0Hhq3p4lM7wsWPmqe-2HOMvxt2RnKdteGWhSn_bixeZrDAhWWXXz9CEE1VQlg8s3QXpLKkNKEmY0' +
      'ZtMbiRDkrJtnPaJ1cbr17hz14uTQX6uiBEIuVUHTOuh8ZqA-B4JcY0q6cXFKrLz_2u0YrkXWu-Uyz3Cs_e23lBjQS-euQlFH' +
      'M_pAqdcba5x0cDErsvRV7gA5Xr8_IuSMJl3mzaP6usUCtWCj168r1DrDqpS8-aOEPOR8Oo5oFWuYyjCrCfvfJDllvOEIZ44s' +
      'V4ZwyEPbr8jR2wDb5S4VJ2Z8VoA2G0fEcpVVR2WTwSfWgYJZW0zjnLkhSBpCnAEiAzfBh2OcqQkGcBO-qPxNIv47obGG92fC' +
      'rIIuDtW4UlBKcuf1SoFeEANHyzqI3CSYpvyJ85r3XMFJ3f6jdVTuXsF40Ys81Grz2qUe-C-tvEuX7-1JbKh-bTRlB5kJ9urb' +
      'Hs5hnWsu-Prcmr15sB1jyilrcMk9kgsETLMFMB9ZqqoaSAglcTsvJhUiA-G4PzV6YR_XTpeTOdbku4oZ75eGRm4lRq_M2ytN' +
      'hcxnFmugkP7PnsEhjrd8ryiW-TOvwUN5WNrXRPMqhrpTh_M7252iiekqY11cOSYnI25Wk2enSsuXOssTZs5aitlEU_w-XC5M' +
      '9mE0WlNsEFhE6NqfWFybyH85ZhCIlOaJ-PxLR-tFXblk6JwnaXrRfIj4reh7Z3Gn6T-8UX9DHpp5OFTfrOmI1_GC9Vppheow' +
      'ggRb5QvRVsFHgxpjJXzT_HkEdDUO68QRyeWp1GbczCceFZdWj85QKzdYhx8Xyu1-O3kMwOFz3wOMuLHB89QXPnoARvItDp8G' +
      'JTVZJYO7HTpyvfaISIH0SeCmXaOz0N-CwRHtvtP_bvByK6yii3wMb4-yDvIAAQGkMMYO7c_WYWGTGoikNJ67n0DbvET2B3Hr' +
      'NEyZs7uIlIZcjafWxTlqDrnBQvIReWOpaz0M8KQfAMKCSiocyVJPDXpxGRgCuUHVC3TB_4XH-1UIerpOLh4c7yIayoGcx9XF' +
      '7lr--au4pTFgPGyfHR4c7WvurctBy8HRuJvggIlO3W259uF-RTtj8B_fwff-gsSIaxVD4aaNdpdOiJJjBP79cZcrvkSnEqnX' +
      'dUSlMDFAb-e8Y_9N2gi_pQlErkTMkhwGydjoxnuvTSA1NM-AsnSL53N2C6Dt4iLfjXesi3GCadNnX8T1a2CfkCX8wtkQ6Lab' +
      'Dq4KPuTZY3M3a6KptdeD0gnCvJJMAq-0Emgo-h7tihNi3BPWbFoyrindR2yGqgEW3YGpam1iiVRnsq68Xl-RomfgGZtTgR1v' +
      'g_lQaqJlAGu3uSgYm9zAkC_LlqBgC3qiVSqOoXP-11z8hBdI469q2CcEzDY4PFoXj_7kEt9zU9IzgdhtRa6M7KighnOWOp3B' +
      '4PEpfqfP17BtFJDY_mZWAp2TTk7LfKUIIBM9Dfy6kUD3OsEmGolwjSA_cBJgGf81Lp7C2gfPraDrHAjA4CuUvMqHkEB2iFRz' +
      'BC_zKXC4yWub5VY3Lmtwx4zcTZ7i6ptGSBiq-tVQQI2LxGA9azTbyu7h-9eqR6vuTcmbCF0x-cg7DWUeDJnX3p7MBePbjLee' +
      'HQLPUXluqg4ApUowuxdykkeHNgYOn2sJJTYiGsVH6C9n3acOV_Fana6ooF6LkoN0KzskhcJjCBxjCPQDiR1oz0JhHuYSfZ04' +
      'BQ9NlLaihYEx7g8USu5wKv1Hsd3DRxB5YBe_qQdUUhTM0hMkzPKzXke28waxwTbEand4PoQQDcaCKq1ZE7pNAZZZ3vtzfrg1' +
      'LG0mQc5LxClc6rT5NrlLIB_5a2wX9ovUoitTKOUQyxXasufH7ngCMYz8z74N-0ZCWf2EZUs_TYdUER7ep62grn5ra8lq2kqy' +
      'Y3gjsk6KJqZSeLmwf8YkSxHvVBLJkbn53wKqGi5aeVenRlutBB2choo45huWR-W15MT2gTp6WtTCBAVWSYgBWy0LDL1rbBuv' +
      'WvStBzOhAfPpufn8E02_aPzqgn-PwyG2hIFwSO2ZT7eWXG5-ewQswuNy5gK6AWXO-lUGF5pgNphkOKsLMbm8e3eLGGeHKYRY' +
      '8pht-BWbNaMDRsMuqO35bTo4RmtsI0kVotAhyBM56UCQpixvknXC5oWZA4J5YX3NTNf2Y_0r_rSex6ZZa3sCDWjFvTf1Z8CH' +
      'qzXfx8mEQVc8o9FKLEKpEbCITFKbIKYYwCcES0JezkLr8Wihb2Elj2sFj7x6LvZKIoau7CxmgaTJvujH0UtDpi76AVmCLKir' +
      'vE0O7cn5Y15_jN6hIHSBttjU2hu3q8m3BowvWWzjdRbLJWrcF9L_B7e00bBUV4TMIuj8e46wzKk-EYQvLC85oJ9SmWZb3-v-' +
      'jIMT5bGDbhDdbiCfXOZaiMMKk7T_pRyds7zL7nZfClO3NcrxrvoBmBBCEtRxtSBMOVdhOQ3em8NspGU9lkKm-B7P3SLCCIky' +
      'b5ANXk4ZjKM2zuz21REwXP94VDbkJCMa2xnwMZn82Qo_nzclQK5GVR_mNrCPmuFJSPZWiWODnKYbkjH4dSYoUpRYYxy9EKHo' +
      '315FXPp1m4WRqizPA8o6ew8alTO_cHO0MLIyH5Ze2RGzbGRXNXfTt0IovmPMObetbA-wtVPuhAthqtZsIm7mZGURRBZOfi-T' +
      'Jo9M5TWWgckxeTTFyI0_L8IJIjs6R-ZHbM6mQWokNS9A5rRlDQwx3kcMNL926FU'
};

function b64uToBytes(str){
  const s = String(str).replace(/-/g,'+').replace(/_/g,'/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, ch => ch.charCodeAt(0));
}

function bytesToB64u(bytes){
  let bin = '';
  for(let i = 0; i < bytes.length; i += 0x8000){
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function cryptoAvailable(){
  return !!(window.crypto && crypto.subtle);
}

/* ---- ключ к личному расписанию ---- */

async function unlockPersonal(input){
  if(!cryptoAvailable()) return {ok:false, why:'Браузер не даёт шифрование: открой сайт по https, а не файлом с диска.'};
  const clean = String(input || '').trim().replace(/^.*#key=/, '').replace(/\s+/g, '');
  let raw;
  try{ raw = b64uToBytes(clean); }catch(e){ raw = null; }
  if(!raw || raw.length !== 16) return {ok:false, why:'Ключ не подошёл. Проверь, что скопирован целиком.'};
  let key;
  try{ key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); }
  catch(e){ return {ok:false, why:'Ключ не подошёл. Проверь, что скопирован целиком.'}; }

  // один ключ — к расписанию, другой — к плану; пробуем оба замка
  const personal = await openBlob(key, PERSONAL_BLOB);
  const plan = await openBlob(key, PLAN_BLOB);
  if(!personal && !plan) return {ok:false, why:'Ключ не подошёл. Проверь, что скопирован целиком.'};

  let added = 0, schedule = false;
  // расписание есть и в старом замке, и внутри плана — берём любое
  const withSchedule = [personal, plan].find(x => x && x.schedule);
  if(withSchedule && !hasSchedule()){
    added = applySchedule(withSchedule);
    schedule = true;
  }
  if(plan){ mergePlan(plan); DATA.plan.key = clean; }
  await saveData();
  renderAll();
  updateSubjectsDatalist();
  return {ok:true, added, schedule, plan: !!plan, already: !!personal && !schedule && !plan};
}

function applySchedule(source){
  DATA.schedule = source.schedule;
  return addOfficialSummatives(source.summatives);
}

async function openBlob(key, blob){
  try{
    const plain = await crypto.subtle.decrypt(
      {name:'AES-GCM', iv: b64uToBytes(blob.iv)}, key, b64uToBytes(blob.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }catch(e){
    return null;
  }
}

/* ссылка …/#key=КЛЮЧ: подключаем и сразу стираем ключ из адресной строки,
   чтобы он не остался в истории и не попал на скриншот */
async function unlockFromLink(){
  const m = /[#&]key=([A-Za-z0-9_-]+)/.exec(location.hash);
  if(!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  const res = await unlockPersonal(m[1]);
  if(res.ok && res.plan){ closeModal(); goToView('plan'); return; }
  openPrivacy(res.ok ? personalOkText(res) : res.why, !res.ok);
}

// приложение уже открыто, а в адресе поменялась только часть после #
window.addEventListener('hashchange', ()=>{ if(DATA_READY) unlockFromLink(); });

function personalOkText(res){
  if(res.already) return 'Расписание уже подключено на этом устройстве.';
  const parts = [];
  if(res.schedule) parts.push('расписание подключено' +
    (res.added ? ` (добавлено СОР из школьного расписания: ${res.added})` : ''));
  if(res.plan) parts.push('план открыт — он в разделе «Мой план»');
  return 'Готово: ' + parts.join(', ') + '.';
}

function forgetSchedule(){
  if(!confirm('Убрать расписание с этого устройства? Задачи и суммативки останутся. Вернуть можно тем же ключом.')) return;
  delete DATA.schedule;
  saveData();
  renderAll();
  openPrivacy('Расписание убрано с этого устройства.');
}

/* ---- пароль на вход ---- */

const LOCK_ITER = 310000;
const LOCK_MIN_LENGTH = 4;
const AUTOLOCK_MS = 5 * 60 * 1000;
let LOCK_KEY = null;
let LOCK_SALT = null;

function isLockedEnvelope(x){
  return !!(x && x.locked === 1 && x.salt && x.iv && x.ct);
}

async function deriveLockKey(password, salt, iterations){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}

async function sealData(json){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, LOCK_KEY, new TextEncoder().encode(json));
  return {locked:1, v:1, iter:LOCK_ITER, salt:bytesToB64u(LOCK_SALT), iv:bytesToB64u(iv), ct:bytesToB64u(new Uint8Array(ct))};
}

async function openEnvelope(env, password){
  const salt = b64uToBytes(env.salt);
  const key = await deriveLockKey(password, salt, Number(env.iter) || LOCK_ITER);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv: b64uToBytes(env.iv)}, key, b64uToBytes(env.ct));
  const data = JSON.parse(new TextDecoder().decode(plain));
  LOCK_KEY = key;
  LOCK_SALT = salt;
  return data;
}

/* экран входа: пока пароль не введён, данные даже не расшифрованы */
function askPassword(env){
  return new Promise(resolve=>{
    const screen = document.createElement('div');
    screen.className = 'lock-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-labelledby', 'lock-title');
    screen.innerHTML = `<form class="lock-card" id="lock-form">
        <div class="lock-mark" aria-hidden="true">Я</div>
        <h2 id="lock-title">Органайзер закрыт паролем</h2>
        <p class="lock-sub">Данные на этом устройстве зашифрованы.</p>
        <input class="lock-input" id="lock-input" type="password" autocomplete="current-password"
          placeholder="Пароль" aria-label="Пароль" required>
        <div class="lock-error" id="lock-error" role="alert"></div>
        <button class="btn-primary lock-submit" type="submit">Открыть</button>
        <button class="link-btn lock-forgot" type="button">Забыл пароль</button>
      </form>`;
    document.body.appendChild(screen);
    document.body.classList.add('is-locked');
    const input = screen.querySelector('#lock-input');
    const error = screen.querySelector('#lock-error');
    const submit = screen.querySelector('.lock-submit');
    setTimeout(()=>input.focus(), 50);

    const done = data => {
      screen.remove();
      document.body.classList.remove('is-locked');
      resolve(data);
    };

    if(!cryptoAvailable()){
      error.textContent = 'Браузер не даёт шифрование: открой сайт по https.';
      submit.disabled = true;
    }

    screen.querySelector('#lock-form').addEventListener('submit', async e=>{
      e.preventDefault();
      submit.disabled = true;
      error.textContent = '';
      submit.textContent = 'Проверяю…';
      try{
        done(await openEnvelope(env, input.value));
      }catch(err){
        error.textContent = 'Пароль не подошёл.';
        input.select();
        submit.disabled = false;
        submit.textContent = 'Открыть';
      }
    });

    screen.querySelector('.lock-forgot').addEventListener('click', ()=>{
      const ok = confirm('Без пароля данные не расшифровать — ни мне, ни кому-то ещё.\n\n' +
        'Если есть скачанная копия, её можно будет загрузить после сброса.\n\n' +
        'Стереть всё на этом устройстве и начать заново?');
      if(!ok) return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SUMM_SYNC_KEY);
      done(null);
    });
  });
}

function readPasswordPair(){
  const a = document.getElementById('lock-new').value;
  const b = document.getElementById('lock-repeat').value;
  if(a.length < LOCK_MIN_LENGTH) return {why:`Пароль короче ${LOCK_MIN_LENGTH} символов.`};
  if(a !== b) return {why:'Пароли не совпадают.'};
  return {password:a};
}

async function enableLock(){
  if(!cryptoAvailable()){ openPrivacy('Браузер не даёт шифрование: открой сайт по https.', true); return; }
  const pair = readPasswordPair();
  if(pair.why){ showPrivacyMsg(pair.why, true); return; }
  showPrivacyMsg('Шифрую…');
  const wasOn = !!LOCK_KEY;
  LOCK_SALT = crypto.getRandomValues(new Uint8Array(16));
  LOCK_KEY = await deriveLockKey(pair.password, LOCK_SALT, LOCK_ITER);
  await saveData();
  openPrivacy(wasOn ? 'Пароль сменён.' : 'Пароль включён. Теперь без него данные на этом устройстве не прочитать.');
}

async function disableLock(){
  if(!confirm('Выключить пароль? Данные снова будут храниться в этом браузере без шифрования.')) return;
  LOCK_KEY = null;
  LOCK_SALT = null;
  await saveData();
  openPrivacy('Пароль выключен.');
}

function lockNow(){
  saveQueue.then(()=>location.reload());
}

/* свернул приложение больше чем на 5 минут — при возврате спросим пароль */
let hiddenSince = 0;
document.addEventListener('visibilitychange', ()=>{
  if(!LOCK_KEY) return;
  if(document.hidden){ hiddenSince = Date.now(); return; }
  if(hiddenSince && Date.now() - hiddenSince > AUTOLOCK_MS) lockNow();
  hiddenSince = 0;
});

/* ---- окно «Приватность» ---- */

function showPrivacyMsg(text, isError){
  const el = document.getElementById('privacy-msg');
  if(!el) return;
  el.textContent = text || '';
  el.classList.toggle('is-error', !!isError);
}

function openPrivacy(message, isError, mode){
  const box = document.getElementById('modal-box');
  const lockOn = !!LOCK_KEY;
  const passwordFields = `
      <div class="field"><label for="lock-new">${lockOn ? 'Новый пароль' : 'Пароль'}</label>
        <input id="lock-new" type="password" autocomplete="new-password" minlength="${LOCK_MIN_LENGTH}"></div>
      <div class="field"><label for="lock-repeat">Ещё раз</label>
        <input id="lock-repeat" type="password" autocomplete="new-password"></div>`;

  const scheduleBlock = hasSchedule()
    ? `<p class="privacy-status on">Подключено на этом устройстве.</p>
       <div class="privacy-actions"><button class="btn-ghost" onclick="forgetSchedule()">Убрать с этого устройства</button></div>`
    : `<p class="privacy-status">На этом устройстве не подключено. В коде сайта оно лежит
         зашифрованным — без ключа его никто не прочитает.</p>`;

  const planBlock = hasPlan()
    ? `<p class="privacy-status on">Открыт на этом устройстве — раздел «Мой план».</p>
       <div class="privacy-actions"><button class="btn-ghost" onclick="forgetPlan()">Убрать с этого устройства</button></div>`
    : `<p class="privacy-status">Дедлайны, дела и идеи. В коде сайта лежат зашифрованными,
         раздел появится только после ключа.</p>`;

  const keyBlock = (hasSchedule() && hasPlan()) ? '' : `
    <section class="privacy-section">
      <h4>Ввести ключ</h4>
      <p class="import-note">Ключ к плану подключает и план, и расписание. Старый ключ к расписанию тоже подходит.</p>
      <div class="field"><label for="personal-key">Ключ</label>
        <input id="personal-key" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="22 символа"></div>
      <div class="privacy-actions"><button class="btn-primary" onclick="submitPersonalKey()">Подключить</button></div>
    </section>`;

  let lockBlock;
  if(lockOn && mode !== 'change'){
    lockBlock = `<p class="privacy-status on">Включён. Если свернуть приложение больше чем на 5 минут, пароль спросят снова.</p>
      <div class="privacy-actions">
        <button class="btn-ghost" onclick="disableLock()">Выключить</button>
        <button class="btn-ghost" onclick="openPrivacy('', false, 'change')">Сменить</button>
        <button class="btn-primary" onclick="lockNow()">Закрыть сейчас</button>
      </div>`;
  } else {
    lockBlock = `<p class="privacy-status">${lockOn ? 'Придумай новый пароль.' :
        'Выключен. Включи, если телефоном или компьютером пользуется кто-то ещё.'}</p>
      ${passwordFields}
      <p class="import-note">Пароль нигде не хранится. Забудешь — данные не восстановить,
        поэтому сначала <button class="link-btn" onclick="exportBackup()">скачай копию</button>.</p>
      <div class="privacy-actions">
        ${lockOn ? '<button class="btn-ghost" onclick="openPrivacy()">Отмена</button>' : ''}
        <button class="btn-primary" onclick="enableLock()">${lockOn ? 'Сменить пароль' : 'Включить пароль'}</button>
      </div>`;
  }

  box.innerHTML = `<h3>Приватность</h3>
    <p class="import-note">Задачи, домашка, суммативки, заметки и всё остальное хранятся только
      в этом браузере и никуда не отправляются. Другие люди, открыв сайт, видят пустой органайзер.</p>
    <div class="privacy-msg${isError ? ' is-error' : ''}" id="privacy-msg" role="status">${escapeHtml(message || '')}</div>
    <section class="privacy-section">
      <h4>Твоё расписание</h4>
      ${scheduleBlock}
    </section>
    <section class="privacy-section">
      <h4>Мой план</h4>
      ${planBlock}
    </section>
    ${keyBlock}
    <section class="privacy-section">
      <h4>Пароль на вход</h4>
      ${lockBlock}
    </section>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Закрыть</button></div>`;
  document.getElementById('overlay').classList.add('open');
}

async function submitPersonalKey(){
  const input = document.getElementById('personal-key');
  showPrivacyMsg('Проверяю ключ…');
  const res = await unlockPersonal(input ? input.value : '');
  if(res.ok) openPrivacy(personalOkText(res));
  else showPrivacyMsg(res.why, true);
}

/* ============ МОЙ ПЛАН ============ */
/* Дедлайны, заявки, дела и идеи. Как и расписание, в коде лежат только
   зашифрованными (PLAN_BLOB) — открываются своим ключом и дальше живут в
   DATA.plan этого браузера. Галочки, свои дела и идеи хранятся там же.
   Если в коде появится новая версия плана, тот же ключ её подтянет:
   новое добавится, отмеченное останется отмеченным. */

const PLAN_BLOB = {
  iv: 'Iuk-2_7d5b5-yw4M',
  ct: 'OVVMl_9hVwojTBwBeWxk2pzp-15FkarS6hARHOEeCpralMcVWSQ2quWhMqRfdja678kVBV0o5n_xtPbnrHUU1W0YT-' +
      'y3WJtHhIguQ3H9Vei4MZphLZWndHU4AN1Q8pEpPN_gyuSdFLkBJmP3B53Z72LAC3x3bsBHT8l825Jb9vj_Ot0cEQetBbs7AL' +
      'a9OdTpfyJWCzlELemBH_Rsyb58OHTbdTEvaq2C7RNZKlLMysnaJsidJkzcJmCBtjbVesvgWPtVCDi3KDXnyezIRK2TJvQypC' +
      'lTjqddsvO7fBBzsq2gl5LgiZr3NlBEMcKndReoY1s62LChU4YEMdi3V-' +
      'wEhLm0y3gL7lrLFLo8Hsrn_lIBQTN_EarVw_iGYM8G8ismce3bTQ-' +
      'aB2wmzfyDT8bGm3v5Zr9p7pMVMtizUv2mtvEVCBstcSzw71rkU1XEPWWs-MEyqEG8rThOdO4eJ7_MdEFcZXCq7GEFRu9Rgnd' +
      'WtdFwKWQhaKZ9RxnaZPxQFNTXDCgS2zQevRmbw5tZ6jDV694vr5GdV7v8a7qj0qYncx4RZA_Id1E90N4-zxINkyheishS-_T' +
      '032jZfIZD_W0CRA0m0hGr2-t-a93-' +
      '0DRx9vF4Bf0GEwd8FK36YboBgTRNb1mbSUv6MPI3snXfZlaQVCUl6n0dRZTWZWvuu00UJYCBpRukBZ1acHhbarnnzQlO_BKl' +
      'bxcl3wmFihJHSIFJVHAjf0Or7pytSUk9pGxOaTQqKvzgUZhbTlCE6FDpSOC2g_BVEM-' +
      'naaQ3_2xcVpiq2TEsdDXoZR1y4IOkcY8adbzfWbYhrhD0VrUX85nDD76paw-' +
      'RmsegxFpITdfkIgvwfgGw5a08IDqQTU5K3deb6FUOTL6hQ8XCKrmzzHBnG7ZEqa_OW-' +
      'mbyD440_NCW9cfzerc26UIsy5LDD4STrlOlfJ9PwtrIa3a_t5kf3ohp5Ml6xg88rSR3TQtQcnrN6TWPwAkbK-LZZnGdyIa8s' +
      'UZB2WOIDQ5Yhh0h-' +
      'mWrzsrv_Ka9l862fgCe5vEY4UACFytqjfWemsszx_fMSzcY9REK_mbfYRc9g_g8DkjBpDoxEI52GQrbvhc-' +
      'hGebUhhkd-l3BVrgrZwD3Bs4Yuwe5iUx6HljcB8ukq0Lq8A-truQRxZGFb-T3q4ETIbL0UJTBefcWf_1p2W7UIY8LX-XnNZM' +
      'K32ufPXfiMVkahaAmKj6ZE9N3Tgj4uwhkMGAgvouvzit2c7aOQQ6AijzQq6fsal4O14FTPPJKPYrRWSn8sk-' +
      '1KJSsoowrSXeF1wGAb_Fi91K-tt_merNUvhMJVWJFbI-' +
      '5X7yPOWS_8N_s9OZWtWIyqCN8_DrmBj32tPB0MSBvCx44yGzzFly7xIwubZPBiVBMMLztO6wjivJTKV04AoMccTlx-' +
      '5AWm2nDQWCyxOd2Gu4DRRZdiKvgUyarzjK_VnqufQjQOkTZUbAty2hOLMz5yckJnPcVX2pzE6i5NRnJH2IeXx0tNTa4lrWvz' +
      'HrL4JynmswQ-m7xjQz4NSWtI-IolWipmMgX_9u85dIkPEhXZA91dP5N39uFk1KTwdRTmQfjtHy5k-' +
      'ltCOnB7qeGTlrR2W5CbbN0IQwZmWcdHc1IEWT2PSjh4E-' +
      'TewleQOAV6BJfvJvfUL_Ts5l2wLlxR8j6mbUargCacckEpqRupuFsd9nQqnBNm9NSXzyOOwoAks5Vd_EV70VgXHG1g89_816' +
      '38S5nipBwJnjKxJRQyOyiKQHEroyucIh61xho724EqNXC-VfmVRUpXJH_8C3NEMIsRi3ogtMwNLR9YJnedIpXHj0yoPuvPC3' +
      'X2Vkj3AN2vD7y5ZsK6Lvd9vrKDhWTpdC4-' +
      'l6xohtJvNtsL6fD8sc7hm1NwpnSJWfly8oHcHDwBcNftWBVyBWbg4oe6ifyWqA7yFDjIGUttfLznfM-v5Bm-' +
      '7uIiFs79W02krDStHg6T4wLu3Hwuyc4C3Z9jWvirwjK2L0gr0AGPDqP-EFD22CcOLffVbFw-' +
      'g7jffs_7Ti2h3apJzhEXfXj9kwp5Juc5_twLAKNb6dkiJJJIoqIsG2VksX5hJ_-k8essIt5SSweN2-' +
      'od732FueY8fEjxvijjWqZYaB-77ynSHnm04fVbpA0HjTbBWTdZkP0--pZb1rtzkrtzkENKhiBntsyWokck9rwt6v9ipw4gFm' +
      'BWdaOXDOdZnI7K7u5YVMr4woUCFmNhFG3uAi5mjzAw95oPeqtiRnHHhKVGOmq6ASMTQpTxIjnxV9D12k7a3vg6umbOk0dY3V' +
      '2KwxG8zUn9YyM75JR0sSyW5mOQssW5Shc5bFZuSoVQHnH6Tx82sVnxmcCIV3QM3jOXVIUxyJ3QXF24cuPk2rHVbex4u3j4WJ' +
      'XtgIfgSFoPT-r9n2nbiSyEVH-jFPYzDmOmNbzA_dJrMvFr8JL6-GTO7uHabWbSjLRRGkai0-' +
      'xJ87OSGMPKF3LqIU1g3JRrWEolYFNU1eXBpTF2eCLDPSFrtAmAlLouv3yLhLu2FTqkR101IUOCU-FeJHm__uuasDG-lqBr8I' +
      'Ga8P39wJ1F7QCETMRDQ_ZPVLlPuZcUW_eBNI7Vn99sLt3H1WvLgu3G5vQu4svS_kVHkgMgLoDRH7HzOe0OuQOkOX2gU3Lwry' +
      'VTLIC0lcDHZfMNmSRMtwT3WyRz3UU2DWGHrU4CqlCft4GRbQm6NV9ybx3ro_kgT1oL-VSXBKH13tbOpoZ_2PWP2JGE0gmDgn' +
      'njD1Wym-1lsCVcU31W1wXX117hTw6zubEpFczPLJj1ijuK5pi0m4dZRSdauOYg_H_amR_HqZHaL5fL35xjEKCEvW-' +
      'EEz9zLPfAZSr0XSTU_Lr-d6AgoAJ1TqAh9m3XlWUTvU0PAOqZ8bp1kmoExwWGTiONSdtH0lWH3wcC-QL15vj3TU_G_8MWZ8p' +
      'zzocKK6PwhyCtnXSGu4Z_PAlbMAkT2XrkGddlEBx_px_A9JqEXYXWKI0cAMFZnJZfMI5vY9K79b97uGju7eaS_4CBhoheKoN' +
      'mLV1Wkwewabp7vUFYpT9_27IXXZFuZXOEJEw7IALCOV51MBcGZtXK19REIH0Lic8BKlrEiGaWENfX2QSflIt6FMKqIrgl2cc' +
      'u79D3amOcWqP14bsAohnHjzj1xD8QORTXe4_i7NfUNjuhNVifXzkif8DYSuIOnjsG8LGwVCNnZnEblHoqI4obS9fkWt5Wb20' +
      'qFMagPJnzKeOAAYjom1ys0KHksId5N2HqZxz10suoDzfVRF1k1hS0jZyRduxzKhzJB-' +
      'm7evg1sVDk7ndNVC_E0J0abvrEwlZxE4gyxyM1r9u1TPWZX_1XR2Mz7L11BjhqY6cSlCRzSXd28PA-Gqm0gXzWGP956B9AUy' +
      'PSapKzJmkF2DKdtWLnHjdVqDU5AhZD_zr4yDXFdYlCYW6j4O4qi8KQroH9mmriMYY24DS-2KIvZbKquElvP5CL-' +
      'zsg4hRsdt7i0Uy5YJ69MWszO2GtNNPbn-jFrhvIFPTeRILu0LQwtTOPa-V4bF99Xxw09o-qbUDrRyDJaw4-' +
      'T2p229H4vTyPEtEMIyjQAoo4ipEmBVk14EoM9jssjCjGuhjTpnq5qNBjkgBQVLd79OnB4bzbx1VQW3wQoGObu8xhwKYsIDAX' +
      '5OsZg1_s6M5LSlWr97NjYwBdRRT1UjmB6dYV-Cprp0vpTNeHGtw1FjqGjzcu-0v5Mu0y-XNvMVmUuCIP1izeHrswe7wQ-' +
      'YlnxMtDGMbcYZ51r_4MaINrW72_yGTJtrjmZpCsZ_wWYW0eSsi-tZMxlyAlwQwAQCMrW7FGKtRuVkUC0MIJBiz0TjSg1sl90' +
      'xhA_FWHQdqP_aAvYOlkSuLuj5czmgBe1tPq3L7Z54LH0N24v0x3SpxWZFbspsCSzqFwCzbviue7Ip3oVZ20JsCH3YIfK9DnJ' +
      'Jf6Xj28bcnFWNkbSsIcQvYINaH1yAqupbBV0qSo-' +
      '5l55qskU0oRgeBo7c9SuyK7czjxENzkz39xBgAakstO2qc4yvsNpAJRGAIV7NptrKt3PexS0H4SPKToxC9GLs0ODqfs-TShp' +
      'fwMjK_oSLylUmw2xfX2W9pyGrjbbPkJsoO1Y6ZGjYnDne_hj9jBFM-' +
      'k26gGksZy721ydH8CIHToQULt2chyNquobgbPUFBgg-zYlITwuB1ALoE6Yl_KZ6Sg-6b8NshD8DjwtQsk-DC0_XGPs0v6sBj' +
      'UTwPzZ1hR58MJKCzWuW7W8-1QeNopYS01ZOu6qYB0GCgfpKB1-fCBkO_NhG3bAEnpGHATCh7R51tCAgxLM-ePeIzlYt6-' +
      'vQtlaTN1LM7wrt5derJuKJdZbpnGKvRAYTkF5nVUS-6TVKnBwo6jGDkgx8OsJwHgFh-' +
      '9Hpu6gFCCO15x2ATJWMUnQzJIMkFoA3R1_VHNuLS6SRn1yjoHBNUhu2Q483F9pypPm6hhPT3MEYikIEsmHx1q8TLWLOZbGzr' +
      'qGkTwOxlduYqhY3LDhj1HNiDsNWx_MDWWNRkoU5gY5L7-' +
      'vLZetaINwm9nKiwpmF_uQSS14PNXwb8hvgiieKmuOTq70osB3En80IG8HvzsDYbDzoYxvUy8aQy9OGwDu8xOPsivS-' +
      'iTndIOHz212DAdBeGpv5R3EVcZ_tW-KYhcdP9YD3vTYmCRFI-DDaYbJEcGM-PGSP5x44JjcYVtBex75gM0f7Xo-HbTNSwN_g' +
      'QRU8zi4FWZL4UzYUSuf8vonvsrZXNVPD8dk_1xSp2a-' +
      'FQSbV4uvbdvzFqZSp4hOIoVvlDDkfl4hIAuVgbTupxGoegRVJPHzpp2t3ywmOtLOfx2Gxx-GUry-v2_fik05dpvz-' +
      'PYZ9SMUbBqS2w7N52XzYjax_e0sULOZrF0nxzEdwmAf72mT1qa3ig2P7sjvKv-Xdp7O-ypz760YO3Py1-' +
      'pvy0kY8Mqnto36TWOlsCc0i_JUuRXT9v6ZK_OJQj0jFMjYtjAMBU7kEpQVeLjxrHXORjHD6zKTaYg_qPqCnUnMFsXFTcgbKY' +
      'y6Tmp2a5X05MDdaIKb-enmTBPy5BqG8gQ3j5FUK3T7rB9iOH9Og-' +
      'RPds8l-P-K4unKMdHX530oCtxnO0AJ1IeQSOmBqAggAo26Jlo64JpdY4l-rOxTAD0vHLU3SC-' +
      'Ybm_rKmJ_EYxfE2vem5QqNZ7RElk4ljAfZAElTV3GBX-' +
      'xt5nbt_COBJOzudowqOcy_swwygcxoE6zahj9XE3BYfm04mvZzHmGz-' +
      'iMkv1CzC8MsXjo6DWUwL8WBiPsPNf8UJnRHFN3kwLgpeZgvV_UEs61exqwtWSZqIDcef-' +
      'MZl95iPuaFNDH5UTKywFDuSQj7a6G3ocbkPvq_y0OEU-yom_hihJJh-3o-' +
      'A67b4faQ2FxC1HmPMtaT43zqgyhg5LWxsiMx9yDpVHtniUklFQwJs4pqbiwDEQqVo3gV4I2oqXklg79PVHMv-' +
      'v8FgOQaxPrff24XW7zxoXG0rc2EtRTSUBDuR5YTCwQ21NNhyKLCEM6gikjv4Bga-3WX6g_tKNfznB3xyjTx-' +
      'jLuiWD0jyGrJJSEURdpkM5qCKsLqIKyIVaTFeQbNx4htzBdG6hq8-hk8ko-' +
      'Etkiuxpy3NbOrvYv6SYVBmf0HB3-qLNEvhaQKdJzcn3VKoBjtC69YF-hY73hQKR6A_I_J-' +
      'EnCfLbH8AuDAVim3-s3XOPzU_fOUpbRQ07-a9qe4s63wnXtbteuluiEgmC0Oahrd7Wy4OebGJEoITq1Kosu-zm5q0MeOmbEK' +
      'X3_01W6La4qrI8zhv1pE4fGjQH6qpS1UfEFOZd5fDxFJldLMBTFiFdj1qg5raub9BFmq1-' +
      'sM_CLnxaoC7ix6z6TK2Tjr4XL33ETACbW2bTp6HuCZ4YmtQU4-' +
      'N8Jc8HHiqAE43rlWJM4m6bAWYTSZ_Avy3bCzyM0mNItR78rhpLxvryen5Zf_MzHXjVh9ckyCUgVe2nDff017UNwf4LZ_GEmf' +
      'iENAApeZ2WcvfoXz7uNuT7jwUp3cFDOz84QIJeN_aeeG-76eaJZ6XvH0W3kFa1nBmyXO-' +
      'r4euQITq4PoB_GdQxMULnQfJZQL4XsXHOg2XycvJDvzaKWbdj77aOoO8nIemvX89zPtJjKt4aa5EIprYPlCagKDGtGaVD-Y-' +
      '2SeSiZPG68v5IePWd8pzIscCxNKshOXpQeuti9P8sh5Lt0Ix6g4w-' +
      'HyFDkeNpgfwcrCSm3PPip7hGA_K5RRCaCetlTswOrrrEteSVFLkyEaLZqP9T2qmeyRy8Wj3geE-FDviJmGWcUZ4pY1TqtRwJ' +
      'rlMZKa8XRT9JVRUY9FSH3TPYh_38l3QdI4ZSBdJkd8iNME2hZVVmeX__vyA57HikHiGsqEnJ_Hr3FECr1NnBQ_Uwibje2L8f' +
      'jTAKY2epG3fvfSDNwKdV_JfQYs9100SsNiudeynRBYykNyvAJdhaWIfZTaI9h5w7RDp1NYIwELDyENF68gMgfhbdr3MLqj6v' +
      'hez6RcIKlCKsQUWly_saQbDiBY2mf7Il3hqd7A4X0IyzooojX4i5vN_tBSPrml_vCD5W2NW2bjHivwe4P__QltDIHpEorZ0t' +
      'xbmCpoa2lcH07AaOr7xVqOkZ1pvpsfMEqgJFSzI_sRcUpe-kUKUup_2hrc75ai-Vv0qv_5ayBbAcXFUbaztvzXENCB8GF0aL' +
      '6XXFsyBo-n7jgT6XX_urA249LhEf_kT-' +
      'A00ZHfiQW6bg6xbH7DUL_0JHTlL_2704fmUBYzYaFIUVufxl7xcqYRzrlEG2XghJGHpG5wWKTho0IYriYLQYByEVVyEIsKSN' +
      'KYs9CpAWxh_UF87YhT119yTRkGgBNPvPF1I8NPZXZvxyn7-' +
      'RpXOVEjZNxJAT4dVVVJEeInlrz8eTR5TIPIx6bF4i93sgoUVKWkvurJ_SIvZTD5X2eYwKF-' +
      'q1DHhqfVLeDe9qN6W9s84xfQgT8sheUgeFDT8WT1hg33mtFXqIlaouXd1Xl4CHLikyA5tQH1cgB88JIHzjTXgziWnUhT22P4' +
      'JnOWvu2zHUNzCJQnwv1I7Jhuq6oi5o5MuzuKLVYipOBizmqWKJOFqJtJPAaLorMBWpM1ZX5pfzuSdKpN1xsrNBjEK__KFod9' +
      'n3-ydCPxg-sXww7ssHx6IUtSQm0Q5KLIgF0A-QC-SxWDnfS0QC6gJ8vJMkavbM03hHHhhLSa9uTQlguhyY7YSlIyOEPNBmsj' +
      'lOF9no0KYgrekEq6KFH9MCKZNztnDQUBupyqP44DYArPDBpu7J-f9V_6DuDUYHh0y3AzfNANbLMp-SUHXQjBvR4y1r9mxaPt' +
      'R0GpadTnf8DInnXu7d8ScQQkXLKkNVPUnNPxdv6FAfXHXF3ZIxNtql0DlaUisf2kCnJYQiLV0W5C3ZUqVQ11tMFttVhGUEZc' +
      'K5HqpeplP_8IZg78v_tleNlMs63lkPl_tpz0uTuo2hv0mlmAmttRThUp9K2p3_MnQ0F60vlFP9tna1RbKfaHeTLzj1MqCAkH' +
      'XBO2JkEUIeB7akE4Q5-S9hJqaLNiORtpFJdbvWRHrl4bWQymyKQ5-T1rTWqHU5UDCDHzhq0Ru8AbFUEHzircQqr8Z-' +
      'BcKgIm3zwusIZBOMOBJvQXKy3N4lBP_cEozE4ahWgfebP5fCBEhRO4E0XelMvaC-Qxj_L-IS5NhfkVKiEsjJ-SgH7u0LTmBa' +
      'cbkQrfZ2sLQgi80VDokummNKjGv_saei4QXHe_nWgakmWE652w9hat79LFsULcIx9UQwb40r2ZO0HJf1tFba_oWln81LBIUc' +
      'LGCQMC1aTEK3lmG0npDTsMFE-rvqbQVbt1TegGVJPniD-MjNd9OM6Ta4bfUlWOs7QYsxh2LGmM_IHgjocMl1pdWv16lJ3Vjk' +
      'w1mVixgH-P4nI40upKRT7k-' +
      'oihHbe4fLX7m2r8T7jnstWpKXS5BI3JlGU3qqnruR9gs6g___QhP9NFG1LrheAwS_9YyLExSd2-' +
      'AOLefcOMdwn9TmFh53pAgKQm1PXV4-2cvnoigD_0SRtuPyEpaEJon5wUb2R_c85qiNiWvL-SHZ6KqnOQmzSjJVmo2X_-Cw6C' +
      '9nglKdObp5OjbQYc3V8C1EaPKgCYoFofRbBc9ZvlcAi51Figr7Rpq5x_SOpexaxjZ4MTKPWKFh88USvDVE5kTvBgDZfaXtze' +
      'k7t43zvpppfRnaerprtD_RHgb9ThG6GsksDO8-KD2sxBYpoBdBZ6t_Z6Ky-IA_PFEr6gWjqI-SV4WPz4xr-TVMLs7O3rSSBr' +
      'JmgYnLZhinwbblXCqgjiwP9gTGoBBeboEDaOlJN2I2vP4t0Ksfa50MZshupxXPaArjHJh0wOLmL-' +
      'm3F5q_2UMaoLjYUXscofapRMRWuAVbzmE2fYddUEgZKSSWn9GmJpJ3_S09CW4Y2tlPsSS7VQAb8Po9tvzMGXfZPZ0-' +
      'MvNuHocOjjh3HiDFXq-51wpg-MqULhAmNgP5n_nvE5pUj7tFsFWsXB6iZ-uo1gJf55O7hSAlfO1sXTpVYa8zloOsq_5-' +
      '7lK0CP5Gi_itm1k2HVdLATIYyv5wkxTUgcQ3t89smoR_i2Hg11xNKl495iF9-kgqgTFsudKAjkxndB32AV_7sZ-LF2oJIA8u' +
      'uCbntlTaZSNfRE2aJZPLk_cfyuzzYs56Y3hCugZ6NKFBhdPUAVb18CFYYogKgM_AVcDKvKZPUuevxjPPtCr6GDjAjJjuyfSO' +
      'Z-dR1gsECC12MlhN681dyqrQeC89iw4kCkBYAPEsmPyvMz6d21T4e7BZHRqpT0xDyW_c8LNwAravg6QhsXzek0nTLkIaAKxL' +
      'sGlr05Gy6hMp3bzEkAKu5AelcROt-4gMN-NXnvNoX3v20LmeY7T-hFGdA8u3NYctFIwWWo-' +
      'MTRUn0fIPFpAu4B8xvbmtyp5KHN9QlWHafREjX6SQXfn787QdYcqrv4EKyd6YUTKxOrUGZrr9ED-Wt1bloJsV7foq_w78-' +
      'cEsLzxv3_VdtpzmZMA5cOeG2tCA3YzrjVJ5qkzMDqxDo_M1zdhGdimgE2Azj_jfGOlz3FN8_eI5X6o5bWwcBEP3hKi-NZJXs' +
      'eY8QK779EFGqy6PaFkCn2DtAXygCC_7z1XC1LRQABFkePsZLycnSX8FO8o2O8Sd29_943m1uvpS_9wi5H00ZLFu6Mvi6KPvi' +
      'nGK552qaPGuDoDZ7m5CiS5JKxrzRZspzi4Sz-l-mbjKnbWiKdXghDP3WTkOT6k7U28UfrN_MWXJB4XeJys-po4Kj3H5KqvOF' +
      'ujyzNcIOpyAVVEwfugU2Z5qYtDgf078arcuoSpYzG_zMi5oo4Fu6k5EkzUzPkrW7dH6N62nSUxq9Z4m7J5eDrGRHkupRSv4C' +
      'Ha6CP4pOUzdX58fJSaTDOpdTWG9BFE-YN1T6QiC8imTKhon9B7oQbNw6JB_YO0_cSLKuZFnUu289BFN9wdnXH0JZPlu6_37m' +
      '9b74YWv_Sh4JK-T6Bq-N6beW1PD8Axk6rI8Y1R6xIiew3iuy1nKwW-CYZXj-VFpXYLlTdAlV3AzKmqakvr2Oj7pYwmLh-PMQ' +
      'TBtUR2dIXCegPRdeNsO0HAiLyC0C-' +
      'eWNrVxes88iRRWnxScwFXdgdI8heFMghBW13EO5RnyW3zXFiGAvK8nAGooiPd5YbJ6Og-' +
      'leO6PL5xsMn5a1qbdka6P9mrrRyIrO8jAoDLSQ4FEMiOwnFiQGgdAgJXywwMlLudzlCvA_O0pn-JOgXQy1vxuqgFm7UT-zv5' +
      'N6Kt48-zGFVr66cBXbXcikA9ZaMOvLtyL7Jz3TB6Y6jyT3D5xXbPs65_SPuuTi7qrJWT4-' +
      'heX9C95RifW8u6tYR37lIkb3vgRZPRSPiReQqqAuz_38eKlzqlDgBvH1NfPj3k7SyR8cN4g5KXBs-' +
      'QmHM60d1oy9R1wBEOVdv1Avzd6yAM1bn7jMcS8ooF0yBAa6Upq-tV-Yv88lzh0pJX0c_kL9R-' +
      'GcM5uxIYc0XJNezxiJxURLut9YBWT7MsE6Dy1rblmJZjSTkJ7zIfwt47QrUTGW7uni6uANW2CMXFvCz8luEywXzTrCq5X31J' +
      'b5gCK0MB9pjLMOsI2xMTsId_ETRH9sdZ1zZ6gP-jJrlvuKTaTijbe4NH2mS0KgB8iHK6jqCeFOUFYnaYcY-Qp9nHeZgrWfyh' +
      '1IlYut58VQHr5fulPO3KdIQsROjl_UDZAYAt1x_Ob_utLMIneQDvXxvFaJpBzhifUH5B8jtsaElmCkNbz0dJH99wVDuCsSyj' +
      '3QOKVPHUGbDH73Cp52ypcaKzwv3FT6D7yc7KDQFB-kSlLnv320WMdCX8JZD-' +
      'MrUwyBfllq4iI5KXmKgQn1AHI1kA3mXczsBOtejK5Yp0Fnu5uzSLqm3QTA0vek-PZ6nZgdn-eEAasxp3z6ItHtSiYSbK-uvr' +
      'euygNyR7RE9gKC6S08PIxHLRfufFCG7pbvTvTGyL_hKC6frrZLhJSqUDwT8rYZODTl24qNJlwLZMdCWpDmlYUVuzvhN9FsJf' +
      'ECzeeicZOUVfzubC0oA1pGgrNg9i7n2Mr4wUfwXZfF75787b8F7q8K4T2A_GkwzrhT-oTqNMyv5FjGpIWNvNpRUXiorbpd3c' +
      'UYuFI_aUlyruCJ67tL6aDTyVJOTK_eTBCgY2IkYbPY6MlRlJjWRFYaiSjhRp8reUDtSSP3pTTCbga49Rj-' +
      '2lVKm3YHTDnlcduVt8ftAL9mt9JVXh2ELRNyda0HiTY_BRXZBRaH4yG5I25TtCR2A4PJhD2rfaLOXywwIoexrnJhNSCiWUWD' +
      'L83xlumjYVP75iPejNUjgRd1Rbd0m9tYeJRaJMW-JZUfekh5gRp4w-9_1SnkJhe98a2xP1Ekw6K-' +
      'cmsLg2PV3XLrIhgWsEezSK_Fyhj_NdmRkXLaFZAKrd5CEHFD_mJAfsLU3ktnUprHcDDnm0a4_4-' +
      'OdnNry53HCoeP1qqzMtUzdqNzgEiuZCeI1sl-7LfDSp4d7x0qdhbG_or13rAMmOxt-' +
      'SabI9zL3cl6h2LcePJ0G-VWhQXoT6IzjkcXiiAM2ZsdNJ8FB1G42a5glZFV-' +
      'UPV87zp6kqOIMg9P-Yh0_RQFGvKOQuwOtzZkrhWxx33WgsOcddSmK9FKw3t0LYQb5vIFG8Wv2rcz00n6u--V7Dywg81_I5zY' +
      'qhVfKsMiU7O2WnX2CpYbx9c6631-4fnl8_gI-S1uEAQarUtR78SIczdZxl3dv3jYmHTjSVXyWpUK1nmwL5Zv-' +
      '8t1hOSCPhRXY-Dmyrp4CWZUNUQY4RIOjnAr_uUk9t8sXjS_M9tDCq2IuBZxq_1e5IsL00lex6cfNVvLMqG-NEni7MxVbisd-' +
      'QGeHZGMDn-7PfQ8ZoIHhdhWJH-3Rctrxd_lOakMNuZZbMDvWkM5vmrREGXLYfLmQ5_Iu8RINCXKO5xK8wpY1De21keH57-' +
      'jOfb7joWf1HSqoSxw37H3maLMcjPpGM3JJl7O8ipgd0GsKjLVan8MWnPd9uChaBL3W-' +
      'vEcsVWWE3FuwTvMajFD_koHEcsHjE0SX2xWV8MuG1hn5RLnTHeczSTZnYEIPRrru1OtIihScLDJ7_PdFTs1Y9D_gGWbTSskg' +
      'aw9me0DrRG55EuAZoZka6fozUJXt8MRV2G9i00drdJMmDGfhcP0F3dG_7BdTueqXs22iK1NKN7_vnZgvRTMOPZD1d0vMEXqR' +
      'S77Z8o3LNBevQZo3fvhE7t3oEkjta1aRl7kxjEsMt_bxsCU-' +
      'QzwYsMdOMK7kfBzW6o5pa93UXVLeXm5LuIzF1WUIxIc1OAFtAU1fB67teqTnxPjEWHYyotxqxQCcTRiHFd6L_emH-RUEQqTr' +
      'cjOE9w64IM4nwdNrxKq5o6SufBhKR1D_JlCqGY80fINUyAYEIdOkdXIDH2njXQlIq31JTcn6kRVfHlSMsbMC2f9rZM5m5I-' +
      'DKNjA7-Jrs3FOdZOoIeVvcINYvjnLeuNhxC2wlsfFfHmTbKn88juC8Xt8fruS-gp573s1B02trkyx-eMJnFZbeYlzGDl4QMH' +
      'OYlSmIZRI3u95wwdEZmrBA3t80fsHoYt3886OGivEy3Xf8K49T9CUuhlqHfuy5cH_5dhe4A52jvlYei_l_CUnNQjfDzfYLlR' +
      'G-Q2RyBW4mI-GgEDS3T7ioIb4lPW5jWzTPuwOk9bVnh1fdOrTyGgneWU-' +
      '5E3LtVH4JlcrphXchjyKIOtMMmBApJDKWHKYnRERRiDA7nmp7N57ZdaRmmtsGpmfu4C8W2MfqWraF3QNw-rhCseSyM7LgG3m' +
      'KI23BnCdDA6GdmVnaXieBA3N7IPOoqDPPy4u2Uz4YxjCJVRb6QBy6c4TwQqZKfZwTOOjIQ5nc8IbBEYPhgfh2LNGuuXZeZDh' +
      'uB64fGebPanO7tizdJEMxlUCp9rVHsFBITIaMNY5n_ocKM0AfEDBMYqjfS8hgyNdtW8U5ERHTauNgTaW-UtxeYem8-' +
      'SCQVyDKDI005pxxwR4l3I9JxNbjm0ij2oEX0rJk089XnCx60t4NDxlwxImKTrS5DjLafoq9sAdmqtF8AAY8O9_oOKYIcVQJ6' +
      'NsK1czgy4uqgwm1RMIOMlara6nRqLmUN1MgbfnNf_BF6k80sVfDiJ9iy7QPyuaFgG6Gzg2PZ8TAjuLWhoMvHPvWvj70IW017' +
      'u5_kkk9Cb03znyRWvUr-nZ10VZU4Iy4AA5icDrECGZu94zCj8XJwiWyf65rRkdyohSIyTrxZllgyiffatVaFO1js528ivnk5' +
      '8c1f1k91NvrH9rLVybinDSZRhlZvA6G3wau-Cz0Jtu1ErezUBaT_MSiwKsBJW5w6kWUy1n3Ew8oKxdBBG8QBznMHWg7igtKS' +
      'UsBo4oz74iovZxyaUOdMV3jvPpDGzypDXBjOuB2zB9a2mRc176gJyUupgX_mGOGXRpWpuPMLFEU22cmMdWZZ5GvdolB6uEkM' +
      'zntDs3OGr2MXgT9FTSrLVcjUkVadXejYYwDXGn-' +
      'FWGrpxu_LKSYsHnCbXKfar_L8ErAI12uEeniCFw78p6RwEG2BqPgVqP0tezheZRLKzgbBC1U59xXNbdl8qN8-0cuau9-AJ-t' +
      'udcfT6_YIyENZF3w5xm44fkxcT8xoKEs9qeCXFomd8o24_UEyqCMwLFH5cyTJ_rteEbj8mgddj3yUT7EOc306v6g_d4RPGpN' +
      '_8HA6UchB4NjDo29K75ym4bSc_rkX7Dpdab6quCJQT0u0VKritFGmubQryBOymSizT1tGUto3AYHfs-' +
      'u7JkOHVSGzbY5T7U7dRan9V2LT0NeLKIpJzFbnm8eYluF2NI2UocAuX8OUrZ7BBHrgOlV4SF0vriuRe6tV8wC8r0PZDqfPmN' +
      'ti7C1g7Bi0MfAnepVbaDIFnT11OpboMkrvSp4ZSeGPCG39JAHnDWQM1VKm1c_DOIzzk1WVFUPay4vvIFPlFv-iIg1ehK-' +
      's97whw82xHtpNEUeuoqaPFoPXRytpEfTrtnfHNQTE642YY4u3pr8_ZBzrdYFX5rw13vY5QNF-' +
      'G2ISnqhy7baUFClWunvnGG2dYTrkUoF8QCkPTKd4vqvvcvybIDq7ZkgcxNgukMXhgg4V1qleF3__pwCDu-' +
      'TLmWWvTDk-G0CNupQBk05q-RuJR-a8JP4t986pEOVJAji7NDzIl0uGlR6gDjARGEgJbqzox5CmeDG9S3L--' +
      'fFj5FPvRGCFx7RJtPFbmmijWovY-bl8qK47XoFR-' +
      'btovGggMYkHPaFTqsOzDurS8UBXSYEwJRH_KZAUTGaUhfq8yBqqG2Cb76D5ZCz6mGgRsIB3BZGTFsY0iuVJ3XV-' +
      'cZV1DX30gLYQ87lBcK5YYyWnLnwlpV_sYUO-hDQunsAPw8kSo201QoQW9_tB4yRou2uSIuxb6B69sxdfun4FibD70Mc2IT4b' +
      'KG_tFSkuF3Ewf7IiXzhFgmQFmW4gqO1IrYNwCIIkO53Ygm2d84wUG_w3Y4AXazpjxm2NAwujyy_EQC9Iqb7N1Jyz6zoR6Ham' +
      '_GWYXvCDL0IdHReMeVIGnoqjfhjrxLlvauVvM6aBJOSKizqlearQgbF5Vccmv8Rc4rnkyibqIlO63CYAO57ymIyYxzxApOGO' +
      'w-f7rauTAKgkKKQa_RVQtunpHKwurMw0kOzVXaU-Ns1cZjlM9J1HW2-' +
      'n4lEgZd5o6eQ_NG7NQrZsBCK17VWEhiPtsrtfCruiZg_naZ5-' +
      'xhKmkM0R204Hp2NkfWOvm_GdH4ZwGq_Q1FxgcLxmUQaz5VIuVQ9qdDfVKSGvsshugLle_9cGlEwugzZuyEokY1sSkveDxS3S' +
      'LX5T0187VNfgqfL4UlKXjUh6DwCUWK5CBGbgO-' +
      'L5y7v9wRKbr1ma0i30fW7RRTF3BrCUq2oSyUrGsnxPkRUFYSwLBmkUXbcbyvq00rF-' +
      'Y3A9kINbinTR7vT9MetnHbgmQBgPACad5V-y61d-' +
      'A4aIsYOSwa1ysT32sK3tjI4SL1vXsGH672MpJ2xwhJKG4lHVZgoshpnFNnClE2IW54NECSc4yGZ6LQ-7qiZ-' +
      'Ek88TEBDt_MFNd2yRH3Q-3q-YidLCoFuJQEDzOXCcCsW--' +
      'SN0kmo1dO0x7NN0jkinlfayjTITpvV5UbFGOMibDDT7JNOQdLl26Y2ZSKl9wmaXwKacZiS-UjZ5KPk15YkFBOTI1mc12VGIW' +
      'O09yII2_7bqwNG4urcoNyrBa1AEOkIm7lUMPOzamViEeAFMh5KFFwYrEIJ7lPLdEDFEylfGTcVokNIPzUjyZBJHWYsfuXqn-' +
      'BU1X6vtoXztX21nzT3Rd9kWUUqCbGnexOWb4jcJRKiSyH0ZpRmWOMCgcCOMXlsruIgwgL84aPDesk9ui9oP7jkRrSnem8vl5' +
      'i4VKJiwnXrjpp4DuZzneZ6BB3NQ6c_F_GsANgSYgO4WtQsV99MT6kTQSzJSuVK0c97Q2eosYgEDqz38v4k_XhcXyhClb2KHz' +
      'L9vWFdTJBrs4Yp22RQWpID6qOiVZajiOHCa2FdXxMWIxqfp462G7mZUpXtPucojOA1MG9ob0KqgEn4UfC7S42KRlxmTEPGl5' +
      'zHc5PSI0FLvhLI2EVBKlzp_DKxVOmyXbFPyNhomraaOaJYsJw3yVzjEmlvbtIIiNNIl1I82dD_d4GOPbcezpyjxqOA1lea9k' +
      '0l-' +
      'ZmQcAYm9Hfzn6ziP0_7vWARC7XHZA3p5PZNzbAyRIvcGLhwC2_NS9Huz4pWvuIDDVNHwuYudvGbLCqRHD9EBtbS5BH6YP4nM' +
      'QO-qw_JACjln_tDZVA-UhCyhXJOvR9AKUMls1ifkc6_DJTQ7BEeCthrJ-lq8S5QOI4m7l8K2eowUw3nZclLjhGMKwKx3XAEe' +
      'kndgKRdyeJr6SeUUXAxT2GX1ikPXogsh6lSLHbUrtgJ8UUwAgcehbAH0Y9hCsyZQVCJlBDIM0paLgbFu8ai4K5U7zy5je-' +
      '33MfhClkeU59caVt0KwQYfS3BJu_NPNSuONDUaPUjFV_mLuvS9ZwkRnDRkwrr3vJhDMFzDGC94qbxLsfnNQlpSW-nvMzaWL4' +
      's1TINvwOxJqsdAr_Q195mbXxezDPMTI3seZnnMzGdXMy0m6HgXlNKw3opb9HzlJgWysdJsYxcDBYAQ52w9zgzRurVcGZp57k' +
      'TO8MbZTOt-tYko6kAFrQhizyBBA2XOy8MDkUfFEsemlZGzw5HSVWTR9JdVaTOoa3LnuMUCV6nc6KcX0Nx8awUknqgbsa7rQ4' +
      'gXj9_BLN9LMdR1Z05jvZS-gQOUgiK12DaNvHvkEWCuPWhUhPij7ONl62gFq83oW15VIKT3bqIT_AGbcaljMBMiFP2qbB_AXs' +
      'Edk0SsirIQpz6iIVZJchvSLot3CyMT-neDzCVH7TQteChhz2uzET_q9Q5KG9UEiDJk7JEVDWUMhb80niiVKAir-nkRwNKNyB' +
      '8I6bwOsY0qSY3k7v6cP9Lm0W95rI6wGVdDwrD9b2YuaA159vtFjElLFQKlrvw1ZJBbl34iYntT9-' +
      'Vp5eCBxysyENgEIsM7tbT6lIb-PR2e-AIf7nHA2el0jMMvBNkdcpaL-' +
      'xN8wjUg_n5qSldw4KTs7lWjLTENSU7kS12G-DJv4Eq_5GrOurpv_u3uvVujw5fLqguLl9hSDGjbVIprK5mTYeXvPIt-uEHAm' +
      '7bncWOLAWUfBiI2eMpLBK0PXnR9A3sUkuFfH6628iNChZ2SKT57FzlGj0uIG7EQWlGl7LNLDnJxwlzFrbQsUecVuYk1CIHOP' +
      'j5ztoR4U_v4PA2wUaAejcBK7qIRtzromJt8BKar02qfr_6oatvf0FUhMCiv5JXhz-SOt1tqFcTPvsefhSnH-tNlzmqaw5V7S' +
      'hwg358T7qbLNanlJhWD9cOADHS3i_7igZtJ5OxpFfCeshykj_hX4PI5QGUgzCOpBtkmljzVi5yQYmfHkwXi7j95N_bA7PQiI' +
      'TfCZopgq3ZPI7Ys-LAwCdnHG9T2ozyir-O5IaOWhm0iSLFiUg_etkBB4eThhQlW7wx72Sy5NyftaXf8tnI1QE9_hYYrUWW-' +
      'f_IhH6kMGyOAQwhrAcyFL1UzL89dYw_ELW2Hibpe3SVRgk1Sw4M6Jwyi8IO0HTSh_dY99GYEMryFpyqYiuiPWt-kMdkmfi-' +
      'ZivTN-LbTsGMZ_OoSL8tOvA7qdkTq8WOVCmTfpbKCBTNYpKAADbiUeGnvJ07LI94lbHrdw6ZwU6leNlTTqI6Ddvx_FKynhqw' +
      'dSAEJv56itcFlC8zjcbCRYM-yRElzpxbyeUTm7F_QjQGHZ5Gu506vR36uODqPZBZYIvf2f-' +
      'QtLnAmLMhpBB66W5UKbLTAjFFINCTkrFJv9sjcFmxdQMu2v64ttsD3BHRt93kNknE_PGq-w0its4WDLph7DXO-' +
      'zqshv4TPXBq_ih28dTFj7Zy0afXEpXPRneVgSV49c5wTZzkHUzA5K511bpU7bxmGQyyC4P-joBz0NomTJsxESCUycv-di9ta' +
      'omfFsAT-' +
      'U1AGcRlXE18Kk3Hi7LpbiyKUBsVVLyUZ2gjwBnURzJ3TAMtJuP39zrPYJ8JgPWFfeHUjYDJiUsMoUVkzhmCFEiB24PBgLPzE' +
      'cbMvzKik4NZWjTYNLThfuFxwl2N3iZJncCyeK1DlN4uLQUGCthSfDF9c2ih62W-aKaqcSckADqf9Tpr-JvRkr6TX7nUp4eRo' +
      'UjYl4bhhaBDdtPrYE7AGltXfuB__D5v0dxwxP1gx8IP9ynQ_vq9-' +
      'z_xVhPPPEEv8HLKq9ffX9EE1T30zMx22Sw1hFtpMLfcQrnHIhOHtHlbb0-' +
      'ST_LvEL1BEwThapEHmLbILrlVI4NWxUG_hFm4xxpxy333xqJWGdbdkcOHRfAAXuHMoTH_icRFsiVf5XxgRbVvcuE1t0-' +
      'Ee6cHH23A-HUKK57v20HCgYkKBick_-qXTdWsizyCgCrvckstZq8gw09PeSBOPzywsZy7EHR5lnZ2l5TWVPD7rAulqD6Vv7D' +
      '8DSbq7bPFjl8P3lOi9hhNCy6mwqtam94YFNfFyz8azA_6h1L9Rg7GwP-' +
      'N5lSF0Scr4xTX1DmugfgOs4elQxU5ArO4bs7mXYwZ_PwXyk0EEi6S66mmXMOmp9NS9ANidhxUFhCSHiyhoGQgIMjtt8MFv26' +
      'HLyAwnNJ52QnPvewWuaWSJ71CDydkijdffUOkO7wzpkHQJCUaAacsyplVsW9uiSWDeWG4oKGqUMcwOWwbEE1RorzGTBcIKCv' +
      '8oRtdkOmwWKqimt16gTsyHGIADH22g6xt5yCp-nhI9BQsBhsBFJw9IiYG2-' +
      'gNFJBM1wp4fSAkRKTTAKBOka4pWFzwZ7CdfOmw7rjwf49cQL6p9u-' +
      '36dKsSGmodDoAeloLkxY8ZvVbL1XaYcyzF6wuQrOhhlKwE38kzqhiC6qn_qXC6huo3rZgXM5S_QMUfuYBfQeziet9bM8Mct3' +
      '46wqQrhseg978p2ZJS2Er8cVvRuEO6dVMuLANI-eJO_tIC8O-' +
      'mpy0BgSIv7SPJvqFuYrFwmyd0YAv3IVniBBPN_jDNDGuTWbBf3E_SOwSUW44FoHnpxRy4CUl39aGq4Z5_UzgFYtvmY9U4IpK' +
      'SmBUBu8cAHO3Mjg5f7oKEzFh1lbOCXek0myFuynehy42zBZwTz6hm9CMZdhdJ5-' +
      'UEjZqeIsySSHtiEnSGnpE_blAuAp8UovV5WzV-08uD4o65mZHEXw--ilMlgvwfWs_WEY6nuCOPUCIuBSaVAnV8Iqy9agTjHh' +
      'DGhRyYExHwcPcTjfRv-t93utNTW_m1a-VGeNnUjhPKFDKiBzRSFPq73Q9Y4wVSjHGoA66uyahf5Oo-' +
      'nADmOLXu9P4Nv6zNt4CXyCVpsHqeoI-fj2HF_rGP5aeVZU3IxcEOSgs-' +
      'e6XUwGqVu7ofGO1q8WDVU8gCHgGtT0dPBCARv3b_pnWD5tY4gNCUQMdiFHRvOue78H160p4YX6H_vbWRe5IYwKZe3SSnhDS6' +
      'jBZHvCTbPswV5raupEDxlDakUnNVwEDSvWAoz6z2v-iJiC6zi07L6LdZ_TDTygENErYlkw4Q5Yf_9G6trANRKBdA-miubY-u' +
      'OTlZvA9JKlpsLMCNa2JxX_7yN60IVD2P-' +
      'NbWCeAe00Rd6ph65w3dODfnfu3rZREub1T7FRVWPbAyXzHA4RCdTtvAgKeuPO6aZ2p2Fky_lZaylEQAeCpgwggNz5raA8q0V' +
      '7HJG5zFRe1_MSRp71u7h_AN0WsBiZF_rSAAKA4mhysUiIeOnw-' +
      'uZIcSW39fYOYARXieQTal6dMTMiOgYreX4xJuAsAOYWHBWihUpxq2NxbTcpAOQHmuZnFWX1mp9INbHd1jD-jq-' +
      'RPQ11QMlBFOHJuAz-VhzciOLR2w7z9qJZUOmW0rg1Yh12nLvtl_EIXAv8Jc_qiekBglAVBGuWz5JlnuI1MpDPUHmPYhavVuv' +
      'GYPSVADsBzn_KqDf1WYOkH1uEHXdFvdb8VYhgm1FYmrOekE_192baW868fpGwTz0VJVxXAYW6bYMUihbn-' +
      'S5jQCadLqObFteuwoJhlzv0flCtFYHCYThe_4JMOZHdjji-YXGuW2UDVaGP9MwUjv-2DgjjGvifmuzl8JPfAYomUE'
};

const PLAN_SOON_DAYS = 7;
let planOpen = new Set();
let planShowDone = false;
let planEnter = false;        // раздел только что открыли — строки въезжают по очереди
let planJustOpened = null;    // раскрыли строку — анимируем только её
let planJustDone = null;      // отметили — галочка «хлопает»

function hasPlan(){
  return !!(DATA.plan && Array.isArray(DATA.plan.items));
}

function planItems(kind){
  return hasPlan() ? DATA.plan.items.filter(i => i.kind === kind) : [];
}

function planFind(id){
  return hasPlan() ? DATA.plan.items.find(i => i.id === id) : null;
}

/* свежая версия из кода + то, что уже отмечено на устройстве */
function mergePlan(incoming){
  const old = hasPlan() ? DATA.plan.items : [];
  const removed = new Set(hasPlan() ? (DATA.plan.removed || []) : []);
  const byId = new Map(old.map(i => [i.id, i]));
  const items = [];
  (incoming.items || []).forEach(fresh=>{
    if(removed.has(fresh.id)) return;
    const prev = byId.get(fresh.id);
    byId.delete(fresh.id);
    if(!prev){ items.push(fresh); return; }
    const steps = (fresh.steps || []).map(st=>{
      const was = (prev.steps || []).find(x => x.text === st.text);
      return was ? Object.assign({}, st, {done: !!was.done}) : st;
    });
    items.push(Object.assign({}, fresh, {done: !!prev.done, steps}));
  });
  byId.forEach(item => items.push(item));      // свои дела и идеи
  DATA.plan = {v: incoming.v || 1, items, removed: [...removed], key: hasPlan() ? DATA.plan.key : undefined};
}

function forgetPlan(){
  if(!confirm('Убрать план с этого устройства? Галочки и свои записи в плане пропадут. Сам план можно вернуть тем же ключом.')) return;
  delete DATA.plan;
  saveData();
  renderAll();
  openPrivacy('План убран с этого устройства.');
}

function planDays(item){
  return item.date ? daysUntil(item.date) : null;
}

function planDueText(item){
  if(!item.date) return '';
  if(item.when) return item.when;
  return dueLabel(item.date);
}

function planDueCls(item){
  if(item.done || !item.date || item.when) return '';
  const d = planDays(item);
  if(d < 0) return ' overdue';
  if(d <= 1) return ' due-today';
  if(d <= 3) return ' due-soon';
  return '';
}

function planDateBox(item){
  if(!item.date) return '<span class="plan-date none" aria-hidden="true"></span>';
  const dt = new Date(item.date);
  const dow = dt.toLocaleDateString('ru-RU', {weekday:'short'});
  const mon = MONTHS[dt.getMonth()].slice(0,3);
  return `<span class="plan-date${planDueCls(item)}"><b>${item.when ? '≈' : dt.getDate()}</b><small>${escapeHtml(item.when ? 'конец' : dow)} · ${escapeHtml(mon)}</small></span>`;
}

function planSort(a, b){
  if(!!a.date !== !!b.date) return a.date ? -1 : 1;
  if(a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
  return 0;
}

/* «горит»: не сделано и до срока три дня или меньше (просроченное тоже) */
function planHot(){
  if(!hasPlan()) return [];
  return DATA.plan.items
    .filter(i => !i.done && i.kind !== 'idea' && i.date && !i.when && planDays(i) <= 3)
    .sort(planSort);
}

function togglePlanDone(id, evt){
  if(evt) evt.stopPropagation();
  const item = planFind(id);
  if(!item) return;
  item.done = !item.done;
  if(item.done){ logActivity(); planJustDone = id; if(evt && evt.currentTarget) burstConfetti(evt.currentTarget); }
  saveData();
  renderAll();
}

function togglePlanStep(id, index){
  const item = planFind(id);
  if(!item || !item.steps || !item.steps[index]) return;
  item.steps[index].done = !item.steps[index].done;
  if(item.steps[index].done) logActivity();
  saveData();
  renderPlan();
  renderCounts();
}

function togglePlanOpen(id){
  if(planOpen.has(id)) planOpen.delete(id); else { planOpen.add(id); planJustOpened = id; }
  renderPlan();
}

function openPlanItem(id){
  const item = planFind(id);
  if(!item) return;
  if(item.done) planShowDone = true;
  planOpen.add(id);
  planJustOpened = id;
  const view = document.getElementById('view-plan');
  if(view && view.classList.contains('active')) renderPlan();
  else goToView('plan');                     // переход сам перерисует раздел
  setTimeout(()=>{
    const el = document.getElementById('plan-' + id);
    if(el) el.scrollIntoView({block:'center', behavior:'smooth'});
  }, 40);
}

function removePlanItem(id){
  const item = planFind(id);
  if(!item) return;
  if(!confirm(`Убрать «${item.title}» из плана?`)) return;
  DATA.plan.items = DATA.plan.items.filter(i => i.id !== id);
  if(!String(id).startsWith('u-')){
    DATA.plan.removed = [...new Set([...(DATA.plan.removed || []), id])];
  }
  planOpen.delete(id);
  saveData();
  renderAll();
}

function addPlanEntry(kind){
  const input = document.getElementById('plan-add-' + kind);
  const title = input ? input.value.trim() : '';
  if(!title || !hasPlan()) return;
  DATA.plan.items.push({id: 'u-' + uid(), kind, title});
  input.value = '';
  saveData();
  renderPlan();
  renderCounts();
  const again = document.getElementById('plan-add-' + kind);
  if(again) again.focus();
}

function planStepsHtml(item){
  if(!item.steps || !item.steps.length) return '';
  const done = item.steps.filter(s => s.done).length;
  return `<div class="plan-block"><div class="plan-block-title">чек-лист · ${done} из ${item.steps.length}</div>
    <div class="steps">` + item.steps.map((st, i)=>
      `<button class="step${st.done ? ' done' : ''}" onclick="togglePlanStep('${item.id}', ${i})"><i></i><span>${escapeHtml(st.text)}</span></button>`
    ).join('') + '</div></div>';
}

function planDetailHtml(item){
  const parts = [];
  if(item.warn) parts.push(`<div class="plan-warn" role="note">${escapeHtml(item.warn)}</div>`);
  const facts = [];
  if(item.date){
    facts.push(['Срок', (item.when ? item.when : fmtDate(item.date) + ' ' + new Date(item.date).getFullYear()) +
      (item.time ? ', ' + item.time : '') + (item.when ? '' : ' — ' + dueLabel(item.date))]);
  }
  (item.details || []).forEach(d => facts.push(d));
  if(facts.length){
    parts.push('<dl class="plan-facts">' + facts.map(([k, v]) =>
      `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('') + '</dl>');
  }
  parts.push(planStepsHtml(item));
  const refs = [...(item.refs || []), ...(item.ref ? [item.ref] : [])].map(planFind).filter(Boolean);
  if(refs.length){
    parts.push('<div class="plan-refs">' + refs.map(ref =>
      `<button class="plan-ref" onclick="openPlanItem('${ref.id}')">подробно: ${escapeHtml(ref.title)} →</button>`).join('') + '</div>');
  }
  const links = (item.links || []).map(l=>{
    const href = safeUrl(l.url);
    return href ? `<a class="plan-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label || 'открыть')} ↗</a>` : '';
  }).join('');
  parts.push(`<div class="plan-actions">${links}
      <button class="plan-done-btn" onclick="togglePlanDone('${item.id}', event)">${item.done ? 'вернуть в работу' : 'готово'}</button>
      <button class="plan-remove" onclick="removePlanItem('${item.id}')">убрать</button>
    </div>`);
  return `<div class="plan-detail${planJustOpened === item.id ? ' is-opening' : ''}" id="plan-detail-${item.id}">${parts.join('')}</div>`;
}

function planItemHtml(item, index){
  const open = planOpen.has(item.id);
  const steps = item.steps && item.steps.length
    ? `<span class="plan-progress">${item.steps.filter(s=>s.done).length}/${item.steps.length}</span>` : '';
  const tags = (item.tags || []).map(t =>
    `<span class="plan-tag${/бесплатно/.test(t) ? ' free' : /платно/.test(t) && !/бес/.test(t) ? ' paid' : ''}">${escapeHtml(t)}</span>`).join('');
  const due = item.date
    ? `<span class="plan-due${planDueCls(item)}">${escapeHtml(planDueText(item))}${item.time && !item.done ? ' · ' + escapeHtml(item.time.split(' (')[0]) : ''}</span>` : '';
  const meta = [item.summary ? `<span>${escapeHtml(item.summary)}</span>` : '', tags, item.warn ? '<span class="plan-tag warn">важно</span>' : '']
    .filter(Boolean).join('');
  const cls = (item.done ? ' done' : '') + (open ? ' open' : '') + (item.star ? ' starred' : '') +
    (planJustDone === item.id ? ' just-done' : '');
  return `<div class="plan-item${cls}" id="plan-${item.id}" style="--i:${Math.min(index || 0, 14)}">
    <div class="plan-row${item.kind === 'deadline' ? ' has-date' : ''}">
      <button class="check ${item.done ? 'done' : ''}" onclick="togglePlanDone('${item.id}', event)"
        aria-label="${item.done ? 'Снять отметку' : 'Отметить сделанным'}: ${escapeHtml(item.title)}" aria-pressed="${item.done}"></button>
      ${item.kind === 'deadline' ? planDateBox(item) : ''}
      <button class="plan-head" onclick="togglePlanOpen('${item.id}')" aria-expanded="${open}" aria-controls="plan-detail-${item.id}">
        <span class="plan-title">${item.star ? '<span class="plan-star" aria-label="важное">★</span>' : ''}${escapeHtml(item.title)}</span>
        ${meta ? `<span class="plan-meta">${meta}</span>` : ''}
      </button>
      <span class="plan-side">${steps}${due}<svg class="ui-icon plan-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6"/></svg></span>
    </div>
    ${open ? planDetailHtml(item) : ''}
  </div>`;
}

function planGroups(list){
  const today = new Date(); today.setHours(0,0,0,0);
  const groups = [];
  const push = (key, title, item) => {
    let g = groups.find(x => x.key === key);
    if(!g){ g = {key, title, items: []}; groups.push(g); }
    g.items.push(item);
  };
  list.forEach(item=>{
    const d = planDays(item);
    if(d === null) push('nodate', 'Без даты', item);
    else if(d < 0) push('late', 'Просрочено', item);
    else if(d <= PLAN_SOON_DAYS && !item.when) push('soon', 'Горит — ближайшие 7 дней', item);
    else {
      const dt = new Date(item.date);
      const label = MONTHS_NOM[dt.getMonth()] + (dt.getFullYear() !== today.getFullYear() ? ' ' + dt.getFullYear() : '');
      push('m' + dt.getFullYear() + '-' + String(dt.getMonth()).padStart(2, '0'), label, item);
    }
  });
  const order = k => k === 'late' ? 0 : k === 'soon' ? 1 : k === 'nodate' ? 3 : 2;
  return groups.sort((a, b) => order(a.key) - order(b.key) || a.key.localeCompare(b.key));
}

function planAddHtml(kind, placeholder){
  return `<form class="plan-add" onsubmit="event.preventDefault(); addPlanEntry('${kind}')">
    <input id="plan-add-${kind}" type="text" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off">
    <button class="add-btn" type="submit">добавить</button>
  </form>`;
}

function renderPlan(){
  const tab = document.getElementById('tab-plan');
  const on = hasPlan();
  if(tab) tab.hidden = !on;
  const wrap = document.getElementById('plan-body');
  if(!wrap) return;
  if(!on){
    wrap.innerHTML = '';
    const view = document.getElementById('view-plan');
    if(view && view.classList.contains('active')) goToView('dashboard');
    return;
  }

  const deadlines = planItems('deadline');
  const todos = planItems('todo');
  const ideas = planItems('idea');
  const openD = deadlines.filter(i => !i.done).sort(planSort);
  const doneD = deadlines.filter(i => i.done);
  const openT = todos.filter(i => !i.done).sort(planSort);
  const doneT = todos.filter(i => i.done);
  const hot = planHot();

  const hotHtml = hot.length
    ? `<div class="plan-hot">
        <div class="plan-hot-title"><i class="plan-live" aria-hidden="true"></i>сейчас горит</div>
        ${hot.map((i, n) => `<button class="plan-hot-row" style="--i:${n}" onclick="openPlanItem('${i.id}')">
            <span class="plan-due${planDueCls(i)}">${escapeHtml(dueLabel(i.date))}${i.time ? ' · ' + escapeHtml(i.time.split(' (')[0]) : ''}</span>
            <b>${escapeHtml(i.title)}<em>${i.kind === 'todo' ? 'дело' : 'дедлайн'}</em></b>
            ${i.steps && i.steps.length ? `<small>${i.steps.filter(s=>s.done).length}/${i.steps.length} шагов</small>` : ''}
          </button>`).join('')}
      </div>` : '';

  const total = deadlines.length + todos.length;
  const doneAll = doneD.length + doneT.length;
  const pct = total ? Math.round(doneAll / total * 100) : 0;
  const next = openD.find(i => i.date && !i.when && planDays(i) >= 0);
  const nextDays = next ? planDays(next) : null;
  const nextHtml = next ? `<button class="plan-next" onclick="openPlanItem('${next.id}')">
      <span class="plan-next-label">ближайший дедлайн</span>
      <span class="plan-next-count"><b>${nextDays === 0 ? 'сегодня' : nextDays}</b>${nextDays === 0 ? '' : ' ' + plural(nextDays, 'день', 'дня', 'дней')}</span>
      <span class="plan-next-title">${escapeHtml(next.title)}${next.time ? ' · ' + escapeHtml(next.time.split(' (')[0]) : ''}</span>
    </button>` : '';
  const R = 34, C = 2 * Math.PI * R;
  const stats = `<div class="plan-hero">
      <div class="plan-ring" role="img" aria-label="Сделано ${doneAll} из ${total}">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <defs><linearGradient id="planRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--tab4)"/></linearGradient></defs>
          <circle class="plan-ring-track" cx="40" cy="40" r="${R}"/>
          <circle class="plan-ring-fill" cx="40" cy="40" r="${R}" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" style="--from:${C.toFixed(1)}"/>
        </svg>
        <span class="plan-ring-num"><b>${pct}%</b><small>${doneAll}/${total}</small></span>
      </div>
      <div class="plan-hero-stats">
        <span><b>${openD.length}</b> ${plural(openD.length, 'дедлайн', 'дедлайна', 'дедлайнов')}</span>
        <span><b>${openT.length}</b> ${plural(openT.length, 'дело', 'дела', 'дел')}</span>
        <span><b>${ideas.length}</b> ${plural(ideas.length, 'идея', 'идеи', 'идей')}</span>
      </div>
      ${nextHtml}
    </div>`;

  const deadlineHtml = planGroups(openD).map(g =>
    `<div class="plan-group plan-group-${g.key === 'late' || g.key === 'soon' ? g.key : 'month'}">
      <div class="plan-group-title">${escapeHtml(g.title)}<span>${g.items.length}</span></div>
      <div class="plan-list">${g.items.map((it, n) => planItemHtml(it, n)).join('')}</div>
    </div>`).join('') || '<div class="empty-note">Все дедлайны закрыты.</div>';

  const doneCount = doneD.length + doneT.length;
  const doneHtml = doneCount
    ? `<button class="plan-done-toggle" onclick="planShowDone=!planShowDone; renderPlan()" aria-expanded="${planShowDone}">
         ${planShowDone ? 'скрыть' : 'показать'} сделанное · ${doneCount}</button>
       ${planShowDone ? `<div class="plan-list">${[...doneD, ...doneT].map((it, n) => planItemHtml(it, n)).join('')}</div>` : ''}`
    : '';

  wrap.classList.toggle('is-entering', planEnter);
  planEnter = false;
  planJustOpened = null;
  planJustDone = null;
  wrap.innerHTML = `
    ${stats}
    ${hotHtml}
    <section class="plan-section" aria-labelledby="plan-h-deadlines">
      <h3 id="plan-h-deadlines">Дедлайны и заявки</h3>
      <p class="plan-hint">Нажми на строку — откроется всё подробно: что нужно, ссылки, чек-лист. ★ — самое важное.</p>
      ${deadlineHtml}
    </section>
    <section class="plan-section" aria-labelledby="plan-h-todo">
      <h3 id="plan-h-todo">Надо сделать</h3>
      <div class="plan-list">${openT.map((it, n) => planItemHtml(it, n)).join('') || '<div class="empty-note">Все дела сделаны.</div>'}</div>
      ${planAddHtml('todo', 'Добавить дело…')}
    </section>
    <section class="plan-section" aria-labelledby="plan-h-ideas">
      <h3 id="plan-h-ideas">Идеи</h3>
      <div class="plan-ideas">${ideas.map((i, n) => `<div class="plan-idea" style="--i:${n}">
          <span>${escapeHtml(i.title)}</span>
          <button class="icon-btn del" aria-label="Убрать идею: ${escapeHtml(i.title)}" onclick="removePlanItem('${i.id}')"><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
        </div>`).join('') || '<div class="empty-note">Идей пока нет.</div>'}</div>
      ${planAddHtml('idea', 'Записать идею…')}
    </section>
    <section class="plan-section">${doneHtml}</section>`;
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
    <div class="settings-card"><label><input id="scene-fx" type="checkbox" ${SCENE_SETTINGS.fx!==false?'checked':''}> Живой фон: частицы, свечение, искры</label><small>Выключи, если телефон греется или сайт подтормаживает. Остальные анимации останутся.</small></div>
    <div class="field"><label>Сколько показывать: <b id="duration-value">${SCENE_SETTINGS.duration} сек.</b></label><input id="scene-duration" type="range" min="8" max="40" step="4" value="${SCENE_SETTINGS.duration}"></div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Отмена</button><button class="btn-primary" onclick="saveSettings()">Сохранить</button></div>`;
  document.getElementById('scene-duration').addEventListener('input', e=>document.getElementById('duration-value').textContent=e.target.value+' сек.');
  document.getElementById('overlay').classList.add('open');
}
function saveSettings(){
  const fxWas = SCENE_SETTINGS.fx !== false;
  SCENE_SETTINGS={enabled:document.getElementById('scene-enabled').checked,loop:document.getElementById('scene-loop').checked,duration:Number(document.getElementById('scene-duration').value),fx:document.getElementById('scene-fx').checked};
  saveSceneSettings(); applyFxSetting(); closeModal();
  /* заставку переигрываем, только если меняли её, а не один лишь фон */
  if(fxWas === SCENE_SETTINGS.fx) launchIntro(true);
}
function applyFxSetting(){
  document.documentElement.dataset.fx = SCENE_SETTINGS.fx === false ? 'off' : 'on';
}
applyFxSetting();

/* буквы названия на заставке влетают по одной */
function splitIntroTitle(){
  document.querySelectorAll('#intro-splash .intro-line').forEach(line=>{
    if(line.dataset.split) return;
    line.dataset.split = '1';
    const host = line.querySelector('em') || line;
    host.innerHTML = [...host.textContent].map(ch => `<span class="intro-char">${escapeHtml(ch)}</span>`).join('');
  });
  document.querySelectorAll('#intro-splash .intro-char').forEach((el, i) => el.style.setProperty('--i', i));
  measureIntroTitle();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(measureIntroTitle);
}
/* позиция каждой буквы в em — чтобы градиент шёл через слово без стыков */
function measureIntroTitle(){
  const em = document.querySelector('#intro-splash .intro-title em');
  if(!em || !em.getClientRects().length) return;
  const size = parseFloat(getComputedStyle(em).fontSize) || 1;
  em.querySelectorAll('.intro-char').forEach(el => el.style.setProperty('--x', (el.offsetLeft / size).toFixed(3)));
}

function launchIntro(force=false){
  const splash=document.getElementById('intro-splash'); if(!splash) return;
  if(!force && (!SCENE_SETTINGS.enabled || sessionStorage.getItem('intro-shown'))) { splash.classList.add('done'); return; }
  splitIntroTitle();
  splash.classList.remove('done','closing'); document.documentElement.style.setProperty('--scene-duration',SCENE_SETTINGS.duration+'s');
  splash.classList.toggle('intro-loop',SCENE_SETTINGS.loop); sessionStorage.setItem('intro-shown','1');
  let closed=false; const closeIntro=()=>{if(closed)return;closed=true;splash.classList.add('closing');setTimeout(()=>splash.classList.add('done'),1400);
    if(typeof window.fxEnterView==='function') window.fxEnterView();   // обзор «въезжает», пока заставка тает
  };
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
  const apply = ()=>{
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    renderSummCharts();
  };
  const root = document.documentElement;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* новая тема раскрывается кругом от кнопки; где так нельзя — просто переключаем */
  if(!document.startViewTransition || reduce || resolveTheme(next) === resolveTheme(storedTheme())){ apply(); return; }
  const btn = document.getElementById('theme-toggle');
  const r = btn && btn.getClientRects().length ? btn.getBoundingClientRect() : null;
  const onScreen = r && r.right > 0 && r.left < innerWidth;
  root.style.setProperty('--vx', (onScreen ? r.left + r.width/2 : innerWidth/2) + 'px');
  root.style.setProperty('--vy', (onScreen ? r.top + r.height/2 : innerHeight/2) + 'px');
  root.classList.add('theme-vt');
  const vt = document.startViewTransition(apply);
  vt.finished.finally(()=> root.classList.remove('theme-vt'));
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
  events: 'Событие', goals: 'Цель', notes: 'Заметка', fun: 'Развлечение'
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
  fxGhostOut(document.getElementById('palette-overlay'));
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
  {key:'lessons',    label:'Уроки'},
  {key:'fun',        label:'Развлечения'}
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
  DATA.fun.forEach(i => push('fun', i, i.title, [FUN_KINDS[i.kind]||i.kind, i.note].filter(Boolean).join(' · '), i.link));

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
const POMODORO_DEFAULTS = { focus: 25, short: 5, long: 15 };   // в минутах

/* Длительности можно поменять под себя, они лежат в DATA. */
function pomodoroMinutes(mode){
  const custom = (DATA.pomodoro && Number(DATA.pomodoro[mode])) || 0;
  return custom >= 1 && custom <= 180 ? custom : POMODORO_DEFAULTS[mode];
}
function pomodoroSeconds(mode){ return pomodoroMinutes(mode) * 60; }

/* сколько подходов «учёбы» закрыто сегодня */
function pomodoroTodayCount(){
  const log = DATA.pomodoroLog || {};
  return log[schedDateKey(new Date())] || 0;
}
function pomodoroLogRound(){
  DATA.pomodoroLog = DATA.pomodoroLog || {};
  const key = schedDateKey(new Date());
  DATA.pomodoroLog[key] = (DATA.pomodoroLog[key] || 0) + 1;
  saveData();
}
const POMODORO_LABELS = { focus: 'Учёба', short: 'Короткий перерыв', long: 'Длинный перерыв' };
let pomodoroMode = 'focus';
let pomodoroRemaining = POMODORO_DEFAULTS.focus * 60;
let pomodoroRunning = false;
let pomodoroTimer = null;


/* ---- свои интервалы ---- */
function openPomodoroSettings(){
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Таймер фокуса</h3>
    <div class="field"><label>Учёба, минут</label>
      <input id="pd-focus" type="number" min="1" max="180" value="${pomodoroMinutes('focus')}"></div>
    <div class="field"><label>Короткий перерыв, минут</label>
      <input id="pd-short" type="number" min="1" max="180" value="${pomodoroMinutes('short')}"></div>
    <div class="field"><label>Длинный перерыв, минут</label>
      <input id="pd-long" type="number" min="1" max="180" value="${pomodoroMinutes('long')}"></div>
    <p class="import-note">Закрытые подходы «учёбы» считаются по дням — видно прямо в таймере.</p>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="resetPomodoro()">Сбросить</button>
      <button class="btn-secondary" onclick="closeModal()">Отмена</button>
      <button class="btn-primary" onclick="savePomodoro()">Сохранить</button>
    </div>`;
  document.getElementById('overlay').classList.add('open');
}

function savePomodoro(){
  DATA.pomodoro = {
    focus: Number(document.getElementById('pd-focus').value) || POMODORO_DEFAULTS.focus,
    short: Number(document.getElementById('pd-short').value) || POMODORO_DEFAULTS.short,
    long:  Number(document.getElementById('pd-long').value)  || POMODORO_DEFAULTS.long
  };
  saveData();
  pomodoroSetMode(pomodoroMode);
  closeModal();
}

function resetPomodoro(){
  delete DATA.pomodoro;
  saveData();
  pomodoroSetMode(pomodoroMode);
  closeModal();
}

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
  const rounds = document.getElementById('pomodoro-rounds');
  if(rounds){
    const n = pomodoroTodayCount();
    rounds.textContent = n ? `сегодня ${n} ${plural(n,'подход','подхода','подходов')}` : 'сегодня ещё ни одного';
  }
  const modes = document.querySelectorAll('.pomodoro-modes button[data-mode]');
  modes.forEach(btn=>{
    btn.textContent = pomodoroMinutes(btn.dataset.mode) + ' мин';
    const isActive = btn.dataset.mode === pomodoroMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
function pomodoroTogglePanel(){
  document.getElementById('pomodoro').classList.toggle('open');
}
function pomodoroSetMode(mode){
  pomodoroMode = mode;
  pomodoroRemaining = pomodoroSeconds(mode);
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
  pomodoroRemaining = pomodoroSeconds(pomodoroMode);
  pomodoroRender();
}
function pomodoroNotifyDone(){
  if(pomodoroMode === 'focus') pomodoroLogRound();
  burstConfetti(document.querySelector('.pomodoro-toggle'));
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification(pomodoroMode === 'focus' ? '25 минут прошли — можно отдохнуть' : 'Перерыв закончился');
  }
  pomodoroSetMode(pomodoroMode === 'focus' ? 'short' : 'focus');
  document.getElementById('pomodoro').classList.add('open');
}
pomodoroRender();

/* статус текущего урока обновляем раз в минуту */
setInterval(()=>{ renderTodayLessons(); renderMobileTitle(); }, 60*1000);

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

  const views = ['dashboard','schedule','lessons','subjects','homework','summatives','events','goals','notes','calendar','fun'];
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

/* ============ ЖИВЫЕ ЭФФЕКТЫ ============ */
/* Всё здесь — только украшение: если эффекты выключить, сайт работает так же.
   При «уменьшить движение» в системе почти всё отключается. */
(function(){
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const main = document.querySelector('.main');

  /* буквы заголовков влетают по одной при каждом открытии раздела */
  function splitHeading(h){
    if(h.dataset.split) return;
    h.dataset.split = '1';
    const text = h.textContent;
    h.setAttribute('aria-label', text);
    let i = 0;   // слово целиком не переносится, буквы внутри влетают по одной
    h.innerHTML = text.split(' ').map(word =>
      '<span class="split-word" aria-hidden="true">' +
      [...word].map(ch => `<span class="split-char" style="--i:${i++}">${escapeHtml(ch)}</span>`).join('') +
      '</span>').join(' ');
  }
  if(!reduce) document.querySelectorAll('.section-head h2').forEach(splitHeading);

  /* у каждого раздела свой живой предмет */
  const now = new Date();
  const MON = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'][now.getMonth()];
  const ART = {
    plan: `<div class="rkw"><div class="rk"><div class="rk-body"></div><i class="rk-win"></i><i class="rk-fin l"></i><i class="rk-fin r"></i><i class="rk-flame"></i></div></div>
           <i class="st s1"></i><i class="st s2"></i><i class="st s3"></i>`,
    schedule: `<div class="hg"><i class="hg-rod l"></i><i class="hg-rod r"></i><div class="hg-glass"><i class="hg-sand top"></i><i class="hg-stream"></i><i class="hg-sand bot"></i></div><i class="hg-cap t"></i><i class="hg-cap b"></i></div>`,
    lessons: `<div class="bk"><i class="bk-b b1"></i><i class="bk-b b2"></i><i class="bk-b b3"></i><div class="bk-open"><i class="bk-pg"></i><i class="bk-pg p2"></i></div></div>`,
    subjects: `<div class="at"><div class="at-orb o1"><div class="at-spin"><i></i></div></div><div class="at-orb o2"><div class="at-spin"><i></i></div></div><div class="at-orb o3"><div class="at-spin"><i></i></div></div><i class="at-core"></i></div>`,
    homework: `<svg class="hw-svg" viewBox="0 0 130 112">
        <defs><linearGradient id="hwPaper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6ec"/></linearGradient>
          <linearGradient id="hwPen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0a860"/><stop offset=".5" stop-color="#ffd59a"/><stop offset="1" stop-color="#c97a2e"/></linearGradient></defs>
        <g transform="rotate(-8 60 56)">
          <rect x="18" y="12" width="84" height="88" rx="8" fill="url(#hwPaper)"/>
          <g stroke="#c9d6e0" stroke-width="1"><line x1="30" y1="40" x2="94" y2="40"/><line x1="30" y1="56" x2="94" y2="56"/><line x1="30" y1="72" x2="94" y2="72"/><line x1="30" y1="88" x2="94" y2="88"/></g>
          <g fill="#6d8291">${[22,36,50,64,78,92].map(y=>`<circle cx="18" cy="${y}" r="3.5"/>`).join('')}</g>
          <path class="hw-ink i1" d="M32 37 q5 -8 10 0 t10 0 t10 0 t10 0 t10 0"/>
          <path class="hw-ink i2" d="M32 53 q5 -8 10 0 t10 0 t10 0 t10 0"/>
          <g class="hw-pen"><g transform="translate(32 37) rotate(-48)">
            <rect x="0" y="-4" width="44" height="8" rx="2" fill="url(#hwPen)"/>
            <rect x="40" y="-4" width="8" height="8" rx="1.5" fill="#f2a8d0"/><rect x="37" y="-4" width="4" height="8" fill="#c4d2db"/>
            <polygon points="0,-4 -9,0 0,4" fill="#f4dcc0"/><polygon points="-6,-1.4 -9,0 -6,1.4" fill="#33383f"/>
          </g></g>
        </g></svg>`,
    summatives: `<div class="tr"><i class="tr-h l"></i><i class="tr-h r"></i><div class="tr-cup"></div><i class="tr-stem"></i><i class="tr-base"></i><i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i></div>`,
    events: `<div class="tk"><div class="tk-card"><b>VIP</b></div><i class="cf c1"></i><i class="cf c2"></i><i class="cf c3"></i><i class="cf c4"></i></div>`,
    goals: `<div class="tg"><i class="tg-board"></i><i class="tg-arrow"></i></div>`,
    notes: `<div class="nt"><i class="nt-n n1"></i><i class="nt-n n2"></i><i class="nt-n n3"></i></div>`,
    calendar: `<div class="fc"><div class="fc-page"><b class="fc-head">${MON}</b><b class="fc-num">${now.getDate()}</b></div><i class="fc-flap"></i><i class="fc-ring r1"></i><i class="fc-ring r2"></i></div>`,
    fun: `<div class="vn"><div class="vn-rec"><i class="vn-label"></i></div><i class="vn-arm"></i><i class="mn">♪</i><i class="mn m2">♫</i></div>`
  };
  Object.entries(ART).forEach(([view, html])=>{
    const head = document.querySelector(`#view-${view} .section-head`);
    if(!head) return;
    const art = document.createElement('div');
    art.className = 'sect-art art-' + view;
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = `<div class="art-glow"></div><div class="art-stage">${html}</div>`;
    head.insertBefore(art, head.querySelector(':scope > .add-btn, :scope > .head-btns'));   // предмет — перед кнопками, а не после них
    head.classList.add('has-art');
  });
  const heroObj = document.querySelector('.hero-object');
  if(heroObj) heroObj.insertAdjacentHTML('beforeend',
    '<i class="hero-orb o1"></i><i class="hero-orb o2"></i><i class="hero-orb o3"></i><i class="hero-orb o4"></i>');

  /* числа отсчитываются от нуля */
  function countUp(el){
    const m = /^(\d+)(.*)$/.exec(el.textContent.trim());
    if(!m) return;
    const target = Number(m[1]), tail = m[2];
    if(target === 0) return;
    const start = performance.now(), dur = 900;
    const tick = now => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(target * e) + tail;
      if(t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const COUNT_SEL = '.stat-row .value, .plan-hero-stats b, .plan-ring-num b, .plan-next-count b, ' +
    '.summ-stat-value, .summ-subject-pill b, .goal-pct, .forecast-pct';

  /* появление при прокрутке: только то, что ниже экрана, чтобы
     перерисовка после галочки не заставляла всё моргать */
  const REVEAL_SEL = '.plan-item, .plan-group-title, .plan-section h3, .plan-idea, .item-row, .goal-card, ' +
    '.note-card, .subject-card, .activity-heatmap, .workload, .today-lessons, .orbit-wrap, .quick-action, ' +
    '.fun-card, .chart-card, .upcoming-item, .day-panel';
  const io = (!reduce && 'IntersectionObserver' in window) ? new IntersectionObserver(entries=>{
    let n = 0;
    entries.forEach(en=>{
      if(!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      el.style.setProperty('--rd', (n++ * 45) + 'ms');
      el.classList.remove('reveal-pending');
      el.classList.add('revealed', 'fx-in');      // fx-in: полосы, графики и клетки внутри дорисовываются
      setTimeout(()=> el.classList.remove('fx-in'), 2200);
      /* animationend всплывает и от вложенных элементов — ждём именно свой */
      const done = ev => {
        if(ev.target !== el) return;
        el.removeEventListener('animationend', done);
        el.classList.remove('revealed');
      };
      el.addEventListener('animationend', done);
    });
  }, {threshold: 0.08}) : null;

  function tagBelowFold(root){
    if(!io || !root) return;
    const limit = window.innerHeight;
    root.querySelectorAll(REVEAL_SEL).forEach(el=>{
      if(el.classList.contains('reveal-pending')) return;
      const r = el.getBoundingClientRect();
      if(r.height === 0 || r.top < limit - 20) return;
      el.classList.add('reveal-pending');
      io.observe(el);
    });
  }

  function onViewShown(){
    const view = document.querySelector('.view.active');
    if(!view) return;
    requestAnimationFrame(()=>{
      if(!reduce) view.querySelectorAll(COUNT_SEL).forEach(countUp);
      tagBelowFold(view);
    });
  }
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', onViewShown));

  if(main && io && 'MutationObserver' in window){
    let pending = false;
    new MutationObserver(()=>{
      if(pending) return;
      pending = true;
      requestAnimationFrame(()=>{ pending = false; tagBelowFold(document.querySelector('.view.active')); });
    }).observe(main, {childList:true, subtree:true});
  }

  /* волна от нажатия */
  const RIPPLE_SEL = '.add-btn, .btn-primary, .urgent-go, .plan-link, .plan-done-btn, .quick-action, .plan-next, .tab-btn, ' +
    '.bottom-nav button, .plan-hot-row, .status-chip, .subject-pill, .sched-today, .btn-secondary, .quick-task button, ' +
    '.pomodoro-controls button, .theme-toggle, .settings-btn, .backup-btn';
  document.addEventListener('pointerdown', e=>{
    if(reduce) return;
    const btn = e.target.closest && e.target.closest(RIPPLE_SEL);
    if(!btn) return;
    const r = btn.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = (e.clientX - r.left) + 'px';
    dot.style.top = (e.clientY - r.top) + 'px';
    btn.appendChild(dot);
    dot.addEventListener('animationend', ()=> dot.remove(), {once:true});
  }, {passive:true});

  if(reduce || !fine) return;   // дальше — эффекты только для мыши

  /* мягкий свет тянется за курсором */
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);
  let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, gRun = false;
  const glowLoop = ()=>{
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    if(Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) requestAnimationFrame(glowLoop); else gRun = false;
  };

  const SPOT_SEL = '.ledger, .plan-list, .goal-card, .quick-action, .stat-row, .fun-card, .chart-card, ' +
    '.today-lessons, .workload, .activity-heatmap, .orbit-wrap, .summ-stats, .cal-grid, .dashboard-hero';
  const TILT_SEL = '.plan-hero, .plan-idea, .goal-card, .quick-action, .sect-art, .fun-card, .stat-row, .orbit-wrap';
  const MAG_SEL = '.add-btn, .plan-next, .urgent-go, .btn-primary, .pomodoro-toggle, .brand .mark';
  let tiltEl = null, magEl = null, frame = 0, last = null;

  function resetTilt(){
    if(!tiltEl) return;
    tiltEl.classList.remove('tilting');
    tiltEl.style.setProperty('--rx', '0deg');
    tiltEl.style.setProperty('--ry', '0deg');
    tiltEl = null;
  }
  function resetMag(){
    if(!magEl) return;
    magEl.style.setProperty('--tx', '0px');
    magEl.style.setProperty('--ty', '0px');
    magEl = null;
  }

  function onMove(){
    frame = 0;
    const e = last;
    tx = e.clientX; ty = e.clientY;
    glow.classList.add('on');
    if(!gRun){ gRun = true; requestAnimationFrame(glowLoop); }

    const t = e.target.closest ? e.target : null;
    if(!t) return;

    const spot = t.closest(SPOT_SEL);
    if(spot){
      const r = spot.getBoundingClientRect();
      spot.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      spot.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }

    const tilt = t.closest(TILT_SEL);
    if(tilt !== tiltEl) resetTilt();
    if(tilt){
      tiltEl = tilt;
      const r = tilt.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      const k = r.width > 500 ? 2.5 : 7;        // большие карточки качаются меньше
      tilt.classList.add('tilt', 'tilting');
      tilt.style.setProperty('--rx', (-py * k).toFixed(2) + 'deg');
      tilt.style.setProperty('--ry', (px * k).toFixed(2) + 'deg');
    }

    const mag = t.closest(MAG_SEL);
    if(mag !== magEl) resetMag();
    if(mag){
      magEl = mag;
      const r = mag.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      mag.classList.add('magnetic');
      mag.style.setProperty('--tx', Math.max(-8, Math.min(8, dx * 0.25)).toFixed(1) + 'px');
      mag.style.setProperty('--ty', Math.max(-6, Math.min(6, dy * 0.3)).toFixed(1) + 'px');
    }
  }

  document.addEventListener('pointermove', e=>{
    last = e;
    if(!frame) frame = requestAnimationFrame(onMove);
  }, {passive:true});
  document.addEventListener('pointerleave', ()=>{ glow.classList.remove('on'); resetTilt(); resetMag(); });
  window.addEventListener('blur', ()=>{ glow.classList.remove('on'); resetTilt(); resetMag(); });
})();

/* ============ СЛОЙ «ПУЛЬС» ============ */
/* Вторая волна украшений: небо из частиц, переходы между разделами, бегунок
   в меню, «живые» галочки и удаление, искры от нажатий, печатающаяся подсказка.
   Как и выше — чистая косметика: без неё всё работает так же. */
(function(){
  const root = document.documentElement;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const main = document.querySelector('.main');
  const tabs = document.getElementById('tabs');
  const fxOn = () => root.dataset.fx !== 'off';
  const mk = (tag, cls, parent) => {
    const el = document.createElement(tag);
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    (parent || document.body).appendChild(el);
    return el;
  };

  /* ---------- бегунок под активной вкладкой ---------- */
  const glider = mk('i', 'tab-glider', tabs);
  function syncGlider(){
    const a = tabs.querySelector('.tab-btn.active');
    if(!a || a.hidden || !a.offsetHeight){ glider.style.opacity = '0'; return; }
    glider.style.opacity = '1';
    glider.style.width = a.offsetWidth + 'px';
    glider.style.height = a.offsetHeight + 'px';
    glider.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    glider.style.setProperty('--dotc', a.style.getPropertyValue('--dotc') || 'var(--gold)');
  }
  const bottomNav = document.getElementById('bottom-nav');
  const bnGlider = bottomNav ? mk('i', 'bn-glider', bottomNav) : null;
  function syncBnGlider(){
    if(!bnGlider) return;
    const a = bottomNav.querySelector('button.active');
    if(!a || !a.offsetWidth){ bnGlider.style.opacity = '0'; return; }
    bnGlider.style.opacity = '1';
    bnGlider.style.width = (a.offsetWidth - 12) + 'px';
    bnGlider.style.transform = `translateX(${a.offsetLeft + 6}px)`;
  }
  function syncGliders(){ syncGlider(); syncBnGlider(); }
  syncGliders();
  requestAnimationFrame(()=>{ syncGliders(); root.classList.add('fx-ready'); });   // после первого кадра бегунок уже скользит
  window.addEventListener('resize', syncGliders);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(syncGliders);
  if('MutationObserver' in window){
    new MutationObserver(syncGliders).observe(tabs, {attributes:true, attributeFilter:['hidden','class'], subtree:true});
    if(bottomNav) new MutationObserver(syncBnGlider).observe(bottomNav, {attributes:true, attributeFilter:['class'], subtree:true});
  }

  /* ---------- счётчики в меню подпрыгивают, когда число меняется ---------- */
  const countWas = new Map();
  function watchCounts(){
    document.querySelectorAll('.tab-btn .count, .bottom-badge').forEach(el=>{
      const now = el.textContent.trim(), was = countWas.get(el);
      countWas.set(el, now);
      if(was === undefined || was === now || reduce) return;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    });
  }
  watchCounts();
  if('MutationObserver' in window){
    new MutationObserver(watchCounts).observe(tabs, {childList:true, characterData:true, subtree:true});
    if(bottomNav) new MutationObserver(watchCounts).observe(bottomNav, {childList:true, characterData:true, subtree:true});
  }

  /* ---------- вход в раздел: каскад сверху вниз ---------- */
  const CASCADE = '.item-row, .goal-card, .fun-card, .subject-pill, .status-chip, .stat-row, .quick-action, ' +
    '.upcoming-item, .today-row, .summ-stat-card, .summ-subject-pill, .chart-card, .fun-source, .urgent-chip, ' +
    '.sched-head, .sched-cell, .sched-time, .hw-filter-row, .quick-task, .cal-head, .sched-nav, .topline, ' +
    '.dashboard-hero, .today-lessons, .workload, .orbit-wrap, .activity-heatmap, .urgent.on, .summ-stats, ' +
    '.forecast, .subject-detail-head, .empty-note, .day-panel, .plan-hero, .plan-hot';
  let enterTimer = 0;
  function enterView(dir){
    const view = document.querySelector('.view.active');
    if(!view || reduce) return;
    document.querySelectorAll('.view.fx-enter').forEach(v => v.classList.remove('fx-enter'));
    view.style.setProperty('--dir', dir || 1);
    const top = main.getBoundingClientRect().top, vh = window.innerHeight;
    view.querySelectorAll(CASCADE).forEach(el=>{
      const r = el.getBoundingClientRect();
      if(!r.height || r.top > vh) return;        // то, что ниже экрана, появится при прокрутке
      const i = Math.round((r.top - top) / 46 + r.left / 520);
      el.style.setProperty('--i', Math.max(0, Math.min(18, i)));
    });
    void view.offsetWidth;
    view.classList.add('fx-enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(()=> view.classList.remove('fx-enter'), 2000);
  }
  window.fxEnterView = () => enterView(1);

  /* ---------- цветная волна и луч при переходе ---------- */
  const pulse = mk('i', 'route-pulse');
  const beam = mk('i', 'route-beam');
  const scrollBar = mk('i', 'scroll-beam');
  function placeBars(){
    const r = main.getBoundingClientRect();
    [beam, scrollBar].forEach(el=>{
      el.style.left = r.left + 'px';
      el.style.top = r.top + 'px';
      el.style.width = r.width + 'px';
    });
  }
  placeBars();
  window.addEventListener('resize', placeBars);

  const tabBtns = [...document.querySelectorAll('.tab-btn')];
  tabBtns.forEach((b, i) => b.style.setProperty('--ti', i));      // вкладки въезжают по очереди
  let lastIdx = tabBtns.findIndex(b => b.classList.contains('active'));
  tabBtns.forEach((btn, idx)=> btn.addEventListener('click', e=>{
    const dir = idx >= lastIdx ? 1 : -1;
    const same = idx === lastIdx;
    lastIdx = idx;
    main.scrollTop = 0;
    syncGliders();
    if(reduce) return;
    enterView(dir);
    if(same) return;
    const color = btn.style.getPropertyValue('--dotc') || 'var(--gold)';
    let x = e.clientX, y = e.clientY;
    if(!x && !y){            // переход с клавиатуры или из нижней панели: волна идёт от самой вкладки
      const bn = document.querySelector('.bottom-nav button.active');
      const src = bn && bn.getClientRects().length ? bn : btn;
      const r = src.getClientRects().length ? src.getBoundingClientRect() : null;
      x = r && r.right > 0 ? r.left + r.width/2 : 0;
      y = r && r.right > 0 ? r.top + r.height/2 : window.innerHeight/2;
    }
    [pulse, beam].forEach(el => el.style.setProperty('--c', color));
    pulse.style.left = x + 'px';
    pulse.style.top = y + 'px';
    placeBars();
    pulse.classList.remove('go'); beam.classList.remove('go');
    void pulse.offsetWidth;
    if(fxOn()) pulse.classList.add('go');
    beam.classList.add('go');
  }));

  /* ---------- полоска прокрутки ---------- */
  let scrollTick = false;
  main.addEventListener('scroll', ()=>{
    if(scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(()=>{
      scrollTick = false;
      const max = main.scrollHeight - main.clientHeight;
      const p = max > 40 ? main.scrollTop / max : 0;
      scrollBar.style.transform = `scaleX(${p.toFixed(4)})`;
      scrollBar.style.opacity = p > 0.005 ? '1' : '0';
      root.classList.toggle('is-scrolled', main.scrollTop > 24);
    });
  }, {passive:true});

  /* ---------- герой: слова заголовка выезжают из-под маски ---------- */
  const h1 = document.querySelector('.hero-copy h1');
  if(h1 && !reduce){
    const label = h1.textContent.replace(/\s+/g, ' ').trim();
    let wi = 0;
    const wrapWords = node => {
      [...node.childNodes].forEach(n=>{
        if(n.nodeType === 3){
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part=>{
            if(!part) return;
            if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'hw';
            w.innerHTML = `<span class="hw-in" style="--i:${wi++}">${escapeHtml(part)}</span>`;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if(n.nodeType === 1 && n.tagName !== 'BR') wrapWords(n);
      });
    };
    wrapWords(h1);
    h1.setAttribute('aria-label', label);
  }
  const hero = document.querySelector('.dashboard-hero');
  if(hero) hero.insertAdjacentHTML('afterbegin',
    '<div class="hero-fx" aria-hidden="true"><i class="hero-blob b1"></i><i class="hero-blob b2"></i><i class="hero-floor"></i></div>');

  /* ---------- галочка и удаление сначала отыгрывают анимацию, потом срабатывают ---------- */
  /* Клик перехватывается, строка доигрывает ~0.3 с, после чего тот же клик
     повторяется уже «по-настоящему». Пока строка в ожидании, новые клики по ней гасим. */
  const waiting = new WeakSet();
  function deferClick(el, rowCls, ms){
    waiting.add(el);
    const row = el.closest('.item-row, .goal-card, .fun-card');
    if(row) row.classList.add(rowCls);
    setTimeout(()=>{ if(el.isConnected) el.click(); }, ms);
  }
  document.addEventListener('click', e=>{
    if(reduce || !e.isTrusted || !e.target.closest) return;
    const check = e.target.closest('.item-row > .check');
    const del = !check && e.target.closest('.item-row .icon-btn.del, .goal-card .icon-btn.del, .fun-card .fun-btn.del');
    const el = check || del;
    if(!el) return;
    if(waiting.has(el)){ e.stopPropagation(); e.preventDefault(); return; }
    if(check && check.classList.contains('done')) return;      // снять галочку — сразу
    e.stopPropagation(); e.preventDefault();
    if(check){ check.classList.add('done', 'fx-checking'); deferClick(check, 'fx-completing', 340); }
    else deferClick(del, 'fx-removing', 230);
  }, true);

  /* ---------- подсказка в быстром вводе печатается сама ---------- */
  const quick = document.getElementById('quick-task-input');
  if(quick && !reduce){
    const SAMPLES = ['матем параграф 12 пт !', 'физика сор 15 окт', 'англ эссе завтра', 'история конспект ср', 'химия соч 20 дек !'];
    let si = 0, ci = 0, dir = 1;
    const type = ()=>{
      const idle = !quick.value && document.activeElement !== quick && quick.getClientRects().length;
      if(!idle){ setTimeout(type, 900); return; }
      const text = SAMPLES[si];
      ci += dir;
      quick.placeholder = text.slice(0, ci) + (ci < text.length || dir < 0 ? '▍' : '');
      if(dir > 0 && ci >= text.length){ dir = -1; setTimeout(type, 1700); return; }
      if(dir < 0 && ci <= 0){ dir = 1; si = (si + 1) % SAMPLES.length; setTimeout(type, 350); return; }
      setTimeout(type, dir > 0 ? 62 : 24);
    };
    setTimeout(type, 1200);
  }

  if(reduce) return;   // дальше — только движение ради движения

  /* ---------- искры от нажатия ---------- */
  document.addEventListener('pointerdown', e=>{
    if(!fxOn() || !e.isPrimary) return;
    const box = mk('i', 'spark-box');
    box.style.left = e.clientX + 'px';
    box.style.top = e.clientY + 'px';
    for(let i = 0; i < 7; i++){
      const s = document.createElement('i');
      s.style.setProperty('--a', (i * 360/7 + Math.random()*30) + 'deg');
      s.style.setProperty('--d', (18 + Math.random()*20) + 'px');
      box.appendChild(s);
    }
    setTimeout(()=> box.remove(), 600);
  }, {passive:true});

  /* ---------- небо: частицы, созвездия у курсора, падающие звёзды ---------- */
  const sky = mk('canvas', 'fx-sky');
  document.body.insertBefore(sky, document.body.firstChild);
  const aur = mk('div', 'fx-aurora');
  aur.innerHTML = '<i class="a1"></i><i class="a2"></i><i class="a3"></i>';
  document.body.insertBefore(aur, document.body.firstChild);

  const ctx = sky.getContext('2d');
  const PAL = {
    dark:  ['79,209,197', '201,168,242', '242,168,208', '255,255,255', '255,255,255'],
    light: ['15,158,143', '138,95,214', '194,85,154', '47,127,214', '90,100,120']
  };
  const N = fine ? 78 : 34, LINK = 118;
  let W = 0, H = 0, pts = [], mx = -9999, my = -9999, skyRaf = 0, meteor = null, nextMeteor = performance.now() + 3500;
  function sizeSky(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    sky.width = W * dpr; sky.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seedSky(){
    pts = Array.from({length: N}, ()=>({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
      r: .5 + Math.random()*1.7, c: Math.floor(Math.random()*5),
      ph: Math.random()*6.28, sp: .4 + Math.random()*1.3
    }));
  }
  function drawSky(t){
    skyRaf = 0;
    if(document.hidden || !fxOn()){ ctx.clearRect(0, 0, W, H); return; }
    const pal = root.getAttribute('data-theme') === 'light' ? PAL.light : PAL.dark;
    const k = root.getAttribute('data-theme') === 'light' ? .75 : 1;
    ctx.clearRect(0, 0, W, H);
    for(let i = 0; i < pts.length; i++){
      const p = pts[i];
      const dx = p.x - mx, dy = p.y - my, d2 = dx*dx + dy*dy;
      if(d2 < 19600 && d2 > 1){              // курсор мягко расталкивает частицы
        const f = (1 - Math.sqrt(d2)/140) * .5;
        p.x += dx / Math.sqrt(d2) * f; p.y += dy / Math.sqrt(d2) * f;
      }
      p.x += p.vx; p.y += p.vy;
      if(p.x < -10) p.x = W + 10; else if(p.x > W + 10) p.x = -10;
      if(p.y < -10) p.y = H + 10; else if(p.y > H + 10) p.y = -10;
      const a = (.22 + .58 * Math.abs(Math.sin(t/1000 * p.sp + p.ph))) * k;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = `rgba(${pal[p.c]},${a.toFixed(3)})`;
      ctx.fill();
      if(!fine) continue;
      for(let j = i + 1; j < pts.length; j++){
        const q = pts[j], ex = p.x - q.x, ey = p.y - q.y, e2 = ex*ex + ey*ey;
        if(e2 > LINK*LINK) continue;
        ctx.strokeStyle = `rgba(${pal[p.c]},${((1 - Math.sqrt(e2)/LINK) * .16 * k).toFixed(3)})`;
        ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      if(d2 < 32400){                         // созвездие тянется к курсору
        ctx.strokeStyle = `rgba(${pal[p.c]},${((1 - Math.sqrt(d2)/180) * .42 * k).toFixed(3)})`;
        ctx.lineWidth = .7;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mx, my); ctx.stroke();
      }
    }
    if(!meteor && t > nextMeteor){
      meteor = {x: Math.random()*W*.8 + W*.1, y: -20, vx: -(4 + Math.random()*3), vy: 5 + Math.random()*3, life: 1};
    }
    if(meteor){
      const m = meteor;
      m.x += m.vx; m.y += m.vy; m.life -= .012;
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx*14, m.y - m.vy*14);
      g.addColorStop(0, `rgba(${pal[3]},${(.85 * m.life * k).toFixed(3)})`);
      g.addColorStop(1, `rgba(${pal[0]},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx*14, m.y - m.vy*14); ctx.stroke();
      if(m.life <= 0 || m.y > H + 40 || m.x < -40){ meteor = null; nextMeteor = t + 5000 + Math.random()*7000; }
    }
    skyRaf = requestAnimationFrame(drawSky);
  }
  const wakeSky = ()=>{ if(!skyRaf) skyRaf = requestAnimationFrame(drawSky); };
  sizeSky(); seedSky(); wakeSky();
  window.addEventListener('resize', ()=>{ sizeSky(); seedSky(); wakeSky(); });
  document.addEventListener('visibilitychange', wakeSky);
  if('MutationObserver' in window) new MutationObserver(wakeSky).observe(root, {attributes:true, attributeFilter:['data-fx']});

  if(!fine) return;   // дальше — только для мыши

  /* ---------- кольцо-спутник у курсора и параллакс героя ---------- */
  const ring = mk('i', 'cursor-ring');
  const HOT = 'button, a, .check, [onclick], input, select, textarea, label, .cal-cell, .sched-cell';
  let rx = -100, ry = -100, tx = -100, ty = -100, ringRun = false;
  const ringLoop = ()=>{
    rx += (tx - rx) * .2; ry += (ty - ry) * .2;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    if(Math.abs(tx - rx) + Math.abs(ty - ry) > .3) requestAnimationFrame(ringLoop); else ringRun = false;
  };
  document.addEventListener('pointermove', e=>{
    mx = e.clientX; my = e.clientY;
    tx = e.clientX; ty = e.clientY;
    ring.classList.add('on');
    ring.classList.toggle('hot', !!(e.target.closest && e.target.closest(HOT)));
    if(!ringRun){ ringRun = true; requestAnimationFrame(ringLoop); }
    if(hero && hero.getClientRects().length){
      const r = hero.getBoundingClientRect();
      if(e.clientY > r.top - 80 && e.clientY < r.bottom + 80){
        hero.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3));
        hero.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3));
      }
    }
  }, {passive:true});
  document.addEventListener('pointerdown', ()=> ring.classList.add('press'), {passive:true});
  document.addEventListener('pointerup', ()=> ring.classList.remove('press'), {passive:true});
  document.addEventListener('pointerleave', ()=>{ ring.classList.remove('on'); mx = my = -9999; });
  root.addEventListener('mouseleave', ()=>{ ring.classList.remove('on'); mx = my = -9999; });
  window.addEventListener('blur', ()=>{ ring.classList.remove('on'); mx = my = -9999; });
})();

/* первый показ: если заставки нет, обзор въезжает сразу */
(function(){
  const splash = document.getElementById('intro-splash');
  if((!splash || splash.classList.contains('done')) && typeof window.fxEnterView === 'function'){
    requestAnimationFrame(()=> window.fxEnterView());
  }
})();
