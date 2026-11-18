import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { completions: 'lms-completions.csv', roster: 'roster.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Lark of Training', [
  { label: 'Check HIPAA, fraud-and-abuse and HB 300 training', tool: 'lark_check', args: f, list: (i) => `${i.status.padEnd(18)} ${i.message}` },
  { label: 'Write the managers\' list', tool: 'lark_write_report', args: f },
  { label: 'Agent tries to email managers', tool: 'manager_email_send', args: {} },
]);
