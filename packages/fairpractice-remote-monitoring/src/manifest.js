import { readFileSync } from 'node:fs';
import { medAgent, fileArg, PATIENT_ID, PATIENT_NAME, CPT, UNITS, MINUTES, DOS, KESTREL_LIMITS } from 'fairpractice-core';
import { checkRpm } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const READING_FIELDS = Object.freeze({ patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: t(['Reading Date', 'Date', 'Measured', 'Timestamp', 'Reading Time', 'Transmission Date'], { type: 'date', required: true }) });
export const TIME_FIELDS = Object.freeze({ patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, minutes: { ...MINUTES, required: true }, interactive: t(['Interactive', 'Interactive Contact', 'Live Contact', 'Two-way', 'Call Completed']) });
export const CLAIM_FIELDS = Object.freeze({ patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, cpt: { ...CPT, required: true }, units: UNITS, period_start: t(['Period Start', 'From', 'From Date', 'Start'], { type: 'date' }) });
export const PATIENT_FIELDS = Object.freeze({ patient_id: { ...PATIENT_ID, required: true }, patient_name: PATIENT_NAME, episode_start: t(['Episode Start', 'Enrolled', 'Enrollment Date', 'Start Date', 'Program Start'], { type: 'date' }) });

const SETTINGS = { type: 'object', additionalProperties: false, properties: { rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected payment by code, for dollar estimates' } } };
const args = {
  readings: fileArg('Device readings under --root: patient and reading date (one row per reading or per day)'),
  time: fileArg('Management time log: patient, date, minutes, interactive contact (yes/no)'),
  claims: fileArg('Monitoring claim lines: patient, date of service, code, units, period start'),
  patients: fileArg('Optional enrolled patients: patient, episode start'),
  settings: fileArg('Optional settings JSON: rates'),
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'rpm_settings') : {}; return checkRpm(ctx.records(a.readings, 'readings'), ctx.records(a.time, 'time'), ctx.records(a.claims, 'claims'), a.patients ? ctx.records(a.patients, 'patients') : [], { rates: s.rates || {} }); };
const summary = (o) => `${o.claim_lines} claim line(s) for ${o.patients} patient(s), ${o.reading_days} reading day(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'rpm', title: 'Fairpractice Remote Monitoring',
  description: 'Checks remote patient monitoring billing: device supply codes against days of readings in each 30-day period, overlapping periods, setup billed more than once per episode, management minutes and add-on units, months with no interactive contact, and RPM billed with remote therapeutic monitoring. Patient names are masked before results reach the model.',
  args, required: ['readings', 'time', 'claims'],
  sources: { readings: { label: 'Readings', args: ['readings'], fields: READING_FIELDS }, time: { label: 'Management time', args: ['time'], fields: TIME_FIELDS }, claims: { label: 'Claims', args: ['claims'], fields: CLAIM_FIELDS }, patients: { label: 'Enrolled patients', args: ['patients'], fields: PATIENT_FIELDS } },
  configSchemas: { rpm_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check remote monitoring billing', description: 'List repeat setups, overlapping periods, short reading days, RTM overlaps, months with no interactive contact and short minutes.' },
  report: {
    title: { en: 'Remote monitoring billing check', es: 'Revisión de monitoreo remoto', de: 'Telemonitoring: Abrechnungsprüfung', fr: 'Télésurveillance : contrôle de facturation', pt: 'Monitoramento remoto: revisão', it: 'Monitoraggio remoto: verifica', ja: '遠隔モニタリング請求チェック', zh: '远程监测计费检查', ko: '원격 모니터링 청구 점검' },
    base: 'rpm-remote-monitoring',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, cpt: i.cpt, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'cpt', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Day and minute thresholds follow the Medicare codes as we understand them for 2026, including the shorter-period codes 99445 and 99470; check your payers.', 'Fairpractice Remote Monitoring counts reading days only; it never reads or judges the readings themselves.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Remote Monitoring never submits or changes claims.' },
    { name: 'reading_interpret', category: 'clinical', description: 'Fairpractice Remote Monitoring never reads, interprets or acts on the readings.' },
  ],
  prompt: { title: 'Remote monitoring month-end review', description: 'Walks the host model through a monitoring month-end with Fairpractice Remote Monitoring.', text: `You are helping a practice's remote monitoring lead with fairpractice-remote-monitoring.

Rules: Fairpractice Remote Monitoring only reads files. It never submits claims and never interprets readings. Patient names in results are pseudonyms.

1. Call rpm_check with readings, time, claims, patients and settings.
2. Lead with setup_repeat and period_overlap, then days_short (each one names the code that fits).
3. Then RTM overlaps, months with no interactive contact and short minutes.
4. Call rpm_write_report for the monitoring lead.` },
});
