import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { contracts: 'agreements.csv', payments: 'physician-payments-2026.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Crane of Physician Contracts', [
  { label: 'Check this year\'s physician payments against the agreements', tool: 'crane_check', args: f, list: (i) => `${i.status.padEnd(22)} ${i.message}` },
  { label: 'Write the compliance committee list', tool: 'crane_write_report', args: f },
  { label: 'Agent tries to release a payment', tool: 'payment_release', args: {} },
]);
