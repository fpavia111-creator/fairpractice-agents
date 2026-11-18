import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { time: 'time-log.csv', claims: 'claims.csv', patients: 'enrolled.csv', settings: 'settings.json', month: '2026-10' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Egret of Care Management', [
  { label: 'Check October care management time against billing', tool: 'egret_check', args: f, list: (i) => `${i.status.padEnd(16)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the month-end list', tool: 'egret_write_report', args: f },
  { label: 'Agent tries to submit the month\'s claims', tool: 'claim_submit', args: {} },
]);
