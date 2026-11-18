import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { claims: 'claims.csv', usage: 'product-usage.csv', invoices: 'invoices.csv' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Ibis of Wound Products', [
  { label: 'Check skin substitute claims against usage and invoices', tool: 'ibis_check', args: f, list: (i) => `${i.status.padEnd(21)} ${String(i.amount).padStart(7)}  ${i.message}` },
  { label: 'Write the billing list', tool: 'ibis_write_report', args: f },
  { label: 'Agent tries to order more product', tool: 'product_order', args: {} },
]);
