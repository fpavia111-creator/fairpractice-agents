// Domain checks: product units, JW/JZ, application codes, invoices and cost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWound, applicationCodes } from '../src/logic.js';

const C = (pid, cpt, units, mods = '', paid = '', date = '2026-03-01') => ({ patient_id: pid, date, cpt, modifiers: mods, units, paid });
const U = (pid, product, lot, opened, applied, area = '', date = '2026-03-01') => ({ patient_id: pid, date, product, lot, opened, applied, wound_area: area });
const I = (product, lot, size, cost) => ({ product, lot, size, cost, invoice: 'X' });
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('application codes by wound area', () => {
  assert.deepEqual([10, 25, 26, 99, 100, 201].map((a) => applicationCodes(a)), [{ 15271: 1 }, { 15271: 1 }, { 15271: 1, 15272: 1 }, { 15271: 1, 15272: 3 }, { 15273: 1 }, { 15273: 1, 15274: 2 }]);
  assert.deepEqual(applicationCodes(30, true), { 15275: 1, 15276: 1 });
});

test('correct billing raises nothing: applied plus JW for the waste, JZ when nothing is wasted', () => {
  const r = checkWound([C('A', 'Q4101', 12, '', 900), C('A', 'Q4101', 4, 'JW', 300), C('A', '15271', 1), C('B', 'Q4101', 16, 'JZ', 1200), C('B', '15271', 1)], [U('A', 'Q4101', 'L1', 16, 12, 12), U('B', 'Q4101', 'L2', 16, 16, 16)], [I('Q4101', 'L1', 16, 1200), I('Q4101', 'L2', 16, 1200)]);
  assert.deepEqual(r.items, []);
});

test('waste modifiers: JW units must equal the waste, no JZ with waste, JZ needed without waste', () => {
  const r = checkWound([C('A', 'Q4101', 12), C('A', 'Q4101', 2, 'JW'), C('B', 'Q4101', 16, 'JZ'), C('D', 'Q4101', 16), C('E', 'Q4101', 12, 'JZ'), C('E', 'Q4101', 4, 'JW')], [U('A', 'Q4101', 'L1', 16, 12), U('B', 'Q4101', 'L1', 16, 12), U('D', 'Q4101', 'L1', 16, 16), U('E', 'Q4101', 'L1', 16, 16)], [I('Q4101', 'L1', 16, 1200)]);
  assert.deepEqual(r.items.filter((i) => i.status === 'waste_modifier_wrong').map((i) => [i.patient_id, i.problems.length]), [['A', 1], ['B', 2], ['D', 1], ['E', 1]]);
});

test('units over the product opened, with the share of payment at risk', () => {
  const r = checkWound([C('A', 'Q4101', 20, 'JZ', 1000), C('A', '15271', 1)], [U('A', 'Q4101', 'L1', 16, 16, 16)], [I('Q4101', 'L1', 16, 800)]);
  assert.deepEqual(r.items.map((i) => [i.status, i.over_units, i.amount]), [['units_over_opened', 4, 200]]);
});

test('no invoice by lot, or by product code when no usage is recorded', () => {
  const r = checkWound([C('A', 'Q4101', 16, 'JZ', 500), C('A', '15271', 1), C('B', 'Q4186', 10, 'JZ', 300), C('B', '15271', 1)], [U('A', 'Q4101', 'L9', 16, 16, 16)], [I('Q4101', 'L1', 16, 1200)]);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.lots]), [['no_invoice', 'A', 'L9'], ['no_invoice', 'B', 'Q4186']]);
});

test('application codes: wrong for the area, or billed with no product', () => {
  const r = checkWound([C('A', 'Q4101', 16, 'JZ'), C('A', '15273', 1), C('B', '15271', 1)], [U('A', 'Q4101', 'L1', 16, 16, 40)], [I('Q4101', 'L1', 16, 1200)]);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.expected]), [['application_mismatch', 'A', '15271×1 15272×1'], ['application_mismatch', 'B', 'a product line the same day']]);
});

test('paid below cost uses the invoice cost per sq cm times the size opened', () => {
  const r = checkWound([C('A', 'Q4101', 8, '', 500), C('A', 'Q4101', 2, 'JW', 100), C('A', '15271', 1)], [U('A', 'Q4101', 'L1', 10, 8, 8)], [I('Q4101', 'L1', 20, 1600)]);
  assert.deepEqual(r.items.map((i) => [i.status, i.cost, i.amount]), [['paid_below_cost', 800, 200]]);
});
