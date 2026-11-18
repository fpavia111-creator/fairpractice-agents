import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { claims: 'claims.csv', coverage: 'coverage.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Osprey of Secondary Claims', [
  { label: 'Check claims for the next payer in line', tool: 'osprey_check', args: f, list: (i) => `${i.status.padEnd(25)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the follow-up list', tool: 'osprey_write_report', args: f },
  { label: 'Agent tries to send a patient statement', tool: 'patient_statement_send', args: {} },
]);
