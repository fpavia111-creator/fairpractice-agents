// Domain checks: course rules by role, state and hire date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTraining, courseKey, applies } from '../src/logic.js';

const P = (id, o = {}) => ({ person_id: id, name: `Staff ${id}`, role: o.role || 'Biller', department: 'Billing', hire_date: o.hire || '2020-01-01', work_state: o.state || 'TX', status: o.status || 'Active' });
const C = (id, course, d) => ({ person_id: id, course, completed: d });
const asOf = '2026-11-15';
const HIPAA = { course: 'HIPAA', every_days: 365, new_hire_days: 30 };
const st = (r) => r.items.map((i) => [i.person_id, i.status, i.course]);

test('course names: case, punctuation and & vs and', () => { assert.equal(courseKey('Fraud, Waste & Abuse'), courseKey('fraud waste and abuse')); });

test('roles and states limit who needs a course', () => {
  assert.equal(applies({ course: 'x', states: ['TX'] }, { work_state: 'tx' }), true);
  assert.equal(applies({ course: 'x', states: ['TX'] }, { work_state: 'OK' }), false);
  assert.equal(applies({ course: 'x', roles: ['Physician'] }, { role: 'Biller' }), false);
});

test('refresher: overdue the day after the interval, due soon inside the warning window', () => {
  const r = checkTraining([C('A', 'HIPAA', '2025-11-14'), C('B', 'HIPAA', '2025-12-01'), C('C', 'HIPAA', '2026-01-01')], [P('A'), P('B'), P('C')], [HIPAA], { asOf, warnDays: 30 });
  assert.deepEqual(st(r), [['A', 'refresher_overdue', 'HIPAA'], ['B', 'due_soon', 'HIPAA']]);
});

test('new hires get days from hire; long-time staff with nothing are never_completed', () => {
  const r = checkTraining([], [P('N', { hire: '2026-10-01' }), P('M', { hire: '2026-11-01' }), P('O', { hire: '2015-01-01' })], [HIPAA], { asOf, warnDays: 30 });
  assert.deepEqual(st(r), [['N', 'new_hire_overdue', 'HIPAA'], ['O', 'never_completed', 'HIPAA'], ['M', 'due_soon', 'HIPAA']]);
});

test('aliases count, the newest completion wins, completions after as-of do not count, terminated staff are skipped', () => {
  const course = { ...HIPAA, aliases: ['HIPAA Basics'] };
  const r = checkTraining([C('A', 'HIPAA Basics', '2026-06-01'), C('B', 'HIPAA', '2024-01-01'), C('B', 'HIPAA', '2026-06-01'), C('C', 'HIPAA', '2026-12-01')], [P('A'), P('B'), P('C'), P('D', { status: 'Terminated' })], [course], { asOf });
  assert.deepEqual(st(r), [['C', 'never_completed', 'HIPAA']]);
});

test('a one-time course (no refresher) is done once done', () => {
  assert.deepEqual(checkTraining([C('A', 'Orientation', '2019-01-01')], [P('A')], [{ course: 'Orientation' }], { asOf }).items, []);
});
