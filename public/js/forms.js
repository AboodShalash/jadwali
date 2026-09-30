/* نوافذ الإدخال المشتركة: مهمة، حصة، مادة، خطة مراجعة */
import { html, raw, today, addDays, niceDate, uid, DAYS, t12, toMin, fromMin, dayDiff, shortDate } from './util.js';
import { icon } from './icons.js';
import { all, get, upsert, remove, restore, patch, SUBJECT_COLORS, subject } from './store.js';
import { modal, toast, formData, confirmBox, confetti, act } from './ui.js';
import { conflicts, planDates, parseTask, REPEATS, nextDue } from './logic.js';

export const PRI = { high: 'عالية', normal: 'عادية', low: 'منخفضة' };
export const TYPES = { class: 'حصة', exam: 'اختبار', review: 'مراجعة', activity: 'نشاط' };
let refresh = () => {};
export const setRefresh = fn => { refresh = fn; };

export const subjectOptions = (sel = '', none = 'بدون مادة') => html`<option value="">${none}</option>${all('subjects').map(s => html`<option value="${s.id}" ${s.id === sel ? raw('selected') : ''}>${s.name}</option>`)}`;

/* ---------- المهمة ---------- */
export function taskModal(t = {}) {
  const isNew = !t.id;
  t = Object.assign({ title: '', due: today(), priority: 'normal', subjectId: '', notes: '', est: 1, steps: [], repeat: 'none' }, t);
  let steps = (t.steps || []).map(s => Object.assign({}, s));
  const m = modal(html`<form class="form" id="taskForm">
    <label class="field"><span>المهمة</span><input name="title" required maxlength="140" value="${t.title}" placeholder="مثال: حل تمارين الوحدة الثانية" autofocus></label>
    <div class="form-row">
      <label class="field"><span>الموعد</span><input type="date" name="due" value="${t.due || ''}"></label>
      <label class="field"><span>المادة</span><select name="subjectId">${subjectOptions(t.subjectId)}</select></label>
    </div>
    <div class="form-row">
      <label class="field"><span>الأولوية</span><select name="priority">${Object.entries(PRI).map(([k, v]) => html`<option value="${k}" ${k === t.priority ? raw('selected') : ''}>${v}</option>`)}</select></label>
      <label class="field"><span>الجلسات المتوقعة</span><input type="number" name="est" min="0" max="20" value="${t.est || 0}"></label>
    </div>
    <label class="field"><span>التكرار</span><select name="repeat">${Object.entries(REPEATS).map(([k, v]) => html`<option value="${k}" ${k === (t.repeat || 'none') ? raw('selected') : ''}>${v}</option>`)}</select></label>
    <div class="field"><span>خطوات صغيرة</span><div id="stepList" class="stack"></div>
      <div class="row"><input class="input grow" id="stepIn" placeholder="أضف خطوة ثم Enter" maxlength="100"><button type="button" class="btn sm" id="stepAdd">${icon('plus')}إضافة</button></div></div>
    <label class="field"><span>ملاحظات</span><textarea name="notes" maxlength="1000" placeholder="اختياري">${t.notes || ''}</textarea></label>
    <div class="form-actions">${!isNew ? html`<button type="button" class="btn ghost spacer" id="delTask">${icon('trash')}حذف</button>` : ''}<button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${isNew ? 'إضافة المهمة' : 'حفظ'}</button></div>
  </form>`, { title: isNew ? 'مهمة جديدة' : 'تعديل المهمة' });
  const list = m.body.querySelector('#stepList'), inp = m.body.querySelector('#stepIn');
  const draw = () => {
    list.innerHTML = steps.map((s, i) => html`<div class="row"><button type="button" class="chk ${s.done ? 'on' : ''}" data-i="${i}" data-k="t" aria-label="إنجاز الخطوة">${icon('check')}</button><span class="grow ${s.done ? 'muted' : ''}">${s.t}</span><button type="button" class="icon-btn sm" data-i="${i}" data-k="d" aria-label="حذف الخطوة">${icon('x')}</button></div>`.s).join('');
  };
  draw();
  list.onclick = e => { const b = e.target.closest('button'); if (!b) return; const i = +b.dataset.i; if (b.dataset.k === 't') steps[i].done = !steps[i].done; else steps.splice(i, 1); draw(); };
  const addStep = () => { const v = inp.value.trim(); if (v) { steps.push({ id: uid(), t: v, done: false }); inp.value = ''; draw(); } inp.focus(); };
  m.body.querySelector('#stepAdd').onclick = addStep;
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } };
  const del = m.body.querySelector('#delTask');
  if (del) del.onclick = () => { m.close(); deleteTask(t.id); };
  m.body.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    upsert('tasks', Object.assign({}, isNew ? { done: false } : get('tasks', t.id), { id: t.id, title: d.title.trim(), due: d.due, subjectId: d.subjectId, priority: d.priority, est: Number(d.est) || 0, notes: d.notes.trim(), steps, repeat: d.repeat || 'none' }));
    m.close(); toast(isNew ? 'أُضيفت المهمة' : 'حُفظت التعديلات'); refresh();
  };
}
export function deleteTask(id) {
  const old = remove('tasks', id); refresh();
  toast('حُذفت المهمة', { action: 'تراجع', onAction: () => { restore('tasks', old); refresh(); } });
}
export function toggleTask(id, el) {
  const t = get('tasks', id); if (!t) return;
  const done = !t.done;
  patch('tasks', id, { done, doneAt: done ? today() : '' });
  let spawned = null;
  if (done && t.repeat && t.repeat !== 'none' && !t.spawned) {
    const nd = nextDue(t);
    spawned = upsert('tasks', { title: t.title, due: nd, priority: t.priority, subjectId: t.subjectId, est: t.est, notes: t.notes || '', repeat: t.repeat, steps: (t.steps || []).map(x => Object.assign({}, x, { done: false })), done: false, series: t.series || t.id });
    patch('tasks', id, { spawned: spawned.id });
  }
  if (!done && t.spawned) { const n = get('tasks', t.spawned); if (n && !n.done) remove('tasks', n.id); patch('tasks', id, { spawned: '' }); }
  if (spawned) toast(`أحسنت! التكرار التالي: ${niceDate(spawned.due)}`, { action: 'تراجع', onAction: () => { remove('tasks', spawned.id); patch('tasks', id, { done: false, doneAt: '', spawned: '' }); refresh(); } });
  else if (done) {
    const left = all('tasks').filter(x => !x.done && x.due && x.due <= today()).length;
    if (left === 0 && all('tasks').some(x => x.done && x.doneAt === today())) { confetti(); toast('أنجزت كل مهام اليوم. عمل رائع!'); }
    else toast('أحسنت! +' + (t.priority === 'high' ? 30 : 20) + ' نقطة', { action: 'تراجع', onAction: () => { patch('tasks', id, { done: false, doneAt: '' }); refresh(); } });
  }
  if (el) { el.classList.add('pop'); setTimeout(refresh, 180); } else refresh();
}
export function quickAddTask(text) {
  const p = parseTask(text);
  if (!p.title) return null;
  const t = upsert('tasks', { title: p.title, due: p.due || today(), priority: p.priority, subjectId: p.subjectId, est: p.est || 1, steps: [], done: false, notes: '', repeat: p.repeat || 'none' });
  toast(`أُضيفت: ${t.title} — ${niceDate(t.due)}${t.repeat !== 'none' ? ' · ' + REPEATS[t.repeat] : ''}`);
  refresh(); return t;
}

/* ---------- الحصة / الحدث ---------- */
export function eventModal(ev = {}) {
  const isNew = !ev.id;
  ev = Object.assign({ title: '', subjectId: '', date: today(), start: '08:00', end: '08:45', type: 'class', repeat: 'weekly', room: '', notes: '' }, ev);
  if (isNew && ev.type === 'exam') ev.repeat = 'none';
  const m = modal(html`<form class="form">
    <div class="seg" role="radiogroup" aria-label="النوع">${Object.entries(TYPES).map(([k, v]) => html`<button type="button" class="${k === ev.type ? 'on' : ''}" data-type="${k}">${v}</button>`)}</div>
    <input type="hidden" name="type" value="${ev.type}">
    <div class="form-row">
      <label class="field"><span>المادة</span><select name="subjectId">${subjectOptions(ev.subjectId)}</select></label>
      <label class="field"><span>العنوان</span><input name="title" maxlength="80" value="${ev.title}" placeholder="يُملأ من اسم المادة"></label>
    </div>
    <div class="form-row">
      <label class="field"><span>التاريخ</span><input type="date" name="date" required value="${ev.on || ev.date}"></label>
      <label class="field"><span>من</span><input type="time" name="start" required value="${ev.start}"></label>
      <label class="field"><span>إلى</span><input type="time" name="end" required value="${ev.end}"></label>
    </div>
    <div class="form-row">
      <label class="field"><span>التكرار</span><select name="repeat"><option value="weekly" ${ev.repeat === 'weekly' ? raw('selected') : ''}>كل أسبوع</option><option value="none" ${ev.repeat !== 'weekly' ? raw('selected') : ''}>مرة واحدة</option></select></label>
      <label class="field"><span>القاعة / المكان</span><input name="room" maxlength="40" value="${ev.room || ''}" placeholder="اختياري"></label>
    </div>
    <p class="small conflict" id="confl" hidden></p>
    <div class="form-actions">${!isNew ? html`<button type="button" class="btn ghost spacer" id="delEv">${icon('trash')}حذف</button>` : ''}<button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${isNew ? 'إضافة' : 'حفظ'}</button></div>
  </form>`, { title: isNew ? 'إضافة إلى الجدول' : 'تعديل' });
  const f = m.body.querySelector('form'), cf = m.body.querySelector('#confl');
  const check = () => {
    const d = formData(f);
    if (d.end <= d.start) { cf.hidden = false; cf.textContent = 'وقت النهاية يجب أن يكون بعد البداية'; return false; }
    const c = conflicts({ id: ev.id, date: d.date, start: d.start, end: d.end });
    cf.hidden = !c.length; cf.textContent = c.length ? 'تنبيه: يتعارض مع ' + c.map(x => x.title + ' (' + t12(x.start) + ')').join('، ') : '';
    return true;
  };
  f.addEventListener('input', check); check();
  m.body.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
    m.body.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x === b));
    f.type.value = b.dataset.type; if (b.dataset.type === 'exam') f.repeat.value = 'none';
  });
  f.start.addEventListener('change', () => { if (f.end.value <= f.start.value) f.end.value = fromMin(toMin(f.start.value) + 45); check(); });
  const del = m.body.querySelector('#delEv');
  if (del) del.onclick = async () => {
    const orig = get('events', ev.id);
    if (orig.repeat === 'weekly' && ev.on) {
      m.close();
      const only = await confirmBox('هل تريد حذف هذا الموعد فقط (' + niceDate(ev.on) + ') أم السلسلة الأسبوعية كلها؟', { ok: 'هذا الموعد فقط' });
      if (only) { patch('events', ev.id, { skip: (orig.skip || []).concat(ev.on) }); toast('أُلغي هذا الموعد فقط'); refresh(); return; }
      if (!(await confirmBox('حذف السلسلة كلها؟', { ok: 'حذف الكل', danger: true }))) return;
    } else m.close();
    const old = remove('events', ev.id); refresh();
    toast('حُذف من الجدول', { action: 'تراجع', onAction: () => { restore('events', old); refresh(); } });
  };
  f.onsubmit = e => {
    e.preventDefault(); if (!check()) return;
    const d = formData(f);
    const title = d.title.trim() || (subject(d.subjectId) || {}).name || TYPES[d.type];
    const base = isNew ? {} : get('events', ev.id);
    upsert('events', Object.assign({}, base, { id: ev.id, title, subjectId: d.subjectId, date: base && base.repeat === 'weekly' && d.repeat === 'weekly' && ev.on && d.date === ev.on ? base.date : d.date, start: d.start, end: d.end, type: d.type, repeat: d.repeat, room: d.room.trim() }));
    m.close(); toast(isNew ? 'أُضيف إلى الجدول' : 'حُفظ'); refresh();
    if (isNew && d.type === 'exam') setTimeout(() => { const x = all('events').find(z => z.title === title && z.date === d.date && z.type === 'exam'); x && planModal(x); }, 300);
  };
}

/* ---------- المادة ---------- */
export function subjectModal(s = {}) {
  const isNew = !s.id;
  s = Object.assign({ name: '', color: SUBJECT_COLORS[all('subjects').length % SUBJECT_COLORS.length], teacher: '', goal: 60 }, s);
  const m = modal(html`<form class="form">
    <label class="field"><span>اسم المادة</span><input name="name" required maxlength="40" value="${s.name}" placeholder="مثال: الفيزياء" autofocus></label>
    <div class="field"><span>اللون</span><div class="colors">${SUBJECT_COLORS.map(c => html`<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === s.color ? raw('checked') : ''} aria-label="لون"></label>`)}</div></div>
    <div class="form-row">
      <label class="field"><span>المعلّم</span><input name="teacher" maxlength="40" value="${s.teacher || ''}" placeholder="اختياري"></label>
      <label class="field"><span>هدف أسبوعي (دقيقة)</span><input type="number" name="goal" min="0" max="3000" step="15" value="${s.goal || 0}"></label>
    </div>
    <div class="form-actions">${!isNew ? html`<button type="button" class="btn ghost spacer" id="delS">${icon('trash')}حذف</button>` : ''}<button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${isNew ? 'إضافة المادة' : 'حفظ'}</button></div>
  </form>`, { title: isNew ? 'مادة جديدة' : 'تعديل المادة' });
  const del = m.body.querySelector('#delS');
  if (del) del.onclick = async () => {
    m.close();
    if (!(await confirmBox('حذف مادة «' + s.name + '»؟ ستبقى مهامها وحصصها بدون مادة.', { ok: 'حذف', danger: true }))) return;
    const old = remove('subjects', s.id); refresh();
    toast('حُذفت المادة', { action: 'تراجع', onAction: () => { restore('subjects', old); refresh(); } });
  };
  m.body.querySelector('form').onsubmit = e => {
    e.preventDefault(); const d = formData(e.target);
    upsert('subjects', Object.assign({}, isNew ? {} : get('subjects', s.id), { id: s.id, name: d.name.trim(), color: d.color || s.color, teacher: d.teacher.trim(), goal: Number(d.goal) || 0 }));
    m.close(); toast(isNew ? 'أُضيفت المادة' : 'حُفظت'); refresh();
  };
}

/* ---------- خطة المراجعة ---------- */
export function planModal(ex) {
  const day = ex.on || ex.date, left = dayDiff(today(), day);
  if (left < 1) { toast('الاختبار اليوم — بالتوفيق!'); return; }
  const existing = all('tasks').filter(t => t.examId === ex.id);
  const def = Math.min(left, left > 10 ? 6 : Math.max(2, Math.ceil(left * 0.6)));
  const m = modal(html`<form class="form">
    <p class="muted small">${ex.title} — ${niceDate(day)} (بعد ${left} ${left > 10 || left < 3 ? 'يوماً' : 'أيام'}). سنوزّع جلسات المراجعة بحيث تتكثف كلما اقترب الموعد، وآخرها مراجعة شاملة.</p>
    <div class="form-row">
      <label class="field"><span>عدد الجلسات</span><input type="number" name="n" min="1" max="${Math.min(left, 14)}" value="${def}"></label>
      <label class="field"><span>مدة الجلسة</span><select name="min"><option value="25">25 دقيقة</option><option value="40" selected>40 دقيقة</option><option value="50">50 دقيقة</option></select></label>
    </div>
    <label class="field"><span>المحاور (سطر لكل محور)</span><textarea name="topics" placeholder="الوحدة الأولى&#10;الوحدة الثانية&#10;حل أسئلة سنوات سابقة"></textarea></label>
    <div><b class="small">المعاينة</b><div class="plan-days" id="prev"></div></div>
    ${existing.length ? html`<p class="small muted">ملاحظة: توجد خطة سابقة (${existing.length} جلسات) وسيتم استبدال الجلسات غير المنجزة.</p>` : ''}
    <div class="form-actions"><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${icon('sparkle')}إنشاء الخطة</button></div>
  </form>`, { title: 'خطة مراجعة ذكية' });
  const f = m.body.querySelector('form'), prev = m.body.querySelector('#prev');
  const items = () => {
    const d = formData(f), n = Math.max(1, Math.min(Number(d.n) || 1, left)), topics = d.topics.split('\n').map(s => s.trim()).filter(Boolean);
    const dates = planDates(day, n);
    return dates.map((dt, i) => ({ due: dt, title: i === n - 1 && n > 1 ? `مراجعة شاملة: ${ex.title}` : `مراجعة ${ex.title}: ${topics.length ? topics[i % topics.length] : 'الجزء ' + (i + 1)}`, minutes: Number(d.min) }));
  };
  const draw = () => { prev.innerHTML = items().map(x => html`<span class="chip ac">${shortDate(x.due)}</span>`.s).join(''); };
  f.addEventListener('input', draw); draw();
  f.onsubmit = e => {
    e.preventDefault();
    existing.filter(t => !t.done).forEach(t => remove('tasks', t.id));
    items().forEach(x => upsert('tasks', { title: x.title, due: x.due, subjectId: ex.subjectId, priority: 'normal', est: Math.max(1, Math.round(x.minutes / 25)), minutes: x.minutes, examId: ex.id, steps: [], done: false }));
    m.close(); confetti(60); toast('جاهزة! أُضيفت ' + items().length + ' جلسات مراجعة إلى مهامك'); refresh();
  };
}
