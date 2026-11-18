// Thrush logic: caregiver hours across clients, overtime, travel between clients, split shifts, meal breaks and live-in shifts. No I/O.
import { str, num, isoDate, addDays, round2, sortByStatus, countBy, spanMinutes, clockMinutes, yes, personKey, idKey } from 'kestrel-core';

const ORDER = { hours_underpaid: 0, meal_break_missed: 1, live_in_sleep: 2, split_shift: 3, travel_time: 4, overtime: 5 };
const weekStart = (d, start = 'monday') => { const wd = new Date(`${d}T00:00:00Z`).getUTCDay(); const off = start === 'sunday' ? wd : (wd + 6) % 7; return addDays(d, -off); };
const h = (m) => round2(m / 60);

/**
 * shifts: [{ caregiver_id, caregiver_name, client_id, date, clock_in, clock_out, minutes, meal_minutes, live_in, sleep_minutes, sleep_interrupted, pay_rate }]
 * payroll: [{ caregiver_id, caregiver_name, week_start, regular_hours, overtime_hours }]
 * opts: { otHours = 40, weekStartDay = 'monday', maxTravel = 60, splitGap = 60, splitPremium = null, mealAfterHours = null, mealMinutes = 30, sleepCap = 480, otMultiplier = 1.5 }
 */
export function checkCaregiverHours(shifts, payroll = [], { otHours = 40, weekStartDay = 'monday', maxTravel = 60, splitGap = 60, splitPremium = null, mealAfterHours = null, mealMinutes = 30, sleepCap = 480, otMultiplier = 1.5 } = {}) {
  const items = []; const names = new Map();
  const key = (r) => idKey(r.caregiver_id) || personKey(r.caregiver_name);
  const S = shifts.map((s, i) => { const k = key(s); if (k && s.caregiver_name) names.set(k, str(s.caregiver_name)); const date = isoDate(s.date); return { i, k, raw: str(s.caregiver_id) || str(s.caregiver_name), date, client: str(s.client_id), start: clockMinutes(s.clock_in), end: clockMinutes(s.clock_out), minutes: num(s.minutes) ?? spanMinutes(s.clock_in, s.clock_out), meal: num(s.meal_minutes) ?? 0, liveIn: yes(s.live_in), sleep: num(s.sleep_minutes) ?? 0, interrupted: yes(s.sleep_interrupted), rate: num(s.pay_rate) }; }).filter((s) => s.k && s.date && s.minutes !== null);
  const b = (k, raw) => ({ caregiver_id: raw, caregiver_name: names.get(k) || null });
  const weeks = new Map(); const wk = (s) => { const w = weekStart(s.date, weekStartDay); const kk = `${s.k}|${w}`; if (!weeks.has(kk)) weeks.set(kk, { k: s.k, raw: s.raw, week: w, worked: 0, travel: 0, pay: 0, payMin: 0 }); return weeks.get(kk); };
  for (const s of S) {
    let worked = s.minutes - s.meal;
    if (s.liveIn) {
      const excluded = s.interrupted ? 0 : Math.min(s.sleep, sleepCap); worked = s.minutes - s.meal - excluded;
      if (s.interrupted || s.sleep > sleepCap) items.push({ ...b(s.k, s.raw), date: s.date, status: 'live_in_sleep', sleep_minutes: s.sleep, counted_back: h(s.sleep - excluded), interrupted: s.interrupted, amount: 0 });
    }
    if (mealAfterHours !== null && !s.liveIn && s.minutes > mealAfterHours * 60 && s.meal < mealMinutes) items.push({ ...b(s.k, s.raw), date: s.date, status: 'meal_break_missed', shift_hours: h(s.minutes), meal_minutes: s.meal, amount: s.rate ? round2(s.rate) : 0 });
    const w = wk(s); w.worked += worked; if (s.rate) { w.pay += s.rate * worked; w.payMin += worked; }
  }
  // Same-day gaps between clients: short gaps are travel time worked; long gaps are split shifts.
  const days = new Map(); for (const s of S) { if (s.liveIn || s.start === null || s.end === null) continue; const kk = `${s.k}|${s.date}`; if (!days.has(kk)) days.set(kk, []); days.get(kk).push(s); }
  for (const list of days.values()) {
    list.sort((a, c) => a.start - c.start);
    for (let j = 1; j < list.length; j++) {
      const a = list[j - 1], c = list[j]; const gap = c.start - a.end; if (gap <= 0) continue;
      if (a.client !== c.client && gap <= maxTravel) wk(c).travel += gap;
      else if (gap > splitGap && splitPremium !== null) items.push({ ...b(c.k, c.raw), date: c.date, status: 'split_shift', gap_hours: h(gap), amount: splitPremium });
    }
  }
  const paid = new Map(payroll.map((p) => [`${key(p)}|${weekStart(isoDate(p.week_start) || '', weekStartDay)}`, { reg: num(p.regular_hours) || 0, ot: num(p.overtime_hours) || 0 }]).filter(([kk]) => !kk.endsWith('|null')));
  for (const w of weeks.values()) {
    const total = w.worked + w.travel; const ot = Math.max(0, total - otHours * 60); const rate = w.payMin ? w.pay / w.payMin : 0;
    const base = { ...b(w.k, w.raw), date: w.week, week_of: w.week, hours: h(total), travel_hours: h(w.travel) };
    if (w.travel) items.push({ ...base, status: 'travel_time', amount: 0 });
    const p = paid.get(`${w.k}|${w.week}`);
    if (p) {
      const owed = (Math.min(total, otHours * 60) / 60) * rate + (ot / 60) * rate * otMultiplier; const got = p.reg * rate + p.ot * rate * otMultiplier;
      if (owed - got > 0.5) items.push({ ...base, status: 'hours_underpaid', overtime_hours: h(ot), paid_regular: p.reg, paid_overtime: p.ot, rate: round2(rate), amount: round2(owed - got) });
    } else if (ot > 0) items.push({ ...base, status: 'overtime', overtime_hours: h(ot), amount: 0 });
  }
  const T = {
    hours_underpaid: (x) => [`Week of ${x.week_of}: ${x.hours} hours worked, including ${x.travel_hours} of travel between clients (${x.overtime_hours} overtime); payroll paid ${x.paid_regular} regular and ${x.paid_overtime} overtime.`, 'Correct the pay for the week; travel between clients and live-in sleep over the cap count as hours worked.'],
    meal_break_missed: (x) => [`${x.date}: a ${x.shift_hours}-hour shift with ${x.meal_minutes} minutes of meal break recorded.`, 'Pay the premium your state requires, and schedule the break.'],
    live_in_sleep: (x) => [x.interrupted ? `${x.date}: live-in sleep time was interrupted, so ${x.counted_back} hours of sleep count as worked.` : `${x.date}: ${x.sleep_minutes} minutes of sleep recorded; only up to the cap may be left unpaid, so ${x.counted_back} hours count as worked.`, 'Pay the counted hours, and keep the live-in agreement and sleep records on file.'],
    split_shift: (x) => [`${x.date}: shifts split by an unpaid gap of ${x.gap_hours} hours.`, 'Pay the split-shift premium your state requires.'],
    travel_time: (x) => [`Week of ${x.week_of}: ${x.travel_hours} hours of travel between clients counted as hours worked.`, 'Make sure payroll includes this time.'],
    overtime: (x) => [`Week of ${x.week_of}: ${x.hours} hours worked across clients, ${x.overtime_hours} of them overtime.`, 'Pay overtime for the week (and check scheduling across clients).'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { shifts: shifts.length, caregivers: new Set(S.map((s) => s.k)).size, weeks: weeks.size, overtime_hours: round2([...weeks.values()].reduce((s, w) => s + Math.max(0, w.worked + w.travel - otHours * 60), 0) / 60), dollars_at_risk: round2(items.reduce((s, x) => s + (x.amount || 0), 0)), by_status: countBy(items, 'status'), items };
}
