// Domain checks: exclusion matching rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen, exclusionEntry } from '../src/logic.js';

const P = (name, o = {}) => ({ id: o.id || name, name, type: o.type || 'employee', dob: o.dob || '', npi: o.npi || '', last_screened: o.last ?? '2026-11-01' });
const E = (first, last, o = {}) => exclusionEntry({ first_name: first, last_name: last, dob: o.dob || '', npi: o.npi || '0000000000', excluded_on: o.excl || '2020-01-01', reinstated_on: o.rein || '', business_name: o.biz || '' }, o.src || 'LEIE');
const st = (r) => r.items.map((i) => [i.name, i.status]);
const asOf = '2026-11-15';

test('a clean roster has no findings', () => {
  assert.deepEqual(screen([P('Ana Diaz')], [E('BOB', 'STONE')], { asOf }).items, []);
});

test('last-first order, case, middle initials and suffixes do not hide a match', () => {
  assert.deepEqual(st(screen([P('Stone, Robert J. Jr.')], [E('ROBERT', 'STONE')], { asOf })), [['Stone, Robert J. Jr.', 'possible_match']]);
});

test('birth date confirms or rules out a name match', () => {
  assert.equal(screen([P('Ann Lee', { dob: '1980-01-02' })], [E('ANN', 'LEE', { dob: '19800102' })], { asOf }).items[0].status, 'confirmed_match');
  assert.equal(screen([P('Ann Lee', { dob: '1980-01-02' })], [E('ANN', 'LEE', { dob: '19700102' })], { asOf }).items[0].status, 'dob_differs');
});

test('an NPI match wins even when the name on the list is spelled differently, and is not reported twice', () => {
  const r = screen([P('Teddy Ashby', { npi: '1234567893', type: 'provider' })], [E('THEODORE', 'ASHBY', { npi: '1234567893' })], { asOf });
  assert.deepEqual(st(r), [['Teddy Ashby', 'npi_match']]);
});

test('the zero NPI placeholder on the OIG file never matches', () => {
  assert.equal(exclusionEntry({ npi: '0000000000', last_name: 'X' }, 'LEIE').npi, null);
});

test('an invalid NPI on the roster is not matched by NPI', () => {
  assert.deepEqual(screen([P('Zed Moore', { npi: '1234567890' })], [E('AL', 'BEE', { npi: '1234567890' })], { asOf }).items, []);
});

test('near names show above the threshold only', () => {
  assert.equal(screen([P('Jonathan Price')], [E('JONATHON', 'PRYCE')], { asOf, nearThreshold: 0.9 }).items[0].status, 'near_name');
  assert.deepEqual(screen([P('Jonathan Price')], [E('JONATHON', 'PRYCE')], { asOf, nearThreshold: 0.97 }).items, []);
});

test('reinstated before as-of shows as reinstated; reinstated after as-of is still a match', () => {
  assert.equal(screen([P('Ann Lee')], [E('ANN', 'LEE', { rein: '2025-06-01' })], { asOf }).items[0].status, 'reinstated');
  assert.equal(screen([P('Ann Lee')], [E('ANN', 'LEE', { rein: '2027-01-01' })], { asOf }).items[0].status, 'possible_match');
});

test('vendors match business names without LLC or Inc; people never match a business name', () => {
  const list = [E('', '', { biz: 'GULFLINE MEDICAL SUPPLY' })];
  assert.equal(screen([P('Gulfline Medical Supply, LLC', { type: 'vendor' })], list, { asOf }).items[0].status, 'possible_match');
  assert.deepEqual(screen([P('Gulfline Medical Supply', { type: 'employee' })], list, { asOf }).items, []);
});

test('a cleared match stays hidden for that person only', () => {
  const list = [E('ANN', 'LEE')];
  const cleared = (p, e) => p.id === 'X1' && e.excluded_on === '2020-01-01';
  assert.deepEqual(screen([P('Ann Lee', { id: 'X1' })], list, { asOf, cleared }).items, []);
  assert.equal(screen([P('Ann Lee', { id: 'X1' }), P('Lee Ann', { id: 'X2' })], list, { asOf, cleared }).items.length, 1);
  const npi = [E('ANN', 'LEE', { npi: '1234567893' })];
  assert.equal(screen([P('Ann Lee', { id: 'X1', npi: '1234567893' })], npi, { asOf, cleared: () => true }).items[0].status, 'npi_match', 'an NPI match is never cleared');
});

test('screening interval: never screened, overdue after the interval, fine inside it', () => {
  const r = screen([P('A One', { last: '' }), P('B Two', { last: '2026-10-14' }), P('C Three', { last: '2026-10-15' })], [], { asOf, intervalDays: 31 });
  assert.deepEqual(st(r), [['A One', 'never_screened'], ['B Two', 'screening_overdue']]);
});
