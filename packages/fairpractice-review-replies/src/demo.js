import { runDemo } from 'fairpractice-core';
import { manifest } from './manifest.js';

const f = { reviews: 'reviews.csv', settings: 'settings.json' };
export const demo = () => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairpractice Review Replies', [
  { label: 'Check this month\'s draft replies', tool: 'reviews_check', args: f, list: (i) => `${i.status.padEnd(19)} ${i.message}` },
  { label: 'Draft a safe reply to the one-star review', tool: 'reviews_draft_review_reply', args: { ...f, review_id: 'G-104' }, approve: true },
  { label: 'Write the review list', tool: 'reviews_write_report', args: f },
  { label: 'Agent tries to post a reply itself', tool: 'review_reply_publish', args: {} },
]);
