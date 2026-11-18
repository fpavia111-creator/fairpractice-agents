// Fairpractice EVV Claims logic: electronic visit verification (EVV) against Medicaid home care claims. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, spanMinutes, yes, personKey, idKey } from 'fairpractice-core';

const ORDER = { no_evv: 0, units_over_verified: 1, caregiver_mismatch: 2, location_mismatch: 3, manual_edits_high: 4 };
/** Units for verified minutes: 'down' (whole units only), 'midpoint' (a unit counts from half of it) or 'up'. */
export function unitsFor(minutes, unit = 15, rounding = 'midpoint') {
  if (minutes === null || minutes === undefined) return null;
  if (rounding === 'down') return Math.floor(minutes / unit);
  if (rounding === 'up') return Math.ceil(minutes / unit);
  return Math.floor(minutes / unit) + (minutes % unit >= Math.ceil(unit / 2) ? 1 : 0);
}
const isNo = (v) => /^(n|no|false|0|fail|failed|mismatch|outside|exception)$/i.test(str(v));
const cgKey = (id, name) => idKey(id) || personKey(name);

/**
 * visits: [{ client_id, client_name, caregiver_id, caregiver_name, date, clock_in, clock_out, minutes, service, location_ok, distance, manual }]
 * claims: [{ client_id, client_name, date, service, units, caregiver_id, caregiver_name, amount }]
 * opts: { unitMinutes = 15, rounding = 'midpoint', maxDistance = null, maxManualPct = 10, minVisits = 3 }
 */
export function checkEvv(visits, claims, { unitMinutes = 15, rounding = 'midpoint', maxDistance = null, maxManualPct = 10, minVisits = 3 } = {}) {
  const items = []; const names = new Map(); const cgNames = new Map();
  for (const r of [...visits, ...claims]) { const id = str(r.client_id); if (id && r.client_name) names.set(id, str(r.client_name)); const ck = cgKey(r.caregiver_id, r.caregiver_name); if (ck && r.caregiver_name) cgNames.set(ck, str(r.caregiver_name)); }
  const V = visits.map((v, i) => ({ i, cid: str(v.client_id) || str(v.client_name), date: isoDate(v.date), service: codeKey(v.service), cg: cgKey(v.caregiver_id, v.caregiver_name), cgName: str(v.caregiver_name) || str(v.caregiver_id), minutes: num(v.minutes) ?? spanMinutes(v.clock_in, v.clock_out), locBad: isNo(v.location_ok) || (maxDistance !== null && num(v.distance) !== null && num(v.distance) > maxDistance), distance: num(v.distance), manual: yes(v.manual) || /manual|edit|adjust/i.test(str(v.manual)), used: false })).filter((v) => v.cid && v.date);
  const b = (cid, date) => ({ client_id: cid, client_name: names.get(cid) || null, date });
  for (const [i, c] of claims.entries()) {
    const cid = str(c.client_id) || str(c.client_name); const date = isoDate(c.date); const service = codeKey(c.service); if (!cid || !date) continue;
    const units = num(c.units) ?? 0; const amount = num(c.amount) ?? 0; const perUnit = units ? amount / units : 0;
    const match = V.filter((v) => v.cid === cid && v.date === date && (!v.service || !service || v.service === service));
    const base = { ...b(cid, date), service: service || null, units, line: i + 1 };
    if (!match.length) { items.push({ ...base, status: 'no_evv', amount }); continue; }
    match.forEach((v) => { v.used = true; });
    const mins = match.reduce((s, v) => s + (v.minutes || 0), 0); const ok = unitsFor(mins, unitMinutes, rounding);
    if (units > ok) items.push({ ...base, status: 'units_over_verified', verified_minutes: mins, verified_units: ok, over_units: units - ok, amount: round2((units - ok) * perUnit) });
    const ck = cgKey(c.caregiver_id, c.caregiver_name);
    if (ck && !match.some((v) => v.cg === ck)) items.push({ ...base, status: 'caregiver_mismatch', billed_caregiver: str(c.caregiver_name) || str(c.caregiver_id), verified_caregiver: match.map((v) => v.cgName).join(', '), amount });
    const bad = match.filter((v) => v.locBad);
    if (bad.length) items.push({ ...base, status: 'location_mismatch', distance: bad[0].distance, amount });
  }
  // Manual edits per caregiver.
  const per = new Map(); for (const v of V) { if (!v.cg) continue; const x = per.get(v.cg) || { visits: 0, manual: 0 }; x.visits++; if (v.manual) x.manual++; per.set(v.cg, x); }
  for (const [cg, x] of per) { const pct = round2((x.manual / x.visits) * 100); if (x.visits >= minVisits && pct > maxManualPct) items.push({ client_id: null, client_name: null, date: null, caregiver: cgNames.get(cg) || cg, status: 'manual_edits_high', visits: x.visits, manual: x.manual, pct, limit: maxManualPct, amount: 0 }); }
  const T = {
    no_evv: (x) => [`${x.service || 'Service'} on ${x.date} (${x.units} units) has no EVV visit.`, 'Hold the claim; find the visit or record it through your state\'s exception process before billing.'],
    units_over_verified: (x) => [`${x.service || 'Service'} on ${x.date}: ${x.units} units billed, ${x.verified_minutes} verified minutes support ${x.verified_units}.`, `Bill ${x.verified_units} units, or correct the visit through the exception process if the time was really worked.`],
    caregiver_mismatch: (x) => [`${x.service || 'Service'} on ${x.date} was billed under ${x.billed_caregiver} but verified by ${x.verified_caregiver}.`, 'Bill under the caregiver who did the visit.'],
    location_mismatch: (x) => [`The visit on ${x.date} was verified away from the client's address${x.distance !== null && x.distance !== undefined ? ` (${x.distance} away)` : ''}.`, 'Check the reason (community outing, wrong address on file) and record it before billing.'],
    manual_edits_high: (x) => [`${x.caregiver}: ${x.manual} of ${x.visits} visits (${x.pct}%) were entered or edited by hand, above your ${x.limit}% limit.`, 'Check the caregiver\'s phone or app, retrain on clocking in, and review the edits.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { visits: visits.length, claim_lines: claims.length, clients: new Set(V.map((v) => v.cid)).size, unbilled_visits: V.filter((v) => !v.used).length, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
