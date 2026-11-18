// Fairpractice Home Health logic: home health 30-day periods, notices of admission, low-utilization periods, overlaps and stray visits. No I/O.
import { str, num, isoDate, daysBetween, addDays, round2, sortByStatus, countBy, yes } from 'fairpractice-core';

const ORDER = { noa_missing: 0, noa_late: 1, period_overlap: 2, visit_outside_period: 3, lupa: 4, lupa_risk: 5 };
/** Payment cut for a late NOA: one thirtieth of the period payment per day from the start of care to the filing date, capped at the payment. */
export const noaReduction = (payment, days) => round2(Math.min(payment || 0, ((payment || 0) * Math.max(0, days)) / 30));

/**
 * periods: [{ patient_id, patient_name, start, end, admission, noa_filed, lupa_threshold, payment }]
 * visits: [{ patient_id, patient_name, date, discipline }]
 * opts: { asOf, noaDays = 5, lupaDefault = 2, perVisitRate = 0, warnDays = 7 }
 */
export function checkHomeHealth(periods, visits, { asOf, noaDays = 5, lupaDefault = 2, perVisitRate = 0, warnDays = 7 } = {}) {
  const items = []; const names = new Map();
  for (const v of [...periods, ...visits]) { const pid = str(v.patient_id); if (pid && v.patient_name) names.set(pid, str(v.patient_name)); }
  const hasAdmissionCol = periods.some((p) => str(p.admission));
  const P = periods.map((p, i) => { const start = isoDate(p.start); return { i, pid: str(p.patient_id) || str(p.patient_name), start, end: isoDate(p.end) || (start ? addDays(start, 29) : null), admission: yes(p.admission), noa: isoDate(p.noa_filed), threshold: num(p.lupa_threshold) ?? lupaDefault, payment: num(p.payment) || 0, visits: 0 }; }).filter((p) => p.pid && p.start);
  const earliest = new Map(); for (const p of P) if (!earliest.has(p.pid) || p.start < earliest.get(p.pid).start) earliest.set(p.pid, p);
  const b = (p) => ({ patient_id: p.pid, patient_name: names.get(p.pid) || null, date: p.start, period_end: p.end, line: p.i + 1 });

  // Notice of admission: once per admission, within noaDays calendar days of the start of care.
  for (const p of P) {
    const needs = hasAdmissionCol ? p.admission : earliest.get(p.pid) === p; if (!needs) continue;
    const due = addDays(p.start, noaDays);
    if (p.noa && p.noa > due) { const days = daysBetween(p.start, p.noa); items.push({ ...b(p), status: 'noa_late', due, filed: p.noa, late_days: days, amount: noaReduction(p.payment, days) }); }
    else if (!p.noa && due < asOf) { const days = daysBetween(p.start, asOf); items.push({ ...b(p), status: 'noa_missing', due, late_days: days, amount: noaReduction(p.payment, days) }); }
  }
  // Overlapping periods for the same patient.
  const byPid = new Map(); for (const p of P) { if (!byPid.has(p.pid)) byPid.set(p.pid, []); byPid.get(p.pid).push(p); }
  for (const list of byPid.values()) {
    list.sort((x, y) => x.start.localeCompare(y.start));
    for (let k = 1; k < list.length; k++) { const a = list[k - 1], c = list[k]; if (c.start <= a.end) items.push({ ...b(c), status: 'period_overlap', other_start: a.start, other_end: a.end, overlap_days: daysBetween(c.start, a.end < c.end ? a.end : c.end) + 1, amount: 0 }); }
  }
  // Visits: count into each period, flag those outside every period.
  for (const [i, v] of visits.entries()) {
    const pid = str(v.patient_id) || str(v.patient_name); const d = isoDate(v.date); if (!pid || !d) continue;
    const hit = (byPid.get(pid) || []).filter((p) => p.start <= d && p.end >= d);
    hit.forEach((p) => p.visits++);
    if (!hit.length) items.push({ patient_id: pid, patient_name: names.get(pid) || null, date: d, status: 'visit_outside_period', discipline: str(v.discipline) || null, line: i + 1, amount: 0 });
  }
  // Low-utilization periods: ended under the threshold, or ending soon still under it.
  for (const p of P) {
    if (p.visits >= p.threshold) continue;
    if (p.end < asOf) items.push({ ...b(p), status: 'lupa', visits: p.visits, threshold: p.threshold, amount: perVisitRate ? round2(Math.max(0, p.payment - p.visits * perVisitRate)) : 0 });
    else if (p.start <= asOf && daysBetween(asOf, p.end) <= warnDays) items.push({ ...b(p), status: 'lupa_risk', visits: p.visits, threshold: p.threshold, days_left: daysBetween(asOf, p.end), amount: 0 });
  }
  const T = {
    noa_missing: (x) => [`No notice of admission for the start of care on ${x.date}; it was due ${x.due}. The period payment is cut by ${x.late_days}/30 so far.`, 'File the NOA today; each day adds another thirtieth to the cut unless an exception applies.'],
    noa_late: (x) => [`The notice of admission for ${x.date} was filed ${x.filed}, after ${x.due}; the period payment is cut by ${x.late_days}/30.`, 'Check the claim shows the reduction, and request an exception only if one applies.'],
    period_overlap: (x) => [`The period from ${x.date} overlaps the period ${x.other_start} to ${x.other_end} by ${x.overlap_days} day(s).`, 'Fix the period dates; the second claim will reject as a duplicate or overlap.'],
    visit_outside_period: (x) => [`A visit${x.discipline ? ` (${x.discipline})` : ''} on ${x.date} falls outside every 30-day period on file.`, 'Check the period dates or whether the visit belongs to another admission.'],
    lupa: (x) => [`The period ${x.date} to ${x.period_end} ended with ${x.visits} visit(s), under its low-utilization threshold of ${x.threshold}; it pays per visit.`, 'Confirm missed visits were documented and the threshold matches the case-mix group.'],
    lupa_risk: (x) => [`The period ${x.date} to ${x.period_end} has ${x.visits} visit(s) with ${x.days_left} day(s) left; the threshold is ${x.threshold}.`, 'Check the visit plan; schedule ordered visits that have not happened.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { periods: periods.length, visits: visits.length, patients: byPid.size, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
