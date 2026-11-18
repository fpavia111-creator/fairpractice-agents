import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { completions: 'lms-completions.csv', roster: 'roster.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Compliance Training', [
  { label: 'Check HIPAA, fraud-and-abuse and HB 300 training', tool: 'training_check', args: f, list: (i) => `${i.status.padEnd(18)} ${i.message}` },
  { label: 'Write the managers\' list', tool: 'training_write_report', args: f },
  { label: 'Agent tries to email managers', tool: 'manager_email_send', args: {} },
]);
