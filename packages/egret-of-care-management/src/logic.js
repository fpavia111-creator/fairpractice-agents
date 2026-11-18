// Egret logic: care management time (CCM, PCM, BHI) per patient per month against code thresholds, consent and overlaps. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, listOf, monthOf } from 'kestrel-core';

const ORDER = { no_consent: 0, other_practice: 1, overlap_codes: 2, under_threshold: 3, addon_over: 4, unbilled_time: 5 };
/** Care management codes: program, whose time counts (staff = clinical staff, qhp = physician or other qualified professional), minutes for the base code, or the add-on's base, step and monthly maximum. */
export const CM_CODES = Object.freeze({
  99490: { prog: 'CCM', who: 'staff', base: 20 }, 99439: { prog: 'CCM', who: 'staff', addon: '99490', step: 20, max: 2 },
  99487: { prog: 'CCM', who: 'staff', base: 60 }, 99489: { prog: 'CCM', who: 'staff', addon: '99487', step: 30, max: null },
  99491: { prog: 'CCM', who: 'qhp', base: 30 }, 99437: { prog: 'CCM', who: 'qhp', addon: '99491', step: 30, max: null },
  99424: { prog: 'PCM', who: 'qhp', base: 30 }, 99425: { prog: 'PCM', who: 'qhp', addon: '99424', step: 30, max: null },
  99426: { prog: 'PCM', who: 'staff', base: 30 }, 99427: { prog: 'PCM', who: 'staff', addon: '99426', step: 30, max: null },
  99484: { prog: 'BHI', who: 'staff', base: 20 },
});
const progOf = (v) => { const s = str(v).toUpperCase(); if (/BHI|BEHAV/.test(s)) return 'BHI'; if (/PCM|PRINCIPAL/.test(s)) return 'PCM'; if (/CCM|CHRONIC/.test(s)) return 'CCM'; return s || null; };
const whoOf = (v) => (/^(MD|DO|NP|PA|CNS|QHP|PHYSICIAN|PROVIDER|PRACTITIONER|DR)/i.test(str(v).replace(/[^A-Za-z]/g, '')) ? 'qhp' : 'staff');
/** Codes and units the staff minutes support for a program, cheapest path (no complex CCM). */
export function supportedCodes(prog, minutes) {
  if (prog === 'CCM' && minutes >= 20) { const add = Math.min(2, Math.floor((minutes - 20) / 20)); return add ? { 99490: 1, 99439: add } : { 99490: 1 }; }
  if (prog === 'PCM' && minutes >= 30) { const add = Math.floor((minutes - 30) / 30); return add ? { 99426: 1, 99427: add } : { 99426: 1 }; }
  if (prog === 'BHI' && minutes >= 20) return { 99484: 1 };
  return {};
}

/**
 * time: [{ patient_id, patient_name, date, minutes, program, staff_type }]
 * claims: [{ patient_id, patient_name, date, cpt, units }]
 * patients: [{ patient_id, patient_name, consent_date, other_practice_months }]
 * opts: { rates = { cpt: rate }, month = null }
 */
export function checkCareManagement(time, claims, patients, { rates = {}, month = null } = {}) {
  const items = []; const names = new Map(); const rate = (c) => num(rates[c]) || 0;
  for (const r of [...patients, ...time, ...claims]) { const pid = str(r.patient_id); if (pid && r.patient_name) names.set(pid, str(r.patient_name)); }
  const roster = new Map(patients.map((p) => [str(p.patient_id) || str(p.patient_name), { consent: isoDate(p.consent_date), other: new Set(listOf(p.other_practice_months).map((m) => str(m).slice(0, 7))) }]));
  const pm = new Map(); const get = (pid, m) => { const k = `${pid}|${m}`; if (!pm.has(k)) pm.set(k, { pid, month: m, mins: { CCM: { staff: 0, qhp: 0 }, PCM: { staff: 0, qhp: 0 }, BHI: { staff: 0, qhp: 0 } }, billed: {} }); return pm.get(k); };
  for (const t of time) { const pid = str(t.patient_id) || str(t.patient_name); const m = monthOf(t.date); const p = progOf(t.program); if (!pid || !m || !p || !(p in { CCM: 1, PCM: 1, BHI: 1 })) continue; if (month && m !== month) continue; get(pid, m).mins[p][whoOf(t.staff_type)] += num(t.minutes) || 0; }
  for (const c of claims) { const pid = str(c.patient_id) || str(c.patient_name); const m = monthOf(c.date); const cpt = codeKey(c.cpt); if (!pid || !m || !CM_CODES[cpt]) continue; if (month && m !== month) continue; const g = get(pid, m); g.billed[cpt] = (g.billed[cpt] || 0) + (num(c.units) ?? 1); }
  for (const g of pm.values()) {
    const b = { patient_id: g.pid, patient_name: names.get(g.pid) || null, month: g.month, date: `${g.month}-01` };
    const codes = Object.keys(g.billed); const billedValue = round2(codes.reduce((s, c) => s + rate(c) * g.billed[c], 0));
    const progs = [...new Set(codes.map((c) => CM_CODES[c].prog))];
    const r = roster.get(g.pid);
    if (codes.length && (!r || !r.consent || r.consent > `${g.month}-31`)) items.push({ ...b, status: 'no_consent', codes: codes.join(' '), amount: billedValue });
    if (codes.some((c) => CM_CODES[c].prog === 'CCM') && r?.other.has(g.month)) items.push({ ...b, status: 'other_practice', codes: codes.join(' '), amount: round2(codes.filter((c) => CM_CODES[c].prog === 'CCM').reduce((s, c) => s + rate(c) * g.billed[c], 0)) });
    const bases = codes.filter((c) => CM_CODES[c].base && CM_CODES[c].prog !== 'BHI');
    if (bases.length > 1) items.push({ ...b, status: 'overlap_codes', codes: bases.join(' '), amount: round2(Math.min(...bases.map((c) => rate(c)))) });
    for (const c of codes.filter((x) => CM_CODES[x].base)) {
      const d = CM_CODES[c]; const mins = d.who === 'qhp' ? g.mins[d.prog].qhp : g.mins[d.prog].staff + g.mins[d.prog].qhp;
      const add = Object.entries(CM_CODES).find(([, v]) => v.addon === c); const addCode = add?.[0]; const addUnits = addCode ? (g.billed[addCode] || 0) : 0;
      if (mins < d.base) { items.push({ ...b, status: 'under_threshold', cpt: c, minutes: mins, needed: d.base, amount: round2(rate(c) + (addCode ? rate(addCode) * addUnits : 0)) }); continue; }
      if (addCode && addUnits) {
        let ok = Math.floor((mins - d.base) / add[1].step); if (add[1].max !== null) ok = Math.min(ok, add[1].max);
        if (addUnits > ok) items.push({ ...b, status: 'addon_over', cpt: addCode, minutes: mins, units: addUnits, supported: ok, amount: round2(rate(addCode) * (addUnits - ok)) });
      }
    }
    for (const c of codes.filter((x) => CM_CODES[x].addon && !g.billed[CM_CODES[x].addon])) items.push({ ...b, status: 'under_threshold', cpt: c, minutes: null, needed: `${CM_CODES[c].addon} billed first`, amount: round2(rate(c) * g.billed[c]) });
    for (const p of ['CCM', 'PCM', 'BHI']) {
      if (progs.includes(p) || (p !== 'BHI' && progs.some((x) => x !== 'BHI'))) continue;
      const mins = g.mins[p].staff + g.mins[p].qhp; const sup = supportedCodes(p, mins); if (!Object.keys(sup).length) continue;
      if (!r?.consent || (p === 'CCM' && r?.other.has(g.month))) continue;
      items.push({ ...b, status: 'unbilled_time', program: p, minutes: mins, supports: Object.entries(sup).sort(([a], [b2]) => (CM_CODES[a].addon ? 1 : 0) - (CM_CODES[b2].addon ? 1 : 0)).map(([c, u]) => `${c}×${u}`).join(' '), amount: round2(Object.entries(sup).reduce((s, [c, u]) => s + rate(c) * u, 0)) });
    }
  }
  const T = {
    no_consent: (x) => [`${x.month}: ${x.codes} billed with no care management consent on file for the month.`, 'Get and record consent before billing; hold these codes until then.'],
    other_practice: (x) => [`${x.month}: chronic care management billed while another practice bills it for this patient.`, 'Only one practitioner may bill CCM for a patient in a month; confirm with the patient and the other practice.'],
    overlap_codes: (x) => [`${x.month}: ${x.codes} billed together; these programs are not billed for the same patient in the same month.`, 'Keep the one the time and care plan support and remove the other.'],
    under_threshold: (x) => [typeof x.needed === 'number' ? `${x.month}: ${x.cpt} needs ${x.needed} minutes; ${x.minutes} logged.` : `${x.month}: add-on ${x.cpt} billed without ${x.needed}.`, 'Do not bill until the time is met, or correct the time log if minutes are missing.'],
    addon_over: (x) => [`${x.month}: ${x.units} unit(s) of ${x.cpt} billed; ${x.minutes} minutes support ${x.supported}.`, `Reduce ${x.cpt} to ${x.supported}.`],
    unbilled_time: (x) => [`${x.month}: ${x.minutes} minutes of ${x.program} logged, consent on file, nothing billed; the time supports ${x.supports}.`, 'Check the care plan is in place and bill the month.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { patient_months: pm.size, patients: new Set([...pm.values()].map((g) => g.pid)).size, dollars_at_risk: round2(items.filter((i) => i.status !== 'unbilled_time').reduce((s, x) => s + (x.amount || 0), 0)), dollars_unbilled: round2(items.filter((i) => i.status === 'unbilled_time').reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
