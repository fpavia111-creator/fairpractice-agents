import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkIncidents } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const D = (aliases) => t(aliases, { type: 'date' });

export const INCIDENT_FIELDS = Object.freeze({
  incident_id: t(['Incident', 'Incident ID', 'Incident #', 'Case', 'Case #', 'Ticket'], { translate: false }),
  discovered: { ...D(['Discovered', 'Date Discovered', 'Discovery Date', 'Reported', 'Date Reported']), required: true },
  affected: t(['Affected', 'People Affected', 'Individuals Affected', '# Affected', 'Records', 'Count'], { type: 'number' }),
  assessed_on: D(['Assessed', 'Risk Assessment Date', 'Assessment Date', 'Assessed On']),
  determination: t(['Determination', 'Breach?', 'Breach', 'Decision', 'Outcome', 'Status']),
  individuals_notified_on: D(['Individuals Notified', 'Patients Notified', 'Notice Sent', 'Letters Sent', 'Individual Notice']),
  media_notified_on: D(['Media Notified', 'Media Notice', 'Press Notice']),
  hhs_notified_on: D(['HHS Notified', 'OCR Notified', 'HHS Report', 'Reported to HHS']),
  states: t(['States', 'State', 'Affected States', 'Residents Of']),
  ag_notified_on: D(['AG Notified', 'Attorney General Notified', 'State Notice']),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  notice_days: { type: 'integer', minimum: 1, maximum: 60, description: 'Days from discovery to notify individuals (HIPAA outer limit: 60; notify sooner when you can)' },
  assess_days: { type: 'integer', minimum: 1, maximum: 60, description: 'Your target days from discovery to a finished risk assessment; default 10' },
  large_threshold: { type: 'integer', minimum: 1, description: 'People affected at which HHS and media notices are due within the notice window (HIPAA: 500)' },
  warn_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Days ahead to warn; default 14' },
  state_rules: { type: 'array', maxItems: 60, description: 'State attorney general notice rules you follow (example values; confirm with counsel)', items: { type: 'object', additionalProperties: false, required: ['state', 'ag_threshold', 'ag_days'], properties: { state: { type: 'string' }, ag_threshold: { type: 'integer', minimum: 1 }, ag_days: { type: 'integer', minimum: 1, maximum: 365 } } } },
} };

const args = {
  incidents: fileArg('Privacy incident log under --root: incident, discovery date, people affected, assessment date, determination, notice dates (individuals, media, HHS, state) and states'),
  settings: fileArg('Optional settings JSON: notice_days, assess_days, large_threshold, warn_days, state_rules'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => {
  const s = a.settings ? ctx.readJson(a.settings, 'breach_settings') : {};
  return checkIncidents(ctx.records(a.incidents, 'incidents'), { asOf: a.as_of || today(), noticeDays: s.notice_days ?? 60, assessDays: s.assess_days ?? 10, largeThreshold: s.large_threshold ?? 500, warnDays: s.warn_days ?? 14, stateRules: s.state_rules || [] });
};
const summary = (o) => `${o.incidents} incident(s), ${o.breaches} breach(es) affecting ${o.people_affected} people. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'breach', title: 'Fairpractice Breach Deadlines',
  description: 'Watches the privacy incident log against the breach-notification clocks: risk assessments not done, incidents still undecided at 60 days, individual notices past due, late or due soon, HHS and media notices for breaches of 500 or more, the year-end HHS log for smaller ones, and state attorney general notices under rules you set. It does not decide whether something is a breach.',
  args, required: ['incidents'],
  sources: { incidents: { label: 'Incident log', args: ['incidents'], fields: INCIDENT_FIELDS } },
  configSchemas: { breach_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check breach clocks', description: 'List incidents with notices past due or due soon, missing HHS, media or state notices, and assessments not done.' },
  report: {
    title: { en: 'Privacy incidents and breach notices', es: 'Incidentes de privacidad y avisos de brecha', de: 'Datenschutzvorfälle und Meldefristen', fr: 'Incidents de confidentialité et notifications', pt: 'Incidentes de privacidade e notificações', it: 'Incidenti privacy e notifiche', ja: 'プライバシー事故と通知期限', zh: '隐私事件与泄露通知', ko: '개인정보 사고와 통지 기한' },
    base: 'breaches',
    rows: (o) => o.items.map((i) => ({ status: i.status, incident_id: i.incident_id, discovered: i.discovered, affected: i.affected, determination: i.determination, due: i.due, days: i.days ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'incident_id', 'discovered', 'affected', 'due', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Whether an incident is a breach, and which state laws apply, is a decision for your privacy officer and counsel. The 60 days is an outer limit, not a target.', KESTREL_LIMITS.advice],
  },
  refused: [
    { name: 'breach_notice_send', category: 'binding_send', description: 'Fairpractice Breach Deadlines never sends notices to patients, the media, HHS or a state.' },
    { name: 'hhs_portal_submit', category: 'binding_send', description: 'Fairpractice Breach Deadlines never files on the HHS breach portal.' },
  ],
  prompt: { title: 'Breach clock review', description: 'Walks the host model through a weekly incident review with Fairpractice Breach Deadlines.', text: `You are helping a privacy officer with fairpractice-breach-deadlines.

Rules: Fairpractice Breach Deadlines only reads the incident log. It never decides whether something is a breach and never sends a notice.

1. Call breach_check with the incident log, settings and as_of.
2. Lead with notice_past_due, hhs_notice_missing, media_notice_missing and undetermined_past_deadline.
3. Say plainly that the decision and wording belong to the privacy officer and counsel.
4. Call breach_write_report for the incident file.` },
});
