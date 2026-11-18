// Domain checks: the access clock, extensions, denials and fees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAccess, feeAllowed } from '../src/logic.js';

const R = (id, received, o = {}) => ({ request_id: id, patient_id: 'P1', received, format: o.format || 'paper', pages: o.pages ?? '', extended: o.ext || '', extension_notice_on: o.notice || '', fulfilled: o.done || '', denied: o.denied || '', denial_reason: o.reason || '', fee: o.fee ?? '' });
const asOf = '2026-11-15';
const st = (r) => r.items.map((i) => [i.request_id, i.status]);

test('day 30 is still on time; day 31 is late', () => {
  assert.deepEqual(st(checkAccess([R('A', '2026-10-01', { done: '2026-10-31' }), R('B', '2026-10-01', { done: '2026-11-01' })], { asOf })), [['B', 'fulfilled_late']]);
});

test('open requests: past due after the deadline, due soon inside the warning window', () => {
  const r = checkAccess([R('A', '2026-10-15'), R('B', '2026-10-20'), R('C', '2026-11-01')], { asOf, warnDays: 7 });
  assert.deepEqual(st(r), [['A', 'past_due'], ['B', 'due_soon']]);
});

test('an extension with a timely notice moves the deadline; a late or missing notice is flagged', () => {
  assert.deepEqual(checkAccess([R('A', '2026-09-20', { ext: 'yes', notice: '2026-10-10', done: '2026-11-10' })], { asOf }).items, []);
  assert.deepEqual(st(checkAccess([R('A', '2026-09-20', { ext: 'yes', done: '2026-11-10' })], { asOf })), [['A', 'extension_no_notice']]);
});

test('a shorter state limit is a setting', () => {
  assert.deepEqual(st(checkAccess([R('A', '2026-10-01', { done: '2026-10-20' })], { asOf, responseDays: 15 })), [['A', 'fulfilled_late']]);
});

test('a denial needs a reason; an undated denial is closed, not past due', () => {
  assert.deepEqual(st(checkAccess([R('A', '2026-08-01', { denied: 'yes' })], { asOf })), [['A', 'denial_no_reason']]);
  assert.deepEqual(checkAccess([R('A', '2026-08-01', { denied: 'yes', reason: 'psychotherapy notes' })], { asOf }).items, []);
});

test('fees: flat fee for electronic copies, per page plus base for paper, the cap wins', () => {
  const fees = { flatFee: 6.5, perPage: 0.25, base: 5, cap: 10 };
  assert.equal(feeAllowed({ format: 'Patient portal' }, fees), 6.5);
  assert.equal(feeAllowed({ format: 'paper', pages: 10 }, fees), 7.5);
  assert.equal(feeAllowed({ format: 'paper', pages: 100 }, fees), 10);
  assert.equal(feeAllowed({ format: 'paper' }, { perPage: 0.25 }), null, 'no page count, no cap: nothing to compare');
  const r = checkAccess([R('A', '2026-11-01', { format: 'email', fee: 6.5, done: '2026-11-02' }), R('B', '2026-11-01', { format: 'email', fee: 7, done: '2026-11-02' })], { asOf, fees });
  assert.deepEqual(st(r), [['B', 'fee_over_limit']]); assert.equal(r.items[0].amount, 0.5);
});
