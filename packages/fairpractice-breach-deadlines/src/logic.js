// Fairpractice Breach Deadlines logic: privacy incidents against breach-notification clocks. No I/O.
import { str, num, isoDate, addDays, daysBetween, sortByStatus, countBy, listOf } from 'fairpractice-core';

const ORDER = { notice_past_due: 0, hhs_notice_missing: 1, media_notice_missing: 2, state_ag_notice_missing: 3, undetermined_past_deadline: 4, assessment_overdue: 5, notice_late: 6, notice_due_soon: 7, hhs_annual_due: 8 };

/** Breach determination in everyday words: breach, not_breach or pending. */
export function determination(v) {
  const s = str(v).toLowerCase();
  if (/not|no breach|low prob|exception|unsecured.*no|^no$/.test(s)) return 'not_breach';
  if (/breach|yes|reportable|notif/.test(s)) return 'breach';
  return 'pending';
}
/** The small-breach HHS log is due within 60 days after the end of the calendar year of discovery. */
export const annualDue = (discovered) => addDays(`${discovered.slice(0, 4)}-12-31`, 60);

/**
 * rows: [{ incident_id, discovered, affected, assessed_on, determination, individuals_notified_on, media_notified_on, hhs_notified_on, states, ag_notified_on }]
 * opts: { asOf, noticeDays = 60, assessDays = 10, largeThreshold = 500, warnDays = 14, stateRules = [{ state, ag_threshold, ag_days }] }
 */
export function checkIncidents(rows, { asOf, noticeDays = 60, assessDays = 10, largeThreshold = 500, warnDays = 14, stateRules = [] } = {}) {
  const items = []; let breaches = 0; let affectedTotal = 0;
  for (const [i, r] of rows.entries()) {
    const disc = isoDate(r.discovered); if (!disc) continue;
    const n = num(r.affected) ?? 0; const det = determination(r.determination);
    const base = { incident_id: str(r.incident_id) || `line ${i + 1}`, discovered: disc, affected: n, determination: det, line: i + 1 };
    const due = addDays(disc, noticeDays);
    const add = (status, extra = {}) => items.push({ ...base, status, due: extra.due ?? due, days: extra.days ?? null, ...extra });
    if (det === 'pending') {
      if (!isoDate(r.assessed_on) && daysBetween(disc, asOf) > assessDays) add('assessment_overdue', { due: addDays(disc, assessDays), days: daysBetween(addDays(disc, assessDays), asOf) });
      if (asOf > due) add('undetermined_past_deadline', { days: daysBetween(due, asOf) });
      continue;
    }
    if (det !== 'breach') continue;
    breaches++; affectedTotal += n;
    const ind = isoDate(r.individuals_notified_on);
    if (!ind) { if (asOf > due) add('notice_past_due', { days: daysBetween(due, asOf) }); else if (daysBetween(asOf, due) <= warnDays) add('notice_due_soon', { days: daysBetween(asOf, due) }); }
    else if (ind > due) add('notice_late', { days: daysBetween(due, ind) });
    if (n >= largeThreshold) {
      if (!isoDate(r.hhs_notified_on) && asOf > due) add('hhs_notice_missing', { days: daysBetween(due, asOf) });
      if (!isoDate(r.media_notified_on) && asOf > due) add('media_notice_missing', { days: daysBetween(due, asOf) });
    } else if (!isoDate(r.hhs_notified_on)) {
      const ad = annualDue(disc); const left = daysBetween(asOf, ad);
      add('hhs_annual_due', { due: ad, days: left });
    }
    for (const st of listOf(r.states).map((x) => x.toUpperCase())) {
      const rule = stateRules.find((x) => str(x.state).toUpperCase() === st); if (!rule) continue;
      const agDue = addDays(disc, rule.ag_days);
      if (n >= rule.ag_threshold && !isoDate(r.ag_notified_on) && asOf > agDue) add('state_ag_notice_missing', { due: agDue, days: daysBetween(agDue, asOf), state: st });
    }
  }
  const T = {
    notice_past_due: (x) => [`Incident ${x.incident_id} is a breach affecting ${x.affected} people; individual notices were due ${x.due} and have not gone out (${x.days} days late).`, 'Send the notices now and record the date; ask counsel about the delay.'],
    hhs_notice_missing: (x) => [`Incident ${x.incident_id} affects ${x.affected} people (500 or more); HHS was due to be told by ${x.due}.`, 'File the breach report on the HHS portal and record the date.'],
    media_notice_missing: (x) => [`Incident ${x.incident_id} affects ${x.affected} people; a media notice was due by ${x.due}.`, 'Check with counsel whether 500 or more live in one state or jurisdiction, and give the media notice if so.'],
    state_ag_notice_missing: (x) => [`Incident ${x.incident_id}: your ${x.state} rule needs an attorney general notice by ${x.due}; none is recorded.`, 'Confirm the state rule with counsel and file the notice.'],
    undetermined_past_deadline: (x) => [`Incident ${x.incident_id} found ${x.discovered} still has no breach decision, and the 60-day notice window closed ${x.due}.`, 'Finish the risk assessment and decide today; the clock started at discovery.'],
    assessment_overdue: (x) => [`Incident ${x.incident_id} found ${x.discovered} has no risk assessment; it was due by ${x.due} (${x.days} day(s) ago).`, 'Do the four-factor risk assessment and record the date and decision.'],
    notice_late: (x) => [`Incident ${x.incident_id}: individual notices went out ${x.days} day(s) after the ${x.due} deadline.`, 'Record the reason for the delay in the incident file.'],
    notice_due_soon: (x) => [`Incident ${x.incident_id}: individual notices are due ${x.due} (in ${x.days} days).`, 'Finish the letters and mailing list.'],
    hhs_annual_due: (x) => [`Incident ${x.incident_id} (${x.affected} people) goes on the yearly HHS report due ${x.due}.`, 'Add it to the small-breach log you file at year end.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'affected');
  return { incidents: rows.length, breaches, people_affected: affectedTotal, by_status: countBy(items, 'status'), items };
}
