// Fairpractice Wound Products logic: skin substitute units against product opened, used and wasted (JW/JZ), application codes, invoices and cost. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, modifierList, idKey } from 'fairpractice-core';

const ORDER = { no_invoice: 0, units_over_opened: 1, waste_modifier_wrong: 2, application_mismatch: 3, paid_below_cost: 4 };
export const isProduct = (c) => /^(Q4\d{3}|A2\d{3}|A4100)$/.test(c);
export const isApplication = (c) => /^1527[1-8]$/.test(c);
/** Application codes and units for a wound area in square centimetres; `small` is the face, scalp, hands, feet and genitalia family (15275-15278). */
export function applicationCodes(area, small = false) {
  if (!area || area <= 0) return {};
  const [f25, a25, f100, a100] = small ? ['15275', '15276', '15277', '15278'] : ['15271', '15272', '15273', '15274'];
  if (area < 100) { const out = { [f25]: 1 }; const extra = Math.ceil(Math.max(0, area - 25) / 25); if (extra) out[a25] = extra; return out; }
  const out = { [f100]: 1 }; const extra = Math.ceil((area - 100) / 100); if (extra) out[a100] = extra; return out;
}
const fmt = (o) => Object.entries(o).sort().map(([c, u]) => `${c}×${u}`).join(' ') || 'none';

/**
 * claims: [{ patient_id, patient_name, date, cpt, modifiers, units, paid }]
 * usage: [{ patient_id, date, product, lot, opened, applied, wound_area }]
 * invoices: [{ product, lot, invoice, size, cost }]
 */
export function checkWound(claims, usage, invoices) {
  const items = []; const names = new Map();
  const C = claims.map((c, i) => { const pid = str(c.patient_id) || str(c.patient_name); if (pid && c.patient_name) names.set(pid, str(c.patient_name)); return { i, pid, date: isoDate(c.date), cpt: codeKey(c.cpt), mods: modifierList(c.modifiers), units: num(c.units) ?? 1, paid: num(c.paid) }; }).filter((c) => c.pid && c.date && c.cpt);
  const U = usage.map((u) => ({ pid: str(u.patient_id) || str(u.patient_name), date: isoDate(u.date), product: codeKey(u.product), lot: idKey(u.lot), lotName: str(u.lot), opened: num(u.opened), applied: num(u.applied), area: num(u.wound_area) }));
  const INV = invoices.map((v) => ({ product: codeKey(v.product), lot: idKey(v.lot), invoice: str(v.invoice) || null, size: num(v.size), cost: num(v.cost) }));
  const b = (pid, date) => ({ patient_id: pid, patient_name: names.get(pid) || null, date });
  const groups = new Map();
  for (const c of C) { if (!isProduct(c.cpt)) continue; const k = `${c.pid}|${c.date}|${c.cpt}`; if (!groups.has(k)) groups.set(k, { pid: c.pid, date: c.date, cpt: c.cpt, lines: [] }); groups.get(k).lines.push(c); }
  for (const g of groups.values()) {
    const use = U.filter((u) => u.pid === g.pid && u.date === g.date && u.product === g.cpt);
    const opened = use.reduce((s, u) => s + (u.opened || 0), 0); const applied = use.reduce((s, u) => s + (u.applied ?? u.opened ?? 0), 0);
    const jw = g.lines.filter((l) => l.mods.includes('JW')).reduce((s, l) => s + l.units, 0); const used = g.lines.filter((l) => !l.mods.includes('JW')).reduce((s, l) => s + l.units, 0);
    const jz = g.lines.some((l) => l.mods.includes('JZ')); const paid = g.lines.some((l) => l.paid !== null) ? round2(g.lines.reduce((s, l) => s + (l.paid || 0), 0)) : null;
    const base = { ...b(g.pid, g.date), cpt: g.cpt, units: used + jw };
    // Invoice for each lot used (or the product code when no lot is recorded).
    const lots = use.length ? use.map((u) => ({ lot: u.lot, name: u.lotName, opened: u.opened })) : [{ lot: '', opened: null }];
    let cost = 0; let costKnown = true; const missing = [];
    for (const l of lots) {
      const inv = INV.find((v) => (l.lot ? v.lot === l.lot : v.product === g.cpt) && (!v.product || v.product === g.cpt));
      if (!inv) { missing.push(l.name || l.lot || g.cpt); costKnown = false; continue; }
      if (inv.cost === null) { costKnown = false; continue; }
      const perCm = inv.size ? inv.cost / inv.size : null; const qty = l.opened ?? (lots.length === 1 ? used + jw : null);
      if (perCm === null || qty === null) costKnown = false; else cost += perCm * qty;
    }
    if (missing.length) items.push({ ...base, status: 'no_invoice', lots: missing.join(', '), amount: paid ?? 0 });
    if (!use.length) continue;
    if (used + jw > opened) items.push({ ...base, status: 'units_over_opened', opened, over_units: used + jw - opened, amount: paid !== null && used + jw ? round2((paid * (used + jw - opened)) / (used + jw)) : 0 });
    const waste = Math.max(0, opened - applied); const why = [];
    if (waste > 0 && jw !== waste) why.push(`${waste} sq cm wasted but ${jw} unit(s) billed with JW`);
    if (waste > 0 && jz) why.push('JZ (no waste) used although product was wasted');
    if (waste === 0 && !jz) why.push('no waste recorded and no JZ on the product line');
    if (waste === 0 && jw) why.push(`${jw} unit(s) billed with JW but no waste recorded`);
    if (why.length) items.push({ ...base, status: 'waste_modifier_wrong', opened, applied, waste, jw_units: jw, problems: why, amount: 0 });
    if (costKnown && paid !== null && paid < round2(cost)) items.push({ ...base, status: 'paid_below_cost', cost: round2(cost), paid, amount: round2(cost - paid) });
  }
  // Application codes per patient and day against the wound area.
  const days = new Map();
  for (const c of C) { if (!isProduct(c.cpt) && !isApplication(c.cpt)) continue; const k = `${c.pid}|${c.date}`; if (!days.has(k)) days.set(k, { pid: c.pid, date: c.date, products: 0, billed: {} }); const d = days.get(k); if (isProduct(c.cpt)) d.products++; else d.billed[c.cpt] = (d.billed[c.cpt] || 0) + c.units; }
  for (const d of days.values()) {
    const use = U.filter((u) => u.pid === d.pid && u.date === d.date);
    const area = use.length ? Math.max(...use.map((u) => u.area ?? 0), 0) || use.reduce((s, u) => s + (u.applied ?? u.opened ?? 0), 0) : null;
    const small = Object.keys(d.billed).some((c) => /^1527[5-8]$/.test(c));
    if (!d.products && Object.keys(d.billed).length) { items.push({ ...b(d.pid, d.date), cpt: Object.keys(d.billed).join(' '), units: null, status: 'application_mismatch', billed: fmt(d.billed), expected: 'a product line the same day', amount: 0 }); continue; }
    if (area === null) continue;
    const want = applicationCodes(area, small);
    if (fmt(want) !== fmt(d.billed)) items.push({ ...b(d.pid, d.date), cpt: Object.keys(d.billed).join(' ') || null, units: null, status: 'application_mismatch', area, billed: fmt(d.billed), expected: fmt(want), amount: 0 });
  }
  const T = {
    no_invoice: (x) => [`${x.cpt} on ${x.date} has no purchase invoice on file for ${x.lots}.`, 'Find the invoice and lot before billing; payers and auditors ask for both.'],
    units_over_opened: (x) => [`${x.cpt} on ${x.date}: ${x.units} units billed but only ${x.opened} sq cm opened.`, `Bill no more than the product opened; remove ${x.over_units} unit(s).`],
    waste_modifier_wrong: (x) => [`${x.cpt} on ${x.date}: ${x.problems.join('; ')}.`, 'Bill the applied units on one line and the wasted units on a JW line, or JZ when nothing was wasted; record the waste in the chart.'],
    application_mismatch: (x) => [x.area ? `Application codes on ${x.date} are ${x.billed}; a ${x.area} sq cm area supports ${x.expected}.` : `Application codes on ${x.date} (${x.billed}) have no product line that day.`, 'Match the application codes to the wound area recorded, and bill the product with them.'],
    paid_below_cost: (x) => [`${x.cpt} on ${x.date} was paid ${x.paid}; the product cost ${x.cost}.`, 'Appeal the payment against the fee schedule or contract, and check the price before buying more of this product.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { claim_lines: claims.length, product_lines: C.filter((c) => isProduct(c.cpt)).length, patients: new Set(C.map((c) => c.pid)).size, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
