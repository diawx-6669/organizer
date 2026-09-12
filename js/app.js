/* ============ STATE & STORAGE ============ */
const STORAGE_KEY = 'student-data';
let DATA = { lessons: [], homework: [], events: [], goals: [] };
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

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

async function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      DATA = Object.assign({lessons:[],homework:[],events:[],goals:[]}, parsed);
    }
  }catch(e){
    console.log('Нет сохранённых данных ещё, начинаем с чистого листа', e);
  }
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
      DATA = Object.assign({lessons:[],homework:[],events:[],goals:[]}, parsed);
      saveData();
      renderAll();
      if(document.querySelector('.tab-btn[data-view="calendar"]').classList.contains('active')) renderCalendar();
    }catch(e){
      alert('Не получилось прочитать файл бэкапа: ' + e.message);
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
  });
});

/* ============ DASHBOARD ============ */
function greetTime(){
  const h = new Date().getHours();
  if(h < 6) return 'Доброй ночи';
  if(h < 12) return 'Доброе утро';
  if(h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function renderDashboard(){
  document.getElementById('greeting').textContent = greetTime() + ' 👋';
  const now = new Date();
  document.getElementById('today-str').textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
  document.getElementById('today-badge').textContent = now.getDate() + ' ' + MONTHS[now.getMonth()];

  document.getElementById('s-lessons').textContent = DATA.lessons.length;
  const hwLeft = DATA.homework.filter(h=>!h.done).length;
  document.getElementById('s-homework').textContent = hwLeft;
  const evUpcoming = DATA.events.filter(e=> !e.date || new Date(e.date) >= new Date(now.toDateString())).length;
  document.getElementById('s-events').textContent = evUpcoming;
  const goalsActive = DATA.goals.filter(g=>(g.progress||0) < 100).length;
  document.getElementById('s-goals').textContent = goalsActive;

  // upcoming list: merge homework+events with dates, sorted, next 5
  let items = [];
  DATA.homework.filter(h=>!h.done && h.due).forEach(h=> items.push({date:h.due, title:h.title, sub:h.subject||'домашка', kind:'hw'}));
  DATA.events.filter(e=>e.date).forEach(e=> items.push({date:e.date, title:e.title, sub:e.type||'мероприятие', kind:'ev'}));
  items = items.filter(i => new Date(i.date) >= new Date(now.toDateString()));
  items.sort((a,b)=> new Date(a.date) - new Date(b.date));
  items = items.slice(0,5);

  const list = document.getElementById('upcoming-list');
  list.innerHTML = '';
  if(items.length === 0){
    list.innerHTML = '<div class="empty-note">Пока ничего не запланировано — самое время добавить дела.</div>';
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
    {r:60, color:'var(--tab1)', items: DATA.homework.filter(h=>!h.done).slice(0,8)},
    {r:95, color:'var(--tab4)', items: DATA.events.slice(0,10)},
    {r:128, color:'var(--tab2)', items: DATA.goals.filter(g=>(g.progress||0)<100).slice(0,12)}
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
  if(DATA.lessons.length===0){ wrap.innerHTML = '<div class="empty-note">Список уроков пуст. Добавь предметы, которые проходишь.</div>'; return; }
  DATA.lessons.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <span></span>
      <div class="item-main"><div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.teacher||'')}${item.schedule? ' · '+escapeHtml(item.schedule):''}</div></div>
      <span class="tag">${escapeHtml(item.room||'')}</span>
      <div class="row-actions">
        <button class="icon-btn" onclick="openModal('lessons','${item.id}')">✎</button>
        <button class="icon-btn del" onclick="deleteItem('lessons','${item.id}')">✕</button>
      </div>`;
    wrap.appendChild(row);
  });
}

function renderHomework(){
  const wrap = document.getElementById('list-homework');
  wrap.innerHTML = '';
  if(DATA.homework.length===0){ wrap.innerHTML = '<div class="empty-note">Домашки нет. Хорошее начало дня.</div>'; return; }
  const sorted = [...DATA.homework].sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due||0) - new Date(b.due||0);
  });
  sorted.forEach(item=>{
    const overdue = isOverdue(item.due, item.done);
    const isSor = item.kind === 'sor';
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}')"></div>
      <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-meta">${escapeHtml(item.subject||'')}</div></div>
      ${isSor ? '<span class="tag sor">СОР/СОЧ</span>' : '<span></span>'}
      <span class="tag ${overdue?'overdue':''}">${item.due? fmtDate(item.due) : '—'}</span>
      <div class="row-actions">
        <button class="icon-btn" onclick="openModal('homework','${item.id}')">✎</button>
        <button class="icon-btn del" onclick="deleteItem('homework','${item.id}')">✕</button>
      </div>`;
    wrap.appendChild(row);
  });
}

/* ============ SUBJECTS ============ */
function subjectGroups(){
  const used = new Set(DATA.homework.map(h=>h.subject).filter(Boolean));
  const list = [...SUBJECTS];
  used.forEach(s=>{ if(!list.includes(s)) list.push(s); });
  return list;
}

function renderSubjects(){
  const wrap = document.getElementById('list-subjects');
  wrap.innerHTML = '';
  const groups = subjectGroups();
  let totalOpen = 0;

  groups.forEach(subj=>{
    const items = DATA.homework.filter(h=>h.subject===subj)
      .sort((a,b)=>{ if(a.done!==b.done) return a.done?1:-1; return new Date(a.due||0)-new Date(b.due||0); });
    const openCount = items.filter(h=>!h.done).length;
    totalOpen += openCount;
    const isOpen = openSubjects.has(subj);

    const acc = document.createElement('div');
    acc.className = 'subject-acc';

    const head = document.createElement('button');
    head.className = 'subject-head';
    head.innerHTML = `<span class="subject-name">${escapeHtml(subj)}</span>
      <span class="subject-meta">${items.length ? openCount+' в работе' : 'пусто'}</span>
      <span class="subject-caret ${isOpen?'open':''}">⌄</span>`;
    head.addEventListener('click', ()=>{
      if(openSubjects.has(subj)) openSubjects.delete(subj); else openSubjects.add(subj);
      renderSubjects();
    });
    acc.appendChild(head);

    const body = document.createElement('div');
    body.className = 'subject-body';
    body.style.display = isOpen ? 'block' : 'none';

    if(items.length === 0){
      body.innerHTML = '<div class="empty-note">Пока ничего не записано по этому предмету.</div>';
    } else {
      items.forEach(item=>{
        const overdue = isOverdue(item.due, item.done);
        const isSor = item.kind === 'sor';
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}'); renderSubjects();"></div>
          <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div>
            ${item.notes? `<div class="item-meta">${escapeHtml(item.notes)}</div>` : ''}</div>
          ${isSor ? '<span class="tag sor">СОР/СОЧ</span>' : '<span></span>'}
          <span class="tag ${overdue?'overdue':''}">${item.due? fmtDate(item.due) : '—'}</span>
          <div class="row-actions">
            <button class="icon-btn" onclick="openModal('homework','${item.id}')">✎</button>
            <button class="icon-btn del" onclick="deleteItem('homework','${item.id}'); renderSubjects();">✕</button>
          </div>`;
        body.appendChild(row);
      });
    }

    const addRow = document.createElement('button');
    addRow.className = 'add-btn subject-add';
    addRow.textContent = '+ добавить в ' + subj;
    addRow.addEventListener('click', ()=> openModal('homework', null, {subject:subj}));
    body.appendChild(addRow);

    acc.appendChild(body);
    wrap.appendChild(acc);
  });

  const cnt = document.getElementById('cnt-subjects');
  if(cnt) cnt.textContent = totalOpen;
}

function renderEvents(){
  const wrap = document.getElementById('list-events');
  wrap.innerHTML = '';
  if(DATA.events.length===0){ wrap.innerHTML = '<div class="empty-note">Мероприятий и хакатонов пока нет в списке.</div>'; return; }
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
        <button class="icon-btn" onclick="openModal('events','${item.id}')">✎</button>
        <button class="icon-btn del" onclick="deleteItem('events','${item.id}')">✕</button>
      </div>`;
    wrap.appendChild(row);
  });
}

function renderGoals(){
  const wrap = document.getElementById('list-goals');
  wrap.innerHTML = '';
  if(DATA.goals.length===0){ wrap.innerHTML = '<div class="empty-note">Целей ещё нет. Запиши то, к чему идёшь.</div>'; return; }
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
          <button class="icon-btn" onclick="openModal('goals','${item.id}')">✎</button>
          <button class="icon-btn del" onclick="deleteItem('goals','${item.id}')">✕</button>
        </div>
      </div>
      <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      <div class="goal-pct">${pct}%</div>`;
    wrap.appendChild(card);
  });
}

function renderCounts(){
  document.getElementById('cnt-lessons').textContent = DATA.lessons.length;
  document.getElementById('cnt-homework').textContent = DATA.homework.filter(h=>!h.done).length;
  document.getElementById('cnt-events').textContent = DATA.events.length;
  document.getElementById('cnt-goals').textContent = DATA.goals.filter(g=>(g.progress||0)<100).length;
}

function renderAll(){
  renderDashboard();
  renderLessons();
  renderSubjects();
  renderHomework();
  renderEvents();
  renderGoals();
  renderCounts();
  renderCalendar();
}

/* ============ CRUD ============ */
function toggleDone(type, id){
  const it = DATA[type].find(x=>x.id===id);
  if(it){ it.done = !it.done; saveData(); renderAll(); }
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
    {key:'kind', label:'Тип', type:'select', options:[{value:'hw',label:'Домашка'},{value:'sor',label:'Суммативка (СОР/СОЧ)'}]},
    {key:'due', label:'Срок сдачи', type:'date'},
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
  ]
};

const TITLES = {lessons:'урок', homework:'задание', events:'событие', goals:'цель'};

function openModal(type, id, prefill){
  editingType = type;
  editingId = id || null;
  const existing = id ? DATA[type].find(x=>x.id===id) : null;
  const fields = FIELD_DEFS[type];
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>${existing? 'Изменить' : 'Добавить'} — ${TITLES[type]}</h3>` +
    fields.map(f=>{
      const val = existing ? (existing[f.key] ?? '') : (prefill && prefill[f.key] !== undefined ? prefill[f.key] : (f.key==='kind' ? 'hw' : ''));
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
  const ev = DATA.events.filter(e=>e.date && new Date(e.date).toDateString()===ds);
  return {hw, ev};
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
    const {hw, ev} = dayItemsFor(c.dateObj);
    let dots = '';
    hw.forEach(()=> dots += `<i style="background:var(--tab1)"></i>`);
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
  const {hw, ev} = dayItemsFor(dateObj);
  const listEl = document.getElementById('day-panel-list');
  listEl.innerHTML = '';
  if(hw.length===0 && ev.length===0){
    listEl.innerHTML = '<div class="empty-note">На этот день ничего не запланировано.</div>';
    return;
  }
  hw.forEach(item=>{
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<div class="check ${item.done?'done':''}" onclick="toggleDone('homework','${item.id}'); showDayPanel(selectedDay);"></div>
      <div class="item-main ${item.done?'done':''}"><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.subject||'домашка')}</div></div>
      <span class="tag">домашка</span><span></span>`;
    listEl.appendChild(row);
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

/* ============ DASHBOARD VIDEO ============ */
(function initDashboardVideo(){
  const videos = document.querySelectorAll('.dashboard-video-item');
  if(!videos.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  videos.forEach(video => {
    video.playbackRate = reduced ? 0.65 : 0.82;
    video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), {once:true});
  });
  document.addEventListener('visibilitychange', () => {
    videos.forEach(video => document.hidden ? video.pause() : video.play().catch(() => {}));
  });
})();

/* ============ INTRO SPLASH CONTROL ============ */
const SETTINGS_KEY = 'organizer-settings';
let SCENE_SETTINGS = Object.assign({enabled:true, loop:true, duration:16}, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
function saveSceneSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(SCENE_SETTINGS)); }
function openSettings(){
  const box = document.getElementById('modal-box');
  box.innerHTML = `<h3>Настройки сцены</h3>
    <div class="settings-card"><label><input id="scene-enabled" type="checkbox" ${SCENE_SETTINGS.enabled?'checked':''}> Показывать сцену при входе</label></div>
    <div class="settings-card"><label><input id="scene-loop" type="checkbox" ${SCENE_SETTINGS.loop?'checked':''}> Повторять анимацию бесконечно</label><small>При выключении сцена проигрывается один раз за вход.</small></div>
    <div class="field"><label>Длительность сцены: <b id="duration-value">${SCENE_SETTINGS.duration} сек.</b></label><input id="scene-duration" type="range" min="8" max="40" step="4" value="${SCENE_SETTINGS.duration}"></div>
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
