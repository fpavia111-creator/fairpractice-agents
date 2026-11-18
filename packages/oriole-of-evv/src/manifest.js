import { readFileSync } from 'node:fs';
import { medAgent, fileArg, STAFF_ID, STAFF_NAME, UNITS, MINUTES, DOS, AMOUNT, KESTREL_LIMITS } from 'kestrel-core';
import { checkEvv } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const CLIENT_ID = t(['Client ID', 'Client #', 'Member ID', 'Medicaid ID', 'Recipient ID', 'Participant ID', 'Patient ID'], { phi: 'mrn', translate: false });
const CLIENT_NAME = t(['Client', 'Client Name', 'Member', 'Member Name', 'Recipient', 'Participant', 'Patient Name'], { phi: 'name' });
const SERVICE = t(['Service', 'Service Code', 'Procedure', 'HCPCS', 'Code', 'Billing Code'], { translate: false });
const CG_ID = { ...STAFF_ID, aliases: ['Caregiver ID', 'Worker ID', 'Aide ID', 'Employee ID', 'Staff ID', 'Attendant ID'] };
const CG_NAME = { ...STAFF_NAME, aliases: ['Caregiver', 'Caregiver Name', 'Worker', 'Aide', 'Employee', 'Attendant', 'Staff Name'] };

export const VISIT_FIELDS = Object.freeze({
  client_id: CLIENT_ID, client_name: CLIENT_NAME, caregiver_id: CG_ID, caregiver_name: CG_NAME, date: { ...DOS, required: true },
  clock_in: t(['Clock In', 'Check In', 'Time In', 'Start', 'Visit Start']), clock_out: t(['Clock Out', 'Check Out', 'Time Out', 'End', 'Visit End']),
  minutes: MINUTES, service: SERVICE,
  location_ok: t(['Location Verified', 'GPS Match', 'Location OK', 'Location Match', 'Geo Verified']),
  distance: t(['Distance', 'Distance from Address', 'GPS Distance', 'Miles from Home'], { type: 'number' }),
  manual: t(['Manual', 'Manual Edit', 'Edited', 'Exception', 'Visit Edited', 'Adjusted']),
});
export const CLAIM_FIELDS = Object.freeze({ client_id: CLIENT_ID, client_name: CLIENT_NAME, date: { ...DOS, required: true }, service: SERVICE, units: UNITS, caregiver_id: CG_ID, caregiver_name: CG_NAME, amount: AMOUNT });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  unit_minutes: { type: 'integer', minimum: 1, maximum: 60, description: 'Minutes in one billing unit; default 15' },
  rounding: { type: 'string', enum: ['down', 'midpoint', 'up'], description: 'How partial units count under your state rules; default midpoint (8 of 15 minutes)' },
  max_distance: { type: 'number', minimum: 0, description: 'Distance from the client\'s address above which a visit is flagged, in the unit your EVV export uses' },
  max_manual_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Share of a caregiver\'s visits entered or edited by hand above which to flag; default 10' },
  min_visits: { type: 'integer', minimum: 1, maximum: 100, description: 'Visits a caregiver needs before the manual-edit share is judged; default 3' },
} };
const args = {
  visits: fileArg('EVV visit export under --root: client, caregiver, date, clock in and out (or minutes), service, location verified or distance, manual edit'),
  claims: fileArg('Claim lines: client, date of service, service code, units, caregiver, amount'),
  settings: fileArg('Optional settings JSON: unit_minutes, rounding, max_distance, max_manual_pct, min_visits'),
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'oriole_settings') : {}; return checkEvv(ctx.records(a.visits, 'visits'), ctx.records(a.claims, 'claims'), { unitMinutes: s.unit_minutes ?? 15, rounding: s.rounding || 'midpoint', maxDistance: s.max_distance ?? null, maxManualPct: s.max_manual_pct ?? 10, minVisits: s.min_visits ?? 3 }); };
const summary = (o) => `${o.visits} EVV visit(s), ${o.claim_lines} claim line(s), ${o.clients} client(s); ${o.unbilled_visits} verified visit(s) not billed. ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'oriole', title: 'Oriole of EVV',
  description: 'Checks Medicaid home care claims against electronic visit verification: claim lines with no EVV visit, units above the verified time, visits billed under a different caregiver, visits verified away from the client\'s address, and caregivers whose share of hand-entered or edited visits is above your limit. Client and caregiver names are masked before results reach the model.',
  args, required: ['visits', 'claims'],
  sources: { visits: { label: 'EVV visits', args: ['visits'], fields: VISIT_FIELDS }, claims: { label: 'Claims', args: ['claims'], fields: CLAIM_FIELDS } },
  configSchemas: { oriole_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check claims against EVV', description: 'List claim lines with no visit, units over verified time, caregiver and location mismatches, and caregivers with many manual edits.' },
  report: {
    title: { en: 'EVV and claims check', es: 'Revisión de EVV y reclamaciones', de: 'EVV- und Abrechnungsprüfung', fr: 'Contrôle EVV et facturation', pt: 'Revisão de EVV e cobranças', it: 'Verifica EVV e fatturazione', ja: 'EVV と請求のチェック', zh: 'EVV 与理赔核对', ko: 'EVV 및 청구 점검' },
    base: 'oriole-evv',
    rows: (o) => o.items.map((i) => ({ status: i.status, client_id: i.client_id || '', client_name: i.client_name || '', caregiver: i.caregiver || i.billed_caregiver || '', date: i.date || '', service: i.service || '', units: i.units ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'client_name', 'caregiver', 'date', 'service', 'units', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Each state runs EVV its own way (aggregator, rounding, exception codes); set unit_minutes and rounding to your state\'s rules.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Oriole never submits or changes claims.' },
    { name: 'evv_visit_edit', category: 'binding_send', description: 'Oriole never edits or creates EVV visits.' },
  ],
  prompt: { title: 'EVV pre-billing review', description: 'Walks the host model through an EVV check before Medicaid billing with Oriole.', text: `You are helping a home care agency's billing lead with oriole-of-evv before claims go out.

Rules: Oriole only reads files. It never edits EVV visits or submits claims. Client and caregiver names in results are pseudonyms.

1. Call oriole_check with visits, claims and settings.
2. Lead with no_evv and units_over_verified: these deny or get recouped.
3. Then caregiver and location mismatches to fix before billing.
4. Then caregivers with many manual edits, for the scheduler or supervisor.
5. Call oriole_write_report for the billing lead.` },
});
