// Domain checks: yearly, seasonal and new-hire requirements; declinations and follow-ups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStaffHealth, nextDue } from '../src/logic.js';

const R = (id, item, done, o = {}) => ({ person_id: id, name: `Staff ${id}`, item, done_on: done, result: o.result || '', declined: o.declined || '', form_on_file: o.form || '', followup_on: o.fu || '' });
const S = (id, o = {}) => ({ person_id: id, name: `Staff ${id}`, role: o.role || 'RN', department: o.dept || 'ICU', hire_date: o.hire || '2020-01-01', status: o.status || 'Active' });
const asOf = '2026-11-15';
const st = (r) => r.items.map((i) => [i.person_id, i.status, i.item]);
const TB = { item: 'TB test', every_days: 365, new_hire_days: 0 };
const FLU = { item: 'Flu vaccine', season_start: '08-01', due_by: '11-01', declination_allowed: true };

test('seasonal due date: done this season clears it; last season does not; the season rolls over in August', () => {
  assert.equal(nextDue(FLU, '2026-08-01', asOf).due, null);
  assert.equal(nextDue(FLU, '2026-07-31', asOf).due, '2026-11-01');
  assert.equal(nextDue(FLU, null, '2026-07-15').due, '2025-11-01', 'in July the 2025 season still applies');
});

test('a season that crosses the new year puts the due date in the next year', () => {
  assert.equal(nextDue({ item: 'x', season_start: '10-01', due_by: '03-31' }, null, '2026-11-15').due, '2027-03-31');
});

test('yearly items: overdue after every_days, due soon inside the warning window', () => {
  const r = checkStaffHealth([R('A', 'TB test', '2025-11-14'), R('B', 'TB test', '2025-12-10'), R('C', 'TB test', '2026-06-01')], [S('A'), S('B'), S('C')], [TB], { asOf, warnDays: 30 });
  assert.deepEqual(st(r), [['A', 'overdue', 'TB test'], ['B', 'due_soon', 'TB test']]);
});

test('new hires get their deadline from the hire date; staff with no hire date and no record are never_done', () => {
  const r = checkStaffHealth([], [S('N', { hire: '2026-11-01' }), S('F', { hire: '2026-12-20' }), { person_id: 'X', name: 'X' }, S('O', { hire: '2019-01-01' })], [TB], { asOf, warnDays: 30 });
  assert.deepEqual(st(r), [['N', 'new_hire_late', 'TB test'], ['O', 'never_done', 'TB test'], ['X', 'never_done', 'TB test']], 'hired years ago with nothing on file is never_done');
});

test('roles limit a requirement; terminated staff are skipped', () => {
  const FIT = { item: 'Fit test', roles: ['RN'] };
  const r = checkStaffHealth([], [S('A', { role: 'Registrar' }), S('B', { role: 'R.N.' }), S('C', { status: 'Terminated' })], [FIT], { asOf });
  assert.deepEqual(st(r), [['B', 'never_done', 'Fit test']]);
});

test('declinations: allowed with a form is fine, without a form is flagged, not allowed is overdue', () => {
  const recs = [R('A', 'Flu vaccine', '2026-10-01', { declined: 'yes', form: 'yes' }), R('B', 'Flu vaccine', '2026-10-01', { declined: 'yes' })];
  assert.deepEqual(st(checkStaffHealth(recs, [S('A'), S('B')], [FLU], { asOf })), [['B', 'declined_no_form', 'Flu vaccine']]);
  const r = checkStaffHealth([R('A', 'TB test', '2026-10-01', { declined: 'yes', form: 'yes' })], [S('A')], [TB], { asOf });
  assert.equal(r.items[0].status, 'overdue'); assert.match(r.items[0].message, /do not allow a declination/);
});

test('a result flagged positive needs a follow-up date; with one it is fine', () => {
  assert.equal(checkStaffHealth([R('A', 'TB test', '2026-10-01', { result: 'Positive' })], [S('A')], [TB], { asOf }).items[0].status, 'needs_followup');
  assert.deepEqual(checkStaffHealth([R('A', 'TB test', '2026-10-01', { result: 'Positive', fu: '2026-10-05' })], [S('A')], [TB], { asOf }).items, []);
});

test('records dated after as-of are ignored', () => {
  assert.equal(checkStaffHealth([R('A', 'TB test', '2026-12-01')], [S('A')], [TB], { asOf }).items[0].status, 'never_done');
});
