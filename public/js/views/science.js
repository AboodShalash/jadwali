/* عالم العلوم: دروس، بطاقات بتكرار متباعد، اختبارات، قاموس، مختبر تفاعلي */
import { html, raw, today, norm, shuffle, daySeed, pick, esc, $, $$ } from '../util.js';
import { icon } from '../icons.js';
import { all, get, upsert, profile, setProfile } from '../store.js';
import { review, cardDue } from '../logic.js';
import { BRANCHES, LESSONS, TERMS, FACTS, branch, lesson, syncStage } from '../science-data.js';
import { STAGES, FIELDS, SUBJ, field, stageLabel, stageSubjects, hasMinistry, ministryPool, GRADE_NAME } from '../curriculum.js';
import { modal } from '../ui.js';
import { act, toast, confetti, empty, confirmBox } from '../ui.js';
import { niceDate } from '../util.js';
import { intro } from '../parts.js';

export const title = 'عالم العلوم';
const TABS = [['', 'الرئيسية', 'atom'], ['cards', 'البطاقات', 'cards'], ['quiz', 'اختبار', 'quiz'], ['glossary', 'القاموس', 'glossary'], ['lab', 'المختبر', 'lab'], ['tools', 'الأدوات', 'calc']];
const tabs = cur => html`<div class="seg no-print" style="margin-bottom:18px">${TABS.map(([k, v]) => html`<button class="${cur === k ? 'on' : ''}" data-act="go" data-to="#/science${k ? '/' + k : ''}">${v}</button>`)}</div>`;
const done = id => !!all('lessons').find(l => l.id === id);
const dueCards = () => all('cards').filter(c => cardDue(c));
const newTerms = () => TERMS.filter(t => !get('cards', t.id));

export function render(params = {}, sub = []) {
  syncStage();
  const [page, id] = sub;
  if (page === 'branch') return branchPage(id);
  if (page === 'lesson') return lessonPage(id);
  if (page === 'cards') return html`${tabs('cards')}<div id="cardsRoot"></div>`;
  if (page === 'quiz') return quizHome(params);
  if (page === 'glossary') return glossaryPage(params.q || '');
  if (page === 'lab') return labPage();
  if (page === 'tools') return toolsPage();
  return home();
}

function home() {
  const p = profile(), fact = FACTS.length ? FACTS[daySeed() % FACTS.length] : '', ld = LESSONS.filter(l => done(l.id)).length, qz = all('quizzes');
  const avg = qz.length ? Math.round(qz.reduce((a, q) => a + q.score / q.total, 0) / qz.length * 100) : 0;
  const nextL = LESSONS.find(l => !done(l.id));
  const ids = stageSubjects(p), mq = hasMinistry(p) ? ministryPool(ids).length : 0;
  const tcount = TERMS.filter(t => get('cards', t.id)).length;
  return html`${tabs('')}
  <section class="sci-hero">
    <canvas id="stars" aria-hidden="true"></canvas>
    <div><h2>عالم العلوم</h2><p>${p.stage ? 'محتوى مرتب حسب المنهاج الأردني لمرحلتك: وحدات ودروس، بطاقات تتذكر عنك متى تراجع، اختبارات فورية، ومختبر تفاعلي.' : 'دروس مركّزة حسب المنهاج الأردني، بطاقات تتذكر عنك متى تراجع، اختبارات فورية، ومختبر تجرّب فيه القوانين بيديك.'}</p>
      <div class="row wrap" style="margin-top:16px">${!p.stage ? '' : nextL ? html`<a class="btn primary" href="#/science/lesson/${nextL.id}">${icon('book')}${ld ? 'تابع: ' : 'ابدأ: '}${nextL.title}</a>` : html`<span class="chip ok">أنهيت كل الدروس!</span>`}<a class="btn" style="background:rgba(255,255,255,.1);color:inherit;border-color:rgba(255,255,255,.2)" href="#/science/cards">${icon('cards')}البطاقات (${dueCards().length + Math.min(10, newTerms().length)})</a></div></div>
    ${fact ? html`<div class="fact"><small>${icon('sparkle')}هل تعلم؟</small><p>${fact}</p></div>` : ''}
  </section>
  ${p.stage ? html`<section class="card stage-bar" style="--c:${(STAGES[p.stage] || {}).color}"><span class="bi">${icon((STAGES[p.stage] || {}).icon || 'book')}</span><div class="grow"><span class="xs muted">مرحلتك الدراسية</span><h3>${stageLabel(p)}</h3><p class="xs muted">${ids.length} مواد · ${LESSONS.filter(l => l.cur).length} وحدة · ${TERMS.length} مصطلحاً${mq ? ' · ' + mq + ' سؤالاً على نمط الوزارة' : ''}</p></div>
    <div class="row wrap" style="gap:8px">${mq ? html`<a class="btn sm sci" href="#/science/quiz?m=mq">${icon('trophy')}أسئلة على نمط الوزارة</a>` : ''}<button class="btn sm" data-act="addStageSubj">${icon('plus')}أضف موادي إلى جدولي</button><button class="btn sm" data-act="openStage">${icon('edit')}غيّر مرحلتك</button></div></section>`
    : stagePicker()}
  <div class="kpis">
    <div class="kpi" style="--c:var(--sci)"><div class="l">${icon('book')}دروس منجزة</div><b class="num">${ld}/${LESSONS.length}</b></div>
    <div class="kpi" style="--c:var(--sci)"><div class="l">${icon('cards')}بطاقات تتعلمها</div><b class="num">${tcount}/${TERMS.length}</b></div>
    <div class="kpi" style="--c:var(--sci)"><div class="l">${icon('quiz')}اختبارات</div><b class="num">${qz.length}</b></div>
    <div class="kpi" style="--c:var(--sci)"><div class="l">${icon('target')}متوسط الدقة</div><b class="num">${qz.length ? avg + '%' : '—'}</b></div>
  </div>
  ${p.stage ? html`<h3 class="small muted" style="margin:4px 0 10px">${p.stage === 'fields' ? 'مواد حقلك' : 'موادك'}</h3>` : ''}
  <div class="grid g4">${BRANCHES.map(b => { const ls = LESSONS.filter(l => l.b === b.id), d = ls.filter(l => done(l.id)).length, f = p.stage === 'fields' ? field(p.field) : null, tagx = f ? (f.req.includes(b.id) ? 'إجبارية' : f.opt.includes(b.id) ? 'اختيارية' : '') : ''; return html`<a class="branch" href="#/science/branch/${b.id}" style="--c:${b.color}"><span class="bi">${icon(b.icon)}</span><h3>${b.name}</h3><p class="small muted">${tagx ? html`<span class="chip ${tagx === 'إجبارية' ? 'sc' : ''}" style="margin-inline-end:6px">${tagx}</span>` : ''}${b.tag}</p><div class="row"><div class="bar grow" style="--p:${ls.length ? d / ls.length * 100 : 0}%;--c:${b.color}"><i></i></div><span class="xs muted num">${d}/${ls.length}</span></div></a>`; })}</div>`;
}
/* ---------- اختيار المرحلة الدراسية ---------- */
function stagePicker() {
  return html`<section class="card stage-pick"><div class="card-head"><h2 style="--c:var(--sci)">${icon('target')}اختر مرحلتك الدراسية</h2><span class="more">نرتب لك المواد والوحدات حسب المنهاج الأردني</span></div>
    <div class="grid g3">${Object.entries(STAGES).map(([k, v]) => html`<button class="stage-card" data-act="pickStage" data-stage="${k}" style="--c:${v.color}"><span class="bi">${icon(v.icon)}</span><b>${v.name}</b><span class="small muted">${v.sub}</span></button>`)}</div></section>`;
}
function setStage(obj) { setProfile(obj); syncStage(); toast('تم ضبط مرحلتك: ' + stageLabel(profile())); window.__refresh && window.__refresh(); }
export function openStage(step = '') {
  const m = modal('', { title: 'مرحلتك الدراسية', wide: true, cls: 'stage-modal' });
  const draw = st => {
    const p = profile(); let h;
    if (st === 'basic') h = html`<p class="small muted" style="margin-bottom:12px">اختر صفك من الأول حتى العاشر:</p><div class="grade-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => html`<button class="stage-card sm ${p.stage === 'basic' && Number(p.sgrade) === g ? 'on' : ''}" data-g="${g}" style="--c:#1F8A7E"><b class="num">${g}</b><span class="xs muted">الصف ${GRADE_NAME(g)}</span></button>`)}</div><div class="form-actions"><button class="btn ghost" data-back>رجوع</button></div>`;
    else if (st === 'fields') h = html`<p class="small muted" style="margin-bottom:12px">في نظام التوجيهي الجديد لكل حقل ثلاث مواد إجبارية ومادة اختيارية واحدة. اختر حقلك:</p><div class="grid g2">${FIELDS.map(f => html`<button class="stage-card ${p.field === f.id ? 'on' : ''}" data-f="${f.id}" style="--c:${f.color}"><span class="bi">${icon(f.icon)}</span><b>${f.name}</b><span class="xs muted">${f.req.map(i => SUBJ[i].name).join(' · ')}</span><span class="xs muted">${f.hint}</span></button>`)}</div><div class="form-actions"><button class="btn ghost" data-back>رجوع</button></div>`;
    else if (st.startsWith('el:')) { const f = field(st.slice(3)); h = html`<p class="small muted" style="margin-bottom:6px"><b>${f.name}</b></p><p class="small muted" style="margin-bottom:12px">موادك الإجبارية: ${f.req.map(i => SUBJ[i].name).join('، ')}. اختر مادتك الاختيارية:</p><div class="grid g2">${f.opt.map(o => html`<button class="stage-card sm ${p.elective === o && p.field === f.id ? 'on' : ''}" data-el="${o}" style="--c:${SUBJ[o].color}"><span class="bi">${icon(SUBJ[o].icon)}</span><b>${SUBJ[o].name}</b></button>`)}<button class="stage-card sm" data-el="" style="--c:var(--ink-3)"><span class="bi">${icon('more')}</span><b>لم أقرر بعد</b><span class="xs muted">اعرض كل المواد الاختيارية</span></button></div><div class="form-actions"><button class="btn ghost" data-back="fields">رجوع</button></div>`; }
    else h = html`<div class="grid g3">${Object.entries(STAGES).map(([k, v]) => html`<button class="stage-card ${p.stage === k ? 'on' : ''}" data-s="${k}" style="--c:${v.color}"><span class="bi">${icon(v.icon)}</span><b>${v.name}</b><span class="small muted">${v.sub}</span></button>`)}</div>${p.stage ? html`<div class="form-actions"><button class="btn ghost" data-clear>إلغاء المرحلة وعرض العلوم العامة</button></div>` : ''}`;
    m.body.innerHTML = h.s;
    $$('[data-s]', m.body).forEach(b => b.onclick = () => { const k = b.dataset.s; if (k === 'academic') { m.close(); setStage({ stage: 'academic' }); } else draw(k); });
    $$('[data-g]', m.body).forEach(b => b.onclick = () => { m.close(); setStage({ stage: 'basic', sgrade: Number(b.dataset.g) }); });
    $$('[data-f]', m.body).forEach(b => b.onclick = () => draw('el:' + b.dataset.f));
    $$('[data-el]', m.body).forEach(b => b.onclick = () => { m.close(); setStage({ stage: 'fields', field: st.slice(3), elective: b.dataset.el }); });
    $$('[data-back]', m.body).forEach(b => b.onclick = () => draw(b.dataset.back || ''));
    const c = $('[data-clear]', m.body); if (c) c.onclick = () => { m.close(); setStage({ stage: '', sgrade: 0, field: '', elective: '' }); };
    const f0 = $('button', m.body); if (f0) f0.focus();
  };
  draw(step);
}
act('openStage', () => openStage());
act('addStageSubj', () => {
  const have = all('subjects').map(x => x.name); let n = 0;
  stageSubjects(profile()).forEach(id => { const x = SUBJ[id]; if (x && !have.includes(x.name)) { upsert('subjects', { name: x.name, color: x.color }); have.push(x.name); n++; } });
  toast(n ? 'أضفت ' + n + ' مواد إلى جدولك' : 'موادك موجودة مسبقاً في جدولك');
});
act('pickStage', el => { const k = el.dataset.stage; if (k === 'academic') setStage({ stage: 'academic' }); else openStage(k); });
function branchPage(id) {
  const b = branch(id); if (!b) return home();
  const ls = LESSONS.filter(l => l.b === id);
  const mq = (b.mq || []).length;
  return html`${tabs('')}${intro(b.name, b.tag, html`<div class="row wrap" style="gap:8px"><a class="btn sm" href="#/science/quiz?b=${id}">${icon('quiz')}اختبر نفسك في ${b.name}</a>${mq ? html`<a class="btn sm sci" href="#/science/quiz?m=mq&b=${id}">${icon('trophy')}نمط الوزارة (${mq})</a>` : ''}</div>`)}
  <section class="card">${ls.map((l, i) => html`<a class="lesson-row ${done(l.id) ? 'done' : ''}" href="#/science/lesson/${l.id}" style="--c:${b.color}"><span class="n">${done(l.id) ? icon('check') : i + 1}</span><div class="grow"><b>${l.cur ? 'الوحدة ' + l.unit + ': ' : ''}${l.title}</b><div class="xs muted">${l.parts && l.parts.length ? l.parts.length + ' دروس · ' : ''}${l.min} دقائق قراءة · ${l.q.length} أسئلة</div>${l.parts && l.parts.length ? html`<div class="parts">${l.parts.map(x => html`<span>${x}</span>`)}</div>` : ''}</div>${icon('chevL')}</a>`)}</section>
  <h3 class="small muted" style="margin:22px 0 10px">مصطلحات ${b.name}</h3>
  <div class="grid g2">${TERMS.filter(t => t.b === id).map(t => html`<div class="term"><b>${t.t}</b><p>${t.d}</p></div>`)}</div>`;
}
function lessonPage(id) {
  const l = lesson(id); if (!l) return home();
  const b = branch(l.b), ls = LESSONS.filter(x => x.b === l.b), i = ls.indexOf(l), nx = ls[i + 1];
  return html`${tabs('')}
  <article class="article">
    <a class="chip" style="--c:${b.color};text-decoration:none" href="#/science/branch/${b.id}"><i class="dot"></i>${b.name} · ${l.cur ? 'الوحدة ' + l.unit : 'الدرس ' + (i + 1)}</a>
    <h2>${l.title}</h2>
    ${l.parts && l.parts.length ? html`<div class="parts big"><span class="xs muted">دروس الوحدة في الكتاب:</span>${l.parts.map((x, k) => html`<span><b class="num">${k + 1}</b>${x}</span>`)}</div>` : ''}
    ${l.body.map(p => html`<p>${p}</p>`)}
    <div class="keys"><h3>${icon('sparkle')} الخلاصة</h3><ul>${l.keys.map(k => html`<li>${k}</li>`)}</ul></div>
    ${lawsCard(l.id)}
    <section class="card" id="lessonQuiz" data-lesson="${l.id}"></section>
    <div class="row wrap" style="margin-top:18px">
      <a class="btn" href="#/focus?s=science">${icon('focus')}جلسة تركيز للمراجعة</a>
      ${nx ? html`<a class="btn ghost" href="#/science/lesson/${nx.id}">الدرس التالي: ${nx.title} ${icon('chevL')}</a>` : html`<a class="btn ghost" href="#/science/branch/${b.id}">العودة إلى ${b.name}</a>`}
      ${(b.mq || []).length ? html`<a class="btn ghost" href="#/science/quiz?m=mq&b=${b.id}">${icon('trophy')}أسئلة على نمط الوزارة</a>` : ''}
    </div>
  </article>`;
}
function glossaryPage(q) {
  return html`${tabs('glossary')}${intro('القاموس العلمي', TERMS.length + ' مصطلحاً مع البحث الفوري')}
  <div class="list-tools"><input class="input grow" id="gq" placeholder="ابحث عن مصطلح أو معنى…" value="${q}" aria-label="بحث في القاموس"><div class="seg" id="gb"><button class="on" data-b="">الكل</button><button data-b="fav">${icon('star')}المفضلة</button>${BRANCHES.length <= 5 ? BRANCHES.map(b => html`<button data-b="${b.id}">${b.name}</button>`) : ''}</div>${BRANCHES.length > 5 ? html`<select class="input" id="gbs" aria-label="المادة"><option value="">كل المواد</option>${BRANCHES.map(b => html`<option value="${b.id}">${b.name}</option>`)}</select>` : ''}</div>
  <div class="grid g2" id="gl"></div>`;
}
function labPage() {
  return html`${tabs('lab')}${intro('المختبر التفاعلي', 'حرّك المؤشرات وشاهد القوانين تعمل أمامك')}
  <div class="seg" id="labSel" style="margin-bottom:14px"><button class="on" data-l="ohm">قانون أوم</button><button data-l="proj">المقذوفات</button><button data-l="matter">حالات المادة</button><button data-l="force">القوة والتسارع</button><button data-l="speed">سباق السرعة</button><button data-l="density">الطفو والكثافة</button></div>
  <div class="grid g3"><section class="card span2" style="padding:12px"><canvas class="lab-canvas" id="lab"></canvas></section><section class="card lab-ctl" id="labCtl"></section></div>
  <section class="card challenge" id="labCh" style="margin-top:18px"></section>`;
}
const CHALLENGES = [
  ['إذا تضاعفت الكتلة وبقي التسارع ثابتاً، ماذا يحدث للقوة؟', ['تنخفض إلى النصف', 'تتضاعف', 'لا تتغير'], 1, 'حسب ق = ك × ت، القوة تتناسب طردياً مع الكتلة، فإذا تضاعفت الكتلة تضاعفت القوة.'],
  ['في دارة كهربائية، ضاعفنا المقاومة وأبقينا الجهد ثابتاً. ماذا يحدث للتيار؟', ['يتضاعف', 'يقل إلى النصف', 'يبقى كما هو'], 1, 'ت = ج ÷ م، فزيادة المقاومة للضعف تقلل التيار إلى النصف.'],
  ['قُذف جسم بزاوية 45° ثم بزاوية 30° بنفس السرعة. أيهما أبعد مدى؟', ['45°', '30°', 'متساويان'], 0, 'في غياب مقاومة الهواء يكون أقصى مدى عند 45°.'],
  ['قطعتان من الحديد: صغيرة وكبيرة. أيهما كثافتها أكبر؟', ['الكبيرة', 'الصغيرة', 'متساويتان'], 2, 'الكثافة خاصية للمادة نفسها ولا تعتمد على الحجم: ث = ك ÷ ح.'],
  ['قطع عدّاء 100 م في 10 ث، وآخر 200 م في 25 ث. أيهما أسرع؟', ['الأول', 'الثاني', 'متساويان'], 0, 'الأول سرعته 10 م/ث والثاني 8 م/ث.'],
  ['ماذا يحدث لجزيئات الماء عند تسخينه حتى الغليان؟', ['تتباطأ وتتقارب', 'تتسارع وتتباعد', 'لا تتغير'], 1, 'الحرارة تزيد طاقة الجزيئات الحركية فتتحرك أسرع وتتباعد حتى تتحول إلى غاز.']
];
function runChallenge(el) {
  const box = $('#labCh', el); if (!box) return; let i = daySeed() % CHALLENGES.length;
  const draw = () => { const [q, o, a, e] = CHALLENGES[i];
    box.innerHTML = html`<div class="card-head"><h2 style="--c:var(--sci)">${icon('bolt')}تحدّي المختبر</h2><button class="more" id="chN">تحدٍّ آخر ${icon('chevL')}</button></div><p><b>${q}</b></p><div class="row wrap" style="gap:8px;margin-top:10px">${o.map((x, k) => html`<button class="opt ch-o" data-k="${k}">${x}</button>`)}</div><p class="small muted" id="chE" style="margin-top:10px">اختر إجابة لعرض التفسير.</p>`.s;
    $$('.ch-o', box).forEach(b => b.onclick = () => { $$('.ch-o', box).forEach((z, k) => { z.disabled = true; if (k === a) z.classList.add('right'); else if (z === b) z.classList.add('wrong'); }); $('#chE', box).innerHTML = html`<b>${+b.dataset.k === a ? 'صحيح!' : 'ليست هذه.'}</b> ${e}`.s; });
    $('#chN', box).onclick = () => { i = (i + 1) % CHALLENGES.length; draw(); };
  }; draw();
}

/* ---------- القوانين الأساسية ---------- */
export const LAWS = [
  { f: 'س = ف ÷ ز', n: 'السرعة', u: 'م/ث', d: 'المسافة المقطوعة في وحدة الزمن.', l: 'phy-motion', calc: 'speed', lab: 'speed' },
  { f: 'ت = (ع₂ − ع₁) ÷ ز', n: 'التسارع', u: 'م/ث²', d: 'مقدار تغيّر السرعة في وحدة الزمن.', l: 'phy-motion' },
  { f: 'ق = ك × ت', n: 'قانون نيوتن الثاني', u: 'نيوتن', d: 'القوة المحصلة تساوي الكتلة مضروبة في التسارع.', l: 'phy-newton', calc: 'force', lab: 'force' },
  { f: 'و = ك × ج', n: 'الوزن', u: 'نيوتن', d: 'قوة جذب الأرض للجسم، وج ≈ 9.8 م/ث².', l: 'phy-newton' },
  { f: 'ت = ج ÷ م', n: 'قانون أوم', u: 'أمبير', d: 'التيار يساوي الجهد مقسوماً على المقاومة.', l: 'phy-electric', calc: 'ohm', lab: 'ohm' },
  { f: 'القدرة = ج × ت', n: 'القدرة الكهربائية', u: 'واط', d: 'معدل استهلاك الطاقة الكهربائية.', l: 'phy-electric' },
  { f: 'ث = ك ÷ ح', n: 'الكثافة', u: 'غ/سم³', d: 'كتلة وحدة الحجم من المادة؛ ما كثافته أقل من الماء يطفو.', l: 'chem-atom', calc: 'density', lab: 'density' },
  { f: 'عدد النيوترونات = العدد الكتلي − العدد الذري', n: 'تركيب النواة', u: '', d: 'العدد الذري = عدد البروتونات.', l: 'chem-atom' },
  { f: 'كتلة المتفاعلات = كتلة النواتج', n: 'حفظ الكتلة', u: '', d: 'المادة لا تفنى ولا تُستحدث في التفاعل الكيميائي.', l: 'chem-reactions' },
  { f: '6CO₂ + 6H₂O ← ضوء → C₆H₁₂O₆ + 6O₂', n: 'البناء الضوئي', u: '', d: 'النبات يصنع الغلوكوز والأكسجين باستخدام طاقة الضوء.', l: 'bio-photo' }
];
function lawsCard(filter) {
  const ls = filter ? LAWS.filter(x => x.l === filter) : LAWS; if (!ls.length) return '';
  return html`<section class="card ${filter ? 'laws-lesson' : 'span3-lite'}"><div class="card-head"><h2 style="--c:var(--sci)">${icon('calc')}${filter ? 'قوانين مرتبطة بالدرس' : 'القوانين الأساسية'}</h2>${filter ? '' : html`<span class="more">${LAWS.length} قوانين · مرتبطة بدروسها</span>`}</div>
    <div class="laws">${ls.map(x => { const le = lesson(x.l), b = le && branch(le.b); return html`<div class="law" style="--c:${b ? b.color : 'var(--sci)'}"><b class="lf ${x.f.length > 16 ? 'long' : ''}">${x.f}</b><div><b class="small">${x.n}</b>${x.u ? html` <span class="xs muted">· ${x.u}</span>` : ''}<p class="xs muted">${x.d}</p><div class="row wrap" style="gap:6px;margin-top:6px">${!filter && le ? html`<a class="chip" href="#/science/lesson/${le.id}">${le.title}</a>` : ''}${x.calc ? html`<a class="chip" href="#/science/tools?c=${x.calc}">احسب</a>` : ''}${x.lab ? html`<a class="chip" href="#/science/lab?l=${x.lab}">جرّب في المختبر</a>` : ''}</div></div></div>`; })}</div></section>`;
}

/* ---------- أدوات الطالب ---------- */
const CALCS = {
  density: { t: 'الكثافة', f: 'ث = ك ÷ ح', in: [['m', 'الكتلة (غ)', 200], ['v', 'الحجم (سم³)', 100]], go: v => v.v > 0 ? [`${fx(v.m / v.v)} غ/سم³`, v.m / v.v < 1 ? 'أقل من كثافة الماء، لذا يطفو.' : v.m / v.v > 1 ? 'أكبر من كثافة الماء، لذا يغوص.' : 'تساوي كثافة الماء.'] : null },
  speed: { t: 'السرعة', f: 'س = ف ÷ ز', in: [['d', 'المسافة (م)', 100], ['t', 'الزمن (ث)', 20]], go: v => v.t > 0 ? [`${fx(v.d / v.t)} م/ث`, `أي ${fx(v.d / v.t * 3.6)} كم/ساعة.`] : null },
  force: { t: 'القوة', f: 'ق = ك × ت', in: [['m', 'الكتلة (كغ)', 10], ['a', 'التسارع (م/ث²)', 5]], go: v => [`${fx(v.m * v.a)} نيوتن`, `وزن الجسم على الأرض ≈ ${fx(v.m * 9.8)} نيوتن.`] },
  ohm: { t: 'قانون أوم', f: 'ت = ج ÷ م', in: [['v', 'الجهد (فولت)', 12], ['r', 'المقاومة (أوم)', 6]], go: v => v.r > 0 ? [`${fx(v.v / v.r)} أمبير`, `القدرة = ${fx(v.v * v.v / v.r)} واط.`] : null },
  avg: { t: 'المعدل', f: 'المجموع ÷ العدد', in: [['g', 'الدرجات مفصولة بفاصلة', '85, 92, 78, 95', 'text']], go: v => { const a = String(v.g).split(/[,،\s]+/).filter(x => x !== '').map(Number).filter(x => !isNaN(x)); return a.length ? [fx(a.reduce((q, x) => q + x, 0) / a.length), `${a.length} درجات · الأعلى ${Math.max(...a)} · الأدنى ${Math.min(...a)}`] : null; } }
};
const fx = n => (Math.round(n * 100) / 100).toLocaleString('ar-EG-u-nu-latn');
const UNITS = {
  length: ['الطول', { m: ['متر', 1], cm: ['سنتيمتر', .01], mm: ['مليمتر', .001], km: ['كيلومتر', 1000], in: ['إنش', .0254], ft: ['قدم', .3048] }],
  mass: ['الكتلة', { kg: ['كيلوغرام', 1], g: ['غرام', .001], mg: ['مليغرام', 1e-6], t: ['طن', 1000], lb: ['رطل', .4536] }],
  time: ['الزمن', { s: ['ثانية', 1], min: ['دقيقة', 60], h: ['ساعة', 3600], d: ['يوم', 86400] }],
  volume: ['الحجم', { l: ['لتر', 1], ml: ['مليلتر', .001], m3: ['متر مكعب', 1000], cm3: ['سم³', .001] }],
  temp: ['الحرارة', { c: ['سيلسيوس', 0], f: ['فهرنهايت', 0], k: ['كلفن', 0] }]
};
function convert(kind, v, a, b) {
  if (kind === 'temp') { const c = a === 'c' ? v : a === 'f' ? (v - 32) * 5 / 9 : v - 273.15; return b === 'c' ? c : b === 'f' ? c * 9 / 5 + 32 : c + 273.15; }
  const u = UNITS[kind][1]; return v * u[a][1] / u[b][1];
}
const TIPS = ['راجع المعلومة بعد يوم، ثم بعد أسبوع — هذا ما تفعله البطاقات نيابة عنك.', 'اشرح الدرس بصوتك لشخص آخر؛ الثغرات تظهر فوراً.', 'ابدأ بأصعب مادة في أول جلسة تركيز باليوم.', 'اكتب سؤالاً واحداً بعد كل درس، وأجب عنه غداً.', 'قسّم الدرس إلى أجزاء صغيرة، ثم اختبر نفسك دون النظر إلى الكتاب.', 'نم جيداً قبل الاختبار؛ الدماغ يثبّت المعلومات أثناء النوم.'];
export { TIPS };
function toolsPage() {
  return html`${tabs('tools')}${intro('أدوات الطالب', 'حاسبات سريعة ومحوّل وحدات تغنيك عن الورقة')}
  <div class="grid g3" style="align-items:start">
    <section class="card span2"><div class="card-head"><h2 style="--c:var(--sci)">${icon('calc')}حاسبات علمية</h2></div>
      <div class="seg wrap-seg" id="cSel" style="margin-bottom:14px">${Object.entries(CALCS).map(([k, c], i) => html`<button class="${i === 0 ? 'on' : ''}" data-c="${k}">${c.t}</button>`)}</div>
      <form class="form" id="cF"></form>
      <div class="calc-out" id="cOut" aria-live="polite"></div>
    </section>
    <section class="card"><div class="card-head"><h2 style="--c:var(--sci)">${icon('repeat')}محوّل الوحدات</h2></div>
      <form class="form" id="uF">
        <label class="field"><span>النوع</span><select name="k">${Object.entries(UNITS).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}</select></label>
        <label class="field"><span>القيمة</span><input name="v" type="number" step="any" value="1" dir="ltr"></label>
        <div class="form-row"><label class="field"><span>من</span><select name="a"></select></label><label class="field"><span>إلى</span><select name="b"></select></label></div>
      </form>
      <div class="calc-out" id="uOut" aria-live="polite"></div>
    </section>
    ${lawsCard()}
    <section class="card span3-lite"><div class="card-head"><h2 style="--c:var(--ok)">${icon('sparkle')}كيف تذاكر بفعالية</h2></div>
      <ol class="tips-list">${TIPS.map(t => html`<li>${t}</li>`)}</ol></section>
  </div>`;
}
function runTools(el, params = {}) {
  const f = $('#cF', el), out = $('#cOut', el); let cur = CALCS[params.c] ? params.c : 'density';
  $$('#cSel button', el).forEach(z => z.classList.toggle('on', z.dataset.c === cur));
  const drawC = () => { const c = CALCS[cur]; f.innerHTML = html`<div class="form-row">${c.in.map(([k, l, v, ty]) => html`<label class="field"><span>${l}</span><input name="${k}" type="${ty || 'number'}" step="any" value="${v}" dir="ltr"></label>`)}</div><p class="xs muted">القانون: <b>${c.f}</b></p>`.s; calc(); $$('input', f).forEach(i => i.oninput = calc); };
  const calc = () => { const c = CALCS[cur], v = {}; c.in.forEach(([k, , , ty]) => { const x = f.elements[k].value; v[k] = ty === 'text' ? x : Number(x); }); let r = null; try { r = c.go(v); } catch (e) {} out.innerHTML = r ? html`<b class="num">${r[0]}</b><span class="small muted">${r[1]}</span>`.s : html`<span class="small muted">أدخل قيماً صحيحة.</span>`.s; };
  $$('#cSel button', el).forEach(b => b.onclick = () => { cur = b.dataset.c; $$('#cSel button', el).forEach(z => z.classList.toggle('on', z === b)); drawC(); });
  f.onsubmit = e => e.preventDefault(); drawC();
  const u = $('#uF', el), uo = $('#uOut', el);
  const opts = () => { const us = UNITS[u.k.value][1], ks = Object.keys(us); u.a.innerHTML = ks.map(k => `<option value="${k}">${esc(us[k][0])}</option>`).join(''); u.b.innerHTML = u.a.innerHTML; u.b.value = ks[1]; conv(); };
  const conv = () => { const v = Number(u.v.value), us = UNITS[u.k.value][1]; if (u.v.value === '' || isNaN(v)) { uo.innerHTML = ''; return; } const r = convert(u.k.value, v, u.a.value, u.b.value); uo.innerHTML = html`<b class="num">${fx(r)}</b><span class="small muted">${fx(v)} ${us[u.a.value][0]} = ${fx(r)} ${us[u.b.value][0]}</span>`.s; };
  u.k.onchange = opts; u.v.oninput = conv; u.a.onchange = conv; u.b.onchange = conv; u.onsubmit = e => e.preventDefault(); opts();
}

/* ---------- سجل الأخطاء والمفضلة ---------- */
const wrongs = () => profile().wrongs || [];
function trackWrong(q, ok) {
  const key = q.q, w = wrongs().filter(x => x.q !== key);
  if (!ok) w.unshift({ q: q.q, o: q.o, a: q.a, e: q.e || '', src: q.src || '', at: today() });
  if (ok && w.length === wrongs().length) return;
  setProfile({ wrongs: w.slice(0, 60) });
}
const favs = () => profile().favs || [];
act('favTerm', el => { const id = el.dataset.id, f = favs(); const on = !f.includes(id); setProfile({ favs: on ? [...f, id] : f.filter(x => x !== id) }); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); el.title = on ? 'في المفضلة' : 'أضف للمفضلة'; toast(on ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة'); });
act('clearWrongs', () => { setProfile({ wrongs: [] }); toast('مُسح سجل الأخطاء'); window.__refresh(); });
function quizHome(params) {
  const w = wrongs();
  return html`${tabs('quiz')}
  <div class="quiz-bar row wrap">
    <div class="row wrap" style="gap:8px">${BRANCHES.length <= 5 ? html`<div class="seg">${[['', 'اختبار شامل'], ...BRANCHES.map(b => [b.id, b.name])].map(([k, v]) => html`<button class="${(params.b || '') === k && !params.m ? 'on' : ''}" data-act="go" data-to="#/science/quiz${k ? '?b=' + k : ''}">${v}</button>`)}</div>`
      : html`<div class="seg"><button class="${!params.b && !params.m ? 'on' : ''}" data-act="go" data-to="#/science/quiz">اختبار شامل</button></div><select class="input sm" id="qB" aria-label="اختر المادة"><option value="">كل المواد</option>${BRANCHES.map(b => html`<option value="${b.id}" ${params.b === b.id ? raw('selected') : ''}>${b.name}</option>`)}</select>`}
    ${hasMinistry(profile()) || (params.b && (branch(params.b) || {}).mq && branch(params.b).mq.length) ? html`<button class="btn sm ${params.m === 'mq' ? 'sci' : ''}" data-act="go" data-to="#/science/quiz?m=mq${params.b ? '&b=' + params.b : ''}">${icon('trophy')}نمط الوزارة</button>` : ''}</div>
    <div class="row" style="gap:8px"><label class="row xs muted" style="gap:6px">عدد الأسئلة<select id="qN" class="input sm">${[5, 10, 15, 20].map(n => html`<option ${Number(params.n || 10) === n ? raw('selected') : ''}>${n}</option>`)}</select></label>
    <button class="btn sm ${params.m === 'wrong' ? 'sci' : ''}" data-act="go" data-to="#/science/quiz?m=wrong" ${w.length ? '' : raw('disabled')}>${icon('reset')}راجع أخطائي (${w.length})</button></div>
  </div>
  <div class="grid g3" style="align-items:start"><div class="span2" id="quizRoot"></div>
  <section class="card"><div class="card-head"><h2 style="--c:var(--danger)">${icon('target')}أخطائي الأخيرة</h2>${w.length ? html`<button class="more" data-act="clearWrongs">مسح</button>` : ''}</div>
    ${w.length ? html`<div class="stack">${w.slice(0, 6).map(x => html`<div class="wrong-it"><p class="small">${x.q}</p><p class="xs"><span class="ok-t">${x.o[x.a]}</span> · <span class="muted">${x.src}</span></p></div>`)}</div><p class="xs muted" style="margin-top:10px">أي سؤال تجيبه صح في المراجعة يُحذف من هنا تلقائياً.</p>`
      : html`<p class="small muted">لا أخطاء محفوظة. كل سؤال تخطئ فيه يُحفظ هنا لتراجعه لاحقاً.</p>`}
  </section>
  ${(() => { const at = all('quizzes').slice().sort((a, b) => (b.u || 0) - (a.u || 0)).slice(0, 8); return html`<section class="card span3-lite"><div class="card-head"><h2 style="--c:var(--sci)">${icon('clock')}سجل المحاولات</h2><span class="more">${all('quizzes').length} محاولة</span></div>
    ${at.length ? html`<div class="attempts">${at.map(q => { const pc = Math.round(q.score / q.total * 100), b = branch(q.b); return html`<div class="att"><div class="ring-s" style="--p:${pc};--c:${pc >= 80 ? 'var(--ok)' : pc >= 50 ? 'var(--accent)' : 'var(--danger)'}"><b class="num">${pc}%</b></div><div><b class="small">${q.lesson ? (lesson(q.lesson) || {}).title || 'درس' : q.mq ? 'نمط الوزارة' + (b ? ' · ' + b.name : '') : b ? b.name : 'اختبار شامل'}</b><p class="xs muted">${q.score}/${q.total} · ${niceDate(q.day)}</p></div></div>`; })}</div>` : html`<p class="small muted">لم تجرّب أي اختبار بعد.</p>`}</section>`; })()}
  </div>`;
}

/* ---------- الاختبار (يُستخدم داخل الدرس وفي صفحة الاختبار) ---------- */
function buildQuiz(branchId, n = 10) {
  let pool = [];
  LESSONS.filter(l => !branchId || l.b === branchId).forEach(l => l.q.forEach(q => pool.push(Object.assign({ src: l.title }, q))));
  BRANCHES.filter(b => (!branchId || b.id === branchId) && b.mq).forEach(b => b.mq.forEach(q => pool.push(q)));
  // أسئلة مولّدة من القاموس
  const terms = TERMS.filter(t => !branchId || t.b === branchId);
  shuffle(terms).slice(0, 6).forEach(t => {
    let wrong = shuffle(TERMS.filter(x => x.id !== t.id && x.b === t.b)).slice(0, 3).map(x => x.t);
    if (wrong.length < 3) wrong = wrong.concat(shuffle(TERMS.filter(x => x.b !== t.b && !wrong.includes(x.t) && x.t !== t.t)).slice(0, 3 - wrong.length).map(x => x.t));
    pool.push({ q: `أي مصطلح يطابق التعريف: «${t.d}»`, o: [t.t, ...wrong], a: 0, e: `${t.t}: ${t.d}`, src: 'القاموس' });
  });
  return shuffle(pool).slice(0, n).map(q => { const idx = shuffle(q.o.map((_, i) => i)); return Object.assign({}, q, { o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) }); });
}
function runQuiz(root, qs, { onDone, label = 'اختبار' } = {}) {
  let i = 0, score = 0, res = [];
  const draw = () => {
    if (i >= qs.length) return finish();
    const q = qs[i];
    root.innerHTML = html`<div class="q-card"><div class="row"><span class="chip sc">${label}</span><span class="xs muted grow">السؤال ${i + 1} من ${qs.length}</span><span class="xs muted">${q.src || ''}</span></div>
      <div class="qprog">${qs.map((_, k) => html`<i class="${k < i ? (res[k] ? 'r' : 'w') : k === i ? 'c' : ''}"></i>`)}</div>
      <h3>${q.q}</h3><div class="opts">${q.o.map((o, k) => html`<button class="opt" data-k="${k}"><kbd>${k + 1}</kbd>${o}</button>`)}</div><div id="qx"></div></div>`.s;
    $$('.opt', root).forEach(b => b.onclick = () => answer(+b.dataset.k));
  };
  const answer = k => {
    const q = qs[i], opts = $$('.opt', root); if (opts[0].disabled) return;
    const ok = k === q.a; if (ok) score++; res.push(ok); trackWrong(q, ok);
    opts.forEach((b, j) => { b.disabled = true; if (j === q.a) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
    $('#qx', root).innerHTML = html`<div class="explain" style="margin-top:4px"><b>${ok ? 'إجابة صحيحة!' : 'ليست هذه.'}</b> ${q.e || ''}</div><div class="form-actions"><button class="btn sci" id="qn">${i + 1 < qs.length ? 'التالي' : 'النتيجة'} ${icon('chevL')}</button></div>`.s;
    const nb = $('#qn', root); nb.focus(); nb.onclick = () => { i++; draw(); };
  };
  const finish = () => {
    const pct = Math.round(score / qs.length * 100);
    if (pct >= 80) confetti();
    root.innerHTML = html`<div class="empty" style="color:var(--ink)"><div style="font-family:var(--font-display);font-size:3rem;color:var(--sci);line-height:1">${score}/${qs.length}</div><h3>${pct === 100 ? 'علامة كاملة! أسطوري.' : pct >= 80 ? 'ممتاز جداً' : pct >= 50 ? 'جيد، ويمكنك أفضل' : 'راجع الدرس وحاول مجدداً'}</h3><p>+${score * 5} نقطة خبرة</p><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sci" id="qa">${icon('reset')}محاولة جديدة</button></div></div>`.s;
    $('#qa', root).onclick = () => { qs = qs.map(q => q); i = 0; score = 0; res = []; qs = shuffle(qs); draw(); };
    onDone && onDone(score, qs.length);
  };
  root._key = e => { if (/^[1-4]$/.test(e.key)) { const b = $$('.opt', root)[+e.key - 1]; if (b && !b.disabled) { answer(+e.key - 1); return true; } } if (e.key === 'Enter') { const n = $('#qn', root); if (n) { n.click(); return true; } } };
  draw();
}

/* ---------- البطاقات ---------- */
function runCards(root) {
  const due = dueCards().map(c => TERMS.find(t => t.id === c.id)).filter(Boolean);
  const fresh = newTerms().slice(0, 10);
  let queue = shuffle(due).concat(fresh), i = 0, reviewed = 0;
  const draw = () => {
    if (!queue.length || i >= queue.length) {
      root.innerHTML = html`<section class="card">${empty('cards', reviewed ? 'أنهيت مراجعة اليوم' : 'لا بطاقات مستحقة الآن', reviewed ? `راجعت ${reviewed} بطاقة. ستعود البطاقات في الوقت المناسب لتثبيتها في ذاكرتك.` : 'عد غداً — نظام التكرار المتباعد يعرض عليك كل بطاقة قبيل أن تنساها.', html`<a class="btn sci sm" href="#/science/quiz">${icon('quiz')}جرّب اختباراً</a>`)}</section>`.s;
      if (reviewed >= 10) confetti(50); return;
    }
    const t = queue[i], c = get('cards', t.id), b = branch(t.b) || { name: 'علوم', color: 'var(--sci)' };
    root.innerHTML = html`<div class="stack" style="gap:16px;max-width:640px;margin-inline:auto">
      <div class="row"><span class="chip" style="--c:${b.color}"><i class="dot"></i>${b.name}</span><span class="chip ${c ? 'sc' : 'ac'}">${c ? 'مراجعة' : 'جديدة'}</span><span class="xs muted grow" style="text-align:end">${i + 1} / ${queue.length}</span></div>
      <div class="flash" id="fl" tabindex="0" role="button" aria-label="اقلب البطاقة"><div class="flash-in"><div class="flash-f"><span class="xs muted">المصطلح</span><h3>${t.t}</h3><span class="xs muted">اضغط أو مسافة لرؤية التعريف</span></div><div class="flash-f back"><span class="xs muted">${t.t}</span><p>${t.d}</p></div></div></div>
      <div class="grades" id="gr" hidden><button data-g="0">نسيت<small>مرة أخرى</small></button><button data-g="1">صعبة<small>قريباً</small></button><button data-g="2">جيدة<small>${c && c.streak ? 'بعد أيام' : 'غداً'}</small></button><button data-g="3">سهلة<small>لاحقاً</small></button></div>
    </div>`.s;
    const fl = $('#fl', root), gr = $('#gr', root);
    const flip = () => { fl.classList.toggle('flipped'); gr.hidden = false; };
    fl.onclick = flip;
    $$('[data-g]', gr).forEach(bt => bt.onclick = () => grade(+bt.dataset.g));
  };
  const grade = g => {
    const t = queue[i]; const c = review(get('cards', t.id) || { id: t.id }, g);
    upsert('cards', Object.assign({ id: t.id }, c)); reviewed++;
    if (g === 0) queue.push(t); // تعاد في نفس الجلسة
    i++; draw();
  };
  root._key = e => {
    const fl = $('#fl', root); if (!fl) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fl.click(); return true; }
    if (/^[1-4]$/.test(e.key) && fl.classList.contains('flipped')) { grade(+e.key - 1); return true; }
  };
  draw();
}

/* ---------- القاموس ---------- */
function runGlossary(el) {
  const q = $('#gq', el), gl = $('#gl', el); let br = '';
  const draw = () => {
    const nq = norm(q.value), fv = favs(), list = TERMS.filter(t => (!br || (br === 'fav' ? fv.includes(t.id) : t.b === br)) && (!nq || norm(t.t + ' ' + t.d).includes(nq)));
    const mark = s => { if (!nq) return esc(s); const n = norm(s), k = n.indexOf(nq); if (k < 0 || n.length !== s.length) return esc(s); return esc(s.slice(0, k)) + '<mark>' + esc(s.slice(k, k + nq.length)) + '</mark>' + esc(s.slice(k + nq.length)); };
    gl.innerHTML = list.length ? list.map(t => { const b = branch(t.b); const on = fv.includes(t.id); return `<div class="term"><div class="row"><b class="grow">${mark(t.t)}</b><span class="chip" style="--c:${b.color}"><i class="dot"></i>${esc(b.name)}</span><button class="icon-btn sm fav ${on ? 'on' : ''}" data-act="favTerm" data-id="${esc(t.id)}" aria-pressed="${on}" aria-label="المفضلة: ${esc(t.t)}" title="${on ? 'في المفضلة' : 'أضف للمفضلة'}">${icon('star')}</button></div><p>${mark(t.d)}</p></div>`; }).join('') : `<div class="card span2">${br === 'fav' && !nq ? empty('star', 'لا مفضلة بعد', 'اضغط النجمة بجانب أي مصطلح لحفظه هنا.').s : empty('glossary', 'لا نتائج', 'جرّب كلمة أخرى.').s}</div>`;
  };
  q.oninput = draw;
  const gs = $('#gbs', el);
  $$('#gb button', el).forEach(b => b.onclick = () => { br = b.dataset.b; if (gs) gs.value = ''; $$('#gb button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  if (gs) gs.onchange = () => { br = gs.value; $$('#gb button', el).forEach(x => x.classList.toggle('on', x.dataset.b === '' && !br)); draw(); };
  draw();
}

/* ---------- المختبر ---------- */
let labRAF = 0;
function runLab(el, start) {
  const cv = $('#lab', el), ctl = $('#labCtl', el), x = cv.getContext('2d');
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  let W = 0, H = 0;
  const fit = () => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); };
  fit(); window.addEventListener('resize', fit);
  const slider = (id, label, min, max, step, val, unit) => `<label><span>${label}<b class="num" id="${id}v">${val} ${unit}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const labs = {
    ohm() {
      ctl.innerHTML = slider('V', 'الجهد', 1, 24, 1, 12, 'فولت') + slider('R', 'المقاومة', 1, 50, 1, 6, 'أوم') + `<div class="readout"><div><b id="oI"></b><span>التيار (أمبير)</span></div><div><b id="oP"></b><span>القدرة (واط)</span></div><div><b class="f">ت = ج ÷ م</b><span>قانون أوم</span></div></div><p class="xs muted">زد الجهد ليزداد التيار، وزد المقاومة ليقل. لاحظ سرعة الإلكترونات وسطوع المصباح.</p>`;
      let t = 0; const els = [];
      for (let k = 0; k < 26; k++) els.push(k / 26);
      return () => {
        const V = +$('#V').value, R = +$('#R').value, I = V / R; $('#Vv').textContent = V + ' فولت'; $('#Rv').textContent = R + ' أوم'; $('#oI').textContent = I.toFixed(2); $('#oP').textContent = (V * I).toFixed(1);
        x.clearRect(0, 0, W, H); const m = 40, w = W - m * 2, h = H - m * 2;
        x.strokeStyle = css('--ink-2'); x.lineWidth = 3; x.strokeRect(m, m, w, h);
        // بطارية
        x.fillStyle = css('--surface'); x.fillRect(m - 14, m + h / 2 - 30, 28, 60); x.strokeRect(m - 14, m + h / 2 - 30, 28, 60);
        x.fillStyle = css('--ink'); x.font = '600 13px IBM Plex Sans Arabic'; x.textAlign = 'center'; x.fillText(V + 'V', m, m + h / 2 + 5);
        // مقاومة (متعرجة)
        const rx = m + w / 2, ry = m + h; x.fillStyle = css('--surface-2'); x.fillRect(rx - 50, ry - 10, 100, 20);
        x.beginPath(); x.strokeStyle = css('--danger'); for (let k = 0; k <= 10; k++) x.lineTo(rx - 45 + k * 9, ry + (k % 2 ? -9 : 9)); x.stroke();
        x.fillStyle = css('--ink'); x.fillText(R + 'Ω', rx, ry + 30);
        // مصباح
        const bx = m + w / 2, by = m, glow = Math.min(1, I / 4);
        const g = x.createRadialGradient(bx, by, 4, bx, by, 26 + glow * 60); g.addColorStop(0, `rgba(255,200,80,${.3 + glow * .7})`); g.addColorStop(1, 'rgba(255,200,80,0)');
        x.fillStyle = g; x.beginPath(); x.arc(bx, by, 26 + glow * 60, 0, 7); x.fill();
        x.fillStyle = `rgba(255,${190 + glow * 50},${80 + glow * 60},1)`; x.beginPath(); x.arc(bx, by, 16, 0, 7); x.fill(); x.strokeStyle = css('--ink-2'); x.stroke();
        // إلكترونات
        t += I * 0.0025; const per = 2 * (w + h);
        x.fillStyle = css('--focus');
        els.forEach(p0 => { let d = ((p0 + t) % 1) * per, px, py; if (d < w) { px = m + w - d; py = m + h; } else if ((d -= w) < h) { px = m; py = m + h - d; } else if ((d -= h) < w) { px = m + d; py = m; } else { d -= w; px = m + w; py = m + d; } x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); });
      };
    },
    proj() {
      ctl.innerHTML = slider('A', 'زاوية الإطلاق', 5, 85, 1, 45, '°') + slider('S', 'السرعة الابتدائية', 5, 40, 1, 22, 'م/ث') + slider('G', 'الجاذبية', 1.6, 24.8, 0.1, 9.8, 'م/ث²') + `<div class="readout"><div><b id="pR"></b><span>المدى (م)</span></div><div><b id="pH"></b><span>أقصى ارتفاع (م)</span></div><div><b id="pT"></b><span>زمن التحليق (ث)</span></div></div><div class="row wrap" style="gap:6px"><button class="btn sm" data-g="1.6">القمر</button><button class="btn sm" data-g="9.8">الأرض</button><button class="btn sm" data-g="3.7">المريخ</button><button class="btn sm" data-g="24.8">المشتري</button></div><button class="btn sci" id="fire">${icon('play').s}أطلق</button>`;
      $$('[data-g]', ctl).forEach(b => b.onclick = () => { $('#G').value = b.dataset.g; });
      let t0 = null; $('#fire').onclick = () => { t0 = performance.now(); };
      return () => {
        const a = +$('#A').value * Math.PI / 180, v = +$('#S').value, g = +$('#G').value;
        $('#Av').textContent = $('#A').value + '°'; $('#Sv').textContent = v + ' م/ث'; $('#Gv').textContent = g + ' م/ث²';
        const T = 2 * v * Math.sin(a) / g, Rg = v * v * Math.sin(2 * a) / g, Hm = (v * Math.sin(a)) ** 2 / (2 * g);
        $('#pR').textContent = Rg.toFixed(1); $('#pH').textContent = Hm.toFixed(1); $('#pT').textContent = T.toFixed(2);
        x.clearRect(0, 0, W, H); const m = 30, gy = H - m, sc = Math.min((W - m * 2) / Math.max(Rg, 10), (H - m * 2) / Math.max(Hm, 5)) * .92;
        x.strokeStyle = css('--line-2'); x.lineWidth = 2; x.beginPath(); x.moveTo(m, gy); x.lineTo(W - m, gy); x.stroke();
        x.setLineDash([5, 6]); x.strokeStyle = css('--sci'); x.beginPath();
        for (let k = 0; k <= 60; k++) { const tt = T * k / 60, px = m + v * Math.cos(a) * tt * sc, py = gy - (v * Math.sin(a) * tt - g * tt * tt / 2) * sc; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.setLineDash([]);
        let tt = t0 ? (performance.now() - t0) / 1000 * Math.max(1, T / 2.5) : 0; if (tt > T) { tt = T; }
        const px = m + v * Math.cos(a) * tt * sc, py = gy - (v * Math.sin(a) * tt - g * tt * tt / 2) * sc;
        x.fillStyle = css('--accent'); x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill();
        x.strokeStyle = css('--ink-2'); x.lineWidth = 3; x.beginPath(); x.moveTo(m, gy); x.lineTo(m + Math.cos(a) * 40, gy - Math.sin(a) * 40); x.stroke();
      };
    },
    matter() {
      ctl.innerHTML = slider('K', 'درجة الحرارة', -40, 160, 1, 20, '°س') + `<div class="readout"><div><b id="mS"></b><span>الحالة</span></div><div><b id="mE"></b><span>سرعة الجزيئات</span></div><div><b class="f">H₂O</b><span>الماء</span></div></div><p class="xs muted">الماء يتجمد عند 0° ويغلي عند 100° (عند ضغط جوي عادي). راقب كيف تتباعد الجزيئات مع ارتفاع الحرارة.</p>`;
      const P = Array.from({ length: 64 }, (_, k) => ({ gx: k % 8, gy: Math.floor(k / 8), x: 0, y: 0, vx: Math.random() - .5, vy: Math.random() - .5 }));
      let init = false;
      return () => {
        const K = +$('#K').value, st = K <= 0 ? 'صلب' : K < 100 ? 'سائل' : 'غاز', e = Math.max(.15, (K + 50) / 60);
        $('#Kv').textContent = K + ' °س'; $('#mS').textContent = st; $('#mE').textContent = e.toFixed(1) + '×';
        x.clearRect(0, 0, W, H); const cx = W / 2 - 8 * 12, cy = H - 30 - 8 * 24;
        if (!init) { P.forEach(p => { p.x = cx + p.gx * 24 + 12; p.y = cy + p.gy * 24 + 12; }); init = true; }
        x.strokeStyle = css('--line-2'); x.lineWidth = 2; x.strokeRect(20, 20, W - 40, H - 40);
        P.forEach(p => {
          if (st === 'صلب') { const hx = cx + p.gx * 24 + 12, hy = cy + p.gy * 24 + 12; p.x += (hx - p.x) * .15 + (Math.random() - .5) * e * 1.5; p.y += (hy - p.y) * .15 + (Math.random() - .5) * e * 1.5; }
          else { p.vx += (Math.random() - .5) * .3 * e; p.vy += (Math.random() - .5) * .3 * e + (st === 'سائل' ? .12 : 0); const lim = st === 'سائل' ? 1.6 * e : 3 * e; p.vx = Math.max(-lim, Math.min(lim, p.vx)); p.vy = Math.max(-lim, Math.min(lim, p.vy)); p.x += p.vx; p.y += p.vy;
            if (p.x < 30) { p.x = 30; p.vx *= -1; } if (p.x > W - 30) { p.x = W - 30; p.vx *= -1; } if (p.y > H - 30) { p.y = H - 30; p.vy *= -1; } const top = st === 'سائل' ? H * .45 : 30; if (p.y < top) { p.y = top; p.vy = Math.abs(p.vy); } }
          x.fillStyle = K <= 0 ? css('--sci') : K < 100 ? css('--focus') : css('--danger'); x.beginPath(); x.arc(p.x, p.y, 8, 0, 7); x.fill();
        });
      };
    }
  };
  Object.assign(labs, {
    force() {
      ctl.innerHTML = slider('F', 'القوة المؤثرة', 0, 100, 1, 40, 'نيوتن') + slider('M', 'الكتلة', 1, 50, 1, 10, 'كغ') + `<label class="switch" style="padding:0"><span>احتكاك مع الأرض</span><input type="checkbox" id="fr"></label><div class="readout"><div><b id="fA"></b><span>التسارع (م/ث²)</span></div><div><b id="fV"></b><span>السرعة (م/ث)</span></div><div><b class="f">ت = ق ÷ ك</b><span>نيوتن الثاني</span></div></div><button class="btn sci" id="fGo">${icon('reset').s}أعد الانطلاق</button>`;
      let pos = 0, v = 0, last = performance.now(); $('#fGo').onclick = () => { pos = 0; v = 0; };
      return () => {
        const F = +$('#F').value, M = +$('#M').value, fr = $('#fr').checked ? Math.min(F, .3 * M * 9.8) : 0, a = (F - fr) / M, now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
        v += a * dt; pos += v * dt * 18; if (pos > W - 140) { pos = 0; v = 0; }
        $('#Fv').textContent = F + ' نيوتن'; $('#Mv').textContent = M + ' كغ'; $('#fA').textContent = a.toFixed(2); $('#fV').textContent = v.toFixed(1);
        x.clearRect(0, 0, W, H); const gy = H * .7, sz = 30 + M * 1.4;
        x.strokeStyle = css('--line-2'); x.lineWidth = 2; x.beginPath(); x.moveTo(20, gy); x.lineTo(W - 20, gy); x.stroke();
        if (fr) { x.strokeStyle = css('--line'); for (let k = 20; k < W - 20; k += 14) { x.beginPath(); x.moveTo(k, gy); x.lineTo(k - 8, gy + 8); x.stroke(); } }
        const bx = W - 60 - pos - sz; x.fillStyle = css('--sci'); x.fillRect(bx, gy - sz, sz, sz); x.fillStyle = '#fff'; x.font = '600 13px IBM Plex Sans Arabic'; x.textAlign = 'center'; x.fillText(M + ' كغ', bx + sz / 2, gy - sz / 2 + 5);
        if (F) { const L = 20 + F * 1.2; x.strokeStyle = css('--accent'); x.fillStyle = css('--accent'); x.lineWidth = 4; x.beginPath(); x.moveTo(bx + sz + L, gy - sz / 2); x.lineTo(bx + sz + 6, gy - sz / 2); x.stroke(); x.beginPath(); x.moveTo(bx + sz + 4, gy - sz / 2); x.lineTo(bx + sz + 16, gy - sz / 2 - 8); x.lineTo(bx + sz + 16, gy - sz / 2 + 8); x.fill(); x.fillStyle = css('--ink'); x.fillText(F + ' N', bx + sz + L / 2 + 6, gy - sz / 2 - 14); }
      };
    },
    speed() {
      ctl.innerHTML = slider('A1', 'سرعة العدّاء الأول', 1, 12, .5, 8, 'م/ث') + slider('A2', 'سرعة العدّاء الثاني', 1, 12, .5, 6, 'م/ث') + slider('D', 'طول السباق', 50, 400, 50, 100, 'م') + `<div class="readout"><div><b id="sT1"></b><span>زمن الأول (ث)</span></div><div><b id="sT2"></b><span>زمن الثاني (ث)</span></div><div><b class="f">ز = ف ÷ س</b><span>الزمن</span></div></div><button class="btn sci" id="sGo">${icon('play').s}ابدأ السباق</button>`;
      let t0 = null; $('#sGo').onclick = () => { t0 = performance.now(); };
      return () => {
        const v1 = +$('#A1').value, v2 = +$('#A2').value, D = +$('#D').value, T1 = D / v1, T2 = D / v2, sp = Math.max(1, Math.min(T1, T2) / 4);
        $('#A1v').textContent = v1 + ' م/ث'; $('#A2v').textContent = v2 + ' م/ث'; $('#Dv').textContent = D + ' م'; $('#sT1').textContent = T1.toFixed(1); $('#sT2').textContent = T2.toFixed(1);
        const t = t0 ? (performance.now() - t0) / 1000 * sp : 0; x.clearRect(0, 0, W, H);
        const L = 40, R = W - 40, lane = (i, v, T, c, n) => { const y = H * (i ? .66 : .34), p = Math.min(1, v * t / D), px = R - p * (R - L);
          x.strokeStyle = css('--line'); x.lineWidth = 2; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(L, y + 22); x.lineTo(R, y + 22); x.stroke(); x.setLineDash([]);
          x.fillStyle = c; x.beginPath(); x.arc(px, y, 14, 0, 7); x.fill(); x.fillStyle = css('--ink'); x.font = '600 12px IBM Plex Sans Arabic'; x.textAlign = 'center'; x.fillText(n, px, y - 22);
          if (t0 && p >= 1) x.fillText('وصل في ' + T.toFixed(1) + ' ث', L + 50, y + 5); };
        x.fillStyle = css('--danger'); x.fillRect(L - 3, H * .2, 4, H * .62);
        lane(0, v1, T1, css('--accent'), 'الأول'); lane(1, v2, T2, css('--focus'), 'الثاني');
        x.fillStyle = css('--muted'); x.font = '12px IBM Plex Sans Arabic'; x.textAlign = 'center'; x.fillText('الزمن: ' + Math.min(t, Math.max(T1, T2)).toFixed(1) + ' ث', W / 2, H - 14);
      };
    },
    density() {
      const MAT = [['خشب', .6, '#B9804A'], ['ثلج', .92, '#BFE3F2'], ['بلاستيك', 1.2, '#E4A23C'], ['ألمنيوم', 2.7, '#A9B1BB'], ['حديد', 7.9, '#6B7280'], ['فلين', .24, '#D9B98A']];
      ctl.innerHTML = `<label><span>المادة</span></label><div class="row wrap" style="gap:6px" id="dM">${MAT.map((m, i) => `<button class="btn sm ${i ? '' : 'primary'}" data-i="${i}">${m[0]}</button>`).join('')}</div>` + slider('L', 'كثافة السائل', .7, 1.4, .01, 1, 'غ/سم³') + `<div class="row wrap" style="gap:6px"><button class="btn sm" data-lq=".79">كحول</button><button class="btn sm" data-lq="1">ماء عذب</button><button class="btn sm" data-lq="1.03">ماء البحر</button><button class="btn sm" data-lq="1.26">جلسرين</button></div><div class="readout"><div><b id="dD"></b><span>كثافة الجسم</span></div><div><b id="dS"></b><span>النتيجة</span></div><div><b id="dP"></b><span>المغمور منه</span></div></div>`;
      let mi = 0, y = 0; $$('#dM button', ctl).forEach(b => b.onclick = () => { mi = +b.dataset.i; $$('#dM button', ctl).forEach(z => z.classList.toggle('primary', z === b)); y = 0; });
      $$('[data-lq]', ctl).forEach(b => b.onclick = () => { $('#L').value = b.dataset.lq; y = 0; });
      return () => {
        const [n, d, c] = MAT[mi], L = +$('#L').value, sub = Math.min(1, d / L), sink = d > L; $('#Lv').textContent = L.toFixed(2) + ' غ/سم³';
        $('#dD').textContent = d; $('#dS').textContent = sink ? 'يغوص' : d === L ? 'معلّق' : 'يطفو'; $('#dP').textContent = Math.round(sub * 100) + '%';
        x.clearRect(0, 0, W, H); const top = H * .35, bot = H - 24, sz = 64, cx = W / 2;
        x.globalAlpha = .16 + (L - .7) * .4; x.fillStyle = css('--sci'); x.fillRect(40, top, W - 80, bot - top); x.globalAlpha = 1;
        x.strokeStyle = css('--line-2'); x.lineWidth = 2; x.strokeRect(40, 20, W - 80, bot - 20);
        const target = sink ? bot - sz : top - sz + sub * sz; y += (target - (y || 30)) * .06; if (!y) y = 30;
        x.fillStyle = c; x.fillRect(cx - sz / 2, y, sz, sz); x.strokeStyle = css('--ink-2'); x.strokeRect(cx - sz / 2, y, sz, sz);
        x.fillStyle = css('--ink'); x.font = '600 13px IBM Plex Sans Arabic'; x.textAlign = 'center'; x.fillText(n, cx, y + sz / 2 + 5);
      };
    }
  });
  let frame = null;
  const pickLab = n => { frame = labs[n](); };
  $$('#labSel button', el).forEach(b => b.onclick = () => { $$('#labSel button', el).forEach(z => z.classList.toggle('on', z === b)); pickLab(b.dataset.l); });
  const st = labs[start] ? start : 'ohm'; $$('#labSel button', el).forEach(z => z.classList.toggle('on', z.dataset.l === st)); pickLab(st);
  cancelAnimationFrame(labRAF);
  const loop = () => { if (!document.body.contains(cv)) { window.removeEventListener('resize', fit); return; } try { frame && frame(); } catch (e) {} labRAF = requestAnimationFrame(loop); };
  loop();
}

/* ---------- النجوم في الواجهة ---------- */
function stars(cv) {
  const x = cv.getContext('2d'), d = window.devicePixelRatio || 1; let W, H;
  const fit = () => { W = cv.offsetWidth; H = cv.offsetHeight; cv.width = W * d; cv.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); };
  fit();
  const S = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + .3, p: Math.random() * 6 }));
  const orb = { a: 0 };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = t => {
    if (!document.body.contains(cv)) return;
    x.clearRect(0, 0, W, H);
    S.forEach(s => { x.globalAlpha = .35 + .5 * Math.abs(Math.sin(s.p + t / 1400)); x.fillStyle = '#fff'; x.beginPath(); x.arc(s.x * W, s.y * H, s.r, 0, 7); x.fill(); });
    x.globalAlpha = .5; x.strokeStyle = '#9C8FFF'; x.lineWidth = 1;
    const cx = W * .12, cy = H * .8; x.beginPath(); x.ellipse(cx, cy, 120, 44, -.3, 0, 7); x.stroke();
    orb.a += .01; x.globalAlpha = 1; x.fillStyle = '#F0A04B'; const ox = cx + Math.cos(orb.a) * 120 * Math.cos(-.3) - Math.sin(orb.a) * 44 * Math.sin(-.3), oy = cy + Math.cos(orb.a) * 120 * Math.sin(-.3) + Math.sin(orb.a) * 44 * Math.cos(-.3);
    x.beginPath(); x.arc(ox, oy, 5, 0, 7); x.fill(); x.fillStyle = '#FFD27A'; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.fill();
    if (!still) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

let keyTarget = null;
export function mount(el, params = {}, sub = []) {
  keyTarget = null;
  const [page] = sub;
  const st = $('#stars', el); if (st) stars(st);
  const lq = $('#lessonQuiz', el);
  if (lq) {
    const l = lesson(lq.dataset.lesson), qs = l.q.map(q => { const idx = shuffle(q.o.map((_, i) => i)); return Object.assign({}, q, { o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) }); });
    runQuiz(lq, qs, { label: 'تحقق من فهمك', onDone: (s, n) => { const first = !done(l.id); upsert('lessons', { id: l.id, at: today(), score: s }); upsert('quizzes', { day: today(), score: s, total: n, b: l.b, lesson: l.id }); if (first) toast('أنهيت الدرس! +25 نقطة'); } });
    keyTarget = lq;
  }
  if (page === 'quiz') { const root = $('#quizRoot', el); const wr = params.m === 'wrong'; const mqm = params.m === 'mq', mix = q => { const idx = shuffle(q.o.map((_, i) => i)); return Object.assign({}, q, { o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) }); };
    const qs = mqm ? shuffle(ministryPool(params.b ? [params.b] : stageSubjects(profile()).length ? stageSubjects(profile()) : Object.keys(SUBJ))).slice(0, Number(params.n) || 10).map(mix) : wr ? shuffle(wrongs().slice(0, 15)).map(q => { const idx = shuffle(q.o.map((_, i) => i)); return Object.assign({}, q, { o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) }); }) : buildQuiz(params.b || '', Number(params.n) || 10); const qn = $('#qN', el); if (qn) qn.onchange = () => { const q = new URLSearchParams(); if (params.m === 'mq') q.set('m', 'mq'); if (params.b) q.set('b', params.b); q.set('n', qn.value); location.hash = '#/science/quiz?' + q; };
    const qb = $('#qB', el); if (qb) qb.onchange = () => { location.hash = '#/science/quiz' + (qb.value ? '?b=' + qb.value : ''); }; if (!qs.length) { root.className = 'card'; root.innerHTML = (mqm ? empty('trophy', 'لا أسئلة وزارية لهذه المادة بعد', 'جرّب مادة أخرى أو اختباراً عادياً.') : empty('check', 'لا أخطاء للمراجعة', 'أحسنت! جرّب اختباراً جديداً.')).s; return; } root.className = 'card'; runQuiz(root, qs, { label: mqm ? 'على نمط أسئلة الوزارة' : wr ? 'مراجعة الأخطاء' : params.b && branch(params.b) ? branch(params.b).name : 'اختبار شامل', onDone: (s, n) => upsert('quizzes', { day: today(), score: s, total: n, b: params.b || '', mq: mqm || undefined }) }); keyTarget = root; }
  if (page === 'cards') { const root = $('#cardsRoot', el); runCards(root); keyTarget = root; }
  if (page === 'glossary') runGlossary(el);
  if (page === 'lab') { runLab(el, params.l); runChallenge(el); }
  if (page === 'tools') runTools(el, params);
  if (page === 'lesson' && sub[1] && lesson(sub[1]) && profile().lastLesson !== sub[1]) setProfile({ lastLesson: sub[1] });
}
export function keys(e) { return keyTarget && keyTarget._key ? keyTarget._key(e) : false; }
