// Swallow logic: outpatient therapy (PT, OT, speech) units, modifiers, the KX threshold and plans of care. No I/O.
import { str, num, isoDate, daysBetween, addDays, round2, sortByStatus, countBy, codeKey, modifierList } from 'kestrel-core';

const ORDER = { no_plan_of_care: 0, cert_unsigned: 1, eight_minute_over: 2, assistant_modifier_missing: 3, discipline_modifier_wrong: 4, kx_missing: 5, recert_due: 6 };
export const TIMED_CODES = Object.freeze(['97032', '97033', '97034', '97035', '97036', '97110', '97112', '97113', '97116', '97140', '97530', '97533', '97535', '97537', '97542', '97750', '97755', '97760', '97761', '97763']);
/** Units the 8-minute rule allows for a day's total timed minutes: 8-22 is 1, 23-37 is 2, and so on. */
export const eightMinuteUnits = (minutes) => (minutes === null || minutes === undefined ? null : Math.floor((minutes + 7) / 15));
/** Discipline and assistant flag from a provider role or credential. */
export function roleOf(v) {
  const s = str(v).toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return null;
  if (/^(PTA|LPTA)$|PHYSICALTHERAPISTASSISTANT|PHYSICALTHERAPYASSISTANT/.test(s)) return { discipline: 'PT', assistant: true };
  if (/^(OTA|COTA|COTAL|OTAL)$|OCCUPATIONALTHERAPYASSISTANT|OCCUPATIONALTHERAPISTASSISTANT/.test(s)) return { discipline: 'OT', assistant: true };
  if (/^(SLP|ST|CCCSLP|SLPCCC|SLPA)$|SPEECH/.test(s)) return { discipline: 'SLP', assistant: false };
  if (/^(OT|OTR|OTRL|OTD)$|OCCUPATIONAL/.test(s)) return { discipline: 'OT', assistant: false };
  if (/^(PT|DPT|MPT|LPT)$|PHYSICAL/.test(s)) return { discipline: 'PT', assistant: false };
  return null;
}
const DISC_MOD = { PT: 'GP', OT: 'GO', SLP: 'GN' };
const MOD_DISC = { GP: 'PT', GO: 'OT', GN: 'SLP' };
const discKey = (v) => { const s = str(v).toUpperCase().replace(/[^A-Z]/g, ''); if (/^(PT|PHYSICAL|PHYSICALTHERAPY)$/.test(s)) return 'PT'; if (/^(OT|OCCUPATIONAL|OCCUPATIONALTHERAPY)$/.test(s)) return 'OT'; if (/^(SLP|ST|SPEECH|SPEECHTHERAPY|SPEECHLANGUAGE|SPEECHLANGUAGEPATHOLOGY)$/.test(s)) return 'SLP'; return s || null; };

/**
 * visits: [{ patient_id, patient_name, date, cpt, modifiers, units, minutes, provider, provider_role, payer, allowed }]
 * plans: [{ patient_id, discipline, start, end, signed }]
 * opts: { asOf, kxThreshold = 2410, kxPayers = ['medicare'], timedCodes, rates = { cpt: rate }, signDays = 30, warnDays = 21 }
 */
export function checkTherapy(visits, plans, { asOf, kxThreshold = 2410, kxPayers = ['medicare'], timedCodes = TIMED_CODES, rates = {}, signDays = 30, warnDays = 21 } = {}) {
  const items = []; const names = new Map();
  const P = plans.map((p) => ({ patient: str(p.patient_id), discipline: discKey(p.discipline), start: isoDate(p.start), end: isoDate(p.end), signed: isoDate(p.signed), seen: null }));
  const timed = new Set(timedCodes.map(codeKey));
  const value = (l) => num(l.allowed) ?? round2((num(rates[l.cpt]) || 0) * (l.units || 0));
  const kxApplies = (payer) => !str(payer) || kxPayers.some((w) => str(payer).toLowerCase().includes(str(w).toLowerCase()));
  const L = visits.map((v, i) => {
    const pid = str(v.patient_id) || str(v.patient_name); if (v.patient_name && pid) names.set(pid, str(v.patient_name));
    const mods = modifierList(v.modifiers); const role = roleOf(v.provider_role);
    const modDisc = mods.map((m) => MOD_DISC[m]).find(Boolean) || null;
    return { i, pid, date: isoDate(v.date), cpt: codeKey(v.cpt), mods, role, discipline: role?.discipline || modDisc, modDisc, units: num(v.units) ?? 1, minutes: num(v.minutes), provider: str(v.provider) || null, payer: str(v.payer), allowed: num(v.allowed) };
  }).filter((l) => l.pid && l.date && l.cpt).sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i);
  const base = (l) => ({ patient_id: l.pid, patient_name: names.get(l.pid) || null, date: l.date, cpt: l.cpt, units: l.units, provider: l.provider, line: l.i + 1 });

  // Plan of care in force for the date and discipline.
  const noPlan = new Map();
  for (const l of L) {
    if (!l.discipline) continue;
    const plan = P.find((p) => p.patient === l.pid && (!p.discipline || p.discipline === l.discipline) && p.start && p.start <= l.date && (!p.end || p.end >= l.date));
    if (plan) { if (!plan.seen || plan.seen < l.date) plan.seen = l.date; continue; }
    const k = `${l.pid}|${l.date}|${l.discipline}`; const it = noPlan.get(k);
    if (it) { it.amount = round2(it.amount + value(l)); it.lines++; } else noPlan.set(k, { ...base(l), cpt: null, units: null, status: 'no_plan_of_care', discipline: l.discipline, lines: 1, amount: value(l) });
  }
  items.push(...noPlan.values());

  // Modifiers per line.
  for (const l of L) {
    if (l.role?.assistant) { const need = l.role.discipline === 'OT' ? 'CO' : 'CQ'; if (!l.mods.includes(need)) items.push({ ...base(l), status: 'assistant_modifier_missing', needed: need, role: l.role.discipline === 'OT' ? 'OTA' : 'PTA', amount: 0 }); }
    if (l.role && (!l.modDisc || l.modDisc !== l.role.discipline)) items.push({ ...base(l), status: 'discipline_modifier_wrong', needed: DISC_MOD[l.role.discipline], found: l.mods.filter((m) => MOD_DISC[m]).join(' ') || 'none', amount: value(l) });
  }

  // 8-minute rule per patient, provider and day over timed codes.
  const days = new Map();
  for (const l of L) { if (!timed.has(l.cpt)) continue; const k = `${l.pid}|${l.date}|${l.provider || ''}`; const d = days.get(k) || { first: l, minutes: 0, units: 0, unknown: false, lines: [] }; if (l.minutes === null) d.unknown = true; d.minutes += l.minutes || 0; d.units += l.units; d.lines.push(l); days.set(k, d); }
  for (const d of days.values()) {
    if (d.unknown) continue; const allowed = eightMinuteUnits(d.minutes);
    if (d.units > allowed) { const over = d.units - allowed; const avg = d.lines.reduce((s, l) => s + value(l), 0) / d.units; items.push({ ...base(d.first), cpt: d.lines.map((l) => l.cpt).join(' '), units: d.units, status: 'eight_minute_over', minutes: d.minutes, allowed_units: allowed, over_units: over, amount: round2(over * avg) }); }
  }

  // KX threshold per patient and year: PT and speech together, OT on its own.
  const spend = new Map(); const kx = new Map();
  for (const l of L) {
    if (!l.discipline || !kxApplies(l.payer)) continue;
    const bucket = l.discipline === 'OT' ? 'OT' : 'PT and speech'; const k = `${l.pid}|${l.date.slice(0, 4)}|${bucket}`;
    const before = spend.get(k) || 0; const after = round2(before + value(l)); spend.set(k, after);
    if (after > kxThreshold && !l.mods.includes('KX')) {
      const dk = `${k}|${l.date}`; const it = kx.get(dk);
      if (it) { it.amount = round2(it.amount + value(l)); it.lines++; it.year_to_date = after; } else kx.set(dk, { ...base(l), cpt: null, units: null, status: 'kx_missing', bucket, year_to_date: after, threshold: kxThreshold, lines: 1, amount: value(l) });
    }
  }
  items.push(...kx.values());

  // Certifications: unsigned after the window, and recertifications coming due for patients still seen.
  for (const p of P) {
    if (!p.start) continue;
    const pb = { patient_id: p.patient, patient_name: names.get(p.patient) || null, cpt: null, units: null, provider: null, discipline: p.discipline, amount: 0 };
    const signBy = addDays(p.start, signDays);
    if (!p.signed && signBy < asOf && (!p.end || p.end >= addDays(asOf, -365))) items.push({ ...pb, date: p.start, status: 'cert_unsigned', sign_by: signBy, days_late: daysBetween(signBy, asOf) });
    else if (p.signed && p.signed > signBy) items.push({ ...pb, date: p.start, status: 'cert_unsigned', sign_by: signBy, signed: p.signed, days_late: daysBetween(signBy, p.signed) });
    if (p.end && p.end >= asOf && daysBetween(asOf, p.end) <= warnDays && p.seen && daysBetween(p.seen, asOf) <= 30) {
      const next = P.some((q) => q !== p && q.patient === p.patient && q.discipline === p.discipline && q.start && q.start > p.start);
      if (!next) items.push({ ...pb, date: p.end, status: 'recert_due', days: daysBetween(asOf, p.end), last_seen: p.seen });
    }
  }

  const T = {
    no_plan_of_care: (x) => [`${x.discipline} on ${x.date} (${x.lines} line(s)) is not covered by a plan of care for this patient.`, 'Get the plan of care certified for these dates before billing, or hold the visit.'],
    cert_unsigned: (x) => [x.signed ? `The ${x.discipline || 'therapy'} plan of care from ${x.date} was signed ${x.signed}, ${x.days_late} day(s) after the ${x.sign_by} target.` : `The ${x.discipline || 'therapy'} plan of care from ${x.date} is still unsigned, ${x.days_late} day(s) past ${x.sign_by}.`, x.signed ? 'Keep the reason for the late signature with the chart; payers may accept a delayed certification with one.' : 'Chase the physician or NPP signature; keep a record of each request.'],
    eight_minute_over: (x) => [`${x.date}: ${x.units} timed units billed for ${x.minutes} timed minutes; the 8-minute rule allows ${x.allowed_units}.`, `Reduce the timed units by ${x.over_units} before the claim goes out.`],
    assistant_modifier_missing: (x) => [`${x.cpt} on ${x.date} was furnished by an assistant (${x.role}) without the ${x.needed} modifier.`, `Add ${x.needed}; Medicare pays assistant services at a reduced rate and expects the modifier.`],
    discipline_modifier_wrong: (x) => [`${x.cpt} on ${x.date} needs ${x.needed} for this provider's discipline; found ${x.found}.`, `Set the therapy modifier to ${x.needed}.`],
    kx_missing: (x) => [`${x.date}: ${x.bucket} spending this year reached ${x.year_to_date}, above the ${x.threshold} KX threshold, and ${x.lines} line(s) lack KX.`, 'Add KX only when the record supports that therapy is still medically necessary; otherwise hold the lines.'],
    recert_due: (x) => [`The ${x.discipline || 'therapy'} plan of care ends ${x.date} (in ${x.days} days) and the patient was seen ${x.last_seen}.`, 'Send the recertification to the physician or NPP before the plan ends.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { visits: visits.length, patients: new Set(L.map((l) => l.pid)).size, plans: plans.length, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
