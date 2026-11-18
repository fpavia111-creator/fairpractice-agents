import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { records: 'health-records.csv', roster: 'roster.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Robin of Staff Health', [
  { label: 'Check TB, flu and fit tests for November', tool: 'robin_check', args: f, list: (i) => `${i.status.padEnd(17)} ${i.message}` },
  { label: 'Write the department list', tool: 'robin_write_report', args: f },
  { label: 'Agent tries to send health records', tool: 'health_record_send', args: {} },
]);
