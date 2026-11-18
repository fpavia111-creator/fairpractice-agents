import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, CPT, DOS, PAYER, CLAIM_ID, PAID, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkDisputes } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const DISPUTE_FIELDS = Object.freeze({
  claim_id: CLAIM_ID, patient_id: PATIENT_ID, patient_name: PATIENT_NAME, payer: PAYER, cpt: CPT, date: DOS,
  initial_payment_date: t(['Initial Payment Date', 'Remit Date', 'Payment Date', 'Denial Date', 'ERA Date', 'Initial Payment'], { type: 'date' }),
  paid: PAID, qpa: t(['QPA', 'Qualifying Payment Amount', 'QPA Amount'], { type: 'money' }),
  our_offer: t(['Our Offer', 'Offer', 'Provider Offer', 'Counteroffer'], { type: 'money' }),
  negotiation_sent: t(['Negotiation Sent', 'Open Negotiation Sent', 'Open Negotiation Date', 'ON Notice Date'], { type: 'date' }),
  idr_initiated: t(['IDR Initiated', 'IDR Date', 'IDR Filed', 'Initiation Date'], { type: 'date' }),
  outcome: t(['Outcome', 'Status', 'Result', 'Determination']),
  award: t(['Award', 'Awarded', 'Determination Amount', 'Final Amount'], { type: 'money' }),
  fees_paid: t(['Fees Paid', 'Fees', 'IDR Fees', 'Admin Fee Paid'], { type: 'money' }),
});
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  negotiation_days: { type: 'integer', minimum: 1, maximum: 60, description: 'Business days for open negotiation (to start it, and its length); default 30' },
  idr_days: { type: 'integer', minimum: 1, maximum: 30, description: 'Business days after negotiation ends to start IDR; default 4' },
  warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Business days ahead to warn about the negotiation start deadline; default 10' },
  admin_fee: { type: 'number', minimum: 0, description: 'Administrative fee per party per dispute for your year (check CMS); default 115' },
  entity_fee: { type: 'number', minimum: 0, description: 'Expected IDR entity fee, for judging low-value disputes; default 0' },
  qpa_gap_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Percent below the QPA a payment must be to be listed; default 10' },
  holidays: { type: 'array', maxItems: 50, items: { type: 'string' }, description: 'Extra non-business days (YYYY-MM-DD) beyond federal holidays' },
} };
const args = {
  disputes: fileArg('Dispute log under --root: claim, patient, payer, code, service date, initial payment or denial date, paid, QPA, our offer, negotiation sent, IDR initiated, outcome, award, fees paid'),
  settings: fileArg('Optional settings JSON: negotiation_days, idr_days, warn_days, admin_fee, entity_fee, qpa_gap_pct, holidays'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'disputes_settings') : {}; return checkDisputes(ctx.records(a.disputes, 'disputes'), { asOf: a.as_of || today(), negotiationDays: s.negotiation_days ?? 30, idrDays: s.idr_days ?? 4, warnDays: s.warn_days ?? 10, adminFee: s.admin_fee ?? 115, entityFee: s.entity_fee ?? 0, qpaGapPct: s.qpa_gap_pct ?? 10, holidays: s.holidays || [] }); };
const summary = (o) => `${o.disputes} dispute(s) across ${o.by_payer.length} payer(s); ${o.awarded_over_paid} won above initial payments, ${o.fees_paid} in fees paid. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'disputes', title: 'Fairpractice Surprise Billing Disputes',
  description: 'Tracks No Surprises Act payment disputes: the 30-business-day window to start open negotiation, the 4-business-day window to start IDR after it ends, payments below the payer\'s own QPA, disputes worth less than the fees, claims that could be batched, and outcomes and fees by payer. Patient names are masked before results reach the model.',
  args, required: ['disputes'],
  sources: { disputes: { label: 'Disputes', args: ['disputes'], fields: DISPUTE_FIELDS } },
  configSchemas: { disputes_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check dispute deadlines', description: 'List missed and coming negotiation and IDR deadlines, payments below QPA, low-value disputes and batching groups, with outcomes by payer.' },
  report: {
    title: { en: 'Surprise billing dispute tracker', es: 'Seguimiento de disputas de facturación sorpresa', de: 'Streitfälle nach dem No Surprises Act', fr: 'Suivi des litiges No Surprises Act', pt: 'Disputas da No Surprises Act', it: 'Controversie No Surprises Act', ja: 'サプライズ請求紛争の追跡', zh: '意外账单争议跟踪', ko: '깜짝 청구 분쟁 추적' },
    base: 'disputes',
    rows: (o) => o.items.map((i) => ({ status: i.status, claim_id: i.claim_id, patient_id: i.patient_id || '', patient_name: i.patient_name || '', payer: i.payer, cpt: i.cpt || '', date: i.date, paid: i.paid ?? '', qpa: i.qpa ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'claim_id', 'patient_name', 'payer', 'date', 'paid', 'qpa', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Outcomes by payer' }, rows: o.by_payer, columns: ['payer', 'disputes', 'won', 'lost', 'pending', 'win_rate', 'awarded_over_paid', 'fees_paid'] }, { title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Deadlines count business days and skip weekends and federal holidays; the federal IDR rules, fees and batching rules change, and state surprise-billing laws may apply instead. Check the current federal guidance.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'idr_initiate', category: 'binding_send', description: 'Fairpractice Surprise Billing Disputes never files IDR or sends negotiation notices.' },
    { name: 'settlement_accept', category: 'payment', description: 'Fairpractice Surprise Billing Disputes never accepts settlements.' },
  ],
  prompt: { title: 'Dispute deadline review', description: 'Walks the host model through a weekly No Surprises Act dispute review with Fairpractice Surprise Billing Disputes.', text: `You are helping an out-of-network practice's dispute lead with fairpractice-surprise-billing-disputes.

Rules: Fairpractice Surprise Billing Disputes only reads files. It never files IDR, sends notices or accepts settlements. Patient names in results are pseudonyms. It gives no legal advice.

1. Call disputes_check with disputes, settings and as_of.
2. Lead with idr_due and negotiation_due_soon: business-day clocks that close fast. Report missed windows plainly.
3. Then payments below QPA (strong cases), low-value disputes and batching groups.
4. Summarize outcomes and fees by payer.
5. Call disputes_write_report for the dispute lead.` },
});
