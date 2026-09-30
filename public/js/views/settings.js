import { html, raw, today, $, $$, niceDate, weekday } from '../util.js';
import { icon } from '../icons.js';
import { profile, setProfile, sync, register, login, logout, S, replaceAll, wipe, flush, resetProgress, all, sendFeedback } from '../store.js';
import { level, streak } from '../logic.js';
import { act, toast, confirmBox, formData, modal } from '../ui.js';
import { intro } from '../parts.js';
import { stageLabel } from '../curriculum.js';

export const title = 'الإعدادات';
const ACCENTS = { saffron: ['زعفران', '#CF7A22'], mint: ['نعناع', '#1D8174'], violet: ['بنفسجي', '#6454C9'], coral: ['مرجاني', '#C9533F'] };
const STATUS = { synced: 'متزامن مع السحابة', syncing: 'جارٍ المزامنة…', offline: 'غير متصل — التغييرات محفوظة على جهازك', local: 'وضع محلي — الخادم غير متاح', error: 'خطأ في المزامنة', idle: 'جارٍ الاتصال…' };
export { STATUS };

act('setTheme', el => { setProfile({ theme: el.dataset.v }); window.__applyTheme(); window.__refresh(); });
act('setAccent', el => { setProfile({ accent: el.dataset.v }); window.__applyTheme(); window.__refresh(); });
act('exportData', () => {
  const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'jadwali-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  toast('نُزّلت نسخة احتياطية');
});
act('importData', () => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
  i.onchange = async () => {
    try {
      const d = JSON.parse(await i.files[0].text());
      if (!d || typeof d !== 'object' || !d.profile) throw 0;
      if (!(await confirmBox('استبدال بياناتك الحالية بالنسخة المستوردة؟', { ok: 'استيراد', danger: true }))) return;
      replaceAll(d); window.__applyTheme(); toast('استُوردت البيانات'); window.__refresh();
    } catch (e) { toast('الملف غير صالح'); }
  };
  i.click();
});
act('wipeData', async () => { if (await confirmBox('حذف كل البيانات نهائياً (من هذا الجهاز والسحابة)؟ لا يمكن التراجع.', { ok: 'حذف الكل', danger: true })) { wipe(); toast('بدأت من جديد'); location.hash = '#/today'; } });
act('openAccount', () => accountModal());
const notifState = () => !('Notification' in window) ? 'إشعارات الجهاز غير مدعومة هنا — ستظهر التذكيرات داخل التطبيق.' : Notification.permission === 'granted' ? 'إشعارات الجهاز مفعّلة.' : Notification.permission === 'denied' ? 'إشعارات الجهاز محظورة من المتصفح — ستظهر التذكيرات داخل التطبيق فقط.' : 'تظهر التذكيرات داخل التطبيق، ويمكنك تفعيل إشعارات الجهاز أيضاً.';
act('askNotif', async () => { try { await Notification.requestPermission(); } catch (e) {} window.__refresh(); });
act('doLogout', async () => { if (await confirmBox('تسجيل الخروج؟ ستبقى بياناتك محفوظة في حسابك.', { ok: 'خروج' })) { await logout(); toast('سُجّل الخروج'); window.__refresh(); } });
act('syncNow', async () => { await flush(); toast(STATUS[sync.status] || 'تمت'); window.__refresh(); });

export function accountModal(mode = 'register') {
  const m = modal(html`<div class="seg" style="margin-bottom:14px"><button class="on" data-m="register">حساب جديد</button><button data-m="login">لدي حساب</button></div>
  <form class="form" id="accF">
    <p class="small muted" id="accHint">احفظ بياناتك في حساب لتفتحها من أي جهاز. كل ما أضفته حتى الآن سينتقل إلى حسابك.</p>
    <label class="field" id="nameF"><span>اسمك</span><input name="name" maxlength="40" value="${profile().name}"></label>
    <label class="field"><span>اسم المستخدم</span><input name="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_.\\-]+" dir="ltr" autocomplete="username" placeholder="abood_2026"></label>
    <label class="field"><span>كلمة المرور</span><input name="password" type="password" required minlength="6" dir="ltr" autocomplete="new-password"></label>
    <p class="small conflict" id="accErr" hidden></p>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="accGo">إنشاء الحساب</button></div>
  </form>`, { title: 'الحساب والمزامنة' });
  let cur = 'register';
  const set = md => { cur = md; m.body.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === md)); $('#nameF', m.body).hidden = md === 'login'; $('#accGo', m.body).textContent = md === 'login' ? 'دخول' : 'إنشاء الحساب'; $('#accHint', m.body).textContent = md === 'login' ? 'ادخل إلى حسابك، وسندمج ما على هذا الجهاز مع بيانات حسابك.' : 'احفظ بياناتك في حساب لتفتحها من أي جهاز. كل ما أضفته حتى الآن سينتقل إلى حسابك.'; m.body.querySelector('[name=password]').autocomplete = md === 'login' ? 'current-password' : 'new-password'; };
  m.body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => set(b.dataset.m));
  set(mode);
  $('#accF', m.body).onsubmit = async e => {
    e.preventDefault(); const d = formData(e.target), err = $('#accErr', m.body), go = $('#accGo', m.body);
    go.disabled = true; err.hidden = true;
    try { const u = cur === 'login' ? await login(d.username, d.password) : await register(d.username, d.password, d.name.trim()); m.close(); toast('أهلاً ' + (u.name || u.username) + '! بياناتك الآن في السحابة'); window.__refresh(); }
    catch (x) { err.hidden = false; err.textContent = x.status ? x.message : 'الخادم غير متاح حالياً. بياناتك محفوظة على جهازك.'; }
    finally { go.disabled = false; }
  };
}

export const VERSION = '4.12';
export const CHANGES = [
  ['4.11', 'عالم العلوم صار من المنهاج الأردني فقط: أُزيلت الدروس والمصطلحات والمعلومات العامة التي ليست من كتبك، ويعرض «هل تعلم؟» نقاطاً من دروس مرحلتك نفسها. اختر مرحلتك من عالم العلوم ليظهر محتواك.'],
  ['4.9', 'المساعد الذكي صار يجيب أي سؤال دراسي بذكاء اصطناعي حقيقي (عبر الخادم) عندما لا تفهم القواعد المحلية سؤالك، مع بقاء الإجابات الفورية من بياناتك.', 'ماسح الواجب: صوّر السبورة أو الدفتر من صفحة المهام وتتحول الصورة إلى مهام تراجعها قبل الإضافة (قراءة ذكية للخط اليدوي، أو قراءة نصية محلية كبديل).', 'صفحة الأصدقاء: أضف أصدقاء باسم المستخدم وقارن تركيز الأسبوع والسلسلة والنقاط في لوحة ترتيب ودّية — تُشارَك أرقام مجمّعة فقط.'],
  ['4.8', '4 دروس إثرائية جديدة في «علوم عامة» تظهر لكل الطلاب مهما كانت مرحلتهم: الطاقة المتجددة، الكيمياء في حياتنا اليومية، أجهزة جسم الإنسان، والموارد الطبيعية والبيئة في الأردن (الفوسفات والبوتاس والبحر الميت)، مع مصطلحات ومعلومات جديدة مرافقة.'],
  ['4.7', 'محتوى الحادي عشر أكاديمي صار يقتصر على المباحث الوزارية المشتركة: الرياضيات واللغة العربية والتربية الإسلامية وتاريخ الأردن، مع دروس وأسئلة وبطاقات ومصطلحات إضافية وأسئلة على نمط الوزارة لكل مبحث.', 'تصدير جدولك واختباراتك إلى ملف تقويم (ICS) يستورد مباشرة إلى جوجل كالندر أو آبل أو Outlook.', 'زر مشاركة سريع يرسل ملخص اختباراتك ومهامك المفتوحة عبر أي تطبيق أو ينسخه للحافظة.', 'إدخال صوتي بالعربية لمساعد جدولي الذكي — اضغط أيقونة الميكروفون وتحدّث مباشرة.', '3 إنجازات جديدة: مئة ساعة تركيز، مخطِّط محترف، ومتعدد المواد.'],
  ['4.6', 'عالم العلوم صار حسب المنهاج الأردني: اختر الصفوف الأساسية (1–10) أو أكاديمي (الأول الثانوي) أو الحقول (التوجيهي)', 'الحقول الأربعة بموادها الإجبارية والاختيارية: الصحي، العلوم والتكنولوجيا والهندسة، الإنسانية، الأعمال', 'أكثر من 120 وحدة ومئات المصطلحات والبطاقات الجديدة', 'اختبارات «على نمط أسئلة الوزارة» لكل مادة', 'زر لإضافة مواد مرحلتك إلى جدولك مباشرة'],
  ['4.5', 'المختبر صار فيه 6 تجارب: أضفنا القوة والتسارع، وسباق السرعة، والطفو والكثافة.', 'القوانين الأساسية في أدوات الطالب، مربوطة بدروسها وبالحاسبة والمختبر، وتظهر داخل كل درس.', 'توزيع الحصص حسب المادة في الأسبوع، وإحصائيات أسبوع التركيز، و«تابع من حيث توقفت».', 'المساعد الذكي صار يشرح القوانين: جرّب «قانون الكثافة».'],
  ['4.4', 'مساعد جدولي الذكي: اسأله عن يومك واختباراتك ومعدلك ووقتك الفاضي، أو اطلب منه إضافة مهمة.', 'أدوات الطالب: حاسبات الكثافة والسرعة والقوة وقانون أوم والمعدل، ومحوّل وحدات، ونصائح مذاكرة فعّالة.', 'خطة اليوم لغداً وبعد غد مع «أضف الخطة إلى الجدول»، ونصيحة اليوم، ومنحنى الإنجاز، وتحدّي المختبر، وسجل المحاولات وعدد الأسئلة.', 'تواصل معنا يرسل رسالتك مباشرة، وملخّص يومي، وتنبيه قبل نهاية الجلسة، وشكل البطاقات، وتثبيت التطبيق.'],
  ['4.2', 'خطة اليوم الذكية، المهام المتكررة، نقل المتأخر لليوم بضغطة، وتحليل أفضل أوقات التركيز.'],
  ['4.1', 'العلامات وحاسبة «كم أحتاج؟»، الملاحظات مع البطاقات، عرض الشهر، وتذكيرات قبل الحصص.'],
  ['4.0', 'إعادة بناء كاملة: جدولي + مؤقت التركيز + عالم العلوم في تطبيق واحد مع مزامنة سحابية.']
];
export function whatsNew() {
  modal(html`<div class="stack">${CHANGES.map(([v, ...ls], i) => html`<div class="chg ${i === 0 ? 'cur' : ''}"><span class="chip ${i === 0 ? 'ac' : ''}">الإصدار ${v}</span><ul>${ls.map(l => html`<li class="small">${l}</li>`)}</ul></div>`)}</div>
  <div class="form-actions"><button class="btn primary" data-close>رائع</button></div>`, { title: 'ما الجديد في جدولي' });
  setProfile({ seenVer: VERSION });
}
act('whatsNew', () => whatsNew());
act('setPref', el => { const k = el.dataset.k; let v = el.dataset.v; if (/^(clock|passMark)$/.test(k)) v = Number(v); setProfile({ [k]: v }); window.__applyTheme(); window.__refresh(); });
act('setSec', el => { location.hash = '#/settings' + (el.dataset.s ? '?s=' + el.dataset.s : ''); });
act('resetProgress', async () => { if (await confirmBox('تصفير التقدّم فقط؟ ستُحذف جلسات التركيز والدروس والاختبارات والبطاقات وسجل العادات، وتبقى موادك وحصصك ومهامك وعلاماتك وملاحظاتك.', { ok: 'تصفير التقدّم', danger: true })) { resetProgress(); toast('بدأت صفحة جديدة للتقدّم'); window.__refresh(); } });
const ICS_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const icsEsc = t => String(t || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
const icsDT = (date, hm) => date.replace(/-/g, '') + 'T' + (hm || '00:00').replace(':', '') + '00';
act('exportIcs', () => {
  const p = profile(), sub = id => (all('subjects').find(x => x.id === id) || {}).name || '';
  const stamp = icsDT(today(), '00:00') + 'Z', lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//جدولي//ar', 'CALSCALE:GREGORIAN'];
  all('events').forEach(e => {
    const title = icsEsc(e.title || sub(e.subjectId) || (e.type === 'exam' ? 'اختبار' : 'حصة'));
    lines.push('BEGIN:VEVENT', 'UID:' + (e.id || (e.date + e.start)) + '@jadwali', 'DTSTAMP:' + stamp,
      'DTSTART:' + icsDT(e.date, e.start), 'DTEND:' + icsDT(e.date, e.end || e.start));
    if (e.repeat === 'weekly') lines.push('RRULE:FREQ=WEEKLY;BYDAY=' + ICS_DAY[weekday(e.date)] + (e.until ? ';UNTIL=' + icsDT(e.until, '23:59') + 'Z' : ''));
    else if (e.repeat === 'daily') lines.push('RRULE:FREQ=DAILY' + (e.until ? ';UNTIL=' + icsDT(e.until, '23:59') + 'Z' : ''));
    lines.push('SUMMARY:' + title, 'CATEGORIES:' + (e.type === 'exam' ? 'اختبار' : 'حصة'), 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'jadwali-' + today() + '.ics'; document.body.appendChild(a); a.click(); a.remove();
  toast('نُزّل ملف تقويم (ICS) — افتحه ليستورد جدولك إلى تقويم جوجل أو آبل');
});
act('shareSummary', async () => {
  const p = profile(), sub = id => (all('subjects').find(x => x.id === id) || {}).name || '';
  const ex = all('events').filter(e => e.type === 'exam' && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const tk = all('tasks').filter(t => !t.done).slice(0, 8);
  const text = ['جدول ' + (p.name || 'الطالب') + ' — جدولي', '', 'الاختبارات القادمة:', ...ex.map(e => '• ' + e.date + ' — ' + (e.title || sub(e.subjectId))),
    '', 'المهام المفتوحة:', ...tk.map(t => '• ' + t.title + (t.due ? ' — ' + t.due : ''))].join('\n');
  if (navigator.share) { try { await navigator.share({ title: 'جدولي', text }); } catch (e) {} }
  else { try { await navigator.clipboard.writeText(text); toast('نُسخ ملخّص جدولك — الصقه لمشاركته'); } catch (e) { toast('تعذّرت المشاركة'); } }
});
act('exportText', () => {
  const p = profile(), L = [], sub = id => (all('subjects').find(x => x.id === id) || {}).name || '';
  L.push('جدولي — ' + (p.name || 'نسختي') + ' — ' + niceDate(today()), '');
  L.push('المواد:', ...all('subjects').map(x => '• ' + x.name), '');
  const D = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  L.push('الحصص الأسبوعية:', ...all('events').filter(e => e.repeat === 'weekly').sort((a, b) => (new Date(a.date + 'T12:00').getDay() - new Date(b.date + 'T12:00').getDay()) || a.start.localeCompare(b.start)).map(e => `• ${D[new Date(e.date + 'T12:00').getDay()]} ${e.start}–${e.end} ${e.title || sub(e.subjectId)}`), '');
  L.push('الاختبارات:', ...all('events').filter(e => e.type === 'exam').map(e => `• ${e.date} ${e.title || sub(e.subjectId)}`), '');
  L.push('المهام المفتوحة:', ...all('tasks').filter(t => !t.done).map(t => `• ${t.title}${t.due ? ' — ' + t.due : ''}${sub(t.subjectId) ? ' (' + sub(t.subjectId) + ')' : ''}`), '');
  L.push('العلامات:', ...all('grades').map(g => `• ${sub(g.subjectId)}: ${g.title || ''} ${g.score}/${g.max}`), '');
  L.push('الملاحظات:', ...all('notes').map(n => '— ' + (n.title || 'بلا عنوان') + '\n' + (n.body || '')), '');
  const blob = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'jadwali-' + today() + '.txt'; document.body.appendChild(a); a.click(); a.remove();
  toast('نُزّل ملف نصي بكل بياناتك');
});

const SECS = [['', 'الحساب', 'user'], ['look', 'المظهر', 'sun'], ['study', 'الدراسة', 'book'], ['focus', 'التركيز والتنبيهات', 'focus'], ['data', 'البيانات', 'download'], ['help', 'المساعدة', 'help'], ['about', 'حول جدولي', 'info']];
const FAQ = [
  ['هل بياناتي محفوظة إذا سكّرت المتصفح؟', 'نعم. كل شيء يُحفظ فوراً على جهازك، وإذا كان الخادم متاحاً يُحفظ في السحابة أيضاً. أنشئ حساباً لتفتحه من أي جهاز.'],
  ['كيف أضيف حصصي مرة وحدة للأسبوع كله؟', 'من «الأسبوع» اضغط «إضافة» واختر التكرار «كل أسبوع». ستظهر الحصة في كل الأسابيع، ويمكنك سحبها ليوم آخر.'],
  ['كيف أكتب مهمة بسرعة؟', 'اكتب جملة عادية مثل «حل واجب الرياضيات بكرة !» أو «مراجعة العلوم كل خميس». جدولي يفهم اليوم والمادة والأولوية والتكرار.'],
  ['كيف تُحسب خطة اليوم الذكية؟', 'ترتب المتأخر ثم مراجعات الاختبارات ثم المهم، وتضيف البطاقات المستحقة وتقوية أضعف مادة حسب علاماتك، وتضعها في الفراغات بين حصصك.'],
  ['ما فائدة البطاقات التعليمية؟', 'تستخدم التكرار المتباعد: البطاقة التي تعرفها تظهر بعد مدة أطول، والصعبة تعود قريباً. خمس دقائق يومياً تكفي.'],
  ['هل يعمل بدون إنترنت؟', 'نعم، بعد أول فتح يعمل التطبيق كاملاً دون اتصال، ويزامن التغييرات عند عودة الإنترنت.']
];
const opt = (k, cur, list) => html`<div class="seg wrap-seg">${list.map(([v, l]) => html`<button class="${String(cur) === String(v) ? 'on' : ''}" data-act="setPref" data-k="${k}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`)}</div>`;
const rowS = (t, d, ctl) => html`<div class="set-row"><div class="grow"><b>${t}</b>${d ? html`<p class="xs muted">${d}</p>` : ''}</div>${ctl}</div>`;
const sw = (k, on, label) => html`<label class="switch mini"><span class="sr">${label}</span><input type="checkbox" data-pref="${k}" ${on ? raw('checked') : ''}></label>`;

export function credits(big = false) {
  const lv = level();
  return html`<section class="credits-card ${big ? 'big' : ''}" aria-label="معلومات الموقع والمطوّر">
    <div class="cr-top">
      <div class="cr-av"><img src="img/developer.webp" alt="صورة مطوّر جدولي" width="72" height="72" onerror="this.parentNode.classList.add('noimg');this.remove()"><span class="cr-st" aria-hidden="true"></span></div>
      <div class="cr-copy grow">
        <span class="cr-eye">صُنع بشغف بواسطة</span>
        <h3>عبدالرحمن شلش</h3>
        <p class="small muted cr-bio">مؤسس <b>جدولي</b> ومطوّره — منصة دراسية متكاملة تجمع التخطيط الذكي، والتركيز العميق، والتعلّم التفاعلي في تجربة واحدة تساعد الطالب على تنظيم وقته وتحقيق أهدافه.</p>
        <div class="cr-meta"><span class="chip ac">الإصدار ${VERSION}</span><a class="chip" href="mailto:shlshb738@gmail.com" dir="ltr">${icon('mail')}shlshb738@gmail.com</a><span class="xs muted">© 2026 جدولي — جميع الحقوق محفوظة</span></div>
      </div>
    </div>
    ${big ? html`<div class="cr-div"></div><div class="cr-apps">${[['جدولي', 'المخطط الدراسي الذكي', 'today', 'var(--accent)'], ['Time Balance', 'تطبيق التركيز', 'focus', 'var(--focus)'], ['عالم العلوم', 'لوحة الطالب العلمية', 'atom', 'var(--sci)']].map(([n, d, ic, c]) => html`<div class="cr-app" style="--c:${c}">${icon(ic)}<div><b>${n}</b><span class="xs muted">${d}</span></div></div>`)}</div>` : ''}
    <div class="cr-div"></div>
    <div class="cr-bot"><span class="small muted">نظّم وقتك، وحقق أهدافك.</span><button type="button" class="btn sm ghost" data-act="toTop">${icon('arrowUp')}العودة إلى الأعلى</button></div>
  </section>`;
}
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
act('installApp', async () => {
  if (deferredInstall) { deferredInstall.prompt(); const r = await deferredInstall.userChoice; deferredInstall = null; toast(r.outcome === 'accepted' ? 'تم التثبيت' : 'أُلغي التثبيت'); return; }
  if (matchMedia('(display-mode: standalone)').matches) { toast('جدولي مثبّت ويعمل كتطبيق'); return; }
  modal(html`<div class="stack small"><p>لتثبيت جدولي:</p><ul class="stack" style="padding-inline-start:18px;margin:0"><li><b>على الحاسوب (Chrome/Edge):</b> اضغط أيقونة التثبيت في شريط العنوان.</li><li><b>على آيفون (Safari):</b> زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».</li><li><b>على أندرويد (Chrome):</b> القائمة ⋮ ثم «تثبيت التطبيق».</li></ul></div><div class="form-actions"><button class="btn primary" data-close>حسناً</button></div>`, { title: 'ثبّت جدولي على جهازك' });
});
act('toTop', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

export function render(params = {}) {
  const p = profile(), u = sync.user, sec = SECS.some(x => x[0] === params.s) ? params.s || '' : '';
  const th = p.theme || 'auto';
  const body = {
    '': () => html`
    <section class="card"><div class="card-head"><h2>${icon('user')}الملف الشخصي</h2></div>
      <form class="form" id="profF">
        <div class="form-row"><label class="field"><span>الاسم</span><input name="name" maxlength="40" value="${p.name}"></label><label class="field"><span>الصف / المرحلة</span><input name="grade" maxlength="30" value="${p.grade || ''}" placeholder="مثال: التاسع"></label></div>
      </form></section>
    <section class="card"><div class="card-head"><h2>${icon('cloud')}الحساب والمزامنة</h2></div>
      <div class="stack">
        <div class="row"><span class="sync-pill" data-s="${sync.status}"><i></i><span>${STATUS[sync.status] || ''}</span></span></div>
        ${u && !u.guest ? html`<p class="small">مسجّل باسم <b dir="ltr">${u.username}</b>. كل تغيير يُحفظ تلقائياً في السحابة ويظهر على أجهزتك الأخرى خلال ثوانٍ.</p><div class="row wrap"><button class="btn sm" data-act="syncNow">${icon('repeat')}مزامنة الآن</button><button class="btn sm ghost" data-act="doLogout">تسجيل الخروج</button></div>`
          : html`<p class="small muted">تُحفظ بياناتك الآن تلقائياً كضيف على هذا المتصفح${sync.status === 'synced' ? ' وفي السحابة' : ''}. أنشئ حساباً لتفتحها من هاتفك وحاسوبك معاً.</p><div class="row wrap"><button class="btn primary sm" data-act="openAccount">${icon('user')}إنشاء حساب / دخول</button></div>`}
      </div></section>`,
    look: () => html`
    <section class="card span2"><div class="card-head"><h2>${icon('sun')}المظهر والقراءة</h2></div>
      <div class="set-list">
        ${rowS('السمة', 'التلقائي يتبع إعداد جهازك.', html`<div class="seg">${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => html`<button class="${th === v ? 'on' : ''}" data-act="setTheme" data-v="${v}">${l}</button>`)}</div>`)}
        ${rowS('لون التمييز', '', html`<div class="row wrap" style="gap:6px">${Object.entries(ACCENTS).map(([k, [l, c]]) => html`<button class="swatch-btn ${p.accent === k ? 'on' : ''}" data-act="setAccent" data-v="${k}" style="--c:${c}" aria-label="${l}" title="${l}"><i></i>${l}</button>`)}</div>`)}
        ${rowS('حجم الخط', 'يكبّر أو يصغّر كل النصوص.', opt('fontSize', p.fontSize, [['sm', 'صغير'], ['md', 'افتراضي'], ['lg', 'كبير'], ['xl', 'كبير جداً']]))}
        ${rowS('كثافة العرض', 'المضغوط يعرض محتوى أكثر في الشاشة.', opt('density', p.density, [['comfy', 'مريح'], ['compact', 'مضغوط']]))}
        ${rowS('الحركة', 'قلّل الحركة إذا كانت تشتتك.', opt('motion', p.motion, [['auto', 'حسب الجهاز'], ['on', 'كاملة'], ['off', 'مخففة']]))}
        ${rowS('نظام الساعة', '', opt('clock', p.clock || 12, [[12, '12 ساعة (ص/م)'], [24, '24 ساعة']]))}
        ${rowS('شكل البطاقات', '', opt('shape', p.shape || 'mid', [['soft', 'مربّع ناعم'], ['mid', 'متوازن'], ['round', 'دائري']]))}
        ${rowS('ثبّت جدولي على جهازك', 'افتحه كتطبيق مستقل من سطح المكتب أو الشاشة الرئيسية.', html`<button class="btn sm" data-act="installApp" id="instBtn">${icon('download')}تثبيت</button>`)}
      </div>
      <div class="look-prev"><span class="xs muted">معاينة</span><b>حصة الرياضيات</b><span class="small muted">${p.clock === 24 ? '13:30' : '1:30 م'} · الغرفة 4</span></div>
    </section>`,
    study: () => html`
    <section class="card span2"><div class="card-head"><h2>${icon('book')}الدراسة واليوم</h2></div>
      <form class="form" id="studyF">
        <div class="form-row"><label class="field"><span>بداية الأسبوع</span><select name="weekStart">${[[0, 'الأحد'], [6, 'السبت'], [1, 'الاثنين']].map(([v, l]) => html`<option value="${v}" ${Number(p.weekStart) === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
        <label class="field"><span>صفحة البداية</span><select name="startPage">${[['today', 'اليوم'], ['week', 'الأسبوع'], ['tasks', 'المهام'], ['focus', 'مؤقت التركيز'], ['science', 'عالم العلوم']].map(([v, l]) => html`<option value="${v}" ${p.startPage === v ? raw('selected') : ''}>${l}</option>`)}</select></label></div>
        <div class="form-row"><label class="field"><span>يبدأ يومي الدراسي</span><input type="time" name="dayStart" value="${p.dayStart || '07:00'}"></label><label class="field"><span>ينتهي يومي الدراسي</span><input type="time" name="dayEnd" value="${p.dayEnd || '22:00'}"></label></div>
        <div class="form-row"><label class="field"><span>هدف التركيز اليومي (دقيقة)</span><input type="number" name="focusGoal" min="15" max="720" step="15" value="${p.focusGoal}"></label>
        <label class="field"><span>علامة النجاح (%)</span><input type="number" name="passMark" min="30" max="90" step="5" value="${p.passMark || 50}"></label></div>
      </form>
      <div class="set-list" style="margin-top:8px">
        ${rowS('المرحلة الدراسية', p.stage ? stageLabel(p) + ' — المواد والوحدات في عالم العلوم مرتبة حسبها.' : 'اختر مرحلتك ليُرتَّب عالم العلوم حسب المنهاج الأردني.', html`<div class="row" style="gap:6px"><button class="btn sm" data-act="openStage">${icon('edit')}${p.stage ? 'غيّر' : 'اختر'}</button>${p.stage ? html`<button class="btn sm ghost" data-act="addStageSubj">أضف موادي للجدول</button>` : ''}</div>`)}
        ${rowS('إخفاء الجمعة والسبت', 'يعرض أيام الدوام فقط في الأسبوع إذا لم يكن فيها مواعيد.', sw('hideWeekend', p.hideWeekend, 'إخفاء الجمعة والسبت'))}
      </div>
      <p class="xs muted" style="margin-top:10px">خطة اليوم الذكية تستخدم بداية ونهاية يومك لتوزيع المذاكرة.</p>
    </section>`,
    focus: () => html`
    <section class="card"><div class="card-head"><h2>${icon('focus')}مؤقت التركيز</h2></div>
      <form class="form" id="focF">
        <div class="form-row"><label class="field"><span>التركيز (د)</span><input type="number" name="focusMin" min="5" max="180" value="${p.focusMin}"></label><label class="field"><span>استراحة قصيرة</span><input type="number" name="shortMin" min="1" max="60" value="${p.shortMin}"></label><label class="field"><span>استراحة طويلة</span><input type="number" name="longMin" min="1" max="90" value="${p.longMin}"></label></div>
        <label class="field"><span>استراحة طويلة بعد كل</span><select name="longEvery">${[2, 3, 4, 5, 6].map(v => html`<option value="${v}" ${p.longEvery === v ? raw('selected') : ''}>${v} جلسات</option>`)}</select></label>
        <label class="switch"><span>بدء الاستراحة تلقائياً</span><input type="checkbox" name="autoBreak" ${p.autoBreak ? raw('checked') : ''}></label>
        <label class="switch"><span>صوت انتهاء المؤقت</span><input type="checkbox" name="chime" ${p.chime !== false ? raw('checked') : ''}></label>
        <label class="field"><span>تنبيه قبل نهاية الجلسة</span><select name="warnEnd">${[[0, 'بدون'], [1, 'قبل دقيقة'], [2, 'قبل دقيقتين'], [5, 'قبل 5 دقائق']].map(([v, l]) => html`<option value="${v}" ${Number(p.warnEnd || 0) === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
        <label class="switch"><span>احتفالات الإنجاز (قصاصات ملونة)</span><input type="checkbox" name="celebrate" ${p.celebrate !== false ? raw('checked') : ''}></label>
      </form></section>
    <section class="card"><div class="card-head"><h2>${icon('bell')}التذكيرات</h2></div>
      <form class="form" id="remF">
        <label class="field"><span>ملخّص يومي الساعة</span><select name="digest">${[['', 'بدون ملخّص'], ['07:00', '7:00 ص'], ['14:00', '2:00 م'], ['16:00', '4:00 م'], ['20:00', '8:00 م']].map(([v, l]) => html`<option value="${v}" ${(p.digest || '') === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
        <label class="field"><span>ذكّرني قبل الحصة أو الاختبار</span><select name="remind">${[[0, 'بدون تذكير'], [5, '5 دقائق'], [10, '10 دقائق'], [15, '15 دقيقة'], [30, '30 دقيقة']].map(([v, l]) => html`<option value="${v}" ${Number(p.remind) === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
      </form>
      <div class="row wrap" style="margin-top:12px"><span class="small muted grow" id="notifSt">${notifState()}</span>${'Notification' in window && Notification.permission === 'default' ? html`<button class="btn sm" data-act="askNotif">${icon('bell')}تفعيل إشعارات الجهاز</button>` : ''}<button class="btn sm ghost" data-act="testNotif">${icon('bell')}جرّب تنبيهاً</button></div>
    </section>`,
    data: () => html`
    <section class="card span2"><div class="card-head"><h2>${icon('download')}بياناتك</h2></div>
      <p class="small muted" style="margin-bottom:14px">بياناتك ملكك: صدّرها، أو انقلها لجهاز آخر.</p>
      <div class="data-stats">${[['subjects', 'مادة'], ['events', 'موعد'], ['tasks', 'مهمة'], ['grades', 'علامة'], ['notes', 'ملاحظة'], ['sessions', 'جلسة']].map(([c, l]) => html`<div><b class="num">${all(c).length}</b><span class="xs muted">${l}</span></div>`)}</div>
      <div class="set-list">
        ${rowS('نسخة احتياطية كاملة', 'ملف JSON يمكنك استيراده لاحقاً.', html`<div class="row wrap"><button class="btn sm" data-act="exportData">${icon('download')}تنزيل نسخة</button><button class="btn sm" data-act="importData">${icon('upload')}استيراد</button></div>`)}
        ${rowS('تصدير كنص', 'ملف مقروء فيه موادك وحصصك ومهامك وعلاماتك وملاحظاتك.', html`<button class="btn sm" data-act="exportText">${icon('text')}تصدير كنص</button>`)}
        ${rowS('تصدير إلى التقويم', 'ملف ICS لحصصك واختباراتك، يستورد مباشرة إلى تقويم جوجل أو آبل أو Outlook.', html`<button class="btn sm" data-act="exportIcs">${icon('month')}تنزيل ICS</button>`)}
        ${rowS('مشاركة جدولك', 'ملخّص سريع باختباراتك ومهامك المفتوحة، جاهز للمشاركة أو النسخ.', html`<button class="btn sm" data-act="shareSummary">${icon('link')}مشاركة</button>`)}
        ${rowS('طباعة الجدول الأسبوعي', '', html`<a class="btn sm" href="#/week" data-print="1" data-act="printSched">${icon('print')}طباعة</a>`)}
        ${rowS('تصفير التقدّم فقط', 'يمسح الجلسات والاختبارات والبطاقات وسجل العادات، ويُبقي جدولك ومهامك.', html`<button class="btn sm ghost" data-act="resetProgress" style="color:var(--danger)">${icon('reset')}تصفير التقدّم</button>`)}
        ${rowS('حذف كل البيانات', 'من هذا الجهاز والسحابة. لا يمكن التراجع.', html`<button class="btn sm ghost" data-act="wipeData" style="color:var(--danger)">${icon('trash')}حذف الكل</button>`)}
      </div></section>`,
    help: () => html`
    <section class="card"><div class="card-head"><h2>${icon('help')}الأسئلة الشائعة</h2></div>
      <div class="faq">${FAQ.map(([q, a]) => html`<details><summary>${q}</summary><p class="small muted">${a}</p></details>`)}</div></section>
    <section class="card"><div class="card-head"><h2>${icon('keyboard')}اختصارات لوحة المفاتيح</h2></div>
      <div class="stack small">${[['Ctrl K', 'البحث والأوامر والإضافة السريعة'], ['N', 'مهمة جديدة'], ['E', 'موعد جديد في الجدول'], ['G ثم T / W / F / S', 'اليوم / الأسبوع / التركيز / العلوم'], ['G ثم M / N', 'العلامات / الملاحظات'], ['G ثم ,', 'الإعدادات'], ['مسافة', 'تشغيل/إيقاف المؤقت (في صفحة التركيز)'], ['1 – 4', 'اختيار الإجابة / تقييم البطاقة'], ['Esc', 'إغلاق النوافذ']].map(([k, v]) => html`<div class="row"><kbd>${k}</kbd><span class="muted">${v}</span></div>`)}</div>
      <div class="row wrap" style="margin-top:14px"><button class="btn sm" data-act="whatsNew">${icon('sparkle')}ما الجديد</button></div></section>
    <section class="card span2" id="contact"><div class="card-head"><h2>${icon('mail')}تواصل معنا</h2><span class="more">اقتراح، ملاحظة، أو سؤال عن درس؟ اكتب لنا.</span></div>
      <form class="form" id="fbF">
        <div class="form-row"><label class="field"><span>الاسم</span><input name="name" maxlength="60" value="${p.name || ''}"></label><label class="field"><span>البريد الإلكتروني (اختياري)</span><input name="email" type="email" maxlength="120" dir="ltr" placeholder="name@example.com"></label></div>
        <div class="form-row"><label class="field"><span>الموضوع</span><select name="topic">${[['idea', 'اقتراح ميزة أو محتوى'], ['bug', 'مشكلة تقنية'], ['lesson', 'سؤال عن درس'], ['other', 'أخرى']].map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></label><label class="field"><span>مادة متعلقة (اختياري)</span><select name="subject"><option value="">—</option>${all('subjects').map(x => html`<option>${x.name}</option>`)}</select></label></div>
        <label class="field"><span>الرسالة</span><textarea name="message" rows="4" required minlength="3" maxlength="4000" placeholder="اكتب رسالتك هنا…"></textarea></label>
        <div class="form-actions"><span class="xs muted grow" id="fbSt">تصل رسالتك مباشرة إلى فريق جدولي. أو راسلنا على <a href="mailto:shlshb738@gmail.com" dir="ltr">shlshb738@gmail.com</a></span><button class="btn primary" id="fbGo">${icon('mail')}إرسال الرسالة</button></div>
      </form></section>`,
    about: () => html`<div class="span2">${credits(true)}</div>
    <section class="card span2"><div class="card-head"><h2>${icon('sparkle')}سجل الإصدارات</h2></div>
      <div class="stack">${CHANGES.map(([v, ...ls], i) => html`<div class="chg ${i === 0 ? 'cur' : ''}"><span class="chip ${i === 0 ? 'ac' : ''}">الإصدار ${v}</span><ul>${ls.map(l => html`<li class="small">${l}</li>`)}</ul></div>`)}</div></section>`
  }[sec];
  return html`${intro('الإعدادات', 'خصّص جدولي على طريقتك')}
  <div class="set-wrap">
    <nav class="set-nav" aria-label="أقسام الإعدادات">${SECS.map(([k, l, ic]) => html`<button class="${sec === k ? 'on' : ''}" data-act="setSec" data-s="${k}" aria-current="${sec === k ? 'page' : 'false'}">${icon(ic)}<span>${l}</span></button>`)}</nav>
    <div class="grid g2 set-body">${body()}</div>
  </div>`;
}
export function mount(el) {
  const save = f => () => {
    const d = formData(f), n = {};
    Object.entries(d).forEach(([k, v]) => { n[k] = typeof v === 'boolean' ? v : /^(weekStart|focusGoal|focusMin|shortMin|longMin|longEvery|remind|passMark|warnEnd)$/.test(k) ? Number(v) : v.trim(); });
    setProfile(n); toast('حُفظ', {});
  };
  let t; const deb = fn => () => { clearTimeout(t); t = setTimeout(fn, 500); };
  ['#profF', '#focF', '#remF', '#studyF'].forEach(s => { const f = $(s, el); if (!f) return; f.addEventListener('input', deb(save(f))); f.addEventListener('change', deb(save(f))); f.onsubmit = e => e.preventDefault(); });
  const fb = $('#fbF', el);
  if (fb) fb.onsubmit = async e => {
    e.preventDefault(); const d = formData(fb), go = $('#fbGo', el), st = $('#fbSt', el); go.disabled = true;
    try { const r = await sendFeedback(d); fb.message.value = ''; st.textContent = r === 'sent' ? 'وصلت رسالتك. شكراً لك!' : 'لا يوجد اتصال الآن — حُفظت رسالتك وستُرسل تلقائياً لاحقاً.'; toast(r === 'sent' ? 'أُرسلت الرسالة' : 'حُفظت الرسالة للإرسال لاحقاً'); }
    catch (x) { st.textContent = x.message || 'تعذّر الإرسال'; }
    finally { go.disabled = false; }
  };
  $$('[data-pref]', el).forEach(c => c.onchange = () => { setProfile({ [c.dataset.pref]: c.checked }); toast('حُفظ'); });
}
