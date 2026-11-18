import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, STAFF_ID, STAFF_NAME, ROLE, DEPARTMENT, STATUS, HIRE_DATE, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkStaffHealth } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const RECORD_FIELDS = Object.freeze({
  person_id: { ...STAFF_ID, required: true }, name: STAFF_NAME, department: DEPARTMENT, role: ROLE,
  item: t(['Item', 'Requirement', 'Test', 'Vaccine', 'Screening', 'Type', 'Health Item', 'Compliance Item'], { required: true }),
  done_on: t(['Date', 'Done', 'Date Done', 'Completed', 'Completed On', 'Administered', 'Date Given', 'Test Date', 'Date Read'], { type: 'date' }),
  result: t(['Result', 'Outcome', 'Reading', 'Status Result']),
  declined: t(['Declined', 'Declination', 'Refused', 'Exempt']),
  form_on_file: t(['Form on File', 'Declination Form', 'Signed Form', 'Form Signed', 'Form']),
  followup_on: t(['Follow-up Date', 'Followup Date', 'Follow Up', 'Referred On', 'Cleared On'], { type: 'date' }),
});
export const ROSTER_FIELDS = Object.freeze({ person_id: { ...STAFF_ID, required: true }, name: STAFF_NAME, department: DEPARTMENT, role: ROLE, hire_date: HIRE_DATE, status: STATUS });

const MMDD = { type: 'string', pattern: '^\\d{2}-\\d{2}$' };
const SETTINGS = { type: 'object', additionalProperties: false, required: ['requirements'], properties: {
  requirements: { type: 'array', minItems: 1, maxItems: 100, description: 'What each role must keep current', items: { type: 'object', additionalProperties: false, required: ['item'], properties: {
    item: { type: 'string', description: 'Name as it appears in the records, e.g. "TB test"' },
    every_days: { type: 'integer', minimum: 1, maximum: 3650, description: 'Repeat interval in days (default 365)' },
    season_start: { ...MMDD, description: 'Seasonal items: first day of the season, MM-DD (e.g. 08-01 for flu)' },
    due_by: { ...MMDD, description: 'Seasonal items: due date in the season, MM-DD' },
    roles: { type: 'array', maxItems: 50, items: { type: 'string' }, description: 'Only these roles (empty: everyone)' },
    new_hire_days: { type: 'integer', minimum: -60, maximum: 365, description: 'Days after the hire date a new hire has (0: before the first day; negative: before hire)' },
    declination_allowed: { type: 'boolean', description: 'A signed declination counts for this item' },
  } } },
  warn_days: { type: 'integer', minimum: 0, maximum: 180, description: 'Days ahead to show items coming due; default 30' },
} };

const args = {
  records: fileArg('Employee health records under --root: one row per test, vaccine, fit test or screen with person, item, date, result flag, declination and form'),
  roster: fileArg('Optional active staff roster with hire dates (finds items never done and late new-hire items)'),
  settings: fileArg('Settings JSON: requirements (item, interval or season, roles, new-hire days, declination allowed) and warn_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => {
  const s = ctx.readJson(a.settings, 'staffhealth_settings');
  return checkStaffHealth(ctx.records(a.records, 'records'), a.roster ? ctx.records(a.roster, 'roster') : [], s.requirements, { asOf: a.as_of || today(), warnDays: s.warn_days ?? 30 });
};
const summary = (o) => `${o.staff} staff, ${o.requirements} requirement(s). ${o.out_of_compliance} staff out of compliance. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'staffhealth', title: 'Fairpractice Staff Health',
  description: 'Tracks employee health requirements from HR records (TB tests, flu and other required vaccines or declinations, mask fit tests, annual screens): never done, overdue, new hires past their deadline, declinations with no signed form, results marked for follow-up with no date, and items coming due, by department. It never reads or judges health results. Staff names are masked before results reach the model.',
  args, required: ['records', 'settings'],
  sources: { records: { label: 'Employee health records', args: ['records'], fields: RECORD_FIELDS }, roster: { label: 'Staff roster', args: ['roster'], fields: ROSTER_FIELDS } },
  configSchemas: { staffhealth_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check employee health requirements', description: 'List staff overdue or missing required tests, vaccines and fit tests under your settings.' },
  report: {
    title: { en: 'Employee health compliance', es: 'Cumplimiento de salud del personal', de: 'Mitarbeitergesundheit: Nachweise', fr: 'Conformité santé du personnel', pt: 'Conformidade de saúde dos funcionários', it: 'Conformità sanitaria del personale', ja: '職員健康管理の遵守状況', zh: '员工健康合规', ko: '직원 건강 요건 준수' },
    base: 'staffhealth-staff-health',
    rows: (o) => o.items.map((i) => ({ status: i.status, person_id: i.person_id, name: i.name, department: i.department || '', role: i.role || '', item: i.item, last_done: i.last_done || '', due: i.due || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'name', 'department', 'item', 'last_done', 'due', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Out of compliance by department' }, rows: Object.entries(o.by_department).map(([department, count]) => ({ department, count })), columns: ['department', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'It tracks dates and paperwork only. It does not read, interpret or judge test results or decide who may work; employee health does.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'schedule_remove', category: 'production_deploy', description: 'Fairpractice Staff Health never changes the schedule or anyone\'s work status.' },
    { name: 'health_record_send', category: 'binding_send', description: 'Fairpractice Staff Health never sends employee health records anywhere.' },
  ],
  prompt: { title: 'Employee health compliance', description: 'Walks the host model through a monthly employee health review with Fairpractice Staff Health.', text: `You are helping an employee health or HR coordinator with fairpractice-staff-health.

Rules: Fairpractice Staff Health only reads files and tracks dates. It never interprets results. Staff names in results are pseudonyms.

1. Call staffhealth_check with the records, roster, settings and as_of.
2. Lead with new_hire_late and never_done, then overdue by department.
3. needs_followup goes to employee health; do not discuss the result itself.
4. Call staffhealth_write_report for department managers.` },
});
