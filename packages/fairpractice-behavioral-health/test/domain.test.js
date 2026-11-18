// Domain checks: psychotherapy time codes, add-ons, crisis time, yearly limits and license rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBehavioral, timeCode, crisisAddOnUnits } from '../src/logic.js';

const S = (pid, date, cpt, minutes, o = {}) => ({ patient_id: pid, date, cpt, minutes, units: o.units ?? 1, provider: o.prov || 'A', license: o.lic ?? 'LCSW', payer: o.payer || 'Bluepeak', allowed: o.allowed ?? '' });
const st = (r) => r.items.map((i) => [i.status, i.cpt, i.date]);

test('time codes: 16-37, 38-52, 53+; add-on family kept', () => {
  assert.deepEqual([15, 16, 37, 38, 52, 53, 90].map((m) => timeCode(m)), [null, '90832', '90832', '90834', '90834', '90837', '90837']);
  assert.deepEqual([20, 40, 60].map((m) => timeCode(m, true)), ['90833', '90836', '90838']);
});

test('wrong time code and under 16 minutes, with the dollar difference', () => {
  const r = checkBehavioral([S('P', '2026-03-01', '90837', 45), S('P', '2026-03-02', '90832', 12), S('P', '2026-03-03', '90834', 40)], { rates: { '90837': 150, '90834': 110, '90832': 75 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.expected, i.amount]), [['wrong_time_code', 'none (under 16 minutes)', 75], ['wrong_time_code', '90834', 40]]);
});

test('add-ons need their base code the same day by the same provider', () => {
  const r = checkBehavioral([S('P', '2026-03-01', '99213', 20, { lic: 'NP' }), S('P', '2026-03-01', '90833', 20, { lic: 'NP' }), S('P', '2026-03-02', '90836', 40, { lic: 'NP' }), S('P', '2026-03-03', '99213', 20, { lic: 'NP', prov: 'B' }), S('P', '2026-03-03', '90833', 20, { lic: 'NP' }), S('P', '2026-03-04', '90785', null), S('P', '2026-03-05', '90834', 40), S('P', '2026-03-05', '90785', null)]);
  assert.deepEqual(st(r), [['addon_without_base', '90836', '2026-03-02'], ['addon_without_base', '90833', '2026-03-03'], ['addon_without_base', '90785', '2026-03-04']]);
});

test('crisis: 90840 units past the first 74 minutes, under 30 minutes, and psychotherapy the same day', () => {
  assert.deepEqual([74, 75, 104, 105, 134, 135].map(crisisAddOnUnits), [0, 1, 1, 2, 2, 3]);
  const r = checkBehavioral([S('P', '2026-03-01', '90839', 100), S('P', '2026-03-01', '90840', null, { units: 2 }), S('Q', '2026-03-01', '90839', 20), S('R', '2026-03-01', '90839', 60), S('R', '2026-03-01', '90834', 40), S('T', '2026-03-01', '90840', null)], { rates: { '90840': 75 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.amount]), [['addon_without_base', 'T', 75], ['crisis_time', 'P', 75], ['crisis_time', 'Q', 0], ['crisis_time', 'R', 0]]);
});

test('license rules: prescriber codes and wildcards; unknown licenses are not flagged', () => {
  const r = checkBehavioral([S('P', '2026-03-01', '99214', 25, { lic: 'LPC' }), S('P', '2026-03-02', '99214', 25, { lic: 'PMHNP-BC' }), S('P', '2026-03-03', '96130', 60, { lic: 'PsyD' }), S('P', '2026-03-04', '96130', 60, { lic: 'LMHC' }), S('P', '2026-03-05', '99214', 25, { lic: '' })]);
  assert.deepEqual(r.items.map((i) => [i.status, i.cpt, i.license]), [['license_cannot_bill', '99214', 'LPC'], ['license_cannot_bill', '96130', 'LPC']]);
});

test('yearly limits count one session per client per day, per payer and year', () => {
  const ss = [S('P', '2026-01-01', '90834', 40, { payer: 'Cedar Mutual' }), S('P', '2026-01-01', '90785', null, { payer: 'Cedar Mutual' }), S('P', '2026-01-08', '90834', 40, { payer: 'Cedar Mutual' }), S('P', '2026-01-15', '90834', 40, { payer: 'Cedar Mutual', allowed: 100 }), S('P', '2027-01-01', '90834', 40, { payer: 'Cedar Mutual' }), S('Q', '2026-01-15', '90834', 40, { payer: 'Other' })];
  const r = checkBehavioral(ss, { yearlyLimits: { 'Cedar Mutual': 2 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.date, i.session_number, i.amount]), [['over_yearly_limit', '2026-01-15', 3, 100]]);
});
