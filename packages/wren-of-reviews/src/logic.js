// Wren logic: online review replies that could confirm someone is a patient. No I/O.
import { str, num, sortByStatus, countBy, personKey } from 'kestrel-core';

const ORDER = { confirms_patient: 0, health_detail: 1, uses_reviewer_name: 2, visit_detail: 3, needs_reply: 4 };

// Phrases that confirm a person was seen. Matched as whole phrases, case-insensitive.
export const CONFIRM_PHRASES = Object.freeze(['your visit', 'your appointment', 'your appt', 'when you came in', 'when you were here', 'when you were in', 'we saw you', 'we treated you', 'your treatment', 'your procedure', 'your surgery', 'your chart', 'your records', 'our records show', 'our records indicate', 'your account', 'your bill', 'your balance', 'your claim', 'your insurance', 'your test', 'your results', 'your lab', 'your prescription', 'your medication', 'your care', 'your provider', 'your doctor', 'your therapist', 'your session', 'your follow-up', 'your follow up', 'as your doctor', 'as our patient', 'as a patient of ours', 'during your stay', 'your discharge', 'you were seen', 'you were discharged', 'your exam', 'your x-ray', 'your mri', 'your scan', 'your cleaning', 'your filling', 'your crown', 'your child\'s visit', 'your son\'s', 'your daughter\'s', 'your mother\'s', 'your father\'s']);
export const HEALTH_WORDS = Object.freeze(['diagnosis', 'diagnosed', 'condition', 'medication', 'prescribed', 'pregnan', 'cancer', 'diabet', 'depress', 'anxiety', 'therapy', 'rehab', 'addiction', 'hiv', 'std', 'infection', 'injury', 'fracture', 'surgery', 'biopsy', 'blood pressure', 'mental health', 'substance', 'opioid', 'abortion', 'miscarriage', 'covid', 'allerg']);
const DATE_LIKE = /\b(\d{1,2}\/\d{1,2}(\/\d{2,4})?|(mon|tues|wednes|thurs|fri|satur|sun)day|yesterday|last week|this morning|at \d{1,2}(:\d{2})?\s?(am|pm)?)\b/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const found = (text, list) => list.filter((p) => new RegExp(`(^|[^a-z])${escapeRe(p)}`, 'i').test(text));

/** Problems in one reply text. */
export function replyProblems(reply, reviewer, { extraPhrases = [], extraWords = [] } = {}) {
  const t = str(reply).replace(/[’‘]/g, "'"); const out = [];
  const c = found(t, [...CONFIRM_PHRASES, ...extraPhrases]); if (c.length) out.push(['confirms_patient', c]);
  const h = found(t, [...HEALTH_WORDS, ...extraWords]); if (h.length) out.push(['health_detail', h]);
  const rk = personKey(reviewer).split(' ').filter((w) => w.length >= 3);
  const words = new Set(personKey(t).split(' '));
  if (rk.length && rk.some((w) => words.has(w))) out.push(['uses_reviewer_name', ['reviewer name']]);
  const d = DATE_LIKE.exec(t); if (d) out.push(['visit_detail', [d[0]]]);
  return out;
}

/** reviews: [{ review_id, platform, reviewer, rating, review, reply }] */
export function checkReplies(reviews, { lowRating = 2, extraPhrases = [], extraWords = [] } = {}) {
  const items = []; let withReply = 0;
  for (const [i, r] of reviews.entries()) {
    const base = { review_id: str(r.review_id) || `line ${i + 1}`, platform: str(r.platform) || null, reviewer: str(r.reviewer) || null, rating: num(r.rating), line: i + 1 };
    const reply = str(r.reply);
    if (!reply) { if (base.rating !== null && base.rating <= lowRating) items.push({ ...base, status: 'needs_reply', hits: [] }); continue; }
    withReply++;
    for (const [status, hits] of replyProblems(reply, r.reviewer, { extraPhrases, extraWords })) items.push({ ...base, status, hits });
  }
  const T = {
    confirms_patient: (x) => [`Reply to ${x.review_id} confirms the reviewer was a patient ("${x.hits.slice(0, 3).join('", "')}").`, 'Rewrite it without confirming they were seen; use wren_draft_review_reply for a safe version.'],
    health_detail: (x) => [`Reply to ${x.review_id} mentions health details (${x.hits.slice(0, 3).join(', ')}).`, 'Remove every health detail, even ones the reviewer posted first.'],
    uses_reviewer_name: (x) => [`Reply to ${x.review_id} uses the reviewer's name.`, 'Drop the name; a generic greeting is safer.'],
    visit_detail: (x) => [`Reply to ${x.review_id} mentions a day or time ("${x.hits[0]}"), which can confirm a visit.`, 'Remove dates and times.'],
    needs_reply: (x) => [`${x.review_id} is a ${x.rating}-star review with no reply.`, 'Post a short, safe reply that moves the talk offline (wren_draft_review_reply).'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'rating');
  return { reviews: reviews.length, replies_checked: withReply, risky_replies: new Set(items.filter((x) => x.status !== 'needs_reply').map((x) => x.review_id)).size, by_status: countBy(items, 'status'), items };
}

/** A reply that never confirms anyone is a patient. */
export function safeReply(rating, { practice = '[TO CONFIRM: practice name]', contact = '[TO CONFIRM: office manager phone]', lowRating = 2 } = {}) {
  if (rating !== null && rating > lowRating + 1) return `Thank you for taking the time to share your feedback. We appreciate it and will pass it along to our team.\n\n${practice}`;
  return `Thank you for your feedback. We take every comment seriously. Privacy laws do not allow us to discuss anyone's care online, so we would welcome a call: please contact our office manager at ${contact} and we will talk with you directly.\n\n${practice}`;
}
