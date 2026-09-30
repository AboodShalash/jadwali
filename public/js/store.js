/* الحالة + الحفظ المحلي + المزامنة مع قاعدة البيانات */
import { uid, today, addDays } from './util.js';

const KEY = 'jadwali4', TOKEN = 'jadwali4_token', DEVICE = 'jadwali4_device';
export const COLS = ['subjects', 'events', 'tasks', 'habits', 'sessions', 'cards', 'lessons', 'quizzes', 'notes', 'grades'];

/* تخزين آمن: إن تعذّر localStorage (مثل بعض نوافذ المعاينة) نستخدم الذاكرة */
const mem = {};
export const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
};

export const SUBJECT_COLORS = ['#D9822B', '#1F8A7E', '#6C5BD4', '#C8553D', '#3E7CC9', '#B0527F', '#6E8B2E', '#A0712F', '#2E9CB5', '#8A5CC2'];
function defaults() {
  const u = Date.now();
  return {
    v: 4,
    profile: { name: '', grade: '', stage: '', sgrade: 0, field: '', elective: '', weekStart: 0, theme: 'auto', accent: 'saffron', focusGoal: 120, focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoBreak: true, sound: 'none', volume: 0.5, chime: true, dayStart: '07:00', dayEnd: '22:00', remind: 10, gradeScale: 100, fontSize: 'md', density: 'comfy', motion: 'auto', clock: 12, celebrate: true, hideWeekend: false, startPage: 'today', passMark: 50, shape: 'mid', warnEnd: 0, digest: '', favs: [], wrongs: [], onboarded: false, u: 0 },
    subjects: [
      { id: 'math', name: 'الرياضيات', color: '#3E7CC9', u },
      { id: 'arabic', name: 'اللغة العربية', color: '#1F8A7E', u },
      { id: 'english', name: 'اللغة الإنجليزية', color: '#B0527F', u },
      { id: 'science', name: 'العلوم', color: '#6C5BD4', u }
    ],
    events: [], tasks: [], habits: [], sessions: [], cards: [], lessons: [], quizzes: [], notes: [], grades: []
  };
}
function normalize(s) {
  const d = defaults();
  if (!s || typeof s !== 'object') return d;
  s.profile = Object.assign({}, d.profile, s.profile || {});
  COLS.forEach(c => { if (!Array.isArray(s[c])) s[c] = []; });
  s.v = 4;
  return s;
}
let state = (() => { try { return normalize(JSON.parse(ls.get(KEY) || 'null')); } catch (e) { return defaults(); } })();

/* ---------- الأحداث ---------- */
const subs = {};
export function on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = subs[ev].filter(f => f !== fn); }; }
function emit(ev, d) { (subs[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } }); }

/* ---------- القراءة ---------- */
export const S = () => state;
export const profile = () => state.profile;
export function all(col) { return state[col].filter(x => !x.del); }
export function get(col, id) { return state[col].find(x => x.id === id && !x.del) || null; }
export const subject = id => get('subjects', id);

/* ---------- الكتابة ---------- */
let saveT = null;
function commit(kind = 'local') {
  clearTimeout(saveT);
  saveT = setTimeout(() => ls.set(KEY, JSON.stringify(state)), 120);
  emit('change', kind);
  if (kind === 'local') schedulePush();
}
export function upsert(col, obj) {
  const now = Date.now();
  if (!obj.id) obj.id = uid();
  const i = state[col].findIndex(x => x.id === obj.id);
  const item = Object.assign({}, i > -1 ? state[col][i] : {}, obj, { u: now });
  if (i > -1 && state[col][i].del && obj.del === undefined) item.del = false;
  if (i > -1) state[col][i] = item; else state[col].push(item);
  commit();
  return item;
}
export function patch(col, id, fields) { const cur = state[col].find(x => x.id === id); if (!cur) return null; return upsert(col, Object.assign({}, cur, fields)); }
export function remove(col, id) {
  const i = state[col].findIndex(x => x.id === id);
  if (i < 0) return null;
  const old = state[col][i];
  state[col][i] = { id, del: true, u: Date.now() };
  commit();
  return old; // للتراجع
}
export function restore(col, item) { return upsert(col, Object.assign({}, item, { del: false })); }
export function setProfile(p) { state.profile = Object.assign({}, state.profile, p, { u: Date.now() }); commit(); }
export function replaceAll(s) { state = normalize(s); stampAll(); commit(); emit('remote', 'import'); }
function stampAll() { const u = Date.now(); COLS.forEach(c => state[c].forEach(x => { x.u = u; })); state.profile.u = u; }
export function resetProgress() {
  ['sessions', 'lessons', 'quizzes', 'cards'].forEach(c => state[c] = state[c].map(x => x.del ? x : { id: x.id, del: true, u: Date.now() }));
  state.habits.forEach(h => { h.days = {}; h.u = Date.now(); });
  state.profile = Object.assign({}, state.profile, { wrongs: [], u: Date.now() }); commit(); emit('remote', 'reset');
}
export function wipe() { state = defaults(); state.profile.onboarded = true; state.profile.u = Date.now(); commit(); emit('remote', 'wipe'); }

/* ---------- الدمج (نفس منطق الخادم) ---------- */
function mergeInto(local, remote) {
  let changed = false;
  COLS.forEach(c => {
    const idx = new Map(local[c].map(x => [x.id, x]));
    (remote[c] || []).forEach(r => {
      const l = idx.get(r.id);
      if (!l || (r.u || 0) > (l.u || 0)) { idx.set(r.id, r); changed = true; }
    });
    local[c] = [...idx.values()];
  });
  if (remote.profile && (remote.profile.u || 0) > (local.profile.u || 0)) { local.profile = Object.assign({}, local.profile, remote.profile); changed = true; }
  return changed;
}

/* ---------- المزامنة ---------- */
const PORT = '__PORT_8000__';
const API = PORT.startsWith('__') ? '' : PORT;
let rev = Number(ls.get('jadwali4_rev') || 0), pushT = null, pushing = false, dirty = false;
export const sync = { status: 'idle', user: null, lastSync: 0, available: true };
function setStatus(s) { if (sync.status !== s) { sync.status = s; emit('sync', s); } }
function device() { let d = ls.get(DEVICE); if (!d) { d = 'd' + uid() + uid(); ls.set(DEVICE, d); } return d; }
function headers() {
  const h = { 'Content-Type': 'application/json', 'X-Device-Id': device() };
  const t = ls.get(TOKEN); if (t) h.Authorization = 'Bearer ' + t;
  return h;
}
async function api(path, opts = {}) {
  const r = await fetch(API + '/api' + path, Object.assign({ headers: headers() }, opts));
  let body = null; try { body = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error((body && body.detail) || 'تعذّر الاتصال بالخادم'); err.status = r.status; throw err; }
  return body;
}
export const apiFetch = (path, opts) => api(path, opts);
function setUser(u) { const changed = JSON.stringify(u) !== JSON.stringify(sync.user); sync.user = u; if (changed) emit('user', u); }
export async function pull() {
  if (!navigator.onLine) { setStatus('offline'); return; }
  try {
    setStatus('syncing');
    const r = await api('/sync?since=' + rev);
    setUser(r.user);
    if (!r.same && r.data) {
      const changed = mergeInto(state, r.data);
      rev = r.rev; ls.set('jadwali4_rev', rev);
      if (changed) { commit('remote'); emit('remote', 'pull'); }
      // لدينا بيانات محلية ليست على الخادم؟
      if (hasLocalNewer(r.data)) dirty = true;
    }
    sync.available = true; sync.lastSync = Date.now();
    setStatus('synced');
    if (dirty || !r.rev) schedulePush(50);
  } catch (e) {
    setStatus(e instanceof TypeError ? (navigator.onLine ? 'local' : 'offline') : 'error');
  }
}
function hasLocalNewer(remote) {
  return COLS.some(c => { const m = new Map((remote[c] || []).map(x => [x.id, x.u || 0])); return state[c].some(x => !m.has(x.id) || (x.u || 0) > m.get(x.id)); })
    || (state.profile.u || 0) > ((remote.profile || {}).u || 0);
}
function schedulePush(ms = 900) { dirty = true; clearTimeout(pushT); pushT = setTimeout(push, ms); }
async function push() {
  if (pushing) { schedulePush(600); return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  if (sync.status === 'local') return; // الخادم غير متاح (استضافة ثابتة)
  pushing = true; dirty = false; setStatus('syncing');
  try {
    const r = await api('/sync', { method: 'PUT', body: JSON.stringify({ data: state, rev }) });
    setUser(r.user);
    if (r.data && mergeInto(state, r.data)) { commit('remote'); emit('remote', 'push'); }
    rev = r.rev; ls.set('jadwali4_rev', rev); sync.lastSync = Date.now();
    setStatus(dirty ? 'syncing' : 'synced');
  } catch (e) {
    dirty = true;
    setStatus(e instanceof TypeError ? (navigator.onLine ? 'local' : 'offline') : 'error');
  } finally { pushing = false; if (dirty && sync.status !== 'local') schedulePush(2500); }
}
export const flush = () => { clearTimeout(pushT); return push(); };

/* ---------- الحساب ---------- */
export async function register(username, password, name) {
  const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, name }) });
  ls.set(TOKEN, r.token); setUser(r.user);
  if (name && !state.profile.name) setProfile({ name });
  await flush(); return r.user;
}
export async function login(username, password) {
  await flush().catch(() => {});
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, carry: true }) });
  ls.set(TOKEN, r.token); setUser(r.user); rev = 0; ls.set('jadwali4_rev', 0);
  await pull(); await flush(); return r.user;
}
export async function logout() {
  await flush().catch(() => {});
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  ls.del(TOKEN); ls.set('jadwali4_rev', 0); rev = 0;
  state = defaults(); state.profile.onboarded = true; ls.set(KEY, JSON.stringify(state));
  emit('remote', 'logout'); await pull();
}

/* ---------- تشغيل ---------- */
export function startSync() {
  pull();
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 30000);
  window.addEventListener('online', () => pull());
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); else if (dirty) flush(); });
  window.addEventListener('pagehide', () => { ls.set(KEY, JSON.stringify(state)); if (dirty && sync.status !== 'local') { try { fetch(API + '/api/sync', { method: 'PUT', headers: headers(), body: JSON.stringify({ data: state, rev }), keepalive: true }); } catch (e) {} } });
  // مزامنة بين تبويبات المتصفح نفسه
  window.addEventListener('storage', e => {
    if (e.key === KEY && e.newValue) { try { const r = JSON.parse(e.newValue); if (mergeInto(state, r)) { emit('change', 'remote'); emit('remote', 'tab'); } } catch (x) {} }
  });
}

/* ---------- بيانات تجريبية (من شاشة الترحيب) ---------- */
export function seedDemo() {
  const t = today(), u = Date.now();
  const ws = addDays(t, -new Date(t + 'T12:00:00').getDay()); // الأحد من هذا الأسبوع
  const ev = (title, subjectId, date, start, end, type = 'class', repeat = 'weekly') => ({ id: uid(), title, subjectId, date, start, end, type, repeat, room: type === 'class' ? 'الصف ٩ب' : '', u });
  const plan = [['math', 'arabic', 'science', 'english'], ['english', 'math', 'arabic'], ['science', 'math', 'english', 'arabic'], ['arabic', 'science', 'math'], ['math', 'english', 'science']];
  const names = { math: 'رياضيات', arabic: 'لغة عربية', science: 'علوم', english: 'إنجليزي' };
  plan.forEach((day, i) => day.forEach((sid, k) => { if (state.subjects.some(s => s.id === sid && !s.del)) state.events.push(ev(names[sid], sid, addDays(ws, i), ['08:00', '08:50', '09:40', '10:40'][k], ['08:45', '09:35', '10:25', '11:25'][k])); }));
  state.events.push(ev('اختبار الرياضيات القصير', 'math', addDays(t, 6), '09:00', '09:45', 'exam', 'none'), ev('اختبار العلوم', 'science', addDays(t, 11), '10:00', '11:00', 'exam', 'none'));
  const tk = (title, subjectId, dOff, priority = 'normal', est = 1) => ({ id: uid(), title, subjectId, due: addDays(t, dOff), priority, est, steps: [], done: false, u });
  state.tasks.push(tk('حل تمارين الكسور صفحة 42', 'math', 0, 'high', 2), tk('قراءة درس الخلية', 'science', 1, 'normal', 1), tk('كتابة موضوع تعبير', 'arabic', 2, 'normal', 2), tk('حفظ كلمات الوحدة الثالثة', 'english', 3, 'low', 1));
  state.tasks.push(Object.assign(tk('مراجعة كلمات الإنجليزي 10 دقائق', 'english', 0, 'normal', 1), { repeat: 'weekdays' }));
  [[-1, 17, 25, 'math'], [-1, 18, 25, 'science'], [-2, 16, 50, 'math'], [-3, 19, 25, 'arabic'], [-4, 17, 25, 'english'], [-5, 9, 25, 'science']].forEach(([o, h, mn, sid]) => { const dd = addDays(t, o), st = new Date(dd + 'T00:00:00'); st.setHours(h, 5); if (state.subjects.some(x => x.id === sid && !x.del)) state.sessions.push({ id: uid(), kind: 'focus', day: dd, start: st.getTime(), minutes: mn, subjectId: sid, taskId: '', u }); });
  state.habits.push({ id: uid(), title: 'قراءة 20 دقيقة', icon: 'book', days: {}, u }, { id: uid(), title: 'مراجعة البطاقات', icon: 'cards', days: {}, u });
  const gr = (subjectId, title, kind, score, max, dOff) => ({ id: uid(), subjectId, title, kind, score, max, weight: KIND_W[kind] || 1, date: addDays(t, dOff), u });
  const have = id => state.subjects.some(s => s.id === id && !s.del);
  [['math', 'اختبار قصير 1', 'quiz', 17, 20, -20], ['math', 'الاختبار الشهري الأول', 'monthly', 34, 40, -9], ['science', 'تقرير المختبر', 'project', 9, 10, -14], ['science', 'اختبار قصير 1', 'quiz', 15, 20, -6], ['arabic', 'الاختبار الشهري الأول', 'monthly', 36, 40, -8], ['english', 'Quiz 1', 'quiz', 13, 20, -12], ['english', 'واجب القراءة', 'homework', 10, 10, -4]].forEach(g => { if (have(g[0])) state.grades.push(gr(...g)); });
  state.notes.push(
    { id: uid(), title: 'قوانين الحركة', subjectId: have('science') ? 'science' : '', color: 'violet', pinned: true, body: '# قوانين نيوتن\n- **الأول:** القصور الذاتي\n- **الثاني:** ق = ك × ت\n- **الثالث:** لكل فعل رد فعل\n\nما وحدة القوة؟ :: النيوتن\nما قانون التسارع؟ :: ت = ق ÷ ك', created: u, u },
    { id: uid(), title: 'قبل اختبار الرياضيات', subjectId: have('math') ? 'math' : '', color: 'saffron', pinned: false, body: '[x] مراجعة الكسور\n[ ] حل أسئلة الكتاب صفحة 50\n[ ] مراجعة الأخطاء في الاختبار القصير', created: u - 1000, u }
  );
  commit();
}
export const KIND_W = { quiz: 1, homework: 0.5, project: 1, monthly: 2, final: 4, other: 1 };

/* ---------- تواصل معنا: تُرسل للخادم، وتُحفظ في صندوق انتظار إن لم يكن متاحاً ---------- */
const OUTBOX = 'jadwali4_outbox';
export async function sendFeedback(d) {
  try { await api('/feedback', { method: 'POST', body: JSON.stringify(d) }); return 'sent'; }
  catch (e) {
    if (e.status && e.status !== 502 && e.status !== 503) throw e;
    const q = JSON.parse(ls.get(OUTBOX) || '[]'); q.push(d); ls.set(OUTBOX, JSON.stringify(q.slice(-20))); return 'queued';
  }
}
export async function flushOutbox() {
  const q = JSON.parse(ls.get(OUTBOX) || '[]'); if (!q.length) return;
  const left = [];
  for (const d of q) { try { await api('/feedback', { method: 'POST', body: JSON.stringify(d) }); } catch (e) { if (!e.status || e.status >= 500) left.push(d); } }
  ls.set(OUTBOX, JSON.stringify(left));
}
