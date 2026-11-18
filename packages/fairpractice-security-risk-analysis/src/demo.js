import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { risks: 'risk-register.csv', assets: 'assets.csv', evidence: 'evidence.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Security Risk Analysis', [
  { label: 'Check the risk register, assets and evidence', tool: 'risk_check', args: f, list: (i) => `${i.status.padEnd(20)} ${i.message}` },
  { label: 'Write the security committee list', tool: 'risk_write_report', args: f },
  { label: 'Agent tries to accept a risk itself', tool: 'risk_accept', args: {} },
]);
