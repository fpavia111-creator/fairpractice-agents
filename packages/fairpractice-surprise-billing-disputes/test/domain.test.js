// Domain checks: No Surprises Act clocks, QPA, fees, batching and outcomes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDisputes } from '../src/logic.js';

const D = (id, o = {}) => ({ claim_id: id, payer: o.payer || 'Bluepeak', cpt: o.cpt ?? '99285', initial_payment_date: o.initial ?? '', paid: o.paid ?? 500, qpa: o.qpa ?? 520, our_offer: o.offer ?? 1200, negotiation_sent: o.sent || '', idr_initiated: o.idr || '', outcome: o.outcome || '', award: o.award ?? '', fees_paid: o.fees ?? '' });
const st = (r) => r.items.map((i) => [i.status, i.claim_id]);

test('negotiation start: 30 business days from the initial payment, skipping weekends and federal holidays', () => {
  // 2026-09-01 + 30 business days, skipping Labor Day (Sep 7) and Columbus Day (Oct 12) = 2026-10-15
  assert.deepEqual(checkDisputes([D('A', { initial: '2026-09-01' })], { asOf: '2026-10-15' }).items.map((i) => [i.status, i.due]), [['negotiation_due_soon', '2026-10-15']]);
  assert.deepEqual(st(checkDisputes([D('A', { initial: '2026-09-01' })], { asOf: '2026-10-16' })), [['negotiation_window_missed', 'A']]);
  assert.deepEqual(checkDisputes([D('A', { initial: '2026-09-01' })], { asOf: '2026-09-15' }).items, []);
});

test('IDR start: 4 business days after the 30-business-day negotiation ends', () => {
  const d = D('A', { sent: '2026-09-28' });
  assert.deepEqual(checkDisputes([d], { asOf: '2026-11-09' }).items, [], 'negotiation still running');
  assert.deepEqual(checkDisputes([d], { asOf: '2026-11-10' }).items.map((i) => [i.status, i.negotiation_ended, i.due]), [['idr_due', '2026-11-10', '2026-11-17']], 'Veterans Day (Nov 11) is skipped');
  assert.deepEqual(st(checkDisputes([d], { asOf: '2026-11-18' })), [['idr_window_missed', 'A']]);
  assert.deepEqual(checkDisputes([{ ...d, idr_initiated: '2026-11-12' }], { asOf: '2026-11-18' }).items, []);
});

test('paid well below the QPA, and disputes worth less than the fees', () => {
  const r = checkDisputes([D('A', { paid: 400, qpa: 900 }), D('B', { paid: 480, qpa: 500 }), D('C', { paid: 250, qpa: 260, offer: 290 })], { asOf: '2026-11-15', adminFee: 115, entityFee: 350 });
  assert.deepEqual(r.items.map((i) => [i.status, i.claim_id]), [['paid_below_qpa', 'A'], ['low_value', 'C']]);
});

test('batching groups open negotiations by payer and code', () => {
  const r = checkDisputes([D('A', { sent: '2026-11-02', cpt: '99291' }), D('B', { sent: '2026-11-03', cpt: '99291' }), D('C', { sent: '2026-11-03', cpt: '99291', payer: 'Cedar' }), D('D', { sent: '2026-11-03', cpt: '99285' })], { asOf: '2026-11-15' });
  assert.deepEqual(r.items.map((i) => [i.status, i.claim_id, i.count]), [['batchable', 'A, B', 2]]);
});

test('outcomes by payer with win rate, awards above payment and fees; closed disputes raise no clock findings', () => {
  const r = checkDisputes([D('A', { initial: '2026-01-01', outcome: 'Won', award: 1000, paid: 400, fees: 465 }), D('B', { initial: '2026-01-01', outcome: 'Lost', fees: 465 }), D('C', { initial: '2026-01-01', outcome: 'Withdrawn' }), D('E', { payer: 'Cedar', sent: '2026-11-10' })], { asOf: '2026-11-15' });
  assert.deepEqual(r.items, []);
  assert.deepEqual(r.by_payer.map((p) => [p.payer, p.disputes, p.won, p.lost, p.pending, p.win_rate, p.awarded_over_paid, p.fees_paid]), [['Bluepeak', 3, 1, 1, 0, 50, 600, 930], ['Cedar', 1, 0, 0, 1, null, 0, 0]]);
});
