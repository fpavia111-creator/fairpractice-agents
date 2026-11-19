// fairpractice-core helpers: dates, business days, minutes, names and sorting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthBounds, monthOf, federalHolidays, isBusinessDay, addBusinessDays, businessDaysBetween, weekOf, dueStatus, clockMinutes, spanMinutes, durationMinutes, personKey, personSimilarity, codeKey, idKey, yes, listOf, sortByStatus, countBy, dateRange, dayRuns, agingBucket , wordVariants, nearNameIndex } from '../src/index.js';

test('month bounds, including leap years', () => {
  assert.deepEqual(monthBounds('2028-02'), { start: '2028-02-01', end: '2028-02-29', days: 29 });
  assert.deepEqual(monthBounds('2026-02'), { start: '2026-02-01', end: '2026-02-28', days: 28 });
  assert.equal(monthBounds('Feb 2026'), null);
  assert.equal(monthOf('2026-09-30'), '2026-09');
});

test('federal holidays with observed dates', () => {
  const h = federalHolidays(2026);
  assert.equal(h.length, 11);
  for (const d of ['2026-01-01', '2026-01-19', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']) assert.ok(h.includes(d), d);
  assert.ok(federalHolidays(2027).includes('2027-12-24'), 'Christmas on a Saturday is observed Friday');
  assert.ok(federalHolidays(2028).includes('2028-07-04'));
});

test('business days skip weekends and federal holidays', () => {
  assert.equal(isBusinessDay('2026-11-26'), false);
  assert.equal(isBusinessDay('2026-11-21'), false);
  assert.equal(isBusinessDay('2026-11-24'), true);
  assert.equal(addBusinessDays('2026-11-24', 2), '2026-11-27');
  assert.equal(addBusinessDays('2026-12-31', 1), '2027-01-04');
  assert.equal(addBusinessDays('2026-11-24', 0), '2026-11-24');
  assert.equal(businessDaysBetween('2026-11-24', '2026-11-30'), 3);
  assert.equal(businessDaysBetween('2026-11-30', '2026-11-24'), 0);
  assert.equal(addBusinessDays('2026-11-24', 1, ['2026-11-25']), '2026-11-27');
});

test('week, due status, ranges and runs', () => {
  assert.equal(weekOf('2026-11-22'), '2026-11-16');
  assert.equal(weekOf('2026-11-16'), '2026-11-16');
  assert.equal(dueStatus('2026-11-10', '2026-11-18'), 'overdue');
  assert.equal(dueStatus('2026-12-01', '2026-11-18'), 'due_soon');
  assert.equal(dueStatus('2027-03-01', '2026-11-18'), 'ok');
  assert.equal(dueStatus('', '2026-11-18'), 'unknown');
  assert.deepEqual(dateRange('2026-02-27', '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  const runs = dayRuns([{ date: '2026-01-02', k: 'a' }, { date: '2026-01-01', k: 'a' }, { date: '2026-01-04', k: 'a' }], (d) => d.k);
  assert.deepEqual(runs.map((r) => [r.from, r.to, r.days]), [['2026-01-01', '2026-01-02', 2], ['2026-01-04', '2026-01-04', 1]]);
  assert.equal(agingBucket(45), '31-60');
});

test('clock times, spans past midnight and durations', () => {
  assert.equal(clockMinutes('13:05'), 785);
  assert.equal(clockMinutes('1:05 PM'), 785);
  assert.equal(clockMinutes('0905'), 545);
  assert.equal(clockMinutes('9am'), 540);
  assert.equal(clockMinutes('12:00 AM'), 0);
  assert.equal(clockMinutes('2026-11-18T07:30:00'), 450);
  assert.equal(clockMinutes('13:00 PM'), null);
  assert.equal(clockMinutes('nonsense'), null);
  assert.equal(spanMinutes('22:00', '06:00'), 480);
  assert.equal(durationMinutes('1h 5m'), 65);
  assert.equal(durationMinutes('0:45'), 45);
  assert.equal(durationMinutes('1.5 h'), 90);
  assert.equal(durationMinutes(-3), null);
});

test('names, codes and ids for matching', () => {
  assert.equal(personKey('Otto, Sam DO'), personKey('Dr. Sam Otto'));
  assert.equal(personKey('José  Ruíz'), personKey('jose ruiz'));
  assert.equal(personSimilarity('Jon Smith', 'John Smith') > 0.9, true);
  assert.equal(personSimilarity('', 'John Smith'), 0);
  assert.equal(codeKey(' f32.9 '), 'F329');
  assert.equal(idKey('inv-000123'), 'INV000123');
  assert.equal(idKey('000123'), '123');
  assert.ok(yes('Y') && yes('done') && !yes('no') && !yes(''));
  assert.deepEqual(listOf('a; b, c|d'), ['a', 'b', 'c', 'd']);
});

test('sortByStatus orders by status, then amount, then id; countBy skips missing keys', () => {
  const items = [{ status: 'b', amount: 5, id: '2' }, { status: 'a', amount: 1, id: '9' }, { status: 'b', amount: 5, id: '1' }, { status: 'b', amount: 9, id: '3' }, { status: 'zz', amount: 100 }];
  sortByStatus(items, { a: 0, b: 1 });
  assert.deepEqual(items.map((i) => i.id ?? '-'), ['9', '3', '1', '2', '-']);
  assert.deepEqual(countBy([{ s: 'x' }, { s: 'x' }, { s: null }, {}], 's'), { x: 2 });
});

test('word variants: each word, each word of three letters or more with one letter left out, and the start of long words', () => {
  const v = wordVariants('jon smith');
  for (const x of ['jon', 'on', 'jn', 'jo', 'smith', 'mith', 'sith', 'smth', 'smih', 'smit', '^smit']) assert.ok(v.has(x), x);
  assert.ok(!v.has('^jon'));
});

test('near-name index: one typo in any word finds the name, in indexing order, within the length limit', () => {
  const near = nearNameIndex(['john smith', 'catherine jones', 'ana lee', 'zed quill'], { maxLenDiff: 4 });
  assert.deepEqual(near('jon smyth'), ['john smith']);
  assert.deepEqual(near('jones katherine'), ['catherine jones']);
  assert.deepEqual(near('anna lee'), ['ana lee']);
  assert.deepEqual(near('mary brown'), []);
  assert.deepEqual(nearNameIndex(['al bo', 'albert bo long name here'], { maxLenDiff: 4 })('al bo'), ['al bo']);
});

test('near-name index: numbers match exactly, and very common words do not pull in every name', () => {
  assert.ok(!wordVariants('suite 101').has('11'), 'no typo variants of a number');
  const keys = Array.from({ length: 600 }, (_, i) => `vendor medical ${i}`).concat(['northwind billing', 'acme medical']);
  const near = nearNameIndex(keys);
  assert.deepEqual(near('northwind biling'), ['northwind billing']);
  assert.ok(near('acme medical').includes('acme medical') && near('acme medical').length < 10, 'the rare word finds it; "medical" alone is too common');
  assert.ok(near('medical').length >= 1, 'a name made only of common words still gets candidates');
});
