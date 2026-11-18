// Fairpractice Behavioral Health logic: behavioral health codes against session time, add-ons, crisis time, yearly visit limits and license rules. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, spanMinutes, payerKey } from 'fairpractice-core';

const ORDER = { license_cannot_bill: 0, addon_without_base: 1, wrong_time_code: 2, crisis_time: 3, over_yearly_limit: 4 };
const ALONE = ['90832', '90834', '90837']; const ADDON = ['90833', '90836', '90838'];
export const PSYCHOTHERAPY = Object.freeze([...ALONE, ...ADDON]);
/** Psychotherapy time code for the minutes: 16-37, 38-52, 53 and over; null under 16. */
export function timeCode(minutes, addOn = false) {
  if (minutes === null || minutes === undefined || minutes < 16) return null;
  const k = minutes <= 37 ? 0 : minutes <= 52 ? 1 : 2; return (addOn ? ADDON : ALONE)[k];
}
/** Units of 90840 the crisis minutes support: one per 30 minutes past the first 74. */
export const crisisAddOnUnits = (minutes) => (minutes === null || minutes < 75 ? 0 : Math.floor((minutes - 75) / 30) + 1);
const isEm = (c) => /^992(0[2-5]|1[1-5]|2[1-3]|3[1-9])$|^993(0[4-9]|1[0-6]|4[1-9]|50)$/.test(c);
const isPsychBase = (c) => ['90791', '90792', '90853', '90839', ...PSYCHOTHERAPY].includes(c);
export const DEFAULT_LICENSE_RULES = Object.freeze({ '90792': ['MD', 'DO', 'NP', 'PA', 'CNS'], '90833': ['MD', 'DO', 'NP', 'PA', 'CNS'], '90836': ['MD', 'DO', 'NP', 'PA', 'CNS'], '90838': ['MD', 'DO', 'NP', 'PA', 'CNS'], '99*': ['MD', 'DO', 'NP', 'PA', 'CNS'], '9613*': ['PHD', 'PSYD', 'MD', 'DO'] });
const licKey = (v) => { const s = str(v).toUpperCase().replace(/[^A-Z]/g, ''); if (/^(PMHNP|APRN|FNP|NP|CRNP|ARNP|PMHNPBC)$/.test(s) || /NURSEPRACTITIONER/.test(s)) return 'NP'; if (/^(PA|PAC)$/.test(s)) return 'PA'; if (/^(LCSW|LICSW|LISW|LCSWC)$/.test(s)) return 'LCSW'; if (/^(LPC|LPCC|LMHC|LCPC|LPCMH)$/.test(s)) return 'LPC'; return s || null; };
const ruleFor = (rules, cpt) => { for (const [k, v] of Object.entries(rules)) { if (k.endsWith('*') ? cpt.startsWith(k.slice(0, -1)) : k === cpt) return v.map((x) => licKey(x)); } return null; };

/**
 * sessions: [{ patient_id, patient_name, date, cpt, units, minutes, start, end, provider, license, payer, allowed }]
 * opts: { rates = { cpt: rate }, yearlyLimits = { payer: n }, licenseRules = DEFAULT_LICENSE_RULES }
 */
export function checkBehavioral(sessions, { rates = {}, yearlyLimits = {}, licenseRules = DEFAULT_LICENSE_RULES } = {}) {
  const items = []; const names = new Map();
  const rate = (c) => num(rates[c]) || 0;
  const L = sessions.map((s, i) => { const pid = str(s.patient_id) || str(s.patient_name); if (pid && s.patient_name) names.set(pid, str(s.patient_name)); return { i, pid, date: isoDate(s.date), cpt: codeKey(s.cpt), units: num(s.units) ?? 1, minutes: num(s.minutes) ?? spanMinutes(s.start, s.end), provider: str(s.provider) || null, license: licKey(s.license), payer: str(s.payer), allowed: num(s.allowed) }; })
    .filter((l) => l.pid && l.date && l.cpt).sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i);
  const value = (l) => l.allowed ?? round2(rate(l.cpt) * l.units);
  const b = (l) => ({ patient_id: l.pid, patient_name: names.get(l.pid) || null, date: l.date, cpt: l.cpt, units: l.units, minutes: l.minutes, provider: l.provider, line: l.i + 1 });
  const day = new Map(); for (const l of L) { const k = `${l.pid}|${l.date}|${l.provider || ''}`; if (!day.has(k)) day.set(k, []); day.get(k).push(l); }
  const lr = Object.fromEntries(Object.entries(licenseRules).map(([k, v]) => [codeKey(k).replace(/\*$/, '') + (k.endsWith('*') ? '*' : ''), v]));

  for (const l of L) {
    const same = day.get(`${l.pid}|${l.date}|${l.provider || ''}`).filter((x) => x !== l);
    const allowedLic = ruleFor(lr, l.cpt);
    if (allowedLic && l.license && !allowedLic.includes(l.license)) items.push({ ...b(l), status: 'license_cannot_bill', license: l.license, allowed_licenses: allowedLic.join(', '), amount: value(l) });
    if (ADDON.includes(l.cpt) && !same.some((x) => isEm(x.cpt))) items.push({ ...b(l), status: 'addon_without_base', needs: 'E/M visit the same day by the same provider', amount: value(l) });
    if (l.cpt === '90785' && !same.some((x) => isPsychBase(x.cpt))) items.push({ ...b(l), status: 'addon_without_base', needs: 'psychiatric evaluation, psychotherapy or crisis code the same day', amount: value(l) });
    if (l.cpt === '90840' && !same.some((x) => x.cpt === '90839')) items.push({ ...b(l), status: 'addon_without_base', needs: '90839 the same day', amount: value(l) });
    if (PSYCHOTHERAPY.includes(l.cpt) && l.minutes !== null) {
      const want = timeCode(l.minutes, ADDON.includes(l.cpt));
      if (want !== l.cpt) items.push({ ...b(l), status: 'wrong_time_code', expected: want || 'none (under 16 minutes)', amount: round2(Math.max(0, value(l) - (want ? rate(want) * l.units : 0))) });
    }
    if (l.cpt === '90839') {
      const addOns = same.filter((x) => x.cpt === '90840').reduce((s, x) => s + x.units, 0);
      const conflict = same.filter((x) => PSYCHOTHERAPY.includes(x.cpt)).map((x) => x.cpt);
      const problems = [];
      if (l.minutes !== null && l.minutes < 30) problems.push(`90839 needs at least 30 minutes; ${l.minutes} recorded`);
      if (l.minutes !== null && addOns > crisisAddOnUnits(l.minutes)) problems.push(`${addOns} unit(s) of 90840 billed; ${l.minutes} minutes support ${crisisAddOnUnits(l.minutes)}`);
      if (conflict.length) problems.push(`psychotherapy (${conflict.join(', ')}) billed the same day by the same provider`);
      if (problems.length) { const extra = l.minutes !== null ? Math.max(0, addOns - crisisAddOnUnits(l.minutes)) : 0; items.push({ ...b(l), status: 'crisis_time', problems, add_on_units: addOns, amount: round2(extra * rate('90840')) }); }
    }
  }
  // Yearly session limits by payer, counting psychotherapy and crisis sessions per patient and year.
  const lim = Object.entries(yearlyLimits).map(([p, n]) => [payerKey(p), num(n)]);
  const seen = new Map(); const counted = new Set();
  for (const l of L) {
    if (!PSYCHOTHERAPY.includes(l.cpt) && l.cpt !== '90839' && l.cpt !== '90853') continue;
    const pk = payerKey(l.payer); const limit = lim.find(([k]) => k && k === pk)?.[1]; if (!limit) continue;
    const dk = `${l.pid}|${l.date}`; if (counted.has(dk)) continue; counted.add(dk);
    const k = `${l.pid}|${pk}|${l.date.slice(0, 4)}`; const n = (seen.get(k) || 0) + 1; seen.set(k, n);
    if (n > limit) items.push({ ...b(l), status: 'over_yearly_limit', payer: l.payer, session_number: n, limit, amount: value(l) });
  }
  const T = {
    license_cannot_bill: (x) => [`${x.cpt} on ${x.date} was billed under the license type ${x.license}; this code needs ${x.allowed_licenses}.`, 'Bill under an eligible provider or use the code the license allows.'],
    addon_without_base: (x) => [`Add-on ${x.cpt} on ${x.date} has no ${x.needs}.`, 'Add the missing base code if it was provided, or remove the add-on.'],
    wrong_time_code: (x) => [`${x.cpt} on ${x.date} is for ${x.minutes} minutes; the time supports ${x.expected}.`, x.expected.startsWith('none') ? 'Psychotherapy under 16 minutes is not billed as psychotherapy.' : `Bill ${x.expected}, or correct the recorded time if it is wrong.`],
    crisis_time: (x) => [`Crisis care on ${x.date}: ${x.problems.join('; ')}.`, 'Bill crisis units to the recorded time, and do not bill psychotherapy codes with 90839 the same day.'],
    over_yearly_limit: (x) => [`Session ${x.session_number} this year for ${x.payer}, over its limit of ${x.limit}.`, 'Request an extension or authorization from the payer, or tell the patient before the next session.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { sessions: sessions.length, patients: new Set(L.map((l) => l.pid)).size, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
