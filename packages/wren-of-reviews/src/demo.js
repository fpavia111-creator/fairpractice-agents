import { runDemo } from 'kestrel-core';
import { manifest } from './manifest.js';

const f = { reviews: 'reviews.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Wren of Reviews', [
  { label: 'Check this month\'s draft replies', tool: 'wren_check', args: f, list: (i) => `${i.status.padEnd(19)} ${i.message}` },
  { label: 'Draft a safe reply to the one-star review', tool: 'wren_draft_review_reply', args: { ...f, review_id: 'G-104' }, approve: true },
  { label: 'Write the review list', tool: 'wren_write_report', args: f },
  { label: 'Agent tries to post a reply itself', tool: 'review_reply_publish', args: {} },
]);
