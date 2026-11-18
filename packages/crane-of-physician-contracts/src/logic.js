// Crane logic: payments to referral-source physicians against their written agreements. No I/O.
import { str, num, isoDate, daysBetween, yes, round2, personKey, sortByStatus, countBy } from 'kestrel-core';

const ORDER = { paid_no_contract: 0, signed_after_payment: 1, unsigned_contract: 2, expired_contract_paid: 3, over_annual_cap: 4, rate_above_fmv: 5, rate_above_contract: 6, no_time_log: 7, expiring_soon: 8 };
const typeKey = (v) => str(v).toLowerCase().replace(/[^a-z]/g, '');

/** Contract year (start anniversary) a date falls in: the anniversary on or before the date. */
export function contractYearStart(start, date) {
  const s = isoDate(start), d = isoDate(date); if (!s || !d) return null;
  let y = Number(d.slice(0, 4)); let a = `${y}${s.slice(4)}`; if (a > d) a = `${y - 1}${s.slice(4)}`;
  return a;
}

/**
 * contracts: [{ contract_id, physician, npi, type, signed, start, end, hourly_rate, annual_cap, time_log_required }]
 * payments: [{ physician, npi, date, amount, hours, time_log, contract_id }]
 * opts: { asOf, warnDays = 60, fmv = { type: { low, high } }, tolerance = 0.01 }
 */
export function checkPhysicianPayments(contracts, payments, { asOf, warnDays = 60, fmv = {}, tolerance = 0.01 } = {}) {
  const items = [];
  const C = contracts.map((c, i) => ({ id: str(c.contract_id) || `contract ${i + 1}`, physician: str(c.physician), key: personKey(c.physician), npi: str(c.npi) || null, type: str(c.type) || null, signed: isoDate(c.signed), start: isoDate(c.start), end: isoDate(c.end), rate: num(c.hourly_rate), cap: num(c.annual_cap), log: yes(c.time_log_required) }));
  const fmvT = Object.fromEntries(Object.entries(fmv).map(([k, v]) => [typeKey(k), v]));
  const forPayee = (p) => C.filter((c) => (p.npi && c.npi && c.npi === p.npi) || (c.key && c.key === personKey(p.physician)));
  const capSum = new Map(); let total = 0;
  for (const [i, p] of payments.entries()) {
    const date = isoDate(p.date); const amt = num(p.amount); if (!date || amt === null) continue; total += amt;
    const payee = { physician: str(p.physician) || null, npi: str(p.npi) || null };
    const base = { physician: payee.physician, date, amount: round2(amt), line: i + 1, contract_id: null, type: null };
    const mine = forPayee(payee);
    if (!mine.length) { items.push({ ...base, status: 'paid_no_contract', at_risk: amt }); continue; }
    const byRef = str(p.contract_id) ? mine.find((c) => c.id === str(p.contract_id)) : null;
    const active = byRef || mine.find((c) => c.start && c.start <= date && (!c.end || c.end >= date)) || mine.slice().sort((a, b) => (b.end || '').localeCompare(a.end || ''))[0];
    const at = { ...base, contract_id: active.id, type: active.type };
    if (!active.signed) items.push({ ...at, status: 'unsigned_contract', at_risk: amt });
    else if (active.signed > date) items.push({ ...at, status: 'signed_after_payment', at_risk: amt, signed: active.signed });
    if (active.end && date > active.end) items.push({ ...at, status: 'expired_contract_paid', at_risk: amt, end: active.end });
    if (active.cap !== null && active.start) {
      const k = `${active.id}|${contractYearStart(active.start, date)}`; const before = capSum.get(k) || 0; const after = round2(before + amt); capSum.set(k, after);
      if (after > active.cap + tolerance) items.push({ ...at, status: 'over_annual_cap', at_risk: round2(Math.min(amt, after - active.cap)), cap: active.cap, year_total: after });
    }
    const hrs = num(p.hours);
    if (hrs && hrs > 0) {
      const per = round2(amt / hrs);
      const band = fmvT[typeKey(active.type)];
      if (band && band.high !== undefined && per > band.high + tolerance) items.push({ ...at, status: 'rate_above_fmv', at_risk: round2((per - band.high) * hrs), hourly: per, fmv_high: band.high });
      else if (active.rate !== null && per > active.rate + tolerance) items.push({ ...at, status: 'rate_above_contract', at_risk: round2((per - active.rate) * hrs), hourly: per, contract_rate: active.rate });
    }
    if (active.log && !yes(p.time_log) && !/attached|on file|received/i.test(str(p.time_log))) items.push({ ...at, status: 'no_time_log', at_risk: amt });
  }
  for (const c of C) if (c.end && c.end >= asOf && daysBetween(asOf, c.end) <= warnDays) items.push({ physician: c.physician || null, date: null, amount: 0, contract_id: c.id, type: c.type, status: 'expiring_soon', at_risk: 0, end: c.end, days: daysBetween(asOf, c.end) });
  const T = {
    paid_no_contract: (x) => [`${x.physician} was paid ${x.amount} on ${x.date} with no written agreement on file.`, 'Stop further payments and take it to compliance and counsel; a signed agreement must come before payment.'],
    signed_after_payment: (x) => [`${x.physician} was paid ${x.amount} on ${x.date} under ${x.contract_id}, which was signed ${x.signed}.`, 'Take it to compliance: services paid before signature need review.'],
    unsigned_contract: (x) => [`${x.physician} was paid ${x.amount} on ${x.date} under ${x.contract_id}, which has no signature date.`, 'Find the signed copy or stop payments until it is signed.'],
    expired_contract_paid: (x) => [`${x.physician} was paid ${x.amount} on ${x.date}, after ${x.contract_id} ended ${x.end}.`, 'Renew in writing before more payments; ask counsel whether a holdover applies.'],
    over_annual_cap: (x) => [`Payments under ${x.contract_id} reached ${x.year_total} this contract year, above the ${x.cap} cap.`, 'Hold payments and review with compliance.'],
    rate_above_fmv: (x) => [`${x.physician} was paid ${x.hourly} an hour (${x.type}), above your fair-market-value high of ${x.fmv_high}.`, 'Get a valuation review before paying at this rate.'],
    rate_above_contract: (x) => [`${x.physician} was paid ${x.hourly} an hour; ${x.contract_id} says ${x.contract_rate}.`, 'Correct the payment or amend the contract in writing.'],
    no_time_log: (x) => [`${x.physician}'s ${x.date} payment under ${x.contract_id} has no time log, which the contract requires.`, 'Get the signed time log before the next payment.'],
    expiring_soon: (x) => [`${x.contract_id} (${x.physician}, ${x.type || 'type not given'}) ends ${x.end} (in ${x.days} days).`, 'Renew in writing before the end date or stop services.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'at_risk');
  return { contracts: contracts.length, payments: payments.length, paid_total: round2(total), dollars_flagged: round2(items.filter((x) => x.status !== 'expiring_soon').reduce((s, x) => s + x.at_risk, 0)), by_status: countBy(items, 'status'), items };
}
