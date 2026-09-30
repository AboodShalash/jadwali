import { fromMin, html, raw, today, niceDate, DAYS, MONTHS, dobj, t12, nowHM, toMin, fmtMin, greeting, daySeed, addDays, $ } from '../util.js';
import { icon } from '../icons.js';
import { all, get, profile, subject, upsert, remove } from '../store.js';
import { openAssistant } from '../assistant.js';
import { eventsOn, upcoming, focusOn, streak, level, exams, cardDue, parseTask, lastDays, achievements, REPEATS, dayPlan } from '../logic.js';
import { DAYS_SHORT } from '../util.js';
import { taskRow, sortTasks, ringSvg } from '../parts.js';
import { empty, act, toast } from '../ui.js';
import { FACTS, TERMS, lesson as sciLesson, branch as sciBranch } from '../science-data.js';
import { TIPS } from './science.js';
import { PRI } from '../forms.js';

export const title = 'اليوم';
let planOff = 0;
act('planDay', el => { planOff = Number(el.dataset.v) || 0; window.__refresh(); });
act('planToWeek', el => {
  const d = el.dataset.d, pl = dayPlan(d); if (!pl.blocks.length) return;
  const ex = eventsOn(d).filter(e => e.planned).map(e => e.start);
  const made = pl.blocks.filter(b => !ex.includes(fromMin(b.start))).map(b => upsert('events', { title: b.title, type: 'review', date: d, start: fromMin(b.start), end: fromMin(b.end), subjectId: b.subjectId || '', repeat: 'none', planned: true, notes: b.why }));
  window.__refresh();
  toast(made.length ? `أُضيفت ${made.length} ${made.length === 1 ? 'جلسة مراجعة' : 'جلسات مراجعة'} إلى جدول ${niceDate(d)}` : 'الخطة موجودة في الجدول مسبقاً', made.length ? { action: 'تراجع', onAction: () => { made.forEach(e => remove('events', e.id)); window.__refresh(); } } : {});
});
act('askBot', el => openAssistant(el.dataset.q || ''));
function countdown(e) {
  const now = new Date(), [h, m] = e.start.split(':').map(Number), t = dobj(e.on); t.setHours(h, m, 0, 0);
  const diff = Math.max(0, Math.round((t - now) / 60000));
  if (diff < 60) return 'بعد ' + diff + ' دقيقة';
  if (diff < 24 * 60) return 'بعد ' + fmtMin(diff);
  return niceDate(e.on) + ' ' + t12(e.start);
}
export function render() {
  const p = profile(), d = today(), dt = dobj(d), nm = nowHM();
  const evs = eventsOn(d), f = focusOn(d), goal = p.focusGoal || 120;
  const open = all('tasks').filter(t => !t.done);
  const due = sortTasks(open.filter(t => t.due && t.due <= d));
  const doneToday = all('tasks').filter(t => t.done && t.doneAt === d);
  const st = streak(), lv = level(), nx = upcoming(1)[0], cur = evs.find(e => e.start <= nm && e.end > nm);
  const ex = exams(60).slice(0, 3);
  const cards = TERMS.filter(tm => cardDue(all('cards').find(c => c.id === tm.id)) && all('cards').find(c => c.id === tm.id)).length;
  const fresh = TERMS.length - all('cards').length;
  const habits = all('habits'), hDone = habits.filter(h => h.days && h.days[d]).length;
  const fact = FACTS.length ? FACTS[daySeed(d) % FACTS.length] : '';
  const lead = due.length ? `لديك ${due.length === 1 ? 'مهمة واحدة' : due.length === 2 ? 'مهمتان' : due.length + ' مهام'} لليوم${evs.length ? ` و${evs.length === 1 ? 'حصة واحدة' : evs.length + ' حصص'} في الجدول` : ''}. خطوة صغيرة الآن أفضل من خطة كبيرة لاحقاً.`
    : evs.length ? `جدولك اليوم فيه ${evs.length === 1 ? 'حصة واحدة' : evs.length + ' حصص'} ولا مهام متأخرة. يوم مثالي لتقدّم إضافي.` : 'لا حصص ولا مهام مستحقة اليوم. استغل الوقت في مراجعة بطاقات العلوم أو جلسة تركيز.';

  return html`
  <section class="hero">
    <div>
      <div class="date">${DAYS[dt.getDay()]}، ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}</div>
      <h2>${greeting()}${p.name ? '، ' + p.name : ''}</h2>
      <p class="lead">${lead}</p>
      <div class="hero-stats">
        <div class="hs"><b class="num">${fmtMin(f)}</b><span>تركيز اليوم من ${fmtMin(goal)}</span></div>
        <div class="hs"><b class="num">${doneToday.length}</b><span>مهام أُنجزت اليوم</span></div>
        <div class="hs"><b class="num">${st}</b><span>أيام متتالية</span></div>
        <div class="hs"><b>${lv.name}</b><span>المستوى ${lv.lv} · ${lv.total} نقطة</span></div>
      </div>
    </div>
    <div class="next-box">
      ${cur ? html`<div><div class="lbl">الآن</div><h3>${cur.title}</h3><div class="small" style="opacity:.75">حتى ${t12(cur.end)}${cur.room ? ' · ' + cur.room : ''}</div></div>`
        : nx ? html`<div><div class="lbl">التالي في جدولك</div><h3>${nx.title}</h3><div class="cd" data-cd>${countdown(nx)}</div></div>`
        : html`<div><div class="lbl">جدولك</div><h3>لا حصص قادمة</h3><div class="small" style="opacity:.75">أضف حصصك مرة واحدة وتتكرر أسبوعياً.</div></div>`}
      <a class="btn" href="#/focus">${icon('play')}ابدأ جلسة تركيز</a>
    </div>
  </section>

  <form class="quick-add" id="qa" autocomplete="off">
    ${icon('sparkle')}
    <input id="qaIn" maxlength="160" placeholder="أضف مهمة بجملة: «حل واجب الرياضيات بكرة !» أو «مراجعة العلوم الخميس»" aria-label="إضافة مهمة سريعة">
    <button class="btn primary sm">${icon('plus')}إضافة</button>
  </form>
  <div class="qa-hint" id="qaHint" aria-live="polite"></div>
  ${(() => { const g = all('grades'), past = [];
    for (let i = 0; i <= 7; i++) { const day = addDays(d, -i); eventsOn(day).forEach(e => { if (e.type === 'exam' && (i > 0 || e.end <= nm) && !g.some(x => x.eventId === e.id)) past.push({ e, day }); }); }
    return past.length ? html`<div class="nudges">${past.slice(0, 2).map(({ e, day }) => html`<div class="nudge" style="--c:${(subject(e.subjectId) || {}).color || 'var(--danger)'}">${icon('grade')}<span class="grow">كيف كان <b>${e.title}</b>؟ سجّل علامتك لنحدّث معدلك.</span><button class="btn sm primary" data-act="newGrade" data-ev="${e.id}" data-on="${day}">تسجيل العلامة</button></div>`)}</div>` : ''; })()}

  ${(() => { const pd = addDays(d, planOff), pl = dayPlan(pd); if (!pl.blocks.length && planOff === 0) return '';
    const KI = { task: 'tasks', exam: 'exam', cards: 'cards', weak: 'grade', habit: 'habit' };
    return html`<section class="plan card" aria-label="خطة المذاكرة المقترحة">
      <div class="card-head"><h2 style="--c:var(--focus)">${icon('sparkle')}${planOff === 0 ? 'خطتك لبقية اليوم' : 'خطة ' + (planOff === 1 ? 'الغد' : 'بعد غد')}</h2>${pl.blocks.length ? html`<span class="chip fc">${fmtMin(pl.total)} · ${pl.blocks.length} ${pl.blocks.length === 1 ? 'كتلة' : pl.blocks.length === 2 ? 'كتلتان' : 'كتل'}</span>` : ''}
        <div class="seg sm plan-seg">${[[0, 'اليوم'], [1, 'غداً'], [2, 'بعد غد']].map(([v, l]) => html`<button class="${planOff === v ? 'on' : ''}" data-act="planDay" data-v="${v}">${l}</button>`)}</div>
        ${pl.blocks.length ? html`<button class="btn sm ghost" data-act="planToWeek" data-d="${pd}">${icon('week')}أضف الخطة إلى الجدول</button>` : ''}</div>
      ${pl.blocks.length ? html`<div class="plan-row">${pl.blocks.map((b, i) => { const s = subject(b.subjectId); return html`<div class="pblock ${i === 0 && planOff === 0 ? 'first' : ''}" style="--c:${s ? s.color : b.kind === 'cards' ? 'var(--sci)' : b.kind === 'habit' ? 'var(--ok)' : 'var(--accent)'}">
        <div class="pt num">${t12(fromMin(b.start))} – ${t12(fromMin(b.end))}</div>
        <div class="row" style="gap:8px;align-items:flex-start">${icon(KI[b.kind] || 'focus')}<b class="grow">${b.title}</b></div>
        <div class="xs muted">${b.why}${b.part ? ' · جزء قبل الحصة' : ''} · ${fmtMin(b.end - b.start)}</div>
        ${planOff === 0 ? html`<button class="btn sm ${i === 0 ? 'primary' : ''}" data-act="planGo" data-task="${b.taskId || ''}" data-sub="${b.subjectId || ''}" data-href="${b.href || ''}" data-min="${Math.min(b.end - b.start, Number(profile().focusMin) || 25)}">${icon('play')}${b.href ? 'افتح' : 'ابدأ'}</button>` : ''}
      </div>`; })}</div>` : html`<p class="small muted">لا شيء مستعجل في ذلك اليوم. استمتع بوقتك أو أضف مهام جديدة.</p>`}
    </section>`; })()}
  <div class="grid g3">
    <section class="card span2">
      <div class="card-head"><h2>${icon('tasks')}مهام تحتاج إنجازاً</h2><a class="more" href="#/tasks">كل المهام ${icon('chevL')}</a></div>
      ${due.length ? html`<div>${due.slice(0, 7).map(t => taskRow(t))}</div>${due.length > 7 ? html`<a class="more small" href="#/tasks">و${due.length - 7} أخرى…</a>` : ''}`
        : empty('tasks', doneToday.length ? 'أنجزت كل شيء اليوم' : 'لا مهام لليوم', doneToday.length ? 'استرح قليلاً أو جهّز مهام الغد.' : 'اكتب مهمة في الشريط أعلاه، وسنفهم الموعد والمادة تلقائياً.')}
    </section>

    <section class="card">
      <div class="card-head"><h2>${icon('target')}هدف التركيز</h2><a class="more" href="#/stats">الإحصائيات ${icon('chevL')}</a></div>
      <div class="row" style="gap:18px">
        <div style="position:relative;width:96px;height:96px">${ringSvg(f / goal, 96, 10, 'var(--focus)')}<b class="num" style="position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-display);font-size:1.3rem">${Math.min(100, Math.round(f / goal * 100))}%</b></div>
        <div class="stack" style="gap:4px"><b>${fmtMin(f)} من ${fmtMin(goal)}</b><span class="small muted">${f >= goal ? 'حققت هدف اليوم!' : 'باقي ' + fmtMin(goal - f) + ' — تقريباً ' + Math.ceil((goal - f) / (p.focusMin || 25)) + ' جلسات'}</span></div>
      </div>
    </section>

    <section class="card span2">
      <div class="card-head"><h2>${icon('week')}جدول اليوم</h2><a class="more" href="#/week">الأسبوع ${icon('chevL')}</a></div>
      ${evs.length ? html`<div class="timeline">${evs.map((e, i) => {
        const s = subject(e.subjectId), past = e.end <= nm, now = e.start <= nm && e.end > nm;
        const showLine = !past && !now && (i === 0 || evs[i - 1].end <= nm) && evs.some(x => x.end <= nm);
        return html`${showLine ? html`<div class="now-line">الآن ${t12(nm)}</div>` : ''}<div class="tl-item ${past ? 'past' : ''} ${now ? 'now' : ''}" style="--c:${s ? s.color : 'var(--muted)'}"><div class="tl-time">${t12(e.start)}</div><div class="tl-body" data-act="editEvent" data-id="${e.id}" data-on="${e.on}" role="button" tabindex="0"><div class="grow"><b>${e.type === 'exam' ? '✦ ' : ''}${e.title}</b><small>${t12(e.start)} – ${t12(e.end)}${e.room ? ' · ' + e.room : ''}</small></div>${now ? html`<span class="chip ac">الآن</span>` : ''}</div></div>`;
      })}</div>` : empty('week', 'لا حصص اليوم', 'أضف جدولك الأسبوعي مرة واحدة.', html`<button class="btn sm" data-act="newEvent">${icon('plus')}إضافة حصة</button>`)}
    </section>

    <section class="card bot-card">
      <div class="card-head"><h2 style="--c:var(--accent)">${icon('bot')}مساعد جدولي الذكي</h2></div>
      <p class="small muted">اسألني عن جدولك، مهامك، عاداتك أو طريقة تنظيم يومك.</p>
      <form class="chat-in" id="botF"><input class="input grow" name="q" placeholder="شو عندي بكرة؟" aria-label="اسأل المساعد"><button class="btn primary sm" aria-label="إرسال">${icon('arrowL')}</button></form>
      <div class="sugg">${['متى وقتي الفاضي؟', 'متى اختباري الجاي؟', 'شو معدلي؟'].map(q => html`<button class="chip" data-act="askBot" data-q="${q}">${q}</button>`)}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2 style="--c:var(--sci)">${icon('atom')}عالم العلوم</h2><a class="more" href="#/science">افتح ${icon('chevL')}</a></div>
      <div class="stack">
        ${(() => { const l = profile().lastLesson && sciLesson(profile().lastLesson); if (!l || get('lessons', l.id)) return ''; const b = sciBranch(l.b); return html`<a class="lesson-row" href="#/science/lesson/${l.id}" style="--c:${b.color}"><span class="n">${icon('book')}</span><div class="grow"><b class="small">تابع من حيث توقفت</b><div class="xs muted">${l.title} · ${b.name}</div></div></a>`; })()}
        <a class="lesson-row" href="#/science/cards" style="--c:var(--sci)"><span class="n">${icon('cards')}</span><div class="grow"><b class="small">بطاقات للمراجعة</b><div class="xs muted">${cards ? cards + ' مستحقة اليوم' : 'لا بطاقات مستحقة'}${fresh ? ' · ' + fresh + ' جديدة' : ''}</div></div></a>
        <a class="lesson-row" href="#/science/quiz" style="--c:var(--sci)"><span class="n">${icon('quiz')}</span><div class="grow"><b class="small">اختبار سريع</b><div class="xs muted">10 أسئلة متنوعة</div></div></a>
        <div class="tips">${fact ? html`<div style="background:var(--sci-2)">${icon('sparkle')}<span>${fact}</span></div>` : ''}<div>${icon('bolt')}<span><b>نصيحة اليوم:</b> ${TIPS[daySeed(d) % TIPS.length]}</span></div></div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2 style="--c:var(--danger)">${icon('exam')}الاختبارات القادمة</h2><a class="more" href="#/exams">الكل ${icon('chevL')}</a></div>
      ${ex.length ? html`<div class="stack">${ex.map(e => { const s = subject(e.subjectId); return html`<div class="row" style="--c:${s ? s.color : 'var(--danger)'}"><div class="countdown" style="width:54px;height:54px;border-radius:16px"><b style="font-size:1.3rem">${e.left}</b><span>${e.left === 0 ? 'اليوم' : 'يوم'}</span></div><div class="grow"><b class="small">${e.title}</b><div class="xs muted">${niceDate(e.on)} · ${t12(e.start)}</div></div></div>`; })}</div>` : empty('exam', 'لا اختبارات قريبة', 'عند إضافة اختبار سنقترح عليك خطة مراجعة.')}
    </section>

    <section class="card">
      <div class="card-head"><h2 style="--c:var(--ok)">${icon('habit')}عادات اليوم</h2><a class="more" href="#/habits">${hDone}/${habits.length} ${icon('chevL')}</a></div>
      ${habits.length ? html`<div class="stack">${habits.slice(0, 5).map(h => html`<div class="row"><button class="chk ${h.days && h.days[d] ? 'on' : ''}" data-act="habitDay" data-id="${h.id}" data-d="${d}" aria-label="${h.title}">${icon('check')}</button><span class="grow small">${h.title}</span></div>`)}</div>` : empty('habit', 'ابنِ عادة صغيرة', 'قراءة، رياضة، مراجعة… تتبعها يومياً.', html`<a class="btn sm" href="#/habits">${icon('plus')}عادة جديدة</a>`)}
    </section>

    <section class="card">
      <div class="card-head"><h2 style="--c:var(--focus)">${icon('stats')}آخر 7 أيام</h2><a class="more" href="#/stats">التفاصيل ${icon('chevL')}</a></div>
      ${(() => { const ds = lastDays(7).map(x => ({ x, m: focusOn(x) })), mx = Math.max(30, ...ds.map(z => z.m)), ach = achievements(), got = ach.filter(a => a.got); return html`<div class="bars" style="height:110px">${ds.map(z => html`<div class="b ${z.x === d ? 'today' : ''}"><i style="--h:${Math.round(z.m / mx * 100)}%"></i><span>${DAYS_SHORT[dobj(z.x).getDay()]}</span></div>`)}</div><div class="row xs muted" style="margin-top:10px">${icon('trophy')}<span>${got.length}/${ach.length} إنجازات${got.length ? ' · آخرها: ' + got[got.length - 1].title : ' — أكمل أول جلسة تركيز لتفتح أولها'}</span></div>`; })()}
    </section>
  </div>`;
}
export function mount(el) {
  const bf = $('#botF', el); if (bf) bf.onsubmit = e => { e.preventDefault(); const q = bf.q.value; bf.q.value = ''; openAssistant(q); };
  const inp = $('#qaIn', el), hint = $('#qaHint', el), f = $('#qa', el);
  const draw = () => {
    const v = inp.value.trim(); if (!v) { hint.innerHTML = ''; return; }
    const p = parseTask(v), s = subject(p.subjectId);
    hint.innerHTML = html`<span class="chip">${icon('week')}${niceDate(p.due || today())}</span>${s ? html`<span class="chip" style="--c:${s.color}"><i class="dot"></i>${s.name}</span>` : ''}${p.priority !== 'normal' ? html`<span class="chip ${p.priority === 'high' ? 'hi' : 'lo'}">أولوية ${PRI[p.priority]}</span>` : ''}${p.est ? html`<span class="chip fc">${p.est} جلسات</span>` : ''}${p.repeat && p.repeat !== 'none' ? html`<span class="chip sc">${icon('repeat')}${REPEATS[p.repeat]}</span>` : ''}<span class="xs muted" style="align-self:center">سيُحفظ باسم: «${p.title}»</span>`.s;
  };
  inp.addEventListener('input', draw);
  f.onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (!v) return inp.focus(); window.__quickAdd(v); };
  const cd = $('[data-cd]', el);
  if (cd) { const nx = upcoming(1)[0]; const t = setInterval(() => { if (!document.body.contains(cd)) return clearInterval(t); cd.textContent = countdown(nx); }, 30000); }
}
