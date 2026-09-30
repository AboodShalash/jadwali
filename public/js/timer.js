/* محرك مؤقت التركيز: يعتمد على الطوابع الزمنية فيبقى دقيقاً حتى لو صُغّرت الصفحة أو أعيد تحميلها */
import { ls, profile, upsert, get } from './store.js';
import { today, uid } from './util.js';
import { chime, notify, confetti, audioCtx, toast } from './ui.js';

const KEY = 'jadwali4_timer';
const subs = [];
export const onTimer = fn => { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); };
const emit = (ev) => subs.forEach(f => { try { f(ev, T); } catch (e) { console.error(e); } });

export const MODES = { focus: 'تركيز', short: 'استراحة قصيرة', long: 'استراحة طويلة' };
export let T = load();
function load() {
  let t = null; try { t = JSON.parse(ls.get(KEY) || 'null'); } catch (e) {}
  return Object.assign({ mode: 'focus', running: false, endAt: 0, left: 0, total: 0, taskId: '', subjectId: '', cycle: 0, startedAt: 0, custom: 0, egg67: false }, t || {});
}
function save() { ls.set(KEY, JSON.stringify(T)); }
export function durationOf(mode) {
  const p = profile();
  if (mode === 'focus') return (T.custom || p.focusMin || 25) * 60;
  if (mode === 'short') return (p.shortMin || 5) * 60;
  return (p.longMin || 15) * 60;
}
export function remaining() {
  if (T.running) return Math.max(0, Math.round((T.endAt - Date.now()) / 1000));
  return T.left || durationOf(T.mode);
}
export function elapsedMin() { const tot = T.total || durationOf(T.mode); return Math.max(0, Math.round((tot - remaining()) / 60)); }

export function setMode(mode, { keepLink = true } = {}) {
  T.mode = mode; T.running = false; T.left = 0; T.total = durationOf(mode); T.startedAt = 0; T.egg67 = false;
  if (!keepLink) { T.taskId = ''; T.subjectId = ''; }
  save(); emit('mode');
}
export function link({ taskId = '', subjectId = '', minutes = 0 } = {}) {
  if (T.running && T.mode === 'focus' && elapsedMin() >= 1) {
    // جلسة جارية: نسجّل ما مضى ثم نبدأ من جديد على الهدف الجديد
    record(elapsedMin(), true);
  }
  T.taskId = taskId; T.subjectId = subjectId || (taskId && get('tasks', taskId) ? get('tasks', taskId).subjectId : '') || '';
  T.custom = minutes || 0; setMode('focus');
}
export function start() {
  audioCtx(); // فتح الصوت بلمسة المستخدم
  if (T.running) return;
  const left = T.left || durationOf(T.mode);
  if (!T.total || !T.left) T.total = durationOf(T.mode);
  T.endAt = Date.now() + left * 1000; T.running = true; if (!T.startedAt) T.startedAt = Date.now();
  save(); emit('start');
}
export function pause() { if (!T.running) return; T.left = remaining(); T.running = false; save(); emit('pause'); }
export const toggle = () => (T.running ? pause() : start());
export function reset() { T.running = false; T.left = 0; T.startedAt = 0; T.total = durationOf(T.mode); save(); emit('reset'); }
export function stopAndSave() {
  const m = elapsedMin();
  if (T.mode === 'focus' && m >= 1) { record(m, true); toast(`سُجّلت ${m} دقيقة تركيز`); }
  reset();
}
export function skip() { complete(true); }

function record(minutes, partial = false) {
  const end = Date.now(), startTs = T.startedAt || end - minutes * 60000;
  const s = upsert('sessions', { id: uid(), kind: T.mode === 'focus' ? 'focus' : 'break', minutes, day: today(), start: startTs, end, subjectId: T.subjectId || '', taskId: T.taskId || '', partial });
  emit('recorded');
  return s;
}
function complete(skipped = false) {
  const was = T.mode, p = profile();
  if (!skipped || (was === 'focus' && elapsedMin() >= 1)) {
    const minutes = skipped ? elapsedMin() : Math.round((T.total || durationOf(was)) / 60);
    if (minutes > 0) record(minutes, skipped);
  }
  T.running = false; T.left = 0; T.startedAt = 0; T.egg67 = false;
  if (was === 'focus') {
    T.cycle = (T.cycle || 0) + 1;
    const next = T.cycle % (p.longEvery || 4) === 0 ? 'long' : 'short';
    if (!skipped) { p.chime !== false && chime('done'); notify('أحسنت! انتهت جلسة التركيز', 'خذ استراحة قصيرة ثم عد بطاقة جديدة.'); confetti(70); }
    T.mode = next; T.total = durationOf(next); save(); emit('complete-focus');
    if (p.autoBreak && !skipped) start();
  } else {
    if (!skipped) { p.chime !== false && chime('break'); notify('انتهت الاستراحة', 'جاهز لجلسة تركيز جديدة؟'); }
    T.mode = 'focus'; T.custom = T.custom || 0; T.total = durationOf('focus'); save(); emit('complete-break');
  }
}
let lastSec = -1;
setInterval(() => {
  if (!T.running) return;
  const r = remaining();
  if (r <= 0) { complete(false); return; }
  const w = Number(profile().warnEnd) || 0;
  if (w && T.mode === 'focus' && r <= w * 60 && T.total > w * 60 + 30 && T.warned !== T.endAt) { T.warned = T.endAt; save(); toast(`باقي ${w === 1 ? 'دقيقة واحدة' : w === 2 ? 'دقيقتان' : w + ' دقائق'} على نهاية الجلسة`); if (profile().chime !== false) chime('soft'); }
  if (T.startedAt && !T.egg67) {
    const elapsed = Math.max(0, Math.floor((Date.now() - T.startedAt) / 1000));
    if (elapsed >= 67 * 60) { T.egg67 = true; save(); emit('egg67'); }
  }
  if (r !== lastSec) { lastSec = r; emit('tick'); }
}, 250);
// إن انتهى الوقت أثناء إغلاق الصفحة
if (T.running && remaining() <= 0) setTimeout(() => complete(false), 500);
export const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

/* ---------- أصوات الخلفية (تُولَّد برمجياً) ---------- */
export const SOUNDS = { none: 'بدون', rain: 'مطر', river: 'نهر', fan: 'مروحة', cafe: 'مقهى هادئ' };
let node = null, gain = null, current = 'none';
function noiseBuffer(a, type) {
  const len = a.sampleRate * 4, buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else if (type === 'pink') { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 1.6; }
      else d[i] = w * 0.35;
    }
  }
  return buf;
}
export function playSound(name, vol = profile().volume ?? 0.5) {
  const a = audioCtx(); if (!a) return;
  stopSound(); current = name; if (name === 'none') return;
  gain = a.createGain(); gain.gain.value = 0; gain.connect(a.destination);
  const src = a.createBufferSource(); src.loop = true;
  const f = a.createBiquadFilter();
  if (name === 'rain') { src.buffer = noiseBuffer(a, 'pink'); f.type = 'highpass'; f.frequency.value = 400; }
  else if (name === 'river') { src.buffer = noiseBuffer(a, 'brown'); f.type = 'lowpass'; f.frequency.value = 900; }
  else if (name === 'fan') { src.buffer = noiseBuffer(a, 'white'); f.type = 'lowpass'; f.frequency.value = 1400; }
  else { src.buffer = noiseBuffer(a, 'brown'); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; }
  src.connect(f).connect(gain); src.start();
  // تموّج خفيف يجعل الصوت طبيعياً
  const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = name === 'river' ? 0.08 : 0.15; lg.gain.value = 0.08 * vol;
  lfo.connect(lg).connect(gain.gain); lfo.start();
  gain.gain.linearRampToValueAtTime(vol * 0.6, a.currentTime + 1.2);
  node = { src, lfo };
}
export function setVolume(v) { if (gain && audioCtx()) gain.gain.linearRampToValueAtTime(v * 0.6, audioCtx().currentTime + 0.2); }
export function stopSound() {
  if (node) { const a = audioCtx(), g = gain, n = node; g.gain.linearRampToValueAtTime(0, a.currentTime + 0.4); setTimeout(() => { try { n.src.stop(); n.lfo.stop(); g.disconnect(); } catch (e) {} }, 450); }
  node = null; gain = null; current = 'none';
}
export const soundOn = () => current;
