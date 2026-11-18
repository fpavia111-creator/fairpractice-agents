import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { periods: 'periods.csv', visits: 'visits.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Sparrow of Home Health', [
  { label: 'Check periods, notices and visit counts', tool: 'sparrow_check', args: f, list: (i) => `${i.status.padEnd(21)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the administrator list', tool: 'sparrow_write_report', args: f },
  { label: 'Agent tries to file a notice of admission', tool: 'noa_submit', args: {} },
]);
