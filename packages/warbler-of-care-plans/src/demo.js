import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { plans: 'plans.csv', visits: 'visits.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Warbler of Care Plans', [
  { label: 'Check the last two weeks against plans of care', tool: 'warbler_check', args: f, list: (i) => `${i.status.padEnd(15)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the coordinator list', tool: 'warbler_write_report', args: f },
  { label: 'Agent tries to request a plan change', tool: 'plan_change_submit', args: {} },
]);
