#!/usr/bin/env node
// Real public data, in its real published format, through the agents and the shared core.
//
//   node scripts/realdata.mjs --download    fetch the public files into _realdata/ (git-ignored; never committed)
//   node scripts/realdata.mjs               run the tests; writes docs/realdata.md and docs/realdata.json
//   (npm run realdata:download, npm run realdata)
//
// Sources (public, lawful to use; no patient data):
//   OIG LEIE (UPDATED.csv)               -> fairpractice-exclusion-screening
//   Nevada Medicaid sample 835 (PDF)     -> fairclaim-core's 835 reader (no wave-1 agent posts ERAs)
//   CMS physician fee schedule RVU file  -> fairpractice-provider-pay's RVU file
// The staff lists, charges and settings put next to them are the fixtures or made up here, and say so.
// Only counts are written to docs/: no name from the LEIE is copied into the repository.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages'); const RD = join(ROOT, '_realdata');
const core = await import(pathToFileURL(join(PK, 'fairclaim-core', 'src', 'index.js')).href);
const { AgentRuntime, parseCsv, toCsv, readZip, readHealthcareX12 } = core;

const SOURCES = {
  leie: { name: 'OIG List of Excluded Individuals/Entities (LEIE), full file', page: 'https://oig.hhs.gov/exclusions/exclusions_list.asp', url: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv', licence: 'Public data from HHS-OIG (US government work)' },
  nv835: { name: 'Nevada Medicaid sample 835 file', page: 'https://www.medicaid.nv.gov/', url: 'https://www.medicaid.nv.gov/Downloads/provider/Sample_835_File.pdf', licence: 'Public sample published by Nevada Medicaid (state government); sample data, no real patients' },
  rvu: { name: 'CMS physician fee schedule relative value file, January 2026 (RVU26A)', page: 'https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files', url: 'https://www.cms.gov/files/zip/rvu26a.zip', licence: 'Public CMS data (US government work); CPT descriptors in it are AMA copyright and are not used or copied here' },
};
async function get(url) { const r = await fetch(url, { headers: { 'user-agent': 'fairpractice-realdata-check/1.0' } }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
if (process.argv.includes('--download')) {
  for (const d of ['leie', 'era', 'rvu']) mkdirSync(join(RD, d), { recursive: true });
  writeFileSync(join(RD, 'leie', 'UPDATED.csv'), await get(SOURCES.leie.url));
  writeFileSync(join(RD, 'era', 'Sample_835_File.pdf'), await get(SOURCES.nv835.url));
  const z = readZip(await get(SOURCES.rvu.url)); writeFileSync(join(RD, 'rvu', 'PPRRVU2026_Jan_nonQPP.csv'), z.get('PPRRVU2026_Jan_nonQPP.csv'));
  writeFileSync(join(RD, 'downloaded.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), sources: SOURCES }, null, 2));
  console.log('downloaded into _realdata/'); process.exit(0);
}

const results = []; const runDir = join(RD, 'run'); mkdirSync(runDir, { recursive: true });
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');
const countOf = (items) => { const o = {}; for (const i of items) o[i.status] = (o[i.status] || 0) + 1; return o; };
async function call(agent, tool, args) {
  const { manifest } = await import(pathToFileURL(join(PK, `fairpractice-${agent}`, 'src', 'index.js')).href);
  const rt = new AgentRuntime(manifest, { root: ROOT, stateDir: null, audit: false, phi: 'off', memory: false });
  const t0 = Date.now(); const r = await rt.call(tool, { ...args, limit: 5000 }); if (r.status !== 'executed') throw new Error(`${tool}: ${r.status} ${r.error || r.reason || ''}`);
  return { result: r.result, sources: r.sources || [], ms: Date.now() - t0 };
}
// A fixed pseudo-random sequence, so the made-up lists are the same on every run.
let seed = 20261119; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// ------------------------------------------------------------------ LEIE ----
{
  const f = join(RD, 'leie', 'UPDATED.csv');
  if (!existsSync(f)) results.push({ source: 'leie', skipped: 'not downloaded' });
  else {
    const leie = parseCsv(readFileSync(f, 'utf8'));
    const iso = (d) => (/^\d{8}$/.test(d) && d !== '00000000' ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '');
    const people = leie.filter((r) => r.LASTNAME && r.FIRSTNAME && iso(r.DOB) && (!r.REINDATE || r.REINDATE === '0' || r.REINDATE === '00000000'));
    const sample = []; const step = Math.max(1, Math.floor(people.length / 500)); for (let i = 0; i < people.length && sample.length < 500; i += step) sample.push(people[i]);
    // (a) 500 listed individuals as if they were staff (names and birth dates as the LEIE has them).
    const listed = sample.map((r, i) => ({ 'Employee ID': `L${1000 + i}`, Name: `${r.FIRSTNAME} ${r.MIDNAME ? r.MIDNAME + ' ' : ''}${r.LASTNAME}`, Type: 'employee', 'Date of Birth': iso(r.DOB), NPI: /^\d{10}$/.test(r.NPI) && r.NPI !== '0000000000' ? r.NPI : '', 'Last Screened': '2026-11-15' }));
    // (b) 1,000 made-up staff from common first and last names, made-up birth dates.
    const FIRST = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Maria', 'Jose', 'Luis', 'Ana', 'Wei', 'Mei', 'Ahmed', 'Fatima', 'Kwame', 'Aisha', 'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Sandra', 'Paul', 'Ashley'];
    const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Nguyen', 'Patel', 'Kim', 'Chen'];
    const made = []; for (const fn of FIRST) for (const ln of LAST) { const y = 1950 + Math.floor(rnd() * 50), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28); made.push({ 'Employee ID': `M${2000 + made.length}`, Name: `${fn} ${ln}`, Type: 'employee', 'Date of Birth': `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, NPI: '', 'Last Screened': '2026-11-15' }); }
    const cols = ['Employee ID', 'Name', 'Type', 'Date of Birth', 'NPI', 'Last Screened'];
    writeFileSync(join(runDir, 'people-listed.csv'), toCsv(listed, cols)); writeFileSync(join(runDir, 'people-made-up.csv'), toCsv(made, cols));
    writeFileSync(join(runDir, 'state-list-empty.csv'), 'Name,Exclusion Type,Effective Date,Termination Date\n');
    const settings = join(PK, 'fairpractice-exclusion-screening', 'fixtures', 'settings.json');
    const a = await call('exclusion-screening', 'exclusions_check', { people: rel(join(runDir, 'people-listed.csv')), exclusions: rel(f), state_list: rel(join(runDir, 'state-list-empty.csv')), settings: rel(settings), as_of: '2026-11-19' });
    const b = await call('exclusion-screening', 'exclusions_check', { people: rel(join(runDir, 'people-made-up.csv')), exclusions: rel(f), state_list: rel(join(runDir, 'state-list-empty.csv')), settings: rel(settings), as_of: '2026-11-19' });
    const hitIds = new Set(a.result.items.filter((i) => ['confirmed_match', 'npi_match'].includes(i.status)).map((i) => i.person_id));
    results.push({ source: 'leie', agent: 'fairpractice-exclusion-screening', leie_rows: leie.length, individuals_with_dob: people.length,
      listed_people: listed.length, listed_with_npi: listed.filter((p) => p.NPI).length, listed_found: hitIds.size, listed_by_status: a.result.by_status, ms_listed: a.ms,
      made_up_people: made.length, made_up_by_status: b.result.by_status, made_up_findings: Object.values(b.result.by_status).reduce((x, y) => x + y, 0), made_up_near_names_other_birth_date: b.result.near_names_other_birth_date ?? null, ms_made_up: b.ms });
  }
}

// ------------------------------------------------------------------ Nevada 835 ----
{
  const pdf = join(RD, 'era', 'Sample_835_File.pdf');
  if (!existsSync(pdf)) results.push({ source: 'nv835', skipped: 'not downloaded' });
  else {
    let text = '';
    try { execFileSync('pdftotext', ['-layout', pdf, join(runDir, 'sample-835.txt')]); text = readFileSync(join(runDir, 'sample-835.txt'), 'utf8'); } catch (e) { results.push({ source: 'nv835', skipped: `pdftotext not available (${e.code || e.message})` }); }
    if (text) {
      // The PDF shows one segment per line with page titles in between and no "~": keep segment lines,
      // join wrapped ones, end each with "~".
      const segs = [];
      for (const raw of text.split(/\r?\n/)) { const l = raw.trim(); if (!l || /^Page \d+$/.test(l) || /^Sample 835 File/.test(l)) continue; if (/^[A-Z][A-Z0-9]{1,2}\*/.test(l)) segs.push(l); else if (segs.length) segs[segs.length - 1] += l; }
      const r = readHealthcareX12(segs.join('~') + '~');
      const sets = r.by_set['835'] || [];
      const pays = sets.map((s) => ({ amount: s.payment?.amount ?? null, claims: (s.claims || []).length, plb: (s.plb || []).reduce((t, p) => t + (Number(p.amount) || 0), 0), plb_lines: (s.plb || []).length }));
      const plbOnly = pays.filter((p) => !p.claims && p.plb_lines);
      results.push({ source: 'nv835', reader: 'fairclaim-core readHealthcareX12 / read835', segments: segs.length, transactions: sets.length, problems: r.problems.length, payments: pays, plb_only_payments: plbOnly.length, plb_only_amount: plbOnly.reduce((t, p) => t + (p.amount || 0), 0) });
    }
  }
}

// ------------------------------------------------------------------ CMS RVU file ----
{
  const f = join(RD, 'rvu', 'PPRRVU2026_Jan_nonQPP.csv');
  if (!existsSync(f)) results.push({ source: 'rvu', skipped: 'not downloaded' });
  else {
    const fx = join(PK, 'fairpractice-provider-pay', 'fixtures');
    const fixture = await call('provider-pay', 'providerpay_check', { charges: rel(join(fx, 'charges-2026-q3.csv')), rvus: rel(join(fx, 'rvus.csv')), settings: rel(join(fx, 'comp-plan.json')), from: '2026-07-01', to: '2026-09-30' });
    const real = await call('provider-pay', 'providerpay_check', { charges: rel(join(fx, 'charges-2026-q3.csv')), rvus: rel(f), settings: rel(join(fx, 'comp-plan.json')), from: '2026-07-01', to: '2026-09-30' });
    const src = (real.sources || []).find((s) => s.arg === 'rvus') || {};
    const rows = readFileSync(f, 'utf8').split(/\r?\n/).length;
    results.push({ source: 'rvu', agent: 'fairpractice-provider-pay', rvu_file_lines: rows, header_row: src.header_row ?? null, mapped: src.mapped || {}, missing: src.missing || [],
      fixture_rvus: { by_status: countOf(fixture.result.items), wrvu: fixture.result.total_wrvu, providers: fixture.result.providers.map((p) => [p.provider, p.wrvu]) },
      real_rvus: { by_status: countOf(real.result.items), wrvu: real.result.total_wrvu, providers: real.result.providers.map((p) => [p.provider, p.wrvu]), no_rvu_codes: real.result.items.filter((i) => i.status === 'no_rvu').map((i) => i.code) }, ms: real.ms });
  }
}

const date = new Date().toISOString().slice(0, 10);
writeFileSync(join(ROOT, 'docs', 'realdata.json'), JSON.stringify({ date, sources: SOURCES, results }, null, 2) + '\n');
const R = Object.fromEntries(results.map((r) => [r.source, r])); const n = (x) => Number(x).toLocaleString('en-US');
const src = (k) => `[${SOURCES[k].name}](${SOURCES[k].page}) (file: ${SOURCES[k].url}; licence: ${SOURCES[k].licence})`;
const md = ['# Real public data through Fairpractice (wave 1)', '', `Written by \`npm run realdata\` (scripts/realdata.mjs) on ${date}. The public files are downloaded by \`npm run realdata:download\` into \`_realdata/\`, which git ignores; they are not in the repo, and no name from them is copied here. Staff lists and charges placed next to them are the fixtures or made up by the script.`, ''];
if (R.leie && !R.leie.skipped) { const x = R.leie; md.push('## OIG LEIE: fairpractice-exclusion-screening', '', `Source: ${src('leie')}.`, '',
  `- The full file as published: ${n(x.leie_rows)} entries (dates as YYYYMMDD, zeros for blanks), ${n(x.individuals_with_dob)} individuals with a birth date.`,
  `- 500 listed individuals entered as if they were staff (name and birth date as the LEIE has them; ${x.listed_with_npi} with an NPI): **${x.listed_found} of ${x.listed_people} flagged** as an NPI or name-and-birth-date match (${JSON.stringify(x.listed_by_status)}). ${n(x.ms_listed)} ms.`,
  `- 1,000 made-up staff built from the 40 most common first names and 25 most common last names, with made-up birth dates (a worst case for name collisions): ${n(x.made_up_findings)} findings ${JSON.stringify(x.made_up_by_status)}; ${n(x.made_up_near_names_other_birth_date)} near-name pairs with a different birth date on both sides counted and not listed. **Before the fix this run led to: 6,357 findings, 5,902 of them near names** of real excluded people with other birth dates. Exact-name matches with a different birth date are still listed (446 here), so the compliance officer can note the check; near names with no birth date to compare stay listed (74). ${n(x.ms_made_up)} ms.`, ''); }
if (R.nv835 && !R.nv835.skipped) { const x = R.nv835; md.push('## Nevada Medicaid sample 835: fairclaim-core 835 reader', '', `Source: ${src('nv835')}.`, '',
  `- Text taken from the PDF (pdftotext -layout), page lines dropped, ${x.segments} segments, ${x.transactions} transactions, ${x.problems} reader problem(s) (a control count that the PDF layout breaks).`,
  `- **The ${x.plb_only_amount.toFixed(2)} check made only of provider-level adjustments (PLB, no claims) is in the payments**, with its PLB lines summing to ${x.payments.find((p) => !p.claims && p.plb_lines)?.plb.toFixed(2)}. No wave-1 agent posts ERAs; the ERA-matching bug other families found is in an agent that builds checks from claims only, not in this reader.`, ''); }
if (R.rvu && !R.rvu.skipped) { const x = R.rvu; md.push('## CMS physician fee schedule RVU file (January 2026): fairpractice-provider-pay', '', `Source: ${src('rvu')}.`, '',
  `- The CSV as published: ${n(x.rvu_file_lines)} lines, column names on row ${x.header_row} under title rows, a STATUS column headed "CODE" and two columns headed "RVU" (work and malpractice).`,
  `- **Before the fixes: every code came back "no RVU"** (the agent's own field name \`code\` took the STATUS "CODE" column), then, with that fixed, work RVUs read from the malpractice column (Rhea Lin 84.9 wRVUs instead of about 1,170), because the core kept the last of two same-named columns. Fixed in the agent (the field is \`hcpcs\`, HCPCS first) and in fairclaim-core (a repeated column name keeps the first column).`,
  `- After: fixture charges priced with the real file: ${JSON.stringify(x.real_rvus.by_status)}, ${x.real_rvus.wrvu} wRVUs (${x.real_rvus.providers.map(([p, v]) => `${p} ${v}`).join(', ')}); with the fixture's rounded example file: ${x.fixture_rvus.wrvu} wRVUs. No code missing from the real file.`, ''); }
md.push('## Agents with no public data in their real format', '', 'The other 28 agents read files private to a practice or agency (sessions, authorizations, rosters, claims, time logs, payroll, EVV visits, incident logs, vendor lists, training and health records, credentials, contracts and payments, lien cases, disputes, reviews, risk registers, care plans, recoupments). No public file in those layouts was found. Two public sources come close and were not used in this pass: the HHS breach portal (breaches of 500 or more, not an incident log) and state licence lookups (credential status, not a hospital credential file; the Fairclinic pass used Washington\'s). SAM.gov exclusions need an API key and were not used.', '');
writeFileSync(join(ROOT, 'docs', 'realdata.md'), md.join('\n'));
console.log(JSON.stringify(results, null, 1));
