// Domain checks: weekly hours, travel, overtime against payroll, split shifts, meals and live-in sleep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCaregiverHours } from '../src/logic.js';

const S = (cg, client, date, a, b, o = {}) => ({ caregiver_id: cg, client_id: client, date, clock_in: a, clock_out: b, minutes: o.min ?? '', meal_minutes: o.meal ?? 0, live_in: o.live || '', sleep_minutes: o.sleep ?? '', sleep_interrupted: o.int || '', pay_rate: o.rate ?? 20 });
const week = (cg, hoursPerDay, start = '2026-11-02') => Array.from({ length: 5 }, (_, k) => S(cg, 'X', new Date(Date.parse(`${start}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10), '08:00', `${String(8 + hoursPerDay).padStart(2, '0')}:00`));
const st = (r) => r.items.map((i) => i.status);

test('overtime across clients without payroll is listed; with payroll it is priced', () => {
  const shifts = week('A', 9);
  assert.deepEqual(checkCaregiverHours(shifts).items.map((i) => [i.status, i.overtime_hours]), [['overtime', 5]]);
  const r = checkCaregiverHours(shifts, [{ caregiver_id: 'A', week_start: '2026-11-04', regular_hours: 45, overtime_hours: 0 }]);
  assert.deepEqual(r.items.map((i) => [i.status, i.amount]), [['hours_underpaid', 50]], '5 OT hours paid straight: half-time owed, 5 x 20 x 0.5');
  assert.deepEqual(checkCaregiverHours(shifts, [{ caregiver_id: 'A', week_start: '2026-11-02', regular_hours: 40, overtime_hours: 5 }]).items, []);
});

test('weeks start Monday by default, or Sunday', () => {
  const shifts = [S('A', 'X', '2026-11-01', '00:00', '23:00'), S('A', 'X', '2026-11-02', '00:00', '23:00')];
  assert.equal(checkCaregiverHours(shifts).weeks, 2);
  assert.equal(checkCaregiverHours(shifts, [], { weekStartDay: 'sunday' }).weeks, 1);
});

test('short gaps between different clients are travel worked; long gaps are split shifts when a premium is set', () => {
  const r = checkCaregiverHours([S('A', 'X', '2026-11-02', '08:00', '10:00'), S('A', 'Y', '2026-11-02', '10:30', '12:00'), S('A', 'Y', '2026-11-02', '12:15', '13:00'), S('B', 'X', '2026-11-02', '08:00', '10:00'), S('B', 'Y', '2026-11-02', '13:00', '15:00')], [], { splitPremium: 15 });
  assert.deepEqual(r.items.map((i) => [i.status, i.caregiver_id, i.travel_hours ?? i.gap_hours]), [['split_shift', 'B', 3], ['travel_time', 'A', 0.5]]);
  assert.deepEqual(st(checkCaregiverHours([S('B', 'X', '2026-11-02', '08:00', '10:00'), S('B', 'Y', '2026-11-02', '13:00', '15:00')])), [], 'no premium set, no split-shift finding');
});

test('meal breaks only when the state rule is set', () => {
  const shifts = [S('A', 'X', '2026-11-02', '06:00', '12:30'), S('B', 'X', '2026-11-02', '06:00', '12:30', { meal: 30 }), S('D', 'X', '2026-11-02', '06:00', '11:00')];
  assert.deepEqual(checkCaregiverHours(shifts, [], { mealAfterHours: 5 }).items.map((i) => [i.status, i.caregiver_id]), [['meal_break_missed', 'A']]);
  assert.deepEqual(checkCaregiverHours(shifts).items, []);
});

test('live-in: sleep over the cap or interrupted counts back as worked', () => {
  const r = checkCaregiverHours([S('A', 'X', '2026-11-02', '08:00', '08:00', { min: 1440, meal: 60, live: 'Yes', sleep: 600 }), S('B', 'X', '2026-11-02', '08:00', '08:00', { min: 1440, meal: 60, live: 'Yes', sleep: 480, int: 'Yes' }), S('D', 'X', '2026-11-02', '08:00', '08:00', { min: 1440, meal: 60, live: 'Yes', sleep: 480 })]);
  assert.deepEqual(r.items.map((i) => [i.status, i.caregiver_id, i.counted_back]), [['live_in_sleep', 'A', 2], ['live_in_sleep', 'B', 8]]);
});
