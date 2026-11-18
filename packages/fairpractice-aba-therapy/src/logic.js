// Fairpractice ABA Therapy logic: ABA therapy sessions against authorizations, unit rules and supervision. No I/O.
import { str, num, isoDate, daysBetween, round2, weekOf, spanMinutes, durationMinutes, sortByStatus, countBy, codeKey } from 'fairpractice-core';

const ORDER = { no_auth: 0, over_auth_total: 1, over_weekly: 2, units_over_minutes: 3, wrong_provider_role: 4, supervision_low: 5, auth_ending_unused: 6 };
/** 15-minute units a session supports: a unit counts once more than half of it (8 minutes) is done. */
export const unitsFor = (minutes, unit = 15) => (minutes === null || minutes === undefined ? null : Math.floor((minutes + Math.floor(unit / 2)) / unit));
const roleOf = (v) => { const s = str(v).toUpperCase().replace(/[^A-Z]/g, ''); if (/BCBAD|BCBA$|^BCBA|LBA|QHP/.test(s)) return 'bcba'; if (/BCABA/.test(s)) return 'bcaba'; if (/RBT|TECH|BT$|BEHAVIORTECH/.test(s)) return 'rbt'; return s ? 'other' : null; };

/**
 * sessions: [{ patient_id, patient_name, date, start, end, minutes, cpt, units, provider, provider_role, auth_number }]
 * auths: [{ patient_id, auth_number, cpt, units, weekly_units, start, end }]
 * opts: { asOf, unitMinutes = 15, supervisionPct = 5, directCodes, supervisionCodes, qhpOnly, rates = { cpt: rate }, warnDays = 30, unusedPct = 25 }
 */
export function checkAba(sessions, auths, { asOf, unitMinutes = 15, supervisionPct = 5, directCodes = ['97153', '97154'], supervisionCodes = ['97155'], qhpOnly = ['97151', '97155', '97156', '97157'], rates = {}, warnDays = 30, unusedPct = 25 } = {}) {
  const items = [];
  const A = auths.map((a, i) => ({ i, patient: str(a.patient_id), number: str(a.auth_number) || `auth ${i + 1}`, cpt: codeKey(a.cpt), units: num(a.units), weekly: num(a.weekly_units), start: isoDate(a.start), end: isoDate(a.end), used: 0, weeks: new Map(), name: null }));
  const rate = (cpt) => num(rates[cpt]) || 0;
  const names = new Map();
  const sorted = sessions.map((s, i) => ({ ...s, _i: i })).sort((a, b) => (isoDate(a.date) || '').localeCompare(isoDate(b.date) || '') || a._i - b._i);
  const sup = new Map(); // patient|month -> { direct, supervised }
  for (const s of sorted) {
    const date = isoDate(s.date); const cpt = codeKey(s.cpt); const pid = str(s.patient_id) || str(s.patient_name); if (!date || !cpt || !pid) continue;
    if (s.patient_name) names.set(pid, str(s.patient_name));
    const mins = num(s.minutes) ?? durationMinutes(s.minutes) ?? spanMinutes(s.start, s.end);
    const units = num(s.units) ?? unitsFor(mins, unitMinutes) ?? 0;
    const base = { patient_id: pid, patient_name: names.get(pid) || null, date, cpt, units, provider: str(s.provider) || null, line: s._i + 1 };
    const allowed = unitsFor(mins, unitMinutes);
    if (allowed !== null && units > allowed) items.push({ ...base, status: 'units_over_minutes', minutes: mins, allowed_units: allowed, amount: round2((units - allowed) * rate(cpt)) });
    const role = roleOf(s.provider_role);
    if (qhpOnly.includes(cpt) && role === 'rbt') items.push({ ...base, status: 'wrong_provider_role', role: str(s.provider_role), amount: round2(units * rate(cpt)) });
    const m = date.slice(0, 7); const k = `${pid}|${m}`; const sp = sup.get(k) || { pid, month: m, direct: 0, supervised: 0 };
    if (directCodes.includes(cpt) && role !== 'bcba') sp.direct += (mins ?? units * unitMinutes);
    if (supervisionCodes.includes(cpt) && role === 'bcba') sp.supervised += (mins ?? units * unitMinutes);
    sup.set(k, sp);
    const auth = A.find((a) => a.patient === pid && (!a.cpt || a.cpt === cpt) && a.start && a.start <= date && (!a.end || a.end >= date) && (!str(s.auth_number) || a.number === str(s.auth_number)));
    if (!auth) { items.push({ ...base, status: 'no_auth', amount: round2(units * rate(cpt)) }); continue; }
    const before = auth.used; auth.used += units;
    if (auth.units !== null && auth.used > auth.units) { const over = Math.min(units, auth.used - Math.max(before, auth.units)); items.push({ ...base, status: 'over_auth_total', auth_number: auth.number, over_units: over, amount: round2(over * rate(cpt)) }); }
    if (auth.weekly !== null) {
      const w = weekOf(date); const wb = auth.weeks.get(w) || 0; const wa = wb + units; auth.weeks.set(w, wa);
      if (wa > auth.weekly) { const over = Math.min(units, wa - Math.max(wb, auth.weekly)); items.push({ ...base, status: 'over_weekly', auth_number: auth.number, week_of: w, over_units: over, amount: round2(over * rate(cpt)) }); }
    }
  }
  for (const sp of sup.values()) {
    if (!sp.direct) continue;
    const pct = round2((sp.supervised / sp.direct) * 100);
    if (pct < supervisionPct) items.push({ patient_id: sp.pid, patient_name: names.get(sp.pid) || null, date: `${sp.month}-01`, month: sp.month, cpt: null, units: null, status: 'supervision_low', supervision_pct: pct, direct_hours: round2(sp.direct / 60), supervised_hours: round2(sp.supervised / 60), amount: 0 });
  }
  for (const a of A) {
    if (!a.end || a.units === null || a.end < asOf || daysBetween(asOf, a.end) > warnDays) continue;
    const left = a.units - a.used; const pctLeft = round2((left / a.units) * 100);
    if (pctLeft >= unusedPct) items.push({ patient_id: a.patient, patient_name: names.get(a.patient) || null, date: a.end, cpt: a.cpt || null, units: left, status: 'auth_ending_unused', auth_number: a.number, units_left: left, pct_left: pctLeft, days: daysBetween(asOf, a.end), amount: 0 });
  }
  const T = {
    no_auth: (x) => [`${x.cpt} on ${x.date} (${x.units} units) is not covered by any authorization for this client.`, 'Hold the claim; get a retro authorization if the payer allows, or bill as your policy says.'],
    over_auth_total: (x) => [`${x.cpt} on ${x.date} goes ${x.over_units} unit(s) over authorization ${x.auth_number}.`, 'Request more units before the next session, or hold the extra units.'],
    over_weekly: (x) => [`${x.cpt} in the week of ${x.week_of} is ${x.over_units} unit(s) over the weekly limit of ${x.auth_number}.`, 'Move sessions or ask the payer for a weekly increase.'],
    units_over_minutes: (x) => [`${x.cpt} on ${x.date}: ${x.units} units billed for ${x.minutes} minutes (supports ${x.allowed_units}).`, 'Bill the units the minutes support.'],
    wrong_provider_role: (x) => [`${x.cpt} on ${x.date} was billed by a provider whose role is ${x.role}; this code needs a qualified professional (BCBA or as your payer defines).`, 'Rebill under the right provider or remove the line.'],
    supervision_low: (x) => [`Supervision in ${x.month} was ${x.supervision_pct}% of direct technician time (${x.supervised_hours} of ${x.direct_hours} hours).`, 'Schedule supervision to meet the payer and certification minimum.'],
    auth_ending_unused: (x) => [`Authorization ${x.auth_number} ends ${x.date} (in ${x.days} days) with ${x.units_left} units (${x.pct_left}%) unused.`, 'Schedule the remaining hours or start the reauthorization with the reason.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { sessions: sessions.length, clients: new Set(sessions.map((s) => str(s.patient_id) || str(s.patient_name)).filter(Boolean)).size, authorizations: auths.length, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
