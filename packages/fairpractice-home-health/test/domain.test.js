// Domain checks: notices of admission, overlaps, stray visits and low-utilization periods.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHomeHealth, noaReduction } from '../src/logic.js';

const P = (id, start, o = {}) => ({ patient_id: id, start, end: o.end || '', admission: o.adm ?? 'Y', noa_filed: o.noa ?? start, lupa_threshold: o.th ?? 1, payment: o.pay ?? 3000 });
const V = (id, date) => ({ patient_id: id, date, discipline: 'SN' });
const asOf = '2026-11-15'; const opts = { asOf };
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('late NOA cut is a thirtieth per day, capped at the payment', () => {
  assert.deepEqual([[3000, 6], [3000, 0], [3000, 45]].map(([p, d]) => noaReduction(p, d)), [600, 0, 3000]);
});

test('NOA: day 5 is on time, day 6 is late, none filed after the due date is missing', () => {
  const r = checkHomeHealth([P('A', '2026-11-01', { noa: '2026-11-06' }), P('B', '2026-11-01', { noa: '2026-11-07' }), P('C', '2026-11-01', { noa: '' }), P('D', '2026-11-12', { noa: '' })], [V('A', '2026-11-01'), V('B', '2026-11-01'), V('C', '2026-11-01'), V('D', '2026-11-12')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.late_days, i.amount]), [['noa_missing', 'C', 14, 1400], ['noa_late', 'B', 6, 600]]);
});

test('NOA only on admission periods; with no admission column, the earliest period per patient', () => {
  const withCol = checkHomeHealth([P('A', '2026-09-01', { adm: '', noa: '' }), P('A', '2026-10-01', { noa: '2026-10-02' })], [V('A', '2026-09-02'), V('A', '2026-10-02')], opts);
  assert.deepEqual(withCol.items, []);
  const noCol = checkHomeHealth([P('A', '2026-10-01', { adm: '', noa: '' }), P('A', '2026-09-01', { adm: '', noa: '' })], [V('A', '2026-09-02'), V('A', '2026-10-02')], opts);
  assert.deepEqual(noCol.items.map((i) => [i.status, i.date]), [['noa_missing', '2026-09-01']]);
});

test('periods default to 30 days; overlaps and visits outside any period', () => {
  const r = checkHomeHealth([P('A', '2026-09-01'), P('A', '2026-09-30', { adm: '' }), P('B', '2026-09-01'), P('B', '2026-10-01', { adm: '' })], [V('A', '2026-09-02'), V('A', '2026-10-02'), V('B', '2026-09-02'), V('B', '2026-10-02'), V('B', '2026-11-05')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.overlap_days ?? i.date]), [['period_overlap', 'A', 1], ['visit_outside_period', 'B', '2026-11-05']]);
});

test('low utilization: ended under the threshold, or ending soon; the estimate uses the per-visit rate', () => {
  const ps = [P('A', '2026-09-01', { th: 4, pay: 2000 }), P('B', '2026-10-20', { th: 4 }), P('C', '2026-11-01', { th: 4 }), P('D', '2026-09-01', { th: 2 })];
  const vs = [V('A', '2026-09-02'), V('B', '2026-10-21'), V('C', '2026-11-02'), V('D', '2026-09-02'), V('D', '2026-09-03')];
  const r = checkHomeHealth(ps, vs, { asOf, perVisitRate: 150, warnDays: 7 });
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.amount]), [['lupa', 'A', 1850], ['lupa_risk', 'B', 0]]);
});
