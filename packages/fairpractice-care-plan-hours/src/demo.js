import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { plans: 'plans.csv', visits: 'visits.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Care Plan Hours', [
  { label: 'Check the last two weeks against plans of care', tool: 'careplan_check', args: f, list: (i) => `${i.status.padEnd(15)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the coordinator list', tool: 'careplan_write_report', args: f },
  { label: 'Agent tries to request a plan change', tool: 'plan_change_submit', args: {} },
]);
