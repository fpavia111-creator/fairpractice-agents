// Domain checks: hospice notices, benefit periods, face-to-face, cap and live discharges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHospice, benefitPeriods, capYearOf } from '../src/logic.js';

const P = (id, election, o = {}) => ({ patient_id: id, election, noe_filed: o.noe ?? election, discharge: o.dc || '', discharge_reason: o.reason || '', notr_filed: o.notr || '', starting_period: o.first || '', f2f: o.f2f || '', cap_paid: o.paid ?? '', cap_share: o.share ?? '' });
const asOf = '2026-11-15'; const opts = { asOf, warnDays: 0 };
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('benefit periods: 90, 90, then 60 days; transfers start later', () => {
  assert.deepEqual(benefitPeriods('2026-01-01', 1, '2026-08-01').map((p) => [p.n, p.start, p.end]), [[1, '2026-01-01', '2026-03-31'], [2, '2026-04-01', '2026-06-29'], [3, '2026-06-30', '2026-08-28']]);
  assert.deepEqual(benefitPeriods('2026-01-01', 3, '2026-03-05').map((p) => [p.n, p.end]), [[3, '2026-03-01'], [4, '2026-04-30']]);
});

test('cap year runs October to September and is named by its end', () => {
  assert.deepEqual(['2025-09-30', '2025-10-01', '2026-09-30'].map(capYearOf), [2025, 2026, 2026]);
});

test('NOE: on day 5 is on time, day 6 is late with the uncovered days, none filed after the due date is missing', () => {
  const r = checkHospice([P('A', '2026-11-01', { noe: '2026-11-06' }), P('B', '2026-11-01', { noe: '2026-11-07' }), P('C', '2026-11-01', { noe: '' }), P('D', '2026-11-12', { noe: '' })], { ...opts, dailyRate: 100 });
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.uncovered_days, i.amount]), [['noe_missing', 'C', 14, 1400], ['noe_late', 'B', 6, 600]]);
});

test('NOTR only after live discharges, not deaths', () => {
  const r = checkHospice([P('A', '2026-06-01', { dc: '2026-11-01', reason: 'Revoked' }), P('B', '2026-06-01', { dc: '2026-11-01', reason: 'Death' }), P('C', '2026-06-01', { dc: '2026-11-01', reason: 'Transfer', notr: '2026-11-09' }), P('D', '2026-06-01', { dc: '2026-11-01', reason: 'Live discharge', notr: '2026-11-04' })], { ...opts, liveDischargePct: 100 });
  assert.deepEqual(st(r), [['notr_missing', 'A'], ['notr_late', 'C']]);
});

test('face-to-face: needed in the 30 days before period 3 and later, not after a discharge', () => {
  const r = checkHospice([P('A', '2026-01-01', { f2f: '2026-05-01' }), P('B', '2026-01-01', { f2f: '2026-06-29' }), P('C', '2026-01-01', { dc: '2026-06-15', reason: 'Death' })], opts);
  assert.deepEqual(st(r).filter(([s]) => s.startsWith('f2f')), [['f2f_missing', 'A'], ['f2f_missing', 'A'], ['f2f_missing', 'A'], ['f2f_missing', 'B'], ['f2f_missing', 'B']]);
  const ahead = checkHospice([P('A', '2026-06-01', { f2f: '' })], { asOf, warnDays: 45 });
  assert.deepEqual(ahead.items.map((i) => [i.status, i.period, i.date]), [['f2f_due', 3, '2026-11-28']]);
});

test('cap: new elections in the cap year count one each, shares override, transfers count zero', () => {
  const ps = [P('A', '2025-10-05', { paid: 30000 }), P('B', '2026-03-01', { paid: 30000 }), P('C', '2026-03-01', { first: 3, paid: 10000 }), P('D', '2026-03-01', { share: 0.5, paid: 5000 }), P('E', '2024-03-01', { paid: 1000 })];
  const r = checkHospice(ps, { asOf, warnDays: 0, capAmount: 30000, capYear: 2026 });
  assert.equal(r.cap.beneficiaries, 2.5); assert.equal(r.cap.limit, 75000); assert.equal(r.cap.paid, 76000);
  assert.deepEqual(r.items.filter((i) => i.status.startsWith('cap')).map((i) => [i.status, i.amount]), [['cap_over', 1000]]);
  assert.equal(checkHospice(ps, { asOf, warnDays: 0 }).cap, null, 'no cap amount, no cap check');
});

test('live discharge rate over the last 12 months', () => {
  const r = checkHospice([P('A', '2026-01-01', { dc: '2026-05-01', reason: 'revoked', notr: '2026-05-02' }), P('B', '2026-01-01', { dc: '2026-05-01', reason: 'died' }), P('C', '2025-01-01', { dc: '2025-05-01', reason: 'revoked', notr: '2025-05-02' })], { asOf, warnDays: 0, liveDischargePct: 40 });
  assert.deepEqual(r.items.filter((i) => i.status === 'live_discharge_high').map((i) => [i.live, i.discharges, i.rate]), [[1, 2, 50]]);
});
