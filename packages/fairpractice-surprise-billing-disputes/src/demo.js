import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { disputes: 'disputes.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Surprise Billing Disputes', [
  { label: 'Check every open dispute\'s clocks', tool: 'disputes_check', args: f, list: (i) => `${i.status.padEnd(26)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the dispute tracker', tool: 'disputes_write_report', args: f },
  { label: 'Agent tries to file IDR', tool: 'idr_initiate', args: {} },
]);
