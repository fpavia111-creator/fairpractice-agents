// Domain checks: APCM tiers, consent, enrollment, double billing, conflicts and unbilled months.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkApcm, tierFor } from '../src/logic.js';

const P = (pid, o = {}) => ({ patient_id: pid, conditions: o.cond ?? 2, qmb: o.qmb || '', tier: o.tier || '', consent_date: o.consent ?? '2026-01-01', start: o.start || '2026-01-01', end: o.end || '' });
const C = (pid, cpt, date = '2026-10-31', units = 1) => ({ patient_id: pid, date, cpt, units });
const opts = { month: '2026-10', rates: { G0556: 15, G0557: 50, G0558: 110, 99490: 60 } };
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('tier from conditions and QMB status', () => {
  assert.deepEqual([[0, false], [1, false], [2, false], [2, true], [1, true], [null, false]].map(([c, q]) => tierFor(c, q)), ['G0556', 'G0556', 'G0557', 'G0558', 'G0556', null]);
});

test('a clean month raises nothing; other months are ignored', () => {
  const r = checkApcm([P('A'), P('B', { qmb: 'Y' })], [C('A', 'G0557'), C('B', 'G0558'), C('B', 'G0558', '2026-09-30')], opts);
  assert.deepEqual(r.items, []);
});

test('not enrolled, no consent by month end, billed twice', () => {
  const r = checkApcm([P('A', { end: '2026-09-30' }), P('B', { consent: '2026-11-02' }), P('D')], [C('A', 'G0557'), C('B', 'G0557'), C('D', 'G0557', '2026-10-01'), C('D', 'G0557'), C('E', 'G0556')], opts);
  assert.deepEqual(st(r), [['not_enrolled', 'A'], ['not_enrolled', 'E'], ['no_consent', 'B'], ['billed_twice', 'D']]);
});

test('conflicting care management codes; settings can replace the list', () => {
  const ps = [P('A'), P('B')]; const cs = [C('A', 'G0557'), C('A', '99490'), C('B', 'G0557'), C('B', '99495')];
  assert.deepEqual(st(checkApcm(ps, cs, opts)), [['conflict_code', 'A'], ['conflict_code', 'B']]);
  assert.deepEqual(st(checkApcm(ps, cs, { ...opts, conflicts: ['99490'] })), [['conflict_code', 'A']]);
});

test('wrong tier over or under, with a stated tier winning over the count', () => {
  const r = checkApcm([P('A', { cond: 1 }), P('B', { cond: 3 }), P('D', { cond: 1, tier: 'G0557' })], [C('A', 'G0557'), C('B', 'G0556'), C('D', 'G0557')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.direction, i.amount, i.missed]), [['wrong_tier', 'A', 'over', 35, 0], ['wrong_tier', 'B', 'under', 0, 35]]);
  assert.equal(r.dollars_unbilled, 35);
});

test('enrolled and consented but not billed; not before enrollment or consent', () => {
  const r = checkApcm([P('A', { qmb: 'yes' }), P('B', { start: '2026-11-01' }), P('D', { consent: '' })], [], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.cpt, i.missed]), [['enrolled_not_billed', 'A', 'G0558', 110]]);
});
