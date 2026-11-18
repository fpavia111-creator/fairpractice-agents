// Domain checks: attribution roster against visits, adds and drops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAttribution } from '../src/logic.js';

const R = (id, prov = 'Rhea Lin MD', o = {}) => ({ member_id: id, patient_name: o.name || `P ${id}`, dob: o.dob || '1950-01-01', provider: prov, npi: o.npi || '' });
const V = (id, date, prov = 'Rhea Lin MD', payer = 'Bluepeak', o = {}) => ({ patient_id: `X${id}`, member_id: o.noId ? '' : id, patient_name: o.name || `P ${id}`, dob: o.dob || '1950-01-01', date, provider: prov, payer });
const asOf = '2026-11-15'; const opts = { asOf, payerWords: ['bluepeak'] };
const st = (r) => r.items.map((i) => [i.status, i.member_id]);

test('a matched roster raises nothing', () => {
  assert.deepEqual(checkAttribution([R('M1')], [V('M1', '2026-05-01')], [R('M1')], opts).items, []);
});

test('match by name and birth date when the visit has no member ID', () => {
  const r = checkAttribution([R('M1', 'Rhea Lin', { name: 'Ann Lee', dob: '1950-02-03' })], [V('M1', '2026-05-01', 'Dr. Rhea Lin', 'Bluepeak', { noId: true, name: 'ANN  LEE', dob: '1950-02-03' })], [], opts);
  assert.deepEqual(r.items, []);
});

test('not seen: never, or only before the lookback', () => {
  const r = checkAttribution([R('M1'), R('M2')], [V('M2', '2024-01-01')], [], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.member_id, i.last_visit]), [['not_seen', 'M1', null], ['not_seen', 'M2', '2024-01-01']]);
});

test('wrong provider only when the attributed provider never saw the patient in the lookback', () => {
  const r = checkAttribution([R('M1', 'Sam Otto DO'), R('M2', 'Sam Otto DO')], [V('M1', '2026-01-01'), V('M1', '2026-02-01'), V('M2', '2026-01-01'), V('M2', '2026-02-01'), V('M2', '2026-03-01', 'Dr Sam Otto')], [], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.member_id, i.seen_by]), [['wrong_provider', 'M1', 'Rhea Lin MD']]);
});

test('left out: active with this payer, on neither roster; other payers ignored', () => {
  const r = checkAttribution([], [V('M1', '2026-05-01'), V('M2', '2026-05-01', 'Rhea Lin MD', 'Cedar Mutual'), V('M3', '2023-05-01')], [], { ...opts, pmpm: 40 });
  assert.deepEqual(r.items.map((i) => [i.status, i.member_id, i.amount]), [['left_out', 'M1', 40]]);
});

test('adds and drops against last month, with drops flagged when still active', () => {
  const r = checkAttribution([R('M1'), R('M3')], [V('M1', '2026-05-01'), V('M2', '2026-05-01'), V('M3', '2026-05-01')], [R('M1'), R('M2'), R('M4')], { ...opts, pmpm: 40 });
  assert.deepEqual(r.items.map((i) => [i.status, i.member_id, i.still_active ?? null]), [['dropped', 'M2', true], ['dropped', 'M4', false], ['added', 'M3', null]]);
});
