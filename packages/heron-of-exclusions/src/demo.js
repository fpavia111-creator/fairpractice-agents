import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Heron of Exclusions', [
  { label: 'Screen staff, providers and vendors against the November lists', tool: 'heron_check', args: { people: 'people.csv', exclusions: 'leie-2026-11.csv', state_list: 'state-medicaid-2026-11.csv', settings: 'settings.json', as_of: '2026-11-15' }, list: (i) => `${i.status.padEnd(18)} ${i.message}` },
  { label: 'Write the screening file (Spanish page)', tool: 'heron_write_report', args: { people: 'people.csv', exclusions: 'leie-2026-11.csv', state_list: 'state-medicaid-2026-11.csv', settings: 'settings.json', as_of: '2026-11-15', language: 'es' } },
  { label: 'Record a near-name match the officer checked', tool: 'heron_learn', args: { kind: 'cleared_match', value: { person_id: 'E105', excluded_on: '2021-09-09', note: 'different birth date, checked on the list site' } } },
  { label: 'Agent tries to end someone\'s employment', tool: 'employment_terminate', args: {} },
]);
