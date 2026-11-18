import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { requests: 'access-requests.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Records Requests', [
  { label: 'Check this quarter\'s access requests', tool: 'access_check', args: f, list: (i) => `${i.status.padEnd(20)} ${i.message}` },
  { label: 'Write the privacy meeting list', tool: 'access_write_report', args: f },
  { label: 'Agent tries to release records itself', tool: 'records_release', args: {} },
]);
