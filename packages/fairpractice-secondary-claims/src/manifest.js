import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, DOS, PAYER, CLAIM_ID, CHARGE, PAID, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkSecondary } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const ORDER_F = t(['Payer Order', 'Order', 'Sequence', 'COB Order', 'Priority', 'Payer Sequence']);

export const CLAIM_FIELDS = Object.freeze({
  claim_id: CLAIM_ID, patient_id: PATIENT_ID, patient_name: PATIENT_NAME, dos: { ...DOS, required: true }, payer: { ...PAYER, required: true }, order: ORDER_F,
  billed: CHARGE, paid: PAID, patient_resp: t(['Patient Responsibility', 'Patient Resp', 'PR', 'Balance', 'Remaining Balance'], { type: 'money' }),
  sent_date: t(['Sent', 'Sent Date', 'Submitted', 'Submission Date', 'Billed Date'], { type: 'date' }),
  adjudicated_date: t(['Adjudicated', 'Adjudicated Date', 'Paid Date', 'Remit Date', 'EOB Date', 'Processed Date'], { type: 'date' }),
  eob_attached: t(['EOB Attached', 'Primary EOB', 'COB Info', 'EOB Sent']),
});
export const COVERAGE_FIELDS = Object.freeze({
  patient_id: { ...PATIENT_ID, required: true }, patient_name: PATIENT_NAME, payer: { ...PAYER, required: true }, order: { ...ORDER_F, required: true },
  effective: t(['Effective', 'Effective Date', 'Start', 'Start Date'], { type: 'date' }), term: t(['Term', 'Term Date', 'End', 'End Date'], { type: 'date' }),
});
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  filing_days: { type: 'object', additionalProperties: { type: 'integer', minimum: 1, maximum: 1095 }, description: 'Days after the prior payer\'s adjudication to file with the next payer, by payer name, plus "default" (default 90). Set from your payer contracts.' },
  warn_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Days ahead to warn about a filing window closing; default 21' },
} };
const args = {
  claims: fileArg('Claim headers under --root: claim, patient, date of service, payer, payer order, billed, paid, patient responsibility, sent date, adjudicated date, EOB attached'),
  coverage: fileArg('Coverage on file: patient, payer, order (primary, secondary, tertiary), effective and term dates'),
  settings: fileArg('Optional settings JSON: filing_days, warn_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'secondary_settings') : {}; return checkSecondary(ctx.records(a.claims, 'claims'), ctx.records(a.coverage, 'coverage'), { asOf: a.as_of || today(), filingDays: s.filing_days || { default: 90 }, warnDays: s.warn_days ?? 21 }); };
const summary = (o) => `${o.claims} claim(s) for ${o.patients} patient(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'secondary', title: 'Fairpractice Secondary Claims',
  description: 'Checks secondary and tertiary claims: balances left after the primary pays with no claim to the next payer (and the filing window for it), claims to the next payer sent before the primary adjudicated or without its EOB, and payers billed in the wrong order against the coverage on file. Patient names are masked before results reach the model.',
  args, required: ['claims', 'coverage'],
  sources: { claims: { label: 'Claims', args: ['claims'], fields: CLAIM_FIELDS }, coverage: { label: 'Coverage', args: ['coverage'], fields: COVERAGE_FIELDS } },
  configSchemas: { secondary_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check secondary claims', description: 'List missed and closing secondary filing windows, wrong payer order, secondaries not sent and secondaries sent too early.' },
  report: {
    title: { en: 'Secondary claims check', es: 'Revisión de reclamaciones secundarias', de: 'Prüfung der Sekundärabrechnungen', fr: 'Contrôle des demandes secondaires', pt: 'Revisão de cobranças secundárias', it: 'Verifica richieste secondarie', ja: '二次請求チェック', zh: '次要理赔检查', ko: '2차 청구 점검' },
    base: 'secondary-claims',
    rows: (o) => o.items.map((i) => ({ status: i.status, claim_id: i.claim_id, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, payer: i.payer, due: i.due || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'claim_id', 'patient_name', 'payer', 'due', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Filing windows for secondary claims come from the days you set per payer; Fairpractice Secondary Claims does not know any payer\'s rules. Crossover claims sent by Medicare automatically may not show as sent in your file.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Secondary Claims never submits or changes claims.' },
    { name: 'patient_statement_send', category: 'binding_send', description: 'Fairpractice Secondary Claims never bills patients.' },
  ],
  prompt: { title: 'Secondary claims work list', description: 'Walks the host model through a weekly secondary claims review with Fairpractice Secondary Claims.', text: `You are helping a billing team's follow-up lead with fairpractice-secondary-claims.

Rules: Fairpractice Secondary Claims only reads files. It never submits claims or bills patients. Patient names in results are pseudonyms.

1. Call secondary_check with claims, coverage, settings and as_of.
2. Lead with filing_closing (send this week) and filing_missed (decide what to do).
3. Then wrong payer order, which needs a call to check coordination of benefits.
4. Then secondaries not sent yet and those sent too early.
5. Call secondary_write_report for the follow-up team.` },
});
