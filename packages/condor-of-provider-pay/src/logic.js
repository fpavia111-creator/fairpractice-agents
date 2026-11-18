// Condor logic: provider pay by work RVU: wRVUs from charges and your RVU file, tiered pay and draw true-up. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, modifierList, personKey } from 'kestrel-core';

const ORDER = { no_provider: 0, no_rvu: 1, draw_over_earned: 2, true_up_owed: 3 };
export const DEFAULT_MODIFIER_PCT = Object.freeze({ 50: 150, 51: 50, 62: 62.5, 80: 16, 82: 16, AS: 16 });
/** Pay for a number of wRVUs under marginal tiers [{ up_to, rate }] (the last tier has no up_to). */
export function tieredPay(wrvu, tiers) {
  let left = wrvu; let lo = 0; let pay = 0;
  for (const t of tiers) { const cap = t.up_to === null || t.up_to === undefined ? Infinity : t.up_to; const inTier = Math.max(0, Math.min(left, cap - lo)); pay += inTier * (num(t.rate) || 0); left -= inTier; lo = cap; if (left <= 0) break; }
  return round2(pay);
}

/**
 * charges: [{ provider, dos, cpt, modifiers, units, patient_id, patient_name }]
 * rvus: [{ code, modifier, work_rvu }]
 * opts: { tiers = [{ up_to: null, rate: 0 }], providers = { name: { tiers?, draws? } }, modifierPct = DEFAULT_MODIFIER_PCT, from = null, to = null }
 */
export function checkProviderPay(charges, rvus, { tiers = [{ up_to: null, rate: 0 }], providers = {}, modifierPct = DEFAULT_MODIFIER_PCT, from = null, to = null } = {}) {
  const items = [];
  const R = new Map(); for (const r of rvus) { const c = codeKey(r.code); if (!c) continue; const m = str(r.modifier).toUpperCase(); R.set(m ? `${c}|${m}` : c, num(r.work_rvu)); }
  const P = new Map(); const missing = new Map(); const noProv = { lines: 0, wrvu: 0, first: null };
  const cfg = new Map(Object.entries(providers).map(([n, v]) => [personKey(n), { name: n, ...v }]));
  for (const [i, c] of charges.entries()) {
    const dos = isoDate(c.dos); if ((from && dos && dos < from) || (to && dos && dos > to)) continue;
    const code = codeKey(c.cpt); if (!code) continue; const mods = modifierList(c.modifiers); const units = num(c.units) ?? 1;
    const special = mods.map((m) => R.get(`${code}|${m}`)).find((v) => v !== undefined && v !== null);
    const base = special ?? R.get(code);
    if (base === undefined || base === null) { const x = missing.get(code) || { code, lines: 0, units: 0, first: dos, line: i + 1 }; x.lines++; x.units += units; missing.set(code, x); continue; }
    let pct = 100; if (special === undefined) for (const m of mods) if (modifierPct[m] !== undefined) pct = (pct * num(modifierPct[m])) / 100;
    const w = (base * units * pct) / 100;
    const pk = personKey(c.provider);
    if (!pk) { noProv.lines++; noProv.wrvu += w; noProv.first = noProv.first || i + 1; continue; }
    const p = P.get(pk) || { provider: str(c.provider), wrvu: 0, lines: 0 }; p.wrvu += w; p.lines++; P.set(pk, p);
  }
  const rows = [];
  for (const [pk, p] of P) {
    const c = cfg.get(pk) || {}; const t = c.tiers || tiers; const earned = tieredPay(p.wrvu, t); const draws = num(c.draws) ?? 0;
    const row = { provider: p.provider, lines: p.lines, wrvu: round2(p.wrvu), earned, draws, true_up: round2(earned - draws) }; rows.push(row);
    if (c.draws === undefined) continue;
    if (row.true_up > 0.005) items.push({ ...row, status: 'true_up_owed', date: to || null, amount: row.true_up });
    else if (row.true_up < -0.005) items.push({ ...row, status: 'draw_over_earned', date: to || null, amount: -row.true_up });
  }
  for (const x of missing.values()) items.push({ provider: null, status: 'no_rvu', date: x.first, code: x.code, lines: x.lines, units: x.units, line: x.line, amount: 0 });
  if (noProv.lines) items.push({ provider: null, status: 'no_provider', date: null, lines: noProv.lines, wrvu: round2(noProv.wrvu), line: noProv.first, amount: 0 });
  const T = {
    no_provider: (x) => [`${x.lines} charge line(s) (${x.wrvu} wRVUs) have no rendering provider.`, 'Assign the provider in the billing system so the work is credited.'],
    no_rvu: (x) => [`Code ${x.code} (${x.units} unit(s) on ${x.lines} line(s)) has no work RVU in your RVU file.`, 'Add the code to the RVU file, or confirm it carries no work RVU under your plan.'],
    draw_over_earned: (x) => [`${x.provider}: ${x.wrvu} wRVUs earn ${x.earned}; draws paid ${x.draws}, so ${x.amount} was paid ahead of production.`, 'Apply the plan\'s rule for draws above production (carry forward or recover).'],
    true_up_owed: (x) => [`${x.provider}: ${x.wrvu} wRVUs earn ${x.earned}; draws paid ${x.draws}, so ${x.amount} is owed at true-up.`, 'Include the true-up in the next payroll after the medical director signs off.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  rows.sort((a, b) => b.wrvu - a.wrvu);
  return { providers: rows, total_wrvu: round2(rows.reduce((s, r) => s + r.wrvu, 0)), total_earned: round2(rows.reduce((s, r) => s + r.earned, 0)), by_status: countBy(items, 'status'), items };
}
