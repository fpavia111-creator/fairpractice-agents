// Fairpractice Surprise Billing Disputes logic: No Surprises Act payment disputes: open negotiation and IDR clocks, QPA, batching, outcomes and fees. No I/O.
import { str, num, isoDate, round2, sortByStatus, countBy, codeKey, addBusinessDays, businessDaysBetween } from 'fairpractice-core';

const ORDER = { idr_window_missed: 0, negotiation_window_missed: 1, idr_due: 2, negotiation_due_soon: 3, paid_below_qpa: 4, low_value: 5, batchable: 6 };
const outcomeOf = (v) => { const s = str(v).toLowerCase(); if (/won|prevail|provider|award/.test(s)) return 'won'; if (/lost|payer|denied/.test(s)) return 'lost'; if (/settl/.test(s)) return 'settled'; if (/ineligib|dismiss|withdr/.test(s)) return 'closed'; return s ? 'pending' : null; };

/**
 * disputes: [{ claim_id, patient_id, patient_name, payer, cpt, date, initial_payment_date, paid, qpa, our_offer, negotiation_sent, idr_initiated, outcome, award, fees_paid }]
 * opts: { asOf, negotiationDays = 30, idrDays = 4, warnDays = 10, adminFee = 115, entityFee = 0, qpaGapPct = 10, holidays = [] }
 */
export function checkDisputes(disputes, { asOf, negotiationDays = 30, idrDays = 4, warnDays = 10, adminFee = 115, entityFee = 0, qpaGapPct = 10, holidays = [] } = {}) {
  const items = []; const payers = new Map(); const open = [];
  for (const [i, d] of disputes.entries()) {
    const claim = str(d.claim_id) || `line ${i + 1}`; const payer = str(d.payer) || '(unknown payer)'; const cpt = codeKey(d.cpt) || null;
    const paid = num(d.paid) || 0; const qpa = num(d.qpa); const offer = num(d.our_offer); const outcome = outcomeOf(d.outcome);
    const initial = isoDate(d.initial_payment_date); const sent = isoDate(d.negotiation_sent); const idr = isoDate(d.idr_initiated);
    const b = { claim_id: claim, patient_id: str(d.patient_id) || null, patient_name: str(d.patient_name) || null, payer, cpt, paid, qpa, line: i + 1 };
    const p = payers.get(payer) || { payer, disputes: 0, won: 0, lost: 0, pending: 0, awarded_over_paid: 0, fees_paid: 0 }; p.disputes++; p.fees_paid = round2(p.fees_paid + (num(d.fees_paid) || 0));
    if (outcome === 'won') { p.won++; p.awarded_over_paid = round2(p.awarded_over_paid + Math.max(0, (num(d.award) || 0) - paid)); } else if (outcome === 'lost') p.lost++; else if (!outcome || outcome === 'pending') p.pending++;
    payers.set(payer, p);
    if (outcome && outcome !== 'pending') continue;
    const fees = adminFee + entityFee; const gap = round2((offer ?? qpa ?? paid) - paid);
    // Open negotiation: start within 30 business days of the initial payment or denial.
    if (!sent && !idr && initial) {
      const due = addBusinessDays(initial, negotiationDays, holidays); const left = businessDaysBetween(asOf, due, holidays);
      if (due < asOf) { items.push({ ...b, date: due, status: 'negotiation_window_missed', due, amount: Math.max(0, gap) }); continue; }
      if (left <= warnDays) items.push({ ...b, date: due, status: 'negotiation_due_soon', due, business_days_left: left, amount: 0 });
    }
    // IDR: start within 4 business days after the 30-business-day negotiation ends.
    if (sent && !idr) {
      const ends = addBusinessDays(sent, negotiationDays, holidays); const due = addBusinessDays(ends, idrDays, holidays);
      if (due < asOf) { items.push({ ...b, date: due, status: 'idr_window_missed', negotiation_ended: ends, due, amount: Math.max(0, gap) }); continue; }
      if (ends <= asOf) items.push({ ...b, date: due, status: 'idr_due', negotiation_ended: ends, due, business_days_left: businessDaysBetween(asOf, due, holidays), amount: 0 });
      else open.push({ ...b, ends, sent });
    }
    if (qpa !== null && paid < qpa * (1 - qpaGapPct / 100)) items.push({ ...b, date: initial || asOf, status: 'paid_below_qpa', below_by: round2(qpa - paid), below_pct: round2(((qpa - paid) / qpa) * 100), amount: 0 });
    if (gap < fees) items.push({ ...b, date: initial || asOf, status: 'low_value', in_dispute: gap, fees, amount: 0 });
  }
  // Batching: open negotiations with the same payer and code can often go to IDR together.
  const groups = new Map(); for (const o of open) { if (!o.cpt) continue; const k = `${o.payer}|${o.cpt}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  for (const [k, g] of groups) if (g.length > 1) { const [payer, cpt] = k.split('|'); items.push({ claim_id: g.map((x) => x.claim_id).join(', '), patient_id: null, patient_name: null, payer, cpt, date: g.map((x) => x.ends).sort()[0], status: 'batchable', count: g.length, amount: 0 }); }
  const T = {
    idr_window_missed: (x) => [`${x.claim_id} (${x.payer}): negotiation ended ${x.negotiation_ended} and the IDR window closed ${x.due} with no IDR started.`, 'Check whether an extension applies; otherwise this dispute is closed. Tighten the calendar for the rest.'],
    negotiation_window_missed: (x) => [`${x.claim_id} (${x.payer}): open negotiation had to start by ${x.due} and was not sent.`, 'This claim can no longer go to IDR unless an exception applies; record it and fix the intake step.'],
    idr_due: (x) => [`${x.claim_id} (${x.payer}): negotiation ended ${x.negotiation_ended}; start IDR by ${x.due} (${x.business_days_left} business day(s) left).`, 'File the IDR initiation with the offer and supporting facts, or settle before the date.'],
    negotiation_due_soon: (x) => [`${x.claim_id} (${x.payer}): open negotiation must start by ${x.due} (${x.business_days_left} business day(s) left).`, 'Send the open negotiation notice with the claim details and your offer.'],
    paid_below_qpa: (x) => [`${x.claim_id} (${x.payer}): paid ${x.paid}, ${x.below_by} (${x.below_pct}%) below the payer's own QPA of ${x.qpa}.`, 'Ask the payer to explain the payment and the QPA; use it in negotiation.'],
    low_value: (x) => [`${x.claim_id} (${x.payer}): ${x.in_dispute} in dispute against about ${x.fees} in fees.`, 'Consider settling, or batching with similar claims so the fees are shared.'],
    batchable: (x) => [`${x.count} open negotiations with ${x.payer} for ${x.cpt} (${x.claim_id}) may be batched into one IDR.`, 'Check the batching rules (same payer, same or similar service, 30-business-day window) and file together.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  const by_payer = [...payers.values()].map((p) => ({ ...p, win_rate: p.won + p.lost ? round2((p.won / (p.won + p.lost)) * 100) : null })).sort((a, c) => c.disputes - a.disputes || a.payer.localeCompare(c.payer));
  return { disputes: disputes.length, by_payer, fees_paid: round2(by_payer.reduce((s, p) => s + p.fees_paid, 0)), awarded_over_paid: round2(by_payer.reduce((s, p) => s + p.awarded_over_paid, 0)), dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
