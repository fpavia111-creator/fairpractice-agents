import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, STAFF_ID, STAFF_NAME, NPI, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { screen, exclusionEntry } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const PEOPLE_FIELDS = Object.freeze({
  id: STAFF_ID,
  name: { ...STAFF_NAME, aliases: [...STAFF_NAME.aliases, 'Vendor', 'Vendor Name', 'Payee', 'Contractor', 'Legal Name'], required: true },
  type: t(['Type', 'Person Type', 'Category', 'Relationship', 'Worker Type', 'Payee Type']),
  dob: t(['DOB', 'Date of Birth', 'Birth Date', 'Birthdate'], { type: 'date', phi: 'dob' }),
  npi: NPI,
  last_screened: t(['Last Screened', 'Last Check', 'Screened On', 'Last Screening Date', 'Last Verified', 'Exclusion Check Date'], { type: 'date' }),
});
export const EXCLUSION_FIELDS = Object.freeze({
  last_name: t(['LASTNAME', 'Last Name', 'Last', 'Surname'], { phi: 'name' }),
  first_name: t(['FIRSTNAME', 'First Name', 'First', 'Given Name'], { phi: 'name' }),
  middle_name: t(['MIDNAME', 'Middle Name', 'Middle', 'MI'], { phi: 'name' }),
  name: t(['Full Name', 'Individual Name', 'Provider Name', 'Excluded Name'], { phi: 'name' }),
  business_name: t(['BUSNAME', 'Business Name', 'Entity Name', 'Firm', 'Name']),
  npi: t(['NPI', 'Provider NPI'], { translate: false }),
  dob: t(['DOB', 'Date of Birth', 'Birth Date'], { type: 'date', phi: 'dob' }),
  exclusion_type: t(['EXCLTYPE', 'Exclusion Type', 'Exclusion Authority', 'Sanction Type', 'Classification']),
  excluded_on: t(['EXCLDATE', 'Exclusion Date', 'Active Date', 'Effective Date', 'Sanction Date', 'Date Excluded'], { type: 'date' }),
  reinstated_on: t(['REINDATE', 'Reinstatement Date', 'Reinstated', 'Termination Date', 'End Date'], { type: 'date' }),
  state: t(['STATE', 'State']),
  source: t(['Source', 'List']),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  near_name_threshold: { type: 'number', minimum: 0.8, maximum: 1, description: 'Name similarity (0.8-1) at which a different spelling is shown as a near-name match; default 0.92' },
  screening_interval_days: { type: 'integer', minimum: 1, maximum: 366, description: 'Days after which a person counts as not screened recently; default 31 (monthly)' },
} };

export const MEMORY_KINDS = Object.freeze({
  cleared_match: {
    description: 'A reviewed name match that is not this person (checked by birth date, NPI or the official site). person_id is the id from the result (a pseudonym is fine); excluded_on is the list entry\'s exclusion date, e.g. {"person_id": "MRN-1a2b3c4d", "excluded_on": "2021-09-09", "note": "different DOB, verified on the OIG site 2026-11-02"}. Leave excluded_on out to clear every name match for that person.',
    effect: 'stops name and near-name matches to that entry from showing again for that person; an NPI match always shows.',
    schema: { type: 'object', additionalProperties: false, required: ['person_id'], properties: { person_id: { type: 'string', minLength: 1, maxLength: 80 }, excluded_on: { type: 'string', format: 'date' }, note: { type: 'string', maxLength: 300 } } },
  },
});

const args = {
  people: fileArg('Everyone you pay or bill under (CSV, Excel, JSON): employees, providers, contractors and vendors with name, type, birth date, NPI and last screening date'),
  exclusions: fileArg('Exclusion list you downloaded under --root, for example the OIG LEIE file (UPDATED.csv) or a SAM exclusions extract'),
  state_list: fileArg('Optional second list, for example your state Medicaid exclusion file'),
  settings: fileArg('Optional settings JSON: near_name_threshold and screening_interval_days'),
  as_of: AS_OF_ARG,
};

const run = (a, ctx) => {
  const s = a.settings ? ctx.readJson(a.settings, 'exclusions_settings') : {};
  const entries = [...ctx.records(a.exclusions, 'exclusions').map((r) => exclusionEntry(r, 'exclusion list')), ...(a.state_list ? ctx.records(a.state_list, 'state_list').map((r) => exclusionEntry(r, 'state list')) : [])];
  const facts = ctx.memoryFacts('cleared_match').map((f) => f.value);
  const cleared = (p, e) => facts.some((v) => ctx.phi.same(String(p.id ?? ''), v.person_id, 'mrn') && (!v.excluded_on || v.excluded_on === e.excluded_on));
  return screen(ctx.records(a.people, 'people'), entries, { asOf: a.as_of || today(), nearThreshold: s.near_name_threshold ?? 0.92, intervalDays: s.screening_interval_days ?? 31, cleared });
};
const summary = (o) => `${o.people} people screened against ${o.list_entries} list entries. ${o.needs_action} need action now. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'exclusions', title: 'Fairpractice Exclusion Screening',
  description: 'Screens everyone a practice pays (staff, providers, contractors, vendors) against the exclusion lists you download (OIG LEIE, SAM, state Medicaid): NPI matches, name and birth-date matches, near-name matches to clear, reinstated entries and people not screened recently. Names are masked before results reach the model.',
  args, required: ['people', 'exclusions'],
  sources: { people: { label: 'People you pay', args: ['people'], fields: PEOPLE_FIELDS }, exclusions: { label: 'Exclusion list', args: ['exclusions'], fields: EXCLUSION_FIELDS }, state_list: { label: 'Second exclusion list', args: ['state_list'], fields: EXCLUSION_FIELDS } },
  configSchemas: { exclusions_settings: SETTINGS }, memoryKinds: MEMORY_KINDS,
  run, summary,
  check: { title: 'Screen against exclusion lists', description: 'Match every person and vendor against the exclusion files and list matches to act on, near names to clear and people not screened recently.' },
  report: {
    title: { en: 'Exclusion screening', es: 'Verificación de exclusiones', de: 'Ausschlussprüfung', fr: 'Contrôle des exclusions', pt: 'Verificação de exclusões', it: 'Verifica delle esclusioni', ja: '除外リスト照合', zh: '排除名单筛查', ko: '제외 명단 대조' },
    base: 'exclusions',
    rows: (o) => o.items.map((i) => ({ status: i.status, person_id: i.person_id, name: i.name, type: i.type, list: i.list || '', listed_name: i.listed_name || '', excluded_on: i.excluded_on || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'name', 'type', 'list', 'listed_name', 'excluded_on', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'A name match is not proof: confirm with a second identifier on the official list site before acting. The lists are only as current as the files you downloaded.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'employment_terminate', category: 'production_deploy', description: 'Fairpractice Exclusion Screening never changes anyone\'s employment or vendor status; HR and compliance decide.' },
    { name: 'self_disclosure_submit', category: 'binding_send', description: 'Fairpractice Exclusion Screening never files an OIG self-disclosure or contacts a payer; counsel does.' },
  ],
  prompt: { title: 'Monthly exclusion screening', description: 'Walks the host model through a monthly exclusion check with Fairpractice Exclusion Screening.', text: `You are helping a compliance officer with fairpractice-exclusion-screening.

Rules: Fairpractice Exclusion Screening only reads files. A name match is never proof; names in results are pseudonyms.

1. Call exclusions_check with the people file, the exclusion list(s) and as_of.
2. Lead with npi_match and confirmed_match: these go to the compliance officer today.
3. For possible_match and near_name, say what second identifier would settle it.
4. When the user has verified that an entry is a different person, offer exclusions_learn (kind cleared_match).
5. Call exclusions_write_report for the screening file.` },
});
