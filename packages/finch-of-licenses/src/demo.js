import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { credentials: 'credentials.csv', roster: 'roster.csv', shifts: 'shifts.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Finch of Licenses', [
  { label: 'Check staff licenses and certificates for November', tool: 'finch_check', args: f, list: (i) => `${i.status.padEnd(19)} ${i.message}` },
  { label: 'Write the managers\' list', tool: 'finch_write_report', args: f },
  { label: 'Agent tries to take someone off the schedule', tool: 'schedule_remove', args: {} },
]);
