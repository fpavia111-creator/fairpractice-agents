// Warbler logic: home care hours delivered against the plan of care or authorization, week by week. No I/O.
import { str, num, isoDate, addDays, daysBetween, round2, sortByStatus, countBy, codeKey, spanMinutes, weekOf } from 'kestrel-core';

const ORDER = { not_on_plan: 0, over_delivered: 1, under_delivered: 2, plan_ending: 3 };

/**
 * plans: [{ client_id, client_name, service, weekly_hours, start, end, auth_number }]
 * visits: [{ client_id, client_name, date, service, hours, minutes, clock_in, clock_out }]
 * opts: { asOf, weeks = 4, underPct = 20, warnDays = 30, rates = { service: hourly } }
 */
export function checkCarePlans(plans, visits, { asOf, weeks = 4, underPct = 20, warnDays = 30, rates = {} } = {}) {
  const items = []; const names = new Map(); const rate = (s) => num(rates[s]) || 0;
  for (const r of [...plans, ...visits]) { const id = str(r.client_id); if (id && r.client_name) names.set(id, str(r.client_name)); }
  const P = plans.map((p) => ({ cid: str(p.client_id) || str(p.client_name), service: codeKey(p.service), weekly: num(p.weekly_hours), start: isoDate(p.start), end: isoDate(p.end), auth: str(p.auth_number) || null })).filter((p) => p.cid && p.start);
  const lastWeek = addDays(weekOf(addDays(asOf, 1)), -7); // last full week ending on or before asOf
  const firstWeek = addDays(lastWeek, -7 * (weeks - 1));
  const b = (cid) => ({ client_id: cid, client_name: names.get(cid) || null });
  const hours = new Map(); const stray = new Map();
  for (const [i, v] of visits.entries()) {
    const cid = str(v.client_id) || str(v.client_name); const date = isoDate(v.date); if (!cid || !date) continue;
    const svc = codeKey(v.service); const hrs = num(v.hours) ?? ((num(v.minutes) ?? spanMinutes(v.clock_in, v.clock_out) ?? 0) / 60);
    const plan = P.find((p) => p.cid === cid && (!svc || !p.service || p.service === svc) && p.start <= date && (!p.end || p.end >= date));
    if (!plan) { const k = `${cid}|${svc}|${weekOf(date)}`; const x = stray.get(k) || { ...b(cid), date: weekOf(date), week_of: weekOf(date), service: svc || null, hours: 0, visits: 0, line: i + 1 }; x.hours = round2(x.hours + hrs); x.visits++; stray.set(k, x); continue; }
    const k = `${P.indexOf(plan)}|${weekOf(date)}`; hours.set(k, round2((hours.get(k) || 0) + hrs));
  }
  for (const x of stray.values()) items.push({ ...x, status: 'not_on_plan', amount: round2(x.hours * rate(x.service)) });
  for (const [pi, p] of P.entries()) {
    if (p.weekly === null || p.weekly === undefined) continue;
    for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7)) {
      if (p.start > w || (p.end && p.end < addDays(w, 6))) continue; // plan must cover the whole week
      const got = hours.get(`${pi}|${w}`) || 0; const base = { ...b(p.cid), date: w, week_of: w, service: p.service || null, auth_number: p.auth, authorized: p.weekly, delivered: got };
      if (got > p.weekly + 0.01) items.push({ ...base, status: 'over_delivered', over_hours: round2(got - p.weekly), amount: round2((got - p.weekly) * rate(p.service)) });
      else if (got < p.weekly * (1 - underPct / 100) - 0.01) items.push({ ...base, status: 'under_delivered', short_hours: round2(p.weekly - got), short_pct: round2(((p.weekly - got) / p.weekly) * 100), missed: round2((p.weekly - got) * rate(p.service)), amount: 0 });
    }
    if (p.end && p.end >= asOf && daysBetween(asOf, p.end) <= warnDays) {
      const next = P.some((q) => q !== p && q.cid === p.cid && q.service === p.service && q.start > p.start);
      if (!next) items.push({ ...b(p.cid), date: p.end, status: 'plan_ending', service: p.service || null, auth_number: p.auth, days: daysBetween(asOf, p.end), amount: 0 });
    }
  }
  const T = {
    not_on_plan: (x) => [`Week of ${x.week_of}: ${x.hours} hours of ${x.service || 'service'} (${x.visits} visit(s)) delivered with no plan of care or authorization covering them.`, 'Do not bill these hours until the plan is updated; check whether the service was ordered.'],
    over_delivered: (x) => [`Week of ${x.week_of}: ${x.delivered} hours of ${x.service || 'service'} delivered against ${x.authorized} authorized; ${x.over_hours} will not be paid.`, 'Ask for a plan change if the need has grown, and keep the schedule to the plan meanwhile.'],
    under_delivered: (x) => [`Week of ${x.week_of}: ${x.delivered} of ${x.authorized} authorized hours of ${x.service || 'service'} delivered (${x.short_pct}% short).`, 'Check for missed or uncovered shifts; record the reason, since the state or plan may ask about missed care.'],
    plan_ending: (x) => [`The plan or authorization ${x.auth_number || ''} for ${x.service || 'services'} ends ${x.date} (in ${x.days} days).`.replace('authorization  for', 'authorization for'), 'Start the reassessment or reauthorization now.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { plans: plans.length, clients: new Set(P.map((p) => p.cid)).size, weeks_checked: { from: firstWeek, to: lastWeek }, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), dollars_missed: round2(items.reduce((s, x) => s + (x.missed || 0), 0)), by_status: countBy(items, 'status'), items };
}
