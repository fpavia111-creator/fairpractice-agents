// Domain checks: BAA status, reviews and vendors paid but not listed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAssociates } from '../src/logic.js';

const V = (vendor, o = {}) => ({ vendor, service: o.service || 'billing', touches_phi: o.phi ?? 'yes', baa_signed: o.baa ?? '2024-01-01', baa_expires: o.exp || '', last_review: o.rev ?? '2026-06-01' });
const asOf = '2026-11-15';
const st = (r) => r.items.map((i) => [i.vendor, i.status]);

test('a vendor with patient data needs a signed BAA; one without patient data needs nothing', () => {
  assert.deepEqual(st(checkAssociates([V('A', { baa: '' }), V('B', { phi: 'no', baa: '', rev: '' })], [], { asOf })), [['A', 'baa_missing']]);
});

test('BAA end dates: expired, ending inside the warning window, fine, or open-ended', () => {
  const r = checkAssociates([V('A', { exp: '2026-11-14' }), V('B', { exp: '2027-01-14' }), V('C', { exp: '2027-01-15' }), V('D')], [], { asOf, warnDays: 60 });
  assert.deepEqual(st(r), [['A', 'baa_expired'], ['B', 'baa_expiring']]);
});

test('reviews: never and overdue after review_days', () => {
  const r = checkAssociates([V('A', { rev: '' }), V('B', { rev: '2025-11-14' }), V('C', { rev: '2025-11-15' })], [], { asOf, reviewDays: 365 });
  assert.deepEqual(st(r), [['A', 'never_reviewed'], ['B', 'review_overdue']]);
});

test('an unknown answer is flagged only when the service sounds like patient data', () => {
  const r = checkAssociates([V('A', { phi: '', service: 'Medical transcription' }), V('B', { phi: 'unknown', service: 'landscaping' })], [], { asOf });
  assert.deepEqual(st(r), [['A', 'phi_unknown']]);
});

test('payments: matched by name without legal forms, summed per vendor, with a floor and a not-a-BA list', () => {
  const pays = [{ vendor: 'Acme Billing, Inc.', amount: '100' }, { vendor: 'Zeta Scribes', amount: '60' }, { vendor: 'Zeta Scribes', amount: '50' }, { vendor: 'Power Co', amount: '500' }, { vendor: 'Tiny Co', amount: '20' }];
  const r = checkAssociates([V('Acme Billing')], pays, { asOf, minPaid: 50, notBa: ['power co'] });
  assert.deepEqual(st(r), [['Zeta Scribes', 'paid_not_on_list']]); assert.equal(r.items[0].amount, 110);
});
