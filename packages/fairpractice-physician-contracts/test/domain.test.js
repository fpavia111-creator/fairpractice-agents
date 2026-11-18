// Domain checks: agreements, signatures, caps, rates and logs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPhysicianPayments, contractYearStart } from '../src/logic.js';

const K = (id, phys, o = {}) => ({ contract_id: id, physician: phys, npi: o.npi || '', type: o.type || 'Medical Director', signed: o.signed ?? '2025-12-01', start: o.start || '2026-01-01', end: o.end ?? '2026-12-31', hourly_rate: o.rate ?? 200, annual_cap: o.cap ?? '', time_log_required: o.log || 'no' });
const P = (phys, date, amount, o = {}) => ({ physician: phys, npi: o.npi || '', date, amount, hours: o.hours ?? '', time_log: o.log || '', contract_id: o.cid || '' });
const asOf = '2026-11-15'; const opts = { asOf, warnDays: 0 };
const st = (r) => r.items.map((i) => i.status);

test('contract years run from the start anniversary', () => {
  assert.equal(contractYearStart('2025-07-01', '2026-06-30'), '2025-07-01');
  assert.equal(contractYearStart('2025-07-01', '2026-07-01'), '2026-07-01');
});

test('physicians match by name in any order or by NPI', () => {
  assert.deepEqual(checkPhysicianPayments([K('A', 'Dr. Ann Lee')], [P('Lee, Ann', '2026-03-01', 100)], opts).items, []);
  assert.deepEqual(checkPhysicianPayments([K('A', 'Ann Lee', { npi: '1234567893' })], [P('A. Lee MD', '2026-03-01', 100, { npi: '1234567893' })], opts).items, []);
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee')], [P('Bo Ray', '2026-03-01', 100)], opts)), ['paid_no_contract']);
});

test('signature: missing, after the payment, or on the payment date (fine)', () => {
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee', { signed: '' })], [P('Ann Lee', '2026-03-01', 100)], opts)), ['unsigned_contract']);
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee', { signed: '2026-03-02' })], [P('Ann Lee', '2026-03-01', 100)], opts)), ['signed_after_payment']);
  assert.deepEqual(checkPhysicianPayments([K('A', 'Ann Lee', { signed: '2026-03-01' })], [P('Ann Lee', '2026-03-01', 100)], opts).items, []);
});

test('the cap counts per contract year and flags only the amount over it', () => {
  const r = checkPhysicianPayments([K('A', 'Ann Lee', { cap: 1000, start: '2025-07-01', end: '2027-06-30' })], [P('Ann Lee', '2026-05-01', 800), P('Ann Lee', '2026-06-01', 300), P('Ann Lee', '2026-07-01', 900)], opts);
  assert.deepEqual(st(r), ['over_annual_cap']); assert.equal(r.items[0].at_risk, 100);
});

test('hourly rate: above FMV wins over above contract; equal is fine', () => {
  const fmv = { 'medical director': { high: 250 } };
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee')], [P('Ann Lee', '2026-03-01', 2600, { hours: 10 })], { ...opts, fmv })), ['rate_above_fmv']);
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee')], [P('Ann Lee', '2026-03-01', 2100, { hours: 10 })], { ...opts, fmv })), ['rate_above_contract']);
  assert.deepEqual(checkPhysicianPayments([K('A', 'Ann Lee')], [P('Ann Lee', '2026-03-01', 2000, { hours: 10 })], { ...opts, fmv }).items, []);
});

test('paid after the end; a time log when required', () => {
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee', { end: '2026-02-28' })], [P('Ann Lee', '2026-03-01', 100)], opts)), ['expired_contract_paid']);
  assert.deepEqual(st(checkPhysicianPayments([K('A', 'Ann Lee', { log: 'yes' })], [P('Ann Lee', '2026-03-01', 100, { log: 'no' })], opts)), ['no_time_log']);
  assert.deepEqual(checkPhysicianPayments([K('A', 'Ann Lee', { log: 'yes' })], [P('Ann Lee', '2026-03-01', 100, { log: 'On file' })], opts).items, []);
});

test('a contract id on the payment picks that agreement', () => {
  const r = checkPhysicianPayments([K('A', 'Ann Lee'), K('B', 'Ann Lee', { signed: '' })], [P('Ann Lee', '2026-03-01', 100, { cid: 'B' })], opts);
  assert.deepEqual(st(r), ['unsigned_contract']);
});
