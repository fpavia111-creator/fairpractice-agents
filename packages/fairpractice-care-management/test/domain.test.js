// Domain checks: care management thresholds, add-ons, consent, overlaps and unbilled time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCareManagement, supportedCodes } from '../src/logic.js';

const T = (pid, minutes, program = 'CCM', who = 'RN', date = '2026-10-05') => ({ patient_id: pid, date, minutes, program, staff_type: who });
const C = (pid, cpt, units = 1, date = '2026-10-31') => ({ patient_id: pid, date, cpt, units });
const P = (pid, consent = '2026-01-01', other = '') => ({ patient_id: pid, consent_date: consent, other_practice_months: other });
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('supported codes by program and minutes', () => {
  assert.deepEqual([19, 20, 40, 80].map((m) => supportedCodes('CCM', m)), [{}, { 99490: 1 }, { 99490: 1, 99439: 1 }, { 99490: 1, 99439: 2 }]);
  assert.deepEqual([supportedCodes('PCM', 65), supportedCodes('BHI', 20)], [{ 99426: 1, 99427: 1 }, { 99484: 1 }]);
});

test('thresholds: staff codes count staff and practitioner time, practitioner codes only practitioner time', () => {
  const r = checkCareManagement([T('A', 10), T('A', 10, 'CCM', 'MD'), T('B', 25, 'CCM', 'RN'), T('B', 10, 'CCM', 'NP')], [C('A', '99490'), C('B', '99491')], [P('A'), P('B')]);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.minutes]), [['under_threshold', 'B', 10]]);
});

test('add-ons: over the time, over the monthly maximum, or without the base code', () => {
  const r = checkCareManagement([T('A', 45), T('B', 90), T('C', 30)], [C('A', '99490'), C('A', '99439', 2), C('B', '99490'), C('B', '99439', 3), C('C', '99439')], [P('A'), P('B'), P('C')]);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.supported ?? i.needed]), [['under_threshold', 'C', '99490 billed first'], ['addon_over', 'A', 1], ['addon_over', 'B', 2]]);
});

test('consent after the month, another practice billing CCM, and CCM with PCM', () => {
  const r = checkCareManagement([T('A', 25), T('B', 25), T('D', 25), T('D', 35, 'PCM')], [C('A', '99490'), C('B', '99490'), C('D', '99490'), C('D', '99426')], [P('A', '2026-11-02'), P('B', '2026-01-01', '2026-09; 2026-10'), P('D')]);
  assert.deepEqual(st(r), [['no_consent', 'A'], ['other_practice', 'B'], ['overlap_codes', 'D']]);
});

test('BHI may be billed with CCM; unbilled time only with consent and nothing else billed in the program', () => {
  const r = checkCareManagement([T('A', 25), T('A', 25, 'BHI'), T('B', 45), T('C', 45), T('D', 25, 'BHI'), T('D', 25)], [C('A', '99490'), C('A', '99484'), C('D', '99490')], [P('A'), P('B'), P('C', ''), P('D')], { rates: { 99490: 60, 99439: 47, 99484: 48 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.program, i.amount]), [['unbilled_time', 'B', 'CCM', 107], ['unbilled_time', 'D', 'BHI', 48]]);
});

test('a month filter keeps only that month', () => {
  const r = checkCareManagement([T('A', 10, 'CCM', 'RN', '2026-09-05'), T('A', 25)], [C('A', '99490', 1, '2026-09-30'), C('A', '99490')], [P('A')], { month: '2026-10' });
  assert.deepEqual(r.items, []); assert.equal(r.patient_months, 1);
});
