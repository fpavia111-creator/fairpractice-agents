// Helpers added for Fairpractice wave 2 (pharmacy, hospital, payer and patient-aid agents). Pure: no I/O.
import { str, num, isoDate, daysBetween, round2 } from 'fairclaim-core';
import { codeKey } from './med.js';

/**
 * An NDC as 11 digits (5-4-2) for matching. Accepts 5-4-2, 4-4-2, 5-3-2 and 5-4-1 with dashes, or
 * 11 digits. Ten digits without dashes are ambiguous (4-4-2, 5-3-2 or 5-4-1); they are read as 4-4-2
 * (a leading zero), so exports should keep the dashes or the 11-digit form. Null when unreadable.
 */
export function ndcKey(v) {
  const s = str(v).replace(/[\s*]/g, '');
  const dashed = /^(\d{4,5})-(\d{3,4})-(\d{1,2})$/.exec(s);
  if (dashed) return dashed[1].padStart(5, '0') + dashed[2].padStart(4, '0') + dashed[3].padStart(2, '0');
  const d = s.replace(/\D/g, '');
  if (d.length === 11) return d;
  if (d.length === 10) return `0${d}`;
  return null;
}

/**
 * True when a code is on a list. List entries are single codes ("97110"), ranges ("70450-70498",
 * numeric part compared, same letter prefix), or prefixes with a wildcard ("E11.*", "J9*").
 * Codes are compared without spaces and dots, in upper case. A range covers longer codes that start inside it
 * (I20-I25 covers I21.4), so ICD-10 category ranges work as written.
 */
export function inCodeList(code, list) {
  const c = codeKey(code); if (!c) return false;
  for (const raw of Array.isArray(list) ? list : str(list).split(/[;,|]+/)) {
    const e = codeKey(raw); if (!e) continue;
    if (e.endsWith('*')) { if (c.startsWith(e.slice(0, -1))) return true; continue; }
    const r = /^([A-Z]?)(\d+)-([A-Z]?)(\d+)$/.exec(e);
    if (r) {
      const m = /^([A-Z]?)(\d+)$/.exec(c);
      // Same letter; the code's leading digits (as many as the range ends have) inside the range, so I20-I25 covers I21.4.
      if (m && m[1] === r[1] && r[2].length === r[4].length && m[2].length >= r[2].length) { const head = Number(m[2].slice(0, r[2].length)); if (head >= Number(r[2]) && head <= Number(r[4])) return true; }
      continue;
    }
    if (c === e) return true;
  }
  return false;
}

/**
 * Household income as a percent of the poverty guideline. guidelines: { base, per_person } for the
 * first person and each extra person (a setting: the values change every year and differ for Alaska
 * and Hawaii). Null when income or size is missing.
 */
export function fplPercent(income, size, guidelines) {
  const i = num(income), n = Math.round(num(size) ?? 0);
  if (i === null || i < 0 || !n || n < 1 || !guidelines) return null;
  const line = num(guidelines.base) + num(guidelines.per_person) * (n - 1);
  return line > 0 ? round2((i / line) * 100) : null;
}

/** a as a percent of b, rounded to 2 places; null when b is 0 or missing. */
export const pctOf = (a, b) => { const x = num(a), y = num(b); return x === null || !y ? null : round2((x / y) * 100); };

/** Days from a date to as-of (null when the date is missing). */
export const daysSince = (d, asOf) => (isoDate(d) ? daysBetween(d, asOf) : null);

/** The row with the latest date in `field` for each key. rows: [{...}], key(row) -> string. */
export function latestBy(rows, key, field) {
  const m = new Map();
  for (const r of rows) { const k = key(r); const d = isoDate(r[field]); if (!k) continue; const cur = m.get(k); if (!cur || (d && (!isoDate(cur[field]) || d > isoDate(cur[field])))) m.set(k, r); }
  return m;
}

/** A small name -> rule lookup where keys are matched without case, spaces or punctuation (payer, state, PBM names in settings). */
export function lookupRule(rules, name) {
  if (!rules || typeof rules !== 'object') return null;
  const k = str(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, v] of Object.entries(rules)) if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === k) return v;
  return null;
}
