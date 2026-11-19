import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, NPI, AMOUNT, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkPhysicianPayments } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const PHYS = t(['Physician', 'Physician Name', 'Doctor', 'Provider', 'Payee', 'Vendor', 'Name'], { phi: 'name' });
const CID = t(['Contract ID', 'Contract #', 'Agreement', 'Agreement ID', 'Contract'], { translate: false });

export const CONTRACT_FIELDS = Object.freeze({
  contract_id: CID, physician: { ...PHYS, required: true }, npi: NPI,
  type: t(['Type', 'Arrangement', 'Contract Type', 'Agreement Type', 'Service']),
  signed: t(['Signed', 'Signed Date', 'Executed', 'Date Signed', 'Execution Date'], { type: 'date' }),
  start: t(['Start', 'Effective', 'Effective Date', 'Start Date', 'Term Start'], { type: 'date' }),
  end: t(['End', 'End Date', 'Expires', 'Term End', 'Expiration'], { type: 'date' }),
  hourly_rate: t(['Hourly Rate', 'Rate', 'Rate per Hour'], { type: 'money' }),
  annual_cap: t(['Annual Cap', 'Annual Maximum', 'Cap', 'Max per Year'], { type: 'money' }),
  time_log_required: t(['Time Log Required', 'Time Log', 'Timesheet Required', 'Documentation Required']),
});
export const PAYMENT_FIELDS = Object.freeze({
  physician: { ...PHYS, required: true }, npi: NPI, contract_id: CID,
  date: t(['Date', 'Payment Date', 'Check Date', 'Paid On'], { type: 'date', required: true }),
  amount: { ...AMOUNT, required: true }, hours: t(['Hours', 'Hours Worked', 'Time'], { type: 'number' }),
  time_log: t(['Time Log', 'Timesheet', 'Log Attached', 'Documentation']),
});

const BAND = { type: 'object', additionalProperties: false, required: ['high'], properties: { low: { type: 'number', minimum: 0 }, high: { type: 'number', minimum: 0 } } };
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  fmv_hourly: { type: 'object', additionalProperties: BAND, description: 'Your fair-market-value hourly range by arrangement type, from your valuation, e.g. {"medical director": {"low": 150, "high": 275}}' },
  warn_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Days ahead to list contracts ending; default 60' },
} };

const args = {
  contracts: fileArg('Physician agreements under --root: contract id, physician, NPI, type, signed date, start and end, hourly rate, annual cap and whether a time log is required'),
  payments: fileArg('Payments to physicians from accounts payable or payroll: physician, NPI, date, amount, hours, time log and contract id'),
  settings: fileArg('Optional settings JSON: fmv_hourly ranges by type and warn_days'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'physician_settings') : {}; return checkPhysicianPayments(ctx.records(a.contracts, 'contracts'), ctx.records(a.payments, 'payments'), { asOf: a.as_of || today(), warnDays: s.warn_days ?? 60, fmv: s.fmv_hourly || {} }); };
const summary = (o) => `${o.contracts} agreement(s), ${o.payments} payment(s) totaling ${o.paid_total}. ${o.dollars_flagged} in flagged payments. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'physician', title: 'Fairpractice Physician Contracts',
  description: 'Checks payments to physicians who may refer patients against their written agreements (the paperwork side of Stark and anti-kickback rules): payments with no agreement, unsigned or signed after payment, after the agreement ended, over the yearly cap, hourly rates above the contract or your fair-market-value range, missing time logs, and agreements ending soon. Physician names are masked before results reach the model.',
  args, required: ['contracts', 'payments'],
  sources: { contracts: { label: 'Physician agreements', args: ['contracts'], fields: CONTRACT_FIELDS }, payments: { label: 'Payments to physicians', args: ['payments'], fields: PAYMENT_FIELDS } },
  configSchemas: { physician_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check physician payments against agreements', description: 'List payments to physicians that lack a current signed agreement, exceed caps or rates, or lack time logs.' },
  report: {
    title: { en: 'Physician arrangement payments', es: 'Pagos a médicos frente a contratos', de: 'Zahlungen an Ärzte und Verträge', fr: 'Paiements aux médecins et contrats', pt: 'Pagamentos a médicos e contratos', it: 'Pagamenti ai medici e contratti', ja: '医師への支払いと契約', zh: '医生付款与合同核对', ko: '의사 지급과 계약 대조' },
    base: 'physician-payments',
    rows: (o) => o.items.map((i) => ({ status: i.status, physician: i.physician || '', contract_id: i.contract_id || '', type: i.type || '', date: i.date || '', amount: i.amount, at_risk: i.at_risk, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'physician', 'contract_id', 'date', 'amount', 'at_risk', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Stark and anti-kickback questions turn on facts and exceptions only counsel can weigh; this checks your paperwork against itself and your FMV settings.', PRACTICE_LIMITS.advice],
  },
  refused: [
    { name: 'payment_release', category: 'payment', description: 'Fairpractice Physician Contracts never releases or stops a payment.' },
    { name: 'self_disclosure_submit', category: 'binding_send', description: 'Fairpractice Physician Contracts never files a self-disclosure with CMS or OIG.' },
  ],
  prompt: { title: 'Physician arrangement review', description: 'Walks the host model through a quarterly physician payment review with Fairpractice Physician Contracts.', text: `You are helping a compliance officer with fairpractice-physician-contracts.

Rules: Fairpractice Physician Contracts only reads files. It never judges legality; counsel does. Physician names in results are pseudonyms.

1. Call physician_check with the agreements, payments, settings and as_of.
2. Lead with paid_no_contract, signed_after_payment and unsigned_contract.
3. Then caps, rates and time logs; then agreements ending soon.
4. Call physician_write_report for the compliance committee and counsel.` },
});
