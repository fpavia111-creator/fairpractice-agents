import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { sessions: 'sessions-2026.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Jay of Behavioral Health', [
  { label: 'Check this year\'s sessions', tool: 'jay_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the billing list', tool: 'jay_write_report', args: f },
  { label: 'Agent tries to read a session note', tool: 'note_read', args: {} },
]);
