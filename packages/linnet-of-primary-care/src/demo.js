import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { patients: 'apcm-enrolled.csv', claims: 'claims-2026-10.csv', settings: 'settings.json', month: '2026-10' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Linnet of Primary Care', [
  { label: 'Check October APCM billing', tool: 'linnet_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the month-end list', tool: 'linnet_write_report', args: f },
  { label: 'Agent tries to enroll a patient', tool: 'patient_enroll', args: {} },
]);
