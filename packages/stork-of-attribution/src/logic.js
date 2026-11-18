// Stork logic: value-based attribution rosters against your own visits. No I/O.
import { str, isoDate, addMonths, round2, num, sortByStatus, countBy, personKey, idKey } from 'kestrel-core';

const ORDER = { left_out: 0, dropped: 1, wrong_provider: 2, not_seen: 3, added: 4 };
const memberKey = (r) => idKey(r.member_id) || (personKey(r.patient_name) && isoDate(r.dob) ? `${personKey(r.patient_name)}|${isoDate(r.dob)}` : '');
const provKey = (r) => idKey(r.npi) || personKey(r.provider);

/**
 * roster: [{ member_id, patient_name, dob, provider, npi }] (this month); prior: same shape (last month, optional)
 * visits: [{ patient_id, member_id, patient_name, dob, date, provider, npi, payer }]
 * opts: { asOf, lookbackMonths = 24, payerWords = [], pmpm = 0 }
 */
export function checkAttribution(roster, visits, prior = [], { asOf, lookbackMonths = 24, payerWords = [], pmpm = 0 } = {}) {
  const items = []; const since = addMonths(asOf, -lookbackMonths);
  const mine = (p) => !payerWords.length || payerWords.some((w) => str(p).toLowerCase().includes(str(w).toLowerCase()));
  const nd = (r) => (personKey(r.patient_name) && isoDate(r.dob) ? `${personKey(r.patient_name)}|${isoDate(r.dob)}` : '');
  const alias = new Map(); for (const r of [...prior, ...roster]) { const a = nd(r); const k = memberKey(r); if (a && k) alias.set(a, k); }
  const V = new Map();
  for (const v of visits) {
    const k = idKey(v.member_id) || alias.get(nd(v)) || nd(v); const d = isoDate(v.date); if (!k || !d) continue;
    const x = V.get(k) || { name: str(v.patient_name) || null, pid: str(v.patient_id) || null, last: null, recent: 0, mine: false, byProv: new Map(), provName: new Map() };
    if (!x.last || d > x.last) x.last = d;
    if (d >= since && d <= asOf) { x.recent++; const pk = provKey(v); if (pk) { x.byProv.set(pk, (x.byProv.get(pk) || 0) + 1); x.provName.set(pk, str(v.provider) || str(v.npi)); } if (mine(v.payer)) x.mine = true; }
    V.set(k, x);
  }
  const R = new Map(roster.map((r) => [memberKey(r), r]).filter(([k]) => k)); const Pr = new Map(prior.map((r) => [memberKey(r), r]).filter(([k]) => k));
  const b = (k, r, v) => ({ patient_id: v?.pid || str(r?.member_id) || null, member_id: str(r?.member_id) || null, patient_name: str(r?.patient_name) || v?.name || null, date: asOf });
  for (const [k, r] of R) {
    const v = V.get(k);
    if (!v || !v.recent) items.push({ ...b(k, r, v), status: 'not_seen', provider: str(r.provider) || str(r.npi) || null, last_visit: v?.last || null, amount: 0 });
    else {
      const top = [...v.byProv.entries()].sort((a, c) => c[1] - a[1])[0]; const ak = provKey(r);
      if (top && ak && top[0] !== ak && !v.byProv.has(ak)) items.push({ ...b(k, r, v), status: 'wrong_provider', provider: str(r.provider) || str(r.npi), seen_by: v.provName.get(top[0]), visits: top[1], amount: 0 });
    }
    if (prior.length && !Pr.has(k)) items.push({ ...b(k, r, v), status: 'added', provider: str(r.provider) || null, amount: 0 });
  }
  for (const [k, r] of Pr) { if (R.has(k)) continue; const v = V.get(k); items.push({ ...b(k, r, v), status: 'dropped', provider: str(r.provider) || null, last_visit: v?.last || null, still_active: !!(v && v.recent && v.mine), amount: v && v.recent && v.mine ? pmpm : 0 }); }
  for (const [k, v] of V) { if (R.has(k) || Pr.has(k) || !v.recent || !v.mine) continue; items.push({ patient_id: v.pid, member_id: k.includes('|') ? null : k, patient_name: v.name, date: asOf, status: 'left_out', visits: v.recent, last_visit: v.last, amount: pmpm }); }
  const T = {
    left_out: (x) => [`Active patient (${x.visits} visit(s), last ${x.last_visit}) with this payer is not on the attribution roster.`, 'Send the payer the visit history and ask for attribution; check the member ID matches.'],
    dropped: (x) => [`On last month's roster but not this month's${x.still_active ? `; still seen here (last visit ${x.last_visit})` : ''}.`, x.still_active ? 'Ask the payer why the patient was removed and send the visit history.' : 'Confirm the patient left the plan or the practice.'],
    wrong_provider: (x) => [`Attributed to ${x.provider} but seen ${x.visits} time(s) by ${x.seen_by} and never by the attributed provider.`, 'Ask the payer to reassign, or fix the PCP on file with the plan.'],
    not_seen: (x) => [x.last_visit ? `Attributed to you; last visit ${x.last_visit}, outside the lookback.` : 'Attributed to you but never seen here.', 'Invite the patient for a visit, or ask the payer to remove them if they are not your patient.'],
    added: (x) => ['New on this month\'s roster.', 'Welcome outreach and an annual visit if due.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { attributed: R.size, prior_attributed: Pr.size, active_patients: [...V.values()].filter((v) => v.recent && v.mine).length, dollars_at_risk: round2(items.reduce((s, x) => s + (num(x.amount) || 0), 0)), by_status: countBy(items, 'status'), items };
}
