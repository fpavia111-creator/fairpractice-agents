import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { changes: 'code-changes.csv', chargemaster: 'chargemaster.csv', fee_schedule: 'fee-schedule.csv', order_sets: 'order-sets.csv', open_claims: 'open-claims.csv' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Code Updates', [
  { label: 'Check an (invented) code update against the practice\'s files', tool: 'codes_check', args: f, list: (i) => `${i.status.padEnd(24)}  ${i.message}` },
  { label: 'Write the update work list', tool: 'codes_write_report', args: f },
  { label: 'Agent tries to change the chargemaster', tool: 'chargemaster_update', args: {} },
]);
