import { readFileSync } from 'node:fs';
import { medAgent, fileArg, PATIENT_ID, PATIENT_NAME, DOS, CLAIM_ID, PAYER, KESTREL_LIMITS } from 'fairpractice-core';
import { checkCodeUpdates } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const CODE = t(['Code', 'CPT', 'HCPCS', 'ICD-10', 'CPT/HCPCS', 'Procedure Code', 'Item Code', 'Charge Code'], { translate: false, required: true });

export const CHANGE_FIELDS = Object.freeze({
  code: CODE, code_set: t(['Code Set', 'Type', 'Code Type', 'Set', 'Vocabulary']),
  action: t(['Action', 'Change', 'Change Type', 'Status', 'Add/Delete/Revise'], { required: true }),
  effective: t(['Effective', 'Effective Date', 'Start Date', 'Release Date'], { type: 'date' }),
  replacement: t(['Replacement', 'Replaced By', 'Crosswalk', 'New Code', 'Use Instead'], { translate: false }),
  description: t(['Description', 'Descriptor', 'Short Description']),
});
export const CDM_FIELDS = Object.freeze({ code: CODE, description: t(['Description', 'Charge Description', 'Item Description']), price: t(['Price', 'Charge', 'Standard Charge', 'Gross Charge', 'Fee'], { type: 'money' }), active: t(['Active', 'Status', 'Active Flag']) });
export const FEE_FIELDS = Object.freeze({ payer: PAYER, code: CODE, rate: t(['Rate', 'Allowed', 'Fee', 'Contract Rate'], { type: 'money' }) });
export const ORDER_SET_FIELDS = Object.freeze({ order_set: t(['Order Set', 'Template', 'Panel', 'Favorite List', 'Protocol'], { required: true }), code: CODE });
export const OPEN_CLAIM_FIELDS = Object.freeze({ claim_id: CLAIM_ID, patient_id: PATIENT_ID, patient_name: PATIENT_NAME, dos: DOS, codes: t(['Codes', 'CPT Codes', 'Procedure Codes', 'Procedures', 'CPT']), diagnoses: t(['Diagnoses', 'Diagnosis Codes', 'ICD-10 Codes', 'DX', 'Dx Codes']) });

const args = {
  changes: fileArg('Code update file under --root, from the official release you license: code, code set, action (added, deleted, revised), effective date, replacement'),
  chargemaster: fileArg('Your chargemaster: code, description, price, active'),
  fee_schedule: fileArg('Optional payer fee schedules: payer, code, rate'),
  order_sets: fileArg('Optional order sets or templates: order set name, code'),
  open_claims: fileArg('Optional open or unbilled claims: claim, patient, date of service, procedure codes, diagnosis codes'),
};
const run = (a, ctx) => checkCodeUpdates(ctx.records(a.changes, 'changes'), ctx.records(a.chargemaster, 'chargemaster'), { feeSchedule: a.fee_schedule ? ctx.records(a.fee_schedule, 'fee_schedule') : [], orderSets: a.order_sets ? ctx.records(a.order_sets, 'order_sets') : [], openClaims: a.open_claims ? ctx.records(a.open_claims, 'open_claims') : [] });
const summary = (o) => `${o.changes} change(s) (${o.deleted} deleted, ${o.added} added, ${o.revised} revised) against ${o.chargemaster_codes} chargemaster code(s). ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'codes', title: 'Fairpractice Code Updates',
  description: 'Shows what a code-set update (CPT, HCPCS, ICD-10) means for you: deleted codes still on open claims, the chargemaster, order sets and fee schedules; new replacement codes with no price; and revised codes to re-describe. You supply the update file from the official release. Patient names on open claims are masked before results reach the model.',
  args, required: ['changes', 'chargemaster'],
  sources: { changes: { label: 'Code changes', args: ['changes'], fields: CHANGE_FIELDS }, chargemaster: { label: 'Chargemaster', args: ['chargemaster'], fields: CDM_FIELDS }, fee_schedule: { label: 'Fee schedule', args: ['fee_schedule'], fields: FEE_FIELDS }, order_sets: { label: 'Order sets', args: ['order_sets'], fields: ORDER_SET_FIELDS }, open_claims: { label: 'Open claims', args: ['open_claims'], fields: OPEN_CLAIM_FIELDS } },
  configSchemas: {}, memoryKinds: {},
  run, summary,
  check: { title: 'Check a code update against your files', description: 'List deleted codes on open claims, the chargemaster, order sets and fee schedules, new codes with no price and revised codes.' },
  report: {
    title: { en: 'Code update impact', es: 'Impacto de la actualización de códigos', de: 'Auswirkungen der Code-Aktualisierung', fr: 'Impact de la mise à jour des codes', pt: 'Impacto da atualização de códigos', it: 'Impatto dell\'aggiornamento dei codici', ja: 'コード改定の影響', zh: '代码更新影响', ko: '코드 개정 영향' },
    base: 'codes-code-updates',
    rows: (o) => o.items.map((i) => ({ status: i.status, code: i.code, code_set: i.code_set, effective: i.effective || '', replacement: i.replacement || '', where: i.order_set || i.payers || i.claim_id || '', patient_name: i.patient_name || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'code', 'code_set', 'effective', 'replacement', 'where', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Fairpractice Code Updates ships no code lists or descriptions: CPT is licensed by the AMA, and you load the update from the official release you are licensed to use. Replacement codes are what the update file names, not a coding decision.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'chargemaster_update', category: 'production_deploy', description: 'Fairpractice Code Updates never changes the chargemaster or fee schedules.' },
    { name: 'claim_recode', category: 'binding_send', description: 'Fairpractice Code Updates never changes codes on claims; a coder decides.' },
  ],
  prompt: { title: 'Annual code update review', description: 'Walks the host model through a code update review with Fairpractice Code Updates.', text: `You are helping a practice's charge master or coding lead with fairpractice-code-updates when a code-set update is released.

Rules: Fairpractice Code Updates only reads files. It never changes the chargemaster or claims, and it does not choose codes. Patient names in results are pseudonyms.

1. Call codes_check with changes, chargemaster, fee_schedule, order_sets and open_claims.
2. Lead with deleted codes on open claims: they will reject.
3. Then the chargemaster and order sets to update before the effective date.
4. Then new codes needing a price and fee schedules to load; then revised codes.
5. Call codes_write_report for the coding lead.` },
});
