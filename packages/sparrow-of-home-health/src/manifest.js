import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, DOS, PAYER, KESTREL_LIMITS, today } from 'kestrel-core';
import { checkHomeHealth } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const PERIOD_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME,
  start: t(['Period Start', 'Start', 'Start Date', 'From', 'Episode Start', 'Period From'], { type: 'date', required: true }),
  end: t(['Period End', 'End', 'End Date', 'Through', 'Thru', 'Episode End', 'Period To'], { type: 'date' }),
  admission: t(['Admission', 'Start of Care', 'SOC', 'First Period', 'Admit Period']),
  noa_filed: t(['NOA Filed', 'NOA Date', 'NOA Submitted', 'NOA Accepted', 'Notice of Admission'], { type: 'date' }),
  lupa_threshold: t(['LUPA Threshold', 'LUPA', 'Visit Threshold', 'Threshold'], { type: 'number' }),
  payment: t(['Expected Payment', 'Payment', 'Period Payment', 'Expected', 'Amount'], { type: 'money' }), payer: PAYER,
});
export const VISIT_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true },
  discipline: t(['Discipline', 'Visit Type', 'Service', 'Type']),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  noa_days: { type: 'integer', minimum: 1, maximum: 30, description: 'Calendar days to file the notice of admission; default 5' },
  lupa_default: { type: 'integer', minimum: 1, maximum: 10, description: 'Low-utilization threshold when a period has none; default 2 (thresholds run 2 to 6 by case-mix group)' },
  per_visit_rate: { type: 'number', minimum: 0, description: 'Average per-visit payment, to estimate the loss on a low-utilization period; default 0' },
  warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Days before a period ends to warn about low visits; default 7' },
} };

const args = {
  periods: fileArg('30-day periods under --root: patient, period start and end, admission (Y for the start of care), NOA filed, LUPA threshold, expected payment'),
  visits: fileArg('Visit log: patient, visit date, discipline'),
  settings: fileArg('Optional settings JSON: noa_days, lupa_default, per_visit_rate, warn_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'sparrow_settings') : {}; return checkHomeHealth(ctx.records(a.periods, 'periods'), ctx.records(a.visits, 'visits'), { asOf: a.as_of || today(), noaDays: s.noa_days ?? 5, lupaDefault: s.lupa_default ?? 2, perVisitRate: s.per_visit_rate ?? 0, warnDays: s.warn_days ?? 7 }); };
const summary = (o) => `${o.periods} period(s), ${o.visits} visit(s), ${o.patients} patient(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'sparrow', title: 'Sparrow of Home Health',
  description: 'Checks home health 30-day periods: notices of admission missing or late (with the payment cut per day), periods that overlap, visits outside any period, and periods that ended or are ending under the low-utilization visit threshold. Patient names are masked before results reach the model.',
  args, required: ['periods', 'visits'],
  sources: { periods: { label: '30-day periods', args: ['periods'], fields: PERIOD_FIELDS }, visits: { label: 'Visits', args: ['visits'], fields: VISIT_FIELDS } },
  configSchemas: { sparrow_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check home health periods', description: 'List missing or late NOAs, overlapping periods, stray visits and low-utilization periods.' },
  report: {
    title: { en: 'Home health period check', es: 'Revisión de periodos de salud en el hogar', de: 'Häusliche Pflege: Zeiträume', fr: 'Soins à domicile : périodes', pt: 'Saúde domiciliar: períodos', it: 'Assistenza domiciliare: periodi', ja: '在宅医療の期間チェック', zh: '居家医疗周期检查', ko: '가정 의료 기간 점검' },
    base: 'sparrow-home-health',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, period_end: i.period_end || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'period_end', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Low-utilization thresholds come from each period\'s case-mix group; give them per period or the default is used.', 'Notice deadlines are calendar days; exceptions are the MAC\'s to grant.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'noa_submit', category: 'binding_send', description: 'Sparrow never files notices of admission.' },
    { name: 'claim_submit', category: 'binding_send', description: 'Sparrow never submits or changes claims.' },
  ],
  prompt: { title: 'Home health period review', description: 'Walks the host model through a weekly home health billing review with Sparrow.', text: `You are helping a home health agency's billing lead with sparrow-of-home-health.

Rules: Sparrow only reads files. It never files notices or claims. Patient names in results are pseudonyms.

1. Call sparrow_check with periods, visits, settings and as_of.
2. Lead with noa_missing: each day cuts the payment by another thirtieth.
3. Then late NOAs, overlapping periods and visits outside any period.
4. Then low-utilization periods, and those at risk so the clinical manager can check the visit plan.
5. Call sparrow_write_report for the administrator.` },
});
