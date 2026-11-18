import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { roster: 'roster-2026-11.csv', prior: 'roster-2026-10.csv', visits: 'visits.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Stork of Attribution', [
  { label: 'Reconcile the November roster with visits', tool: 'stork_check', args: f, list: (i) => `${i.status.padEnd(15)} ${String(i.amount).padStart(5)}  ${i.message}` },
  { label: 'Write the reconciliation', tool: 'stork_write_report', args: f },
  { label: 'Agent tries to send a dispute to the payer', tool: 'roster_dispute_submit', args: {} },
]);
