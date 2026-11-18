// Domain checks: what makes a review reply unsafe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyProblems, checkReplies, safeReply } from '../src/logic.js';

const kinds = (t, who = 'Ann Smith') => replyProblems(t, who).map(([k]) => k);

test('phrases that confirm a visit, with curly apostrophes and any case', () => {
  assert.deepEqual(kinds('So sorry about YOUR APPOINTMENT.'), ['confirms_patient']);
  assert.deepEqual(kinds('We hope your daughter’s visit went better next time.'), ['confirms_patient']);
  assert.deepEqual(kinds('Thanks for the feedback, we will share it.'), []);
});

test('health words, including word stems', () => {
  assert.deepEqual(kinds('Glad you were diagnosed early.'), ['health_detail']);
  assert.deepEqual(kinds('Pregnancy care matters to us.'), ['health_detail']);
});

test('the reviewer name (first or last), but not short or partial words', () => {
  assert.deepEqual(kinds('Thanks Ann!'), ['uses_reviewer_name']);
  assert.deepEqual(kinds('Thanks for the annual feedback.'), [], 'a name inside another word does not count');
  assert.deepEqual(kinds('Thank you, Smith family.'), ['uses_reviewer_name']);
  assert.deepEqual(kinds('Thank you, Smithson.'), []);
});

test('dates and times', () => {
  assert.deepEqual(kinds('Sorry about the wait on 3/14.'), ['visit_detail']);
  assert.deepEqual(kinds('Sorry about the wait yesterday.'), ['visit_detail']);
});

test('low ratings with no reply need one; high ratings with no reply do not', () => {
  const r = checkReplies([{ review_id: 'A', rating: 2 }, { review_id: 'B', rating: 3 }, { review_id: 'C', rating: '' }]);
  assert.deepEqual(r.items.map((i) => [i.review_id, i.status]), [['A', 'needs_reply']]);
});

test('safe replies pass their own check, for low and high ratings', () => {
  for (const r of [1, 2, 5, null]) assert.deepEqual(replyProblems(safeReply(r, { practice: 'Clinic', contact: '555-0100' }), 'Ann Smith'), []);
  assert.match(safeReply(1), /TO CONFIRM/);
});
