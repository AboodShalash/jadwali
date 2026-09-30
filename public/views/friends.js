/* الأصدقاء: مقارنة تقدّم ودّية (تركيز الأسبوع، السلسلة، النقاط) — تُشارَك أرقام مجمّعة فقط مع أصدقاء وافقوا */
import { html, fmtMin, $ } from '../util.js';
import { icon } from '../icons.js';
import { apiFetch, sync, profile } from '../store.js';
import { focusRange, lastDays, streak, level } from '../logic.js';
import { intro } from '../parts.js';
import { act, toast, confirmBox } from '../ui.js';
import { accountModal } from './settings.js';

export const title = 'الأصدقاء';
const METRICS = { week_min: ['تركيز الأسبوع', v => fmtMin(v)], streak: ['السلسلة', v => v + (v === 1 ? ' يوم' : ' أيام')], xp: ['النقاط', v => v + ' نقطة'] };
let metric = 'week_min', data = null, err = '';

const mine = () => { const l = level(); return { week_min: focusRange(lastDays(7)), streak: streak(), xp: l.total, lvl: l.lv }; };
const isGuest = () => !sync.user || sync.user.guest;

async function load() {
  err = '';
  try {
    if (isGuest()) { data = null; return; }
    await apiFetch('/friends/me', { method: 'PUT', body: JSON.stringify(mine()) });
    data = await apiFetch('/friends');
  } catch (e) { data = null; err = e.status === 403 ? '' : (e.message || 'تعذّر الاتصال بالخادم'); }
}
function board() {
  const me = Object.assign({ id: 0, name: profile().name || (sync.user && sync.user.name) || 'أنا', me: true }, mine());
  const rows = [me].concat(data.friends).sort((a, b) => b[metric] - a[metric] || b.xp - a.xp);
  const top = Math.max(1, rows[0][metric]);
  return html`<div class="seg" role="tablist">${Object.entries(METRICS).map(([k, [l]]) => html`<button class="${metric === k ? 'on' : ''}" data-act="frMetric" data-m="${k}" role="tab" aria-selected="${metric === k}">${l}</button>`)}</div>
  <ol class="lb">${rows.map((r, i) => html`<li class="${r.me ? 'me' : ''}"><span class="rk num">${i + 1}</span><div class="grow"><div class="row"><b>${r.me ? 'أنت' : r.name}</b><span class="xs muted">المستوى ${r.lvl}${r.me ? '' : ' · @' + r.username}</span></div><div class="bar" style="--p:${Math.round(r[metric] / top * 100)}%"><i></i></div></div><b class="num">${METRICS[metric][1](r[metric])}</b>${r.me ? '' : html`<button class="icon-btn sm" data-act="frRemove" data-id="${r.id}" data-n="${r.name}" aria-label="إزالة الصديق">${icon('x')}</button>`}</li>`)}</ol>`;
}
function body() {
  if (isGuest()) return html`<section class="card empty-friends"><h3>سجّل حساباً لتضيف أصدقاء</h3><p class="muted">تحتاج حساباً (اسم مستخدم وكلمة مرور) ليتمكن أصدقاؤك من إيجادك. لا نشارك إلا أرقاماً مجمّعة: دقائق التركيز والسلسلة والنقاط.</p><button class="btn primary" data-act="frAccount">${icon('plus')}إنشاء حساب</button></section>`;
  if (err) return html`<section class="card"><p class="muted">${err}</p><button class="btn sm" data-act="frReload">${icon('repeat')}إعادة المحاولة</button></section>`;
  if (!data) return html`<section class="card"><p class="muted">جارٍ التحميل…</p></section>`;
  return html`<section class="card"><h3>ترتيب الأصدقاء</h3>${data.friends.length ? board() : html`<p class="muted">لا أصدقاء بعد. أضف صديقاً باسم المستخدم ليظهر ترتيبكما هنا.</p>`}</section>
  <section class="card"><h3>إضافة صديق</h3><form class="row" id="frAdd"><input class="input grow" name="u" placeholder="اسم مستخدم صديقك" autocomplete="off" dir="ltr" maxlength="32" required aria-label="اسم المستخدم"><button class="btn primary">${icon('plus')}إرسال طلب</button></form>
    ${data.incoming.length ? html`<h4 class="small muted" style="margin-top:14px">طلبات واردة</h4>${data.incoming.map(r => html`<div class="row fr-req"><b class="grow">${r.name} <span class="xs muted">@${r.username}</span></b><button class="btn sm primary" data-act="frAccept" data-id="${r.id}">${icon('check')}قبول</button><button class="btn sm ghost" data-act="frRemove" data-id="${r.id}" data-n="${r.name}">رفض</button></div>`)}` : ''}
    ${data.outgoing.length ? html`<h4 class="small muted" style="margin-top:14px">بانتظار الموافقة</h4>${data.outgoing.map(r => html`<div class="row fr-req"><span class="grow">${r.name} <span class="xs muted">@${r.username}</span></span><button class="btn sm ghost" data-act="frRemove" data-id="${r.id}" data-n="${r.name}">إلغاء</button></div>`)}` : ''}</section>
  <p class="xs muted">يرى أصدقاؤك المقبولون فقط: اسمك واسم المستخدم ودقائق تركيزك آخر 7 أيام وسلسلتك ونقاطك. لا جدول ولا مهام ولا علامات.</p>`;
}
const paint = () => { const el = $('#frBody'); if (el) { el.innerHTML = body().s; const f = $('#frAdd'); if (f) f.onsubmit = add; } };
async function add(e) {
  e.preventDefault(); const u = e.target.u.value.trim().replace(/^@/, ''); if (!u) return;
  try { const r = await apiFetch('/friends/request', { method: 'POST', body: JSON.stringify({ username: u }) }); toast(r.accepted ? 'صرتما أصدقاء!' : 'أُرسل الطلب'); await load(); paint(); }
  catch (x) { toast(x.message || 'تعذّر إرسال الطلب'); }
}
act('frMetric', el => { metric = el.dataset.m; paint(); });
act('frAccount', () => accountModal());
act('frReload', async () => { await load(); paint(); });
act('frAccept', async el => { try { await apiFetch('/friends/accept/' + el.dataset.id, { method: 'POST' }); await load(); paint(); toast('صرتما أصدقاء'); } catch (x) { toast(x.message); } });
act('frRemove', async el => { if (!(await confirmBox('إزالة ' + el.dataset.n + ' من قائمة الأصدقاء؟', { ok: 'إزالة', danger: true }))) return; try { await apiFetch('/friends/' + el.dataset.id, { method: 'DELETE' }); await load(); paint(); } catch (x) { toast(x.message); } });

export function render() {
  return html`${intro('الأصدقاء', 'قارن تقدّمك بأصدقائك بشكل ودّي ولا تدع أحداً يدرس وحده')}<div id="frBody">${body()}</div>`;
}
export async function mount() { await load(); paint(); }
