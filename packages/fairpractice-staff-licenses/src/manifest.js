import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, STAFF_ID, STAFF_NAME, ROLE, DEPARTMENT, STATUS, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkCredentials } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const WORK_STATE = t(['Work State', 'Practice State', 'Shift State', 'Location State', 'State Worked']);

export const CRED_FIELDS = Object.freeze({
  person_id: STAFF_ID, name: STAFF_NAME, role: ROLE, department: DEPARTMENT,
  credential: t(['Credential', 'License', 'License Type', 'Certification', 'Cert', 'Credential Type', 'Document'], { required: true }),
  number: t(['License #', 'License Number', 'Number', 'Cert #', 'Credential Number'], { translate: false }),
  state: t(['State', 'Issuing State', 'License State', 'Issued By']),
  expires: t(['Expires', 'Expiration', 'Expiration Date', 'Exp Date', 'Expiry', 'Valid Through'], { type: 'date' }),
  verified_on: t(['Verified', 'Verified On', 'Verification Date', 'Primary Source Verified', 'PSV Date', 'Last Verified'], { type: 'date' }),
  compact: t(['Compact', 'Multistate', 'Multi-State', 'License Scope', 'NLC']),
});
export const ROSTER_FIELDS = Object.freeze({ person_id: { ...STAFF_ID, required: true }, name: STAFF_NAME, role: ROLE, department: DEPARTMENT, work_state: WORK_STATE, status: STATUS });
export const SHIFT_FIELDS = Object.freeze({ person_id: { ...STAFF_ID, required: true }, date: t(['Date', 'Shift Date', 'Work Date', 'Punch Date'], { type: 'date', required: true }), work_state: WORK_STATE });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  required_by_role: { type: 'object', additionalProperties: { type: 'array', maxItems: 30, items: { type: 'string' } }, description: 'Credentials each role must hold, e.g. {"RN": ["RN License", "BLS"]}' },
  warn_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Days before expiry to start warning; default 60' },
  verify_days: { type: 'integer', minimum: 1, maximum: 1095, description: 'Days after which a primary-source verification counts as stale; default 365' },
  compact_states: { type: 'array', maxItems: 60, items: { type: 'string' }, description: 'Two-letter states in the license compact you rely on (check the current member list)' },
  state_licensed: { type: 'array', maxItems: 50, items: { type: 'string' }, description: 'Credential names that are state licenses, so the work state is checked' },
} };

const args = {
  credentials: fileArg('Credentials file under --root: one row per license or certificate with person, role, credential, state, expiry, verification date and multistate flag'),
  roster: fileArg('Optional active staff roster: person id, name, role, department and work state (finds required credentials that are missing)'),
  shifts: fileArg('Optional worked shifts: person id, date and work state (finds shifts worked on an expired credential)'),
  settings: fileArg('Optional settings JSON: required_by_role, warn_days, verify_days, compact_states, state_licensed'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => {
  const s = a.settings ? ctx.readJson(a.settings, 'licenses_settings') : {};
  return checkCredentials(ctx.records(a.credentials, 'credentials'), a.roster ? ctx.records(a.roster, 'roster') : [], a.shifts ? ctx.records(a.shifts, 'shifts') : [], { asOf: a.as_of || today(), warnDays: s.warn_days ?? 60, verifyDays: s.verify_days ?? 365, requiredByRole: s.required_by_role || {}, compactStates: s.compact_states || [], stateLicensed: s.state_licensed || [] });
};
const summary = (o) => `${o.people} staff, ${o.credentials} credential rows${o.shifts_checked ? `, ${o.shifts_checked} shifts` : ''}. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'licenses', title: 'Fairpractice Staff Licenses',
  description: 'Checks staff licenses and certifications (nursing and allied licenses, BLS, ACLS and others): expired or expiring, required for the role but missing, never or not recently verified at the source, licenses that do not cover the state worked, and shifts worked on an expired credential. Staff names are masked before results reach the model.',
  args, required: ['credentials'],
  sources: { credentials: { label: 'Credentials', args: ['credentials'], fields: CRED_FIELDS }, roster: { label: 'Staff roster', args: ['roster'], fields: ROSTER_FIELDS }, shifts: { label: 'Worked shifts', args: ['shifts'], fields: SHIFT_FIELDS } },
  configSchemas: { licenses_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check staff credentials', description: 'List expired, missing, unverified and wrong-state credentials, and shifts worked on an expired one.' },
  report: {
    title: { en: 'Staff license and certification check', es: 'Revisión de licencias y certificaciones', de: 'Prüfung von Lizenzen und Zertifikaten', fr: 'Contrôle des licences et certifications', pt: 'Verificação de licenças e certificações', it: 'Controllo di licenze e certificazioni', ja: '職員の免許・資格チェック', zh: '员工执照与证书检查', ko: '직원 면허 및 자격 점검' },
    base: 'licenses',
    rows: (o) => o.items.map((i) => ({ status: i.status, person_id: i.person_id, name: i.name, role: i.role || '', department: i.department || '', credential: i.credential, state: i.state || '', expires: i.expires || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'name', 'role', 'department', 'credential', 'expires', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'It does not look anything up with a licensing board or Nursys; verification dates are the ones in your file. Compact membership changes: keep compact_states current.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'schedule_remove', category: 'production_deploy', description: 'Fairpractice Staff Licenses never changes the schedule or anyone\'s status; a manager does.' },
    { name: 'board_report_submit', category: 'binding_send', description: 'Fairpractice Staff Licenses never reports anyone to a licensing board.' },
  ],
  prompt: { title: 'Monthly credential check', description: 'Walks the host model through a monthly staff credential review with Fairpractice Staff Licenses.', text: `You are helping a staffing coordinator with fairpractice-staff-licenses.

Rules: Fairpractice Staff Licenses only reads files. Staff names in results are pseudonyms.

1. Call licenses_check with the credentials, roster, shifts, settings and as_of.
2. Lead with worked_expired (billing and safety risk), then expired and missing_required.
3. For wrong_state, explain single-state vs multistate licenses.
4. Call licenses_write_report for the department managers.` },
});
