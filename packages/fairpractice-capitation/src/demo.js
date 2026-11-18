import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { roster: 'member-roster.csv', payments: 'cap-payments.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Capitation', [
  { label: 'Reconcile August to October capitation', tool: 'capitation_check', args: f, list: (i) => `${i.status.padEnd(18)} ${String(i.amount).padStart(6)}  ${i.message}` },
  { label: 'Write the dispute list', tool: 'capitation_write_report', args: f },
  { label: 'Agent tries to send the dispute', tool: 'dispute_submit', args: {} },
]);
