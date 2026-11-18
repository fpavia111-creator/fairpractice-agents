import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { incidents: 'incidents.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Hawk of Breaches', [
  { label: 'Check the incident log against the notice clocks', tool: 'hawk_check', args: f, list: (i) => `${i.status.padEnd(26)} ${i.message}` },
  { label: 'Write the incident review', tool: 'hawk_write_report', args: f },
  { label: 'Agent tries to send breach letters', tool: 'breach_notice_send', args: {} },
]);
