// Domain checks: code update impact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCodeUpdates } from '../src/logic.js';

const CH = (code, action, o = {}) => ({ code, code_set: o.set || 'CPT', action, effective: o.eff || '2027-01-01', replacement: o.repl || '' });
const CDM = (code, price = 100, active = 'Y') => ({ code, price, active });
const st = (r) => r.items.map((i) => [i.status, i.code]);

test('action words', () => {
  const r = checkCodeUpdates([CH('A1', 'Delete'), CH('A2', 'retired'), CH('A3', 'NEW'), CH('A4', 'Descriptor changed'), CH('A5', '??')], []);
  assert.deepEqual([r.deleted, r.added, r.revised, r.changes], [2, 1, 1, 4]);
});

test('deleted codes on the active chargemaster only', () => {
  const r = checkCodeUpdates([CH('A1', 'deleted'), CH('A2', 'deleted'), CH('A3', 'deleted')], [CDM('A1'), CDM('A2', 100, 'Inactive'), CDM('B1')]);
  assert.deepEqual(st(r), [['deleted_in_chargemaster', 'A1']]);
});

test('open claims: only services on or after the effective date, procedure or diagnosis', () => {
  const r = checkCodeUpdates([CH('D1.1', 'deleted', { set: 'ICD-10', eff: '2026-10-01' }), CH('A1', 'deleted')], [], { openClaims: [{ claim_id: 'X', dos: '2026-10-01', codes: 'B1', diagnoses: 'D11' }, { claim_id: 'Y', dos: '2026-09-30', diagnoses: 'D1.1' }, { claim_id: 'Z', dos: '2026-12-01', codes: 'A1' }] });
  assert.deepEqual(r.items.map((i) => [i.status, i.claim_id]), [['deleted_on_open_claim', 'X']]);
});

test('order sets once per set and code; fee schedules once per code with payers', () => {
  const r = checkCodeUpdates([CH('A1', 'deleted')], [], { orderSets: [{ order_set: 'S1', code: 'A1' }, { order_set: 'S1', code: 'A1' }, { order_set: 'S2', code: 'A1' }], feeSchedule: [{ payer: 'P1', code: 'A1' }, { payer: 'P2', code: 'A1' }] });
  assert.deepEqual(r.items.map((i) => [i.status, i.order_set || i.payers]), [['deleted_in_order_set', 'S1'], ['deleted_in_order_set', 'S2'], ['deleted_in_fee_schedule', 'P1, P2']]);
});

test('new codes need a price when they replace a code in use or sit unpriced on the chargemaster; never ICD-10', () => {
  const r = checkCodeUpdates([CH('A1', 'deleted', { repl: 'N1; N2' }), CH('A9', 'deleted', { repl: 'N9' }), CH('N1', 'added'), CH('N2', 'added'), CH('N3', 'added'), CH('N9', 'added'), CH('D2', 'added', { set: 'ICD-10' })], [CDM('A1'), CDM('N2', 120), CDM('N3', 0), CDM('D2', 0)]);
  assert.deepEqual(r.items.filter((i) => i.status === 'new_code_no_fee').map((i) => [i.code, i.replaces]), [['N1', 'A1'], ['N3', null]]);
});

test('revised codes on the active chargemaster', () => {
  const r = checkCodeUpdates([CH('A1', 'revised'), CH('A2', 'revised')], [CDM('A1'), CDM('A2', 100, 'N')]);
  assert.deepEqual(st(r), [['revised_code', 'A1']]);
});
