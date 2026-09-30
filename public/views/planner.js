/* الاختبارات + المواد + العادات */
import { html, raw, today, addDays, niceDate, t12, fmtMin, DAYS_SHORT, dobj, uid, $ } from '../util.js';
import { icon } from '../icons.js';
import { all, get, upsert, patch, remove, restore, subject } from '../store.js';
import { exams as examList, focusBySubject, lastDays, weekDates, eventsOn } from '../logic.js';
import { intro, ringSvg } from '../parts.js';
import { act, empty, modal, toast, formData, confirmBox, confetti } from '../ui.js';
import { planModal, eventModal, subjectModal } from '../forms.js';

/* ---------- الاختبارات ---------- */
act('planExam', el => { const e = examList(200).find(x => x.id === el.dataset.id); e && planModal(e); });
act('newExam', () => eventModal({ type: 'exam', repeat: 'none', date: addDays(today(), 7), start: '09:00', end: '10:00' }));
export const exams = {
  title: 'الاختبارات',
  render() {
    const list = examList(365);
    const past = all('events').filter(e => e.type === 'exam' && e.repeat !== 'weekly' && e.date < today()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    return html`${intro('الاختبارات', list.length ? 'عدّ تنازلي وخطط مراجعة لكل اختبار' : 'أضف اختباراتك لتحصل على عدّ تنازلي وخطة مراجعة ذكية', html`<button class="btn primary" data-act="newExam">${icon('plus')}اختبار جديد</button>`)}
    ${list.length ? html`<div class="grid g2">${list.map(e => {
      const s = subject(e.subjectId), plan = all('tasks').filter(t => t.examId === e.id), pd = plan.filter(t => t.done).length;
      return html`<section class="card exam-card" style="--c:${s ? s.color : 'var(--danger)'}">
        <div class="countdown"><b class="num">${e.left}</b><span>${e.left === 0 ? 'اليوم!' : e.left === 1 ? 'يوم' : 'يوماً'}</span></div>
        <div class="grow"><h3 style="font-size:var(--text-base)">${e.title}</h3><div class="small muted">${niceDate(e.on)} · ${t12(e.start)}${e.room ? ' · ' + e.room : ''}</div>
          ${plan.length ? html`<div class="row" style="margin-top:8px"><div class="bar grow" style="--p:${Math.round(pd / plan.length * 100)}%;--c:var(--ok)"><i></i></div><span class="xs muted num">${pd}/${plan.length}</span></div>` : ''}</div>
        <div class="row" style="gap:6px"><button class="btn sm ${plan.length ? '' : 'primary'}" data-act="planExam" data-id="${e.id}">${icon('sparkle')}${plan.length ? 'تعديل الخطة' : 'خطة مراجعة'}</button><button class="icon-btn sm" data-act="editEvent" data-id="${e.id}" data-on="${e.on}" aria-label="تعديل">${icon('edit')}</button></div>
      </section>`; })}</div>` : html`<section class="card">${empty('exam', 'لا اختبارات قادمة', 'عند إضافة اختبار نوزّع لك جلسات مراجعة تتكثف كلما اقترب الموعد.', html`<button class="btn primary sm" data-act="newExam">${icon('plus')}إضافة اختبار</button>`)}</section>`}
    ${past.length ? html`<h3 class="small muted" style="margin:26px 0 10px">اختبارات سابقة</h3><div class="stack">${past.map(e => html`<div class="row small"><span class="dot" style="--c:${(subject(e.subjectId) || {}).color || 'var(--muted)'}"></span><span class="grow">${e.title}</span><span class="muted">${niceDate(e.date)}</span></div>`)}</div>` : ''}`;
  }
};

/* ---------- المواد ---------- */
act('newSubject', () => subjectModal());
act('editSubject', el => subjectModal(get('subjects', el.dataset.id)));
export const subjects = {
  title: 'المواد',
  render() {
    const subs = all('subjects'), wk = weekDates(0), by = focusBySubject(wk), byAll = focusBySubject(null);
    const weekly = {}; wk.forEach(d => eventsOn(d).forEach(e => { weekly[e.subjectId] = (weekly[e.subjectId] || 0) + 1; }));
    return html`${intro('المواد', 'ألوان موحدة في كل مكان: الجدول والمهام والتركيز والإحصائيات', html`<button class="btn primary" data-act="newSubject">${icon('plus')}مادة جديدة</button>`)}
    ${subs.length ? html`<div class="grid g3">${subs.map(s => {
      const open = all('tasks').filter(t => t.subjectId === s.id && !t.done).length, f = by[s.id] || 0, g = s.goal || 0;
      return html`<section class="card subj-card" style="--c:${s.color}">
        <div class="row"><div class="grow"><h3>${s.name}</h3><div class="xs muted">${s.teacher ? 'المعلّم: ' + s.teacher : 'بدون معلّم محدد'}</div></div>
        ${g ? html`<div style="position:relative;width:52px;height:52px" title="الهدف الأسبوعي">${ringSvg(f / g, 52, 6, s.color)}<span class="xs num" style="position:absolute;inset:0;display:grid;place-items:center;font-weight:700">${Math.min(100, Math.round(f / g * 100))}%</span></div>` : ''}
        <button class="icon-btn sm" data-act="editSubject" data-id="${s.id}" aria-label="تعديل ${s.name}">${icon('edit')}</button></div>
        <div class="kv"><div><b class="num">${weekly[s.id] || 0}</b><span>حصص أسبوعياً</span></div><div><b class="num">${open}</b><span>مهام حالية</span></div><div><b class="num">${fmtMin(f)}</b><span>تركيز الأسبوع</span></div></div>
        <div class="row" style="margin-top:12px;gap:6px"><a class="btn sm grow" href="#/focus?s=${s.id}">${icon('play')}ركّز على المادة</a><span class="xs muted">الإجمالي ${fmtMin(byAll[s.id] || 0)}</span></div>
      </section>`; })}</div>` : html`<section class="card">${empty('book', 'لا مواد بعد', 'أضف موادك لتلوين الجدول والمهام.', html`<button class="btn primary sm" data-act="newSubject">${icon('plus')}إضافة مادة</button>`)}</section>`}`;
  }
};

/* ---------- العادات ---------- */
const HICONS = ['book', 'habit', 'cards', 'focus', 'sun', 'moon', 'bolt', 'star'];
act('habitDay', (el) => {
  const h = get('habits', el.dataset.id), d = el.dataset.d; if (!h) return;
  const days = Object.assign({}, h.days || {}); days[d] = !days[d]; if (!days[d]) delete days[d];
  patch('habits', h.id, { days });
  if (days[d] && d === today() && all('habits').every(x => x.id === h.id ? true : x.days && x.days[d])) { confetti(50); toast('أكملت كل عاداتك اليوم!'); }
  window.__refresh();
});
act('newHabit', () => habitModal());
act('editHabit', el => habitModal(get('habits', el.dataset.id)));
function habitModal(h = {}) {
  const isNew = !h.id; h = Object.assign({ title: '', icon: 'habit', target: 7 }, h);
  const m = modal(html`<form class="form">
    <label class="field"><span>العادة</span><input name="title" required maxlength="50" value="${h.title}" placeholder="مثال: قراءة 20 دقيقة" autofocus></label>
    <div class="field"><span>الأيقونة</span><div class="chips-pick">${HICONS.map(i => html`<label><input type="radio" name="icon" value="${i}" ${i === h.icon ? raw('checked') : ''}><span aria-label="${i}">${icon(i)}</span></label>`)}</div></div>
    <label class="field"><span>الهدف (أيام في الأسبوع)</span><input type="number" name="target" min="1" max="7" value="${h.target || 7}"></label>
    <div class="form-actions">${!isNew ? html`<button type="button" class="btn ghost spacer" id="delH">${icon('trash')}حذف</button>` : ''}<button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${isNew ? 'إضافة' : 'حفظ'}</button></div>
  </form>`, { title: isNew ? 'عادة جديدة' : 'تعديل العادة' });
  const del = m.body.querySelector('#delH');
  if (del) del.onclick = () => { m.close(); const old = remove('habits', h.id); window.__refresh(); toast('حُذفت العادة', { action: 'تراجع', onAction: () => { restore('habits', old); window.__refresh(); } }); };
  m.body.querySelector('form').onsubmit = e => { e.preventDefault(); const d = formData(e.target); upsert('habits', Object.assign({}, isNew ? { days: {} } : get('habits', h.id), { id: h.id, title: d.title.trim(), icon: d.icon || 'habit', target: Number(d.target) || 7 })); m.close(); window.__refresh(); };
}
function hStreak(h) { let n = 0, d = today(); if (!(h.days || {})[d]) d = addDays(d, -1); while ((h.days || {})[d]) { n++; d = addDays(d, -1); } return n; }
export const habits = {
  title: 'العادات',
  render() {
    const hs = all('habits'), days = weekDates(0), t = today();
    return html`${intro('العادات', 'عادات صغيرة يومية تصنع فرقاً كبيراً', html`<button class="btn primary" data-act="newHabit">${icon('plus')}عادة جديدة</button>`)}
    <section class="card">${hs.length ? hs.map(h => {
      const wk = days.filter(d => (h.days || {})[d]).length, st = hStreak(h);
      return html`<div class="habit"><span class="hicon">${icon(h.icon || 'habit')}</span>
        <div class="grow" data-act="editHabit" data-id="${h.id}" style="cursor:pointer"><b>${h.title}</b><div class="xs muted">${wk}/${h.target || 7} هذا الأسبوع${st ? ' · سلسلة ' + st : ''}</div></div>
        <div class="hdays">${days.map(d => html`<button class="hday ${(h.days || {})[d] ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="habitDay" data-id="${h.id}" data-d="${d}" ${d > t ? raw('disabled') : ''} aria-label="${DAYS_SHORT[dobj(d).getDay()]}" aria-pressed="${!!(h.days || {})[d]}">${DAYS_SHORT[dobj(d).getDay()].slice(0, 3)}</button>`)}</div>
      </div>`; }) : empty('habit', 'لا عادات بعد', 'ابدأ بعادة واحدة سهلة جداً، مثل قراءة صفحة يومياً.', html`<button class="btn primary sm" data-act="newHabit">${icon('plus')}إضافة عادة</button>`)}</section>`;
  }
};
