/* مكونات عرض مشتركة */
import { html, raw, niceDate, today, t12, fmtMin } from './util.js';
import { icon } from './icons.js';
import { subject } from './store.js';
import { taskFocus } from './logic.js';

export function taskRow(t, { showDate = true } = {}) {
  const s = subject(t.subjectId), late = !t.done && t.due && t.due < today();
  const steps = t.steps || [], sd = steps.filter(x => x.done).length, f = taskFocus(t.id);
  return html`<div class="task ${t.done ? 'done' : ''} ${t.priority === 'high' ? 'hi' : ''}" style="--c:${s ? s.color : 'var(--accent)'}">
    <button type="button" class="chk" data-act="toggleTask" data-id="${t.id}" aria-label="${t.done ? 'إلغاء الإنجاز' : 'إنجاز'}: ${t.title}">${icon('check')}</button>
    <div class="task-main" data-act="editTask" data-id="${t.id}">
      <div class="task-title">${t.title}</div>
      <div class="task-meta">
        ${s ? html`<span class="chip" style="--c:${s.color}"><i class="dot"></i>${s.name}</span>` : ''}
        ${showDate && t.due ? html`<span class="${late ? 'late' : ''}">${late ? 'متأخرة · ' : ''}${niceDate(t.due)}</span>` : ''}
        ${t.priority === 'high' ? html`<span class="chip hi">عالية</span>` : ''}
        ${steps.length ? html`<span class="steps-mini">${icon('steps')}${sd}/${steps.length}</span>` : ''}
        ${f ? html`<span class="steps-mini">${icon('focus')}${fmtMin(f)}</span>` : t.est ? html`<span class="steps-mini" title="الجلسات المتوقعة">${icon('clock')}${t.est}×</span>` : ''}
        ${t.repeat && t.repeat !== 'none' ? html`<span class="steps-mini" title="مهمة متكررة">${icon('repeat')}${{ daily: 'يومياً', weekdays: 'أيام الدوام', weekly: 'أسبوعياً' }[t.repeat]}</span>` : ''}
        ${t.examId ? html`<span class="chip ac">خطة مراجعة</span>` : ''}
      </div>
    </div>
    <div class="task-acts">${!t.done ? html`<button type="button" class="icon-btn sm" data-act="focusTask" data-id="${t.id}" aria-label="ابدأ التركيز على المهمة" title="ركّز">${icon('play')}</button>` : ''}<button type="button" class="icon-btn sm" data-act="delTask" data-id="${t.id}" aria-label="حذف" title="حذف">${icon('trash')}</button></div>
  </div>`;
}
export function sortTasks(list) {
  const pr = { high: 0, normal: 1, low: 2 };
  return list.slice().sort((a, b) => (a.done - b.done) || ((a.due || '9999') .localeCompare(b.due || '9999')) || (pr[a.priority] - pr[b.priority]) || ((a.u || 0) - (b.u || 0)));
}
const hm = v => { const [h, m] = v.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0'); };
export function evChip(e, { draggable = false } = {}) {
  const s = subject(e.subjectId), c = s ? s.color : 'var(--muted)';
  return html`<div class="ev ${e.type}" style="--c:${c}" data-act="editEvent" data-id="${e.id}" data-on="${e.on || e.date}" ${draggable ? raw('draggable="true"') : ''} tabindex="0" role="button" aria-label="${e.title} ${t12(e.start)}">
    <b>${e.type === 'exam' ? '✦ ' : ''}${e.title}</b><span class="num">${hm(e.start)} – ${hm(e.end)}</span>${e.room ? html`<span class="rm">${e.room}</span>` : ''}</div>`;
}
export function ringSvg(pct, size = 64, stroke = 7, color = 'var(--accent)') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
  return raw(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`);
}
export const intro = (title, sub, right = '') => html`<div class="page-intro"><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ''}</div>${right}</div>`;
