import { html, raw, today, addDays, fmtMin, DAYS_SHORT, DAYS, dobj, niceDate, shortDate } from '../util.js';
import { icon } from '../icons.js';
import { all, profile, subject } from '../store.js';
import { period, lastDays, heat, level, achievements, streak, bestStreak, exams, subName, focusSessions } from '../logic.js';
import { avg, bySubject, overall, rating } from './grades.js';
import { intro } from '../parts.js';
import { act, toast } from '../ui.js';

export const title = 'الإحصائيات';
function delta(a, b) { if (!b) return a ? html`<span class="d up">جديد</span>` : ''; const p = Math.round((a - b) / b * 100); return p === 0 ? html`<span class="d muted">كما هو</span>` : html`<span class="d ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%</span>`; }
function tips(cur, prev) {
  const out = [], t = today();
  const late = all('tasks').filter(x => !x.done && x.due && x.due < t).length;
  if (late) out.push(`لديك ${late} ${late > 2 && late < 11 ? 'مهام متأخرة' : 'مهمة متأخرة'}. خصص أول جلسة غداً لإنهائها.`);
  const ex = exams(21).find(e => !all('tasks').some(x => x.examId === e.id));
  if (ex) out.push(`اختبار «${ex.title}» بعد ${ex.left} يوم بلا خطة مراجعة — أنشئ خطة من صفحة الاختبارات.`);
  const subs = all('subjects').filter(s => !cur.bySub[s.id]);
  if (subs.length && subs.length < all('subjects').length) out.push(`لم تركّز هذا الأسبوع على: ${subs.slice(0, 3).map(s => s.name).join('، ')}.`);
  if (cur.focus < prev.focus && prev.focus) out.push('تركيزك أقل من الأسبوع الماضي. جلستان قصيرتان يومياً تعيدانك للمسار.');
  if (cur.active >= 6) out.push('نشاط في ' + cur.active + ' أيام من 7 — التزام رائع، حافظ عليه.');
  if (!out.length) out.push('ابدأ بجلسة تركيز واحدة يومياً، وسنعرض لك هنا ملاحظات مخصصة.');
  return out.slice(0, 4);
}
export function reportText() {
  const cur = period(lastDays(7)), prev = period(lastDays(7, addDays(today(), -7))), p = profile();
  const top = Object.entries(cur.bySub).filter(([k]) => k !== '_').sort((a, b) => b[1] - a[1])[0];
  const best = cur.perDay.slice().sort((a, b) => b.m - a.m)[0];
  return [`تقرير جدولي الأسبوعي${p.name ? ' — ' + p.name : ''}`, `${shortDate(addDays(today(), -6))} إلى ${shortDate(today())}`, '',
    `• التركيز: ${fmtMin(cur.focus)} (الأسبوع السابق ${fmtMin(prev.focus)})`, `• مهام منجزة: ${cur.tasks}`, `• أيام نشطة: ${cur.active} من 7`, `• عادات محققة: ${cur.habits}`,
    `• بطاقات علوم: ${cur.cards} · اختبارات: ${cur.quizzes}`, top ? `• أكثر مادة: ${subName(top[0])} (${fmtMin(top[1])})` : '', best && best.m ? `• أفضل يوم: ${DAYS[dobj(best.d).getDay()]} (${fmtMin(best.m)})` : '',
    overall() != null ? `• المعدل العام: ${Math.round(overall() * 10) / 10}%` : '',
    `• السلسلة الحالية: ${streak()} يوم · المستوى ${level().lv}`].filter(x => x !== '').join('\n');
}
act('copyReport', async () => { try { await navigator.clipboard.writeText(reportText()); toast('نُسخ التقرير — الصقه أينما تريد'); } catch (e) { toast('تعذّر النسخ، حدّد النص يدوياً'); } });

export function render() {
  const days = lastDays(7), cur = period(days), prev = period(lastDays(7, addDays(today(), -7)));
  const mx = Math.max(30, ...cur.perDay.map(x => x.m)), lv = level(), ach = achievements(), got = ach.filter(a => a.got).length;
  const hm = heat(18), subs = Object.entries(period(lastDays(30)).bySub).sort((a, b) => b[1] - a[1]), smax = Math.max(1, ...subs.map(s => s[1]));
  const lvl = m => m === 0 ? 0 : m < 25 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
  return html`${intro('الإحصائيات', 'آخر 7 أيام مقارنة بالأسبوع الذي قبله')}
  <div class="kpis">
    <div class="kpi" style="--c:var(--focus)"><div class="l">${icon('focus')}التركيز</div><b class="num">${fmtMin(cur.focus)}</b>${delta(cur.focus, prev.focus)}</div>
    <div class="kpi"><div class="l">${icon('tasks')}مهام منجزة</div><b class="num">${cur.tasks}</b>${delta(cur.tasks, prev.tasks)}</div>
    <div class="kpi" style="--c:var(--danger)"><div class="l">${icon('flame')}السلسلة</div><b class="num">${streak()} يوم</b><span class="d muted">الأفضل ${bestStreak()}</span></div>
    <div class="kpi" style="--c:var(--sci)"><div class="l">${icon('star')}المستوى ${lv.lv}</div><b>${lv.name}</b><div class="bar" style="--p:${lv.pct}%;--c:var(--sci);margin-top:6px"><i></i></div><span class="d muted num">${lv.into}/${lv.need} للمستوى التالي</span></div>
  </div>
  <div class="grid g3">
    <section class="card span2"><div class="card-head"><h2 style="--c:var(--focus)">${icon('stats')}دقائق التركيز يومياً</h2></div>
      <div class="bars">${cur.perDay.map(x => html`<div class="b ${x.d === today() ? 'today' : ''}"><small class="num">${x.m ? fmtMin(x.m) : ''}</small><i style="--h:${Math.round(x.m / mx * 100)}%"></i><span>${DAYS_SHORT[dobj(x.d).getDay()]}</span></div>`)}</div></section>
    <section class="card"><div class="card-head"><h2>${icon('sparkle')}ملاحظات لك</h2></div><div class="tips">${tips(cur, prev).map(t => html`<div>${icon('bolt')}<span>${t}</span></div>`)}</div></section>
    <section class="card span2"><div class="card-head"><h2 style="--c:var(--focus)">${icon('week')}خريطة النشاط</h2><span class="more">آخر 18 أسبوعاً</span></div>
      <div class="heat" role="img" aria-label="خريطة التركيز اليومي">${hm.map(x => html`<i data-l="${x.m ? lvl(x.m) : x.a ? 1 : 0}" class="${x.d === today() ? 't' : ''}" title="${niceDate(x.d)}: ${fmtMin(x.m)}"></i>`)}</div>
      <div class="row xs muted" style="margin-top:8px;gap:6px">أقل <span class="heat" style="display:flex;grid-template-rows:none"><i></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i></span> أكثر</div></section>
    <section class="card"><div class="card-head"><h2>${icon('book')}حسب المادة</h2><span class="more">30 يوماً</span></div>
      ${subs.length ? html`<div class="stack">${subs.slice(0, 7).map(([k, m]) => { const s = subject(k); return html`<div class="hbar"><span>${s ? s.name : 'بدون مادة'}</span><div class="bar" style="--p:${m / smax * 100}%;--c:${s ? s.color : 'var(--muted)'}"><i></i></div><span class="num xs muted">${fmtMin(m)}</span></div>`; })}</div>` : html`<p class="small muted">اربط جلسات التركيز بمادة لترى التوزيع هنا.</p>`}</section>
    ${hoursCard()}
    ${gradesCard()}
    ${curveCard()}
    <section class="card span2"><div class="card-head"><h2>${icon('trophy')}الإنجازات</h2><span class="more">${got}/${ach.length}</span></div>
      <div class="ach">${ach.map(a => html`<div class="${a.got ? 'got' : ''}"><span class="ai">${icon(a.icon)}</span><b>${a.title}</b><span>${a.desc}</span></div>`)}</div></section>
    <section class="card"><div class="card-head"><h2>${icon('note')}التقرير الأسبوعي</h2><button class="more" data-act="copyReport">${icon('copy')}نسخ</button></div><div class="report">${reportText()}</div></section>
  </div>`;
}

/* متى تركّز أكثر؟ توزيع دقائق التركيز على فترات اليوم (آخر 30 يوماً) */
const SLOTS = [['الفجر والصباح الباكر', 4, 8, 'sun'], ['الصباح', 8, 12, 'sun'], ['الظهر', 12, 16, 'today'], ['العصر والمغرب', 16, 20, 'clock'], ['الليل', 20, 28, 'moon']];
function hoursCard() {
  const from = addDays(today(), -29), ss = focusSessions().filter(x => x.day >= from);
  const v = SLOTS.map(([l, a, b, ic]) => ({ l, ic, m: ss.filter(x => { let h = new Date(x.start).getHours(); if (h < 4) h += 24; return h >= a && h < b; }).reduce((q, x) => q + (x.minutes || 0), 0), n: ss.filter(x => { let h = new Date(x.start).getHours(); if (h < 4) h += 24; return h >= a && h < b; }).length }));
  const mx = Math.max(1, ...v.map(x => x.m)), best = v.slice().sort((a, b) => b.m - a.m)[0];
  const avgLen = ss.length ? Math.round(ss.reduce((q, x) => q + x.minutes, 0) / ss.length) : 0;
  return html`<section class="card span2"><div class="card-head"><h2 style="--c:var(--focus)">${icon('clock')}متى تركّز أكثر؟</h2><span class="more">30 يوماً</span></div>
    ${ss.length ? html`<div class="slots">${v.map(x => html`<div class="slot ${x === best && x.m ? 'best' : ''}"><div class="sb"><i style="--h:${Math.round(x.m / mx * 100)}%"></i></div><b class="num">${fmtMin(x.m)}</b><span>${x.l}</span></div>`)}</div>
      <p class="small muted" style="margin-top:12px">أفضل فتراتك: <b style="color:var(--ink)">${best.l}</b>. متوسط الجلسة ${avgLen} دقيقة. ضع أصعب مهامك في هذه الفترة.</p>`
      : html`<p class="small muted">أكمل بعض جلسات التركيز لنكتشف معاً الوقت الذي تكون فيه في أفضل حالاتك.</p>`}
  </section>`;
}
function gradesCard() {
  const m = bySubject(), ov = overall(), r = rating(ov), subs = all('subjects').filter(s => m[s.id]).map(s => [s, avg(m[s.id])]).sort((a, b) => b[1] - a[1]);
  return html`<section class="card"><div class="card-head"><h2 style="--c:var(--danger)">${icon('grade')}العلامات</h2><a class="more" href="#/grades">التفاصيل ${icon('chevL')}</a></div>
    ${subs.length ? html`<div class="row" style="gap:10px;margin-bottom:12px"><b class="num" style="font-family:var(--font-display);font-size:var(--text-xl)">${Math.round(ov * 10) / 10}%</b><span class="chip" style="color:${r.c}">${r.t}</span></div>
      <div class="stack">${subs.map(([s, a]) => html`<div class="hbar"><span>${s.name}</span><div class="bar" style="--p:${a}%;--c:${s.color}"><i></i></div><span class="num xs muted">${Math.round(a)}%</span></div>`)}</div>`
      : html`<p class="small muted">سجّل علاماتك لترى معدلك هنا.</p><a class="btn sm" href="#/grades" style="margin-top:10px">${icon('plus')}تسجيل علامة</a>`}
  </section>`;
}

/* منحنى الإنجاز: المهام والعادات المنجزة آخر 7 أيام */
function curveCard() {
  const days = lastDays(7), tk = days.map(d => all('tasks').filter(t => t.done && t.doneAt === d).length), hb = days.map(d => all('habits').filter(h => (h.days || {})[d]).length);
  const tot = days.map((_, i) => tk[i] + hb[i]), mx = Math.max(2, ...tk, ...hb), W = 600, H = 150, px = i => 20 + i * (W - 40) / 6, py = v => H - 14 - v / mx * (H - 34);
  const line = a => a.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
  const best = tot.indexOf(Math.max(...tot)), sum = tot.reduce((a, b) => a + b, 0);
  return html`<section class="card span3-lite curve"><div class="card-head"><h2 style="--c:var(--ok)">${icon('stats')}منحنى الإنجاز</h2><span class="more">آخر 7 أيام · المهام والعادات</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="منحنى الإنجاز">
      ${raw([0, .5, 1].map(f => `<line x1="20" x2="${W - 20}" y1="${py(mx * f)}" y2="${py(mx * f)}" stroke="var(--line)" stroke-dasharray="3 5"/>`).join(''))}
      ${raw(`<path d="${line(tk)} L ${px(6)} ${H - 14} L ${px(0)} ${H - 14} Z" fill="color-mix(in oklab, var(--accent) 12%, transparent)"/>`)}
      ${raw(`<path d="${line(tk)}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`)}
      ${raw(`<path d="${line(hb)}" fill="none" stroke="var(--ok)" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`)}
    </svg>
    <div class="row" style="justify-content:space-between;padding:0 6px">${days.map((d, i) => html`<span class="xs ${i === best && tot[i] ? '' : 'muted'}" style="${i === best && tot[i] ? 'font-weight:700;color:var(--ink)' : ''}">${DAYS_SHORT[dobj(d).getDay()]}</span>`)}</div>
    <div class="lg"><span><i style="background:var(--accent)"></i>مهام منجزة (${tk.reduce((a, b) => a + b, 0)})</span><span><i style="background:var(--ok)"></i>عادات (${hb.reduce((a, b) => a + b, 0)})</span><span class="grow"></span><span>معدل الإنجاز ${Math.round(sum / 7 * 10) / 10} يومياً${sum ? ' · أفضل يوم: ' + DAYS[dobj(days[best]).getDay()] : ''}</span></div>
  </section>`;
}
