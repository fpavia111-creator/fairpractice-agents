import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkHospice } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const PATIENT_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME,
  election: t(['Election Date', 'Election', 'Admission Date', 'Admit Date', 'Admitted', 'Start of Care', 'SOC'], { type: 'date', required: true }),
  noe_filed: t(['NOE Filed', 'NOE Date', 'NOE Accepted', 'NOE Submitted', 'Notice of Election Filed'], { type: 'date' }),
  discharge: t(['Discharge Date', 'Discharge', 'Discharged', 'Revocation Date', 'End Date', 'Date of Death'], { type: 'date' }),
  discharge_reason: t(['Discharge Reason', 'Reason', 'Discharge Type', 'Disposition']),
  notr_filed: t(['NOTR Filed', 'NOTR Date', 'NOTR Submitted', 'Notice of Termination Filed'], { type: 'date' }),
  starting_period: t(['Starting Period', 'Benefit Period', 'First Period', 'Period at Admission'], { type: 'number' }),
  f2f: t(['F2F Dates', 'F2F', 'Face to Face', 'Face-to-Face Dates', 'F2F Encounter']),
  cap_paid: t(['Cap Year Paid', 'Medicare Paid', 'Paid', 'Payments'], { type: 'money' }),
  cap_share: t(['Cap Share', 'Beneficiary Share', 'Proportional Share', 'Beneficiary Count'], { type: 'number' }),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  cap_amount: { type: 'number', minimum: 0, description: 'Per-beneficiary cap amount for the cap year (CMS publishes it each year); no cap check without it' },
  cap_year: { type: 'integer', minimum: 2000, maximum: 2100, description: 'Cap year to check, named by the year it ends (2026 = October 1 2025 to September 30 2026); default the one holding as_of' },
  cap_warn_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Percent of the cap at which to warn; default 90' },
  daily_rate: { type: 'number', minimum: 0, description: 'Routine home care daily rate, for dollars on late notices; default 0' },
  noe_days: { type: 'integer', minimum: 1, maximum: 30, description: 'Calendar days to file the NOE; default 5' },
  notr_days: { type: 'integer', minimum: 1, maximum: 30, description: 'Calendar days to file the NOTR; default 5' },
  f2f_window: { type: 'integer', minimum: 1, maximum: 60, description: 'Days before a period starts that a face-to-face may happen; default 30' },
  warn_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Days ahead to list face-to-face encounters coming due; default 45' },
  live_discharge_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Live discharge rate over 12 months to flag; default 20' },
} };

const args = {
  patients: fileArg('Hospice census under --root: patient, election date, NOE filed, discharge date and reason, NOTR filed, starting benefit period, face-to-face dates, Medicare paid in the cap year, cap share'),
  settings: fileArg('Optional settings JSON: cap_amount, cap_year, cap_warn_pct, daily_rate, noe_days, notr_days, f2f_window, warn_days, live_discharge_pct'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'hospice_settings') : {}; return checkHospice(ctx.records(a.patients, 'patients'), { asOf: a.as_of || today(), capAmount: s.cap_amount ?? null, capYear: s.cap_year ?? null, capWarnPct: s.cap_warn_pct ?? 90, dailyRate: s.daily_rate ?? 0, noeDays: s.noe_days ?? 5, notrDays: s.notr_days ?? 5, f2fWindow: s.f2f_window ?? 30, warnDays: s.warn_days ?? 45, liveDischargePct: s.live_discharge_pct ?? 20 }); };
const summary = (o) => `${o.patients} patient(s). Cap year ${o.cap_year}${o.cap ? `: paid ${o.cap.paid} of ${o.cap.limit} (${o.cap.pct}%)` : ': no cap amount set'}. Live discharge rate ${o.live_discharge_rate ?? 'n/a'}%. ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'hospice', title: 'Fairpractice Hospice Billing',
  description: 'Checks hospice billing deadlines and the cap: notices of election and of termination or revocation missing or late (with the days not covered), face-to-face encounters missing before the third and later benefit periods, the aggregate cap for the cap year, and a high live-discharge rate. Patient names are masked before results reach the model.',
  args, required: ['patients'],
  sources: { patients: { label: 'Hospice patients', args: ['patients'], fields: PATIENT_FIELDS } },
  configSchemas: { hospice_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check hospice notices, periods and cap', description: 'List missing or late NOEs and NOTRs, missing or coming face-to-face encounters, the cap position and the live-discharge rate.' },
  report: {
    title: { en: 'Hospice notices and cap check', es: 'Revisión de avisos y tope de hospicio', de: 'Hospiz: Meldungen und Obergrenze', fr: 'Soins palliatifs : avis et plafond', pt: 'Hospice: avisos e teto', it: 'Hospice: notifiche e tetto', ja: 'ホスピスの通知とキャップ', zh: '临终关怀通知与上限检查', ko: '호스피스 통지 및 상한 점검' },
    base: 'hospice',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id || '', patient_name: i.patient_name || '', date: i.date, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'The cap estimate counts one beneficiary per new election in the cap year unless you give a share; the real figure uses the proportional method across all hospices and comes from CMS data.', 'Notice deadlines are calendar days; exceptions for late NOEs are the MAC\'s to grant.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'noe_submit', category: 'binding_send', description: 'Fairpractice Hospice Billing never files notices of election or termination.' },
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Hospice Billing never submits or changes claims.' },
  ],
  prompt: { title: 'Hospice billing deadlines review', description: 'Walks the host model through a weekly hospice deadline and cap review with Fairpractice Hospice Billing.', text: `You are helping a hospice's billing or compliance lead with fairpractice-hospice-billing.

Rules: Fairpractice Hospice Billing only reads files. It never files notices or claims. Patient names in results are pseudonyms.

1. Call hospice_check with patients, settings and as_of.
2. Lead with noe_missing and notr_missing: every day counts.
3. Then late notices, missing face-to-face encounters and the cap position.
4. List face-to-face encounters coming due so the medical team can schedule them.
5. Call hospice_write_report for the administrator.` },
});
