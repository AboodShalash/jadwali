/* جدولي 4 — نقطة الدخول: الهيكل، التوجيه، الاختصارات */
import { html, raw, $, $$, today, addDays, niceDate } from './util.js';
import { icon, LOGO } from './icons.js';
import { on, profile, setProfile, sync, startSync, get, all, seedDemo, upsert } from './store.js';
import { act, toast, modal, formData, anyModal, confetti } from './ui.js';
import { level, streak, cardDue } from './logic.js';
import { taskModal, eventModal, toggleTask, deleteTask, quickAddTask, setRefresh } from './forms.js';
import { T, onTimer, remaining, fmt, toggle as tToggle, link, MODES } from './timer.js';
import { openPalette } from './palette.js';
import * as today_ from './views/today.js';
import * as week from './views/week.js';
import * as tasks from './views/tasks.js';
import { exams, subjects, habits } from './views/planner.js';
import * as focus from './views/focus.js';
import * as science from './views/science.js';
import * as stats from './views/stats.js';
import * as settings from './views/settings.js';
import * as grades from './views/grades.js';
import * as notes from './views/notes.js';
import * as friends from './views/friends.js';
import { gradeModal } from './views/grades.js';
import { noteModal } from './views/notes.js';
import { eventsOn } from './logic.js';
import { notify, chime } from './ui.js';
import { toMin, nowHM, t12 } from './util.js';
import { STATUS, accountModal, credits, whatsNew, VERSION } from './views/settings.js';
import { setClock } from './util.js';
import { openAssistant } from './assistant.js';
import { flushOutbox } from './store.js';
import { syncStage } from './science-data.js';
import { FIELDS, GRADE_NAME } from './curriculum.js';
on('change', () => syncStage()); on('remote', () => syncStage());

const ROUTES = { today: today_, week, tasks, exams, subjects, habits, focus, science, stats, settings, grades, notes, friends };
const NAV = [
  { g: 'جدولي', dot: 'var(--accent)', items: [['today', 'اليوم', 'today'], ['week', 'الأسبوع', 'week'], ['tasks', 'المهام', 'tasks'], ['exams', 'الاختبارات', 'exam'], ['subjects', 'المواد', 'book'], ['habits', 'العادات', 'habit']] },
  { g: 'دفتري', dot: 'var(--danger)', items: [['grades', 'العلامات', 'grade'], ['notes', 'الملاحظات', 'pad']] },
  { g: 'التركيز', dot: 'var(--focus)', items: [['focus', 'مؤقت التركيز', 'focus']] },
  { g: 'عالم العلوم', dot: 'var(--sci)', items: [['science', 'الرئيسية', 'atom'], ['science/cards', 'البطاقات', 'cards'], ['science/quiz', 'الاختبارات', 'quiz'], ['science/lab', 'المختبر', 'lab']] },
  { g: 'أنت', dot: 'var(--ink-2)', items: [['stats', 'الإحصائيات', 'stats'], ['friends', 'الأصدقاء', 'habit'], ['settings', 'الإعدادات', 'settings']] }
];

/* ---------- المظهر ---------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const p = profile(), th = p.theme === 'auto' || !p.theme ? (mq.matches ? 'dark' : 'light') : p.theme;
  document.documentElement.dataset.theme = th;
  const r = document.documentElement;
  r.dataset.accent = p.accent || 'saffron';
  r.dataset.fs = p.fontSize || 'md'; r.dataset.shape = p.shape || 'mid'; r.dataset.density = p.density || 'comfy';
  r.dataset.motion = p.motion === 'off' || (p.motion !== 'on' && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'off' : 'on';
  setClock(p.clock);
  const meta = $('meta[name=theme-color]'); meta && (meta.content = th === 'dark' ? '#11141D' : '#F3EEE4');
}
mq.addEventListener && mq.addEventListener('change', applyTheme);
window.__applyTheme = applyTheme;

/* ---------- التوجيه ---------- */
let cur = null, curKey = '';
function parseHash() {
  const h = (location.hash || '#/today').slice(2), [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean), params = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name: ROUTES[parts[0]] ? parts[0] : 'today', sub: parts.slice(1), params, key: path };
}
function render(keepScroll = false) {
  const r = parseHash(), view = ROUTES[r.name], el = $('#view');
  const y = window.scrollY;
  if (cur && cur.unmount && (cur !== view || !keepScroll)) cur.unmount();
  const out = view.render(r.params, r.sub);
  el.innerHTML = out.s + (r.name === 'settings' || r.name === 'focus' ? '' : `<footer class="app-foot">${credits().s}</footer>`);
  el.style.animation = keepScroll ? 'none' : '';
  cur = view;
  view.mount && view.mount(el, r.params, r.sub);
  const t = r.name === 'science' && r.sub[0] === 'lesson' ? 'درس علوم' : view.title;
  $('#pageTitle').textContent = t; document.title = t + ' · جدولي';
  const navKeys = NAV.flatMap(g => g.items.map(i => i[0]));
  $$('.nav a, .tabbar a').forEach(a => { const k = a.dataset.k; a.classList.toggle('on', k === r.key || (k === r.name && !navKeys.includes(r.key))); a.toggleAttribute('aria-current', a.classList.contains('on')); });
  if (keepScroll) window.scrollTo(0, y); else if (curKey !== r.key) window.scrollTo(0, 0);
  curKey = r.key;
  side();
}
const refresh = () => render(true);
window.__refresh = refresh; setRefresh(refresh);
window.addEventListener('hashchange', () => render(false));

/* ---------- الهيكل ---------- */
function shell() {
  $('#app').innerHTML = html`
  <aside class="side" aria-label="القائمة الرئيسية">
    <a class="brand" href="#/today">${LOGO}<div><b>جدولي</b><small>دراسة منظّمة، عقل مرتاح</small></div></a>
    <nav class="nav">${NAV.map(g => html`<div class="nav-group" style="--dot:${g.dot}"><div class="nav-label">${g.g}</div>${g.items.map(([k, l, ic]) => html`<a href="#/${k}" data-k="${k}">${icon(ic)}<span>${l}</span><span class="badge" data-badge="${k}" hidden></span></a>`)}</div>`)}</nav>
    <div class="side-foot"><a class="lvl-card" href="#/stats" id="lvlCard"></a></div>
  </aside>
  <div class="main">
    <header class="top" id="top">
      <a class="mob-brand" href="#/today" aria-label="جدولي">${LOGO}</a>
      <h1 id="pageTitle">اليوم</h1>
      <button class="timer-pill" id="tPill" data-act="go" data-to="#/focus" aria-label="المؤقت"><span class="t" id="tPillT">25:00</span><span class="pp" data-act="pillToggle" id="tPillB"></span></button>
      <button class="search-btn" data-act="palette" aria-label="البحث والأوامر">${icon('search')}<span class="lbl">ابحث أو أضف…</span><kbd>Ctrl K</kbd></button>
      <span class="sync-pill" id="syncPill" data-s="idle" title="حالة المزامنة" role="status"><i></i><span class="lbl">…</span></span>
      <button class="icon-btn" data-act="themeToggle" aria-label="تبديل المظهر" id="themeBtn"></button>
      <a class="icon-btn gear" href="#/settings" aria-label="الإعدادات" title="الإعدادات (G ثم ,)">${icon('settings')}</a>
      <button class="avatar" data-act="avatar" id="avatar" aria-label="الحساب">؟</button>
    </header>
    <main class="view" id="view" tabindex="-1"></main>
    <button class="bot-fab" data-act="openBot" aria-label="مساعد جدولي الذكي" title="مساعد جدولي الذكي">${icon('bot')}</button>
  </div>
  <nav class="tabbar" aria-label="التنقل">
    ${[['today', 'اليوم', 'today'], ['week', 'الجدول', 'week'], ['tasks', 'المهام', 'tasks'], ['focus', 'التركيز', 'focus'], ['science', 'العلوم', 'atom']].map(([k, l, ic]) => html`<a href="#/${k}" data-k="${k}">${icon(ic)}<span>${l}</span></a>`)}<button type="button" data-act="moreNav" aria-label="كل الأقسام">${icon('menu')}<span>المزيد</span></button>
  </nav>`;
  window.addEventListener('scroll', () => $('#top').classList.toggle('scrolled', window.scrollY > 4), { passive: true });
}
function side() {
  const lv = level(), st = streak();
  $('#lvlCard').innerHTML = html`<div class="row"><b>المستوى ${lv.lv} · ${lv.name}</b><span class="xs muted num">${lv.total}</span></div><div class="bar" style="--p:${lv.pct}%"><i></i></div><div class="row xs muted"><span>${icon('flame')} سلسلة ${st} ${st === 1 ? 'يوم' : 'أيام'}</span><span>${lv.need - lv.into} للمستوى التالي</span></div>`.s;
  const t = today(), n = all('tasks').filter(x => !x.done && x.due && x.due <= t).length;
  const cards = all('cards').filter(c => cardDue(c)).length;
  const b1 = $('[data-badge="tasks"]'); if (b1) { b1.hidden = !n; b1.textContent = n; }
  const b2 = $('[data-badge="science/cards"]'); if (b2) { b2.hidden = !cards; b2.textContent = cards; }
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#themeBtn').innerHTML = icon(dark ? 'sun' : 'moon').s;
  const u = sync.user, nm = profile().name || (u && u.name) || '';
  $('#avatar').textContent = nm ? nm.trim()[0] : '؟';
  syncPill(); pill();
}
function syncPill() {
  const p = $('#syncPill'); if (!p) return;
  p.dataset.s = sync.status;
  const short = { synced: 'متزامن', syncing: 'مزامنة…', offline: 'غير متصل', local: 'محلي', error: 'خطأ', idle: '…' };
  p.querySelector('.lbl').textContent = short[sync.status] || '';
  p.title = STATUS[sync.status] || '';
}
function pill() {
  const p = $('#tPill'); if (!p) return;
  const r = parseHash(), show = (T.running || (T.startedAt && T.left)) && r.name !== 'focus';
  p.classList.toggle('show', !!show); p.classList.toggle('brk', T.mode !== 'focus');
  if (show) { $('#tPillT').textContent = fmt(remaining()); $('#tPillB').innerHTML = icon(T.running ? 'pause' : 'play').s; p.setAttribute('aria-label', MODES[T.mode] + ' ' + fmt(remaining())); }
}
onTimer(ev => { pill(); if (ev === 'recorded' && cur !== focus) refresh(); if (ev === 'complete-focus') toast('انتهت جلسة التركيز — أحسنت!'); });
document.addEventListener('visibilitychange', () => { if (T.running && document.visibilityState === 'hidden') { /* عنوان الصفحة يعرض الوقت */ } });
setInterval(() => { if (T.running) document.title = fmt(remaining()) + ' · ' + MODES[T.mode]; }, 1000);
onTimer(ev => { if (ev === 'pause' || ev === 'reset' || ev.startsWith('complete')) { const r = parseHash(); document.title = ROUTES[r.name].title + ' · جدولي'; } });

/* ---------- الإجراءات العامة ---------- */
act('go', el => { location.hash = el.dataset.to; });
act('palette', () => openPalette(RUN));
act('newTask', () => taskModal());
act('editTask', el => { const t = get('tasks', el.dataset.id); t && taskModal(t); });
act('toggleTask', el => toggleTask(el.dataset.id, el));
act('delTask', el => deleteTask(el.dataset.id));
act('focusTask', el => { const t = get('tasks', el.dataset.id); if (!t) return; link({ taskId: t.id, minutes: t.minutes || 0 }); location.hash = '#/focus'; });
act('newEvent', () => eventModal());
act('planGo', el => { if (el.dataset.href) { location.hash = el.dataset.href; return; } link({ taskId: el.dataset.task, subjectId: el.dataset.sub, minutes: 0 }); location.hash = '#/focus'; setTimeout(() => { if (!T.running) { tToggle(); refresh(); } }, 60); });
act('newTaskOn', el => taskModal({ due: el.dataset.d }));
act('editEvent', el => { const e = get('events', el.dataset.id); e && eventModal(Object.assign({}, e, { on: el.dataset.on })); });
act('openBot', () => openAssistant());
act('moreNav', () => {
  const m = modal(html`<div class="more-nav">${NAV.map(g => html`<div class="mn-g"><div class="nav-label" style="--dot:${g.dot}">${g.g}</div><div class="mn-grid">${g.items.map(([k, l, ic]) => html`<a href="#/${k}" style="--c:${g.dot}">${icon(ic)}<span>${l}</span></a>`)}</div></div>`)}</div>`, { title: 'كل الأقسام', cls: 'sheet' });
  m.body.querySelectorAll('a').forEach(a => a.addEventListener('click', () => m.close()));
});
act('printSched', (el, e) => { e && e.preventDefault(); location.hash = '#/week'; setTimeout(() => window.print(), 400); });
act('testNotif', () => { toast('هكذا سيبدو التذكير قبل الحصة'); notify('تنبيه تجريبي من جدولي', 'الحصة التالية بعد 10 دقائق'); if (profile().chime !== false) chime('soft'); });
act('themeToggle', () => { const dark = document.documentElement.dataset.theme === 'dark'; setProfile({ theme: dark ? 'light' : 'dark' }); applyTheme(); refresh(); });
act('avatar', () => { const u = sync.user; if (u && !u.guest) location.hash = '#/settings'; else accountModal(); });
act('pillToggle', (el, e) => { e.stopPropagation(); tToggle(); pill(); });
const RUN = {
  addTask: q => quickAddTask(q), newTask: () => taskModal(), newEvent: () => eventModal(), editTask: id => taskModal(get('tasks', id)),
  newExam: () => eventModal({ type: 'exam', repeat: 'none', date: addDays(today(), 7), start: '09:00', end: '10:00' }),
  startFocus: () => { location.hash = '#/focus'; setTimeout(() => { if (!T.running) { tToggle(); refresh(); } }, 50); },
  toggleTheme: () => RUN_theme(), newGrade: () => gradeModal(), newNote: () => noteModal(), assistant: () => openAssistant()
};
const RUN_theme = () => { const dark = document.documentElement.dataset.theme === 'dark'; setProfile({ theme: dark ? 'light' : 'dark' }); applyTheme(); refresh(); };
window.__quickAdd = q => { quickAddTask(q); };
window.__askBot = q => openAssistant(q || '');

/* ---------- الاختصارات ---------- */
let gPending = 0;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'ن')) { e.preventDefault(); openPalette(RUN); return; }
  if (anyModal() || document.querySelector('.zen')) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
  if (cur && cur.keys && cur.keys(e)) return;
  const k = e.key.toLowerCase();
  if (gPending && Date.now() - gPending < 1200) {
    const map = { t: 'today', w: 'week', f: 'focus', s: 'science', k: 'tasks', x: 'exams', a: 'stats', m: 'grades', n: 'notes', b: 'bot', ',': 'settings', 'و': 'settings' };
    gPending = 0; if (map[k] === 'bot') { openAssistant(); return; } if (map[k]) { location.hash = '#/' + map[k]; return; }
  }
  if (k === 'g' || k === 'ل') { gPending = Date.now(); return; }
  if (k === 'n' || k === 'ى') { e.preventDefault(); taskModal(); }
  else if (k === 'e' || k === 'ث') { e.preventDefault(); eventModal(); }
  else if (k === '/') { e.preventDefault(); openPalette(RUN); }
});

/* ---------- التذكيرات: قبل الحصص والاختبارات ---------- */
const reminded = new Set();
function remind() {
  const p = profile(), n = Number(p.remind) || 0;
  const now = toMin(nowHM()), d = today();
  if (n) eventsOn(d).forEach(e => {
    const left = toMin(e.start) - now, key = d + e.id + e.start;
    if (left > 0 && left <= n && !reminded.has(key)) {
      reminded.add(key);
      const msg = `${e.type === 'exam' ? 'اختبار' : e.title} بعد ${left} ${left === 1 ? 'دقيقة' : left === 2 ? 'دقيقتين' : left <= 10 ? 'دقائق' : 'دقيقة'} — ${t12(e.start)}${e.room ? ' · ' + e.room : ''}`;
      toast(e.type === 'exam' ? e.title + ': ' + msg : msg);
      notify(e.type === 'exam' ? 'اختبار قريب: ' + e.title : 'الحصة التالية: ' + e.title, msg);
      if (p.chime !== false) chime('soft');
    }
  });
  // الملخّص اليومي
  if (p.digest && nowHM() >= p.digest && nowHM() < addMin(p.digest, 30) && localStorage.jadwali4_digest !== d) {
    localStorage.jadwali4_digest = d;
    const late = all('tasks').filter(t => !t.done && t.due && t.due < d).length, due = all('tasks').filter(t => !t.done && t.due === d).length, ev = eventsOn(d).length;
    const msg = `اليوم: ${ev} ${ev === 1 ? 'موعد' : 'مواعيد'} · ${due} ${due === 1 ? 'مهمة مستحقة' : 'مهام مستحقة'}${late ? ' · ' + late + ' متأخرة' : ''}`;
    toast('ملخّص يومك — ' + msg); notify('ملخّص جدولي اليومي', msg);
  }
}
const addMin = (hm, m) => { const x = toMin(hm) + m; return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
function remindLoop() { remind(); }
setInterval(remindLoop, 30000); setTimeout(remind, 4000);

/* ---------- الترحيب ---------- */
const PRESET = ['الرياضيات', 'اللغة العربية', 'اللغة الإنجليزية', 'العلوم', 'الفيزياء', 'الكيمياء', 'الأحياء', 'التاريخ', 'الجغرافيا', 'التربية الإسلامية', 'الحاسوب', 'الفنون'];
function welcome() {
  if (profile().onboarded || /nowelcome/.test(location.search)) return;
  const have = all('subjects').map(s => s.name);
  const m = modal(html`<div class="wel-hero">${LOGO}<h2>أهلاً بك في جدولي</h2><p>جدولك وتركيزك وعلومك في مكان واحد.</p></div>
  <div class="feat"><div style="--c:var(--accent)">${icon('week')}جدول ومهام</div><div style="--c:var(--focus)">${icon('focus')}مؤقت تركيز</div><div style="--c:var(--sci)">${icon('atom')}عالم العلوم</div></div>
  <form class="form">
    <label class="field"><span>ما اسمك؟</span><input name="name" maxlength="40" placeholder="اسمك الأول" autofocus></label>
    <label class="field"><span>مرحلتك الدراسية (اختياري)</span><select name="stg"><option value="">لاحقاً</option><optgroup label="الصفوف الأساسية">${[1,2,3,4,5,6,7,8,9,10].map(g => html`<option value="basic:${g}">الصف ${GRADE_NAME(g)}</option>`)}</optgroup><option value="academic">أكاديمي — الأول الثانوي</option><optgroup label="الحقول — التوجيهي">${FIELDS.map(f => html`<option value="fields:${f.id}">${f.name}</option>`)}</optgroup></select></label>
    <div class="field"><span>موادك (اختر ما يناسبك)</span><div class="chips-pick">${PRESET.map(n => html`<label><input type="checkbox" name="s_${n}" ${have.includes(n) ? raw('checked') : ''}><span>${n}</span></label>`)}</div></div>
    <label class="switch"><span>أضف جدولاً ومهام تجريبية لأستكشف التطبيق</span><input type="checkbox" name="demo"></label>
    <div class="form-actions"><button class="btn primary lg" style="width:100%">لنبدأ ${icon('arrowL')}</button></div>
  </form>`, { title: '', cls: 'welcome', onClose: () => { if (!profile().onboarded) setProfile({ onboarded: true }); } });
  m.body.querySelector('form').onsubmit = e => {
    e.preventDefault(); const d = formData(e.target);
    const chosen = PRESET.filter(n => d['s_' + n]);
    all('subjects').forEach(s => { if (!chosen.includes(s.name) && PRESET.includes(s.name)) upsert('subjects', Object.assign({}, s, { del: true })); });
    const COLORS = ['#3E7CC9', '#1F8A7E', '#B0527F', '#6C5BD4', '#D9822B', '#C8553D', '#2E8656', '#A0712F', '#2E9CB5', '#6E8B2E', '#8A5CC2', '#B7861C'];
    chosen.forEach(n => { if (!have.includes(n)) upsert('subjects', { name: n, color: COLORS[PRESET.indexOf(n)] }); });
    const [st, sv] = String(d.stg || '').split(':');
    setProfile(Object.assign({ name: d.name.trim(), onboarded: true, seenVer: VERSION }, st === 'basic' ? { stage: 'basic', sgrade: Number(sv) } : st === 'academic' ? { stage: 'academic' } : st === 'fields' ? { stage: 'fields', field: sv } : {}));
    if (d.demo) seedDemo();
    m.close(); confetti(80); toast('جاهز! جرّب Ctrl+K لإضافة مهمة بجملة'); refresh();
  };
}

/* ---------- التشغيل ---------- */
applyTheme();
if (!location.hash && profile().onboarded && profile().startPage && profile().startPage !== 'today') history.replaceState(null, '', '#/' + profile().startPage);
shell(); render();
on('remote', () => { applyTheme(); if (!anyModal()) refresh(); else side(); });
on('sync', syncPill);
on('user', () => side());
on('change', k => { if (k === 'local') side(); });
startSync();
setTimeout(() => flushOutbox().catch(() => {}), 5000);
setTimeout(welcome, 350);
setTimeout(() => { const p = profile(); if (p.onboarded && p.seenVer !== VERSION && !anyModal()) { if (p.seenVer || all('tasks').length) whatsNew(); else setProfile({ seenVer: VERSION }); } }, 1200);
// إعادة الرسم عند تغيّر اليوم (منتصف الليل)
let day = today(); setInterval(() => { if (today() !== day) { day = today(); refresh(); } }, 60000);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }
