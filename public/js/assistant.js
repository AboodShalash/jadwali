/* مساعد جدولي الذكي: يفهم أسئلة شائعة بالعربية ويجيب من بياناتك مباشرة، بلا إنترنت */
import { html, raw, today, addDays, niceDate, t12, fromMin, fmtMin, norm, DAYS, weekday, $ } from './util.js';
import { icon } from './icons.js';
import { all, profile, subject, get, apiFetch, sync } from './store.js';
import { eventsOn, exams, focusOn, focusRange, streak, level, cardDue, dayPlan, freeSlots, parseTask, lastDays } from './logic.js';
import { modal, toast } from './ui.js';
import { quickAddTask } from './forms.js';
import { LAWS } from './views/science.js';

const has = (q, ...w) => w.some(x => q.includes(norm(x)));
const sub = id => (subject(id) || {}).name || '';
const TIPS = ['ابدأ بأصعب مادة في أول جلسة تركيز باليوم.', 'قسّم الدرس إلى أجزاء صغيرة، ثم اختبر نفسك دون النظر إلى الكتاب.', 'اشرح الدرس بصوتك لشخص آخر؛ الثغرات تظهر فوراً.', 'خمس دقائق من البطاقات يومياً أفضل من ساعة قبل الاختبار.', 'ضع الهاتف في غرفة ثانية خلال جلسة التركيز.', 'نم جيداً قبل الاختبار؛ الدماغ يثبّت المعلومات أثناء النوم.'];

function whichDay(q) {
  if (has(q, 'بعد بكرة', 'بعد بكره', 'بعد غد')) return addDays(today(), 2);
  if (has(q, 'بكرة', 'بكره', 'غدا', 'غداً', 'الغد', 'بكرا')) return addDays(today(), 1);
  for (let i = 0; i < 7; i++) if (q.includes(norm(DAYS[i]).replace(/^ال/, ''))) { let d = (i - weekday(today()) + 7) % 7; return addDays(today(), d); }
  if (has(q, 'اليوم', 'هسا', 'الحين')) return today();
  return null;
}
function dayReport(d) {
  const ev = eventsOn(d), tk = all('tasks').filter(t => !t.done && t.due === d), lbl = d === today() ? 'اليوم' : niceDate(d);
  if (!ev.length && !tk.length) return html`<p>${lbl} فاضي تماماً: لا حصص ولا مهام. فرصة ممتازة لمراجعة أو جلسة تركيز.</p>`;
  return html`${ev.length ? html`<p><b>${lbl} عندك ${ev.length} ${ev.length === 1 ? 'موعد' : 'مواعيد'}:</b></p><ul>${ev.map(e => html`<li>${t12(e.start)} – ${t12(e.end)} · ${e.title}${e.type === 'exam' ? ' (اختبار)' : ''}</li>`)}</ul>` : html`<p>لا حصص ${lbl}.</p>`}
    ${tk.length ? html`<p><b>ومهام مستحقة:</b></p><ul>${tk.map(t => html`<li>${t.title}${t.priority === 'high' ? ' — عالية' : ''}</li>`)}</ul>` : ''}`;
}
const INTENTS = [
  { k: 'add', t: q => /^(اضف|ضيف|سجل|ذكرني)\s/.test(q), a: (q, raw_) => { const text = raw_.replace(/^\s*(أضف|اضف|ضيف|سجل|سجّل|ذكرني|ذكّرني)\s+(مهمة\s+)?/, ''); const p = parseTask(text); quickAddTask(text); return html`<p>تمام، أضفت المهمة <b>«${p.title}»</b> — ${niceDate(p.due || today())}${sub(p.subjectId) ? ' · ' + sub(p.subjectId) : ''}.</p>`; } },
  { k: 'law', t: q => has(q, 'قانون', 'قوانين', 'معادلة', 'كيف احسب', 'كيف أحسب'), a: q => { const hit = LAWS.filter(x => q.includes(norm(x.n).replace(/^قانون /, '').replace(/^ال/, '').slice(0, 5))); const ls = hit.length ? hit : LAWS.slice(0, 5); return html`${hit.length ? '' : html`<p>هذه أهم القوانين (اكتب اسم القانون لأعطيك تفاصيله):</p>`}<ul>${ls.map(x => html`<li><b>${x.n}:</b> <span dir="rtl">${x.f}</span>${hit.length ? html` — ${x.d}` : ''}</li>`)}</ul>${hit.length && hit[0].calc ? html`<a class="btn sm" href="#/science/tools?c=${hit[0].calc}">${icon('calc')}احسبها الآن</a>` : html`<a class="btn sm" href="#/science/tools">كل القوانين</a>`}`; } },
  { k: 'free', t: q => has(q, 'فاضي', 'فراغ', 'وقت فاضي', 'وقتي الفاضي', 'متى فاضي'), a: q => { const d = whichDay(q) || today(), fs = freeSlots(d); const tot = fs.reduce((a, [s, e]) => a + e - s, 0); return fs.length ? html`<p>وقتك الفاضي ${d === today() ? 'اليوم' : niceDate(d)}: <b>${fmtMin(tot)}</b></p><ul>${fs.map(([s, e]) => html`<li>${t12(fromMin(s))} – ${t12(fromMin(e))} (${fmtMin(e - s)})</li>`)}</ul>` : html`<p>ما في وقت فاضي كافي ${d === today() ? 'باقي اليوم' : 'في ذلك اليوم'} ضمن ساعات دراستك.</p>`; } },
  { k: 'plan', t: q => has(q, 'خطة', 'خطط', 'نظم', 'رتب', 'شو ادرس', 'ماذا ادرس', 'شو أذاكر', 'اذاكر'), a: q => { const d = whichDay(q) || today(), p = dayPlan(d); return p.blocks.length ? html`<p>اقتراحي ${d === today() ? 'لباقي اليوم' : d === addDays(today(), 1) ? 'لبكرة' : 'ليوم ' + niceDate(d)} (${fmtMin(p.total)}):</p><ul>${p.blocks.map(b => html`<li>${t12(fromMin(b.start))} · ${b.title} <span class="muted">(${b.why})</span></li>`)}</ul><a class="btn sm" href="#/today">${icon('sparkle')}افتح خطة اليوم</a>` : html`<p>ما عندك شي مستعجل. جرّب مراجعة البطاقات أو تقدّم في درس علوم جديد.</p>`; } },
  { k: 'late', t: q => has(q, 'متاخر', 'متأخر', 'فاتني', 'تأخرت'), a: () => { const l = all('tasks').filter(t => !t.done && t.due && t.due < today()); return l.length ? html`<p>عندك <b>${l.length}</b> ${l.length === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'}:</p><ul>${l.slice(0, 8).map(t => html`<li>${t.title} — ${niceDate(t.due)}</li>`)}</ul><a class="btn sm" href="#/tasks">انقلها لليوم من صفحة المهام</a>` : html`<p>ولا مهمة متأخرة. ممتاز!</p>`; } },
  { k: 'exam', t: q => has(q, 'اختبار', 'امتحان', 'اختبارات', 'امتحانات', 'فحص'), a: () => { const x = exams(120).slice(0, 5); if (!x.length) return html`<p>ما في اختبارات قادمة بجدولك. أضفها من صفحة الاختبارات.</p>`; return html`<ul>${x.map(e => { const pl = all('tasks').filter(t => t.examId === e.id), dn = pl.filter(t => t.done).length; return html`<li><b>${e.title}</b> — ${e.left === 0 ? 'اليوم' : e.left === 1 ? 'بكرة' : e.left === 2 ? 'بعد يومين' : 'بعد ' + e.left + (e.left <= 10 ? ' أيام' : ' يوماً')} (${niceDate(e.on)})${pl.length ? ` · الخطة ${dn}/${pl.length}` : ' · بلا خطة مراجعة'}</li>`; })}</ul>${x.some(e => !all('tasks').some(t => t.examId === e.id)) ? html`<a class="btn sm" href="#/exams">أنشئ خطة مراجعة</a>` : ''}`; } },
  { k: 'focus', t: q => has(q, 'ركزت', 'تركيز', 'درست', 'ذاكرت', 'دقائق', 'ساعات'), a: () => { const p = profile(), f = focusOn(today()), w = focusRange(lastDays(7)); return html`<p>اليوم ركزت <b>${fmtMin(f)}</b> من هدف ${fmtMin(p.focusGoal || 120)} (${Math.round(f / (p.focusGoal || 120) * 100)}%).</p><p>آخر 7 أيام: <b>${fmtMin(w)}</b> · سلسلتك ${streak()} ${streak() === 1 ? 'يوم' : 'أيام'}.</p>${f < (p.focusGoal || 120) ? html`<a class="btn sm" href="#/focus">${icon('play')}ابدأ جلسة الآن</a>` : ''}`; } },
  { k: 'grade', t: q => has(q, 'معدل', 'علامات', 'علاماتي', 'درجات', 'اضعف', 'أضعف', 'اقوى', 'أقوى'), a: () => { const by = {}; all('grades').forEach(g => { const b = by[g.subjectId] = by[g.subjectId] || [0, 0], w = Number(g.weight) || 1; b[0] += g.score / g.max * 100 * w; b[1] += w; }); const l = Object.entries(by).filter(([k]) => subject(k)).map(([k, [s, w]]) => [sub(k), s / w]).sort((a, b) => b[1] - a[1]); if (!l.length) return html`<p>ما سجّلت علامات بعد. سجّلها من صفحة العلامات لأحسب معدلك.</p>`; const ov = l.reduce((a, x) => a + x[1], 0) / l.length; return html`<p>معدلك التقريبي <b>${Math.round(ov * 10) / 10}%</b>.</p><p>الأقوى: <b>${l[0][0]}</b> (${Math.round(l[0][1])}%) · الأضعف: <b>${l[l.length - 1][0]}</b> (${Math.round(l[l.length - 1][1])}%).</p><p class="muted">نصيحتي: جلسة تركيز إضافية أسبوعياً لـ${l[l.length - 1][0]}.</p>`; } },
  { k: 'habit', t: q => has(q, 'عادة', 'عادات', 'عاداتي'), a: () => { const h = all('habits'), d = today(), dn = h.filter(x => (x.days || {})[d]); return h.length ? html`<p>أنجزت ${dn.length} من ${h.length} عادات اليوم.</p>${h.length > dn.length ? html`<ul>${h.filter(x => !(x.days || {})[d]).map(x => html`<li>${x.title}</li>`)}</ul>` : ''}` : html`<p>ما عندك عادات. أضف عادة صغيرة وثابتة من صفحة العادات.</p>`; } },
  { k: 'cards', t: q => has(q, 'بطاقات', 'بطاقة', 'مراجعة العلوم'), a: () => { const n = all('cards').filter(c => cardDue(c)).length; return html`<p>${n ? `عندك <b>${n}</b> بطاقة مستحقة للمراجعة.` : 'ما في بطاقات مستحقة الآن.'}</p><a class="btn sm" href="#/science/cards">${icon('cards')}افتح البطاقات</a>`; } },
  { k: 'level', t: q => has(q, 'مستوى', 'نقاط', 'مستواي', 'xp'), a: () => { const l = level(); return html`<p>أنت بالمستوى <b>${l.lv} · ${l.name}</b> ومعك ${l.total} نقطة. باقي ${l.need - l.into} للمستوى التالي.</p>`; } },
  { k: 'tip', t: q => has(q, 'نصيحة', 'نصيحه', 'حفزني', 'تحفيز', 'ملل', 'زهقت', 'تعبت'), a: () => html`<p>${TIPS[Math.floor(Math.random() * TIPS.length)]}</p><p class="muted">وتذكر: خطوة صغيرة الآن أفضل من خطة كبيرة لاحقاً.</p>` },
  { k: 'day', t: q => !!whichDay(q) || has(q, 'جدول', 'حصص', 'عندي'), a: q => dayReport(whichDay(q) || today()) },
  { k: 'hi', t: q => has(q, 'مرحبا', 'اهلا', 'السلام', 'هاي', 'كيفك'), a: () => html`<p>أهلاً ${profile().name || ''}! اسألني عن يومك، اختباراتك، وقتك الفاضي، معدلك، أو قل «أضف مهمة …».</p>` }
];
export function answer(text) {
  const q = ' ' + norm(text) + ' ', q0 = norm(text).trim();
  for (const it of INTENTS) if (it.t(it.k === 'add' ? q0 : q)) return { k: it.k, h: it.a(q, text) };
  return { k: 'none', h: html`<p>ما فهمت عليك تماماً. جرّب مثلاً:</p><ul><li>شو عندي بكرة؟</li><li>متى وقتي الفاضي اليوم؟</li><li>كم ركزت اليوم؟</li><li>أضف مهمة حل واجب الرياضيات بكرة</li></ul>` };
}
/* ---------- ذكاء اصطناعي اختياري: يُستدعى عبر الخادم عندما لا تفهم القواعد السؤال ---------- */
let AI = null; // null = لم يُفحص، true/false
async function aiAvailable() {
  if (AI !== null) return AI;
  try { const r = await apiFetch('/ai/status'); AI = !!(r && r.ai); } catch (e) { AI = false; }
  return AI;
}
function studentContext() {
  const p = profile(), d = today(), L = [];
  L.push('الاسم: ' + (p.name || 'غير معروف') + (p.stage ? ' · المرحلة: ' + p.stage + (p.sgrade ? ' ' + p.sgrade : '') + (p.field ? ' ' + p.field : '') : ''));
  L.push('اليوم: ' + d + ' (' + DAYS[weekday(d)] + ')');
  L.push('المواد: ' + all('subjects').map(s => s.name).join('، '));
  const ev = eventsOn(d).map(e => t12(e.start) + ' ' + e.title).slice(0, 10); if (ev.length) L.push('مواعيد اليوم: ' + ev.join(' | '));
  const ex = exams(60).slice(0, 6).map(e => e.title + ' بعد ' + e.left + ' يوم'); if (ex.length) L.push('اختبارات قادمة: ' + ex.join(' | '));
  const tk = all('tasks').filter(t => !t.done).slice(0, 12).map(t => t.title + (t.due ? ' (' + t.due + ')' : '')); if (tk.length) L.push('مهام مفتوحة: ' + tk.join(' | '));
  L.push('تركيز اليوم: ' + focusOn(d) + ' د · آخر 7 أيام: ' + focusRange(lastDays(7)) + ' د · سلسلة: ' + streak() + ' يوم');
  return L.join('\n').slice(0, 5500);
}
let aiHist = [];
async function askAI(q) {
  const r = await apiFetch('/ai/ask', { method: 'POST', body: JSON.stringify({ q, ctx: studentContext(), hist: aiHist.slice(-6) }) });
  aiHist.push({ r: 'user', t: q }, { r: 'assistant', t: r.text }); aiHist = aiHist.slice(-12);
  return html`${r.text.split(/\n{1,}/).filter(Boolean).map(x => html`<p>${x}</p>`)}<p class="xs muted">إجابة ذكاء اصطناعي — تحقّق من المعلومات المهمة.</p>`;
}
const SUGG = ['شو عندي اليوم؟', 'قانون الكثافة', 'متى وقتي الفاضي؟', 'اقترح خطة لبكرة', 'متى اختباري الجاي؟', 'كم ركزت اليوم؟', 'شو معدلي؟', 'المهام المتأخرة', 'أعطني نصيحة'];
let history = [];
export function openAssistant(first = '') {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const m = modal(html`<div class="chat" id="chat"><div class="msgs" id="msgs" aria-live="polite"></div>
    <div class="sugg" id="sugg">${SUGG.map(s => html`<button type="button" class="chip">${s}</button>`)}</div>
    <form class="chat-in" id="chF"><input class="input grow" name="q" placeholder="اسأل عن جدولك، مهامك، اختباراتك…" autocomplete="off" aria-label="سؤالك">${SR ? html`<button type="button" class="btn ghost" id="chMic" aria-label="إدخال صوتي" title="إدخال صوتي">${icon('mic')}</button>` : ''}<button class="btn primary" aria-label="إرسال">${icon('arrowL')}</button></form></div>`, { title: 'مساعد جدولي الذكي', cls: 'assist' });
  const box = $('#msgs', m.body), f = $('#chF', m.body);
  if (SR) {
    const rec = new SR(); rec.lang = 'ar-JO'; rec.interimResults = false; rec.maxAlternatives = 1;
    const micBtn = $('#chMic', m.body);
    let listening = false;
    rec.onresult = e => { const t = e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : ''; if (t) f.q.value = t; };
    rec.onend = () => { listening = false; micBtn.classList.remove('on'); };
    rec.onerror = () => { listening = false; micBtn.classList.remove('on'); toast('تعذّر التعرّف على الصوت'); };
    micBtn.onclick = () => { if (listening) { rec.stop(); return; } listening = true; micBtn.classList.add('on'); try { rec.start(); } catch (e) { listening = false; micBtn.classList.remove('on'); } };
  }
  const push = (who, h) => { history.push([who, h]); history = history.slice(-30); box.insertAdjacentHTML('beforeend', `<div class="msg ${who}">${h}</div>`); box.scrollTop = box.scrollHeight; };
  if (!history.length) push('bot', html`<p>أهلاً ${profile().name || ''}! أنا مساعدك الدراسي. أعرف جدولك ومهامك وعلاماتك، واسألني أي شي عنها.</p>`.s);
  else history.forEach(([w, h]) => box.insertAdjacentHTML('beforeend', `<div class="msg ${w}">${h}</div>`));
  box.scrollTop = box.scrollHeight;
  const ask = async t => {
    t = t.trim(); if (!t) return; push('me', html`<p>${t}</p>`.s); const r = answer(t);
    if (r.k === 'none' && await aiAvailable()) {
      const wait = document.createElement('div'); wait.className = 'msg bot typing'; wait.textContent = 'يكتب…'; box.appendChild(wait); box.scrollTop = box.scrollHeight;
      try { const h = await askAI(t); wait.remove(); push('bot', h.s); }
      catch (e) { wait.remove(); push('bot', html`<p>${e.status === 429 || e.status === 502 ? e.message : 'تعذّر الوصول للمساعد الذكي الآن.'}</p>`.s + r.h.s); }
      return;
    }
    setTimeout(() => { push('bot', r.h.s); if (r.k === 'add') window.__refresh(); }, 220);
  };
  f.onsubmit = e => { e.preventDefault(); ask(f.q.value); f.q.value = ''; f.q.focus(); };
  m.body.querySelectorAll('#sugg button').forEach(b => b.onclick = () => ask(b.textContent));
  box.addEventListener('click', e => { if (e.target.closest('a')) m.close(); });
  setTimeout(() => f.q.focus(), 60);
  if (first) ask(first);
}
