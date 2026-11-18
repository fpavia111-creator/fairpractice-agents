// Domain checks: breach clocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIncidents, determination, annualDue } from '../src/logic.js';

const I = (id, disc, o = {}) => ({ incident_id: id, discovered: disc, affected: o.n ?? 10, assessed_on: o.assessed || '', determination: o.det ?? 'breach', individuals_notified_on: o.ind || '', media_notified_on: o.media || '', hhs_notified_on: o.hhs || '', states: o.states || '', ag_notified_on: o.ag || '' });
const asOf = '2026-11-15';
const st = (r) => r.items.map((i) => [i.incident_id, i.status]);

test('determination words', () => {
  assert.equal(determination('Not a breach - low probability of compromise'), 'not_breach');
  assert.equal(determination('Breach'), 'breach');
  assert.equal(determination('under review'), 'pending');
  assert.equal(determination(''), 'pending');
});

test('the yearly small-breach report is due 60 days after December 31 (February 29 in a leap year)', () => {
  assert.equal(annualDue('2026-05-01'), '2027-03-01');
  assert.equal(annualDue('2027-05-01'), '2028-02-29');
});

test('individual notice: day 60 on time, day 61 late, missing after the deadline is past due', () => {
  const r = checkIncidents([I('A', '2026-08-01', { ind: '2026-09-30', hhs: 'x' }), I('B', '2026-08-01', { ind: '2026-10-01', hhs: '2026-10-01' }), I('C', '2026-08-01', { hhs: '2026-10-01' })], { asOf });
  assert.deepEqual(st(r), [['C', 'notice_past_due'], ['B', 'notice_late']]);
});

test('500 or more: HHS and media notices with the letters; under 500: the year-end log', () => {
  assert.deepEqual(st(checkIncidents([I('L', '2026-08-01', { n: 500, ind: '2026-09-01' })], { asOf })), [['L', 'hhs_notice_missing'], ['L', 'media_notice_missing']]);
  assert.deepEqual(st(checkIncidents([I('S', '2026-08-01', { n: 499, ind: '2026-09-01' })], { asOf })), [['S', 'hhs_annual_due']]);
});

test('pending incidents: assessment target and the 60-day window still run', () => {
  const r = checkIncidents([I('P', '2026-09-01', { det: 'pending' }), I('Q', '2026-11-10', { det: '' })], { asOf, assessDays: 10 });
  assert.deepEqual(st(r), [['P', 'undetermined_past_deadline'], ['P', 'assessment_overdue']]);
});

test('state rules apply only to listed states at or above their threshold', () => {
  const rules = [{ state: 'TX', ag_threshold: 250, ag_days: 30 }];
  assert.deepEqual(st(checkIncidents([I('A', '2026-09-01', { n: 300, states: 'tx, ok', ind: '2026-09-20', hhs: 'x', media: 'x' })], { asOf, stateRules: rules })), [['A', 'state_ag_notice_missing']]);
  assert.deepEqual(checkIncidents([I('A', '2026-09-01', { n: 200, states: 'TX', ind: '2026-09-20', hhs: 'x' })], { asOf, stateRules: rules }).items, []);
});
