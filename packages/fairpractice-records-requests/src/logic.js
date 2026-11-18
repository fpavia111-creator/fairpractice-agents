// Fairpractice Records Requests logic: patient right-of-access requests against the response clock and fee limits. No I/O.
import { str, num, isoDate, addDays, daysBetween, yes, round2, sortByStatus, countBy } from 'fairpractice-core';

const ORDER = { past_due: 0, fulfilled_late: 1, extension_no_notice: 2, denial_no_reason: 3, fee_over_limit: 4, due_soon: 5 };

/** Fee allowed for a request under the settings: a flat fee for electronic copies when chosen, else per page plus postage, capped. */
export function feeAllowed(r, { flatFee = null, perPage = null, base = 0, cap = null } = {}) {
  const electronic = /electr|portal|email|e-mail|usb|cd|digital/i.test(str(r.format));
  let allowed = null;
  if (electronic && flatFee !== null) allowed = flatFee;
  else if (perPage !== null && num(r.pages) !== null) allowed = round2(base + perPage * num(r.pages) + (num(r.postage) || 0));
  if (cap !== null) allowed = allowed === null ? cap : Math.min(allowed, cap);
  return allowed;
}

/**
 * rows: [{ request_id, patient_id, patient_name, received, requester_type, format, pages, extended, extension_notice_on, fulfilled, denied, denial_reason, fee, postage }]
 * opts: { asOf, responseDays = 30, extensionDays = 30, warnDays = 7, fees: { flatFee, perPage, base, cap } }
 */
export function checkAccess(rows, { asOf, responseDays = 30, extensionDays = 30, warnDays = 7, fees = {} } = {}) {
  const items = []; let open = 0; let closed = 0; const turnaround = [];
  for (const [i, r] of rows.entries()) {
    const rec = isoDate(r.received); if (!rec) continue;
    const firstDue = addDays(rec, responseDays);
    const ext = yes(r.extended) || !!isoDate(r.extension_notice_on);
    const notice = isoDate(r.extension_notice_on);
    const due = ext ? addDays(firstDue, extensionDays) : firstDue;
    const done = isoDate(r.fulfilled) || (yes(r.denied) ? isoDate(r.denied_on) || isoDate(r.fulfilled) : null);
    const base = { request_id: str(r.request_id) || `line ${i + 1}`, patient_id: str(r.patient_id) || null, patient_name: str(r.patient_name) || null, received: rec, due, fulfilled: done, requester_type: str(r.requester_type) || null, line: i + 1 };
    const deniedUndated = yes(r.denied) && !done;
    if (done) { closed++; turnaround.push(daysBetween(rec, done)); } else if (deniedUndated) closed++; else open++;
    if (ext && (!notice || notice > firstDue)) items.push({ ...base, status: 'extension_no_notice', days: notice ? daysBetween(firstDue, notice) : null, amount: 0 });
    if (!done && !deniedUndated && asOf > due) items.push({ ...base, status: 'past_due', days: daysBetween(due, asOf), amount: 0 });
    else if (!done && !deniedUndated && daysBetween(asOf, due) <= warnDays) items.push({ ...base, status: 'due_soon', days: daysBetween(asOf, due), amount: 0 });
    if (done && done > due) items.push({ ...base, status: 'fulfilled_late', days: daysBetween(due, done), amount: 0 });
    if (yes(r.denied) && !str(r.denial_reason)) items.push({ ...base, status: 'denial_no_reason', days: null, amount: 0 });
    const fee = num(r.fee);
    if (fee !== null && fee > 0) {
      const allowed = feeAllowed(r, fees);
      if (allowed !== null && fee > allowed + 0.005) items.push({ ...base, status: 'fee_over_limit', days: null, fee, fee_allowed: allowed, amount: round2(fee - allowed) });
    }
  }
  const T = {
    past_due: (x) => [`Request ${x.request_id} received ${x.received} was due ${x.due} and is ${x.days} day(s) late.`, 'Send the records now; late access is the most common reason for an OCR fine.'],
    fulfilled_late: (x) => [`Request ${x.request_id} was answered ${x.fulfilled}, ${x.days} day(s) after the ${x.due} deadline.`, 'Note the cause in the log and fix the step that slowed it.'],
    extension_no_notice: (x) => [`Request ${x.request_id} was extended without a written notice inside the first ${'30'} days${x.days ? ` (notice ${x.days} day(s) late)` : ''}.`, 'An extension needs a written notice with the reason and the new date before the first deadline.'],
    denial_no_reason: (x) => [`Request ${x.request_id} was denied with no reason recorded.`, 'A denial needs a written reason and, where it applies, review rights.'],
    fee_over_limit: (x) => [`Request ${x.request_id} was charged ${x.fee}; your fee settings allow ${x.fee_allowed}.`, 'Refund the difference and correct the fee method.'],
    due_soon: (x) => [`Request ${x.request_id} is due ${x.due} (in ${x.days} day(s)).`, 'Finish it, or send a written extension notice before the deadline.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m.replace("'30'", String(responseDays)).replace(`first 30 days`, `first ${responseDays} days`); it.fix = f; }
  sortByStatus(items, ORDER, 'days');
  const avg = turnaround.length ? round2(turnaround.reduce((s, x) => s + x, 0) / turnaround.length) : null;
  return { requests: rows.length, open, closed, average_days_to_answer: avg, overcharged: round2(items.filter((i) => i.status === 'fee_over_limit').reduce((s, x) => s + x.amount, 0)), by_status: countBy(items, 'status'), items };
}
