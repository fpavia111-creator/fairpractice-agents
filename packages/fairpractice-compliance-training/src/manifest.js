import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, STAFF_ID, STAFF_NAME, ROLE, DEPARTMENT, STATUS, HIRE_DATE, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkTraining } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const COMPLETION_FIELDS = Object.freeze({
  person_id: { ...STAFF_ID, required: true }, name: STAFF_NAME,
  course: t(['Course', 'Course Name', 'Training', 'Module', 'Title', 'Assignment'], { required: true }),
  completed: t(['Completed', 'Completion Date', 'Date Completed', 'Completed On', 'Finished'], { type: 'date' }),
});
export const ROSTER_FIELDS = Object.freeze({ person_id: { ...STAFF_ID, required: true }, name: STAFF_NAME, role: ROLE, department: DEPARTMENT, hire_date: HIRE_DATE, work_state: t(['Work State', 'State', 'Location State']), status: STATUS });

const SETTINGS = { type: 'object', additionalProperties: false, required: ['courses'], properties: {
  courses: { type: 'array', minItems: 1, maxItems: 200, description: 'Required courses', items: { type: 'object', additionalProperties: false, required: ['course'], properties: {
    course: { type: 'string', description: 'Course name as the learning system writes it' },
    aliases: { type: 'array', maxItems: 20, items: { type: 'string' }, description: 'Other names the same course has had' },
    roles: { type: 'array', maxItems: 100, items: { type: 'string' }, description: 'Only these roles (empty: everyone)' },
    states: { type: 'array', maxItems: 60, items: { type: 'string' }, description: 'Only staff working in these states, e.g. ["TX"] for HB 300' },
    every_days: { type: 'integer', minimum: 1, maximum: 3650, description: 'Refresher interval in days (none: once)' },
    new_hire_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Days after hire to finish it' },
  } } },
  warn_days: { type: 'integer', minimum: 0, maximum: 180, description: 'Days ahead to remind; default 30' },
} };

const args = {
  completions: fileArg('Training completions export (LMS) under --root: person, course and completion date'),
  roster: fileArg('Active staff roster: person, role, department, hire date and work state'),
  settings: fileArg('Settings JSON: courses (name, roles, states, refresher and new-hire days) and warn_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = ctx.readJson(a.settings, 'training_settings'); return checkTraining(ctx.records(a.completions, 'completions'), ctx.records(a.roster, 'roster'), s.courses, { asOf: a.as_of || today(), warnDays: s.warn_days ?? 30 }); };
const summary = (o) => `${o.staff} staff, ${o.assignments} required course assignment(s), ${o.completion_rate}% current. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'training', title: 'Fairpractice Compliance Training',
  description: 'Checks required compliance training per role and work state (HIPAA, fraud waste and abuse, Texas HB 300 and others you list): new hires past their deadline, courses never completed, refreshers overdue and courses coming due, with totals by course and department. Staff names are masked before results reach the model.',
  args, required: ['completions', 'roster', 'settings'],
  sources: { completions: { label: 'Training completions', args: ['completions'], fields: COMPLETION_FIELDS }, roster: { label: 'Staff roster', args: ['roster'], fields: ROSTER_FIELDS } },
  configSchemas: { training_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check required training', description: 'List staff with required compliance courses overdue, never done or due soon.' },
  report: {
    title: { en: 'Compliance training status', es: 'Estado de la capacitación de cumplimiento', de: 'Status der Compliance-Schulungen', fr: 'État des formations conformité', pt: 'Situação dos treinamentos de conformidade', it: 'Stato della formazione compliance', ja: 'コンプライアンス研修の状況', zh: '合规培训状态', ko: '컴플라이언스 교육 현황' },
    base: 'training',
    rows: (o) => o.items.map((i) => ({ status: i.status, person_id: i.person_id, name: i.name, role: i.role || '', department: i.department || '', course: i.course, last_completed: i.last_completed || '', due: i.due || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'name', 'department', 'course', 'last_completed', 'due', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Overdue by course' }, rows: Object.entries(o.by_course).map(([course, count]) => ({ course, count })), columns: ['course', 'count'] }, { title: { en: 'Overdue by department' }, rows: Object.entries(o.by_department).map(([department, count]) => ({ department, count })), columns: ['department', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Which courses a law requires, and how often, is your policy\'s call; the settings hold your answer.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'lms_assign', category: 'production_deploy', description: 'Fairpractice Compliance Training never assigns courses or changes the learning system.' },
    { name: 'manager_email_send', category: 'binding_send', description: 'Fairpractice Compliance Training never emails staff or managers.' },
  ],
  prompt: { title: 'Training compliance review', description: 'Walks the host model through a monthly training review with Fairpractice Compliance Training.', text: `You are helping a compliance or HR coordinator with fairpractice-compliance-training.

Rules: Fairpractice Compliance Training only reads files. Staff names in results are pseudonyms.

1. Call training_check with completions, roster, settings and as_of.
2. Lead with new_hire_overdue, then never_completed and refresher_overdue by department.
3. Call training_write_report for managers.` },
});
