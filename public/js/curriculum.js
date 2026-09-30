/* المنهاج الأردني: المراحل، الحقول، المواد ووحداتها (يُدمج مع محتوى عالم العلوم) */
import BASIC from './cur/basic.js';
import G11 from './cur/g11.js';
import G12 from './cur/g12.js';
import EXTRA from './cur/extra.js';

/* بيانات المواد: المعرّف ← الاسم واللون والأيقونة والصف */
const META = {
  'b1-sci': ['العلوم', 1], 'b2-sci': ['العلوم', 2], 'b3-sci': ['العلوم', 3], 'b4-sci': ['العلوم', 4],
  'b5-sci': ['العلوم', 5], 'b6-sci': ['العلوم', 6], 'b7-sci': ['العلوم', 7], 'b8-sci': ['العلوم', 8],
  'b9-phy': ['الفيزياء', 9], 'b9-chem': ['الكيمياء', 9], 'b9-bio': ['العلوم الحياتية', 9], 'b9-earth': ['علوم الأرض والبيئة', 9],
  'b10-phy': ['الفيزياء', 10], 'b10-chem': ['الكيمياء', 10], 'b10-bio': ['العلوم الحياتية', 10], 'b10-earth': ['علوم الأرض والبيئة', 10],
  'g11-math': ['الرياضيات', 11], 'g11-arab': ['اللغة العربية', 11], 'g11-isl': ['التربية الإسلامية', 11], 'g11-hist': ['تاريخ الأردن', 11],
  'g12-phy': ['الفيزياء', 12], 'g12-chem': ['الكيمياء', 12], 'g12-bio': ['العلوم الحياتية', 12], 'g12-earth': ['علوم الأرض والبيئة', 12],
  'g12-math': ['الرياضيات', 12], 'g12-bmath': ['رياضيات الأعمال', 12], 'g12-fin': ['الثقافة المالية', 12], 'g12-eng': ['الإنجليزي المتقدم', 12],
  'g12-arabs': ['العربي التخصصي', 12], 'g12-isls': ['التربية الإسلامية التخصصية', 12], 'g12-hist': ['التاريخ', 12], 'g12-geo': ['الجغرافيا', 12]
};
const STYLE = { phy: ['#3E7CC9', 'bolt'], chem: ['#C8553D', 'flask'], bio: ['#2F8F5B', 'habit'], earth: ['#6C5BD4', 'atom'], sci: ['#1F8A7E', 'lab'],
  math: ['#D9822B', 'calc'], bmath: ['#B7861C', 'calc'], fin: ['#2E8656', 'grade'], eng: ['#2E9CB5', 'text'], arab: ['#A0712F', 'book'], arabs: ['#A0712F', 'book'],
  isl: ['#6E8B2E', 'star'], isls: ['#6E8B2E', 'star'], hist: ['#8A5CC2', 'clock'], geo: ['#1F7A94', 'pin'], dig: ['#5B6BD4', 'keyboard'] };
export const GRADE_NAME = n => ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'][n] || '';

export const SUBJ = {};
export const CUR_LESSONS = [];
export const CUR_TERMS = [];
[BASIC, G11, G12, EXTRA].forEach(src => Object.entries(src).forEach(([id, s]) => {
  const [name, grade] = META[id] || [id, 0], kind = id.split('-')[1], [color, ic] = STYLE[kind] || STYLE.sci;
  const units = s.units.map(([t, parts, body, keys, q, terms], i) => {
    const l = { id: id + '-u' + (i + 1), b: id, title: t, parts: parts || [], body, keys, cur: true, unit: i + 1,
      min: Math.max(3, Math.round(body.join(' ').split(/\s+/).length / 45) + 2),
      q: q.map(([qq, o, a, e]) => ({ q: qq, o, a, e })) };
    CUR_LESSONS.push(l);
    (terms || []).forEach(([tt, d], k) => CUR_TERMS.push({ id: id + '-t' + i + '-' + k, t: tt, d, b: id }));
    return l;
  });
  SUBJ[id] = { id, name, grade, color, icon: ic, tag: 'الصف ' + GRADE_NAME(grade) + ' · ' + units.length + ' وحدات',
    units, mq: (s.mq || []).map(([q, o, a, e]) => ({ q, o, a, e, src: name })) };
}));

/* المراحل الدراسية */
export const STAGES = {
  basic: { name: 'الصفوف الأساسية', sub: 'من الأول حتى العاشر', icon: 'book', color: '#1F8A7E' },
  academic: { name: 'أكاديمي', sub: 'الأول الثانوي — الصف الحادي عشر', icon: 'flask', color: '#3E7CC9' },
  fields: { name: 'الحقول', sub: 'الثاني الثانوي — التوجيهي', icon: 'trophy', color: '#C8553D' }
};
/* الحقول الأربعة في نظام التوجيهي الجديد: 3 مواد إجبارية + مادة اختيارية واحدة */
export const FIELDS = [
  { id: 'health', name: 'الحقل الصحي', icon: 'heart', color: '#2F8F5B', req: ['g12-chem', 'g12-bio', 'g12-eng'], opt: ['g12-math', 'g12-phy', 'g12-earth'], hint: 'الطب، الصيدلة، التمريض، والعلوم الطبية' },
  { id: 'step', name: 'حقل العلوم والتكنولوجيا والهندسة', icon: 'bolt', color: '#3E7CC9', req: ['g12-math', 'g12-phy', 'g12-eng'], opt: ['g12-chem', 'g12-bio', 'g12-earth'], hint: 'الهندسة، تكنولوجيا المعلومات، والعلوم' },
  { id: 'human', name: 'حقل العلوم الإنسانية والاجتماعية', icon: 'book', color: '#8A5CC2', req: ['g12-arabs', 'g12-eng', 'g12-isls'], opt: ['g12-hist', 'g12-geo', 'g12-fin'], hint: 'القانون، الشريعة، اللغات، والعلوم الاجتماعية' },
  { id: 'business', name: 'حقل الأعمال', icon: 'grade', color: '#B7861C', req: ['g12-bmath', 'g12-fin', 'g12-eng'], opt: ['g12-arabs', 'g12-isls', 'g12-geo'], hint: 'إدارة الأعمال، المحاسبة، التسويق، والاقتصاد' }
];
export const field = id => FIELDS.find(f => f.id === id);
/* الحادي عشر أكاديمي: يقتصر على المباحث الوزارية المشتركة (رياضيات، عربي، تربية إسلامية، تاريخ) */
const ACADEMIC = ['g11-math', 'g11-arab', 'g11-isl', 'g11-hist'];
const BY_GRADE = g => Object.keys(SUBJ).filter(id => SUBJ[id].grade === g);

/* مواد المرحلة الحالية للطالب */
export function stageSubjects(p) {
  if (!p || !p.stage) return [];
  if (p.stage === 'basic') return BY_GRADE(Number(p.sgrade) || 0);
  if (p.stage === 'academic') return ACADEMIC;
  const f = field(p.field); if (!f) return [];
  return f.req.concat(p.elective && f.opt.includes(p.elective) ? [p.elective] : f.opt);
}
export function stageLabel(p) {
  if (!p || !p.stage) return '';
  if (p.stage === 'basic') return 'الصف ' + GRADE_NAME(Number(p.sgrade) || 0);
  if (p.stage === 'academic') return 'أكاديمي — الصف الحادي عشر';
  const f = field(p.field); return 'التوجيهي — ' + (f ? f.name : 'اختر حقلك');
}
/* هل للمرحلة أسئلة على نمط الوزارة؟ */
export const hasMinistry = p => !!p && (p.stage === 'academic' || p.stage === 'fields');
export function ministryPool(ids) { return ids.flatMap(id => (SUBJ[id] || { mq: [] }).mq); }
