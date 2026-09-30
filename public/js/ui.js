/* واجهة مشتركة: الإجراءات، النوافذ، التنبيهات، الاحتفال */
import { html, raw, $, $$ } from './util.js';
import { icon } from './icons.js';

/* ---------- سجل الإجراءات (data-act) ---------- */
export const actions = {};
export function act(name, fn) { actions[name] = fn; }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || e.target.closest('[data-noact]')) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && actions[el.dataset.change]) actions[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && actions[el.dataset.input]) actions[el.dataset.input](el, e);
});

/* ---------- التنبيهات ---------- */
let toastWrap;
export function toast(msg, opts = {}) {
  if (!toastWrap) { toastWrap = document.createElement('div'); toastWrap.className = 'toasts'; toastWrap.setAttribute('role', 'status'); toastWrap.setAttribute('aria-live', 'polite'); document.body.appendChild(toastWrap); }
  const t = document.createElement('div');
  t.className = 'toast' + (opts.kind ? ' ' + opts.kind : '');
  t.innerHTML = html`<span>${msg}</span>${opts.action ? html`<button type="button">${opts.action}</button>` : ''}`.s;
  if (opts.action) t.querySelector('button').onclick = () => { opts.onAction && opts.onAction(); dismiss(); };
  toastWrap.appendChild(t);
  while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
  requestAnimationFrame(() => t.classList.add('show'));
  const dismiss = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); };
  setTimeout(dismiss, opts.action ? 6000 : 2800);
}

/* ---------- النوافذ ---------- */
const stack = [];
export function modal(content, { title = '', wide = false, onClose, cls = '' } = {}) {
  const lastFocus = document.activeElement;
  const m = document.createElement('div');
  m.className = 'modal ' + cls;
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  if (title) m.setAttribute('aria-label', title);
  m.innerHTML = html`<div class="modal-card ${wide ? 'wide' : ''}">${title ? html`<header class="modal-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="إغلاق">${icon('x')}</button></header>` : ''}<div class="modal-body"></div></div>`.s;
  const body = m.querySelector('.modal-body');
  body.innerHTML = content instanceof Object && 's' in content ? content.s : String(content);
  document.body.appendChild(m);
  document.documentElement.classList.add('modal-open');
  requestAnimationFrame(() => m.classList.add('open'));
  const close = () => {
    m.classList.remove('open'); setTimeout(() => m.remove(), 220);
    stack.splice(stack.indexOf(api), 1);
    if (!stack.length) document.documentElement.classList.remove('modal-open');
    onClose && onClose(); lastFocus && lastFocus.focus && lastFocus.focus();
  };
  m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  m.addEventListener('click', e => { if (e.target.closest('[data-close]')) { e.preventDefault(); close(); } });
  const api = { el: m, body, close };
  stack.push(api);
  setTimeout(() => { const f = body.querySelector('[autofocus],input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,button'); f && f.focus(); }, 60);
  return api;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1].close(); } });
export const anyModal = () => stack.length > 0;

export function confirmBox(msg, { ok = 'تأكيد', danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    const m = modal(html`<p class="confirm-msg">${msg}</p><div class="form-actions"><button type="button" class="btn ghost" data-close>إلغاء</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button></div>`, { title: 'تأكيد', onClose: () => { if (!done) res(false); } });
    m.body.querySelector('[data-ok]').onclick = () => { done = true; res(true); m.close(); };
    setTimeout(() => m.body.querySelector('[data-ok]').focus(), 80);
  });
}
/* قراءة نموذج إلى كائن */
export function formData(form) {
  const o = {};
  $$('[name]', form).forEach(el => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  });
  return o;
}

/* ---------- الاحتفال (قصاصات ملوّنة) ---------- */
export function confetti(n = 90) {
  if (document.documentElement.dataset.motion === 'off' || window.__noConfetti) return;
  try { if (JSON.parse(localStorage.jadwali4 || '{}').profile.celebrate === false) return; } catch (e) {}
  const c = document.createElement('canvas'); c.className = 'confetti';
  const dpr = window.devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--focus', '--sci', '--danger', '--ok'].map(v => cs.getPropertyValue(v).trim() || '#D9822B');
  const P = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 160, y: innerHeight * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: colors[Math.floor(Math.random() * colors.length)] }));
  let t = 0;
  (function f() {
    x.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - t / 110); x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
    if (++t < 120) requestAnimationFrame(f); else c.remove();
  })();
}

/* ---------- صوت تنبيه قصير (بدون ملفات) ---------- */
let actx;
export function audioCtx() { if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (A) actx = new A(); } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
export function chime(kind = 'done') {
  const a = audioCtx(); if (!a) return;
  const notes = kind === 'done' ? [659.25, 783.99, 1046.5] : [523.25, 659.25];
  notes.forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + i * 0.16;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + 1);
  });
}
export function notify(title, body) {
  try { if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification(title, { body, icon: 'img/icon-192.png', lang: 'ar', dir: 'rtl' }); } catch (e) {}
}
export function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }
export const empty = (ic, title, text, btn) => html`<div class="empty">${icon(ic)}<h3>${title}</h3><p>${text}</p>${btn || ''}</div>`;
export { raw };
