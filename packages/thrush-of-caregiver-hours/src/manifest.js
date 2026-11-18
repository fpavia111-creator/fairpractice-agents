import { readFileSync } from 'node:fs';
import { medAgent, fileArg, STAFF_ID, STAFF_NAME, MINUTES, DOS, KESTREL_LIMITS } from 'kestrel-core';
import { checkCaregiverHours } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const CG_ID = { ...STAFF_ID, aliases: ['Caregiver ID', 'Worker ID', 'Aide ID', 'Employee ID', 'Staff ID', 'Emp ID'] };
const CG_NAME = { ...STAFF_NAME, aliases: ['Caregiver', 'Caregiver Name', 'Worker', 'Aide', 'Employee', 'Employee Name', 'Staff Name'] };

export const SHIFT_FIELDS = Object.freeze({
  caregiver_id: CG_ID, caregiver_name: CG_NAME, client_id: t(['Client ID', 'Client', 'Client #', 'Member ID'], { phi: 'mrn', translate: false }), date: { ...DOS, required: true },
  clock_in: t(['Clock In', 'Start', 'Time In', 'Shift Start']), clock_out: t(['Clock Out', 'End', 'Time Out', 'Shift End']), minutes: MINUTES,
  meal_minutes: t(['Meal Minutes', 'Meal Break', 'Break Minutes', 'Lunch Minutes'], { type: 'number' }),
  live_in: t(['Live In', 'Live-In', 'Live-in Shift', '24 Hour']), sleep_minutes: t(['Sleep Minutes', 'Sleep Time', 'Sleep'], { type: 'number' }),
  sleep_interrupted: t(['Sleep Interrupted', 'Interrupted', 'Sleep Interruptions']), pay_rate: t(['Pay Rate', 'Rate', 'Hourly Rate', 'Wage'], { type: 'money' }),
});
export const PAYROLL_FIELDS = Object.freeze({
  caregiver_id: CG_ID, caregiver_name: CG_NAME, week_start: t(['Week Start', 'Week', 'Week Of', 'Period Start', 'Pay Week'], { type: 'date', required: true }),
  regular_hours: t(['Regular Hours', 'Reg Hours', 'Regular', 'REG'], { type: 'number' }), overtime_hours: t(['Overtime Hours', 'OT Hours', 'Overtime', 'OT'], { type: 'number' }),
});
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  ot_hours: { type: 'number', minimum: 1, maximum: 80, description: 'Weekly hours after which overtime is owed; default 40' },
  week_start: { type: 'string', enum: ['monday', 'sunday'], description: 'First day of your workweek; default monday' },
  max_travel_minutes: { type: 'integer', minimum: 0, maximum: 240, description: 'Same-day gaps between different clients up to this many minutes count as travel worked; default 60' },
  split_gap_minutes: { type: 'integer', minimum: 0, maximum: 600, description: 'Longer unpaid gaps count as a split shift; default 60' },
  split_premium: { type: 'number', minimum: 0, description: 'Split-shift premium your state requires, per split; off when not set' },
  meal_after_hours: { type: 'number', minimum: 1, maximum: 12, description: 'Shifts longer than this need a meal break under your state rules; off when not set' },
  meal_minutes: { type: 'integer', minimum: 1, maximum: 120, description: 'Length of the required meal break; default 30' },
  sleep_cap_minutes: { type: 'integer', minimum: 0, maximum: 720, description: 'Most live-in sleep time that may be left unpaid; default 480' },
} };
const args = {
  shifts: fileArg('Shift or visit export under --root: caregiver, client, date, clock in and out (or minutes), meal minutes, live-in, sleep minutes and interruptions, pay rate'),
  payroll: fileArg('Optional payroll hours by week: caregiver, week start, regular hours, overtime hours'),
  settings: fileArg('Optional settings JSON: ot_hours, week_start, max_travel_minutes, split_gap_minutes, split_premium, meal_after_hours, meal_minutes, sleep_cap_minutes'),
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'thrush_settings') : {}; return checkCaregiverHours(ctx.records(a.shifts, 'shifts'), a.payroll ? ctx.records(a.payroll, 'payroll') : [], { otHours: s.ot_hours ?? 40, weekStartDay: s.week_start || 'monday', maxTravel: s.max_travel_minutes ?? 60, splitGap: s.split_gap_minutes ?? 60, splitPremium: s.split_premium ?? null, mealAfterHours: s.meal_after_hours ?? null, mealMinutes: s.meal_minutes ?? 30, sleepCap: s.sleep_cap_minutes ?? 480 }); };
const summary = (o) => `${o.shifts} shift(s), ${o.caregivers} caregiver(s), ${o.weeks} caregiver-week(s), ${o.overtime_hours} overtime hour(s). ${o.dollars_at_risk} owed or at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'thrush', title: 'Thrush of Caregiver Hours',
  description: 'Checks home care caregiver hours and pay: weekly hours across all clients with travel between clients counted, overtime owed against what payroll paid, split shifts and missed meal breaks under the state settings you give, and live-in sleep time that must be paid. Caregiver names are masked before results reach the model.',
  args, required: ['shifts'],
  sources: { shifts: { label: 'Shifts', args: ['shifts'], fields: SHIFT_FIELDS }, payroll: { label: 'Payroll hours', args: ['payroll'], fields: PAYROLL_FIELDS } },
  configSchemas: { thrush_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check caregiver hours', description: 'List weeks paid short, missed meal breaks, live-in sleep to pay, split shifts, travel time and overtime weeks.' },
  report: {
    title: { en: 'Caregiver hours and pay check', es: 'Revisión de horas y pago de cuidadores', de: 'Prüfung Stunden und Lohn der Pflegekräfte', fr: 'Contrôle des heures et de la paie des aides', pt: 'Revisão de horas e pagamento de cuidadores', it: 'Verifica ore e paga dei badanti', ja: '介護者の勤務時間と給与チェック', zh: '护理员工时与薪酬检查', ko: '요양보호사 근무시간 및 급여 점검' },
    base: 'thrush-caregiver-hours',
    rows: (o) => o.items.map((i) => ({ status: i.status, caregiver_id: i.caregiver_id, caregiver_name: i.caregiver_name || '', date: i.date, hours: i.hours ?? '', overtime_hours: i.overtime_hours ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'caregiver_name', 'date', 'hours', 'overtime_hours', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Overtime follows the federal 40-hour week by default; daily overtime, meal and split-shift rules are state law and are only checked when you set them. Thrush does not know your state\'s rules.', 'Travel is inferred from same-day gaps between different clients; record actual travel where you have it.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'payroll_submit', category: 'payment', description: 'Thrush never runs or changes payroll.' },
    { name: 'schedule_change', category: 'binding_send', description: 'Thrush never changes schedules or contacts caregivers.' },
  ],
  prompt: { title: 'Weekly caregiver pay review', description: 'Walks the host model through a weekly caregiver hours review with Thrush.', text: `You are helping a home care agency's payroll lead with thrush-of-caregiver-hours before payroll closes.

Rules: Thrush only reads files. It never runs payroll or changes schedules. Caregiver names in results are pseudonyms. State rules come only from the settings.

1. Call thrush_check with shifts, payroll and settings.
2. Lead with hours_underpaid: wages owed for the week.
3. Then missed meal breaks, live-in sleep to pay and split shifts.
4. Then travel time and overtime weeks, for the scheduler.
5. Call thrush_write_report for the payroll lead.` },
});
