/* عالم العلوم: يعتمد على محتوى المنهاج الأردني فقط (curriculum.js وملفات cur/) — لا دروس ولا معلومات من خارجه */
import { SUBJ, CUR_LESSONS, CUR_TERMS, stageSubjects } from './curriculum.js';
import { profile } from './store.js';

export let BRANCHES = [], LESSONS = [], TERMS = [], FACTS = [], STAGE_KEY = '';
let inited = false;
export function syncStage(p = profile()) {
  const ids = stageSubjects(p), key = ids.join(',');
  if (inited && key === STAGE_KEY) return false;
  inited = true; STAGE_KEY = key;
  BRANCHES = ids.map(id => SUBJ[id]).filter(Boolean);
  LESSONS = CUR_LESSONS.filter(l => ids.includes(l.b));
  TERMS = CUR_TERMS.filter(t => ids.includes(t.b));
  /* «هل تعلم؟» تُشتق من النقاط الرئيسة لدروس مرحلتك نفسها */
  FACTS = LESSONS.flatMap(l => (l.keys || []).map(k => k + ' — ' + (SUBJ[l.b] || {}).name + '، ' + l.title));
  return true;
}
syncStage();
export const branch = id => BRANCHES.find(b => b.id === id) || SUBJ[id];
export const lesson = id => LESSONS.find(l => l.id === id) || CUR_LESSONS.find(l => l.id === id);
