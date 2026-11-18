// Domain checks: credential dates, roles, states and shifts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCredentials, credKey } from '../src/logic.js';

const C = (id, cred, exp, o = {}) => ({ person_id: id, name: `Staff ${id}`, role: o.role || 'RN', credential: cred, state: o.state || '', expires: exp, verified_on: o.ver ?? '2026-06-01', compact: o.compact || '' });
const asOf = '2026-11-15';
const st = (r) => r.items.map((i) => [i.person_id, i.status, i.credential]);

test('credential names match loosely', () => { assert.equal(credKey('R.N. License'), credKey('rn-license')); });

test('expired, expiring inside the warning window and fine', () => {
  const r = checkCredentials([C('A', 'BLS', '2026-11-14'), C('B', 'BLS', '2027-01-14'), C('C', 'BLS', '2027-01-15')], [], [], { asOf, warnDays: 60 });
  assert.deepEqual(st(r), [['A', 'expired', 'BLS'], ['B', 'expiring_soon', 'BLS']]);
});

test('a renewal row replaces the old one', () => {
  assert.deepEqual(checkCredentials([C('A', 'BLS', '2026-01-01'), C('A', 'BLS', '2028-01-01')], [], [], { asOf }).items, []);
});

test('shifts after the expiry date (and not after as-of) make it worked_expired', () => {
  const r = checkCredentials([C('A', 'RN License', '2026-10-31')], [], [{ person_id: 'A', date: '2026-10-31' }, { person_id: 'A', date: '2026-11-01' }, { person_id: 'A', date: '2026-12-01' }], { asOf });
  assert.equal(r.items[0].status, 'worked_expired'); assert.equal(r.items[0].shifts, 1, 'the expiry day itself is still valid; a future shift is not counted');
});

test('required credentials per role, from the roster, ignoring terminated staff', () => {
  const r = checkCredentials([C('A', 'RN License', '2028-01-01')], [{ person_id: 'A', role: 'R.N.', status: 'Active' }, { person_id: 'B', role: 'RN', status: 'Terminated' }], [], { asOf, requiredByRole: { RN: ['RN License', 'BLS'] } });
  assert.deepEqual(st(r), [['A', 'missing_required', 'BLS']]);
});

test('verification: never, stale after the limit, and skipped on an expired credential', () => {
  const r = checkCredentials([C('A', 'BLS', '2028-01-01', { ver: '' }), C('B', 'BLS', '2028-01-01', { ver: '2025-11-14' }), C('C', 'BLS', '2028-01-01', { ver: '2025-11-15' }), C('D', 'BLS', '2026-01-01', { ver: '' })], [], [], { asOf, verifyDays: 365 });
  assert.deepEqual(st(r), [['D', 'expired', 'BLS'], ['A', 'never_verified', 'BLS'], ['B', 'verification_stale', 'BLS']]);
});

test('state licenses: single-state must match the work state; multistate covers other compact states only', () => {
  const opts = { asOf, compactStates: ['TX', 'AZ'], stateLicensed: ['RN License'] };
  const roster = (ws) => [{ person_id: 'A', role: 'RN', work_state: ws }];
  assert.equal(checkCredentials([C('A', 'RN License', '2028-01-01', { state: 'AZ', compact: 'yes' })], roster('TX'), [], opts).items.length, 0);
  assert.equal(checkCredentials([C('A', 'RN License', '2028-01-01', { state: 'AZ', compact: 'no' })], roster('TX'), [], opts).items[0].status, 'wrong_state');
  assert.equal(checkCredentials([C('A', 'RN License', '2028-01-01', { state: 'AZ', compact: 'yes' })], roster('CA'), [], opts).items[0].status, 'wrong_state');
  assert.equal(checkCredentials([C('A', 'RN License', '2028-01-01', { state: 'AZ' }), C('A', 'RN License', '2028-01-01', { state: 'CA' })], roster('CA'), [], opts).items.length, 0, 'a second license for the work state covers it');
});

test('a work state seen only on a shift is checked too', () => {
  const r = checkCredentials([C('A', 'RN License', '2028-01-01', { state: 'TX', compact: 'no' })], [], [{ person_id: 'A', date: '2026-11-01', work_state: 'OK' }], { asOf, stateLicensed: ['RN License'] });
  assert.equal(r.items[0].status, 'wrong_state'); assert.equal(r.items[0].work_state, 'OK');
});
