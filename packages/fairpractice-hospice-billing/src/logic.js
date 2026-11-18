// Fairpractice Hospice Billing logic: hospice notices (NOE, NOTR), benefit periods and face-to-face timing, the aggregate cap and live discharges. No I/O.
import { str, num, isoDate, daysBetween, addDays, round2, sortByStatus, countBy, listOf } from 'fairpractice-core';

const ORDER = { noe_missing: 0, noe_late: 1, notr_missing: 2, notr_late: 3, f2f_missing: 4, cap_over: 5, cap_near: 6, f2f_due: 7, live_discharge_high: 8 };
/** Benefit period lengths: two of 90 days, then 60 days each. */
export const periodDays = (n) => (n <= 2 ? 90 : 60);
/** Benefit periods from an election date, starting at period `first` (for patients who transfer in), up to a date. */
export function benefitPeriods(election, first = 1, until) {
  const out = []; let start = isoDate(election); let n = Math.max(1, Math.floor(first) || 1);
  while (start && start <= until && out.length < 200) { const end = addDays(start, periodDays(n) - 1); out.push({ n, start, end }); start = addDays(end, 1); n++; }
  return out;
}
/** The cap year (October 1 to September 30) named by the year it ends in. */
export const capYearOf = (d) => { const x = isoDate(d); if (!x) return null; const y = Number(x.slice(0, 4)); return x.slice(5) >= '10-01' ? y + 1 : y; };
export const capYearBounds = (y) => ({ start: `${y - 1}-10-01`, end: `${y}-09-30` });
const isLive = (reason) => { const s = str(reason).toLowerCase(); if (!s) return null; if (/death|died|expired|deceased/.test(s)) return false; return /revok|live|discharg|transfer|not terminal|no longer|moved|out of area|cause/.test(s) ? true : null; };

/**
 * patients: [{ patient_id, patient_name, election, noe_filed, discharge, discharge_reason, notr_filed, starting_period, f2f, cap_paid, cap_share }]
 * opts: { asOf, noeDays = 5, notrDays = 5, f2fWindow = 30, warnDays = 45, capAmount = null, capYear = capYearOf(asOf), capWarnPct = 90, dailyRate = 0, liveDischargePct = 20 }
 */
export function checkHospice(patients, { asOf, noeDays = 5, notrDays = 5, f2fWindow = 30, warnDays = 45, capAmount = null, capYear = null, capWarnPct = 90, dailyRate = 0, liveDischargePct = 20 } = {}) {
  const items = []; const cy = capYear || capYearOf(asOf); const cb = capYearBounds(cy);
  let paid = 0; let share = 0; let inCap = 0; let disc = 0; let live = 0;
  for (const [i, p] of patients.entries()) {
    const pid = str(p.patient_id) || str(p.patient_name); const election = isoDate(p.election); if (!pid || !election) continue;
    const b = { patient_id: pid, patient_name: str(p.patient_name) || null, line: i + 1, amount: 0 };
    const first = num(p.starting_period) || 1; const discharge = isoDate(p.discharge); const liveDc = discharge ? isLive(p.discharge_reason) : null;
    // NOE: within noeDays calendar days of the election; days before a late NOE are not covered.
    const noeDue = addDays(election, noeDays); const noe = isoDate(p.noe_filed);
    if (noe && noe > noeDue) { const days = daysBetween(election, noe); items.push({ ...b, date: election, status: 'noe_late', due: noeDue, filed: noe, uncovered_days: days, amount: round2(days * dailyRate) }); }
    else if (!noe && noeDue < asOf) { const last = discharge && discharge < asOf ? discharge : asOf; const days = daysBetween(election, last); items.push({ ...b, date: election, status: 'noe_missing', due: noeDue, uncovered_days: days, amount: round2(days * dailyRate) }); }
    // NOTR: after a live discharge, revocation or transfer.
    if (discharge && liveDc) {
      const due = addDays(discharge, notrDays); const notr = isoDate(p.notr_filed);
      if (notr && notr > due) items.push({ ...b, date: discharge, status: 'notr_late', due, filed: notr, days_late: daysBetween(due, notr) });
      else if (!notr && due < asOf) items.push({ ...b, date: discharge, status: 'notr_missing', due, days_late: daysBetween(due, asOf) });
    }
    // Face-to-face before each period from the third on.
    const until = discharge && discharge < addDays(asOf, warnDays) ? discharge : addDays(asOf, warnDays);
    const f2f = listOf(p.f2f).map(isoDate).filter(Boolean);
    for (const per of benefitPeriods(election, first, until)) {
      if (per.n < 3) continue;
      const ok = f2f.some((d) => d >= addDays(per.start, -f2fWindow) && d <= per.start);
      if (ok) continue;
      if (per.start <= asOf) { if (!discharge || discharge >= per.start) items.push({ ...b, date: per.start, status: 'f2f_missing', period: per.n, window_from: addDays(per.start, -f2fWindow) }); }
      else items.push({ ...b, date: per.start, status: 'f2f_due', period: per.n, window_from: addDays(per.start, -f2fWindow), days: daysBetween(asOf, per.start) });
    }
    // Cap year: payments and beneficiary share; a new election in the cap year counts as one unless a share is given.
    paid += num(p.cap_paid) || 0;
    const sh = num(p.cap_share); if (sh !== null) share += sh; else if (election >= cb.start && election <= cb.end && first === 1) share += 1;
    if (election >= cb.start && election <= cb.end) inCap++;
    // Live discharge rate over the 12 months to asOf.
    if (discharge && discharge > addDays(asOf, -365) && discharge <= asOf && liveDc !== null) { disc++; if (liveDc) live++; }
  }
  let cap = null;
  if (capAmount && share > 0) {
    const limit = round2(share * capAmount); const pct = round2((paid / limit) * 100);
    cap = { cap_year: cy, from: cb.start, to: cb.end, elected_in_year: inCap, beneficiaries: round2(share), cap_amount: capAmount, limit, paid: round2(paid), pct };
    const cb2 = { patient_id: null, patient_name: null, date: cb.end, ...cap };
    if (paid > limit) items.push({ ...cb2, status: 'cap_over', over: round2(paid - limit), amount: round2(paid - limit) });
    else if (pct >= capWarnPct) items.push({ ...cb2, status: 'cap_near', amount: 0 });
  }
  const rate = disc ? round2((live / disc) * 100) : null;
  if (rate !== null && rate > liveDischargePct) items.push({ patient_id: null, patient_name: null, date: asOf, status: 'live_discharge_high', live, discharges: disc, rate, threshold: liveDischargePct, amount: 0 });
  const T = {
    noe_missing: (x) => [`No notice of election on file for the election of ${x.date}; it was due ${x.due}. ${x.uncovered_days} day(s) are at risk so far.`, 'File the NOE today; days before it is accepted are not covered unless an exception applies.'],
    noe_late: (x) => [`The notice of election for ${x.date} was filed ${x.filed}, after the ${x.due} due date; ${x.uncovered_days} day(s) are not covered.`, 'Bill those days as provider liability, or request an exception if one applies.'],
    notr_missing: (x) => [`Live discharge or revocation on ${x.date} has no notice of termination or revocation; it was due ${x.due}.`, 'File the NOTR, or the final claim, now so the patient\'s benefit is released.'],
    notr_late: (x) => [`The notice of termination or revocation for ${x.date} was filed ${x.filed}, ${x.days_late} day(s) after ${x.due}.`, 'Note the cause and tighten the discharge checklist.'],
    f2f_missing: (x) => [`Benefit period ${x.period} started ${x.date} with no face-to-face encounter recorded between ${x.window_from} and ${x.date}.`, 'Check the chart for the encounter; without one the recertification is not valid and the period cannot be billed.'],
    cap_over: (x) => [`Cap year ${x.from} to ${x.to}: Medicare paid ${x.paid} against an estimated cap of ${x.limit} (${x.beneficiaries} beneficiaries); ${x.over} over.`, 'Confirm the beneficiary count and payments, then plan the self-determined cap report and repayment.'],
    cap_near: (x) => [`Cap year ${x.from} to ${x.to}: Medicare paid ${x.paid}, ${x.pct}% of the estimated cap of ${x.limit}.`, 'Watch admissions and length of stay; check the beneficiary count.'],
    f2f_due: (x) => [`Benefit period ${x.period} starts ${x.date} (in ${x.days} days); a face-to-face encounter is needed from ${x.window_from}.`, 'Schedule the encounter inside the window.'],
    live_discharge_high: (x) => [`${x.live} of ${x.discharges} discharges in the last 12 months were live (${x.rate}%), above your ${x.threshold}% flag.`, 'Review admission and discharge reasons; a high rate draws audits.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { patients: patients.length, cap_year: cy, cap, live_discharge_rate: rate, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
