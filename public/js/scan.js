/* ماسح الواجب: صوّر السبورة أو الدفتر أو ورقة المهام وحوّلها إلى مهام.
   الأولوية للقراءة الذكية عبر الخادم (تقرأ الخط اليدوي وتفهم التواريخ)،
   وإن لم تتوفر فقراءة نصية محلية (Tesseract) تحتاج إنترنت أول مرة. */
import { html, raw, today, niceDate } from './util.js';
import { icon } from './icons.js';
import { all, upsert, apiFetch } from './store.js';
import { modal, toast } from './ui.js';
import { parseTask } from './logic.js';
import { subjectOptions } from './forms.js';

function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('تعذّرت قراءة الصورة')); };
    img.src = url;
  });
}
async function prepare(file) {
  const img = await loadImage(file), MAX = 1600, k = Math.min(1, MAX / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.82);
  return { url, b64: url.split(',')[1], canvas: c };
}
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => res(window.Tesseract); s.onerror = () => rej(new Error('يلزم اتصال بالإنترنت لتحميل قارئ النصوص أول مرة')); document.head.appendChild(s);
  });
}
async function localOcr(canvas, onProgress) {
  const T = await loadTesseract();
  const r = await T.recognize(canvas, 'ara+eng', { logger: m => { if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)); } });
  return String(r.data.text || '').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length >= 4 && /[\u0600-\u06FFA-Za-z0-9]{3,}/.test(x)).slice(0, 25)
    .map(line => { const p = parseTask(line); return { title: p.title, subjectId: p.subjectId || '', due: p.due || '' }; });
}
function fromAi(list) {
  const subs = all('subjects');
  return list.map(t => {
    const s = subs.find(x => t.subject && (x.name === t.subject || x.name.includes(t.subject) || t.subject.includes(x.name)));
    return { title: t.title, subjectId: s ? s.id : '', due: t.due || '' };
  });
}

export function openScanner() {
  const m = modal(html`<div class="scan" id="scan">
    <p class="muted small">صوّر واجبك أو السبورة أو ورقة المهام، وأنا أستخرج المهام لتراجعها قبل الإضافة.</p>
    <label class="btn primary lg scan-pick">${icon('plus')}التقاط صورة أو اختيار ملف<input type="file" id="scanFile" accept="image/*" capture="environment" hidden></label>
    <div id="scanBody"></div></div>`, { title: 'ماسح الواجب', cls: 'sheet' });
  const body = m.body.querySelector('#scanBody'), pick = m.body.querySelector('.scan-pick'), inp = m.body.querySelector('#scanFile');
  const status = t => { body.innerHTML = html`<p class="muted scan-status" role="status">${t}</p>`.s; };
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    try {
      status('جارٍ تجهيز الصورة…');
      const p = await prepare(f);
      let items = null, via = '';
      status('جارٍ قراءة الصورة بالذكاء الاصطناعي…');
      try {
        const r = await apiFetch('/ai/scan', { method: 'POST', body: JSON.stringify({ image: p.b64, mime: 'image/jpeg', today: today(), subjects: all('subjects').map(s => s.name) }) });
        items = fromAi(r.tasks || []); via = 'ذكاء اصطناعي';
      } catch (e) {
        if (e.status === 429) throw e;
        status('الماسح الذكي غير متاح — أجرّب القراءة النصية المحلية… 0%');
        items = await localOcr(p.canvas, n => status('قراءة نصية محلية… ' + n + '%')); via = 'قراءة نصية';
      }
      review(items, via, p.url);
    } catch (e) { status(e.message || 'تعذّرت قراءة الصورة، جرّب صورة أوضح.'); }
    inp.value = '';
  };
  function review(items, via, url) {
    if (!items.length) { body.innerHTML = html`<p class="muted">ما لقيت مهاماً واضحة في الصورة. جرّب صورة أقرب وإضاءة أفضل.</p>`.s; return; }
    body.innerHTML = html`<img class="scan-prev" src="${url}" alt="الصورة الملتقطة">
      <p class="small muted">وجدت ${items.length} ${items.length === 1 ? 'مهمة' : 'مهام'} (${via}). عدّل أو ألغِ ما لا تريده:</p>
      <div class="scan-list">${items.map((t, i) => html`<div class="scan-row" data-i="${i}">
        <input type="checkbox" checked aria-label="إضافة هذه المهمة">
        <div class="grow stack"><input class="input" data-f="title" maxlength="140" value="${t.title}" aria-label="عنوان المهمة">
          <div class="form-row"><select class="input" data-f="subjectId" aria-label="المادة">${subjectOptions(t.subjectId)}</select><input type="date" class="input" data-f="due" value="${t.due || today()}" aria-label="الموعد"></div></div></div>`)}</div>
      <div class="form-actions"><button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="scanAdd">${icon('check')}أضف المحدد</button></div>`.s;
    body.querySelector('#scanAdd').onclick = () => {
      let n = 0;
      body.querySelectorAll('.scan-row').forEach(r => {
        if (!r.querySelector('input[type=checkbox]').checked) return;
        const g = f => r.querySelector('[data-f=' + f + ']').value, title = g('title').trim(); if (!title) return;
        upsert('tasks', { title, subjectId: g('subjectId'), due: g('due'), priority: 'normal', est: 1, steps: [], done: false, notes: '', repeat: 'none' }); n++;
      });
      m.close(); toast(n ? `أُضيفت ${n} ${n === 1 ? 'مهمة' : 'مهام'} من الصورة` : 'لم تُضف أي مهمة'); window.__refresh && window.__refresh();
    };
    body.querySelectorAll('[data-close]').forEach(b => b.onclick = () => m.close());
  }
}
