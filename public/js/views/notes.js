/* الملاحظات: تدوين سريع بتنسيق بسيط، قوائم تحقق تتحول لمهام، وبطاقات «سؤال :: جواب» للمراجعة */
import { html, raw, esc, today, norm, niceDate, shuffle, $, $$, debounce } from '../util.js';
import { icon } from '../icons.js';
import { all, get, upsert, patch, remove, restore, subject } from '../store.js';
import { intro } from '../parts.js';
import { act, empty, modal, toast, formData, confetti } from '../ui.js';
import { subjectOptions } from '../forms.js';

export const title = 'الملاحظات';
export const NCOLORS = { plain: ['بدون', 'var(--surface)'], saffron: ['زعفران', 'var(--accent-2)'], mint: ['نعناع', 'var(--focus-2)'], violet: ['بنفسجي', 'var(--sci-2)'], coral: ['مرجاني', 'var(--danger-2)'] };
const F = { q: '', s: '' };

/* ---------- تنسيق بسيط وآمن ---------- */
const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/`(.+?)`/g, '<code>$1</code>');
export function cardsOf(body) {
  return (body || '').split('\n').map(l => l.split('::')).filter(p => p.length === 2 && p[0].trim() && p[1].trim()).map(([q, a]) => ({ q: q.trim(), a: a.trim() }));
}
export function md(body, { interactive = false, id = '' } = {}) {
  const lines = (body || '').split('\n'); let out = '', list = false;
  const close = () => { if (list) { out += '</ul>'; list = false; } };
  lines.forEach((l, i) => {
    const t = l.trim();
    if (/^\[( |x|X)\]\s*/.test(t)) {
      close(); const on = /^\[(x|X)\]/.test(t), txt = t.replace(/^\[( |x|X)\]\s*/, '');
      out += `<label data-noact class="n-chk ${on ? 'on' : ''}">${interactive ? `<input type="checkbox" data-change="noteChk" data-id="${id}" data-l="${i}" ${on ? 'checked' : ''}>` : `<span class="box">${on ? '✓' : ''}</span>`}<span>${inline(txt)}</span></label>`;
    } else if (/^[-•*]\s+/.test(t)) { if (!list) { out += '<ul>'; list = true; } out += `<li>${inline(t.replace(/^[-•*]\s+/, ''))}</li>`; }
    else if (/^##\s+/.test(t)) { close(); out += `<h5>${inline(t.slice(3))}</h5>`; }
    else if (/^#\s+/.test(t)) { close(); out += `<h4>${inline(t.slice(2))}</h4>`; }
    else if (t.includes('::') && t.split('::').length === 2) { close(); const [q, a] = t.split('::'); out += `<div class="n-qa"><b>${inline(q.trim())}</b><span>${inline(a.trim())}</span></div>`; }
    else if (!t) { close(); out += '<div class="n-gap"></div>'; }
    else { close(); out += `<p>${inline(t)}</p>`; }
  });
  close(); return raw(out);
}
const checks = b => { const l = (b || '').split('\n').filter(x => /^\s*\[( |x|X)\]/.test(x)); return { n: l.length, done: l.filter(x => /^\s*\[(x|X)\]/.test(x)).length }; };

/* ---------- المحرر ---------- */
export function noteModal(n = {}) {
  const isNew = !n.id;
  n = Object.assign({ title: '', subjectId: '', color: 'plain', body: '', pinned: false }, n);
  const m = modal(html`<form class="form note-form">
    <input class="note-title" name="title" maxlength="80" value="${n.title}" placeholder="عنوان الملاحظة" aria-label="العنوان" autofocus>
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <select name="subjectId" class="sm-select" aria-label="المادة">${subjectOptions(n.subjectId, 'بدون مادة')}</select>
      <div class="swatches" role="radiogroup" aria-label="اللون">${Object.entries(NCOLORS).map(([k, [l, c]]) => html`<label title="${l}"><input type="radio" name="color" value="${k}" ${k === n.color ? raw('checked') : ''}><i style="background:${c}"></i></label>`)}</div>
      <label class="row small" style="gap:6px;margin-inline-start:auto"><input type="checkbox" name="pinned" ${n.pinned ? raw('checked') : ''}>${icon('pin')}تثبيت</label>
    </div>
    <div class="n-tools" role="toolbar" aria-label="التنسيق">
      <button type="button" data-ins="# ">عنوان</button><button type="button" data-wrap="**"><b>عريض</b></button><button type="button" data-ins="- ">${icon('menu')}قائمة</button><button type="button" data-ins="[ ] ">${icon('check')}مهمة</button><button type="button" data-ins=" :: " data-mid="1">${icon('cards')}سؤال :: جواب</button>
    </div>
    <div class="n-edit">
      <textarea name="body" id="nBody" rows="12" placeholder="اكتب هنا…&#10;# عنوان&#10;- نقطة&#10;[ ] شيء لأنجزه&#10;ما عاصمة الأردن؟ :: عمّان">${n.body}</textarea>
      <div class="n-prev note-body" id="nPrev" aria-live="polite"></div>
    </div>
    <div class="form-actions">${!isNew ? html`<button type="button" class="btn ghost spacer" id="delN">${icon('trash')}حذف</button>` : ''}<span class="xs muted spacer" id="nCount"></span><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${isNew ? 'حفظ' : 'حفظ التعديل'}</button></div>
  </form>`, { title: isNew ? 'ملاحظة جديدة' : 'تعديل الملاحظة', wide: true });
  const f = m.body.querySelector('form'), ta = $('#nBody', m.body), pv = $('#nPrev', m.body), cnt = $('#nCount', m.body);
  const upd = () => { pv.innerHTML = ta.value.trim() ? md(ta.value).s : '<p class="muted small">المعاينة تظهر هنا</p>'; const c = cardsOf(ta.value).length, w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0; cnt.textContent = `${w} كلمة${c ? ' · ' + c + ' بطاقة' : ''}`; };
  ta.addEventListener('input', debounce(upd, 80)); upd();
  $$('.n-tools button', m.body).forEach(b => b.onclick = () => {
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    if (b.dataset.wrap) { const w = b.dataset.wrap, sel = v.slice(s, e) || 'نص'; ta.value = v.slice(0, s) + w + sel + w + v.slice(e); ta.setSelectionRange(s + w.length, s + w.length + sel.length); }
    else if (b.dataset.mid) { ta.value = v.slice(0, s) + ' :: ' + v.slice(e); ta.setSelectionRange(s + 4, s + 4); }
    else { const ls = v.lastIndexOf('\n', s - 1) + 1, ins = b.dataset.ins; ta.value = v.slice(0, ls) + ins + v.slice(ls); ta.setSelectionRange(s + ins.length, s + ins.length); }
    ta.focus(); upd();
  });
  const del = $('#delN', m.body);
  if (del) del.onclick = () => { m.close(); deleteNote(n.id); };
  f.onsubmit = e => {
    e.preventDefault(); const d = formData(f);
    if (!d.title.trim() && !d.body.trim()) { m.close(); return; }
    upsert('notes', Object.assign({}, isNew ? { created: Date.now() } : get('notes', n.id), { id: n.id, title: d.title.trim() || d.body.trim().split('\n')[0].replace(/^[#\-\[\]x ]+/, '').slice(0, 40) || 'ملاحظة', subjectId: d.subjectId, color: d.color || 'plain', pinned: !!d.pinned, body: d.body }));
    m.close(); toast(isNew ? 'حُفظت الملاحظة' : 'حُدّثت الملاحظة'); window.__refresh();
  };
}
function deleteNote(id) { const old = remove('notes', id); window.__refresh(); toast('حُذفت الملاحظة', { action: 'تراجع', onAction: () => { restore('notes', old); window.__refresh(); } }); }

/* ---------- مراجعة بطاقات الملاحظة ---------- */
function studyModal(n) {
  const cs = shuffle(cardsOf(n.body)); if (!cs.length) return toast('أضف أسطراً بصيغة «سؤال :: جواب» لتتحول إلى بطاقات');
  let i = 0, shown = false, know = 0;
  const m = modal(html`<div id="stBox"></div>`, { title: 'مراجعة: ' + n.title });
  const box = $('#stBox', m.body);
  const draw = () => {
    if (i >= cs.length) { box.innerHTML = html`<div class="empty">${icon('trophy')}<h3>انتهت المراجعة</h3><p>عرفت ${know} من ${cs.length}</p><div class="row" style="justify-content:center;gap:8px"><button class="btn" id="stAgain">${icon('repeat')}مرة أخرى</button><button class="btn primary" data-close>تم</button></div></div>`.s; if (know === cs.length) confetti(60); $('#stAgain', box).onclick = () => { i = 0; know = 0; shown = false; cs.sort(() => Math.random() - .5); draw(); }; return; }
    const c = cs[i];
    box.innerHTML = html`<div class="row xs muted" style="justify-content:space-between"><span>البطاقة ${i + 1} من ${cs.length}</span><span>Space للقلب · 1 لم أعرف · 2 عرفت</span></div>
      <div class="bar" style="--p:${Math.round(i / cs.length * 100)}%;--c:var(--sci);margin:8px 0 14px"><i></i></div>
      <button class="st-card ${shown ? 'shown' : ''}" id="stFlip"><b>${c.q}</b>${shown ? html`<span>${c.a}</span>` : html`<small class="muted">اضغط لإظهار الجواب</small>`}</button>
      ${shown ? html`<div class="row" style="gap:8px;margin-top:14px"><button class="btn grow" data-g="0">لم أعرف</button><button class="btn primary grow" data-g="1">عرفتها</button></div>` : ''}`.s;
    $('#stFlip', box).onclick = () => { shown = true; draw(); };
    $$('[data-g]', box).forEach(b => b.onclick = () => grade(+b.dataset.g));
  };
  const grade = g => { if (g) know++; i++; shown = false; draw(); };
  const key = e => { if (!document.body.contains(box)) return document.removeEventListener('keydown', key); if (e.key === ' ' && !shown && i < cs.length) { e.preventDefault(); shown = true; draw(); } else if (shown && (e.key === '1' || e.key === '2')) grade(e.key === '2' ? 1 : 0); };
  document.addEventListener('keydown', key);
  draw();
}

act('newNote', el => noteModal(el && el.dataset.s ? { subjectId: el.dataset.s } : {}));
act('editNote', el => { const n = get('notes', el.dataset.id); n && noteModal(n); });
act('pinNote', el => { const n = get('notes', el.dataset.id); if (n) { patch('notes', n.id, { pinned: !n.pinned }); window.__refresh(); } });
act('delNote', el => deleteNote(el.dataset.id));
act('studyNote', el => { const n = get('notes', el.dataset.id); n && studyModal(n); });
act('noteChk', el => {
  const n = get('notes', el.dataset.id); if (!n) return;
  const ls = n.body.split('\n'), i = +el.dataset.l;
  ls[i] = ls[i].replace(/\[( |x|X)\]/, el.checked ? '[x]' : '[ ]');
  patch('notes', n.id, { body: ls.join('\n') });
  const c = checks(ls.join('\n')); if (c.n && c.n === c.done) { confetti(40); toast('أنجزت كل بنود القائمة'); }
  window.__refresh();
});
act('noteTasks', el => {
  const n = get('notes', el.dataset.id); if (!n) return;
  const items = n.body.split('\n').filter(l => /^\s*\[ \]/.test(l)).map(l => l.replace(/^\s*\[ \]\s*/, '').trim()).filter(Boolean);
  if (!items.length) return toast('لا بنود غير منجزة في هذه القائمة');
  const made = items.map(t => upsert('tasks', { title: t.replace(/\*\*/g, ''), due: today(), priority: 'normal', subjectId: n.subjectId || '', est: 1, steps: [], done: false, notes: 'من ملاحظة: ' + n.title }));
  window.__refresh();
  toast(`أُضيفت ${made.length} ${made.length === 1 ? 'مهمة' : 'مهام'} لليوم`, { action: 'تراجع', onAction: () => { made.forEach(t => remove('tasks', t.id)); window.__refresh(); } });
});
act('nSub', el => { F.s = el.dataset.s === F.s ? '' : el.dataset.s; window.__refresh(); });
act('nSearch', debounce(el => { F.q = el.value; const v = $('#nGrid'); if (v) { v.outerHTML = grid().s; } }, 120));

function grid() {
  let ns = all('notes');
  if (F.s) ns = ns.filter(n => n.subjectId === F.s);
  if (F.q.trim()) { const q = norm(F.q); ns = ns.filter(n => norm(n.title + ' ' + n.body).includes(q)); }
  ns.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.u || 0) - (a.u || 0));
  if (!ns.length) return html`<div id="nGrid">${all('notes').length ? html`<section class="card">${empty('search', 'لا نتائج', 'جرّب كلمة أخرى أو ألغِ تصفية المادة.')}</section>` : html`<section class="card">${empty('pad', 'دفترك فارغ', 'دوّن ملخصات الدروس وقوائم ما قبل الاختبار. اكتب «سؤال :: جواب» لتتحول الأسطر إلى بطاقات مراجعة.', html`<button class="btn primary sm" data-act="newNote">${icon('plus')}أول ملاحظة</button>`)}</section>`}</div>`;
  return html`<div class="notes" id="nGrid">${ns.map(n => { const s = subject(n.subjectId), c = checks(n.body), cards = cardsOf(n.body).length; return html`<article class="note" style="--nb:${(NCOLORS[n.color] || NCOLORS.plain)[1]}">
    <header><h3 data-act="editNote" data-id="${n.id}" tabindex="0" role="button">${n.title}</h3><button class="icon-btn sm ${n.pinned ? 'on' : ''}" data-act="pinNote" data-id="${n.id}" aria-label="${n.pinned ? 'إلغاء التثبيت' : 'تثبيت'}" aria-pressed="${!!n.pinned}">${icon('pin')}</button></header>
    <div class="note-body" data-act="editNote" data-id="${n.id}">${md(n.body.length > 900 ? n.body.slice(0, 900) + '…' : n.body, { interactive: true, id: n.id })}</div>
    <footer>${s ? html`<span class="chip" style="--c:${s.color}"><span class="dot"></span>${s.name}</span>` : ''}${c.n ? html`<span class="chip ${c.done === c.n ? 'ok' : ''}">${icon('check')}${c.done}/${c.n}</span>` : ''}
      <span class="spacer"></span>
      ${cards ? html`<button class="btn sm ghost" data-act="studyNote" data-id="${n.id}">${icon('cards')}ذاكر ${cards}</button>` : ''}
      ${c.n > c.done ? html`<button class="icon-btn sm" data-act="noteTasks" data-id="${n.id}" aria-label="تحويل البنود إلى مهام" title="تحويل البنود إلى مهام">${icon('tasks')}</button>` : ''}
      <button class="icon-btn sm" data-act="delNote" data-id="${n.id}" aria-label="حذف">${icon('trash')}</button></footer>
  </article>`; })}</div>`;
}

export function render() {
  const subs = all('subjects').filter(s => all('notes').some(n => n.subjectId === s.id));
  return html`${intro('الملاحظات', 'ملخصات، قوائم تحقق، وبطاقات مراجعة من كلماتك أنت', html`<button class="btn primary" data-act="newNote">${icon('plus')}ملاحظة جديدة</button>`)}
  <div class="row notes-bar">
    <label class="search-in">${icon('search')}<input type="search" placeholder="ابحث في ملاحظاتك" value="${F.q}" data-input="nSearch" aria-label="بحث"></label>
    ${subs.length ? html`<div class="row" style="gap:6px;flex-wrap:wrap">${subs.map(s => html`<button class="chip pick ${F.s === s.id ? 'on' : ''}" style="--c:${s.color}" data-act="nSub" data-s="${s.id}" aria-pressed="${F.s === s.id}"><span class="dot"></span>${s.name}</button>`)}</div>` : ''}
  </div>
  ${grid()}`;
}
export function mount(el) {
  $$('.note h3[role=button]', el).forEach(h => h.addEventListener('keydown', e => { if (e.key === 'Enter') h.click(); }));
}
