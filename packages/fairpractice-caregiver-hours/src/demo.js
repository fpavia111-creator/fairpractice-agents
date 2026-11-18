import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { shifts: 'shifts.csv', payroll: 'payroll.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Caregiver Hours', [
  { label: 'Check the week of November 2 against payroll', tool: 'caregiver_check', args: f, list: (i) => `${i.status.padEnd(18)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the payroll list', tool: 'caregiver_write_report', args: f },
  { label: 'Agent tries to change payroll', tool: 'payroll_submit', args: {} },
]);
