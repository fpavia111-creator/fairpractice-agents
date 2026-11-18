// Domain checks: device days, overlapping periods, setup, interactive contact, minutes and RTM overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRpm, deviceCodeFor } from '../src/logic.js';

const R = (pid, from, n) => Array.from({ length: n }, (_, k) => ({ patient_id: pid, date: new Date(Date.parse(`${from}T00:00:00Z`) + k * 86400000).toISOString().slice(0, 10) }));
const TM = (pid, minutes, inter = 'Yes', date = '2026-10-10') => ({ patient_id: pid, date, minutes, interactive: inter });
const C = (pid, cpt, date = '2026-10-31', units = 1, start = '') => ({ patient_id: pid, date, cpt, units, period_start: start });
const st = (r) => r.items.map((i) => [i.status, i.patient_id]);

test('device code by reading days', () => {
  assert.deepEqual([1, 2, 15, 16, 30].map(deviceCodeFor), [null, '99445', '99445', '99454', '99454']);
});

test('reading days counted once per day inside the 30 days ending on the date of service, or from a period start', () => {
  const readings = [...R('A', '2026-10-02', 16), ...R('A', '2026-10-02', 16), ...R('B', '2026-09-25', 20), ...R('D', '2026-10-01', 5)];
  const r = checkRpm(readings, [], [C('A', '99454'), C('B', '99454'), C('D', '99445', '2026-10-30', 1, '2026-10-01'), C('E', '99445')], [], { rates: { 99454: 47, 99445: 24 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.reading_days, i.supports]), [['days_short', 'E', 0, 'none'], ['days_short', 'B', 13, '99445']]);
});

test('overlapping device periods', () => {
  const r = checkRpm([...R('A', '2026-09-01', 61)], [], [C('A', '99454', '2026-09-30'), C('A', '99454', '2026-10-15'), C('A', '99454', '2026-11-14')]);
  assert.deepEqual(r.items.map((i) => [i.status, i.date]), [['period_overlap', '2026-10-15']]);
});

test('setup once per episode; a new episode may bill it again', () => {
  const r = checkRpm([], [], [C('A', '99453', '2026-03-01'), C('A', '99453', '2026-05-01'), C('B', '99453', '2026-03-01'), C('B', '99453', '2026-09-01')], [{ patient_id: 'A', episode_start: '2026-02-01' }, { patient_id: 'B', episode_start: '2026-08-15' }]);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.date]), [['setup_repeat', 'A', '2026-05-01']]);
});

test('management: interactive contact, base minutes, add-on units, and 99457 with 99470', () => {
  const r = checkRpm([], [TM('A', 25, 'No'), TM('B', 15), TM('D', 45), TM('E', 25), TM('F', 12)], [C('A', '99457'), C('B', '99457'), C('D', '99457'), C('D', '99458', '2026-10-31', 2), C('E', '99457'), C('E', '99470'), C('F', '99470')]);
  assert.deepEqual(r.items.map((i) => [i.status, i.patient_id, i.problems?.length ?? 0]), [['no_interactive', 'A', 0], ['minutes_short', 'B', 1], ['minutes_short', 'D', 1], ['minutes_short', 'E', 1]]);
});

test('RPM with remote therapeutic monitoring in the same month', () => {
  const r = checkRpm([], [TM('A', 22)], [C('A', '99457'), C('A', '98977'), C('B', '98977')]);
  assert.deepEqual(st(r), [['overlap_rtm', 'A']]);
});
