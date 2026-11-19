// fairpractice-core wave 2 helpers and column definitions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ndcKey, inCodeList, fplPercent, pctOf, daysSince, latestBy, lookupRule, PHONE, ORG, PAYER, ACCOUNT, NDC, conceptOf, translatedNames } from '../src/index.js';

test('NDC: dashed 4-4-2, 5-3-2 and 5-4-1 become 11 digits; bad input is null', () => {
  assert.equal(ndcKey('0002-1433-80'), '00002143380');
  assert.equal(ndcKey('50242-040-62'), '50242004062');
  assert.equal(ndcKey('60505-2579-1'), '60505257901');
  assert.equal(ndcKey('00002143380'), '00002143380');
  assert.equal(ndcKey('0002143380'), '00002143380');
  assert.equal(ndcKey('12-34'), null);
  assert.equal(ndcKey(''), null);
});

test('code lists: single codes, ranges with letters, and wildcards', () => {
  assert.ok(inCodeList('70450', '70450-70498'));
  assert.ok(inCodeList('70498', ['70450-70498']));
  assert.ok(!inCodeList('70499', '70450-70498'));
  assert.ok(inCodeList('J9035', 'J9000-J9999'));
  assert.ok(!inCodeList('Q9035', 'J9000-J9999'), 'the letter must match');
  assert.ok(inCodeList('E11.9', 'E11.*'));
  assert.ok(inCodeList('e119', 'E11*'));
  assert.ok(!inCodeList('E10.9', 'E11.*; I10'));
  assert.ok(inCodeList('I10', 'E11.*; I10'));
  assert.ok(!inCodeList('', 'I10'));
  assert.ok(inCodeList('I21.4', 'I20-I25'), 'a category range covers longer codes');
  assert.ok(!inCodeList('I26.0', 'I20-I25'));
  assert.ok(!inCodeList('9711', '97000-97999'), 'a shorter code is not inside a five-digit range');
});

test('poverty-guideline percent from income and household size', () => {
  const g = { base: 15650, per_person: 5500 };
  assert.equal(fplPercent(15650, 1, g), 100);
  assert.equal(fplPercent(53300, 4, g), 165.79);
  assert.equal(fplPercent(0, 2, g), 0);
  assert.equal(fplPercent('', 2, g), null);
  assert.equal(fplPercent(20000, 0, g), null);
  assert.equal(fplPercent(20000, 2, null), null);
});

test('percent, days since, latest row per key and rule lookup', () => {
  assert.equal(pctOf(1, 3), 33.33); assert.equal(pctOf(1, 0), null);
  assert.equal(daysSince('2026-11-01', '2026-11-15'), 14); assert.equal(daysSince('', '2026-11-15'), null);
  const m = latestBy([{ k: 'a', d: '2026-01-01' }, { k: 'a', d: '2026-03-01' }, { k: 'b', d: '' }], (r) => r.k, 'd');
  assert.equal(m.get('a').d, '2026-03-01'); assert.ok(m.has('b'));
  assert.deepEqual(lookupRule({ 'Ohio Medicaid': 1 }, 'ohio-medicaid'), 1);
  assert.equal(lookupRule({ OH: 1 }, 'TX'), null); assert.equal(lookupRule(null, 'x'), null);
});

test('new columns: identifiers stay untranslated, phone and organisation read in other languages; a field named payer reads Kostenträger', () => {
  assert.equal(conceptOf('account', ACCOUNT), null);
  assert.equal(conceptOf('ndc', NDC), null);
  assert.equal(ACCOUNT.phi, 'account'); assert.equal(PHONE.phi, 'phone');
  assert.equal(conceptOf('phone', PHONE), 'phone');
  assert.equal(conceptOf('org', ORG), 'company');
  assert.equal(conceptOf('payer', PAYER), 'payer');
  assert.ok(translatedNames(conceptOf('payer', PAYER)).some((x) => x.word === 'Kostenträger'));
  assert.ok(translatedNames('patient_name').length > 0);
});
