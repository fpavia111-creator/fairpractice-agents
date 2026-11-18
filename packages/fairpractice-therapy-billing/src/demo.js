import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { visits: 'visits-2026.csv', plans: 'plans-of-care.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Therapy Billing', [
  { label: 'Check this year\'s therapy charges against plans of care', tool: 'therapy_check', args: f, list: (i) => `${i.status.padEnd(27)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the billing list', tool: 'therapy_write_report', args: f },
  { label: 'Agent tries to add KX to a claim', tool: 'modifier_apply', args: {} },
]);
