import { readFileSync } from 'node:fs';
import { medAgent, fileArg, PATIENT_ID, PATIENT_NAME, CPT, UNITS, MINUTES, DOS, PROVIDER, PAYER, KESTREL_LIMITS } from 'kestrel-core';
import { checkBehavioral, DEFAULT_LICENSE_RULES } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const SESSION_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, cpt: { ...CPT, required: true },
  units: UNITS, minutes: MINUTES, start: t(['Start', 'Start Time', 'Time In']), end: t(['End', 'End Time', 'Time Out']),
  provider: PROVIDER, license: t(['License', 'License Type', 'Credential', 'Credentials', 'Provider Type', 'Degree']), payer: PAYER,
  allowed: t(['Allowed', 'Allowed Amount', 'Expected', 'Expected Payment', 'Fee Schedule'], { type: 'money' }),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected payment by code, for dollar estimates' },
  yearly_limits: { type: 'object', additionalProperties: { type: 'integer', minimum: 1 }, description: 'Sessions a year each payer allows per patient, by payer name' },
  license_rules: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } }, description: 'Licenses allowed to bill a code; a trailing * covers a code range. Replaces the default rules (prescriber codes and psychological testing).' },
} };

const args = {
  sessions: fileArg('Session or claim lines under --root: client, date, code, units, minutes (or start and end), provider, license type, payer, allowed amount'),
  settings: fileArg('Optional settings JSON: rates, yearly_limits, license_rules'),
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'jay_settings') : {}; return checkBehavioral(ctx.records(a.sessions, 'sessions'), { rates: s.rates || {}, yearlyLimits: s.yearly_limits || {}, licenseRules: s.license_rules || DEFAULT_LICENSE_RULES }); };
const summary = (o) => `${o.sessions} line(s) for ${o.patients} client(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'jay', title: 'Jay of Behavioral Health',
  description: 'Checks behavioral health billing: psychotherapy codes against session minutes, add-on codes without their base code, crisis time and 90840 units, sessions over a payer\'s yearly limit, and codes billed under a license type that cannot bill them. Client names are masked before results reach the model.',
  args, required: ['sessions'],
  sources: { sessions: { label: 'Sessions', args: ['sessions'], fields: SESSION_FIELDS } },
  configSchemas: { jay_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check behavioral health sessions', description: 'List license problems, add-ons without a base code, time code mismatches, crisis time problems and sessions over yearly limits.' },
  report: {
    title: { en: 'Behavioral health billing check', es: 'Revisión de facturación de salud mental', de: 'Abrechnungsprüfung Psychotherapie', fr: 'Contrôle de facturation en santé mentale', pt: 'Revisão de faturamento de saúde mental', it: 'Verifica fatturazione salute mentale', ja: '行動医療の請求チェック', zh: '行为健康计费检查', ko: '정신건강 청구 점검' },
    base: 'jay-behavioral-health',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, cpt: i.cpt, minutes: i.minutes ?? '', provider: i.provider || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'cpt', 'minutes', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Time ranges follow the CPT psychotherapy time rules as we understand them; which licenses may bill which codes differs by state and payer, so set license_rules to yours.', 'Jay reads only codes, times and license types; it never reads session notes.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Jay never submits or changes claims.' },
    { name: 'note_read', category: 'clinical', description: 'Jay never reads or summarizes session notes.' },
  ],
  prompt: { title: 'Behavioral health billing review', description: 'Walks the host model through a weekly behavioral health billing review with Jay.', text: `You are helping a behavioral health practice's billing lead with jay-of-behavioral-health.

Rules: Jay only reads billing files. It never reads session notes and never submits claims. Client names in results are pseudonyms.

1. Call jay_check with sessions and settings.
2. Lead with license_cannot_bill and addon_without_base (claims that will deny).
3. Then wrong_time_code and crisis_time: the recorded time decides the code.
4. Then sessions over a payer's yearly limit, so the front desk can ask for more.
5. Call jay_write_report for the practice manager.` },
});
