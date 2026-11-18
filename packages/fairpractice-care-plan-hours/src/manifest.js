import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, MINUTES, DOS, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkCarePlans } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const CLIENT_ID = t(['Client ID', 'Client #', 'Member ID', 'Medicaid ID', 'Participant ID', 'Patient ID'], { phi: 'mrn', translate: false });
const CLIENT_NAME = t(['Client', 'Client Name', 'Member', 'Member Name', 'Participant', 'Patient Name'], { phi: 'name' });
const SERVICE = t(['Service', 'Service Code', 'HCPCS', 'Procedure', 'Code', 'Service Type'], { translate: false });

export const PLAN_FIELDS = Object.freeze({
  client_id: CLIENT_ID, client_name: CLIENT_NAME, service: SERVICE,
  weekly_hours: t(['Weekly Hours', 'Hours per Week', 'Authorized Hours', 'Approved Hours', 'Hours/Week'], { type: 'number' }),
  start: t(['Start', 'Start Date', 'Effective', 'From', 'Auth Start'], { type: 'date', required: true }),
  end: t(['End', 'End Date', 'Through', 'Thru', 'Auth End', 'Expires'], { type: 'date' }),
  auth_number: t(['Auth #', 'Authorization', 'Auth Number', 'Plan ID', 'PA #'], { translate: false }),
});
export const VISIT_FIELDS = Object.freeze({
  client_id: CLIENT_ID, client_name: CLIENT_NAME, date: { ...DOS, required: true }, service: SERVICE,
  hours: t(['Hours', 'Hours Worked', 'Visit Hours', 'Duration (hrs)'], { type: 'number' }), minutes: MINUTES,
  clock_in: t(['Clock In', 'Start Time', 'Time In']), clock_out: t(['Clock Out', 'End Time', 'Time Out']),
});
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  weeks: { type: 'integer', minimum: 1, maximum: 26, description: 'Full weeks to check, ending with the last full week on or before as_of; default 4' },
  under_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Percent short of authorized hours that counts as under-delivery; default 20' },
  warn_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Days ahead to warn about plans ending; default 30' },
  rates: { type: 'object', additionalProperties: { type: 'number', minimum: 0 }, description: 'Hourly rate by service code, for dollar estimates' },
} };
const args = {
  plans: fileArg('Plans of care or authorizations under --root: client, service, weekly hours, start and end, authorization number'),
  visits: fileArg('Delivered visits: client, date, service, hours (or minutes, or clock in and out)'),
  settings: fileArg('Optional settings JSON: weeks, under_pct, warn_days, rates'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'careplan_settings') : {}; return checkCarePlans(ctx.records(a.plans, 'plans'), ctx.records(a.visits, 'visits'), { asOf: a.as_of || today(), weeks: s.weeks ?? 4, underPct: s.under_pct ?? 20, warnDays: s.warn_days ?? 30, rates: s.rates || {} }); };
const summary = (o) => `${o.plans} plan(s) for ${o.clients} client(s), weeks ${o.weeks_checked.from} to ${o.weeks_checked.to}. ${o.dollars_at_risk} at risk, ${o.dollars_missed} not delivered. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'careplan', title: 'Fairpractice Care Plan Hours',
  description: 'Checks home care hours against the plan of care or authorization week by week: services delivered with no plan behind them, hours over the weekly authorization that will not be paid, weeks delivered well short of the plan, and plans or authorizations ending soon. Client names are masked before results reach the model.',
  args, required: ['plans', 'visits'],
  sources: { plans: { label: 'Plans of care', args: ['plans'], fields: PLAN_FIELDS }, visits: { label: 'Visits', args: ['visits'], fields: VISIT_FIELDS } },
  configSchemas: { careplan_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check hours against plans of care', description: 'List services not on the plan, over-delivery, under-delivery and plans ending.' },
  report: {
    title: { en: 'Care plan hours check', es: 'Revisión de horas del plan de cuidados', de: 'Prüfung der Pflegeplanstunden', fr: 'Contrôle des heures du plan de soins', pt: 'Revisão de horas do plano de cuidados', it: 'Verifica ore del piano di assistenza', ja: 'ケアプラン時間チェック', zh: '护理计划工时检查', ko: '케어 플랜 시간 점검' },
    base: 'careplan-care-plans',
    rows: (o) => o.items.map((i) => ({ status: i.status, client_id: i.client_id, client_name: i.client_name || '', date: i.date, service: i.service || '', authorized: i.authorized ?? '', delivered: i.delivered ?? i.hours ?? '', amount: i.amount, missed: i.missed ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'client_name', 'date', 'service', 'authorized', 'delivered', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Weeks run Monday to Sunday and only weeks the plan covers in full are judged. Some programs authorize by month or by units; convert those to weekly hours first.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'plan_change_submit', category: 'binding_send', description: 'Fairpractice Care Plan Hours never requests plan or authorization changes.' },
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Care Plan Hours never submits or changes claims.' },
  ],
  prompt: { title: 'Weekly care plan review', description: 'Walks the host model through a weekly hours-against-plan review with Fairpractice Care Plan Hours.', text: `You are helping a home care agency's care coordinator with fairpractice-care-plan-hours.

Rules: Fairpractice Care Plan Hours only reads files. It never requests plan changes or submits claims. Client names in results are pseudonyms.

1. Call careplan_check with plans, visits, settings and as_of.
2. Lead with not_on_plan and over_delivered: hours that will not be paid.
3. Then under_delivered weeks: possible missed care to explain.
4. Then plans ending, so reassessments start in time.
5. Call careplan_write_report for the care coordinator.` },
});
