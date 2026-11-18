// Swift logic: business associate inventory, BAAs and reviews, and vendors paid but not listed. No I/O.
import { str, num, isoDate, daysBetween, yes, round2, normalizeName, nameSimilarity, sortByStatus, countBy } from 'kestrel-core';

const ORDER = { baa_missing: 0, baa_expired: 1, paid_not_on_list: 2, phi_unknown: 3, never_reviewed: 4, review_overdue: 5, baa_expiring: 6 };
export const PHI_SERVICE_WORDS = Object.freeze(['billing', 'coding', 'clearinghouse', 'transcription', 'scribe', 'ehr', 'emr', 'practice management', 'cloud', 'hosting', 'backup', 'it services', 'managed services', 'msp', 'shred', 'records', 'release of information', 'answering', 'call center', 'collections', 'collection agency', 'lab', 'imaging', 'reminder', 'patient portal', 'consult', 'audit', 'legal', 'accounting', 'telehealth', 'fax', 'email', 'courier', 'storage', 'analytics', 'ai ']);
const phiLikely = (service, words) => { const s = ` ${str(service).toLowerCase()} `; return words.some((w) => s.includes(w.toLowerCase())); };
const touches = (v) => { const s = str(v).toLowerCase(); if (!s || /unknown|\?|tbd/.test(s)) return null; return yes(s) || /phi|patient/.test(s); };

/**
 * vendors: [{ vendor, service, touches_phi, baa_signed, baa_expires, last_review, owner }]
 * payments: [{ vendor, date, amount }] (optional)
 * opts: { asOf, reviewDays = 365, warnDays = 60, phiWords = PHI_SERVICE_WORDS, minPaid = 0, notBa = [vendor names known not to be BAs] }
 */
export function checkAssociates(vendors, payments = [], { asOf, reviewDays = 365, warnDays = 60, phiWords = PHI_SERVICE_WORDS, minPaid = 0, notBa = [] } = {}) {
  const items = []; let bas = 0;
  const listed = vendors.map((v) => ({ name: str(v.vendor), key: normalizeName(v.vendor) })).filter((x) => x.key);
  for (const [i, v] of vendors.entries()) {
    const name = str(v.vendor); if (!name) continue;
    const t = touches(v.touches_phi);
    const base = { vendor: name, service: str(v.service) || null, owner: str(v.owner) || null, baa_signed: isoDate(v.baa_signed), baa_expires: isoDate(v.baa_expires), last_review: isoDate(v.last_review), line: i + 1, amount: 0 };
    if (t === null) { if (phiLikely(v.service, phiWords)) items.push({ ...base, status: 'phi_unknown', days: null }); continue; }
    if (!t) continue;
    bas++;
    if (!base.baa_signed) items.push({ ...base, status: 'baa_missing', days: null });
    else if (base.baa_expires && base.baa_expires < asOf) items.push({ ...base, status: 'baa_expired', days: daysBetween(base.baa_expires, asOf) });
    else if (base.baa_expires && daysBetween(asOf, base.baa_expires) <= warnDays) items.push({ ...base, status: 'baa_expiring', days: daysBetween(asOf, base.baa_expires) });
    if (!base.last_review) items.push({ ...base, status: 'never_reviewed', days: null });
    else if (daysBetween(base.last_review, asOf) > reviewDays) items.push({ ...base, status: 'review_overdue', days: daysBetween(base.last_review, asOf) });
  }
  // Vendors paid but missing from the inventory.
  const skip = new Set(notBa.map((n) => normalizeName(n)));
  const paid = new Map();
  for (const p of payments) {
    const key = normalizeName(p.vendor); if (!key || skip.has(key)) continue;
    const onList = listed.some((x) => x.key === key || nameSimilarity(x.name, p.vendor) >= 0.9);
    if (onList) continue;
    const cur = paid.get(key) || { vendor: str(p.vendor), amount: 0, payments: 0, last: null, service: str(p.category) || null };
    cur.amount = round2(cur.amount + (num(p.amount) || 0)); cur.payments++; const d = isoDate(p.date); if (d && (!cur.last || d > cur.last)) cur.last = d; paid.set(key, cur);
  }
  for (const x of paid.values()) if (x.amount >= minPaid) items.push({ vendor: x.vendor, service: x.service, owner: null, status: 'paid_not_on_list', days: null, amount: x.amount, payments: x.payments, last_paid: x.last });
  const T = {
    baa_missing: (x) => [`${x.vendor} (${x.service || 'service not given'}) handles patient data and has no signed BAA on file.`, 'Get a BAA signed before they receive more patient data, or stop sending it.'],
    baa_expired: (x) => [`${x.vendor}'s BAA ended ${x.baa_expires} (${x.days} days ago).`, 'Renew or confirm it continues; check the contract\'s term clause.'],
    paid_not_on_list: (x) => [`${x.vendor} was paid ${x.amount} (${x.payments} payment(s)) but is not on the business associate inventory.`, 'Ask the owner what they do; add them with a yes/no on patient data, or mark them as not a business associate.'],
    phi_unknown: (x) => [`${x.vendor} (${x.service}) has no answer on whether it handles patient data, and its service usually does.`, 'Find out and record yes or no.'],
    never_reviewed: (x) => [`${x.vendor} handles patient data and has never had a security review on file.`, 'Send your vendor security questionnaire and record the date.'],
    review_overdue: (x) => [`${x.vendor}'s last security review was ${x.days} days ago.`, 'Repeat the review this quarter.'],
    baa_expiring: (x) => [`${x.vendor}'s BAA ends ${x.baa_expires} (in ${x.days} days).`, 'Start the renewal.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  items.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.amount || 0) - (a.amount || 0) || a.vendor.localeCompare(b.vendor));
  return { vendors: vendors.length, business_associates: bas, payments_checked: payments.length, by_status: countBy(items, 'status'), items };
}
