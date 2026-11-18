// Shared helpers for the Kestrel agents (practice, home care, compliance). Pure: no I/O.
import { str, num, isoDate, addDays, daysBetween, payerKey, round2, normalizeName, jaroWinkler } from 'remedy-core';

/** First and last day of a month 'YYYY-MM'. */
export function monthBounds(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(str(month)); if (!m) return null;
  const start = `${m[1]}-${m[2]}-01`;
  const last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
  return { start, end: last, days: Number(last.slice(8)) };
}
export const monthOf = (d) => (isoDate(d) || '').slice(0, 7);
/** Per-diem rate for payer (or payer type) + level on a date from a rate table [{ payer?, payer_type?, level?, rate, from?, to? }]. Most specific wins. */
export function rateFor(rates, { payer, payer_type, level, date }) {
  const pk = payer ? payerKey(payer) : null; const lv = str(level).toUpperCase();
  let best = null; let score = -1;
  for (const r of rates || []) {
    if (r.payer && payerKey(r.payer) !== pk) continue;
    if (r.payer_type && r.payer_type !== payer_type) continue;
    if (r.level && str(r.level).toUpperCase() !== lv) continue;
    if (date && r.from && isoDate(r.from) > date) continue;
    if (date && r.to && isoDate(r.to) < date) continue;
    const s = (r.payer ? 4 : 0) + (r.level ? 2 : 0) + (r.payer_type ? 1 : 0);
    if (s > score) { best = r; score = s; }
  }
  return best ? num(best.rate) : null;
}

/** Days old between two dates, and a bucket label. */
export function ageDays(from, asOf) { const d = daysBetween(from, asOf); return d === null ? null : d; }
export const AGING_EDGES = Object.freeze([30, 60, 90, 120, 180, 365]);
export function agingBucket(days, edges = AGING_EDGES) {
  if (days === null || days === undefined) return 'unknown';
  if (days < 0) return 'future';
  let lo = 0; for (const e of edges) { if (days <= e) return `${lo}-${e}`; lo = e + 1; }
  return `${edges.at(-1)}+`;
}

/** Sum a field over items, rounded to cents. */
export const total = (items, f) => round2(items.reduce((s, x) => s + (Number(typeof f === 'function' ? f(x) : x[f]) || 0), 0));

/** Count of items by a key, as { key: n }. */
export function countBy(items, key) { const m = {}; for (const x of items) { const k = typeof key === 'function' ? key(x) : x[key]; if (k === undefined || k === null) continue; m[k] = (m[k] || 0) + 1; } return m; }

/** Sort items by an order map for `status`, then by a secondary key (descending amount by default). */
export function sortByStatus(items, order, amountKey = 'amount') {
  const o = (s) => (order[s] ?? 99);
  return items.sort((a, b) => o(a.status) - o(b.status) || (Number(b[amountKey]) || 0) - (Number(a[amountKey]) || 0) || String(a.patient_id ?? a.person_id ?? a.id ?? '').localeCompare(String(b.patient_id ?? b.person_id ?? b.id ?? '')));
}

/** Normalised identifier for matching (invoice numbers, auth numbers): letters and digits, upper case, leading zeros dropped. */
export const idKey = (v) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '');

/** Yes/no in everyday words. */
export const yes = (v) => /^(y|yes|true|1|x|✓|done|complete|completed)$/i.test(str(v));

/** A list from a cell: "a; b, c" -> ['a','b','c']. */
export const listOf = (v) => (Array.isArray(v) ? v : str(v).split(/[;,|]+/)).map((x) => str(x)).filter(Boolean);

/**
 * Group day-level findings into runs of consecutive days with the same key.
 * days: [{ date, ...}] ; key(d) -> string. Returns [{ key, first, from, to (inclusive), days, items }].
 */
export function dayRuns(days, key) {
  const sorted = days.slice().sort((a, b) => key(a).localeCompare(key(b)) || a.date.localeCompare(b.date));
  const runs = [];
  for (const d of sorted) {
    const k = key(d); const last = runs.at(-1);
    if (last && last.key === k && addDays(last.to, 1) === d.date) { last.to = d.date; last.days++; last.items.push(d); }
    else if (last && last.key === k && last.to === d.date) { last.items.push(d); }
    else runs.push({ key: k, first: d, from: d.date, to: d.date, days: 1, items: [d] });
  }
  return runs;
}

/** Inclusive date list from..to (both included). */
export function dateRange(from, to, max = 3700) {
  const a = isoDate(from), b = isoDate(to) || a; const out = [];
  for (let d = a; d && d <= b && out.length < max; d = addDays(d, 1)) out.push(d);
  return out;
}

// ------------------------------------------------------------------ dates ----

/** Nth weekday (0=Sun) of a month, or the last one when n = -1. */
function nthWeekday(y, m, wd, n) {
  if (n > 0) { const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); return 1 + ((wd - first + 7) % 7) + (n - 1) * 7; }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lastWd = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return lastDay - ((lastWd - wd + 7) % 7);
}
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** A fixed-date holiday moves to Friday when it falls on Saturday and to Monday when on Sunday (federal rule). */
function observed(iso) { const wd = new Date(`${iso}T00:00:00Z`).getUTCDay(); return wd === 6 ? addDays(iso, -1) : wd === 0 ? addDays(iso, 1) : iso; }
/** The eleven US federal holidays (observed dates) for a year. */
export function federalHolidays(y) {
  return [
    observed(ymd(y, 1, 1)), ymd(y, 1, nthWeekday(y, 1, 1, 3)), ymd(y, 2, nthWeekday(y, 2, 1, 3)), ymd(y, 5, nthWeekday(y, 5, 1, -1)),
    observed(ymd(y, 6, 19)), observed(ymd(y, 7, 4)), ymd(y, 9, nthWeekday(y, 9, 1, 1)), ymd(y, 10, nthWeekday(y, 10, 1, 2)),
    observed(ymd(y, 11, 11)), ymd(y, 11, nthWeekday(y, 11, 4, 4)), observed(ymd(y, 12, 25)),
  ];
}
const holidaySet = (extra = []) => { const s = new Set(extra.map(isoDate).filter(Boolean)); return { has: (d) => s.has(d) || federalHolidays(Number(d.slice(0, 4))).includes(d) }; };
export const isWeekend = (d) => { const wd = new Date(`${isoDate(d)}T00:00:00Z`).getUTCDay(); return wd === 0 || wd === 6; };
/** True when d is a business day (not a weekend, not a federal holiday, not in extraHolidays). */
export function isBusinessDay(d, extraHolidays = []) { const x = isoDate(d); return !!x && !isWeekend(x) && !holidaySet(extraHolidays).has(x); }
/** The date n business days after d (n >= 0). Day 0 is d itself. */
export function addBusinessDays(d, n, extraHolidays = []) {
  let x = isoDate(d); if (!x) return null; const h = holidaySet(extraHolidays); let left = n;
  while (left > 0) { x = addDays(x, 1); if (!isWeekend(x) && !h.has(x)) left--; }
  return x;
}
/** Business days after a up to and including b (0 when b <= a). */
export function businessDaysBetween(a, b, extraHolidays = []) {
  let x = isoDate(a); const y = isoDate(b); if (!x || !y) return null; if (y <= x) return 0; const h = holidaySet(extraHolidays); let n = 0;
  while (x < y) { x = addDays(x, 1); if (!isWeekend(x) && !h.has(x)) n++; if (n > 20000) break; }
  return n;
}
/** Monday of the ISO week a date falls in. */
export function weekOf(d) { const x = isoDate(d); if (!x) return null; const wd = new Date(`${x}T00:00:00Z`).getUTCDay(); return addDays(x, -((wd + 6) % 7)); }
/** Due status of a date against as-of: overdue, due_soon (within `soon` days) or ok. */
export function dueStatus(due, asOf, soon = 30) { const d = daysBetween(asOf, due); if (d === null) return 'unknown'; if (d < 0) return 'overdue'; if (d <= soon) return 'due_soon'; return 'ok'; }

// ---------------------------------------------------------------- minutes ----

/** Clock time to minutes after midnight: "13:05", "1:05 PM", "0905", "9am". Null when unreadable. */
export function clockMinutes(v) {
  const s = str(v).toLowerCase().replace(/\s+/g, '');
  let m = /^(\d{1,2}):?(\d{2})(?::\d{2})?(am|pm|a|p)?$/.exec(s) || /^(\d{1,2})()(am|pm|a|p)$/.exec(s);
  if (!m) { const t = /T(\d{2}):(\d{2})/.exec(str(v)); if (t) m = [null, t[1], t[2], '']; }
  if (!m) return null;
  let h = Number(m[1]); const mi = Number(m[2] || 0); const ap = m[3] || '';
  if (mi > 59 || h > 24) return null;
  if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0;
  if (ap && Number(m[1]) > 12) return null;
  return h * 60 + mi;
}
/** Minutes between a start and stop clock time (stop past midnight wraps once). */
export function spanMinutes(start, stop) { const a = clockMinutes(start), b = clockMinutes(stop); if (a === null || b === null) return null; return b >= a ? b - a : b + 1440 - a; }
/** A duration in minutes from "45", "45 min", "0:45", "1h 5m", "1.5 h". */
export function durationMinutes(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  const s = str(v).toLowerCase(); if (!s) return null;
  let m = /^(\d+):(\d{2})$/.exec(s); if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?$/.exec(s);
  if (m && (m[1] || m[2])) return round2(Number(m[1] || 0) * 60 + Number(m[2] || 0));
  const n = num(s); return n !== null && n >= 0 ? n : null;
}

// ------------------------------------------------------------------ names ----

/** A person's name for matching: lower case, accents and punctuation off, suffixes off, "Last, First" turned around, words sorted. */
export function personKey(v) {
  let s = str(v); const c = /^([^,]+),\s*(.+)$/.exec(s); if (c) s = `${c[2]} ${c[1]}`;
  return normalizeName(s, { stripEntity: false }).split(/\s+/).filter((w) => w.length > 1 && !/^(dr|mr|mrs|ms|miss|prof|jr|sr|ii|iii|iv|md|do|rn|lpn|lvn|np|pa|phd|dds|dmd|dc|dpm|od|pt|ot|lcsw|lpc)$/.test(w)).sort().join(' ');
}
/** Similarity 0..1 of two person names (word order and case ignored). */
export function personSimilarity(a, b) { const x = personKey(a), y = personKey(b); if (!x || !y) return 0; if (x === y) return 1; return round2(jaroWinkler(x, y)); }
/**
 * The words of a name key, each word of three letters or more with one letter left out, and the first four
 * letters of longer words. Two names with a word one typo apart (a letter changed, added, dropped or two
 * swapped), or with a word starting the same way (Michael / Michelle), share one of these.
 */
export function wordVariants(key) {
  const out = new Set();
  for (const w of String(key ?? '').split(' ')) { if (!w) continue; out.add(w); if (w.length >= 3) for (let i = 0; i < w.length; i++) out.add(w.slice(0, i) + w.slice(i + 1)); if (w.length >= 5) out.add('^' + w.slice(0, 4)); }
  return out;
}
/**
 * Index of name keys for near-name search. The returned function gives the indexed keys that share a word
 * variant with a key (and are within maxLenDiff letters of its length), in the order they were indexed.
 * Comparing every name with every other took minutes at 10,000 names; this compares only likely ones.
 * Missed by design: names where every word is two or more typos away from the other name's words.
 */
export function nearNameIndex(keys, { maxLenDiff = Infinity } = {}) {
  const at = new Map(); const by = new Map();
  for (const k of keys) { if (!k || at.has(k)) continue; at.set(k, at.size); for (const v of wordVariants(k)) { let b = by.get(v); if (!b) by.set(v, (b = [])); b.push(k); } }
  return (key) => { const c = new Set(); for (const v of wordVariants(key)) for (const k of by.get(v) || []) if (Math.abs(k.length - key.length) <= maxLenDiff) c.add(k); return [...c].sort((a, b) => at.get(a) - at.get(b)); };
}
/** Code normalised for comparing: upper case, no spaces or dots. */
export const codeKey = (v) => str(v).toUpperCase().replace(/[\s.]/g, '');
export { payerKey };
