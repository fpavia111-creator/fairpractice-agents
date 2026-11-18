// Domain checks: secondary claims, filing windows, payer order and early secondaries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSecondary, orderOf } from '../src/logic.js';

const C = (id, pid, payer, order, o = {}) => ({ claim_id: id, patient_id: pid, dos: o.dos || '2026-09-01', payer, order, billed: o.billed ?? 300, paid: o.paid ?? '', patient_resp: o.pr ?? '', sent_date: o.sent || '2026-09-02', adjudicated_date: o.adj || '', eob_attached: o.eob || '' });
const COV = (pid, payer, order, o = {}) => ({ patient_id: pid, payer, order, effective: o.eff || '2025-01-01', term: o.term || '' });
const cov = (pid) => [COV(pid, 'Bluepeak', 'Primary'), COV(pid, 'Cedar', 'Secondary')];
const asOf = '2026-11-15'; const opts = { asOf, filingDays: { default: 90 }, warnDays: 21 };
const st = (r) => r.items.map((i) => [i.status, i.claim_id]);

test('payer order words', () => {
  assert.deepEqual(['P', 'primary', '2nd', 'Tertiary', '3', 'x'].map(orderOf), [1, 1, 2, 3, 3, null]);
});

test('the next payer is due a claim when a balance is left, with the window from adjudication', () => {
  const r = checkSecondary([C('A', 'A', 'Bluepeak', 1, { adj: '2026-10-01', pr: 50 }), C('B', 'B', 'Bluepeak', 1, { adj: '2026-08-01', pr: 50 }), C('D', 'D', 'Bluepeak', 1, { adj: '2026-11-01', pr: 50 }), C('E', 'E', 'Bluepeak', 1, { adj: '2026-11-01', pr: 0 }), C('F', 'F', 'Bluepeak', 1, { adj: '2026-11-01', billed: 300, paid: 300 })], [...cov('A'), ...cov('B'), ...cov('D'), ...cov('E'), ...cov('F')], { ...opts, filingDays: { default: 60 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.claim_id, i.due]), [['filing_missed', 'B', '2026-09-30'], ['filing_closing', 'A', '2026-11-30'], ['secondary_not_sent', 'D', '2026-12-31']]);
});

test('balance falls back to billed minus paid; no next coverage, no finding', () => {
  const r = checkSecondary([C('A', 'A', 'Bluepeak', 1, { adj: '2026-11-01', billed: 300, paid: 200 }), C('B', 'B', 'Bluepeak', 1, { adj: '2026-11-01', pr: 50 })], [...cov('A'), COV('B', 'Bluepeak', 'Primary')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.claim_id, i.balance]), [['secondary_not_sent', 'A', 100]]);
});

test('wrong payer order against coverage on the date of service', () => {
  const r = checkSecondary([C('A', 'A', 'Cedar', 1), C('B', 'B', 'Cedar', 1, { dos: '2024-06-01' })], [...cov('A'), COV('B', 'Cedar', 'Secondary', { eff: '2025-01-01' }), COV('B', 'Cedar', 'Primary', { eff: '2024-01-01', term: '2024-12-31' })], opts);
  assert.deepEqual(st(r), [['wrong_payer_order', 'A']]);
});

test('secondary sent before the primary adjudicated, without its EOB, or with no primary on file', () => {
  const r = checkSecondary([C('A1', 'A', 'Bluepeak', 1, { adj: '2026-09-20', pr: 0 }), C('A2', 'A', 'Cedar', 2, { sent: '2026-09-10' }), C('B1', 'B', 'Bluepeak', 1, { adj: '2026-09-20', pr: 0 }), C('B2', 'B', 'Cedar', 2, { sent: '2026-09-25', eob: 'No' }), C('D2', 'D', 'Cedar', 2), C('E1', 'E', 'Bluepeak', 1, { adj: '2026-09-20', pr: 0 }), C('E2', 'E', 'Cedar', 2, { sent: '2026-09-25', eob: 'Yes' })], [...cov('A'), ...cov('B'), ...cov('D'), ...cov('E')], opts);
  assert.deepEqual(st(r), [['sent_without_primary_eob', 'A2'], ['sent_without_primary_eob', 'B2'], ['sent_without_primary_eob', 'D2']]);
});
