// Domain checks: weekly hours against plans of care.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCarePlans } from '../src/logic.js';

const P = (cid, weekly, o = {}) => ({ client_id: cid, service: o.svc ?? 'T1019', weekly_hours: weekly, start: o.start || '2026-01-01', end: o.end || '', auth_number: o.auth || 'A1' });
const V = (cid, date, hours, svc = 'T1019') => ({ client_id: cid, date, service: svc, hours });
const asOf = '2026-11-15'; const opts = { asOf, weeks: 1, rates: { T1019: 20 } };
const st = (r) => r.items.map((i) => [i.status, i.client_id]);

test('weeks checked end with the last full week on or before as_of', () => {
  assert.deepEqual(checkCarePlans([], [], { asOf: '2026-11-15', weeks: 2 }).weeks_checked, { from: '2026-11-02', to: '2026-11-09' });
  assert.deepEqual(checkCarePlans([], [], { asOf: '2026-11-14', weeks: 1 }).weeks_checked, { from: '2026-11-02', to: '2026-11-02' });
});

test('on plan raises nothing; minutes and clock times count', () => {
  const r = checkCarePlans([P('A', 10)], [V('A', '2026-11-09', 5), { client_id: 'A', date: '2026-11-10', service: 'T1019', minutes: 180 }, { client_id: 'A', date: '2026-11-11', service: 'T1019', clock_in: '09:00', clock_out: '11:00' }], opts);
  assert.deepEqual(r.items, []);
});

test('over and under the weekly authorization, priced by the hourly rate', () => {
  const r = checkCarePlans([P('A', 10), P('B', 10), P('D', 10)], [V('A', '2026-11-09', 12), V('B', '2026-11-09', 7), V('D', '2026-11-09', 8.5)], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.client_id, i.amount, i.missed ?? null]), [['over_delivered', 'A', 40, null], ['under_delivered', 'B', 0, 60]]);
});

test('weeks the plan only partly covers are not judged', () => {
  const r = checkCarePlans([P('A', 10, { start: '2026-11-11' }), P('B', 10, { end: '2026-11-12' })], [V('A', '2026-11-12', 1), V('B', '2026-11-10', 1)], { ...opts, warnDays: 0 });
  assert.deepEqual(r.items, []);
});

test('services with no plan, by client, service and dates', () => {
  const r = checkCarePlans([P('A', 10), P('B', 10, { end: '2026-11-01' })], [V('A', '2026-11-09', 10), V('A', '2026-11-10', 2, 'S5150'), V('B', '2026-11-10', 3), V('C', '2026-11-10', 3)], { ...opts, warnDays: 0 });
  assert.deepEqual(st(r), [['not_on_plan', 'B'], ['not_on_plan', 'C'], ['not_on_plan', 'A']]);
});

test('plans ending soon unless a later plan for the same service exists', () => {
  const r = checkCarePlans([P('A', 10, { end: '2026-12-01' }), P('B', 10, { end: '2026-12-01' }), P('B', 10, { start: '2026-12-02' }), P('D', 10, { end: '2027-03-01' })], [V('A', '2026-11-09', 10), V('B', '2026-11-09', 10), V('D', '2026-11-09', 10)], { ...opts, warnDays: 30 });
  assert.deepEqual(st(r), [['plan_ending', 'A']]);
});
