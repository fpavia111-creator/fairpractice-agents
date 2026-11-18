// Domain checks: capitation against the roster by month.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCapitation, monthsBetween } from '../src/logic.js';

const M = (id, o = {}) => ({ member_id: id, effective: o.eff || '2026-01-01', term: o.term || '', category: o.cat || 'Adult', rate: o.rate ?? '' });
const P = (id, month, amount = 32, paid = `${month}-05`) => ({ member_id: id, month, amount, paid_date: paid });
const opts = { rates: { Adult: 32, Senior: 55 } };
const st = (r) => r.items.map((i) => [i.status, i.member_id, i.month]);

test('months between, across a year end', () => {
  assert.deepEqual(monthsBetween('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('a clean roster raises nothing; a rate on the roster wins over the category', () => {
  const r = checkCapitation([M('A'), M('B', { rate: 40 })], [P('A', '2026-09'), P('B', '2026-09', 40)], opts);
  assert.deepEqual(r.items, []); assert.equal(r.expected, 72);
});

test('not paid, wrong rate, and eligibility from the first of the month', () => {
  const r = checkCapitation([M('A'), M('B', { cat: 'Senior' }), M('C', { eff: '2026-09-15' })], [P('A', '2026-08'), P('B', '2026-09', 32), P('B', '2026-08', 55)], { ...opts, from: '2026-08', to: '2026-09' });
  assert.deepEqual(r.items.map((i) => [i.status, i.member_id, i.month, i.amount]), [['not_paid', 'A', '2026-09', 32], ['wrong_rate', 'B', '2026-09', 23]]);
});

test('duplicates and payments for members not eligible; a takeback that nets to zero is fine', () => {
  const r = checkCapitation([M('A'), M('B', { term: '2026-08-31' }), M('D', { term: '2026-08-31' })], [P('A', '2026-09'), P('A', '2026-09'), P('B', '2026-09'), P('E', '2026-09'), P('D', '2026-09'), P('D', '2026-09', -32, '2026-10-05')], opts);
  assert.deepEqual(st(r).filter(([s]) => s !== 'retro_term'), [['duplicate_payment', 'A', '2026-09'], ['paid_not_eligible', 'B', '2026-09'], ['paid_not_eligible', 'E', '2026-09']]);
  assert.equal(r.to_set_aside, 96); assert.equal(r.to_dispute, 0);
});

test('retro adds and terms by paid date after the coverage month', () => {
  const r = checkCapitation([M('A', { eff: '2026-08-01' }), M('B', { term: '2026-08-31' })], [P('A', '2026-08', 32, '2026-10-05'), P('A', '2026-09', 32, '2026-10-05'), P('B', '2026-08'), P('B', '2026-09', 32), P('B', '2026-09', -32, '2026-10-05')], opts);
  assert.deepEqual(st(r), [['retro_term', 'B', '2026-09'], ['retro_add', 'A', '2026-08'], ['retro_add', 'A', '2026-09']]);
});
