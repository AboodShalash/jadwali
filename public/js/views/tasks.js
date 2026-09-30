import { html, raw, today, addDays, norm, $ } from '../util.js';
import { icon } from '../icons.js';
import { all, subject, patch } from '../store.js';
import { taskRow, sortTasks, intro } from '../parts.js';
import { act, empty, toast } from '../ui.js';
import { subjectOptions } from '../forms.js';
import { openScanner } from '../scan.js';
act('scanTask', () => openScanner());

export const title = 'المهام';
const F = { filter: 'open', q: '', sub: '' };
const FILTERS = { open: 'الحالية', today: 'اليوم', week: 'هذا الأسبوع', late: 'متأخرة', high: 'مهمة', done: 'منجزة' };
act('taskFilter', el => { F.filter = el.dataset.f; window.__refresh(); });
act('lateToday', () => { const t = today(), late = all('tasks').filter(x => !x.done && x.due && x.due < t); if (!late.length) return; const old = late.map(x => [x.id, x.due]); late.forEach(x => patch('tasks', x.id, { due: t })); window.__refresh(); toast(`نُقلت ${late.length} ${late.length === 1 ? 'مهمة' : 'مهام'} إلى اليوم`, { action: 'تراجع', onAction: () => { old.forEach(([id, d]) => patch('tasks', id, { due: d })); window.__refresh(); } }); });
act('taskSub', el => { F.sub = el.value; window.__refresh(); });

function groups(list) {
  const t = today(), g = { late: [], today: [], tomorrow: [], week: [], later: [], none: [] };
  list.forEach(x => {
    if (!x.due) g.none.push(x); else if (x.due < t) g.late.push(x); else if (x.due === t) g.today.push(x);
    else if (x.due === addDays(t, 1)) g.tomorrow.push(x); else if (x.due <= addDays(t, 7)) g.week.push(x); else g.later.push(x);
  });
  return [['late', 'متأخرة'], ['today', 'اليوم'], ['tomorrow', 'غداً'], ['week', 'خلال أسبوع'], ['later', 'لاحقاً'], ['none', 'بدون موعد']].filter(([k]) => g[k].length).map(([k, l]) => ({ k, l, items: sortTasks(g[k]) }));
}
export function render() {
  const t = today(); let list = all('tasks');
  const counts = { open: list.filter(x => !x.done).length, late: list.filter(x => !x.done && x.due && x.due < t).length };
  if (F.sub) list = list.filter(x => x.subjectId === F.sub);
  if (F.q) { const q = norm(F.q); list = list.filter(x => norm(x.title + ' ' + (x.notes || '')).includes(q)); }
  const f = F.filter;
  if (f === 'done') list = list.filter(x => x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  else {
    list = list.filter(x => !x.done);
    if (f === 'today') list = list.filter(x => x.due && x.due <= t);
    if (f === 'week') list = list.filter(x => x.due && x.due <= addDays(t, 7));
    if (f === 'late') list = list.filter(x => x.due && x.due < t);
    if (f === 'high') list = list.filter(x => x.priority === 'high');
  }
  const doneAll = all('tasks').filter(x => x.done).length, totalAll = all('tasks').length;
  return html`
  ${intro('مهامي', totalAll ? `${counts.open} مهمة حالية · ${doneAll} منجزة${counts.late ? ' · ' + counts.late + ' متأخرة' : ''}` : 'كل واجباتك ومشاريعك في مكان واحد', html`<div class="row wrap"><button class="btn" data-act="scanTask">${icon('camera')}مسح واجب</button><button class="btn primary" data-act="newTask">${icon('plus')}مهمة جديدة</button></div>`)}
  <div class="list-tools">
    <div class="seg" role="tablist">${Object.entries(FILTERS).map(([k, v]) => html`<button class="${F.filter === k ? 'on' : ''}" data-act="taskFilter" data-f="${k}" role="tab" aria-selected="${F.filter === k}">${v}${k === 'late' && counts.late ? html` <span class="badge" style="background:var(--danger);color:#fff">${counts.late}</span>` : ''}</button>`)}</div>
    <select class="input" data-change="taskSub" aria-label="تصفية حسب المادة">${subjectOptions(F.sub, 'كل المواد')}</select>
    <input class="input grow" id="taskQ" placeholder="بحث في المهام…" value="${F.q}" aria-label="بحث">
  </div>
  <section class="card">
    ${!list.length ? empty('tasks', F.q || F.sub ? 'لا نتائج' : f === 'done' ? 'لم تنجز مهاماً بعد' : 'لا مهام هنا', F.q || F.sub ? 'جرّب كلمات أو مادة أخرى.' : 'اضغط «مهمة جديدة» أو Ctrl+K واكتب المهمة بجملة عادية.')
      : f === 'done' ? html`<div>${list.slice(0, 80).map(x => taskRow(x))}</div>`
      : groups(list).map(g => html`<h3 class="small ${g.k === 'late' ? 'conflict' : 'muted'} grp-h" style="margin:10px 12px 4px">${g.l} · ${g.items.length}${g.k === 'late' ? html`<button class="btn sm ghost" data-act="lateToday">${icon('repeat')}انقلها كلها لليوم</button>` : ''}</h3><div>${g.items.map(x => taskRow(x, { showDate: g.k !== 'today' && g.k !== 'tomorrow' }))}</div>`)}
  </section>`;
}
export function mount(el) {
  const q = $('#taskQ', el); let tm;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { F.q = q.value; const pos = q.selectionStart; window.__refresh(); const n = $('#taskQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200); });
}
