import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { disputes: 'disputes.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Falcon of Disputes', [
  { label: 'Check every open dispute\'s clocks', tool: 'falcon_check', args: f, list: (i) => `${i.status.padEnd(26)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the dispute tracker', tool: 'falcon_write_report', args: f },
  { label: 'Agent tries to file IDR', tool: 'idr_initiate', args: {} },
]);
