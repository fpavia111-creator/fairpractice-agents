// Fairpractice Staff Licenses logic: staff licenses and certifications against roles, dates and shifts. No I/O.
import { str, isoDate, daysBetween, yes, sortByStatus, countBy } from 'fairpractice-core';

const ORDER = { worked_expired: 0, expired: 1, missing_required: 2, wrong_state: 3, expiring_soon: 4, never_verified: 5, verification_stale: 6 };
/** Credential name for matching: "RN License", "rn-license" and "R.N. license" are the same. */
export const credKey = (v) => str(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const roleKey = credKey;

/**
 * creds: [{ person_id, name, role, department, credential, number, state, expires, verified_on, compact }]
 * roster: [{ person_id, name, role, department, work_state, status }] (optional)
 * shifts: [{ person_id, date, work_state }] (optional)
 * opts: { asOf, warnDays = 60, verifyDays = 365, requiredByRole = { role: [credential] }, compactStates = [], stateLicensed = [credential names that are state licenses] }
 */
export function checkCredentials(creds, roster = [], shifts = [], { asOf, warnDays = 60, verifyDays = 365, requiredByRole = {}, compactStates = [], stateLicensed = [] } = {}) {
  const items = [];
  const people = new Map();
  for (const r of roster) { const id = str(r.person_id) || str(r.name); if (!id || /term|inactive|separated|left/i.test(str(r.status))) continue; people.set(id, { id, name: str(r.name) || null, role: str(r.role) || null, department: str(r.department) || null, work_state: str(r.work_state).toUpperCase() || null }); }
  const byPerson = new Map();
  for (const c of creds) { const id = str(c.person_id) || str(c.name); if (!id) continue; if (!byPerson.has(id)) byPerson.set(id, []); byPerson.get(id).push(c); if (!people.has(id) && !roster.length) people.set(id, { id, name: str(c.name) || null, role: str(c.role) || null, department: str(c.department) || null, work_state: null }); }
  const req = Object.fromEntries(Object.entries(requiredByRole).map(([k, v]) => [roleKey(k), v]));
  const compact = new Set(compactStates.map((s) => str(s).toUpperCase()));
  const licensed = new Set(stateLicensed.map(credKey));
  const shiftsBy = new Map(); for (const s of shifts) { const id = str(s.person_id); const d = isoDate(s.date); if (!id || !d) continue; if (!shiftsBy.has(id)) shiftsBy.set(id, []); shiftsBy.get(id).push({ date: d, work_state: str(s.work_state).toUpperCase() || null }); }
  const add = (p, status, c, extra) => items.push({ status, person_id: p.id, name: p.name, role: p.role, department: p.department, credential: c ? str(c.credential) : extra.credential, state: c ? (str(c.state).toUpperCase() || null) : null, expires: c ? isoDate(c.expires) : null, ...extra });
  for (const p of people.values()) {
    const list = byPerson.get(p.id) || [];
    // Keep the latest row per credential (a renewal is a new row).
    const latest = new Map();
    for (const c of list) { const k = credKey(c.credential) + '|' + str(c.state).toUpperCase(); const prev = latest.get(k); if (!prev || (isoDate(c.expires) || '') > (isoDate(prev.expires) || '')) latest.set(k, c); }
    const have = new Set([...latest.values()].map((c) => credKey(c.credential)));
    for (const need of req[roleKey(p.role)] || []) if (!have.has(credKey(need))) add(p, 'missing_required', null, { credential: need, days: null });
    for (const c of latest.values()) {
      const exp = isoDate(c.expires); const left = exp && asOf ? daysBetween(asOf, exp) : null;
      if (exp && left < 0) {
        const worked = (shiftsBy.get(p.id) || []).filter((s) => s.date > exp && (!asOf || s.date <= asOf));
        if (worked.length) add(p, 'worked_expired', c, { days: left, shifts: worked.length, first_shift: worked.map((s) => s.date).sort()[0] });
        else add(p, 'expired', c, { days: left });
      } else if (exp && left <= warnDays) add(p, 'expiring_soon', c, { days: left });
      const ver = isoDate(c.verified_on);
      if (exp && left < 0) { /* an expired credential needs renewal first; verification is checked on the new one */ }
      else if (!ver) add(p, 'never_verified', c, { days: null });
      else if (asOf && daysBetween(ver, asOf) > verifyDays) add(p, 'verification_stale', c, { days: daysBetween(ver, asOf), verified_on: ver });
      if (licensed.has(credKey(c.credential))) {
        const lic = str(c.state).toUpperCase(); const multi = yes(c.compact) || /multi|compact/i.test(str(c.compact));
        const states = new Set([p.work_state, ...(shiftsBy.get(p.id) || []).map((s) => s.work_state)].filter(Boolean));
        for (const ws of states) {
          if (!lic || ws === lic) continue;
          // A multistate license from a compact state covers other compact states; a single-state license covers only its state.
          const ok = multi && compact.has(lic) && compact.has(ws);
          if (!ok && !list.some((x) => credKey(x.credential) === credKey(c.credential) && str(x.state).toUpperCase() === ws)) add(p, 'wrong_state', c, { days: null, work_state: ws });
        }
      }
    }
  }
  const T = {
    worked_expired: (x) => [`${x.name} worked ${x.shifts} shift(s) after their ${x.credential} expired on ${x.expires}.`, 'Take them off the schedule until renewed and ask compliance whether those shifts can be billed.'],
    expired: (x) => [`${x.name}'s ${x.credential} expired on ${x.expires} (${-x.days} days ago).`, 'Keep them off duties that need it until the renewal is verified.'],
    missing_required: (x) => [`${x.name} (${x.role}) has no ${x.credential} on file.`, 'Collect and verify it, or correct the role.'],
    wrong_state: (x) => [`${x.name} works in ${x.work_state}, but their ${x.credential} is from ${x.state} and does not cover ${x.work_state}.`, 'Get a license for that state, or confirm a multistate (compact) license and mark it.'],
    expiring_soon: (x) => [`${x.name}'s ${x.credential} expires on ${x.expires} (in ${x.days} days).`, 'Remind them to renew and verify the new card when it comes.'],
    never_verified: (x) => [`${x.name}'s ${x.credential} has never been verified with the issuing board.`, 'Verify it at the source (board site or Nursys) and record the date.'],
    verification_stale: (x) => [`${x.name}'s ${x.credential} was last verified ${x.days} days ago.`, 'Re-verify at the source and record the date.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'shifts');
  return { people: people.size, credentials: creds.length, shifts_checked: shifts.length, by_status: countBy(items, 'status'), items };
}
