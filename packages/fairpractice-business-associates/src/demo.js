import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { vendors: 'vendors.csv', payments: 'ap-payments-2026.csv', settings: 'settings.json', as_of: '2026-11-15' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Business Associates', [
  { label: 'Check the vendor inventory and this year\'s payments', tool: 'baa_check', args: f, list: (i) => `${i.status.padEnd(17)} ${i.message}` },
  { label: 'Write the compliance committee list', tool: 'baa_write_report', args: f },
  { label: 'Agent tries to email a vendor', tool: 'vendor_email_send', args: {} },
]);
