import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, CPT, MODIFIER_COL, UNITS, MINUTES, DOS, PROVIDER, PAYER, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkTherapy, TIMED_CODES } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const VISIT_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, cpt: { ...CPT, required: true },
  modifiers: MODIFIER_COL, units: UNITS, minutes: MINUTES, provider: { ...PROVIDER, phi: 'name' },
  provider_role: t(['Provider Role', 'Role', 'Credential', 'Discipline', 'Provider Type', 'Therapist Type']), payer: PAYER,
  allowed: t(['Allowed', 'Allowed Amount', 'Expected', 'Expected Payment', 'Fee Schedule', 'Contract Amount'], { type: 'money' }),
});
export const PLAN_FIELDS = Object.freeze({
  patient_id: { ...PATIENT_ID, required: true }, patient_name: PATIENT_NAME,
  discipline: t(['Discipline', 'Therapy', 'Therapy Type', 'Service', 'Service Line']),
  start: t(['Start', 'Start Date', 'Cert Start', 'Certification Start', 'From', 'POC Start', 'Plan Start'], { type: 'date', required: true }),
  end: t(['End', 'End Date', 'Cert End', 'Certification End', 'Through', 'Thru', 'POC End', 'Plan End'], { type: 'date' }),
  signed: t(['Signed', 'Signed Date', 'Physician Signed', 'Signature Date', 'Certified On', 'Date Signed'], { type: 'date' }),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  kx_threshold: { type: 'number', minimum: 0, description: 'Yearly KX threshold amount for your year (CMS publishes it each year; check the current figure); default 2410' },
  kx_payers: { type: 'array', maxItems: 30, items: { type: 'string' }, description: 'Words in payer names the KX threshold applies to; default ["medicare"]' },
  timed_codes: { type: 'array', maxItems: 100, items: { type: 'string' }, description: 'Timed codes counted under the 8-minute rule' },
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected payment per unit by code, used when the file has no allowed amount' },
  sign_days: { type: 'integer', minimum: 1, maximum: 120, description: 'Days after the plan start to have the certification signed; default 30' },
  warn_days: { type: 'integer', minimum: 0, maximum: 90, description: 'Days ahead to warn about plans of care ending; default 21' },
} };

const args = {
  visits: fileArg('Therapy charge lines under --root: patient, date, code, modifiers, units, minutes, provider and role, payer, allowed amount'),
  plans: fileArg('Plans of care: patient, discipline (PT, OT, SLP), certification start and end, date signed'),
  settings: fileArg('Optional settings JSON: kx_threshold, kx_payers, timed_codes, rates, sign_days, warn_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'therapy_settings') : {}; return checkTherapy(ctx.records(a.visits, 'visits'), ctx.records(a.plans, 'plans'), { asOf: a.as_of || today(), kxThreshold: s.kx_threshold ?? 2410, kxPayers: s.kx_payers || ['medicare'], timedCodes: s.timed_codes || TIMED_CODES, rates: s.rates || {}, signDays: s.sign_days ?? 30, warnDays: s.warn_days ?? 21 }); };
const summary = (o) => `${o.visits} line(s) for ${o.patients} patient(s), ${o.plans} plan(s) of care. ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'therapy', title: 'Fairpractice Therapy Billing',
  description: 'Checks outpatient therapy billing (PT, OT, speech): visits with no plan of care, certifications unsigned, timed units over the 8-minute rule, missing CQ/CO assistant modifiers and GP/GO/GN discipline modifiers, lines past the yearly KX threshold without KX, and recertifications coming due. Patient names are masked before results reach the model.',
  args, required: ['visits', 'plans'],
  sources: { visits: { label: 'Visits', args: ['visits'], fields: VISIT_FIELDS }, plans: { label: 'Plans of care', args: ['plans'], fields: PLAN_FIELDS } },
  configSchemas: { therapy_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check therapy charges', description: 'List visits with no plan of care, unsigned certifications, 8-minute rule overages, modifier problems, KX gaps and recertifications due.' },
  report: {
    title: { en: 'Therapy billing check', es: 'Revisión de facturación de terapia', de: 'Therapie-Abrechnungsprüfung', fr: 'Contrôle de facturation de rééducation', pt: 'Revisão de faturamento de terapia', it: 'Verifica fatturazione terapia', ja: 'リハビリ請求チェック', zh: '康复治疗计费检查', ko: '치료 청구 점검' },
    base: 'therapy',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, discipline: i.discipline || '', cpt: i.cpt || '', units: i.units ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'cpt', 'units', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'The KX threshold changes each year and the 8-minute rule here is the Medicare method (total timed minutes per day); some commercial payers count per code. Set both in settings.', 'Fairpractice Therapy Billing never decides whether therapy is medically necessary; KX is added only on your clinician\'s record.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Therapy Billing never submits or changes claims.' },
    { name: 'modifier_apply', category: 'binding_send', description: 'Fairpractice Therapy Billing never adds KX or any modifier to a claim; a person decides.' },
  ],
  prompt: { title: 'Therapy billing review', description: 'Walks the host model through a weekly therapy billing review with Fairpractice Therapy Billing.', text: `You are helping an outpatient therapy clinic's billing lead with fairpractice-therapy-billing.

Rules: Fairpractice Therapy Billing only reads files. It never submits claims or adds modifiers, and it never judges medical necessity. Patient names in results are pseudonyms.

1. Call therapy_check with visits, plans, settings and as_of.
2. Lead with no_plan_of_care and cert_unsigned (claims that will deny), then eight_minute_over.
3. Then modifier problems and kx_missing; KX needs the clinician's documentation, not just a number.
4. List recert_due so the front desk can send them.
5. Call therapy_write_report for the clinic manager and billing.` },
});
