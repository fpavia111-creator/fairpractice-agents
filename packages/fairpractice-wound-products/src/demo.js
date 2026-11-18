import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { claims: 'claims.csv', usage: 'product-usage.csv', invoices: 'invoices.csv' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Wound Products', [
  { label: 'Check skin substitute claims against usage and invoices', tool: 'wound_check', args: f, list: (i) => `${i.status.padEnd(21)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the billing list', tool: 'wound_write_report', args: f },
  { label: 'Agent tries to order more product', tool: 'product_order', args: {} },
]);
