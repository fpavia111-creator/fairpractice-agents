#!/usr/bin/env node
// Accuracy on fictional data, per agent and for the family.
//
//   node scripts/accuracy.mjs [agent ...] [--show] [--json]      (npm run accuracy)
//
// Each agent's fixtures/accuracy.json says:
//   case       the eval case (evals/cases.json) whose <prefix>_check call reads the planted fixtures
//              ("totals": every fixture file, no filter)
//   id         how a finding is named: a list of alternatives, each a list of item fields; the first
//              alternative whose fields are all filled is joined with "/" (a claim number, or an NDC,
//              or a payer and code for a list-level finding)
//   planted    every problem planted in the fixtures, as [id, status]; each one is described in the
//              agent's fixtures/README.md and was checked by hand against the fixture rows
//   clean      edits that turn the planted files into a clean set: repair the one wrong cell where
//              that is natural, or drop the row. The clean set must give no finding at all.
//   mutations  one fact changed in the clean set (one cell, or one setting); exactly the findings
//              under "expect" must appear and nothing else.
//   ignore     statuses that are not problems (bad debt's "claimable": an account ready for the cost
//              report); they are left out of every count
//
// Edits, on the files named by the case's arguments, in a temporary copy of the fixtures:
//   CSV:  { "arg": "claims", "drop": [["column", "value"] or [[c, v], ...]] }   (every row matching all)
//         { "arg": "claims", "set": [{ "where": ["column", "value"] or [[c, v], ...], "column": c, "value": v }] }
//         (a "where" must match exactly one row)
//         { "arg": "claims", "add": [{ "column": "value", ... }] }   (a row; missing columns are blank)
//   JSON: { "arg": "settings", "json": { "dotted.path": value } }
//
// Recall = planted findings returned / planted findings. False positives = findings on the planted
// set that are not planted, plus findings on the clean set. Masking is off here so findings match
// the fixture's own ids (masking is checked by the canary tests). Writes docs/accuracy.md and
// docs/accuracy.json. Fictional data only; no network; nothing outside a temporary folder is written
// except those two files. The planted lists, clean sets and mutations were written by the same author
// as the checks, so this measures the checks against their author's own cases, not against a real
// practice's, pharmacy's or hospital's files.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const { AgentRuntime, parseCsv, toCsv } = await import(pathToFileURL(join(PK, 'fairclaim-core', 'src', 'index.js')).href);
const argv = process.argv.slice(2); const only = argv.filter((a) => !a.startsWith('--')); const show = argv.includes('--show');
const allAgents = readdirSync(PK).filter((n) => /^fairpractice-(?!core$)/.test(n) && existsSync(join(PK, n, 'src', 'index.js'))).sort();
const agents = allAgents.filter((n) => existsSync(join(PK, n, 'fixtures', 'accuracy.json')) && (!only.length || only.includes(n)));

const key = ([id, code]) => `${id} :: ${code}`;
const filled = (v) => v !== undefined && v !== null && v !== '';
function findingsOf(r, spec) {
  const alts = Array.isArray(spec.id[0]) ? spec.id : [spec.id];
  const skip = new Set(spec.ignore || []);
  return ((r.result && r.result.items) || []).filter((it) => !skip.has(it.status)).map((it) => { const alt = alts.find((a) => a.every((k) => filled(it[k]))) || []; return [alt.map((k) => it[k]).join('/'), it.status]; });
}

function setPath(o, path, v) { const ks = path.split('.'); let cur = o; for (const k of ks.slice(0, -1)) cur = cur[k] ??= {}; cur[ks.at(-1)] = v; }
const conds = (w) => (Array.isArray(w[0]) ? w : [w]);
const match = (r, w) => conds(w).every(([c, v]) => String(r[c] ?? '').trim() === String(v));
function edit(root, args, edits = []) {
  for (const e of edits) {
    const rel = args[e.arg]; if (!rel) throw new Error(`no argument "${e.arg}"`); const f = join(root, rel);
    if (e.json) { const o = JSON.parse(readFileSync(f, 'utf8')); for (const [p, v] of Object.entries(e.json)) setPath(o, p, v); writeFileSync(f, JSON.stringify(o, null, 2)); continue; }
    const rows = parseCsv(readFileSync(f, 'utf8')); const cols = Object.keys(rows[0] || {}); let keep = rows;
    for (const w of e.drop || []) { const n = keep.length; keep = keep.filter((r) => !match(r, w)); if (keep.length === n) throw new Error(`${rel}: no row matches ${JSON.stringify(w)}`); }
    for (const s of e.set || []) {
      const hit = keep.filter((r) => match(r, s.where));
      if (hit.length !== 1) throw new Error(`${rel}: ${hit.length} rows match ${JSON.stringify(s.where)}`);
      if (!cols.includes(s.column)) throw new Error(`${rel}: no column ${s.column}`);
      hit[0][s.column] = String(s.value);
    }
    for (const a of e.add || []) { for (const c of Object.keys(a)) if (!cols.includes(c)) throw new Error(`${rel}: no column ${c}`); keep.push(Object.fromEntries(cols.map((c) => [c, a[c] ?? '']))); }
    writeFileSync(f, toCsv(keep, cols, { raw: true }));
  }
}
const rowsIn = (root, args) => Object.values(args).filter((v) => typeof v === 'string' && /\.csv$/i.test(v) && existsSync(join(root, v))).reduce((n, v) => n + parseCsv(readFileSync(join(root, v), 'utf8')).length, 0);

async function run(n, manifest, spec, c, edits) {
  const parent = mkdtempSync(join(tmpdir(), `acc-${n}-`)); const root = join(parent, 'root'); cpSync(join(PK, n, 'fixtures'), join(root, 'fixtures'), { recursive: true });
  try {
    edit(root, c.args, edits);
    const rt = new AgentRuntime(manifest, { root, stateDir: null, audit: false, phi: 'off', memory: false });
    const r = await rt.call(c.tool, { ...c.args, limit: 5000 }); if (r.status !== 'executed') throw new Error(`${c.tool}: ${r.status} ${r.reason || r.error || ''}`);
    return { out: findingsOf(r, spec), rows: rowsIn(root, c.args) };
  } finally { rmSync(parent, { recursive: true, force: true }); }
}

const results = [];
for (const n of agents) {
  const spec = JSON.parse(readFileSync(join(PK, n, 'fixtures', 'accuracy.json'), 'utf8'));
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href);
  const c = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8')).cases.find((x) => x.id === spec.case);
  if (!c) throw new Error(`${n}: no eval case ${spec.case}`);
  const row = { agent: n, case: spec.case, problems: [] };
  try {
    const p = await run(n, manifest, spec, c, []); const got = new Set(p.out.map(key)); const want = new Set(spec.planted.map(key));
    if (want.size !== spec.planted.length) row.problems.push('planted list has duplicates');
    if (got.size !== p.out.length) row.problems.push('two findings share one id and status: make "id" more specific');
    row.planted_rows = p.rows; row.planted_total = want.size; row.planted_found = [...want].filter((k) => got.has(k)).length;
    const extra = [...got].filter((k) => !want.has(k)); row.planted_extra = extra.length;
    for (const k of [...want].filter((x) => !got.has(x))) row.problems.push(`missed: ${k}`);
    for (const k of extra) row.problems.push(`not planted: ${k}`);
    const cl = await run(n, manifest, spec, c, spec.clean); row.clean_rows = cl.rows; row.clean_findings = cl.out.length;
    for (const f of cl.out) row.problems.push(`clean set: ${key(f)}`);
    row.mutations = (spec.mutations || []).length; row.mutations_caught = 0;
    if (show) console.log(`\n## ${n}\n planted run: ${p.out.map(key).join(' | ')}\n clean run: ${cl.out.map(key).join(' | ') || '(none)'}`);
    for (const m of spec.mutations || []) {
      const r = await run(n, manifest, spec, c, [...spec.clean, ...m.edits]); const g = new Set(r.out.map(key)); const e = new Set(m.expect.map(key));
      const miss = [...e].filter((k) => !g.has(k)); const more = [...g].filter((k) => !e.has(k));
      if (!miss.length && !more.length) row.mutations_caught++;
      for (const k of miss) row.problems.push(`mutation "${m.name}" missed: ${k}`);
      for (const k of more) row.problems.push(`mutation "${m.name}" also gave: ${k}`);
      if (show) console.log(`   mutation ${m.name}: ${[...g].join(' | ') || '(none)'}`);
    }
  } catch (e) { row.problems.push(`error: ${e.message}`); }
  results.push(row);
}

const sum = (k) => results.reduce((s, r) => s + (r[k] || 0), 0);
const family = { agents_measured: results.length, agents_in_family: allAgents.length, planted_found: sum('planted_found'), planted_total: sum('planted_total'), planted_extra: sum('planted_extra'), planted_rows: sum('planted_rows'), clean_rows: sum('clean_rows'), clean_false_positives: sum('clean_findings'), mutation_cases: sum('mutations'), mutation_caught: sum('mutations_caught'), date: new Date().toISOString().slice(0, 10) };
const md = [
  '# Fairpractice (wave 1): accuracy on fictional test data', '',
  `Written by \`npm run accuracy\` (scripts/accuracy.mjs) on ${family.date}. Fictional fixtures only; no real practice, pharmacy, hospital or patient data.`, '',
  `**Family:** ${family.agents_measured} of ${family.agents_in_family} agents measured. Planted problems found: **${family.planted_found} of ${family.planted_total}**; findings on the planted set that were not planted: **${family.planted_extra}**. Clean set: **${family.clean_rows} rows, ${family.clean_false_positives} findings** (false positives). One-fact mutations caught: **${family.mutation_caught} of ${family.mutation_cases}**.`, '',
  'Planted: every problem written into the fixtures on purpose, listed in each agent\'s `fixtures/accuracy.json` and described in its `fixtures/README.md`. Clean: the same files with the one wrong cell repaired (or, where a repair would not be natural, the row dropped); it must give no finding. Mutation: one fact changed in the clean set (one cell or one setting); exactly the named findings must appear and nothing else.', '',
  'Limits: the fixtures, planted lists, clean sets and mutations were written by the same author as the checks. They show the checks do what their author meant on small fictional files; they do not show how the checks do on a real practice\'s, pharmacy\'s or hospital\'s exports, which have not been measured.', '',
  '| Agent | Planted found | Not planted | Clean rows | Clean findings | Mutations caught |', '| --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.agent} | ${r.planted_found} / ${r.planted_total} | ${r.planted_extra} | ${r.clean_rows} | ${r.clean_findings} | ${r.mutations_caught} / ${r.mutations} |`),
  '', results.some((r) => r.problems.length) ? '## Problems\n\n' + results.filter((r) => r.problems.length).map((r) => `- ${r.agent}: ${r.problems.join('; ')}`).join('\n') : 'No problems: every planted finding found, nothing else on the planted set, nothing on the clean set, every mutation caught.', '',
];
if (!only.length) { mkdirSync(join(ROOT, 'docs'), { recursive: true }); writeFileSync(join(ROOT, 'docs', 'accuracy.md'), md.join('\n')); writeFileSync(join(ROOT, 'docs', 'accuracy.json'), JSON.stringify({ family, agents: results }, null, 2) + '\n'); }
if (argv.includes('--json')) console.log(JSON.stringify({ family, agents: results }, null, 2));
else {
  for (const r of results) console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${r.agent.padEnd(40)} planted ${r.planted_found}/${r.planted_total} (+${r.planted_extra})  clean ${r.clean_rows} rows ${r.clean_findings} findings  mutations ${r.mutations_caught}/${r.mutations}${r.problems.length ? '\n       ' + r.problems.join('\n       ') : ''}`);
  console.log(`\nFamily: ${family.agents_measured}/${family.agents_in_family} agents, planted ${family.planted_found}/${family.planted_total}, not planted ${family.planted_extra}, clean ${family.clean_rows} rows ${family.clean_false_positives} findings, mutations ${family.mutation_caught}/${family.mutation_cases}`);
}
process.exitCode = results.some((r) => r.problems.length) || (results.length < allAgents.length && !only.length) ? 1 : 0;
