// Heron logic: everyone you pay against exclusion lists. No I/O.
import { str, isoDate, daysBetween, personKey, jaroWinkler, round2, nearNameIndex, normalizeName, npiValid, sortByStatus, countBy } from 'kestrel-core';

const ORDER = { npi_match: 0, confirmed_match: 1, possible_match: 2, near_name: 3, dob_differs: 4, reinstated: 5, never_screened: 6, screening_overdue: 7 };
const ENTITY_TYPES = /vendor|business|company|entity|supplier|org/i;

/** One exclusion entry from an OIG LEIE, SAM or state row (fields already mapped). */
export function exclusionEntry(r, source) {
  const name = str(r.name) || [r.first_name, r.middle_name, r.last_name].map(str).filter(Boolean).join(' ');
  const business = str(r.business_name);
  return { source: str(r.source) || source, name: name || null, business: business || null, npi: /^\d{10}$/.test(str(r.npi)) && str(r.npi) !== '0000000000' ? str(r.npi) : null, dob: isoDate(r.dob), excluded_on: isoDate(r.excluded_on), reinstated_on: isoDate(r.reinstated_on), type: str(r.exclusion_type) || null, state: str(r.state) || null };
}

/**
 * Screen people against exclusion entries.
 * people: [{ id, name, dob, npi, type, last_screened }]
 * opts: { asOf, nearThreshold = 0.92, intervalDays = 31, cleared(person, entry) -> true when a person reviewed and cleared that entry }
 */
export function screen(people, entries, { asOf, nearThreshold = 0.92, intervalDays = 31, cleared = () => false } = {}) {
  const byNpi = new Map(); const byName = new Map(); const byBiz = new Map();
  for (const e of entries) {
    if (e.npi) { if (!byNpi.has(e.npi)) byNpi.set(e.npi, []); byNpi.get(e.npi).push(e); }
    if (e.name) { const k = personKey(e.name); if (k) { if (!byName.has(k)) byName.set(k, []); byName.get(k).push(e); } }
    // A business is matched on the list's business name, or on its plain name when the list has one name column
    // for people and companies alike (most state Medicaid lists; a German or French export names it as a person's name).
    const biz = e.business || e.name; if (biz) { const k = normalizeName(biz); if (k) { if (!byBiz.has(k)) byBiz.set(k, []); byBiz.get(k).push(e); } }
  }
  // Near names: only listed names sharing a word, or a word one typo away (kestrel-core nearNameIndex), are
  // compared, not every listed name for every person (minutes at 10,000 rows; the OIG list has about 80,000).
  const candidates = nearNameIndex(byName.keys(), { maxLenDiff: 4 });
  const nearCache = new Map();
  const nearOf = (pk) => {
    if (nearCache.has(pk)) return nearCache.get(pk);
    const out = []; for (const k of candidates(pk)) { const sim = round2(jaroWinkler(k, pk)); if (sim >= nearThreshold) out.push([k, sim]); }
    nearCache.set(pk, out); return out;
  };
  const active = (e) => !(e.reinstated_on && (!asOf || e.reinstated_on <= asOf));
  const items = [];
  for (const [i, p] of people.entries()) {
    const name = str(p.name); if (!name && !str(p.npi)) continue;
    const base = { person_id: str(p.id) || null, name: name || null, type: str(p.type) || null, line: i + 1 };
    const seen = new Set();
    const push = (status, e, extra = {}) => { const key = `${status}|${e ? (e.name || e.business) + e.source : ''}`; if (seen.has(key)) return; seen.add(key); items.push({ ...base, status, list: e ? e.source : null, listed_name: e ? (e.name || e.business) : null, listed_npi: e ? e.npi : null, excluded_on: e ? e.excluded_on : null, reinstated_on: e ? e.reinstated_on : null, ...extra }); };
    const npi = str(p.npi);
    const hits = [];
    if (npi && npiValid(npi)) for (const e of byNpi.get(npi) || []) hits.push(['npi', e]);
    const pk = personKey(name);
    const isEntity = ENTITY_TYPES.test(str(p.type));
    if (isEntity) { for (const e of byBiz.get(normalizeName(name)) || []) hits.push(['name', e]); }
    else if (pk) {
      for (const e of byName.get(pk) || []) hits.push(['name', e]);
      if (!(byName.get(pk) || []).length) for (const [k, sim] of nearOf(pk)) for (const e of byName.get(k)) hits.push(['near', e, sim]);
    }
    const npiHit = new Set(hits.filter((h) => h[0] === 'npi').map((h) => h[1]));
    for (const [how, e, sim] of hits) {
      if (how !== 'npi' && npiHit.has(e)) continue;
      if (how !== 'npi' && cleared(p, e)) continue;
      if (!active(e)) { push('reinstated', e); continue; }
      if (how === 'npi') { push('npi_match', e); continue; }
      const pd = isoDate(p.dob);
      if (how === 'near') { push('near_name', e, { similarity: sim }); continue; }
      if (pd && e.dob) push(pd === e.dob ? 'confirmed_match' : 'dob_differs', e); else push('possible_match', e);
    }
    const last = isoDate(p.last_screened);
    if (!last) push('never_screened', null); else if (asOf && daysBetween(last, asOf) > intervalDays) push('screening_overdue', null, { last_screened: last, days_since: daysBetween(last, asOf) });
  }
  const T = {
    npi_match: (x) => [`${x.name}'s NPI is on ${x.list} (excluded ${x.excluded_on || 'date not given'}).`, 'Stop billing for this person\'s services today and take it to your compliance officer and counsel; claims they touched since the exclusion may have to be repaid.'],
    confirmed_match: (x) => [`${x.name} matches ${x.list} by name and birth date (excluded ${x.excluded_on || 'date not given'}).`, 'Treat as excluded: remove from federal program work and take it to your compliance officer and counsel.'],
    possible_match: (x) => [`${x.name} matches a name on ${x.list}; no birth date to confirm.`, 'Verify with a second identifier (birth date, NPI, address, SSN through the official site) and record the result.'],
    near_name: (x) => [`${x.name} is close to ${x.listed_name} on ${x.list} (similarity ${x.similarity}).`, 'Usually a different person: compare birth date or NPI, then clear it (heron_learn, kind cleared_match) so it stops showing.'],
    dob_differs: (x) => [`${x.name} has the same name as an entry on ${x.list}, but the birth dates differ.`, 'Likely a different person. Note the check in the file and clear it.'],
    reinstated: (x) => [`${x.name} matches ${x.list}, reinstated on ${x.reinstated_on}.`, 'Keep the reinstatement record with the file; no action if the dates line up.'],
    never_screened: (x) => [`${x.name} has no screening date.`, 'Screen before their next shift or payment, then record the date.'],
    screening_overdue: (x) => [`${x.name} was last screened ${x.days_since} days ago.`, 'Screen this month; most payers and states expect monthly checks.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  const flagged = new Set(items.filter((i) => ORDER[i.status] <= 2).map((i) => i.line));
  return { people: people.length, list_entries: entries.length, needs_action: flagged.size, by_status: countBy(items, 'status'), items };
}
