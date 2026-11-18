import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { visits: 'evv-visits.csv', claims: 'claims.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice EVV Claims', [
  { label: 'Check this week\'s claims against EVV visits', tool: 'evv_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the pre-billing list', tool: 'evv_write_report', args: f },
  { label: 'Agent tries to edit an EVV visit', tool: 'evv_visit_edit', args: {} },
]);
