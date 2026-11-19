#!/usr/bin/env node
// What reaches the AI model, per agent: masked fields, fields sent as they are, free text, and a leak
// check. Writes docs/model-view.md and docs/model-view.json.      npm run model-view
//
// Fields come from each agent's own source definitions (manifest.sources): a field is masked when it
// carries a masking kind (patient and staff names, record and account numbers, phones) or when its
// name is one the core masker knows (phiKindOf, default "mask" mode). Everything else is sent as read.
//
// Leak check: for every eval case that calls the agent's check or report tool, every value of a
// masked field in the files that case reads (4 characters or more) is looked for, case-insensitively,
// in the result the model gets with masking on. Any hit is a leak. Fictional fixtures only; no network.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const core = await import(pathToFileURL(join(PK, 'fairclaim-core', 'src', 'index.js')).href);
const { AgentRuntime, readTable, adaptRecords, phiKindOf } = core;

const LABEL = { name: 'pseudonym', mrn: 'pseudonym', account: 'pseudonym', member_id: 'pseudonym', phone: '[PHONE]', email: '[EMAIL]', address: '[ADDRESS]', ssn: '[SSN]', dob: 'birth year' };
const FREE = /^(?!.*_id$).*(note|reason|description|comment|purpose|privilege|document|drug|outcome|specialty|memo|text|review|reply|threat|plan)/i;
const PEOPLE = /^(owner|accepted_by|approved_by|signed_by)$/i;
const BUSINESS = /^(payer|pbm|agency|vendor|facility|to_org|auditor|plan_type|department|channel|arrangement|attorney|platform|business_name)$/i;
const kindOf = (f, d) => d.phi || phiKindOf(f) || null;

const rows = []; const json = []; let leaks = 0, checkedValues = 0, calls = 0;
for (const n of readdirSync(PK).filter((x) => /^fairpractice-(?!core$)/.test(x)).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const masked = [], clear = [], dates = [], amounts = [], free = [], business = [], people = [];
  const seen = new Set();
  for (const def of Object.values(manifest.sources || {})) for (const [f, d] of Object.entries(def.fields || {})) {
    if (seen.has(f)) continue; seen.add(f);
    const k = kindOf(f, d);
    if (k) masked.push({ field: f, kind: k, label: LABEL[k] || k });
    else if (d.type === 'date' || d.type === 'datetime') dates.push(f);
    else if (d.type === 'money' || d.type === 'number' || d.type === 'integer') amounts.push(f);
    else if (PEOPLE.test(f)) people.push(f);
    else if (FREE.test(f)) free.push(f);
    else if (BUSINESS.test(f)) business.push(f);
    else clear.push(f);
  }
  // Leak check on the fixtures.
  const prefix = (manifest.tools.find((t) => /_check$/.test(t.name)) || {}).name?.replace(/_check$/, '');
  const cases = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8')).cases.filter((c) => c.tool === `${prefix}_check` || c.tool === `${prefix}_write_report`);
  const agentLeaks = []; let values = 0;
  for (const c of cases) {
    const vals = new Set();
    for (const [key, def] of Object.entries(manifest.sources || {})) for (const a of def.args || [key]) {
      const rel = c.args[a]; if (typeof rel !== 'string' || !/\.(csv|tsv|txt|xlsx)$/i.test(rel) || !existsSync(join(PK, n, rel))) continue;
      let adapted; try { adapted = adaptRecords(readTable(join(PK, n, rel)), def); } catch { continue; }
      for (const r of adapted.rows) for (const [f, d] of Object.entries(def.fields || {})) if (kindOf(f, d)) { const v = String(r[f] ?? '').trim(); if (v.length >= 4) vals.add(v); }
    }
    if (!vals.size) continue;
    const parent = mkdtempSync(join(tmpdir(), `mv-${n}-`)); const root = join(parent, 'root'); cpSync(join(PK, n, 'fixtures'), join(root, 'fixtures'), { recursive: true });
    try {
      const rt = new AgentRuntime(manifest, { root, stateDir: join(root, '.remedy'), audit: false, phi: 'mask' });
      const r = await rt.call(c.tool, c.args); calls++;
      const out = JSON.stringify(r).toLowerCase();
      for (const v of vals) { values++; if (out.includes(v.toLowerCase())) agentLeaks.push(`${c.id}: "${v}"`); }
    } finally { rmSync(parent, { recursive: true, force: true }); }
  }
  leaks += agentLeaks.length; checkedValues += values;
  const short = n.replace(/^fairpractice-/, '');
  const code = (l) => l.map((x) => `\`${x}\``).join(', ');
  rows.push(`| ${short} | ${masked.map((m) => `\`${m.field}\` (${m.label})`).join(', ') || 'none read'} | ${code(clear) || '-'} | ${code(business) || '-'} | ${dates.length} dates, ${amounts.length} amounts or counts | ${code(free) || 'none'}${people.length ? `; names as written: ${code(people)}` : ''} | ${values} checked, ${agentLeaks.length} leaked |`);
  json.push({ agent: n, masked, clear, business, dates, amounts, free_text: free, names_as_written: people, leak_check: { values, leaks: agentLeaks } });
}
const withMasked = json.filter((a) => a.masked.length).length; const withFree = json.filter((a) => a.free_text.length).length;
const md = [
  '# What reaches the AI model (Fairpractice, wave 1)', '',
  `Written by \`npm run model-view\` on ${new Date().toISOString().slice(0, 10)} from each agent's own column definitions and the core masker (\`fairclaim-core/src/phi.js\`) in its default mode (\`--phi mask\`). Every tool result, error and approval request passes through the masker before it leaves the agent. The checks themselves read the real values on your computer; only what is returned is masked.`, '',
  '- **Masked:** patient names, patient numbers and MRNs, account and encounter numbers, member and policy numbers (stable pseudonyms such as `PT-3f2a9c1d`, `MRN-…`, `ACCT-…`, `MBR-…`); staff and provider names in the columns the agents read as people (rendering providers, therapists, physicians under contract, caregivers, employees in the training, health and licence files, people screened for exclusions, reviewers); birth dates cut to the year; phones, e-mails, addresses and SSNs (placeholders). A masked value is also replaced wherever it appears inside other text in the same result.',
  '- **Sent as they are:** NPIs, claim, request, invoice, referral, message and audit numbers (claim numbers are pseudonymised with `--phi strict`), CPT, HCPCS, NDC, revenue and diagnosis codes, dates (cut to the month with `--phi strict`), amounts and counts, and business names (payers, vendors, law firms, review platforms). Risk owners and the person who accepted a risk in the security risk analysis are sent as written (usually a role such as "IT Lead", but a name if you type one); licence numbers and staff health results ("positive", "declined") go with a pseudonymised name.',
  '- **Free text** (online review texts and draft replies, threats and plans in the risk register, denial, discharge and recoupment reasons, descriptions) is sent as written, with known names and SSN, e-mail and phone patterns replaced. Anything else a person typed there reaches the model: a review in which the writer names a condition, for example, which is what the review-reply agent looks for in draft replies.',
  '- Results go to whatever model the user\'s AI assistant uses. For patient data, use a model your organisation has a business associate agreement with, or a local model, and consider `--phi strict`. A business associate agreement is required before any real patient file is held. No claim of HIPAA or any other compliance is made; masking is not de-identification under the HIPAA Safe Harbor or Expert Determination methods.',
  '- The worklists and reports written on the user\'s computer keep the real values, for the people working them.', '',
  `Agents with masked columns: ${withMasked} of ${json.length}. Agents with a free-text column: ${withFree}. Leak check: ${checkedValues} masked values looked for across ${calls} masked tool calls on the fixtures; **${leaks} found in a result**.`, '',
  'Also: every agent\'s shared test runs every eval case and fails if a value in its `fixtures/phi-canaries.json` reaches a result.', '',
  '| Agent | Masked | Ids and codes sent | Business names sent | Dates, amounts | Free text sent | Leak check |', '| --- | --- | --- | --- | --- | --- | --- |',
  ...rows, '',
];
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'model-view.md'), md.join('\n'));
writeFileSync(join(ROOT, 'docs', 'model-view.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), values_checked: checkedValues, calls, leaks, agents: json }, null, 2) + '\n');
for (const a of json) if (a.leak_check.leaks.length) console.log(`LEAK ${a.agent}: ${a.leak_check.leaks.join('; ')}`);
console.log(`docs/model-view.md: ${json.length} agents; masked columns in ${withMasked}, free text in ${withFree}; ${checkedValues} masked values checked in ${calls} calls, ${leaks} leaked`);
process.exitCode = leaks ? 1 : 0;
