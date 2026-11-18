// Domain checks: lien balances, settlements, dropped cases, filing windows, letters, reductions, stale cases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLiens } from '../src/logic.js';

const K = (id, o = {}) => ({ patient_id: id, case_id: `C-${id}`, attorney: o.att || 'Firm A', injury_date: o.inj || '2026-01-01', state: o.state || 'CA', lop_signed: o.lop ?? '2026-01-05', charges: o.charges ?? 1000, paid: o.paid ?? 0, reduction_pct: o.red ?? '', status: o.status || 'Open', settled_date: o.settled || '', last_update: o.upd ?? '2026-11-01', suit_filed: o.suit || '' });
const asOf = '2026-11-15'; const opts = { asOf, statuteYears: { default: 2, NY: 3 } };
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('balances net of payments and reductions, by attorney for open cases', () => {
  const r = checkLiens([K('A', { charges: 1000, paid: 200 }), K('B', { att: 'Firm B', charges: 500 }), K('C', { charges: 300 }), K('D', { status: 'Settled', settled: '2026-11-10', charges: 900 })], opts);
  assert.deepEqual(r.attorneys, [{ attorney: 'Firm A', cases: 2, balance: 1100 }, { attorney: 'Firm B', cases: 1, balance: 500 }]);
  assert.equal(r.open_balance, 1600);
});

test('settled: unpaid after the pay window; paid in full or with an allowed reduction is fine', () => {
  const r = checkLiens([K('A', { status: 'Settled', settled: '2026-09-01' }), K('B', { status: 'Settled', settled: '2026-11-01' }), K('C', { status: 'Settled', settled: '2026-09-01', paid: 700, red: 30 })], opts);
  assert.deepEqual(st(r), [['settled_not_paid', 'A']]);
});

test('dropped or lost with a balance, and reductions over the limit', () => {
  const r = checkLiens([K('A', { status: 'Attorney withdrew' }), K('B', { status: 'Lost at trial', paid: 1000 }), K('C', { status: 'Settled', settled: '2026-10-01', paid: 500, red: 50 })], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.amount]), [['case_dropped', 'A', 1000], ['reduction_over_limit', 'C', 170]]);
});

test('filing windows by state, skipped once suit is filed; warn ahead', () => {
  const r = checkLiens([K('A', { inj: '2024-10-01' }), K('B', { inj: '2024-10-01', state: 'NY' }), K('C', { inj: '2024-12-20' }), K('D', { inj: '2024-10-01', suit: 'Yes' })], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.date]), [['statute_passed', 'A', '2026-10-01'], ['statute_near', 'C', '2026-12-20']]);
});

test('no letter of protection and stale cases only for open cases', () => {
  const r = checkLiens([K('A', { lop: '' }), K('B', { upd: '2026-07-01' }), K('C', { upd: '' }), K('D', { status: 'Settled', settled: '2026-11-10', lop: '', upd: '2025-01-01' })], opts);
  assert.deepEqual(st(r), [['no_lop', 'A'], ['stale_case', 'B'], ['stale_case', 'C']]);
});
