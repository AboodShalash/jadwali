import { html, raw, today, addDays, startOfWeek, DAYS_SHORT, DAYS, MONTHS, dobj, toMin, fromMin, t12, $$, niceDate, weekday, dayDiff } from '../util.js';
import { icon } from '../icons.js';
import { all, get, patch, upsert, profile } from '../store.js';
import { eventsOn, weekDates, conflicts } from '../logic.js';
import { evChip, taskRow, sortTasks } from '../parts.js';
import { act, toast } from '../ui.js';
import { eventModal } from '../forms.js';

export const title = 'الأسبوع';
let offset = 0, mode = 'week', mOff = 0, sel = '';
act('weekPrev', () => { mode === 'month' ? mOff-- : offset--; window.__refresh(); });
act('weekNext', () => { mode === 'month' ? mOff++ : offset++; window.__refresh(); });
act('weekNow', () => { offset = 0; mOff = 0; sel = today(); window.__refresh(); });
act('calMode', el => { mode = el.dataset.m; window.__refresh(); });
act('pickDay', el => { sel = el.dataset.d; window.__refresh(); });
act('addOn', el => eventModal({ date: el.dataset.d }));
act('printWeek', () => window.print());

export function render() {
  if (mode === 'month') return month();
  const days = weekDates(offset), t = today();
  const a = dobj(days[0]), b = dobj(days[6]);
  const label = a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  let total = 0, mins = 0;
  let cols = days.map(d => { const evs = eventsOn(d); total += evs.length; evs.forEach(e => mins += toMin(e.end) - toMin(e.start)); return { d, evs }; });
  if (profile().hideWeekend) cols = cols.filter(c => c.evs.length || ![5, 6].includes(dobj(c.d).getDay()));
  const hasAny = all('events').length > 0;
  return html`
  <div class="week-nav">
    <h2>${offset === 0 ? 'هذا الأسبوع' : offset === 1 ? 'الأسبوع القادم' : offset === -1 ? 'الأسبوع الماضي' : 'الأسبوع'} <span class="muted small" style="font-family:var(--font-body)">${label}</span></h2>
    <span class="chip">${total} موعد · ${Math.round(mins / 60)} ساعة</span>
    <div class="row" style="gap:4px">
      <button class="icon-btn" data-act="weekPrev" aria-label="الأسبوع السابق">${icon('chevR')}</button>
      ${offset !== 0 ? html`<button class="btn sm" data-act="weekNow">اليوم</button>` : ''}
      <button class="icon-btn" data-act="weekNext" aria-label="الأسبوع التالي">${icon('chevL')}</button>
    </div>
    <div class="seg no-print" role="tablist">${modeSeg()}</div>
    <button class="btn sm ghost no-print" data-act="printWeek">${icon('print')}طباعة</button>
    <button class="btn primary sm no-print" data-act="newEvent">${icon('plus')}إضافة</button>
  </div>
  ${!hasAny ? html`<div class="tips" style="margin-bottom:14px"><div>${icon('sparkle')}<span>أضف حصصك مرة واحدة مع اختيار «كل أسبوع» وستظهر تلقائياً في كل الأسابيع. ويمكنك سحب أي حصة إلى يوم آخر لنقلها.</span></div></div>` : ''}
  <div class="week" id="week" style="--wc:${cols.length}">
    ${cols.map(({ d, evs }) => { const dd = dobj(d); return html`<div class="day-col ${d === t ? 'today' : ''}" data-day="${d}">
      <div class="day-head"><b>${DAYS[dd.getDay()]}</b><span class="num">${dd.getDate()}</span></div>
      ${evs.map((e, i) => html`${evChip(e, { draggable: true })}${i > 0 && evs[i - 1].end > e.start ? html`<span class="xs conflict">${icon('bell')} تعارض مع ما قبله</span>` : ''}`)}
      <button class="day-add no-print" data-act="addOn" data-d="${d}" aria-label="إضافة في ${DAYS[dd.getDay()]}">${icon('plus')}</button>
    </div>`; })}
  </div>
  <p class="xs muted" style="margin-top:12px">اسحب الموعد إلى يوم آخر لنقله. المواعيد الأسبوعية تنتقل كسلسلة كاملة.</p>
  ${distCard(cols)}`;
}
/* توزيع الحصص حسب المادة */
function distCard(cols) {
  const by = {}; let tot = 0;
  cols.forEach(({ evs }) => evs.filter(e => e.type === 'class' && !e.planned).forEach(e => { const m = toMin(e.end) - toMin(e.start); by[e.subjectId || ''] = (by[e.subjectId || ''] || 0) + m; tot += m; }));
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]); if (!rows.length) return '';
  const R = 54, C = 2 * Math.PI * R; let acc = 0;
  const segs = rows.map(([k, m]) => { const sb = get('subjects', k), len = m / tot * C, seg = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${sb ? sb.color : 'var(--muted)'}" stroke-width="22" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"/>`; acc += len; return seg; }).join('');
  return html`<section class="card dist no-print" style="margin-top:18px"><div class="card-head"><h2>${icon('book')}توزيع الحصص حسب المادة</h2><span class="more">${Math.round(tot / 60 * 10) / 10} ساعة حصص هذا الأسبوع</span></div>
    <div class="dist-in"><svg viewBox="0 0 140 140" role="img" aria-label="توزيع الحصص">${raw(segs)}<text x="70" y="66" text-anchor="middle" class="dn">${rows.length}</text><text x="70" y="86" text-anchor="middle" class="dl">مواد</text></svg>
      <div class="dist-list">${rows.map(([k, m]) => { const sb = get('subjects', k); return html`<div class="row"><span class="dot" style="--c:${sb ? sb.color : 'var(--muted)'}"></span><span class="grow small">${sb ? sb.name : 'بدون مادة'}</span><span class="xs muted num">${Math.round(m / 45 * 10) / 10 >= 1 ? Math.round(m / 45) + ' حصص · ' : ''}${Math.round(m / tot * 100)}%</span></div>`; })}</div></div></section>`;
}
export function mount(el) {
  let dragId = null, dragOn = null;
  $$('.ev[draggable]', el).forEach(ev => {
    ev.addEventListener('dragstart', e => { dragId = ev.dataset.id; dragOn = ev.dataset.on; ev.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
    ev.addEventListener('dragend', () => { ev.classList.remove('dragging'); $$('.day-col', el).forEach(c => c.classList.remove('drop')); });
    ev.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ev.click(); } });
  });
  $$('.day-col', el).forEach(col => {
    col.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('drop');
      const to = col.dataset.day, ev = get('events', dragId); if (!ev || to === dragOn) return;
      const shift = dayDiff(dragOn, to);
      const nd = ev.repeat === 'weekly' ? (() => { const d = new Date(ev.date + 'T12:00:00'); d.setDate(d.getDate() + shift); return d.toISOString().slice(0, 10); })() : to;
      const old = Object.assign({}, ev);
      patch('events', ev.id, { date: ev.repeat === 'weekly' ? nd : to });
      const c = conflicts(Object.assign({}, ev, { date: to }));
      toast(`نُقل «${ev.title}» إلى ${niceDate(to)}${c.length ? ' — يتعارض مع ' + c[0].title : ''}`, { action: 'تراجع', onAction: () => { patch('events', ev.id, { date: old.date }); window.__refresh(); } });
      dragId = null; window.__refresh();
    });
  });
}

const modeSeg = () => html`<button class="${mode === 'week' ? 'on' : ''}" data-act="calMode" data-m="week">أسبوع</button><button class="${mode === 'month' ? 'on' : ''}" data-act="calMode" data-m="month">شهر</button>`;
/* ---------- عرض الشهر ---------- */
function month() {
  const t = today(), base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + mOff);
  const y = base.getFullYear(), mo = base.getMonth(), first = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  const ws = profile().weekStart || 0, start = startOfWeek(first, ws);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const rows = cells[35] && dobj(cells[35]).getMonth() !== mo ? cells.slice(0, 35) : cells;
  if (!sel || dobj(sel).getMonth() !== mo) sel = dobj(t).getMonth() === mo && dobj(t).getFullYear() === y ? t : first;
  const tasks = all('tasks');
  let nEx = 0, nCl = 0;
  const info = d => { const evs = eventsOn(d), ex = evs.filter(e => e.type === 'exam'), tk = tasks.filter(x => x.due === d && !x.done); return { evs, ex, tk }; };
  const grid = rows.map(d => { const i = info(d), inM = dobj(d).getMonth() === mo; if (inM) { nEx += i.ex.length; nCl += i.evs.length - i.ex.length; } return { d, i, inM }; });
  const si = info(sel), sd = dobj(sel);
  return html`
  <div class="week-nav">
    <h2>${MONTHS[mo]} <span class="muted small num" style="font-family:var(--font-body)">${y}</span></h2>
    <span class="chip">${nCl} حصة · ${nEx} اختبار</span>
    <div class="row" style="gap:4px">
      <button class="icon-btn" data-act="weekPrev" aria-label="الشهر السابق">${icon('chevR')}</button>
      ${mOff !== 0 ? html`<button class="btn sm" data-act="weekNow">اليوم</button>` : ''}
      <button class="icon-btn" data-act="weekNext" aria-label="الشهر التالي">${icon('chevL')}</button>
    </div>
    <div class="seg no-print" role="tablist">${modeSeg()}</div>
    <button class="btn primary sm no-print" data-act="addOn" data-d="${sel}">${icon('plus')}إضافة</button>
  </div>
  <div class="month-wrap">
    <div class="month" role="grid" aria-label="${MONTHS[mo]}">
      ${Array.from({ length: 7 }, (_, k) => html`<div class="m-h">${DAYS_SHORT[(ws + k) % 7]}</div>`)}
      ${grid.map(({ d, i, inM }) => html`<button class="m-cell ${inM ? '' : 'out'} ${d === t ? 'today' : ''} ${d === sel ? 'sel' : ''} ${i.ex.length ? 'has-ex' : ''}" data-act="pickDay" data-d="${d}" aria-label="${niceDate(d)}: ${i.evs.length} موعد، ${i.tk.length} مهمة" aria-pressed="${d === sel}">
        <span class="m-n num">${dobj(d).getDate()}</span>
        ${i.ex.slice(0, 2).map(e => html`<span class="m-ex" style="--c:${(get('subjects', e.subjectId) || {}).color || 'var(--danger)'}">${e.title}</span>`)}
        <span class="m-dots">${i.evs.filter(e => e.type !== 'exam').slice(0, 5).map(e => html`<i style="--c:${(get('subjects', e.subjectId) || {}).color || 'var(--muted)'}"></i>`)}${i.tk.length ? html`<em class="num">${i.tk.length}</em>` : ''}</span>
      </button>`)}
    </div>
    <section class="card m-day">
      <div class="card-head"><h2>${icon('today')}${DAYS[sd.getDay()]} ${sd.getDate()} ${MONTHS[sd.getMonth()]}</h2>${sel === t ? html`<span class="chip ac">اليوم</span>` : ''}</div>
      ${si.evs.length ? html`<div class="stack">${si.evs.map(e => evChip(e))}</div>` : html`<p class="small muted">لا مواعيد في هذا اليوم.</p>`}
      <h3 class="xs muted" style="margin:16px 0 8px">المهام${si.tk.length ? ' (' + si.tk.length + ')' : ''}</h3>
      ${si.tk.length ? html`<div class="tasks">${sortTasks(si.tk).map(x => taskRow(x, { showDate: false }))}</div>` : html`<p class="small muted">لا مهام مستحقة.</p>`}
      <div class="row" style="gap:8px;margin-top:16px"><button class="btn sm grow" data-act="addOn" data-d="${sel}">${icon('week')}موعد</button><button class="btn sm grow" data-act="newTaskOn" data-d="${sel}">${icon('tasks')}مهمة</button></div>
    </section>
  </div>`;
}
