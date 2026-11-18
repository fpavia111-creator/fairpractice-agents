import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkLiens } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const CASE_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME,
  case_id: t(['Case', 'Case #', 'Case ID', 'Case Number', 'Claim #', 'File #', 'Matter'], { translate: false }),
  attorney: t(['Attorney', 'Law Firm', 'Firm', 'Attorney Name', 'Counsel', 'Lawyer']),
  injury_date: t(['Injury Date', 'Date of Injury', 'DOI', 'Accident Date', 'Date of Loss', 'DOL'], { type: 'date' }),
  state: t(['State', 'Venue', 'Jurisdiction', 'Case State']),
  lop_signed: t(['LOP Signed', 'LOP Date', 'Lien Signed', 'Letter of Protection', 'Lien Date'], { type: 'date' }),
  charges: t(['Charges', 'Billed', 'Total Charges', 'Lien Amount', 'Amount Billed'], { type: 'money' }),
  paid: t(['Paid', 'Amount Paid', 'Payments', 'Collected', 'Received'], { type: 'money' }),
  reduction_pct: t(['Reduction %', 'Reduction', 'Reduction Pct', 'Discount %', 'Write Down %'], { type: 'number' }),
  status: t(['Status', 'Case Status', 'Stage']),
  settled_date: t(['Settled Date', 'Settlement Date', 'Closed Date', 'Resolved', 'Date Closed'], { type: 'date' }),
  last_update: t(['Last Update', 'Last Contact', 'Updated', 'Last Status Date', 'Last Follow Up'], { type: 'date' }),
  suit_filed: t(['Suit Filed', 'Lawsuit Filed', 'Filed', 'Litigation']),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  statute_years: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 20 }, description: 'Filing window in years by state code, plus "default". You set these; Fairpractice Injury Liens does not know any state\'s law' },
  warn_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Days before the window ends to warn; default 60' },
  pay_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Days after settlement to expect payment; default 30' },
  stale_days: { type: 'integer', minimum: 1, maximum: 730, description: 'Days without an update before a case is stale; default 90' },
  max_reduction_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Largest reduction your policy allows without sign-off; default 33' },
} };

const args = {
  cases: fileArg('Lien or letter-of-protection log under --root: patient, case, attorney, injury date, state, LOP signed, charges, paid, reduction %, status, settled date, last update, suit filed'),
  settings: fileArg('Optional settings JSON: statute_years, warn_days, pay_days, stale_days, max_reduction_pct'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'liens_settings') : {}; return checkLiens(ctx.records(a.cases, 'cases'), { asOf: a.as_of || today(), statuteYears: s.statute_years || { default: 2 }, warnDays: s.warn_days ?? 60, payDays: s.pay_days ?? 30, staleDays: s.stale_days ?? 90, maxReductionPct: s.max_reduction_pct ?? 33 }); };
const summary = (o) => `${o.cases} case(s), ${o.open_cases} open with ${o.open_balance} outstanding across ${o.attorneys.length} attorney(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'liens', title: 'Fairpractice Injury Liens',
  description: 'Tracks personal injury liens and letters of protection: open balances by attorney, settled cases not paid, dropped cases with balances, filing windows passed or near (from the years you set), open cases with no signed letter, reductions over your limit and cases with no recent update. Patient names are masked before results reach the model.',
  args, required: ['cases'],
  sources: { cases: { label: 'Lien cases', args: ['cases'], fields: CASE_FIELDS } },
  configSchemas: { liens_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check lien and LOP cases', description: 'List settled cases not paid, dropped cases, filing windows, missing letters, large reductions and stale cases, with open balances by attorney.' },
  report: {
    title: { en: 'Personal injury lien check', es: 'Revisión de gravámenes por lesiones', de: 'Pfandrechte bei Personenschäden', fr: 'Privilèges pour dommages corporels', pt: 'Penhoras de danos pessoais', it: 'Privilegi per lesioni personali', ja: '人身傷害リーエンのチェック', zh: '人身伤害留置权检查', ko: '상해 유치권 점검' },
    base: 'liens',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', case_id: i.case_id || '', attorney: i.attorney, date: i.date, balance: i.balance, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'attorney', 'date', 'balance', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Open balances by attorney' }, rows: o.attorneys, columns: ['attorney', 'cases', 'balance'] }, { title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Filing windows come only from the years you set per state; Fairpractice Injury Liens does not know any state\'s statute of limitations, tolling or exceptions. Ask your lawyer.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'attorney_email_send', category: 'binding_send', description: 'Fairpractice Injury Liens never contacts attorneys.' },
    { name: 'reduction_accept', category: 'payment', description: 'Fairpractice Injury Liens never accepts or offers reductions.' },
  ],
  prompt: { title: 'Lien case review', description: 'Walks the host model through a monthly lien and LOP review with Fairpractice Injury Liens.', text: `You are helping a practice's personal injury billing lead with fairpractice-injury-liens.

Rules: Fairpractice Injury Liens only reads files. It never contacts attorneys or accepts reductions, and it gives no legal advice: filing windows come from the years the practice set. Patient names in results are pseudonyms.

1. Call liens_check with cases, settings and as_of.
2. Lead with settled_not_paid and case_dropped: money owed now.
3. Then filing windows passed or near, and open cases with no letter of protection.
4. Then reductions over the limit and stale cases; group follow-ups by attorney.
5. Call liens_write_report for the practice manager.` },
});
