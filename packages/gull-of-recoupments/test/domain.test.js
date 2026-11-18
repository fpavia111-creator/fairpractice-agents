// Domain checks: recoupments against claims, notices, lookback and appeal windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRecoupments } from '../src/logic.js';

const R = (ref, date, amount, payer = 'Bluepeak') => ({ payer, remit_date: date, claim_ref: ref, amount });
const C = (id, paid, paidDate = '2026-03-01') => ({ claim_id: id, patient_id: `P${id}`, payer: 'Bluepeak', dos: '2026-02-20', paid, paid_date: paidDate });
const N = (ref, date) => ({ payer: 'Bluepeak', claim_ref: ref, notice_date: date });
const asOf = '2026-11-15'; const opts = { asOf, appealDays: { default: 120 }, warnDays: 21 };
const st = (r) => r.items.map((i) => [i.status, i.claim_id]);

test('a noticed recoupment with time left to appeal is listed as appealable', () => {
  const r = checkRecoupments([R('A', '2026-10-20', -300)], [C('A', 300)], [N('A', '2026-09-15')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.appeal_due, i.days_left]), [['appeal_open', '2027-01-13', 59]]);
});

test('appeal window from the recoupment date when there is no notice; closed windows are dropped', () => {
  const r = checkRecoupments([R('A', '2026-01-02', -100), R('B', '2026-07-25', -100)], [C('A', 100), C('B', 100)], [N('A', '2026-01-01'), N('B', '2026-07-01')], opts);
  assert.deepEqual(r.items, []);
});

test('the same claim taken twice, and more than was paid', () => {
  const r = checkRecoupments([R('A', '2026-09-01', -250), R('A', '2026-10-15', 250), R('B', '2026-10-06', -220)], [C('A', 250), C('B', 180)], [N('A', '2026-08-01'), N('B', '2026-09-01')], opts);
  assert.deepEqual(r.items.filter((i) => !i.status.startsWith('appeal')).map((i) => [i.status, i.claim_id, i.amount]), [['taken_twice', 'A', 250], ['over_original', 'B', 40]]);
});

test('two partial takebacks within the paid amount are not duplicates', () => {
  const r = checkRecoupments([R('A', '2026-10-01', -100), R('A', '2026-10-15', -100)], [C('A', 250)], [N('A', '2026-09-01')], opts);
  assert.deepEqual(r.items.map((i) => i.status), ['appeal_open', 'appeal_open']);
});

test('lookback, missing or short notice, and unmatched claims', () => {
  const r = checkRecoupments([R('A', '2026-10-28', -400), R('B', '2026-11-02', -150), R('D', '2026-11-02', -150), R('Z', '2026-10-13', -90)], [C('A', 400, '2024-12-01'), C('B', 150), C('D', 150)], [N('A', '2026-10-01'), N('D', '2026-10-25')], { ...opts, lookbackMonths: 18, noticeLeadDays: 30 });
  assert.deepEqual(st(r), [['beyond_lookback', 'A'], ['no_notice', 'A'], ['no_notice', 'B'], ['no_notice', 'D'], ['unmatched', 'Z']]);
});
