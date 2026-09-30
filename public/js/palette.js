/* لوحة الأوامر (Ctrl+K): تنقّل، بحث شامل، وإضافة مهمة بجملة عادية */
import { html, norm, niceDate, today, $ } from './util.js';
import { icon } from './icons.js';
import { all, subject } from './store.js';
import { parseTask } from './logic.js';
import { modal } from './ui.js';
import { LESSONS, TERMS } from './science-data.js';
import { PRI } from './forms.js';

const NAV = [
  ['اليوم', '#/today', 'today'], ['الأسبوع والجدول', '#/week', 'week'], ['المهام', '#/tasks', 'tasks'], ['الاختبارات', '#/exams', 'exam'], ['المواد', '#/subjects', 'book'], ['العادات', '#/habits', 'habit'],
  ['مؤقت التركيز', '#/focus', 'focus'], ['عالم العلوم', '#/science', 'atom'], ['بطاقات المراجعة', '#/science/cards', 'cards'], ['اختبار علوم سريع', '#/science/quiz', 'quiz'], ['القاموس العلمي', '#/science/glossary', 'glossary'], ['المختبر التفاعلي', '#/science/lab', 'lab'],
  ['العلامات والمعدل', '#/grades', 'grade'], ['الملاحظات', '#/notes', 'pad'], ['الإحصائيات والإنجازات', '#/stats', 'stats'], ['الإعدادات', '#/settings', 'settings'], ['أدوات الطالب والحاسبات', '#/science/tools', 'calc']
];
export function openPalette(run) {
  if (document.querySelector('.palette')) return;
  const m = modal(html`<div class="pal-in">${icon('search')}<input id="palIn" placeholder="ابحث، انتقل، أو اكتب مهمة: «مراجعة الفيزياء الخميس !»" aria-label="البحث والأوامر" autocomplete="off"><kbd>Esc</kbd></div><div class="pal-list" id="palList" role="listbox"></div><div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span><span><kbd>Enter</kbd> تنفيذ</span><span>اكتب جملة بموعد لإضافتها كمهمة</span></div>`, { cls: 'palette' });
  const inp = $('#palIn', m.body), list = $('#palList', m.body);
  inp.focus();
  let items = [], sel = 0;
  const build = () => {
    const q = inp.value.trim(), nq = norm(q), out = [];
    const match = t => !nq || norm(t).includes(nq);
    if (q.length > 1) {
      const p = parseTask(q), s = subject(p.subjectId);
      const add = { sec: 'إضافة', ic: 'plus', label: `أضف مهمة: «${p.title}»`, hint: [niceDate(p.due || today()), s && s.name, p.priority !== 'normal' && 'أولوية ' + PRI[p.priority]].filter(Boolean).join(' · '), run: () => run.addTask(q) };
      out.push(add);
    }
    NAV.filter(([l]) => match(l)).forEach(([l, h, ic]) => out.push({ sec: 'انتقال', ic, label: l, run: () => { location.hash = h; } }));
    if (!nq || match('مهمة جديدة')) out.push({ sec: 'إجراءات', ic: 'plus', label: 'مهمة جديدة (بالتفاصيل)', hint: 'N', run: run.newTask });
    if (!nq || match('موعد حصة جديدة جدول')) out.push({ sec: 'إجراءات', ic: 'week', label: 'إضافة حصة أو موعد', hint: 'E', run: run.newEvent });
    if (!nq || match('اختبار جديد')) out.push({ sec: 'إجراءات', ic: 'exam', label: 'إضافة اختبار', run: run.newExam });
    if (!nq || match('علامة جديدة تسجيل علامة معدل')) out.push({ sec: 'إجراءات', ic: 'grade', label: 'تسجيل علامة', run: run.newGrade });
    if (!nq || match('ملاحظة جديدة دفتر ملخص')) out.push({ sec: 'إجراءات', ic: 'pad', label: 'ملاحظة جديدة', run: run.newNote });
    if (!nq || match('مساعد ذكي سؤال اسأل وقت فاضي')) out.push({ sec: 'إجراءات', ic: 'bot', label: 'اسأل مساعد جدولي الذكي', hint: 'G B', run: run.assistant });
    if (!nq || match('ابدأ جلسة تركيز مؤقت')) out.push({ sec: 'إجراءات', ic: 'play', label: 'ابدأ جلسة تركيز الآن', run: run.startFocus });
    if (!nq || match('الوضع الداكن الليلي المظهر')) out.push({ sec: 'إجراءات', ic: 'moon', label: 'تبديل الوضع الداكن', run: run.toggleTheme });
    if (nq) {
      all('tasks').filter(t => !t.done && norm(t.title).includes(nq)).slice(0, 5).forEach(t => out.push({ sec: 'المهام', ic: 'tasks', label: t.title, hint: niceDate(t.due), run: () => run.editTask(t.id) }));
      all('notes').filter(n => norm(n.title + ' ' + n.body).includes(nq)).slice(0, 4).forEach(n => out.push({ sec: 'الملاحظات', ic: 'pad', label: n.title, hint: n.body.replace(/[#*\[\]]/g, '').replace(/\s+/g, ' ').slice(0, 40), run: () => { location.hash = '#/notes'; setTimeout(() => document.querySelector(`[data-act=editNote][data-id="${n.id}"]`)?.click(), 120); } }));
      all('subjects').filter(s => norm(s.name).includes(nq)).slice(0, 3).forEach(s => out.push({ sec: 'المواد', ic: 'focus', label: 'ركّز على ' + s.name, run: () => { location.hash = '#/focus?s=' + s.id; } }));
      LESSONS.filter(l => norm(l.title).includes(nq)).slice(0, 3).forEach(l => out.push({ sec: 'دروس العلوم', ic: 'book', label: l.title, run: () => { location.hash = '#/science/lesson/' + l.id; } }));
      TERMS.filter(t => norm(t.t).includes(nq)).slice(0, 3).forEach(t => out.push({ sec: 'القاموس', ic: 'glossary', label: t.t, hint: t.d.slice(0, 40) + '…', run: () => { location.hash = '#/science/glossary?q=' + encodeURIComponent(t.t); } }));
    }
    // إن كان النص يطابق شيئاً موجوداً، لا نجعل الإضافة أولاً (إلا لو فيه مسافات = جملة)
    if (out.length > 1 && out[0].sec === 'إضافة' && !/\s/.test(q)) out.push(out.shift());
    items = out.slice(0, 14); sel = 0; draw();
  };
  const draw = () => {
    let last = '';
    list.innerHTML = items.length ? items.map((it, i) => { const h = (it.sec !== last ? `<div class="pal-sec">${it.sec}</div>` : ''); last = it.sec; return h + html`<div class="pal-item ${i === sel ? 'sel' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">${icon(it.ic)}<span>${it.label}</span>${it.hint ? html`<small>${it.hint}</small>` : ''}</div>`.s; }).join('') : '<div class="empty"><p>لا نتائج</p></div>';
    const s = list.querySelector('.sel'); s && s.scrollIntoView({ block: 'nearest' });
  };
  const exec = i => { const it = items[i]; if (!it) return; m.close(); setTimeout(() => it.run(), 10); };
  inp.addEventListener('input', build);
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(sel); }
  });
  list.addEventListener('click', e => { const it = e.target.closest('.pal-item'); if (it) exec(+it.dataset.i); });
  list.addEventListener('mousemove', e => { const it = e.target.closest('.pal-item'); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; list.querySelectorAll('.pal-item').forEach((x, i) => x.classList.toggle('sel', i === sel)); } });
  build();
}
