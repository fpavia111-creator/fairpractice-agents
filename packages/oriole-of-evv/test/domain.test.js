// Domain checks: EVV visits against claims.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEvv, unitsFor } from '../src/logic.js';

const V = (cid, date, inT, outT, o = {}) => ({ client_id: cid, date, clock_in: inT, clock_out: outT, service: o.svc ?? 'T1019', caregiver_id: o.cg || 'K1', caregiver_name: o.cgName || 'Kay One', location_ok: o.loc ?? 'Yes', distance: o.dist ?? '', manual: o.manual || '' });
const C = (cid, date, units, o = {}) => ({ client_id: cid, date, service: o.svc ?? 'T1019', units, caregiver_id: o.cg ?? 'K1', caregiver_name: '', amount: o.amount ?? units * 6 });
const st = (r) => r.items.map((i) => [i.status, i.client_id]);

test('units from verified minutes by rounding rule', () => {
  assert.deepEqual([7, 8, 22, 23].map((m) => unitsFor(m)), [0, 1, 1, 2]);
  assert.deepEqual([7, 8, 22, 23].map((m) => unitsFor(m, 15, 'down')), [0, 0, 1, 1]);
  assert.deepEqual([1, 15, 16].map((m) => unitsFor(m, 15, 'up')), [1, 1, 2]);
});

test('matched claims raise nothing; split visits on one day add up', () => {
  const r = checkEvv([V('A', '2026-11-02', '09:00', '10:00'), V('A', '2026-11-02', '14:00', '15:00')], [C('A', '2026-11-02', 8)]);
  assert.deepEqual(r.items, []);
});

test('no EVV visit for the client, date or service', () => {
  const r = checkEvv([V('A', '2026-11-02', '09:00', '10:00')], [C('B', '2026-11-02', 4), C('A', '2026-11-03', 4), C('A', '2026-11-02', 4, { svc: 'S5130' })]);
  assert.deepEqual(st(r), [['no_evv', 'B'], ['no_evv', 'A'], ['no_evv', 'A']]);
});

test('units over the verified time, priced per unit', () => {
  const r = checkEvv([V('A', '2026-11-02', '09:00', '10:30')], [C('A', '2026-11-02', 8, { amount: 48 })], { rounding: 'down' });
  assert.deepEqual(r.items.map((i) => [i.status, i.verified_units, i.amount]), [['units_over_verified', 6, 12]]);
});

test('caregiver and location mismatches, including distance over the limit', () => {
  const r = checkEvv([V('A', '2026-11-02', '09:00', '10:00', { cg: 'K2' }), V('B', '2026-11-02', '09:00', '10:00', { loc: 'No' }), V('D', '2026-11-02', '09:00', '10:00', { dist: 0.9 }), V('E', '2026-11-02', '09:00', '10:00', { dist: 0.1 })], [C('A', '2026-11-02', 4), C('B', '2026-11-02', 4), C('D', '2026-11-02', 4), C('E', '2026-11-02', 4)], { maxDistance: 0.5 });
  assert.deepEqual(st(r), [['caregiver_mismatch', 'A'], ['location_mismatch', 'B'], ['location_mismatch', 'D']]);
});

test('manual edits per caregiver above the limit, once they have enough visits', () => {
  const vs = [V('A', '2026-11-02', '09:00', '10:00', { cg: 'K1', manual: 'Yes' }), V('A', '2026-11-03', '09:00', '10:00', { cg: 'K1' }), V('A', '2026-11-04', '09:00', '10:00', { cg: 'K1', manual: 'Manual entry' }), V('B', '2026-11-02', '09:00', '10:00', { cg: 'K2', manual: 'Yes' })];
  const r = checkEvv(vs, [], { maxManualPct: 50 });
  assert.deepEqual(r.items.map((i) => [i.status, i.manual, i.visits]), [['manual_edits_high', 2, 3]]);
  assert.equal(r.unbilled_visits, 4);
});
