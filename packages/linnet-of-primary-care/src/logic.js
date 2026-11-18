// Linnet logic: advanced primary care management (APCM) monthly codes against tiers, consent, conflicts and enrollment. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, monthOf, yes, monthBounds } from 'kestrel-core';

const ORDER = { not_enrolled: 0, no_consent: 1, billed_twice: 2, conflict_code: 3, wrong_tier: 4, enrolled_not_billed: 5 };
export const APCM = Object.freeze(['G0556', 'G0557', 'G0558']);
/** Default codes not billed in the same month as APCM by the same practice: chronic and principal care management and transitional care management. */
export const DEFAULT_CONFLICTS = Object.freeze(['99490', '99439', '99487', '99489', '99491', '99437', '99424', '99425', '99426', '99427', '99495', '99496']);
/** APCM level from the number of chronic conditions and qualified Medicare beneficiary status. */
export const tierFor = (conditions, qmb) => { if (conditions === null || conditions === undefined) return null; if (conditions >= 2) return qmb ? 'G0558' : 'G0557'; return 'G0556'; };

/**
 * patients: [{ patient_id, patient_name, conditions, qmb, tier, consent_date, start, end }]
 * claims: [{ patient_id, patient_name, date, cpt, units }]
 * opts: { month, rates = {}, conflicts = DEFAULT_CONFLICTS }
 */
export function checkApcm(patients, claims, { month, rates = {}, conflicts = DEFAULT_CONFLICTS } = {}) {
  const items = []; const names = new Map(); const rate = (c) => num(rates[c]) || 0; const mb = monthBounds(month);
  for (const r of [...patients, ...claims]) { const pid = str(r.patient_id); if (pid && r.patient_name) names.set(pid, str(r.patient_name)); }
  const roster = new Map(patients.map((p) => { const pid = str(p.patient_id) || str(p.patient_name); const conditions = num(p.conditions); const tier = codeKey(p.tier) || tierFor(conditions, yes(p.qmb)); return [pid, { pid, tier, conditions, consent: isoDate(p.consent_date), start: isoDate(p.start), end: isoDate(p.end) }]; }));
  const byPid = new Map();
  for (const [i, c] of claims.entries()) { const pid = str(c.patient_id) || str(c.patient_name); if (!pid || monthOf(c.date) !== month) continue; if (!byPid.has(pid)) byPid.set(pid, []); byPid.get(pid).push({ i, date: isoDate(c.date), cpt: codeKey(c.cpt), units: num(c.units) ?? 1 }); }
  const conf = new Set(conflicts.map(codeKey));
  const b = (pid) => ({ patient_id: pid, patient_name: names.get(pid) || null, month, date: mb.start });
  let unbilled = 0;
  for (const [pid, lines] of byPid) {
    const ap = lines.filter((l) => APCM.includes(l.cpt)); if (!ap.length) continue;
    const r = roster.get(pid); const value = round2(ap.reduce((s, l) => s + rate(l.cpt) * l.units, 0));
    const enrolled = r && (!r.start || r.start <= mb.end) && (!r.end || r.end >= mb.start);
    if (!enrolled) { items.push({ ...b(pid), status: 'not_enrolled', cpt: ap.map((l) => l.cpt).join(' '), amount: value }); continue; }
    if (!r.consent || r.consent > mb.end) items.push({ ...b(pid), status: 'no_consent', cpt: ap[0].cpt, amount: value });
    const units = ap.reduce((s, l) => s + l.units, 0);
    if (units > 1) items.push({ ...b(pid), status: 'billed_twice', cpt: ap.map((l) => l.cpt).join(' '), units, amount: round2(value - rate(ap[0].cpt)) });
    const clash = [...new Set(lines.filter((l) => conf.has(l.cpt)).map((l) => l.cpt))];
    if (clash.length) items.push({ ...b(pid), status: 'conflict_code', cpt: ap[0].cpt, conflicts: clash.join(' '), amount: round2(lines.filter((l) => conf.has(l.cpt)).reduce((s, l) => s + rate(l.cpt) * l.units, 0)) });
    if (r.tier && ap[0].cpt !== r.tier) { const diff = round2(rate(ap[0].cpt) - rate(r.tier)); items.push({ ...b(pid), status: 'wrong_tier', cpt: ap[0].cpt, expected: r.tier, conditions: r.conditions, direction: diff > 0 ? 'over' : 'under', amount: Math.max(0, diff), missed: Math.max(0, -diff) }); unbilled += Math.max(0, -diff); }
  }
  for (const r of roster.values()) {
    if (!r.pid || !r.consent || r.consent > mb.end || (r.start && r.start > mb.end) || (r.end && r.end < mb.start)) continue;
    if ((byPid.get(r.pid) || []).some((l) => APCM.includes(l.cpt))) continue;
    const code = r.tier || 'G0556'; const missed = rate(code); unbilled += missed;
    items.push({ ...b(r.pid), status: 'enrolled_not_billed', cpt: code, missed, amount: 0 });
  }
  const T = {
    not_enrolled: (x) => [`${x.month}: ${x.cpt} billed for a patient not enrolled in APCM that month.`, 'Enroll the patient (with consent) first, or remove the code.'],
    no_consent: (x) => [`${x.month}: ${x.cpt} billed with no APCM consent on file by month end.`, 'Get and record consent; hold the code until then.'],
    billed_twice: (x) => [`${x.month}: APCM billed ${x.units} times (${x.cpt}); it is billed once a month.`, 'Remove the extra line.'],
    conflict_code: (x) => [`${x.month}: ${x.cpt} billed with ${x.conflicts}; the rules do not allow these in the same month as APCM.`, 'Keep APCM or the other care management code, not both.'],
    wrong_tier: (x) => [`${x.month}: ${x.cpt} billed but the patient's record points to ${x.expected}${x.conditions !== null && x.conditions !== undefined ? ` (${x.conditions} chronic condition(s))` : ''}.`, x.direction === 'over' ? `Bill ${x.expected}; the higher level needs the conditions or status on record.` : `Bill ${x.expected} if the record supports it.`],
    enrolled_not_billed: (x) => [`${x.month}: enrolled and consented, but no APCM billed (expected ${x.cpt}).`, 'Bill the month if the practice provided APCM services, or end the enrollment.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { month, enrolled: roster.size, billed_patients: [...byPid.values()].filter((ls) => ls.some((l) => APCM.includes(l.cpt))).length, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), dollars_unbilled: round2(unbilled), by_status: countBy(items, 'status'), items };
}
