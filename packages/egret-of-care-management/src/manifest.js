import { readFileSync } from 'node:fs';
import { medAgent, fileArg, MONTH_ARG, PATIENT_ID, PATIENT_NAME, CPT, UNITS, MINUTES, DOS, KESTREL_LIMITS } from 'kestrel-core';
import { checkCareManagement } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const TIME_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, minutes: { ...MINUTES, required: true },
  program: t(['Program', 'Service', 'Care Program', 'Type', 'Activity Type']),
  staff_type: t(['Staff Type', 'Credential', 'Role', 'Staff Role', 'Performed By Type']),
});
export const CLAIM_FIELDS = Object.freeze({ patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, cpt: { ...CPT, required: true }, units: UNITS });
export const PATIENT_FIELDS = Object.freeze({
  patient_id: { ...PATIENT_ID, required: true }, patient_name: PATIENT_NAME,
  consent_date: t(['Consent Date', 'Consent', 'CCM Consent', 'Consent Signed', 'Enrollment Date'], { type: 'date' }),
  other_practice_months: t(['Other Practice Months', 'Billed Elsewhere', 'Other Practice CCM', 'CCM Elsewhere']),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected payment by code, for dollar estimates' },
} };

const args = {
  time: fileArg('Care management time log under --root: patient, date, minutes, program (CCM, PCM, BHI), staff type'),
  claims: fileArg('Care management claim lines: patient, date of service, code, units'),
  patients: fileArg('Enrolled patients: patient, consent date, months another practice bills CCM'),
  settings: fileArg('Optional settings JSON: rates'),
  month: MONTH_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'egret_settings') : {}; return checkCareManagement(ctx.records(a.time, 'time'), ctx.records(a.claims, 'claims'), ctx.records(a.patients, 'patients'), { rates: s.rates || {}, month: a.month || null }); };
const summary = (o) => `${o.patient_months} patient-month(s) for ${o.patients} patient(s). ${o.dollars_at_risk} at risk, ${o.dollars_unbilled} unbilled. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'egret', title: 'Egret of Care Management',
  description: 'Checks care management time billing (chronic care, principal care and behavioral health integration): codes billed with no consent, while another practice bills CCM, or alongside a program they cannot be billed with; codes under their minute threshold; add-on units above the time; and months where logged time supports a code nobody billed. Patient names are masked before results reach the model.',
  args, required: ['time', 'claims', 'patients'],
  sources: { time: { label: 'Time log', args: ['time'], fields: TIME_FIELDS }, claims: { label: 'Claims', args: ['claims'], fields: CLAIM_FIELDS }, patients: { label: 'Enrolled patients', args: ['patients'], fields: PATIENT_FIELDS } },
  configSchemas: { egret_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check care management months', description: 'List consent problems, overlaps, codes under their time, add-ons over the time, and time that was never billed.' },
  report: {
    title: { en: 'Care management time check', es: 'Revisión de tiempo de gestión de cuidados', de: 'Prüfung der Versorgungsmanagement-Zeit', fr: 'Gestion des soins : contrôle du temps', pt: 'Gestão de cuidados: revisão de tempo', it: 'Gestione dell\'assistenza: verifica tempi', ja: 'ケアマネジメント時間チェック', zh: '照护管理时间检查', ko: '케어 관리 시간 점검' },
    base: 'egret-care-management',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', month: i.month, cpt: i.cpt || i.codes || '', minutes: i.minutes ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'month', 'cpt', 'minutes', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Minute thresholds and which codes may be billed together follow the Medicare rules as we understand them for 2026; commercial plans and later years may differ. Time is counted by the program column in your log.', 'Egret does not check that a care plan exists or that the patient has the conditions the codes need; a person confirms those.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Egret never submits or changes claims.' },
    { name: 'patient_call', category: 'binding_send', description: 'Egret never contacts patients.' },
  ],
  prompt: { title: 'Care management month-end review', description: 'Walks the host model through a care management month-end with Egret.', text: `You are helping a practice's care management lead with egret-of-care-management at month end.

Rules: Egret only reads files. It never submits claims or contacts patients. Patient names in results are pseudonyms.

1. Call egret_check with time, claims, patients, settings and the month.
2. Lead with no_consent, other_practice and overlap_codes: these deny or get recouped.
3. Then codes under their time and add-ons over it.
4. Then unbilled_time: months where the work was done and nobody billed.
5. Call egret_write_report for the care management lead.` },
});
