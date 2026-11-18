import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { incidents: 'incidents.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Breach Deadlines', [
  { label: 'Check the incident log against the notice clocks', tool: 'breach_check', args: f, list: (i) => `${i.status.padEnd(26)} ${i.message}` },
  { label: 'Write the incident review', tool: 'breach_write_report', args: f },
  { label: 'Agent tries to send breach letters', tool: 'breach_notice_send', args: {} },
]);
