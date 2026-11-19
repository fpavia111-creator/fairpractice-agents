import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, CPT, UNITS, MINUTES, DOS, PROVIDER, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkAba } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const AUTH_NO = t(['Auth #', 'Auth Number', 'Authorization', 'Authorization #', 'Auth ID', 'PA #'], { translate: false });

export const SESSION_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true },
  start: t(['Start', 'Start Time', 'Time In', 'From Time']), end: t(['End', 'End Time', 'Time Out', 'To Time']),
  minutes: MINUTES, cpt: { ...CPT, required: true }, units: UNITS, provider: { ...PROVIDER, phi: 'name' },
  provider_role: t(['Provider Role', 'Role', 'Credential', 'Provider Credential', 'Staff Type']), auth_number: AUTH_NO,
});
export const AUTH_FIELDS = Object.freeze({
  patient_id: { ...PATIENT_ID, required: true }, patient_name: PATIENT_NAME, auth_number: AUTH_NO,
  cpt: CPT, units: t(['Units', 'Authorized Units', 'Approved Units', 'Total Units'], { type: 'number' }),
  weekly_units: t(['Weekly Units', 'Units per Week', 'Weekly Limit', 'Max per Week'], { type: 'number' }),
  start: t(['Start', 'Start Date', 'From', 'Effective', 'Auth Start'], { type: 'date', required: true }),
  end: t(['End', 'End Date', 'Through', 'Thru', 'Expires', 'Auth End'], { type: 'date' }),
});

const CODES = { type: 'array', maxItems: 50, items: { type: 'string' } };
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  unit_minutes: { type: 'integer', minimum: 1, maximum: 60, description: 'Minutes in one unit; default 15' },
  supervision_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Minimum supervision as a percent of technician direct time per client per month (certification and payer minimums vary); default 5' },
  direct_codes: { ...CODES, description: 'Codes for technician direct treatment; default 97153, 97154' },
  supervision_codes: { ...CODES, description: 'Codes that count as supervision when a BCBA bills them; default 97155' },
  qualified_only_codes: { ...CODES, description: 'Codes only a qualified professional may bill; default 97151, 97155, 97156, 97157' },
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Expected payment per unit by code, for dollar totals' },
  warn_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Days ahead to warn about authorizations ending; default 30' },
  unused_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Percent unused at which an ending authorization is listed; default 25' },
} };

const args = {
  sessions: fileArg('Session or claim lines under --root: client, date, start and end times or minutes, code, units, provider and provider role, authorization number'),
  authorizations: fileArg('Authorization log: client, authorization number, code (blank for all), units, weekly units, start and end'),
  settings: fileArg('Optional settings JSON: unit_minutes, supervision_pct, direct_codes, supervision_codes, qualified_only_codes, rates, warn_days, unused_pct'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'aba_settings') : {}; return checkAba(ctx.records(a.sessions, 'sessions'), ctx.records(a.authorizations, 'authorizations'), { asOf: a.as_of || today(), unitMinutes: s.unit_minutes ?? 15, supervisionPct: s.supervision_pct ?? 5, directCodes: s.direct_codes || ['97153', '97154'], supervisionCodes: s.supervision_codes || ['97155'], qhpOnly: s.qualified_only_codes || ['97151', '97155', '97156', '97157'], rates: s.rates || {}, warnDays: s.warn_days ?? 30, unusedPct: s.unused_pct ?? 25 }); };
const summary = (o) => `${o.sessions} session line(s) for ${o.clients} client(s), ${o.authorizations} authorization(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'aba', title: 'Fairpractice ABA Therapy',
  description: 'Checks ABA therapy billing against authorizations: sessions with no authorization, units over the total or weekly authorized amount, units above what the session minutes support, codes billed by a technician that need a BCBA, supervision below your monthly minimum, and authorizations ending with hours unused. Client names are masked before results reach the model.',
  args, required: ['sessions', 'authorizations'],
  sources: { sessions: { label: 'Sessions', args: ['sessions'], fields: SESSION_FIELDS }, authorizations: { label: 'Authorizations', args: ['authorizations'], fields: AUTH_FIELDS } },
  configSchemas: { aba_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check ABA sessions against authorizations', description: 'List sessions with no or exhausted authorization, unit and role problems, low supervision and authorizations ending unused.' },
  report: {
    title: { en: 'ABA authorization and unit check', es: 'Revisión de autorizaciones y unidades ABA', de: 'ABA: Genehmigungen und Einheiten', fr: 'ABA : autorisations et unités', pt: 'ABA: autorizações e unidades', it: 'ABA: autorizzazioni e unità', ja: 'ABA の承認と単位チェック', zh: 'ABA 授权与单位检查', ko: 'ABA 승인 및 단위 점검' },
    base: 'aba',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, cpt: i.cpt || '', units: i.units ?? '', provider: i.provider || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'cpt', 'units', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Payer rules for ABA (units, supervision share, who may bill which code) differ by plan and state; the settings hold yours.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice ABA Therapy never submits or changes claims.' },
    { name: 'auth_request_submit', category: 'binding_send', description: 'Fairpractice ABA Therapy never requests authorizations from a payer.' },
  ],
  prompt: { title: 'ABA billing review', description: 'Walks the host model through a weekly ABA billing review with Fairpractice ABA Therapy.', text: `You are helping an ABA clinic's billing lead with fairpractice-aba-therapy.

Rules: Fairpractice ABA Therapy only reads files. It never submits claims or requests authorizations. Client names in results are pseudonyms.

1. Call aba_check with sessions, authorizations, settings and as_of.
2. Lead with no_auth and over_auth_total (claims that will deny), then weekly and unit problems.
3. Then supervision_low and authorizations ending with hours unused.
4. Call aba_write_report for the clinical director and billing.` },
});
