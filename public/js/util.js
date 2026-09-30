/* أدوات عامة: قوالب آمنة، تواريخ، أرقام */
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(String(s));
export function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ser(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(ser).join('');
  return esc(v);
}
/** قالب HTML يهرّب كل القيم تلقائياً (حماية من إدخال نصوص ضارة) */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += ser(vals[i]); });
  return new Raw(out);
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ---------- التواريخ (بالتوقيت المحلي دائماً) ---------- */
export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function iso(d = new Date()) {
  d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => iso();
export const dobj = s => new Date(s + 'T12:00:00');
export function addDays(s, n) { const d = dobj(s); d.setDate(d.getDate() + n); return iso(d); }
export const dayDiff = (a, b) => Math.round((dobj(b) - dobj(a)) / 864e5);
export const weekday = s => dobj(s).getDay();
export function startOfWeek(s, weekStart = 0) { const wd = weekday(s); return addDays(s, -((wd - weekStart + 7) % 7)); }
export function niceDate(s, withDay = true) {
  if (!s) return 'بدون موعد';
  const t = today(), n = dayDiff(t, s);
  if (n === 0) return 'اليوم';
  if (n === 1) return 'غداً';
  if (n === -1) return 'أمس';
  if (n === 2) return 'بعد غد';
  const d = dobj(s);
  return (withDay ? DAYS[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()];
}
export const shortDate = s => { const d = dobj(s); return d.getDate() + '/' + (d.getMonth() + 1); };
let CLOCK = 12;
export function setClock(v) { CLOCK = Number(v) === 24 ? 24 : 12; }
export function t12(v) {
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  if (CLOCK === 24) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'م' : 'ص'}`;
}
export const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
export const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const fromMin = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + ' د';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' س' + (r ? ' ' + r + ' د' : '');
}
export function plural(n, one, two, few, many) {
  if (n === 1) return one; if (n === 2) return two; if (n >= 3 && n <= 10) return n + ' ' + few; return n + ' ' + many;
}
export const daysWord = n => plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً');
export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'سهرانين؟';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'نهارك سعيد';
  return 'مساء الخير';
}
/* تطبيع النص العربي للبحث */
export function norm(t) {
  return String(t || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
}
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* بذرة ثابتة لليوم (لمعلومة اليوم مثلاً) */
export function daySeed(s = today()) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
