// Fairpractice Secondary Claims logic: secondary and tertiary claims after the primary pays. No I/O.
import { str, num, isoDate, addDays, daysBetween, round2, sortByStatus, countBy, payerKey, yes } from 'fairpractice-core';

const ORDER = { filing_missed: 0, filing_closing: 1, wrong_payer_order: 2, secondary_not_sent: 3, sent_without_primary_eob: 4 };
export const orderOf = (v) => { const s = str(v).toLowerCase(); if (/^(1|p|pri|primary|1st|first)$/.test(s)) return 1; if (/^(2|s|sec|secondary|2nd|second)$/.test(s)) return 2; if (/^(3|t|ter|tertiary|3rd|third)$/.test(s)) return 3; return num(s); };
const isNo = (v) => /^(n|no|false|0|missing)$/i.test(str(v));

/**
 * claims: [{ claim_id, patient_id, patient_name, dos, payer, order, billed, paid, patient_resp, sent_date, adjudicated_date, eob_attached }]
 * coverage: [{ patient_id, payer, order, effective, term }]
 * opts: { asOf, filingDays = { default: 90 }, warnDays = 21 }
 */
export function checkSecondary(claims, coverage, { asOf, filingDays = { default: 90 }, warnDays = 21 } = {}) {
  const items = []; const names = new Map();
  for (const r of [...claims, ...coverage]) { const id = str(r.patient_id); if (id && r.patient_name) names.set(id, str(r.patient_name)); }
  const COV = coverage.map((c) => ({ pid: str(c.patient_id) || str(c.patient_name), payer: str(c.payer), pk: payerKey(c.payer), order: orderOf(c.order), eff: isoDate(c.effective), term: isoDate(c.term) })).filter((c) => c.pid && c.pk && c.order);
  const covOn = (pid, dos) => COV.filter((c) => c.pid === pid && (!c.eff || c.eff <= dos) && (!c.term || c.term >= dos)).sort((a, b) => a.order - b.order);
  const C = claims.map((c, i) => ({ i, id: str(c.claim_id) || `line ${i + 1}`, pid: str(c.patient_id) || str(c.patient_name), dos: isoDate(c.dos), payer: str(c.payer), pk: payerKey(c.payer), order: orderOf(c.order) || 1, billed: num(c.billed) || 0, paid: num(c.paid), pr: num(c.patient_resp), sent: isoDate(c.sent_date), adj: isoDate(c.adjudicated_date), eob: str(c.eob_attached) })).filter((c) => c.pid && c.dos);
  const daysFor = (payer) => { const k = Object.keys(filingDays).find((x) => x !== 'default' && payerKey(x) === payerKey(payer)); return num(filingDays[k ?? 'default']) ?? 90; };
  const b = (c) => ({ claim_id: c.id, patient_id: c.pid, patient_name: names.get(c.pid) || null, date: c.dos, payer: c.payer });
  const group = new Map(); for (const c of C) { const k = `${c.pid}|${c.dos}`; if (!group.has(k)) group.set(k, []); group.get(k).push(c); }
  for (const list of group.values()) {
    const cov = covOn(list[0].pid, list[0].dos);
    for (const c of list) {
      const should = cov.find((x) => x.pk === c.pk);
      if (should && should.order !== c.order) items.push({ ...b(c), status: 'wrong_payer_order', billed_as: c.order, coverage_order: should.order, amount: c.billed });
    }
    for (const c of list.filter((x) => x.order > 1)) {
      const prev = list.find((x) => x.order === c.order - 1);
      if (!prev || !prev.adj || (c.sent && c.sent < prev.adj) || isNo(c.eob)) items.push({ ...b(c), status: 'sent_without_primary_eob', sent: c.sent, prior_adjudicated: prev?.adj || null, amount: c.billed });
    }
    // Next payer in line after each adjudicated claim with a balance left.
    for (const c of list) {
      if (!c.adj || c.order >= 3) continue; const balance = c.pr ?? round2(c.billed - (c.paid || 0)); if (!(balance > 0)) continue;
      const nextCov = cov.find((x) => x.order === c.order + 1); if (!nextCov) continue;
      if (list.some((x) => x.order === c.order + 1)) continue;
      const due = addDays(c.adj, daysFor(nextCov.payer)); const left = daysBetween(asOf, due);
      const base = { ...b(c), payer: nextCov.payer, prior_payer: c.payer, prior_adjudicated: c.adj, next_order: c.order + 1, balance, due, amount: balance };
      if (left < 0) items.push({ ...base, status: 'filing_missed', days_late: -left });
      else if (left <= warnDays) items.push({ ...base, status: 'filing_closing', days_left: left });
      else items.push({ ...base, status: 'secondary_not_sent', days_left: left });
    }
  }
  const ord = (n) => ['', 'primary', 'secondary', 'tertiary'][n] || `payer ${n}`;
  const T = {
    filing_missed: (x) => [`${x.claim_id}: ${x.prior_payer} adjudicated ${x.prior_adjudicated} leaving ${x.balance}; the ${ord(x.next_order)} claim to ${x.payer} was due by ${x.due}.`, 'Send it anyway with proof of the primary EOB date if the payer accepts late secondaries; otherwise decide on the balance under your policy.'],
    filing_closing: (x) => [`${x.claim_id}: ${x.balance} left after ${x.prior_payer}; send the ${ord(x.next_order)} claim to ${x.payer} by ${x.due} (${x.days_left} days).`, 'Send the claim with the primary EOB attached today.'],
    wrong_payer_order: (x) => [`${x.claim_id}: billed to ${x.payer} as ${ord(x.billed_as)}, but coverage on file has it as ${ord(x.coverage_order)}.`, 'Check coordination of benefits with the patient and both payers, then rebill in the right order.'],
    secondary_not_sent: (x) => [`${x.claim_id}: ${x.balance} left after ${x.prior_payer} adjudicated ${x.prior_adjudicated}; no ${ord(x.next_order)} claim to ${x.payer} yet.`, `Send it with the primary EOB; due by ${x.due}.`],
    sent_without_primary_eob: (x) => [`${x.claim_id}: claim to ${x.payer} sent ${x.sent || '(no date)'} ${x.prior_adjudicated ? `before the prior payer adjudicated (${x.prior_adjudicated}) or without its EOB` : 'with no adjudicated prior claim on file'}.`, 'Wait for the prior payer\'s EOB and send it with the claim; expect a denial for this one.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { claims: claims.length, patients: new Set(C.map((c) => c.pid)).size, dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
