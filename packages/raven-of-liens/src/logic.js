// Raven logic: personal injury liens and letters of protection. No I/O.
import { str, num, isoDate, daysBetween, addDays, addMonths, round2, sortByStatus, countBy, yes } from 'kestrel-core';

const ORDER = { settled_not_paid: 0, case_dropped: 1, statute_passed: 2, no_lop: 3, reduction_over_limit: 4, statute_near: 5, stale_case: 6 };
const stateOf = (v) => { const s = str(v).toLowerCase(); if (/settl|closed.*paid|resolved|verdict|won/.test(s)) return 'settled'; if (/drop|withdr|lost|denied|declin|abandon|no case/.test(s)) return 'dropped'; if (/paid in full|paid/.test(s)) return 'paid'; return 'open'; };

/**
 * cases: [{ patient_id, patient_name, case_id, attorney, injury_date, state, lop_signed, charges, paid, reduction_pct, status, settled_date, last_update, suit_filed }]
 * opts: { asOf, statuteYears = { default: 2 }, warnDays = 60, payDays = 30, staleDays = 90, maxReductionPct = 33 }
 */
export function checkLiens(cases, { asOf, statuteYears = { default: 2 }, warnDays = 60, payDays = 30, staleDays = 90, maxReductionPct = 33 } = {}) {
  const items = []; const byAtt = new Map();
  for (const [i, c] of cases.entries()) {
    const pid = str(c.patient_id) || str(c.patient_name); if (!pid) continue;
    const charges = num(c.charges) || 0; const paid = num(c.paid) || 0; const redPct = num(c.reduction_pct) || 0; const reduction = round2((charges * redPct) / 100);
    const balance = round2(Math.max(0, charges - paid - reduction)); const st = stateOf(c.status); const att = str(c.attorney) || '(no attorney)';
    const b = { patient_id: pid, patient_name: str(c.patient_name) || null, case_id: str(c.case_id) || null, attorney: att, charges, balance, line: i + 1 };
    if (st === 'open') { const a = byAtt.get(att) || { attorney: att, cases: 0, balance: 0 }; a.cases++; a.balance = round2(a.balance + balance); byAtt.set(att, a); }
    const settled = isoDate(c.settled_date);
    if (st === 'settled' && balance > 0 && settled && addDays(settled, payDays) < asOf) items.push({ ...b, date: settled, status: 'settled_not_paid', days: daysBetween(settled, asOf), amount: balance });
    if (st === 'dropped' && balance > 0) items.push({ ...b, date: isoDate(c.settled_date) || isoDate(c.last_update) || asOf, status: 'case_dropped', amount: balance });
    if (redPct > maxReductionPct && (st === 'settled' || st === 'paid' || st === 'open')) items.push({ ...b, date: settled || isoDate(c.last_update) || asOf, status: 'reduction_over_limit', reduction_pct: redPct, reduction, limit: maxReductionPct, amount: round2(((redPct - maxReductionPct) * charges) / 100) });
    if (st !== 'open') continue;
    if (!isoDate(c.lop_signed) && charges > 0) items.push({ ...b, date: isoDate(c.injury_date) || asOf, status: 'no_lop', amount: balance });
    const inj = isoDate(c.injury_date); const yrs = num(statuteYears[str(c.state).toUpperCase()]) ?? num(statuteYears.default);
    if (inj && yrs && !yes(c.suit_filed)) {
      const ends = addMonths(inj, Math.round(yrs * 12)); const d = daysBetween(asOf, ends);
      if (d < 0) items.push({ ...b, date: ends, status: 'statute_passed', days: -d, amount: balance });
      else if (d <= warnDays) items.push({ ...b, date: ends, status: 'statute_near', days: d, amount: 0 });
    }
    const upd = isoDate(c.last_update);
    if (!upd || daysBetween(upd, asOf) > staleDays) items.push({ ...b, date: upd || inj || asOf, status: 'stale_case', days: upd ? daysBetween(upd, asOf) : null, amount: 0 });
  }
  const T = {
    settled_not_paid: (x) => [`Case ${x.case_id || ''} settled ${x.date} (${x.days} days ago) and ${x.balance} is still unpaid.`.replace('Case  ', 'Case '), `Ask ${x.attorney} for the settlement statement and the payment date.`],
    case_dropped: (x) => [`Case ${x.case_id || ''} was dropped or lost with ${x.balance} open.`.replace('Case  ', 'Case '), 'Decide with the patient how the balance will be paid (health plan, patient, payment plan) under your policy.'],
    statute_passed: (x) => [`The filing window you set ended ${x.date} (${x.days} days ago) and no suit is recorded; ${x.balance} is open.`, `Ask ${x.attorney} whether suit was filed or the case settled; if not, move the balance off the lien.`],
    no_lop: (x) => [`Open case with ${x.charges} billed and no letter of protection or lien on file.`, `Get the signed letter from ${x.attorney} before more care is billed to the case.`],
    reduction_over_limit: (x) => [`A ${x.reduction_pct}% reduction (${x.reduction}) was accepted, above your ${x.limit}% limit.`, 'Check who approved it; record the approval with the case.'],
    statute_near: (x) => [`The filing window you set ends ${x.date} (in ${x.days} days) and no suit is recorded.`, `Ask ${x.attorney} for the case status now.`],
    stale_case: (x) => [x.days === null ? 'No case update is on file.' : `No case update in ${x.days} days.`, `Ask ${x.attorney} for a status update.`],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  const attorneys = [...byAtt.values()].sort((a, b) => b.balance - a.balance);
  return { cases: cases.length, open_cases: attorneys.reduce((s, a) => s + a.cases, 0), open_balance: round2(attorneys.reduce((s, a) => s + a.balance, 0)), attorneys, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
