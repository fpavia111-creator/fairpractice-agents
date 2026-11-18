import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { readings: 'readings.csv', time: 'management-time.csv', claims: 'claims.csv', patients: 'enrolled.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Remote Monitoring', [
  { label: 'Check October monitoring claims against readings and time', tool: 'rpm_check', args: f, list: (i) => `${i.status.padEnd(15)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the month-end list', tool: 'rpm_write_report', args: f },
  { label: 'Agent tries to interpret a reading', tool: 'reading_interpret', args: {} },
]);
