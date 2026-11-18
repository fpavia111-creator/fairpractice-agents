// Domain checks: ABA units, authorizations, roles and supervision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAba, unitsFor } from '../src/logic.js';

const S = (pid, date, cpt, mins, units, role = 'RBT', o = {}) => ({ patient_id: pid, date, cpt, minutes: mins, units, provider_role: role, auth_number: o.auth || '' });
const A = (pid, num, o = {}) => ({ patient_id: pid, auth_number: num, cpt: o.cpt ?? '', units: o.units ?? 1000, weekly_units: o.weekly ?? '', start: o.start || '2026-01-01', end: o.end || '2026-12-31' });
const asOf = '2026-11-15'; const opts = { asOf, supervisionPct: 0, warnDays: 0 };
const st = (r) => r.items.map((i) => [i.status, i.date]);

test('units: one unit from 8 minutes, two from 23', () => {
  assert.deepEqual([7, 8, 22, 23, 37, 38, 120].map((m) => unitsFor(m)), [0, 1, 1, 2, 2, 3, 8]);
});

test('no authorization: none for the client, the date or the code', () => {
  const r = checkAba([S('X', '2026-03-01', '97153', 60, 4), S('P', '2027-01-02', '97153', 60, 4), S('P', '2026-03-01', '97155', 60, 4, 'BCBA')], [A('P', 'A1', { cpt: '97153' })], opts);
  assert.deepEqual(r.items.map((i) => i.status), ['no_auth', 'no_auth', 'no_auth']);
});

test('total authorization: only the units past the total are flagged, in date order', () => {
  const r = checkAba([S('P', '2026-03-02', '97153', 120, 8), S('P', '2026-03-01', '97153', 120, 8)], [A('P', 'A1', { units: 10 })], opts);
  assert.deepEqual(st(r), [['over_auth_total', '2026-03-02']]); assert.equal(r.items[0].over_units, 6);
});

test('weekly limit by Monday-start week', () => {
  const r = checkAba([S('P', '2026-11-08', '97153', 120, 8), S('P', '2026-11-09', '97153', 120, 8), S('P', '2026-11-10', '97153', 120, 8)], [A('P', 'A1', { weekly: 12 })], opts);
  assert.deepEqual(st(r), [['over_weekly', '2026-11-10']], 'Sunday the 8th belongs to the week before');
});

test('units over minutes, and units filled from minutes when blank', () => {
  const r = checkAba([S('P', '2026-03-01', '97153', 52, 4), S('P', '2026-03-02', '97153', 53, '')], [A('P', 'A1')], opts);
  assert.deepEqual(st(r), [['units_over_minutes', '2026-03-01']]);
});

test('codes for qualified professionals billed by a technician', () => {
  assert.deepEqual(checkAba([S('P', '2026-03-01', '97155', 60, 4, 'Registered Behavior Technician')], [A('P', 'A1')], opts).items.map((i) => i.status), ['wrong_provider_role']);
  assert.deepEqual(checkAba([S('P', '2026-03-01', '97155', 60, 4, 'BCBA-D')], [A('P', 'A1')], opts).items, []);
});

test('supervision: BCBA supervision minutes over technician direct minutes per client and month', () => {
  const sessions = [S('P', '2026-03-02', '97153', 600, 40), S('P', '2026-03-03', '97155', 30, 2, 'BCBA'), S('P', '2026-04-02', '97153', 600, 40), S('P', '2026-04-03', '97155', 60, 4, 'BCBA')];
  const r = checkAba(sessions, [A('P', 'A1')], { ...opts, supervisionPct: 10 });
  assert.deepEqual(r.items.map((i) => [i.status, i.month, i.supervision_pct]), [['supervision_low', '2026-03', 5]]);
});

test('authorizations ending soon with units unused', () => {
  const r = checkAba([S('P', '2026-11-01', '97153', 60, 4)], [A('P', 'A1', { units: 100, end: '2026-11-30' }), A('P', 'A2', { units: 100, end: '2027-01-31', start: '2027-01-01' })], { asOf, supervisionPct: 0, warnDays: 30, unusedPct: 25 });
  assert.deepEqual(r.items.map((i) => [i.status, i.units_left]), [['auth_ending_unused', 96]]);
});
