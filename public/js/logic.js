/* منطق المجال: الحصص المتكررة، التركيز، النقاط، الإنجازات، التحليل اللغوي، خطط المراجعة، التكرار المتباعد */
import { all, get, profile, subject } from './store.js';
import { today, addDays, dayDiff, weekday, startOfWeek, norm, DAYS, iso, dobj, toMin, nowHM } from './util.js';

/* ---------- الحصص ---------- */
export function occursOn(e, d) {
  if (e.skip && e.skip.includes(d)) return false;
  if (e.date === d) return true;
  if (e.repeat !== 'weekly' || d < e.date || (e.until && d > e.until)) return false;
  return weekday(d) === weekday(e.date);
}
export function eventsOn(d) {
  return all('events').filter(e => occursOn(e, d)).map(e => Object.assign({}, e, { on: d })).sort((a, b) => a.start.localeCompare(b.start));
}
export function upcoming(limit = 5, span = 30) {
  const out = [], t = today(), nm = nowHM();
  for (let i = 0; i < span && out.length < limit; i++) {
    const d = addDays(t, i);
    for (const e of eventsOn(d)) { if (i === 0 && e.end <= nm) continue; out.push(e); if (out.length >= limit) break; }
  }
  return out;
}
export function nowEvent() { const nm = nowHM(); return eventsOn(today()).find(e => e.start <= nm && e.end > nm) || null; }
export function conflicts(ev) {
  return eventsOn(ev.date).filter(x => x.id !== ev.id && x.start < ev.end && x.end > ev.start);
}
export function exams(span = 120) {
  const out = [], t = today();
  all('events').filter(e => e.type === 'exam').forEach(e => {
    for (let i = 0; i < span; i++) { const d = addDays(t, i); if (occursOn(e, d)) { out.push(Object.assign({}, e, { on: d, left: i })); if (e.repeat !== 'weekly') break; else break; } }
  });
  return out.sort((a, b) => (a.on + a.start).localeCompare(b.on + b.start));
}
export function weekDates(offset = 0) {
  const s = addDays(startOfWeek(today(), profile().weekStart || 0), offset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

/* ---------- التركيز ---------- */
export const focusSessions = () => all('sessions').filter(s => s.kind === 'focus');
export function focusOn(d) { return focusSessions().filter(s => s.day === d).reduce((a, b) => a + (b.minutes || 0), 0); }
export function focusRange(days) { const set = new Set(days); return focusSessions().filter(s => set.has(s.day)).reduce((a, b) => a + (b.minutes || 0), 0); }
export function focusBySubject(days) {
  const set = days ? new Set(days) : null, out = {};
  focusSessions().forEach(s => { if (!set || set.has(s.day)) { const k = s.subjectId || '_'; out[k] = (out[k] || 0) + s.minutes; } });
  return out;
}
export const taskFocus = id => focusSessions().filter(s => s.taskId === id).reduce((a, b) => a + b.minutes, 0);
export const lastDays = (n, from = today()) => Array.from({ length: n }, (_, i) => addDays(from, i - n + 1));

/* نشاط اليوم = أي تركيز أو مهمة منجزة أو عادة أو مراجعة بطاقات أو اختبار */
export function activeOn(d) {
  if (focusOn(d) > 0) return true;
  if (all('tasks').some(t => t.done && t.doneAt === d)) return true;
  if (all('habits').some(h => h.days && h.days[d])) return true;
  if (all('cards').some(c => c.last === d)) return true;
  if (all('quizzes').some(q => q.day === d)) return true;
  return false;
}
export function streak() {
  let n = 0, d = today();
  if (!activeOn(d)) d = addDays(d, -1);
  while (activeOn(d) && n < 999) { n++; d = addDays(d, -1); }
  return n;
}
export function bestStreak() {
  const days = new Set();
  focusSessions().forEach(s => days.add(s.day));
  all('tasks').forEach(t => t.done && t.doneAt && days.add(t.doneAt));
  all('habits').forEach(h => Object.keys(h.days || {}).forEach(k => h.days[k] && days.add(k)));
  all('quizzes').forEach(q => days.add(q.day));
  const sorted = [...days].sort(); let best = 0, cur = 0, prev = null;
  sorted.forEach(d => { cur = prev && dayDiff(prev, d) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; });
  return best;
}

/* ---------- النقاط والمستويات ---------- */
export function xp() {
  let x = 0;
  x += focusSessions().reduce((a, s) => a + Math.round(s.minutes), 0);            // دقيقة = نقطة
  x += all('tasks').filter(t => t.done).reduce((a, t) => a + (t.priority === 'high' ? 30 : 20), 0);
  x += all('habits').reduce((a, h) => a + Object.values(h.days || {}).filter(Boolean).length * 10, 0);
  x += all('cards').reduce((a, c) => a + (c.reps || 0) * 3, 0);
  x += all('quizzes').reduce((a, q) => a + q.score * 5, 0);
  x += all('lessons').length * 25;
  x += all('grades').length * 10 + all('notes').length * 5;
  return x;
}
const LEVEL_NAMES = ['مبتدئ', 'مستكشف', 'مثابر', 'متقن', 'باحث', 'عالِم', 'حكيم', 'أسطورة'];
export function level(x = xp()) {
  // كل مستوى يحتاج 150 نقطة أكثر من السابق
  let lv = 1, need = 200, acc = 0;
  while (x >= acc + need) { acc += need; lv++; need += 150; }
  return { lv, name: LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((lv - 1) / 2))], into: x - acc, need, pct: Math.round((x - acc) / need * 100), total: x };
}

/* ---------- الإنجازات ---------- */
export function achievements() {
  const f = focusSessions(), tot = f.reduce((a, s) => a + s.minutes, 0), done = all('tasks').filter(t => t.done).length;
  const q = all('quizzes'), perfect = q.some(x => x.total >= 5 && x.score === x.total), cards = all('cards').reduce((a, c) => a + (c.reps || 0), 0);
  const early = f.some(s => new Date(s.start).getHours() < 7), late = f.some(s => new Date(s.start).getHours() >= 22);
  const bs = bestStreak(), long = f.some(s => s.minutes >= 50), planned = all('tasks').some(t => t.examId);
  const list = [
    ['first-focus', 'أول خطوة', 'أكمل أول جلسة تركيز', 'focus', f.length >= 1],
    ['focus-10h', 'عشر ساعات', 'اجمع 600 دقيقة تركيز', 'clock', tot >= 600],
    ['deep', 'غوص عميق', 'جلسة تركيز 50 دقيقة أو أكثر', 'target', long],
    ['tasks-10', 'منجِز', 'أنجز 10 مهام', 'tasks', done >= 10],
    ['tasks-50', 'آلة إنجاز', 'أنجز 50 مهمة', 'bolt', done >= 50],
    ['streak-3', 'بداية سلسلة', '3 أيام متتالية من النشاط', 'flame', bs >= 3],
    ['streak-7', 'أسبوع كامل', '7 أيام متتالية', 'flame', bs >= 7],
    ['streak-30', 'شهر من الالتزام', '30 يوماً متتالياً', 'trophy', bs >= 30],
    ['early', 'طائر الصباح', 'جلسة تركيز قبل السابعة صباحاً', 'sun', early],
    ['night', 'بومة الليل', 'جلسة تركيز بعد العاشرة مساءً', 'moon', late],
    ['quiz-perfect', 'العلامة الكاملة', 'اختبار علوم بلا أخطاء (5 أسئلة+)', 'star', perfect],
    ['cards-100', 'ذاكرة حديدية', '100 مراجعة بطاقة', 'cards', cards >= 100],
    ['lessons-5', 'قارئ نهم', 'أنهِ 5 دروس علوم', 'book', all('lessons').length >= 5],
    ['planner', 'المخطِّط', 'أنشئ خطة مراجعة لاختبار', 'exam', planned],
    ['grade-first', 'على الخريطة', 'سجّل أول علامة', 'grade', all('grades').length >= 1],
    ['ace', 'امتياز', 'علامة 95% أو أكثر', 'star', all('grades').some(g => g.max > 0 && g.score / g.max >= 0.95)],
    ['notes-5', 'مدوِّن', 'اكتب 5 ملاحظات', 'pad', all('notes').length >= 5],
    ['focus-100h', 'مئة ساعة', 'اجمع 6000 دقيقة تركيز', 'trophy', tot >= 6000],
    ['multi-exam', 'مخطِّط محترف', 'أنشئ خطط مراجعة لثلاثة اختبارات مختلفة', 'exam', new Set(all('tasks').filter(t => t.examId).map(t => t.examId)).size >= 3],
    ['subjects-5', 'متعدد المواد', 'أضِف 5 مواد أو أكثر إلى جدولك', 'book', all('subjects').length >= 5]
  ];
  return list.map(([id, title, desc, ic, got]) => ({ id, title, desc, icon: ic, got }));
}

/* ---------- التحليل اللغوي للإضافة السريعة ---------- */
export function parseTask(text) {
  let raw = String(text || '').replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 1632)).trim();
  let s = ' ' + raw + ' ', due = '', priority = 'normal', subjectId = '', est = 0, time = '';
  const cut = re => { const m = s.match(re); if (m) { s = s.replace(re, ' '); return m; } return null; };
  if (cut(/!+/)) priority = 'high';
  if (cut(/\s(مهم(?:ة)? جدا|عاجل(?:ة)?|ضروري(?:ة)?)\s/)) priority = 'high';
  if (cut(/\s(غير مهم(?:ة)?|منخفض(?:ة)?|مش مهم(?:ة)?)\s/)) priority = 'low';
  let m;
  if ((m = cut(/\s(\d{1,2})\s*(?:بومودورو|جلسات|جلسة|🍅)\s/))) est = Number(m[1]);
  if ((m = cut(/\s(?:الساعة|ساعة|س)\s*(\d{1,2})(?::(\d{2}))?\s*(ص|م|صباحا|مساء|مساءً|صباحاً)?\s/))) {
    let h = Number(m[1]); const pm = m[3] && /م/.test(m[3]) && !/^ص/.test(m[3]);
    if (pm && h < 12) h += 12; if (!m[3] && h < 7) h += 12;
    time = String(h).padStart(2, '0') + ':' + (m[2] || '00');
  }
  let repeat = 'none';
  const DR = /\sكل\s+((?:يوم\s+)?(?:ال)?(?:أحد|احد|اثنين|إثنين|ثلاثاء|اربعاء|أربعاء|خميس|جمعة|جمعه|سبت))\s/;
  if (DR.test(s)) { s = s.replace(DR, ' $1 '); repeat = 'weekly'; }
  else if (cut(/\s(?:كل\s+يوم|يوميا|يومياً)\s/)) repeat = 'daily';
  else if (cut(/\s(?:كل\s+(?:أسبوع|اسبوع)|أسبوعيا|اسبوعيا|أسبوعياً)\s/)) repeat = 'weekly';
  else if (cut(/\s(?:أيام الدوام|ايام الدوام|أيام المدرسة|ايام المدرسة)\s/)) repeat = 'weekdays';
  if ((m = cut(/\s(?:بعد|خلال)\s+(\d{1,2})\s*(?:ايام|أيام|يوم|يوما|يوماً)\s/))) due = addDays(today(), Number(m[1]));
  else if (cut(/\s(?:بعد\s+(?:غد|غدا|غداً|بكرا|بكرة|بكره))\s/)) due = addDays(today(), 2);
  else if (cut(/\s(?:غدا|غداً|بكرا|بكرة|بكره)\s/)) due = addDays(today(), 1);
  else if (cut(/\s(?:اليوم|هلا|هسا|هسه|الليلة|الليله)\s/)) due = today();
  else if (cut(/\s(?:الأسبوع|الاسبوع)\s+(?:الجاي|القادم)\s/)) due = addDays(startOfWeek(today(), profile().weekStart || 0), 7);
  else if ((m = cut(/\s(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\s/))) {
    const now = new Date(); let y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : now.getFullYear();
    let d = new Date(y, Number(m[2]) - 1, Number(m[1]), 12);
    if (!m[3] && iso(d) < today()) d.setFullYear(y + 1);
    if (!isNaN(d)) due = iso(d);
  } else {
    for (let i = 0; i < 7; i++) {
      const base = norm(DAYS[i]).replace(/^ال/, '').replace(/ا/g, '[اأإآ]').replace(/ه/g, '[هة]').replace(/ي/g, '[يى]');
      const re = new RegExp('\\s(?:يوم\\s+)?(?:ال)?' + base + '(?:\\s+(الجاي|القادم|الجاية|الجايه))?\\s');
      const mm = s.match(re);
      if (mm) { s = s.replace(re, ' '); let diff = (i - weekday(today()) + 7) % 7; if (diff === 0 && mm[1]) diff = 7; due = addDays(today(), diff); break; }
    }
  }
  const title = s.replace(/\s+/g, ' ').trim() || raw;
  // المادة
  const nt = ' ' + norm(title) + ' '; let best = null;
  all('subjects').forEach(sb => {
    const n = norm(sb.name); let ws = [n, n.replace(/^ال/, '')].concat(n.split(' ').filter(w => w.length > 3).map(w => w.replace(/^ال/, '')));
    ws = ws.concat(ws.map(w => w.replace(/يه$/, 'ي').replace(/ه$/, '')));
    ws.forEach(w => { if (w.length > 2 && nt.includes(w) && (!best || w.length > best.l)) best = { id: sb.id, l: w.length }; });
  });
  if (best) subjectId = best.id;
  if (repeat !== 'none' && !due) due = today();
  return { title, due, priority, subjectId, est, time, repeat };
}

/* ---------- خطة مراجعة الاختبار ---------- */
export function planDates(examDay, count) {
  const t = today(), n = dayDiff(t, examDay);
  if (n <= 0) return [t];
  const avail = Array.from({ length: n }, (_, i) => addDays(t, i));
  count = Math.max(1, Math.min(count, avail.length));
  if (count === 1) return [avail[avail.length - 1]];
  const out = []; for (let i = 0; i < count; i++) out.push(avail[Math.round(Math.pow(i / (count - 1), 0.8) * (avail.length - 1))]);
  return new Set(out).size === count ? out : avail.slice(-count);
}

/* ---------- التكرار المتباعد (SM-2 مبسّط) ---------- */
export function review(card, grade) { // grade: 0 نسيت، 1 صعبة، 2 جيدة، 3 سهلة
  const c = Object.assign({ ef: 2.5, ivl: 0, reps: 0 }, card);
  const q = [1, 3, 4, 5][grade];
  if (q < 3) { c.ivl = 0; c.streak = 0; }
  else { c.streak = (c.streak || 0) + 1; c.ivl = c.streak === 1 ? 1 : c.streak === 2 ? 3 : Math.round(c.ivl * c.ef); if (grade === 3) c.ivl = Math.round(c.ivl * 1.3) || 2; }
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  c.reps = (c.reps || 0) + 1; c.last = today(); c.due = addDays(today(), c.ivl);
  return c;
}
export function cardDue(c) { return !c || !c.due || c.due <= today(); }

/* ---------- التقرير ---------- */
export function period(days) {
  const set = new Set(days);
  return {
    focus: focusRange(days),
    tasks: all('tasks').filter(t => t.done && set.has(t.doneAt)).length,
    habits: days.reduce((a, d) => a + all('habits').filter(h => h.days && h.days[d]).length, 0),
    active: days.filter(activeOn).length,
    cards: all('cards').filter(c => set.has(c.last)).length,
    quizzes: all('quizzes').filter(q => set.has(q.day)).length,
    perDay: days.map(d => ({ d, m: focusOn(d) })),
    bySub: focusBySubject(days)
  };
}
export function heat(weeks = 18) {
  const end = today(), start = addDays(startOfWeek(end, 0), -(weeks - 1) * 7), out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push({ d, m: focusOn(d), a: activeOn(d) });
  return out;
}
export const subName = id => (subject(id) || {}).name || '';
export const subColor = id => (subject(id) || {}).color || 'var(--muted)';
export { get };

/* ---------- المهام المتكررة ---------- */
export const REPEATS = { none: 'مرة واحدة', daily: 'كل يوم', weekdays: 'أيام الدوام (الأحد–الخميس)', weekly: 'كل أسبوع' };
export function nextDue(t) {
  const base = t.due && t.due > today() ? t.due : (t.due || today());
  if (t.repeat === 'daily') return addDays(base < today() ? today() : base, 1);
  if (t.repeat === 'weekly') { let d = addDays(base, 7); while (d <= today()) d = addDays(d, 7); return d; }
  if (t.repeat === 'weekdays') { let d = addDays(base < today() ? today() : base, 1); while (weekday(d) === 5 || weekday(d) === 6) d = addDays(d, 1); return d; }
  return '';
}

/* ---------- خطة اليوم الذكية ----------
   تملأ الأوقات الفارغة (بين الحصص وحتى نهاية اليوم) بكتل تركيز مرتبة حسب الأهمية. */
export function dayPlan(d = today()) {
  const p = profile(), fm = Number(p.focusMin) || 25, br = Number(p.shortMin) || 5;
  const endM = toMin(p.dayEnd || '22:00'), startDay = toMin(p.dayStart || '07:00');
  let cur = d === today() ? Math.max(startDay, Math.ceil((toMin(nowHM()) + 5) / 5) * 5) : startDay;
  const busy = eventsOn(d).filter(e => !e.planned).map(e => [toMin(e.start), toMin(e.end)]).sort((a, b) => a[0] - b[0]);
  const pr = { high: 0, normal: 1, low: 2 }, t = today();
  const cand = [];
  const open = all('tasks').filter(x => !x.done && x.due && x.due <= addDays(d, x.examId ? 2 : 0));
  open.sort((a, b) => (a.due < t ? 0 : 1) - (b.due < t ? 0 : 1) || (a.examId ? 0 : 1) - (b.examId ? 0 : 1) || pr[a.priority] - pr[b.priority] || a.due.localeCompare(b.due));
  open.forEach(x => {
    const done = focusSessions().filter(s => s.taskId === x.id).length, left = Math.max(1, Math.min(3, (x.est || 1) - done));
    cand.push({ kind: x.examId ? 'exam' : 'task', title: x.title, taskId: x.id, subjectId: x.subjectId, min: left * fm + (left - 1) * br, why: x.due < t ? 'متأخرة' : x.examId ? 'خطة مراجعة' : x.priority === 'high' ? 'أولوية عالية' : 'مستحقة اليوم' });
  });
  const due = all('cards').filter(c => !c.due || c.due <= d).length;
  if (due) cand.push({ kind: 'cards', title: `مراجعة ${due} بطاقة علوم`, min: Math.min(20, 5 + due), why: 'حان وقت مراجعتها', href: '#/science/cards' });
  // أضعف مادة حسب العلامات
  const gs = all('grades'); if (gs.length) {
    const by = {}; gs.forEach(g => { const b = by[g.subjectId] = by[g.subjectId] || [0, 0]; const w = Number(g.weight) || 1; b[0] += g.score / g.max * 100 * w; b[1] += w; });
    const weak = Object.entries(by).filter(([k]) => subject(k)).map(([k, [s, w]]) => [k, s / w]).sort((a, b) => a[1] - b[1])[0];
    if (weak && weak[1] < 85) cand.push({ kind: 'weak', title: 'تقوية ' + subject(weak[0]).name, subjectId: weak[0], min: fm, why: `معدلك ${Math.round(weak[1])}%` });
  }
  const hs = all('habits').filter(h => !(h.days || {})[d]);
  if (hs.length) cand.push({ kind: 'habit', title: hs.map(h => h.title).slice(0, 2).join(' · '), min: 20, why: 'عادات اليوم', href: '#/habits' });
  // التوزيع على الفراغات
  const out = [];
  for (const c of cand) {
    let placed = false;
    while (!placed && cur + 15 <= endM) {
      const b = busy.find(([s, e]) => cur < e && cur + c.min > s);
      if (b) { if (b[0] - cur >= 20 && c.min > 25 && c.kind !== 'cards') { const mm = b[0] - cur - 5; out.push(Object.assign({}, c, { start: cur, end: cur + mm, part: true })); c.min -= mm; } cur = Math.max(cur, b[1]) + 5; continue; }
      const end = Math.min(endM, cur + c.min); out.push(Object.assign({}, c, { start: cur, end })); cur = end + (c.min >= 45 ? 10 : br); placed = true;
    }
    if (cur + 15 > endM) break;
  }
  return { blocks: out, total: out.reduce((a, b) => a + b.end - b.start, 0), left: Math.max(0, cand.length - new Set(out.map(o => o.title)).size), endM };
}

/* ---------- الأوقات الفاضية بين الحصص ---------- */
export function freeSlots(d = today(), min = 20) {
  const p = profile(), endM = toMin(p.dayEnd || '22:00');
  let cur = d === today() ? Math.max(toMin(p.dayStart || '07:00'), Math.ceil(toMin(nowHM()) / 5) * 5) : toMin(p.dayStart || '07:00');
  const out = [];
  eventsOn(d).map(e => [toMin(e.start), toMin(e.end)]).sort((a, b) => a[0] - b[0]).forEach(([s, e]) => { if (s - cur >= min) out.push([cur, s]); cur = Math.max(cur, e); });
  if (endM - cur >= min) out.push([cur, endM]);
  return out;
}
