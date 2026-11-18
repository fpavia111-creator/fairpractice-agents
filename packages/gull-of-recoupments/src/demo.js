import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { recoupments: 'recoupments.csv', claims: 'paid-claims.csv', notices: 'notices.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Gull of Recoupments', [
  { label: 'Match takebacks to claims and notices', tool: 'gull_check', args: f, list: (i) => `${i.status.padEnd(16)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the recovery list', tool: 'gull_write_report', args: f },
  { label: 'Agent tries to file an appeal', tool: 'appeal_submit', args: {} },
]);
