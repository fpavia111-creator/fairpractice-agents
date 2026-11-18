// Domain checks: 8-minute rule, therapy modifiers, KX threshold and plans of care.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTherapy, eightMinuteUnits, roleOf } from '../src/logic.js';

const V = (pid, date, cpt, units, minutes, role = 'PT', mods = 'GP', o = {}) => ({ patient_id: pid, date, cpt, units, minutes, provider_role: role, modifiers: mods, provider: o.provider || 'A', payer: o.payer ?? 'Medicare', allowed: o.allowed ?? 10 });
const PL = (pid, disc = 'PT', o = {}) => ({ patient_id: pid, discipline: disc, start: o.start || '2026-01-01', end: o.end || '2026-12-31', signed: o.signed ?? '2026-01-05' });
const asOf = '2026-11-15'; const opts = { asOf, warnDays: 0 };
const st = (r) => r.items.map((i) => i.status);

test('8-minute rule: total timed minutes per day', () => {
  assert.deepEqual([7, 8, 22, 23, 37, 38, 52, 53].map(eightMinuteUnits), [0, 1, 1, 2, 2, 3, 3, 4]);
  const r = checkTherapy([V('P', '2026-03-01', '97110', 2, 23), V('P', '2026-03-01', '97140', 1, 10), V('P', '2026-03-01', '97112', 1, 7)], [PL('P')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.allowed_units, i.over_units]), [['eight_minute_over', 3, 1]]);
});

test('8-minute rule: untimed codes, other providers and days with unknown minutes are left alone', () => {
  const r = checkTherapy([V('P', '2026-03-01', '97110', 1, 10), V('P', '2026-03-01', '97161', 1, 30), V('P', '2026-03-01', '97110', 1, 10, 'PT', 'GP', { provider: 'B' }), V('P', '2026-03-02', '97110', 2, '')], [PL('P')], opts);
  assert.deepEqual(r.items, []);
});

test('roles: assistants and disciplines from everyday credentials', () => {
  assert.deepEqual(['PTA', 'COTA/L', 'OTR/L', 'DPT', 'CCC-SLP', 'Physical Therapist Assistant', 'RN'].map((v) => roleOf(v)), [{ discipline: 'PT', assistant: true }, { discipline: 'OT', assistant: true }, { discipline: 'OT', assistant: false }, { discipline: 'PT', assistant: false }, { discipline: 'SLP', assistant: false }, { discipline: 'PT', assistant: true }, null]);
});

test('assistant modifiers CQ and CO, and the discipline modifier', () => {
  const r = checkTherapy([V('P', '2026-03-01', '97110', 1, 15, 'PTA', 'GP'), V('P', '2026-03-02', '97110', 1, 15, 'PTA', 'GP CQ'), V('P', '2026-03-03', '97530', 1, 15, 'OT', 'GP')], [PL('P', '')], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.date, i.needed]), [['assistant_modifier_missing', '2026-03-01', 'CQ'], ['discipline_modifier_wrong', '2026-03-03', 'GO']]);
});

test('KX: PT and speech share one threshold, OT has its own, only for the listed payers', () => {
  const vs = [V('P', '2026-02-01', '97110', 1, 15, 'PT', 'GP', { allowed: 60 }), V('P', '2026-02-02', '92507', 1, 30, 'SLP', 'GN', { allowed: 50 }), V('P', '2026-02-03', '97530', 1, 15, 'OT', 'GO', { allowed: 90 }), V('P', '2026-02-04', '97110', 1, 15, 'PT', 'GP KX', { allowed: 10 }), V('Q', '2026-02-01', '97110', 1, 15, 'PT', 'GP', { allowed: 500, payer: 'Bluepeak' })];
  const r = checkTherapy(vs, [PL('P', ''), PL('Q', '')], { ...opts, kxThreshold: 100 });
  assert.deepEqual(r.items.map((i) => [i.status, i.date, i.bucket]), [['kx_missing', '2026-02-02', 'PT and speech']]);
});

test('KX counts per calendar year', () => {
  const r = checkTherapy([V('P', '2025-12-30', '97110', 1, 15, 'PT', 'GP', { allowed: 90 }), V('P', '2026-01-02', '97110', 1, 15, 'PT', 'GP', { allowed: 90 })], [PL('P', 'PT', { start: '2025-12-01', signed: '2025-12-03' })], { ...opts, kxThreshold: 100 });
  assert.deepEqual(r.items, []);
});

test('plan of care: none for the date or discipline, unsigned past the window, signed late', () => {
  const r = checkTherapy([V('P', '2026-03-01', '97110', 1, 15), V('P', '2026-03-01', '97530', 1, 15, 'OT', 'GO')], [PL('P', 'PT', { start: '2026-03-02' }), PL('Q', 'PT', { start: '2026-10-01', signed: '' }), PL('R', 'PT', { start: '2026-01-01', signed: '2026-03-01' })], opts);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id]), [['no_plan_of_care', 'P'], ['no_plan_of_care', 'P'], ['cert_unsigned', 'Q'], ['cert_unsigned', 'R']]);
});

test('recertification due only for patients still seen and with no newer plan', () => {
  const plans = [PL('P', 'PT', { start: '2026-09-01', end: '2026-11-25' }), PL('Q', 'PT', { start: '2026-09-01', end: '2026-11-25' }), PL('R', 'PT', { start: '2026-09-01', end: '2026-11-25' }), PL('R', 'PT', { start: '2026-11-26', end: '2027-02-20' })];
  const r = checkTherapy([V('P', '2026-11-10', '97110', 1, 15), V('Q', '2026-09-10', '97110', 1, 15), V('R', '2026-11-10', '97110', 1, 15)], plans, { asOf, warnDays: 21 });
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id]), [['recert_due', 'P']]);
});
