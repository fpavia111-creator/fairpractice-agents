import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { charges: 'charges-2026-q3.csv', rvus: 'rvus.csv', settings: 'comp-plan.json', from: '2026-07-01', to: '2026-09-30' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Provider Pay', [
  { label: 'Work out third-quarter wRVU pay and true-up', tool: 'providerpay_check', args: f, list: (i) => `${i.status.padEnd(17)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the true-up report', tool: 'providerpay_write_report', args: f },
  { label: 'Agent tries to run payroll', tool: 'payroll_submit', args: {} },
]);
