/* العلامات والمعدل: تسجيل العلامات، معدل موزون لكل مادة، اتجاه الأداء، وحاسبة «كم أحتاج؟» */
import { html, raw, today, niceDate, shortDate, $ } from '../util.js';
import { icon } from '../icons.js';
import { all, get, upsert, remove, restore, subject, KIND_W, profile } from '../store.js';
import { intro, ringSvg } from '../parts.js';
import { act, empty, modal, toast, formData, confetti } from '../ui.js';
import { subjectOptions } from '../forms.js';

export const title = 'العلامات';
export const KINDS = { quiz: 'اختبار قصير', monthly: 'اختبار شهري', final: 'اختبار نهائي', homework: 'واجب', project: 'مشروع أو تقرير', other: 'أخرى' };

export const pct = g => g.max > 0 ? g.score / g.max * 100 : 0;
export function avg(list) {
  let w = 0, s = 0;
  list.forEach(g => { const k = Number(g.weight) || 1; w += k; s += pct(g) * k; });
  return w ? s / w : null;
}
export function rating(p) {
  if (p == null) return { t: '—', c: 'var(--muted)' };
  if (p >= 90) return { t: 'ممتاز', c: 'var(--ok)' };
  if (p >= 80) return { t: 'جيد جداً', c: 'var(--focus)' };
  if (p >= 70) return { t: 'جيد', c: 'var(--sci)' };
  if (p >= (Number(profile().passMark) || 50)) return { t: 'مقبول', c: 'var(--accent)' };
  return { t: 'يحتاج دعماً', c: 'var(--danger)' };
}
export const bySubject = () => {
  const m = {}; all('grades').forEach(g => { (m[g.subjectId || ''] = m[g.subjectId || ''] || []).push(g); });
  Object.values(m).forEach(l => l.sort((a, b) => (a.date || '').localeCompare(b.date || '')));
  return m;
};
/* المعدل العام = متوسط معدلات المواد (كل مادة بوزن واحد) */
export function overall() {
  const m = bySubject(), vals = Object.keys(m).filter(k => k).map(k => avg(m[k])).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
const f1 = n => n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('en');

/* خط صغير يوضح اتجاه الأداء */
function spark(list, color) {
  if (list.length < 2) return '';
  const W = 120, H = 34, ps = list.map(pct), mn = Math.min(...ps, 60), mx = Math.max(...ps, 100);
  const pts = ps.map((p, i) => [i / (ps.length - 1) * W, H - 3 - (p - mn) / (mx - mn || 1) * (H - 6)]);
  // الاتجاه من اليمين لليسار ليوافق القراءة العربية
  const d = pts.map(([x, y]) => `${(W - x).toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return raw(`<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${(W - lx).toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="${color}"/></svg>`);
}
function trend(list) {
  if (list.length < 2) return null;
  const a = pct(list[list.length - 1]), b = avg(list.slice(0, -1));
  return a - b;
}

export function gradeModal(g = {}) {
  const isNew = !g.id;
  g = Object.assign({ subjectId: (all('subjects')[0] || {}).id || '', title: '', kind: 'quiz', score: '', max: 20, weight: '', date: today() }, g);
  const m = modal(html`<form class="form">
    <div class="grid g2" style="gap:12px">
      <label class="field"><span>المادة</span><select name="subjectId" required>${subjectOptions(g.subjectId, 'اختر المادة')}</select></label>
      <label class="field"><span>النوع</span><select name="kind">${Object.entries(KINDS).map(([k, v]) => html`<option value="${k}" ${k === g.kind ? raw('selected') : ''}>${v}</option>`)}</select></label>
    </div>
    <label class="field"><span>العنوان</span><input name="title" maxlength="60" value="${g.title}" placeholder="مثال: الاختبار الشهري الأول"></label>
    <div class="grid g3" style="gap:12px">
      <label class="field"><span>علامتك</span><input name="score" type="number" step="0.25" min="0" required value="${g.score}" autofocus inputmode="decimal"></label>
      <label class="field"><span>من</span><input name="max" type="number" step="0.25" min="1" required value="${g.max}" inputmode="decimal"></label>
      <label class="field"><span>الوزن</span><input name="weight" type="number" step="0.25" min="0.25" value="${g.weight}" placeholder="تلقائي"></label>
    </div>
    <label class="field"><span>التاريخ</span><input name="date" type="date" value="${g.date}"></label>
    <p class="xs muted" id="gPrev"></p>
    <div class="form-actions">${!isNew ? html`<button type="button" class="btn ghost spacer" id="delG">${icon('trash')}حذف</button>` : ''}<button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary">${isNew ? 'تسجيل' : 'حفظ'}</button></div>
  </form>`, { title: isNew ? 'تسجيل علامة' : 'تعديل العلامة' });
  const f = m.body.querySelector('form'), prev = $('#gPrev', m.body);
  const upd = () => { const d = formData(f), s = Number(d.score), mx = Number(d.max); if (d.score !== '' && mx > 0) { const p = s / mx * 100, r = rating(p); prev.innerHTML = html`النسبة: <b class="num">${f1(p)}%</b> · <span style="color:${r.c};font-weight:700">${r.t}</span> · الوزن ${d.weight || KIND_W[d.kind] || 1}`.s; } else prev.textContent = 'الوزن التلقائي: الشهري ×2، النهائي ×4، الواجب ×0.5، والباقي ×1'; };
  f.addEventListener('input', upd); upd();
  const del = $('#delG', m.body);
  if (del) del.onclick = () => { m.close(); const old = remove('grades', g.id); window.__refresh(); toast('حُذفت العلامة', { action: 'تراجع', onAction: () => { restore('grades', old); window.__refresh(); } }); };
  f.onsubmit = e => {
    e.preventDefault(); const d = formData(f), score = Number(d.score), max = Number(d.max);
    if (!(max > 0) || score < 0) return;
    if (score > max && !confirm('العلامة أكبر من العلامة الكاملة، هل تريد المتابعة؟')) return;
    const before = avg(all('grades').filter(x => x.subjectId === d.subjectId && x.id !== g.id));
    const rec = upsert('grades', Object.assign({}, isNew ? {} : get('grades', g.id), { id: g.id, subjectId: d.subjectId, kind: d.kind, title: d.title.trim() || KINDS[d.kind], score, max, weight: Number(d.weight) || KIND_W[d.kind] || 1, date: d.date || today(), eventId: g.eventId || '' }));
    m.close();
    const p = pct(rec), after = avg(all('grades').filter(x => x.subjectId === d.subjectId));
    if (p >= 95) confetti(70);
    const s = subject(d.subjectId);
    toast(before == null ? `سُجّلت: ${f1(p)}% في ${s ? s.name : 'المادة'}` : `معدل ${s ? s.name : 'المادة'}: ${f1(after)}% (${after >= before ? '+' : ''}${f1(after - before)})`);
    window.__refresh();
  };
}

act('newGrade', el => gradeModal(el && el.dataset.s ? { subjectId: el.dataset.s } : el && el.dataset.ev ? (() => { const e = get('events', el.dataset.ev); return e ? { subjectId: e.subjectId, title: e.title, kind: /شهري/.test(e.title) ? 'monthly' : /نهائي/.test(e.title) ? 'final' : 'quiz', date: el.dataset.on || e.date, eventId: e.id } : {}; })() : {}));
act('editGrade', el => { const g = get('grades', el.dataset.id); g && gradeModal(g); });
act('gSub', el => { F.s = el.dataset.s === F.s ? '' : el.dataset.s; window.__refresh(); });

const F = { s: '' };
let calc = { s: '', target: 90, max: 40, kind: 'monthly' };

/* كم أحتاج في الاختبار القادم لأصل إلى الهدف؟ */
function needed() {
  const list = all('grades').filter(g => g.subjectId === calc.s);
  const w = Number(KIND_W[calc.kind]) || 1, target = Number(calc.target), max = Number(calc.max) || 1;
  let W = 0, S = 0; list.forEach(g => { const k = Number(g.weight) || 1; W += k; S += pct(g) * k; });
  const need = (target * (W + w) - S) / w; // النسبة المطلوبة
  return { need, score: need / 100 * max, max, cur: W ? S / W : null };
}
function calcBox() {
  const subs = all('subjects'); if (!calc.s || !subject(calc.s)) calc.s = (subs[0] || {}).id || '';
  const r = needed(), n = r.need;
  const verdict = !subs.length ? '' : n <= 0 ? html`<b style="color:var(--ok)">هدفك مضمون</b> — حتى لو لم تحصل على شيء، يبقى معدلك فوق ${calc.target}%.`
    : n > 100 ? html`<b style="color:var(--danger)">صعب في اختبار واحد</b> — تحتاج ${f1(n)}%. جرّب هدفاً أقرب أو اعتمد على أكثر من اختبار.`
    : html`تحتاج <b class="num" style="color:var(--accent);font-size:var(--text-lg)">${f1(r.score)}</b> من <span class="num">${r.max}</span> (<span class="num">${f1(n)}%</span>) لتصل إلى ${calc.target}%.`;
  return html`<section class="card" id="calcCard">
    <div class="card-head"><h2 style="--c:var(--accent)">${icon('calc')}كم أحتاج؟</h2><span class="more">${r.cur != null ? 'معدلك الحالي ' + f1(r.cur) + '%' : ''}</span></div>
    ${subs.length ? html`<div class="calc">
      <label class="field"><span>المادة</span><select data-change="calc" name="s">${subs.map(s => html`<option value="${s.id}" ${s.id === calc.s ? raw('selected') : ''}>${s.name}</option>`)}</select></label>
      <label class="field"><span>الاختبار القادم</span><select data-change="calc" name="kind">${Object.entries(KINDS).map(([k, v]) => html`<option value="${k}" ${k === calc.kind ? raw('selected') : ''}>${v}</option>`)}</select></label>
      <label class="field"><span>علامته الكاملة</span><input data-change="calc" name="max" type="number" min="1" value="${calc.max}"></label>
      <label class="field"><span>هدفك للمعدل: <b class="num" id="tgtV">${calc.target}%</b></span><input data-input="calcT" data-change="calc" name="target" type="range" min="50" max="100" step="1" value="${calc.target}"></label>
    </div>
    <p class="calc-out" id="calcOut">${verdict}</p>` : empty('calc', 'أضف مادة أولاً', 'الحاسبة تعمل على علامات موادك.')}
  </section>`;
}
act('calc', el => { calc[el.name] = el.value; const c = $('#calcCard'); if (c) c.outerHTML = calcBox().s; });
act('calcT', el => { const v = $('#tgtV'); v && (v.textContent = el.value + '%'); });

export function render() {
  const m = bySubject(), subs = all('subjects').filter(s => m[s.id]), ov = overall(), r = rating(ov);
  const gs = all('grades').slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.u - a.u);
  const list = F.s ? gs.filter(g => g.subjectId === F.s) : gs;
  const best = subs.slice().sort((a, b) => avg(m[b.id]) - avg(m[a.id]));
  const count = gs.length;
  return html`${intro('العلامات والمعدل', count ? 'معدل موزون لكل مادة، اتجاه أدائك، وكم تحتاج لتصل إلى هدفك' : 'سجّل علاماتك لترى معدلك واتجاه أدائك في كل مادة', html`<button class="btn primary" data-act="newGrade">${icon('plus')}تسجيل علامة</button>`)}
  ${count ? html`
  <div class="grade-hero card">
    <div class="gh-ring">${ringSvg((ov || 0) / 100, 132, 12, r.c)}<div><b class="num">${f1(ov)}</b><span>المعدل العام</span></div></div>
    <div class="grow">
      <div class="chip" style="background:color-mix(in oklab, ${r.c} 16%, transparent);color:${r.c}">${r.t}</div>
      <h3 style="margin:8px 0 4px;font-size:var(--text-lg)">${best.length ? html`أقوى مادة: ${best[0].name}` : ''}</h3>
      <p class="small muted">${best.length > 1 ? html`تحتاج اهتماماً أكثر: <b>${best[best.length - 1].name}</b> (${f1(avg(m[best[best.length - 1].id]))}%). جرّب جلسة تركيز إضافية عليها هذا الأسبوع.` : 'سجّل علامات مواد أخرى لتقارن بينها.'}</p>
      <div class="row" style="gap:18px;margin-top:12px;flex-wrap:wrap"><span class="small"><b class="num">${count}</b> علامة</span><span class="small"><b class="num">${subs.length}</b> مواد</span><span class="small">أعلى علامة <b class="num">${f1(Math.max(...gs.map(pct)))}%</b></span></div>
    </div>
    ${best.length > 1 ? html`<a class="btn sm" href="#/focus?s=${best[best.length - 1].id}">${icon('play')}ركّز على ${best[best.length - 1].name}</a>` : ''}
  </div>
  <div class="grid gauto" style="margin-top:18px">${subs.map(s => { const l = m[s.id], a = avg(l), rr = rating(a), tr = trend(l); return html`<section class="card gsub ${F.s === s.id ? 'sel' : ''}" style="--c:${s.color}" data-act="gSub" data-s="${s.id}" role="button" tabindex="0" aria-pressed="${F.s === s.id}">
    <div class="row"><span class="dot"></span><h3 class="grow">${s.name}</h3>${tr != null ? html`<span class="xs num" style="color:${tr >= 0 ? 'var(--ok)' : 'var(--danger)'};font-weight:700">${tr >= 0 ? '▲' : '▼'} ${f1(Math.abs(tr))}</span>` : ''}</div>
    <div class="row" style="align-items:flex-end;margin-top:8px"><div class="grow"><b class="gavg num">${f1(a)}<small>%</small></b><div class="xs" style="color:${rr.c};font-weight:700">${rr.t} · ${l.length} ${l.length === 1 ? 'علامة' : 'علامات'}</div></div>${spark(l, s.color)}</div>
    <div class="bar" style="--p:${Math.min(100, a || 0)}%;--c:${s.color};margin-top:10px"><i></i></div>
  </section>`; })}</div>
  <div class="grid g2 gl" style="margin-top:18px">
    <section class="card">
      <div class="card-head"><h2>${icon('grade')}${F.s ? 'علامات ' + (subject(F.s) || {}).name : 'كل العلامات'}</h2>${F.s ? html`<button class="more" data-act="gSub" data-s="${F.s}">عرض الكل ${icon('x')}</button>` : ''}</div>
      <div class="glist">${list.map(g => { const s = subject(g.subjectId), p = pct(g), rr = rating(p); return html`<button class="grow-row" data-act="editGrade" data-id="${g.id}" style="--c:${s ? s.color : 'var(--muted)'}">
        <span class="gp num" style="color:${rr.c}">${f1(p)}%</span>
        <span class="grow"><b>${g.title}</b><small>${s ? s.name : '—'} · ${KINDS[g.kind] || ''} · ${shortDate(g.date)}${Number(g.weight) !== 1 ? ' · ×' + g.weight : ''}</small></span>
        <span class="num gs">${f1(g.score)}/${f1(g.max)}</span></button>`; })}</div>
    </section>
    ${calcBox()}
  </div>` : html`<div class="grid g2 gl"><section class="card">${empty('grade', 'لا علامات بعد', 'بعد كل اختبار أو واجب سجّل علامتك في ثوانٍ، وسنحسب لك المعدل الموزون ونخبرك أين تحتاج جهداً أكثر.', html`<button class="btn primary sm" data-act="newGrade">${icon('plus')}تسجيل أول علامة</button>`)}</section>${calcBox()}</div>`}`;
}
export function mount(el) {
  el.querySelectorAll('.gsub').forEach(c => c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } }));
}
