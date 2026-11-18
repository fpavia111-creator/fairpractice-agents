// Domain checks: risk levels, register gaps, assets and evidence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRisks, riskLevel } from '../src/logic.js';

const R = (id, o = {}) => ({ risk_id: id, asset: o.asset || 'EHR', threat: 't', likelihood: o.l ?? 4, impact: o.i ?? 4, rating: o.rating || '', owner: o.owner ?? 'Owner', plan: o.plan ?? 'Plan', due: o.due || '', status: o.status || 'open', accepted_by: o.by || '' });
const asOf = '2026-11-15'; const fresh = { asOf, lastAnalysis: '2026-06-01' };
const st = (r) => r.items.map((i) => [i.risk_id || i.asset, i.status]);

test('risk level from a word or from likelihood x impact', () => {
  assert.equal(riskLevel({ rating: 'High' }), 3);
  assert.equal(riskLevel({ likelihood: 3, impact: 4 }), 3);
  assert.equal(riskLevel({ likelihood: 2, impact: 3 }), 2);
  assert.equal(riskLevel({ likelihood: 5, impact: 4 }), 4);
  assert.equal(riskLevel({ likelihood: 'high', impact: 'medium' }), 2, 'high=4, medium=2: score 8');
  assert.equal(riskLevel({}), null);
});

test('the yearly analysis: overdue after the interval, or when no date is recorded', () => {
  assert.equal(checkRisks([], [], [], { asOf, lastAnalysis: '2025-11-14' }).items[0].status, 'sra_overdue');
  assert.deepEqual(checkRisks([], [], [], { asOf, lastAnalysis: '2025-11-15' }).items, []);
  assert.equal(checkRisks([], [], [], { asOf }).items[0].status, 'sra_overdue');
});

test('high risks need an owner and a plan; low risks do not', () => {
  const r = checkRisks([R('A', { owner: '', plan: '' }), R('B', { l: 1, i: 2, owner: '', plan: '' })], [], [], fresh);
  assert.deepEqual(st(r), [['A', 'high_no_owner'], ['A', 'high_no_plan']]);
});

test('closed risks are skipped; accepted risks need a sign-off', () => {
  const r = checkRisks([R('A', { status: 'Closed', due: '2020-01-01' }), R('B', { status: 'Risk accepted' }), R('C', { status: 'accepted', by: 'CEO' })], [], [], fresh);
  assert.deepEqual(st(r), [['B', 'accepted_no_signoff']]);
});

test('due dates: past due and due soon', () => {
  assert.deepEqual(st(checkRisks([R('A', { due: '2026-11-14' }), R('B', { due: '2026-12-15' }), R('C', { due: '2026-12-16' })], [], [], { ...fresh, warnDays: 30 })), [['A', 'past_due'], ['B', 'due_soon']]);
});

test('systems with patient data must be in the register (names compared loosely); others are ignored', () => {
  const r = checkRisks([R('A', { asset: 'EHR system' })], [{ asset: 'ehr  System', holds_phi: 'yes' }, { asset: 'Fax', holds_phi: 'Yes' }, { asset: 'TV', holds_phi: 'no' }], [], fresh);
  assert.deepEqual(st(r), [['Fax', 'asset_not_assessed']]);
});

test('evidence: required items missing or older than the interval; optional ones skipped', () => {
  const r = checkRisks([], [], [{ item: 'X', done_on: '2025-01-01', required: 'yes' }, { item: 'Y', done_on: '', required: '' }, { item: 'Z', done_on: '', required: 'no' }, { item: 'W', done_on: '2026-01-01' }], fresh);
  assert.deepEqual(st(r), [['X', 'evidence_missing'], ['Y', 'evidence_missing']]);
});
