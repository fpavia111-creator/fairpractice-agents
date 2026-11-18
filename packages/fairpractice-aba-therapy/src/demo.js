import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { sessions: 'sessions-2026-q4.csv', authorizations: 'authorizations.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice ABA Therapy', [
  { label: 'Check October and November sessions against authorizations', tool: 'aba_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the billing list', tool: 'aba_write_report', args: f },
  { label: 'Agent tries to submit a claim', tool: 'claim_submit', args: {} },
]);
