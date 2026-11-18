import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, PROVIDER, NPI, PAYER, DOS, KESTREL_LIMITS, today } from 'kestrel-core';
import { checkAttribution } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const MEMBER_ID = t(['Member ID', 'Member #', 'Subscriber ID', 'Insurance ID', 'MBI', 'Beneficiary ID', 'Policy #'], { phi: 'mrn', translate: false });
const DOB = t(['DOB', 'Date of Birth', 'Birth Date', 'Birthdate'], { type: 'date', phi: 'dob' });

export const ROSTER_FIELDS = Object.freeze({ member_id: MEMBER_ID, patient_name: PATIENT_NAME, dob: DOB, provider: t(['Attributed Provider', 'PCP', 'Provider', 'Assigned Provider', 'PCP Name']), npi: t(['PCP NPI', 'Attributed NPI', 'NPI', 'Provider NPI'], { translate: false }) });
export const VISIT_FIELDS = Object.freeze({ patient_id: PATIENT_ID, member_id: MEMBER_ID, patient_name: PATIENT_NAME, dob: DOB, date: { ...DOS, required: true }, provider: PROVIDER, npi: NPI, payer: PAYER });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  lookback_months: { type: 'integer', minimum: 1, maximum: 60, description: 'Months of visits that make a patient active; default 24 (contracts vary)' },
  payer_words: { type: 'array', maxItems: 20, items: { type: 'string' }, description: 'Words in the visit payer column that mean this contract\'s payer' },
  pmpm: { type: 'number', minimum: 0, description: 'Monthly payment per attributed member, to price patients left out or dropped' },
} };
const args = {
  roster: fileArg('This month\'s attribution roster from the payer under --root: member ID, name, date of birth, attributed provider or NPI'),
  prior: fileArg('Optional: last month\'s roster, to list adds and drops'),
  visits: fileArg('Your visit list: patient, member ID, name, date of birth, date, provider, NPI, payer'),
  settings: fileArg('Optional settings JSON: lookback_months, payer_words, pmpm'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'stork_settings') : {}; return checkAttribution(ctx.records(a.roster, 'roster'), ctx.records(a.visits, 'visits'), a.prior ? ctx.records(a.prior, 'prior') : [], { asOf: a.as_of || today(), lookbackMonths: s.lookback_months ?? 24, payerWords: s.payer_words || [], pmpm: s.pmpm ?? 0 }); };
const summary = (o) => `${o.attributed} attributed (${o.prior_attributed} last month), ${o.active_patients} active patient(s) with this payer. ${o.dollars_at_risk} a month at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'stork', title: 'Stork of Attribution',
  description: 'Reconciles a value-based contract\'s attribution roster with your visits: active patients the payer left out, patients dropped since last month, patients attributed to a provider who never saw them, attributed patients you have not seen, and new adds. Patient names, member IDs and birth dates are masked before results reach the model.',
  args, required: ['roster', 'visits'],
  sources: { roster: { label: 'Attribution roster', args: ['roster'], fields: ROSTER_FIELDS }, prior: { label: 'Last month\'s roster', args: ['prior'], fields: ROSTER_FIELDS }, visits: { label: 'Visits', args: ['visits'], fields: VISIT_FIELDS } },
  configSchemas: { stork_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Reconcile attribution', description: 'List patients left out, dropped, attributed to the wrong provider, not seen and newly added.' },
  report: {
    title: { en: 'Attribution reconciliation', es: 'Conciliación de atribución', de: 'Zuordnungsabgleich', fr: 'Rapprochement de l\'attribution', pt: 'Conciliação de atribuição', it: 'Riconciliazione dell\'attribuzione', ja: '帰属照合', zh: '归属核对', ko: '귀속 대사' },
    base: 'stork-attribution',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id || '', member_id: i.member_id || '', patient_name: i.patient_name || '', provider: i.provider || '', seen_by: i.seen_by || '', last_visit: i.last_visit || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'provider', 'seen_by', 'last_visit', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Each payer has its own attribution method (plurality of visits, PCP choice, claims windows); Stork compares the roster with your visits only, not with the payer\'s method.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'roster_dispute_submit', category: 'binding_send', description: 'Stork never sends attribution disputes to a payer.' },
    { name: 'patient_outreach_send', category: 'binding_send', description: 'Stork never contacts patients.' },
  ],
  prompt: { title: 'Monthly attribution review', description: 'Walks the host model through a monthly roster review with Stork.', text: `You are helping a practice's value-based care lead with stork-of-attribution when the payer's monthly roster arrives.

Rules: Stork only reads files. It never sends disputes or contacts patients. Patient names and member IDs in results are pseudonyms.

1. Call stork_check with roster, prior, visits, settings and as_of.
2. Lead with left_out and dropped patients who are still active: each is a monthly payment.
3. Then wrong_provider, which skews each provider's panel and quality numbers.
4. Then not_seen patients for outreach, and new adds.
5. Call stork_write_report for the value-based care lead.` },
});
