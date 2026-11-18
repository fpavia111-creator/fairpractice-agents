import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { patients: 'census.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Hospice Billing', [
  { label: 'Check notices, benefit periods and the cap year that just ended', tool: 'hospice_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the administrator list', tool: 'hospice_write_report', args: f },
  { label: 'Agent tries to file a notice of election', tool: 'noe_submit', args: {} },
]);
