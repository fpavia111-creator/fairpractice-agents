import { readFileSync } from 'node:fs';
import { medAgent, fileArg, MONTH_ARG, PATIENT_ID, PATIENT_NAME, CPT, UNITS, DOS, PRACTICE_LIMITS } from 'fairpractice-core';
import { checkApcm, DEFAULT_CONFLICTS } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const PATIENT_FIELDS = Object.freeze({
  patient_id: { ...PATIENT_ID, required: true }, patient_name: PATIENT_NAME,
  conditions: t(['Chronic Conditions', 'Conditions', 'Condition Count', 'Number of Conditions'], { type: 'number' }),
  qmb: t(['QMB', 'Qualified Medicare Beneficiary', 'QMB Status']),
  tier: t(['Tier', 'APCM Level', 'APCM Code', 'Level'], { translate: false }),
  consent_date: t(['Consent Date', 'Consent', 'APCM Consent', 'Consent Signed'], { type: 'date' }),
  start: t(['Enrolled', 'Enrollment Date', 'Start', 'Start Date'], { type: 'date' }),
  end: t(['Disenrolled', 'End', 'End Date', 'Termed'], { type: 'date' }),
});
export const CLAIM_FIELDS = Object.freeze({ patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, cpt: { ...CPT, required: true }, units: UNITS });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected payment by code, for dollar estimates' },
  conflict_codes: { type: 'array', maxItems: 100, items: { type: 'string' }, description: 'Codes not billed in the same month as APCM; replaces the default list (CCM, PCM, TCM)' },
} };
const args = {
  patients: fileArg('APCM enrollment list under --root: patient, chronic condition count, QMB, tier, consent date, enrolled and disenrolled dates'),
  claims: fileArg('Claim lines for the month: patient, date of service, code, units'),
  settings: fileArg('Optional settings JSON: rates, conflict_codes'),
  month: { ...MONTH_ARG, description: 'Month to check, YYYY-MM' },
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'apcm_settings') : {}; return checkApcm(ctx.records(a.patients, 'patients'), ctx.records(a.claims, 'claims'), { month: a.month, rates: s.rates || {}, conflicts: s.conflict_codes || DEFAULT_CONFLICTS }); };
const summary = (o) => `${o.month}: ${o.enrolled} enrolled, ${o.billed_patients} billed. ${o.dollars_at_risk} at risk, ${o.dollars_unbilled} unbilled. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'apcm', title: 'Fairpractice Primary Care APCM',
  description: 'Checks advanced primary care management (APCM, G0556 to G0558) each month: codes billed for patients not enrolled or with no consent, billed twice, billed with care management codes the rules do not allow in the same month, billed at a level the patient record does not support, and enrolled patients not billed. Patient names are masked before results reach the model.',
  args, required: ['patients', 'claims', 'month'],
  sources: { patients: { label: 'APCM enrollment', args: ['patients'], fields: PATIENT_FIELDS }, claims: { label: 'Claims', args: ['claims'], fields: CLAIM_FIELDS } },
  configSchemas: { apcm_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check APCM for a month', description: 'List enrollment and consent problems, double billing, conflicting codes, wrong levels and enrolled patients not billed.' },
  report: {
    title: { en: 'Advanced primary care management check', es: 'Revisión de gestión avanzada de atención primaria', de: 'Prüfung erweiterte Primärversorgung', fr: 'Gestion avancée des soins primaires', pt: 'Gestão avançada da atenção primária', it: 'Gestione avanzata delle cure primarie', ja: '高度プライマリケア管理チェック', zh: '高级初级保健管理检查', ko: '고급 1차 진료 관리 점검' },
    base: 'apcm',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', month: i.month, cpt: i.cpt || '', expected: i.expected || '', amount: i.amount, missed: i.missed ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'month', 'cpt', 'expected', 'amount', 'missed', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'APCM levels and the codes not billed with it follow the Medicare rules as we understand them for 2026; set conflict_codes if your reading differs. The condition count and QMB status come from your list; Fairpractice Primary Care APCM does not read diagnoses.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Primary Care APCM never submits or changes claims.' },
    { name: 'patient_enroll', category: 'binding_send', description: 'Fairpractice Primary Care APCM never enrolls patients or records consent.' },
  ],
  prompt: { title: 'APCM month-end review', description: 'Walks the host model through an APCM month-end with Fairpractice Primary Care APCM.', text: `You are helping a primary care practice's billing lead with fairpractice-primary-care-apcm at month end.

Rules: Fairpractice Primary Care APCM only reads files. It never submits claims, enrolls patients or records consent. Patient names in results are pseudonyms.

1. Call apcm_check with patients, claims, settings and the month.
2. Lead with not_enrolled, no_consent and billed_twice.
3. Then conflicting care management codes and levels the record does not support.
4. Then enrolled patients not billed: money left on the table.
5. Call apcm_write_report for the practice manager.` },
});
