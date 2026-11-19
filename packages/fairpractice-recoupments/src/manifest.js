import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, DOS, PAYER, CLAIM_ID, PAID, AMOUNT, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkRecoupments } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const REF = t(['Claim #', 'Claim Ref', 'Original Claim', 'Claim ID', 'Patient Control #', 'ICN', 'Reference'], { translate: false, required: true });

export const RECOUP_FIELDS = Object.freeze({
  payer: PAYER, remit_date: t(['Remit Date', 'Date', 'Check Date', 'EFT Date', 'Offset Date', 'Payment Date'], { type: 'date', required: true }), claim_ref: REF,
  amount: { ...AMOUNT, aliases: ['Amount', 'Recoupment', 'Offset', 'Takeback', 'Adjustment Amount', 'Amt'], required: true },
  reason: t(['Reason', 'Reason Code', 'PLB Code', 'Adjustment Reason']), check: t(['Check #', 'Check', 'EFT #', 'Trace #'], { translate: false }),
});
export const CLAIM_FIELDS = Object.freeze({ claim_id: { ...CLAIM_ID, required: true }, patient_id: PATIENT_ID, patient_name: PATIENT_NAME, payer: PAYER, dos: DOS, paid: PAID, paid_date: t(['Paid Date', 'Payment Date', 'Remit Date', 'Check Date'], { type: 'date' }) });
export const NOTICE_FIELDS = Object.freeze({ payer: PAYER, claim_ref: REF, notice_date: t(['Notice Date', 'Letter Date', 'Date', 'Received'], { type: 'date', required: true }), amount: AMOUNT });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  appeal_days: { type: 'object', additionalProperties: { type: 'integer', minimum: 1, maximum: 730 }, description: 'Days to appeal from the notice (or the recoupment if no notice), by payer name, plus "default" (default 120). Set from your contracts.' },
  warn_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Days ahead to warn about an appeal window closing; default 21' },
  lookback_months: { type: 'integer', minimum: 1, maximum: 120, description: 'Months after payment beyond which a recoupment is flagged (your state limit or contract); off when not set' },
  notice_lead_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Days of notice required before a recoupment; default 0 (any notice before it)' },
} };
const args = {
  recoupments: fileArg('Recoupment or offset lines under --root (from remits or payer letters): payer, date, original claim reference, amount, reason, check or EFT number'),
  claims: fileArg('Your paid claims: claim number, patient, payer, date of service, paid amount, paid date'),
  notices: fileArg('Optional overpayment notices received: payer, claim reference, notice date, amount'),
  settings: fileArg('Optional settings JSON: appeal_days, warn_days, lookback_months, notice_lead_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'recoup_settings') : {}; return checkRecoupments(ctx.records(a.recoupments, 'recoupments'), ctx.records(a.claims, 'claims'), a.notices ? ctx.records(a.notices, 'notices') : [], { asOf: a.as_of || today(), appealDays: s.appeal_days || { default: 120 }, warnDays: s.warn_days ?? 21, lookbackMonths: s.lookback_months ?? null, noticeLeadDays: s.notice_lead_days ?? 0 }); };
const summary = (o) => `${o.recoupments} recoupment(s), ${o.total_recouped} taken back, ${o.matched} matched to a claim. ${o.dollars_disputable} to dispute, ${o.dollars_appealable} still appealable. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'recoup', title: 'Fairpractice Recoupments',
  description: 'Matches payer recoupments and offsets to the original claims: the same claim taken back twice, more taken than was paid, takebacks beyond the lookback you set, recoupments with no notice on file, takebacks for claims you cannot find, and appeal windows still open. Patient names are masked before results reach the model.',
  args, required: ['recoupments', 'claims'],
  sources: { recoupments: { label: 'Recoupments', args: ['recoupments'], fields: RECOUP_FIELDS }, claims: { label: 'Paid claims', args: ['claims'], fields: CLAIM_FIELDS }, notices: { label: 'Overpayment notices', args: ['notices'], fields: NOTICE_FIELDS } },
  configSchemas: { recoup_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check recoupments', description: 'List duplicate takebacks, excess takebacks, late recoupments, missing notices, unmatched takebacks and open appeal windows.' },
  report: {
    title: { en: 'Recoupment review', es: 'Revisión de recuperaciones del pagador', de: 'Prüfung von Rückforderungen', fr: 'Revue des récupérations', pt: 'Revisão de estornos', it: 'Verifica dei recuperi', ja: '回収（相殺）の確認', zh: '追回款审查', ko: '환수 검토' },
    base: 'recoupments',
    rows: (o) => o.items.map((i) => ({ status: i.status, claim_id: i.claim_id, patient_id: i.patient_id || '', patient_name: i.patient_name || '', payer: i.payer, date: i.date, recouped: i.recouped, appeal_due: i.appeal_due, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'claim_id', 'patient_name', 'payer', 'date', 'recouped', 'appeal_due', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Appeal windows, notice rules and lookback limits come only from your settings; state prompt-pay and recoupment laws differ and Fairpractice Recoupments does not know them.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'appeal_submit', category: 'binding_send', description: 'Fairpractice Recoupments never files appeals or disputes.' },
    { name: 'refund_send', category: 'payment', description: 'Fairpractice Recoupments never sends refunds.' },
  ],
  prompt: { title: 'Recoupment review', description: 'Walks the host model through a monthly recoupment review with Fairpractice Recoupments.', text: `You are helping a practice's payment posting or recovery lead with fairpractice-recoupments.

Rules: Fairpractice Recoupments only reads files. It never files appeals or sends refunds. Patient names in results are pseudonyms. It gives no legal advice.

1. Call recoup_check with recoupments, claims, notices, settings and as_of.
2. Lead with taken_twice and over_original: money the payer should return.
3. Then takebacks beyond the lookback and without notice, and unmatched takebacks.
4. Then appeal windows closing soon.
5. Call recoup_write_report for the recovery lead.` },
});
