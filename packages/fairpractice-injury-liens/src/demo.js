import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { cases: 'lien-cases.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Injury Liens', [
  { label: 'Check every lien and LOP case', tool: 'liens_check', args: f, list: (i) => `${i.status.padEnd(21)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the case list with balances by attorney', tool: 'liens_write_report', args: f },
  { label: 'Agent tries to accept a reduction', tool: 'reduction_accept', args: {} },
]);
