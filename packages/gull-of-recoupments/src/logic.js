// Gull logic: payer recoupments and offsets matched to original claims, notices, duplicates, lookback and appeal windows. No I/O.
import { str, num, isoDate, addDays, addMonths, daysBetween, round2, sortByStatus, countBy, idKey, payerKey } from 'kestrel-core';

const ORDER = { taken_twice: 0, over_original: 1, beyond_lookback: 2, no_notice: 3, unmatched: 4, appeal_closing: 5, appeal_open: 6 };

/**
 * recoupments: [{ payer, remit_date, claim_ref, amount, reason, check }]
 * claims: [{ claim_id, patient_id, patient_name, payer, dos, paid, paid_date }]
 * notices: [{ payer, claim_ref, notice_date, amount }]
 * opts: { asOf, appealDays = { default: 120 }, warnDays = 21, lookbackMonths = null, noticeLeadDays = 0 }
 */
export function checkRecoupments(recoupments, claims, notices = [], { asOf, appealDays = { default: 120 }, warnDays = 21, lookbackMonths = null, noticeLeadDays = 0 } = {}) {
  const items = [];
  const CL = new Map(claims.map((c) => [idKey(c.claim_id), { id: str(c.claim_id), pid: str(c.patient_id) || null, name: str(c.patient_name) || null, payer: str(c.payer), dos: isoDate(c.dos), paid: num(c.paid) || 0, paidDate: isoDate(c.paid_date), taken: 0 }]).filter(([k]) => k));
  const NO = notices.map((n) => ({ ref: idKey(n.claim_ref), pk: payerKey(n.payer), date: isoDate(n.notice_date), amount: num(n.amount) }));
  const daysFor = (payer) => { const k = Object.keys(appealDays).find((x) => x !== 'default' && payerKey(x) === payerKey(payer)); return num(appealDays[k ?? 'default']) ?? 120; };
  const R = recoupments.map((r, i) => ({ i, payer: str(r.payer), ref: idKey(r.claim_ref), refRaw: str(r.claim_ref), date: isoDate(r.remit_date), amount: Math.abs(num(r.amount) || 0), reason: str(r.reason) || null, check: str(r.check) || null })).filter((r) => r.ref && r.date).sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i);
  const seen = new Map();
  for (const r of R) {
    const c = CL.get(r.ref); const notice = NO.find((n) => n.ref === r.ref && (!n.pk || !payerKey(r.payer) || n.pk === payerKey(r.payer)) && n.date && n.date <= r.date);
    const from = notice?.date || r.date; const appealDue = addDays(from, daysFor(r.payer)); const left = daysBetween(asOf, appealDue);
    const b = { claim_id: r.refRaw, patient_id: c?.pid || null, patient_name: c?.name || null, payer: r.payer, date: r.date, recouped: r.amount, check: r.check, reason: r.reason, appeal_due: appealDue, line: r.i + 1 };
    const found = [];
    if (!c) found.push({ ...b, status: 'unmatched', amount: r.amount });
    else {
      const prev = seen.get(r.ref) || []; const before = c.taken; c.taken = round2(c.taken + r.amount);
      if (prev.length && c.taken > c.paid + 0.01) found.push({ ...b, status: 'taken_twice', original_paid: c.paid, total_taken: c.taken, earlier: prev.join(', '), amount: round2(Math.min(r.amount, c.taken - Math.max(before, c.paid))) });
      else if (r.amount > c.paid + 0.01) found.push({ ...b, status: 'over_original', original_paid: c.paid, amount: round2(r.amount - c.paid) });
      seen.set(r.ref, [...prev, r.date]);
      const paidOn = c.paidDate || c.dos;
      if (lookbackMonths && paidOn && addMonths(paidOn, lookbackMonths) < r.date) found.push({ ...b, status: 'beyond_lookback', original_paid_date: paidOn, months: lookbackMonths, amount: r.amount });
    }
    if (c && (!notice || (noticeLeadDays && daysBetween(notice.date, r.date) < noticeLeadDays))) found.push({ ...b, status: 'no_notice', notice_date: notice?.date || null, amount: r.amount });
    if (!found.length && left >= 0) found.push({ ...b, status: left <= warnDays ? 'appeal_closing' : 'appeal_open', days_left: left, amount: r.amount });
    items.push(...found.map((f) => ({ ...f, appeal_days_left: left })));
  }
  const ap = (x) => (x.appeal_days_left >= 0 ? ` Appeal by ${x.appeal_due}.` : '');
  const T = {
    taken_twice: (x) => [`${x.claim_id} (${x.payer}): taken back again on ${x.date} after ${x.earlier}; ${x.total_taken} taken against ${x.original_paid} paid.`, `Ask the payer to return the duplicate takeback.${ap(x)}`],
    over_original: (x) => [`${x.claim_id} (${x.payer}): ${x.recouped} taken back on ${x.date}, more than the ${x.original_paid} originally paid.`, `Dispute the excess with the remit and the original payment.${ap(x)}`],
    beyond_lookback: (x) => [`${x.claim_id} (${x.payer}): paid ${x.original_paid_date}, recouped ${x.date}, more than ${x.months} months later.`, `Check your state's limit on retroactive recoupment and your contract; dispute if it applies.${ap(x)}`],
    no_notice: (x) => [x.notice_date ? `${x.claim_id} (${x.payer}): recouped ${x.date}, only ${daysBetween(x.notice_date, x.date)} days after the notice of ${x.notice_date}.` : `${x.claim_id} (${x.payer}): ${x.recouped} recouped on ${x.date} with no overpayment notice on file.`, `Ask the payer for the notice and the reason; record it.${ap(x)}`],
    unmatched: (x) => [`${x.claim_id} (${x.payer}): ${x.recouped} taken back on ${x.date} for a claim not found in your paid claims.`, 'Ask the payer which claim and patient this is; it may belong to another provider.'],
    appeal_closing: (x) => [`${x.claim_id} (${x.payer}): ${x.recouped} recouped ${x.date}; the appeal window closes ${x.appeal_due} (${x.days_left} days).`, 'Decide now whether to appeal; gather the record and the original remit.'],
    appeal_open: (x) => [`${x.claim_id} (${x.payer}): ${x.recouped} recouped ${x.date}; appeal open until ${x.appeal_due} (${x.days_left} days).`, 'Review whether the overpayment finding is right before the window closes.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { recoupments: recoupments.length, total_recouped: round2(R.reduce((s, r) => s + r.amount, 0)), matched: R.filter((r) => CL.has(r.ref)).length, dollars_disputable: round2(items.filter((i) => !i.status.startsWith('appeal')).reduce((s, x) => s + (x.amount || 0), 0)), dollars_appealable: round2(items.filter((i) => i.status.startsWith('appeal')).reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
