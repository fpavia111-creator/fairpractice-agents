// Pelican logic: capitation payments against the member roster, month by month. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, idKey, monthBounds, monthOf } from 'kestrel-core';

const ORDER = { not_paid: 0, wrong_rate: 1, duplicate_payment: 2, paid_not_eligible: 3, retro_term: 4, retro_add: 5 };
const monthKey = (v) => { const s = str(v); if (/^\d{4}-\d{2}$/.test(s)) return s; return monthOf(s) || null; };
export const monthsBetween = (from, to) => { const out = []; let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number); while ((y < ty || (y === ty && m <= tm)) && out.length < 240) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };

/**
 * roster: [{ member_id, patient_name, effective, term, category, rate }]
 * payments: [{ member_id, patient_name, month, amount, paid_date }]
 * opts: { rates = { category: rate }, from = null, to = null, tolerance = 0.01 }
 */
export function checkCapitation(roster, payments, { rates = {}, from = null, to = null, tolerance = 0.01 } = {}) {
  const items = []; const names = new Map();
  const M = roster.map((r) => { const id = idKey(r.member_id); if (id && r.patient_name) names.set(id, str(r.patient_name)); return { id, raw: str(r.member_id), eff: isoDate(r.effective), term: isoDate(r.term), rate: num(r.rate) ?? num(rates[str(r.category)]) ?? num(rates[str(r.category).toLowerCase()]), category: str(r.category) || null }; }).filter((m) => m.id);
  const P = payments.map((p, i) => { const id = idKey(p.member_id); if (id && p.patient_name && !names.has(id)) names.set(id, str(p.patient_name)); return { i, id, raw: str(p.member_id), month: monthKey(p.month), amount: num(p.amount) || 0, paid: isoDate(p.paid_date) }; }).filter((p) => p.id && p.month);
  const months = P.map((p) => p.month).sort(); const f = from || months[0]; const t = to || months.at(-1);
  if (!f || !t) return { months: [], members: M.length, expected: 0, paid: 0, to_dispute: 0, to_set_aside: 0, net: 0, dollars_at_risk: 0, by_status: {}, items };
  const span = monthsBetween(f, t);
  const eligible = (m, mo) => { const b = monthBounds(mo); return m.eff && m.eff <= b.start && (!m.term || m.term >= b.start); };
  const byKey = new Map(); for (const p of P) { if (!span.includes(p.month)) continue; const k = `${p.id}|${p.month}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); }
  const roster_ = new Map(M.map((m) => [m.id, m]));
  const b = (id, mo, raw) => ({ member_id: raw || id, patient_name: names.get(id) || null, month: mo, date: `${mo}-01` });
  let expected = 0; let paidTotal = 0;
  for (const m of M) for (const mo of span) {
    if (!eligible(m, mo)) continue; const lines = byKey.get(`${m.id}|${mo}`) || []; const net = round2(lines.reduce((s, l) => s + l.amount, 0)); const exp = m.rate;
    if (exp !== null && exp !== undefined) expected += exp;
    if (!lines.length || net === 0) { items.push({ ...b(m.id, mo, m.raw), status: 'not_paid', expected: exp, paid: net, amount: exp || 0 }); continue; }
    const pos = lines.filter((l) => l.amount > 0);
    if (pos.length > 1 && exp && Math.abs(net - exp * pos.length) <= tolerance) { items.push({ ...b(m.id, mo, m.raw), status: 'duplicate_payment', expected: exp, paid: net, lines: pos.length, amount: round2(exp - net) }); continue; }
    if (exp !== null && exp !== undefined && Math.abs(net - exp) > tolerance) items.push({ ...b(m.id, mo, m.raw), status: 'wrong_rate', category: m.category, expected: exp, paid: net, amount: round2(exp - net) });
  }
  for (const [k, lines] of byKey) {
    const [id, mo] = k.split('|'); const m = roster_.get(id); const net = round2(lines.reduce((s, l) => s + l.amount, 0)); paidTotal += net;
    if ((!m || !eligible(m, mo)) && Math.abs(net) > tolerance) items.push({ ...b(id, mo, lines[0].raw), status: 'paid_not_eligible', on_roster: !!m, paid: net, amount: round2(-net) });
    for (const l of lines) {
      if (!l.paid || monthOf(l.paid) <= mo) continue;
      if (l.amount < 0) items.push({ ...b(id, mo, l.raw), status: 'retro_term', paid_date: l.paid, paid: l.amount, amount: 0 });
      else if (lines.filter((x) => x.amount > 0).length === 1 || !lines.some((x) => x.amount > 0 && x.paid && monthOf(x.paid) <= mo)) items.push({ ...b(id, mo, l.raw), status: 'retro_add', paid_date: l.paid, paid: l.amount, amount: 0 });
    }
  }
  const T = {
    not_paid: (x) => [`${x.month}: eligible on the roster, no capitation paid${x.expected ? ` (expected ${x.expected})` : ''}.`, 'Add to the dispute list with the roster line as proof.'],
    wrong_rate: (x) => [`${x.month}: paid ${x.paid}, expected ${x.expected}${x.category ? ` for ${x.category}` : ''}.`, x.amount > 0 ? 'Dispute the shortfall; check the member\'s rate category with the plan.' : 'Overpaid; expect a recoupment and set it aside.'],
    duplicate_payment: (x) => [`${x.month}: paid ${x.lines} times (${x.paid}) instead of once (${x.expected}).`, 'Expect a recoupment; do not spend the extra.'],
    paid_not_eligible: (x) => [`${x.month}: ${x.paid} paid for a member ${x.on_roster ? 'whose dates on the roster do not cover the month' : 'not on your roster'}.`, 'Check the member\'s dates with the plan; set the money aside for recoupment if they were not yours.'],
    retro_term: (x) => [`${x.month}: ${x.paid} taken back on ${x.paid_date} (retroactive term).`, 'Check the term date the plan used against your records.'],
    retro_add: (x) => [`${x.month}: ${x.paid} paid on ${x.paid_date} for an earlier month (retroactive add).`, 'Confirm the member is on your panel and the visits since the effective date are billed correctly.'],
  };
  for (const it of items) { const [m, f2] = T[it.status](it); it.message = m; it.fix = f2; }
  sortByStatus(items, ORDER);
  const money = items.filter((i) => ['not_paid', 'wrong_rate', 'duplicate_payment', 'paid_not_eligible'].includes(i.status));
  const toDispute = round2(money.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0)); const setAside = round2(-money.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0));
  return { months: span, members: M.length, expected: round2(expected), paid: round2(paidTotal), to_dispute: toDispute, to_set_aside: setAside, net: round2(toDispute - setAside), dollars_at_risk: round2(items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0)), by_status: countBy(items, 'status'), items };
}
