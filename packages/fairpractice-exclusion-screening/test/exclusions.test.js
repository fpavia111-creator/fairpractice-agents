import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairpractice-core';
import { manifest } from '../src/index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const sandbox = () => { const root = mkdtempSync(join(tmpdir(), 'exclusions-')); cpSync(fixtures, root, { recursive: true }); return root; };
const f = { people: 'people.csv', exclusions: 'leie-2026-11.csv', state_list: 'state-medicaid-2026-11.csv', settings: 'settings.json', as_of: '2026-11-15' };

test('an accepted cleared_match, given the pseudonym from a result, hides that near name on the next run', async () => {
  const root = sandbox(); const rt = new AgentRuntime(manifest, { root });
  const first = await rt.call('exclusions_check', { ...f, status: 'near_name' });
  const pid = first.result.items[0].person_id; assert.match(pid, /^MRN-/);
  const l = await rt.call('exclusions_learn', { kind: 'cleared_match', value: { person_id: pid, excluded_on: first.result.items[0].excluded_on } });
  const ask = await rt.call('exclusions_accept_learning', { id: l.result.fact.id, decision: 'accept' });
  rt.approvals.approve(ask.approval_id, 'Cora Compliance (fictional)');
  await rt.call('exclusions_accept_learning', { id: l.result.fact.id, decision: 'accept' });
  assert.equal((await rt.call('exclusions_check', f)).result.by_status.near_name, undefined);
});

test('the OIG layout with YYYYMMDD dates and a state file with other headers both read', async () => {
  const root = sandbox(); const rt = new AgentRuntime(manifest, { root });
  writeFileSync(join(root, 'p2.csv'), 'Staff Name,Birth Date,Last Check\n"Mercer, Rosalind",02/20/1979,11/01/2026\n');
  const r = await rt.call('exclusions_check', { people: 'p2.csv', exclusions: 'leie-2026-11.csv', as_of: '2026-11-15' });
  assert.equal(r.status, 'executed', r.reason); assert.equal(r.result.items[0].status, 'confirmed_match'); assert.equal(r.result.items[0].excluded_on, '2022-01-10');
});
