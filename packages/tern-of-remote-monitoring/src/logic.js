// Tern logic: remote patient monitoring device days, management minutes, interactive contact, setup and overlaps. No I/O.
import { str, num, isoDate, addDays, round2, sortByStatus, countBy, codeKey, monthOf, yes } from 'kestrel-core';

const ORDER = { setup_repeat: 0, period_overlap: 1, days_short: 2, overlap_rtm: 3, no_interactive: 4, minutes_short: 5 };
/** Device supply codes and the reading days they need in a 30-day period. */
export const DEVICE_CODES = Object.freeze({ 99454: { min: 16, max: 30 }, 99445: { min: 2, max: 15 } });
/** Management codes per calendar month: minutes for the base, add-on step. */
export const MGMT = Object.freeze({ 99457: { base: 20 }, 99470: { base: 10 }, 99458: { addon: '99457', step: 20 } });
export const isRtm = (c) => /^9897[5-9]$|^9898[01]$/.test(c);
export const deviceCodeFor = (days) => (days >= 16 ? '99454' : days >= 2 ? '99445' : null);

/**
 * readings: [{ patient_id, date }]; time: [{ patient_id, date, minutes, interactive }]
 * claims: [{ patient_id, patient_name, date, cpt, units, period_start }]; patients: [{ patient_id, episode_start }]
 * opts: { rates = { cpt: rate } }
 */
export function checkRpm(readings, time, claims, patients = [], { rates = {} } = {}) {
  const items = []; const names = new Map(); const rate = (c) => num(rates[c]) || 0;
  for (const r of [...patients, ...claims, ...time, ...readings]) { const pid = str(r.patient_id); if (pid && r.patient_name) names.set(pid, str(r.patient_name)); }
  const days = new Map(); for (const r of readings) { const pid = str(r.patient_id) || str(r.patient_name); const d = isoDate(r.date); if (!pid || !d) continue; if (!days.has(pid)) days.set(pid, new Set()); days.get(pid).add(d); }
  const C = claims.map((c, i) => ({ i, pid: str(c.patient_id) || str(c.patient_name), date: isoDate(c.date), cpt: codeKey(c.cpt), units: num(c.units) ?? 1, start: isoDate(c.period_start) })).filter((c) => c.pid && c.date && c.cpt).sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i);
  const b = (c) => ({ patient_id: c.pid, patient_name: names.get(c.pid) || null, date: c.date, cpt: c.cpt, line: c.i + 1 });
  // Device supply: reading days in each 30-day period, and periods that overlap.
  const lastPeriod = new Map();
  for (const c of C.filter((x) => DEVICE_CODES[x.cpt])) {
    const from = c.start || addDays(c.date, -29); const to = c.start ? addDays(c.start, 29) : c.date;
    const n = [...(days.get(c.pid) || [])].filter((d) => d >= from && d <= to).length; const need = DEVICE_CODES[c.cpt];
    if (n < need.min) items.push({ ...b(c), status: 'days_short', period_from: from, period_to: to, reading_days: n, needed: need.min, supports: deviceCodeFor(n) || 'none', amount: round2(rate(c.cpt) - (deviceCodeFor(n) ? rate(deviceCodeFor(n)) : 0)) });
    const prev = lastPeriod.get(c.pid);
    if (prev && from <= prev.to) items.push({ ...b(c), status: 'period_overlap', period_from: from, period_to: to, other_from: prev.from, other_to: prev.to, amount: rate(c.cpt) });
    lastPeriod.set(c.pid, { from, to });
  }
  // Setup once per episode.
  const episodes = new Map(patients.map((p) => [str(p.patient_id) || str(p.patient_name), isoDate(p.episode_start)]));
  const setups = new Map();
  for (const c of C.filter((x) => x.cpt === '99453')) {
    const ep = episodes.get(c.pid) || ''; const k = `${c.pid}|${ep && ep <= c.date ? ep : ''}`; const first = setups.get(k);
    if (first) items.push({ ...b(c), status: 'setup_repeat', first_billed: first, episode_start: ep || null, amount: rate('99453') }); else setups.set(k, c.date);
  }
  // Management time per calendar month.
  const mm = new Map(); const g = (pid, m) => { const k = `${pid}|${m}`; if (!mm.has(k)) mm.set(k, { pid, month: m, minutes: 0, interactive: false, billed: {}, rtm: [], first: null }); return mm.get(k); };
  for (const t of time) { const pid = str(t.patient_id) || str(t.patient_name); const m = monthOf(t.date); if (!pid || !m) continue; const x = g(pid, m); x.minutes += num(t.minutes) || 0; if (yes(t.interactive)) x.interactive = true; }
  for (const c of C) { const m = monthOf(c.date); if (MGMT[c.cpt]) { const x = g(c.pid, m); x.billed[c.cpt] = (x.billed[c.cpt] || 0) + c.units; x.first = x.first || c; } else if (isRtm(c.cpt)) g(c.pid, m).rtm.push(c.cpt); }
  for (const x of mm.values()) {
    const codes = Object.keys(x.billed); if (!codes.length) continue;
    const bb = { ...b(x.first), date: `${x.month}-01`, month: x.month, minutes: x.minutes, cpt: codes.join(' ') };
    if (x.rtm.length) items.push({ ...bb, status: 'overlap_rtm', rtm: [...new Set(x.rtm)].join(' '), amount: round2(codes.reduce((s, c) => s + rate(c) * x.billed[c], 0)) });
    if (!x.interactive) items.push({ ...bb, status: 'no_interactive', amount: round2(codes.reduce((s, c) => s + rate(c) * x.billed[c], 0)) });
    const problems = []; let amt = 0;
    if (x.billed['99457'] && x.billed['99470']) { problems.push('99457 and 99470 billed in the same month'); amt += rate('99470'); }
    for (const c of ['99457', '99470']) if (x.billed[c] && x.minutes < MGMT[c].base) { problems.push(`${c} needs ${MGMT[c].base} minutes`); amt += rate(c); }
    if (x.billed['99458']) { const ok = x.billed['99457'] ? Math.max(0, Math.floor((x.minutes - 20) / 20)) : 0; if (x.billed['99458'] > ok) { problems.push(`${x.billed['99458']} unit(s) of 99458 billed, ${ok} supported`); amt += rate('99458') * (x.billed['99458'] - ok); } }
    if (problems.length) items.push({ ...bb, status: 'minutes_short', problems, amount: round2(amt) });
  }
  const T = {
    setup_repeat: (x) => [`99453 billed again on ${x.date}; setup was already billed ${x.first_billed}${x.episode_start ? ` in the episode from ${x.episode_start}` : ''}.`, 'Setup is billed once per episode of care; remove the repeat or record the new episode.'],
    period_overlap: (x) => [`${x.cpt} for ${x.period_from} to ${x.period_to} overlaps the period ${x.other_from} to ${x.other_to}.`, 'Bill device supply once per 30-day period; move the date of service to the end of a new period.'],
    days_short: (x) => [`${x.cpt} for ${x.period_from} to ${x.period_to} has ${x.reading_days} day(s) of readings; it needs ${x.needed}.`, x.supports === 'none' ? 'Do not bill device supply for this period.' : `Bill ${x.supports}, which fits the days recorded.`],
    overlap_rtm: (x) => [`${x.month}: remote patient monitoring (${x.cpt}) and remote therapeutic monitoring (${x.rtm}) billed in the same month.`, 'Keep the one that fits the patient\'s monitoring; payers do not pay both for the same period.'],
    no_interactive: (x) => [`${x.month}: ${x.cpt} billed with ${x.minutes} minutes but no interactive contact with the patient or caregiver logged.`, 'Record the real-time call or video visit, or do not bill management time for the month.'],
    minutes_short: (x) => [`${x.month}: ${x.problems.join('; ')} (${x.minutes} minutes logged).`, 'Bill the management codes the minutes support.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { claim_lines: claims.length, patients: new Set(C.map((c) => c.pid)).size, reading_days: [...days.values()].reduce((s, d) => s + d.size, 0), dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
