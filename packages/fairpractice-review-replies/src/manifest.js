import { readFileSync } from 'node:fs';
import { medAgent, fileArg, PRACTICE_LIMITS, str, num } from 'fairpractice-core';
import { checkReplies, safeReply, replyProblems } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const REVIEW_FIELDS = Object.freeze({
  review_id: t(['Review ID', 'Review #', 'ID', 'Review'], { translate: false }),
  platform: t(['Platform', 'Site', 'Source', 'Channel']),
  reviewer: t(['Reviewer', 'Reviewer Name', 'Author', 'Name', 'Posted By'], { phi: 'name' }),
  rating: t(['Rating', 'Stars', 'Score'], { type: 'number' }),
  review: t(['Review Text', 'Text', 'Comment', 'Body', 'Content']),
  reply: t(['Reply', 'Draft Reply', 'Response', 'Our Reply', 'Proposed Reply']),
});

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  practice_name: { type: 'string', maxLength: 120, description: 'Name to sign replies with' },
  contact_phone: { type: 'string', maxLength: 40, description: 'Office manager phone (or email) to move complaints offline' },
  low_rating: { type: 'integer', minimum: 1, maximum: 4, description: 'Ratings at or below this need a reply; default 2' },
  extra_phrases: { type: 'array', maxItems: 200, items: { type: 'string' }, description: 'More phrases that confirm a visit in your specialty' },
  extra_words: { type: 'array', maxItems: 200, items: { type: 'string' }, description: 'More health words to flag' },
} };

const args = {
  reviews: fileArg('Reviews export under --root: review id, platform, reviewer, rating, review text and your draft reply'),
  settings: fileArg('Optional settings JSON: practice_name, contact_phone, low_rating, extra_phrases, extra_words'),
};
const settings = (a, ctx) => (a.settings ? ctx.readJson(a.settings, 'reviews_settings') : {});
const run = (a, ctx) => { const s = settings(a, ctx); return checkReplies(ctx.records(a.reviews, 'reviews'), { lowRating: s.low_rating ?? 2, extraPhrases: s.extra_phrases || [], extraWords: s.extra_words || [] }); };
const summary = (o) => `${o.reviews} review(s), ${o.replies_checked} draft repl(ies) checked, ${o.risky_replies} risky. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'reviews', title: 'Fairpractice Review Replies',
  description: 'Checks draft replies to online reviews for what gets practices fined: words that confirm the reviewer was a patient (your visit, your treatment, our records show), health details, the reviewer\'s name and visit dates or times, lists low-rated reviews with no reply, and writes safe generic reply drafts a person approves. Reviewer names are masked before results reach the model.',
  args, required: ['reviews'],
  sources: { reviews: { label: 'Reviews and draft replies', args: ['reviews'], fields: REVIEW_FIELDS } },
  configSchemas: { reviews_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check review replies', description: 'List draft replies that confirm a patient relationship or give health details, and low-rated reviews with no reply.' },
  report: {
    title: { en: 'Review reply privacy check', es: 'Revisión de privacidad de respuestas a reseñas', de: 'Datenschutzprüfung von Bewertungsantworten', fr: 'Contrôle de confidentialité des réponses aux avis', pt: 'Verificação de privacidade das respostas', it: 'Verifica privacy delle risposte alle recensioni', ja: '口コミ返信のプライバシー確認', zh: '评论回复隐私检查', ko: '리뷰 답글 개인정보 점검' },
    base: 'reviews',
    rows: (o) => o.items.map((i) => ({ status: i.status, review_id: i.review_id, platform: i.platform || '', reviewer: i.reviewer || '', rating: i.rating ?? '', hits: (i.hits || []).join('; '), message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'review_id', 'platform', 'rating', 'hits', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Word lists catch the usual mistakes, not every one: a person reads each reply before it is posted.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  drafts: {
    noun: 'review_reply', verb: 'post', category: 'public_post', actor: 'the person who posts replies',
    title: 'Draft a safe reply to a review',
    description: 'Write a short reply for one review that never confirms the reviewer was a patient and moves complaints offline. Marked DRAFT; nothing is posted.',
    args: { reviews: args.reviews, settings: args.settings, review_id: { type: 'string', description: 'Review id from the reviews file' } }, required: ['reviews', 'review_id'],
    build: (a, ctx) => {
      const s = settings(a, ctx);
      const r = ctx.records(a.reviews, 'reviews').find((x) => str(x.review_id) === str(a.review_id));
      if (!r) throw new Error(`review ${a.review_id} is not in the reviews file`);
      const text = safeReply(num(r.rating), { practice: s.practice_name, contact: s.contact_phone, lowRating: s.low_rating ?? 2 });
      if (replyProblems(text, r.reviewer).length) throw new Error('the safe reply failed its own check; edit practice_name or contact_phone');
      return { id: str(r.review_id), to: str(r.platform) || 'review site', text: `**To:** ${str(r.platform) || '[TO CONFIRM: review site]'}\n**Review:** ${str(r.review_id)} (${num(r.rating) ?? '?'} stars)\n\n${text}\n` };
    },
  },
  refused: [
    { name: 'review_reply_publish', category: 'public_post', description: 'Fairpractice Review Replies never posts to Google, Yelp or any review site.' },
    { name: 'reviewer_contact', category: 'binding_send', description: 'Fairpractice Review Replies never contacts a reviewer.' },
  ],
  prompt: { title: 'Safe review replies', description: 'Walks the host model through checking and drafting review replies with Fairpractice Review Replies.', text: `You are helping a practice manager reply to online reviews with fairpractice-review-replies.

Rules: never confirm that a reviewer is a patient, never repeat health details, never use their name. Fairpractice Review Replies never posts anything.

1. Call reviews_check with the reviews file and settings.
2. For each risky reply, explain the problem in one line.
3. Offer reviews_draft_review_reply for risky replies and low-rated reviews with no reply.
4. A person approves with reviews_request_post and posts it themselves.` },
});
