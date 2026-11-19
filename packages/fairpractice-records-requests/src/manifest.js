import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, PATIENT_ID, PATIENT_NAME, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkAccess } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const REQUEST_FIELDS = Object.freeze({
  request_id: t(['Request ID', 'Request #', 'Request', 'ROI #', 'Log #', 'Ticket'], { translate: false }),
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME,
  received: t(['Received', 'Date Received', 'Received On', 'Request Date', 'Requested'], { type: 'date', required: true }),
  requester_type: t(['Requester Type', 'Requested By', 'Requester', 'Request Type']),
  format: t(['Format', 'Delivery', 'Media', 'Copy Format', 'Delivery Method']),
  pages: t(['Pages', 'Page Count', '# Pages'], { type: 'number' }),
  extended: t(['Extended', 'Extension', 'Extension Taken']),
  extension_notice_on: t(['Extension Notice', 'Extension Notice Date', 'Extension Letter Sent'], { type: 'date' }),
  fulfilled: t(['Fulfilled', 'Completed', 'Sent', 'Date Sent', 'Closed', 'Released', 'Date Completed'], { type: 'date' }),
  denied: t(['Denied', 'Denial']),
  denied_on: t(['Denied On', 'Denial Date'], { type: 'date' }),
  denial_reason: t(['Denial Reason', 'Reason Denied', 'Reason']),
  fee: t(['Fee', 'Fee Charged', 'Charge', 'Amount Charged'], { type: 'money' }),
  postage: t(['Postage', 'Shipping'], { type: 'money' }),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  response_days: { type: 'integer', minimum: 1, maximum: 60, description: 'Calendar days to answer (HIPAA: 30; some states are shorter)' },
  extension_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Days one extension adds (HIPAA: 30)' },
  warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Days ahead to warn; default 7' },
  flat_fee: { type: ['number', 'null'], minimum: 0, description: 'Flat fee you charge for electronic copies (HHS describes $6.50 as an option), or null' },
  per_page: { type: ['number', 'null'], minimum: 0, description: 'Per-page fee for paper copies under your policy or state law, or null' },
  base_fee: { type: 'number', minimum: 0, description: 'Fixed fee added to per-page fees (labor or search fee your state allows), default 0' },
  fee_cap: { type: ['number', 'null'], minimum: 0, description: 'Most you charge for one request, or null' },
} };

const args = {
  requests: fileArg('Access request log under --root: request, patient, received date, requester type, format, pages, extension, notice date, fulfilled or denied date, reason and fee'),
  settings: fileArg('Optional settings JSON: response_days, extension_days, warn_days, flat_fee, per_page, base_fee, fee_cap'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => {
  const s = a.settings ? ctx.readJson(a.settings, 'access_settings') : {};
  return checkAccess(ctx.records(a.requests, 'requests'), { asOf: a.as_of || today(), responseDays: s.response_days ?? 30, extensionDays: s.extension_days ?? 30, warnDays: s.warn_days ?? 7, fees: { flatFee: s.flat_fee ?? null, perPage: s.per_page ?? null, base: s.base_fee ?? 0, cap: s.fee_cap ?? null } });
};
const summary = (o) => `${o.requests} request(s): ${o.open} open, ${o.closed} answered, ${o.average_days_to_answer ?? 'n/a'} days on average. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. Overcharged ${o.overcharged}.`;

export const manifest = medAgent({
  pkg, prefix: 'access', title: 'Fairpractice Records Requests',
  description: 'Tracks patient right-of-access requests against the HIPAA clock (30 days plus one 30-day extension with written notice, or your shorter state limit): requests past due or due soon, answered late, extensions with no timely notice, denials with no reason and fees above your fee settings. Patient names are masked before results reach the model.',
  args, required: ['requests'],
  sources: { requests: { label: 'Access request log', args: ['requests'], fields: REQUEST_FIELDS } },
  configSchemas: { access_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check access requests', description: 'List access requests that are late, due soon, extended without notice, denied without a reason or overcharged.' },
  report: {
    title: { en: 'Patient access requests', es: 'Solicitudes de acceso de pacientes', de: 'Auskunftsersuchen von Patienten', fr: 'Demandes d\'accès des patients', pt: 'Pedidos de acesso de pacientes', it: 'Richieste di accesso dei pazienti', ja: '患者の記録開示請求', zh: '患者查阅请求', ko: '환자 열람 요청' },
    base: 'access-requests',
    rows: (o) => o.items.map((i) => ({ status: i.status, request_id: i.request_id, patient_id: i.patient_id, patient_name: i.patient_name, received: i.received, due: i.due, fulfilled: i.fulfilled || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'request_id', 'patient_name', 'received', 'due', 'fulfilled', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Deadlines count calendar days from the received date. Requests from third parties under a patient authorization follow other rules; mark them in requester_type.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'records_release', category: 'binding_send', description: 'Fairpractice Records Requests never sends records to anyone; your release-of-information staff do.' },
    { name: 'refund_issue', category: 'payment', description: 'Fairpractice Records Requests never issues refunds.' },
  ],
  prompt: { title: 'Right-of-access review', description: 'Walks the host model through a weekly access request review with Fairpractice Records Requests.', text: `You are helping a privacy officer or release-of-information lead with fairpractice-records-requests.

Rules: Fairpractice Records Requests only reads the log. Patient names in results are pseudonyms.

1. Call access_check with the request log, settings and as_of.
2. Lead with past_due, then due_soon, so nothing new goes late.
3. Explain extension_no_notice and fee_over_limit in one line each.
4. Call access_write_report for the weekly privacy meeting.` },
});
