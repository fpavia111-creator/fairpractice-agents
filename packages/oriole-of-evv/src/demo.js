import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { visits: 'evv-visits.csv', claims: 'claims.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Oriole of EVV', [
  { label: 'Check this week\'s claims against EVV visits', tool: 'oriole_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the pre-billing list', tool: 'oriole_write_report', args: f },
  { label: 'Agent tries to edit an EVV visit', tool: 'evv_visit_edit', args: {} },
]);
