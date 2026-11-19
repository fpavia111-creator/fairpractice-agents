import { readFileSync } from 'node:fs';
import { medAgent, fileArg, MONTH_ARG, PATIENT_NAME, PRACTICE_LIMITS } from 'fairpractice-core';
import { checkCapitation } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const MEMBER_ID = t(['Member ID', 'Member #', 'Subscriber ID', 'Insurance ID', 'Medicaid ID', 'Beneficiary ID'], { phi: 'mrn', translate: false, required: true });

export const ROSTER_FIELDS = Object.freeze({
  member_id: MEMBER_ID, patient_name: PATIENT_NAME,
  effective: t(['Effective', 'Effective Date', 'Eff Date', 'Start', 'Start Date', 'Assigned'], { type: 'date' }),
  term: t(['Term', 'Term Date', 'End', 'End Date', 'Disenrolled'], { type: 'date' }),
  category: t(['Rate Category', 'Category', 'Aid Category', 'Rate Cell', 'Age Band', 'Product']),
  rate: t(['Rate', 'PMPM', 'Expected PMPM', 'Cap Rate'], { type: 'money' }),
});
export const PAYMENT_FIELDS = Object.freeze({
  member_id: MEMBER_ID, patient_name: PATIENT_NAME,
  month: t(['Coverage Month', 'Month', 'Service Month', 'Eligibility Month', 'Period'], { required: true }),
  amount: t(['Amount', 'Cap Amount', 'Payment', 'Paid', 'Net Amount'], { type: 'money', required: true }),
  paid_date: t(['Paid Date', 'Payment Date', 'Check Date', 'Run Date'], { type: 'date' }),
});
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected monthly rate by rate category, when the roster has no rate column' },
  tolerance: { type: 'number', minimum: 0, maximum: 10, description: 'Difference ignored as rounding; default 0.01' },
} };
const args = {
  roster: fileArg('Your member roster under --root: member ID, name, effective and term dates, rate category or rate'),
  payments: fileArg('Capitation payment detail: member ID, coverage month, amount (negative for takebacks), paid date'),
  settings: fileArg('Optional settings JSON: rates, tolerance'),
  from: { ...MONTH_ARG, description: 'First month to check, YYYY-MM; default the first month paid' },
  to: { ...MONTH_ARG, description: 'Last month to check, YYYY-MM; default the last month paid' },
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'capitation_settings') : {}; return checkCapitation(ctx.records(a.roster, 'roster'), ctx.records(a.payments, 'payments'), { rates: s.rates || {}, tolerance: s.tolerance ?? 0.01, from: a.from || null, to: a.to || null }); };
const summary = (o) => `${o.months.length ? `${o.months[0]} to ${o.months.at(-1)}` : 'No months'}: ${o.members} member(s), expected ${o.expected}, paid ${o.paid}. Underpaid ${o.to_dispute} to dispute, overpaid ${o.to_set_aside} to set aside (net ${o.net}). ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'capitation', title: 'Fairpractice Capitation',
  description: 'Reconciles capitation payments with your member roster month by month: eligible members not paid, members paid at the wrong rate or twice, payments for members not eligible, and retroactive adds and terms, with the amount to dispute and the amount to set aside for recoupment. Member names and IDs are masked before results reach the model.',
  args, required: ['roster', 'payments'],
  sources: { roster: { label: 'Member roster', args: ['roster'], fields: ROSTER_FIELDS }, payments: { label: 'Capitation payments', args: ['payments'], fields: PAYMENT_FIELDS } },
  configSchemas: { capitation_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Reconcile capitation', description: 'List members not paid, wrong rates, duplicates, payments for members not eligible, and retro adds and terms, with the net to dispute.' },
  report: {
    title: { en: 'Capitation reconciliation', es: 'Conciliación de capitación', de: 'Kopfpauschalen-Abgleich', fr: 'Rapprochement de la capitation', pt: 'Conciliação de capitação', it: 'Riconciliazione della capitazione', ja: '人頭払い照合', zh: '按人头付费核对', ko: '인두제 대사' },
    base: 'capitation',
    rows: (o) => o.items.map((i) => ({ status: i.status, member_id: i.member_id, patient_name: i.patient_name || '', month: i.month, expected: i.expected ?? '', paid: i.paid ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'month', 'expected', 'paid', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'A member counts as eligible for a month when the roster dates cover the first of the month; contracts that prorate or use another rule will differ. Rates come from your roster or settings.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'dispute_submit', category: 'binding_send', description: 'Fairpractice Capitation never sends disputes to a plan.' },
    { name: 'refund_send', category: 'payment', description: 'Fairpractice Capitation never sends refunds or payments.' },
  ],
  prompt: { title: 'Monthly capitation reconciliation', description: 'Walks the host model through a capitation reconciliation with Fairpractice Capitation.', text: `You are helping a practice's finance lead with fairpractice-capitation when the plan's capitation detail arrives.

Rules: Fairpractice Capitation only reads files. It never sends disputes or refunds. Member names and IDs in results are pseudonyms.

1. Call capitation_check with roster, payments and settings (and from/to months if given).
2. Lead with the amount to dispute (not_paid and short wrong_rate lines).
3. Then duplicates and payments for members not eligible: money to set aside.
4. Then retro adds and terms to check against the practice's records.
5. Call capitation_write_report for the finance lead.` },
});
