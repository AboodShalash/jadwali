import { html, raw, today, fmtMin, t12, pick, $, $$ } from '../util.js';
import { icon } from '../icons.js';
import { all, get, profile, setProfile, subject, upsert, remove, restore } from '../store.js';
import { uid, addDays } from '../util.js';
import { focusOn, focusSessions, lastDays, streak } from '../logic.js';
import { T, MODES, remaining, durationOf, setMode, toggle, reset, skip, stopAndSave, link, fmt, onTimer, SOUNDS, playSound, stopSound, setVolume, soundOn } from '../timer.js';
import { act, toast, askNotify, confirmBox, modal, formData } from '../ui.js';
import { subjectOptions } from '../forms.js';

export const title = 'التركيز';
const MC = { focus: 'var(--focus)', short: 'var(--accent)', long: 'var(--sci)' };
const QUOTES = ['النجاح مجموع جهود صغيرة تتكرر يوماً بعد يوم.', 'ابدأ من حيث أنت، واستخدم ما لديك، وافعل ما تستطيع.', 'التركيز هو فن ترك الأشياء الأقل أهمية.', 'كل دقيقة تركيز الآن توفّر عليك ساعة قلق لاحقاً.', 'لا تنتظر الحماس؛ ابدأ وسيلحق بك.', 'قطرة فوق قطرة تصنع نهراً.'];
act('tMode', async el => { if (T.running && !(await confirmBox('إيقاف الجلسة الحالية والتبديل؟', { ok: 'تبديل' }))) return; setMode(el.dataset.m); window.__refresh(); });
act('tToggle', () => { askNotify(); toggle(); window.__refresh(); });
act('tReset', () => { reset(); window.__refresh(); });
act('tSkip', () => { skip(); window.__refresh(); });
act('tStop', () => { stopAndSave(); window.__refresh(); });
act('tSound', el => { const s = el.dataset.s; setProfile({ sound: s }); if (s === 'none') stopSound(); else playSound(s, profile().volume); window.__refresh(); });
act('tCustom', () => {
  const m = modal(html`<form class="form"><label class="field"><span>مدة التركيز بالدقائق</span><input type="number" name="m" min="1" max="240" value="${T.custom || profile().focusMin}" required autofocus></label>
    <div class="row wrap" style="gap:6px">${[10, 20, 30, 45, 60, 120].map(v => html`<button type="button" class="btn sm" data-v="${v}">${v}</button>`)}</div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">تطبيق الوقت</button></div></form>`, { title: 'وقت مخصص للمؤقت' });
  const f = m.body.querySelector('form'); m.body.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { f.m.value = b.dataset.v; });
  f.onsubmit = e => { e.preventDefault(); const v = Math.max(1, Math.min(240, Number(f.m.value) || 25)); link({ taskId: T.taskId, subjectId: T.subjectId, minutes: v }); m.close(); toast('المؤقت الآن ' + v + ' دقيقة'); window.__refresh(); };
});
act('logSession', () => {
  const now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const m = modal(html`<form class="form">
    <p class="small muted">ذاكرت بعيداً عن المؤقت؟ سجّلها هنا لتُحسب في هدفك وإحصائياتك.</p>
    <div class="form-row"><label class="field"><span>المادة</span><select name="subjectId">${subjectOptions(T.subjectId, '— بدون مادة —')}</select></label><label class="field"><span>المدة بالدقائق</span><input type="number" name="minutes" min="5" max="480" step="5" value="45" required></label></div>
    <div class="form-row"><label class="field"><span>التاريخ</span><input type="date" name="day" value="${today()}" max="${today()}" min="${addDays(today(), -30)}"></label><label class="field"><span>انتهت الساعة</span><input type="time" name="end" value="${hm}"></label></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">إضافة الجلسة</button></div></form>`, { title: 'أضف جلسة مذاكرة' });
  m.body.querySelector('form').onsubmit = e => {
    e.preventDefault(); const d = formData(e.target), mn = Math.max(5, Math.min(480, Number(d.minutes) || 0));
    const end = new Date(d.day + 'T' + (d.end || '12:00') + ':00').getTime();
    const s = upsert('sessions', { id: uid(), kind: 'focus', minutes: mn, day: d.day, start: end - mn * 60000, end, subjectId: d.subjectId || '', taskId: '', manual: true });
    m.close(); window.__refresh(); toast('أُضيفت جلسة ' + mn + ' دقيقة', { action: 'تراجع', onAction: () => { remove('sessions', s.id); window.__refresh(); } });
  };
});
act('delSession', el => { const old = remove('sessions', el.dataset.id); window.__refresh(); toast('حُذفت الجلسة', { action: 'تراجع', onAction: () => { restore('sessions', old); window.__refresh(); } }); });
act('tPreset', el => { setProfile({ focusMin: Number(el.dataset.v) }); T.custom = 0; if (!T.running) setMode('focus'); window.__refresh(); });
act('zen', () => openZen());
act('tUnlink', () => { T.taskId = ''; T.subjectId = ''; T.custom = 0; if (!T.running) setMode('focus'); if (location.hash !== '#/focus') location.hash = '#/focus'; else window.__refresh(); });

function show67Normal() {
  const m = modal(html`<div class="stack" style="text-align:center;gap:14px;padding:8px 0 4px">
    <div style="font-size:64px;font-weight:900;line-height:1;letter-spacing:-4px">6️⃣7️⃣</div>
    <h2 style="margin:0;font-size:28px">SIX SEVEN! 🗣️</h2>
    <p class="small muted" style="margin:0">وصلت للدقيقة 67. المؤقت دخل الميم 😂</p>
    <div class="row" style="justify-content:center"><button class="btn primary" data-close>نكمل التركيز 🔥</button></div>
  </div>`, { title: '67' });
  try { document.body.classList.add('egg67-pop'); setTimeout(() => document.body.classList.remove('egg67-pop'), 900); } catch (e) {}
  setTimeout(() => { if (m && m.body && !m.body.isConnected) return; }, 0);
}

export function render(params = {}) {
  if (params.s && !T.running && T.subjectId !== params.s) { link({ subjectId: params.s }); }
  if (params.t && !T.running && T.taskId !== params.t) { const tk = get('tasks', params.t); if (tk) link({ taskId: tk.id, minutes: tk.minutes || 0 }); }
  const p = profile(), r = remaining(), tot = T.total || durationOf(T.mode);
  const tk = T.taskId ? get('tasks', T.taskId) : null, s = subject(T.subjectId || (tk && tk.subjectId));
  const f = focusOn(today()), goal = p.focusGoal || 120, cyc = (T.cycle || 0) % (p.longEvery || 4);
  const log = focusSessions().filter(x => x.day === today()).sort((a, b) => b.end - a.end);
  const open = all('tasks').filter(x => !x.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 30);
  return html`
  <div class="focus-wrap">
    <section class="focus-stage ${T.running ? 'running' : ''}" style="--mc:${MC[T.mode]}" id="stage">
      <div class="seg" role="tablist">${Object.entries(MODES).map(([k, v]) => html`<button class="${T.mode === k ? 'on' : ''}" data-act="tMode" data-m="${k}" role="tab" aria-selected="${T.mode === k}">${v}</button>`)}</div>
      <div class="ring" role="timer" aria-live="off">
        ${raw(ringMarkup(r, tot))}
        <div class="ring-in"><span class="mode">${MODES[T.mode]}</span><span class="time" id="tTime">${fmt(r)}</span>
          ${tk || s ? html`<span class="linked">${tk ? tk.title : s.name}</span>` : html`<span class="xs muted">جلسة حرة</span>`}</div>
      </div>
      <div class="focus-ctl">
        <button class="icon-btn" data-act="tReset" aria-label="إعادة" title="إعادة (R)">${icon('reset')}</button>
        <button class="play" data-act="tToggle" aria-label="${T.running ? 'إيقاف مؤقت' : 'ابدأ'}" title="مسافة">${icon(T.running ? 'pause' : 'play')}</button>
        <button class="icon-btn" data-act="tSkip" aria-label="تخطي" title="تخطي (N)">${icon('skip')}</button>
      </div>
      <div class="row" style="gap:14px">
        <div class="dots" aria-label="الدورة">${Array.from({ length: p.longEvery || 4 }, (_, i) => html`<i class="${i < cyc ? 'on' : ''}"></i>`)}</div>
        ${T.mode === 'focus' && T.startedAt ? html`<button class="btn sm ghost" data-act="tStop">${icon('check')}إنهاء وحفظ</button>` : ''}
        <button class="btn sm ghost" data-act="zen">${icon('expand')}وضع الصفاء</button>
      </div>
      <p class="xs muted">${T.running ? 'اترك الهاتف بعيداً. سنبلغك عند انتهاء الوقت.' : 'مسافة للبدء · R للإعادة · F لوضع الصفاء'}</p>
    </section>

    <div class="stack" style="gap:20px;align-content:start">
      <section class="card">
        <div class="card-head"><h2 style="--c:var(--focus)">${icon('target')}على ماذا ستركّز؟</h2>${tk || s ? html`<button class="more" data-act="tUnlink">إلغاء الربط</button>` : ''}</div>
        <div class="form">
          <label class="field"><span>مهمة</span><select id="tTask"><option value="">— بدون مهمة —</option>${open.map(x => html`<option value="${x.id}" ${x.id === T.taskId ? raw('selected') : ''}>${x.title}</option>`)}</select></label>
          <label class="field"><span>أو مادة</span><select id="tSub">${subjectOptions(T.subjectId, '— بدون مادة —')}</select></label>
          <div class="row wrap" style="gap:6px"><span class="xs muted">مدة التركيز:</span>${[15, 25, 40, 50, 90].map(v => html`<button class="btn sm ${(!T.custom && p.focusMin === v) || T.custom === v ? 'primary' : ''}" data-act="tPreset" data-v="${v}">${v}</button>`)}<button class="btn sm ${T.custom && ![15, 25, 40, 50, 90].includes(T.custom) ? 'primary' : 'ghost'}" data-act="tCustom">${T.custom && ![15, 25, 40, 50, 90].includes(T.custom) ? T.custom + ' د' : 'مخصص'}</button></div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2 style="--c:var(--focus)">${icon('sound')}أصوات للتركيز</h2></div>
        <div class="sounds">${Object.entries(SOUNDS).map(([k, v]) => html`<button class="sound ${(soundOn() === k) || (k === 'none' && soundOn() === 'none') ? 'on' : ''}" data-act="tSound" data-s="${k}">${icon(k === 'none' ? 'mute' : k === 'rain' ? 'cloud' : k === 'river' ? 'habit' : k === 'fan' ? 'repeat' : 'book')}${v}</button>`)}</div>
        <label class="field" style="margin-top:12px"><span>مستوى الصوت</span><input type="range" id="tVol" min="0" max="1" step="0.05" value="${p.volume ?? 0.5}"></label>
      </section>
      <section class="card">
        <div class="card-head focus-log-head"><h2 style="--c:var(--focus)">${icon('clock')}جلسات اليوم</h2><button class="btn sm ghost" data-act="logSession">${icon('plus')}أضف جلسة</button><span class="more">${fmtMin(f)} / ${fmtMin(goal)} · سلسلة ${streak()}</span></div>
        <div class="bar" style="--p:${Math.min(100, f / goal * 100)}%;--c:var(--focus);margin-bottom:12px"><i></i></div>
        ${log.length ? html`<div class="stack small">${log.slice(0, 8).map(x => { const sb = subject(x.subjectId), tt = x.taskId && get('tasks', x.taskId); return html`<div class="row"><span class="dot" style="--c:${sb ? sb.color : 'var(--focus)'}"></span><span class="grow">${tt ? tt.title : sb ? sb.name : 'جلسة حرة'}</span><span class="muted num">${fmtMin(x.minutes)} · ${t12(new Date(x.start).toTimeString().slice(0, 5))}${x.manual ? ' · يدوية' : ''}</span><button class="icon-btn sm" data-act="delSession" data-id="${x.id}" aria-label="حذف الجلسة" title="حذف">${icon('x')}</button></div>`; })}</div>` : html`<p class="small muted">لم تبدأ بعد اليوم. أول جلسة هي الأصعب — والأهم.</p>`}
      </section>
      ${weekFocus()}
    </div>
  </div>`;
}
/* إحصائيات الأسبوع (من Time Balance) */
function weekFocus() {
  const days = lastDays(7), per = days.map(d => focusOn(d)), tot = per.reduce((a, b) => a + b, 0), mx = Math.max(30, ...per), ses = focusSessions().filter(x => days.includes(x.day));
  const best = per.indexOf(Math.max(...per)), goal = Number(profile().focusGoal) || 120, hit = per.filter(m => m >= goal).length;
  const DS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  return html`<section class="card"><div class="card-head"><h2 style="--c:var(--focus)">${icon('stats')}إحصائيات الأسبوع</h2><a class="more" href="#/stats">المزيد ${icon('chevL')}</a></div>
    <div class="mini-bars">${days.map((d, i) => html`<div class="${d === today() ? 'today' : ''}" title="${fmtMin(per[i])}"><i style="--h:${Math.round(per[i] / mx * 100)}%;${per[i] >= goal ? 'background:var(--ok)' : ''}"></i><span>${DS[new Date(d + 'T12:00').getDay()]}</span></div>`)}</div>
    <div class="readout" style="margin-top:12px"><div><b>${fmtMin(tot)}</b><span>المجموع</span></div><div><b>${ses.length ? fmtMin(Math.round(tot / Math.max(1, ses.length))) : '—'}</b><span>متوسط الجلسة</span></div><div><b>${hit}/7</b><span>أيام حققت الهدف</span></div></div>
    ${tot ? html`<p class="xs muted" style="margin-top:8px">أفضل يوم: ${DS[new Date(days[best] + 'T12:00').getDay()]} (${fmtMin(per[best])}).</p>` : ''}</section>`;
}
function ringMarkup(r, tot) {
  const R = 150, C = 2 * Math.PI * R, off = C * (1 - r / tot);
  return `<svg viewBox="0 0 320 320" aria-hidden="true"><circle class="trk" cx="160" cy="160" r="${R}"/><circle class="prg" id="tRing" cx="160" cy="160" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>`;
}
let unsub = null;
export function mount(el) {
  const tm = $('#tTime', el), ring = $('#tRing', el);
  const upd = () => { const r = remaining(), tot = T.total || durationOf(T.mode), C = 2 * Math.PI * 150; if (tm) tm.textContent = fmt(r); if (ring) ring.style.strokeDashoffset = C * (1 - r / tot); };
  unsub && unsub();
  unsub = onTimer(ev => {
    if (ev === 'tick') upd();
    else if (ev === 'egg67') {
      if (T.mode === 'focus') show67Normal();
      else if (!document.querySelector('.modal')) toast('6️⃣7️⃣ وصلت 67! حتى الاستراحة دخلت الميم 😂');
      window.__refresh();
    } else if (!document.querySelector('.modal')) window.__refresh();
  });
  $('#tTask', el).onchange = e => { const tk = get('tasks', e.target.value); link({ taskId: e.target.value, minutes: tk && tk.minutes || 0 }); window.__refresh(); };
  $('#tSub', el).onchange = e => { link({ subjectId: e.target.value }); window.__refresh(); };
  $('#tVol', el).oninput = e => { const v = Number(e.target.value); setVolume(v); setProfile({ volume: v }); };
}
export function unmount() { unsub && unsub(); unsub = null; }
export function keys(e) {
  if (e.key === ' ') { e.preventDefault(); toggle(); window.__refresh(); return true; }
  if (e.key === 'r' || e.key === 'R' || e.key === 'ق') { reset(); window.__refresh(); return true; }
  if (e.key === 'n' || e.key === 'N' || e.key === 'ى') { skip(); window.__refresh(); return true; }
  if (e.key === 'f' || e.key === 'F' || e.key === 'ب') { openZen(); return true; }
}
function openZen() {
  const z = document.createElement('div'); z.className = 'zen'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'وضع الصفاء');
  const draw = () => { z.innerHTML = html`<div class="xs" style="opacity:.6;letter-spacing:.1em">${MODES[T.mode]}</div><div class="time">${fmt(remaining())}</div><p class="quote">${pick(QUOTES)}</p><div class="row" style="justify-content:center"><button class="btn" data-z="t">${icon(T.running ? 'pause' : 'play')}${T.running ? 'إيقاف مؤقت' : 'ابدأ'}</button><button class="btn" data-z="x">${icon('x')}خروج (Esc)</button></div>`.s; };
  draw(); document.body.appendChild(z);
  try { z.requestFullscreen && z.requestFullscreen().catch(() => {}); } catch (e) {}
  const off = onTimer(ev => {
    if (ev === 'tick') { const t = z.querySelector('.time'); t && (t.textContent = fmt(remaining())); }
    else if (ev === 'egg67') {
      z.classList.add('egg67-zen');
      const q = z.querySelector('.quote');
      if (q) q.innerHTML = '<b style="font-size:clamp(42px,10vw,88px);letter-spacing:-5px">6️⃣7️⃣</b><br><span style="font-size:24px;font-weight:900">SIX SEVEN! 🗣️</span><br><small>حتى وضع الصفاء دخل الميم 😂</small>';
      try { z.animate([{ transform:'scale(1)' },{ transform:'scale(1.06)' },{ transform:'scale(1)' }], { duration:700, easing:'ease-out' }); } catch (e) {}
    } else draw();
  });
  const close = () => { off(); z.remove(); document.removeEventListener('keydown', k, true); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} window.__refresh(); };
  const k = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); draw(); } };
  document.addEventListener('keydown', k, true);
  z.addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; if (b.dataset.z === 'x') close(); else { toggle(); draw(); } });
}
