// Fairpractice Staff Health logic: employee health requirements (HR records) against dates. No I/O.
import { str, isoDate, addDays, daysBetween, sortByStatus, countBy } from 'fairpractice-core';
import { credKey } from './keys.js';

const ORDER = { new_hire_late: 0, never_done: 1, overdue: 2, declined_no_form: 3, needs_followup: 4, due_soon: 5 };

/** When the requirement is next due, given the last date done. Yearly items: last + every_days. Seasonal items: the season's due date unless done since the season start. */
export function nextDue(req, last, asOf) {
  if (req.season_start && req.due_by) {
    const y = Number(asOf.slice(0, 4)); let start = `${y}-${req.season_start}`; if (start > asOf) start = `${y - 1}-${req.season_start}`;
    let due = `${Number(start.slice(0, 4)) + (req.due_by < req.season_start ? 1 : 0)}-${req.due_by}`;
    if (last && last >= start) return { due: null, season_start: start };
    return { due, season_start: start };
  }
  return { due: last ? addDays(last, req.every_days || 365) : null };
}

/**
 * records: [{ person_id, name, department, role, item, done_on, result, declined, form_on_file, followup_on }]
 * roster: [{ person_id, name, department, role, hire_date, status }]
 * requirements: [{ item, every_days?, season_start?: 'MM-DD', due_by?: 'MM-DD', roles?: [], new_hire_days?, declination_allowed? }]
 */
export function checkStaffHealth(records, roster, requirements, { asOf, warnDays = 30 } = {}) {
  const people = new Map();
  for (const r of roster) { const id = str(r.person_id); if (!id || /term|inactive|separated|left/i.test(str(r.status))) continue; people.set(id, { id, name: str(r.name) || null, department: str(r.department) || null, role: str(r.role) || null, hire: isoDate(r.hire_date) }); }
  if (!roster.length) for (const r of records) { const id = str(r.person_id); if (id && !people.has(id)) people.set(id, { id, name: str(r.name) || null, department: str(r.department) || null, role: str(r.role) || null, hire: null }); }
  const recs = new Map();
  for (const r of records) { const k = `${str(r.person_id)}|${credKey(r.item)}`; if (!recs.has(k)) recs.set(k, []); recs.get(k).push(r); }
  const items = [];
  for (const p of people.values()) for (const req of requirements) {
    if (req.roles && req.roles.length && !req.roles.some((x) => credKey(x) === credKey(p.role))) continue;
    const rows = (recs.get(`${p.id}|${credKey(req.item)}`) || []).filter((r) => isoDate(r.done_on) && isoDate(r.done_on) <= asOf).sort((a, b) => isoDate(a.done_on).localeCompare(isoDate(b.done_on)));
    const last = rows.at(-1);
    const base = { person_id: p.id, name: p.name, department: p.department, role: p.role, item: req.item, last_done: last ? isoDate(last.done_on) : null };
    if (last && /^(y|yes|true|declined|declination)$/i.test(str(last.declined)) ) {
      if (!req.declination_allowed) { items.push({ ...base, status: 'overdue', due: null, days: null, note: 'declined, but your settings do not allow a declination for this item' }); continue; }
      else if (!/^(y|yes|true|on file|signed)$/i.test(str(last.form_on_file))) items.push({ ...base, status: 'declined_no_form', due: null, days: null });
    }
    if (last && /positive|reactive|fail/i.test(str(last.result)) && !isoDate(last.followup_on)) items.push({ ...base, status: 'needs_followup', due: null, days: null });
    if (!last) {
      if (p.hire && req.new_hire_days !== undefined && daysBetween(p.hire, asOf) <= 365) {
        const due = addDays(p.hire, req.new_hire_days);
        if (due < asOf) items.push({ ...base, status: 'new_hire_late', due, days: daysBetween(due, asOf) });
        else if (daysBetween(asOf, due) <= warnDays) items.push({ ...base, status: 'due_soon', due, days: daysBetween(asOf, due) });
      } else items.push({ ...base, status: 'never_done', due: null, days: null });
      continue;
    }
    const nd = nextDue(req, base.last_done, asOf);
    if (!nd.due) continue;
    const left = daysBetween(asOf, nd.due);
    if (left < 0) items.push({ ...base, status: 'overdue', due: nd.due, days: -left });
    else if (left <= warnDays) items.push({ ...base, status: 'due_soon', due: nd.due, days: left });
  }
  const T = {
    new_hire_late: (x) => [`${x.name} was hired without a ${x.item} on file; it was due by ${x.due}.`, 'Get it done or documented before their next shift, as your policy says.'],
    never_done: (x) => [`${x.name} has no ${x.item} on file.`, 'Collect the record or schedule it with employee health.'],
    overdue: (x) => [x.days !== null ? `${x.name}'s ${x.item} was due ${x.due} (${x.days} days ago).` : `${x.name}'s ${x.item}: ${x.note}.`, 'Schedule it with employee health, or record why it is not needed.'],
    declined_no_form: (x) => [`${x.name} declined the ${x.item}, but no signed declination form is on file.`, 'Get the signed form for the file.'],
    needs_followup: (x) => [`${x.name}'s ${x.item} has a result marked for follow-up and no follow-up date.`, 'Send to employee health for follow-up and record the date (the result itself stays with employee health).'],
    due_soon: (x) => [`${x.name}'s ${x.item} is due ${x.due} (in ${x.days} days).`, 'Remind them and book it.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'days');
  const due = items.filter((i) => i.status !== 'due_soon');
  return { staff: people.size, requirements: requirements.length, out_of_compliance: new Set(due.map((i) => i.person_id)).size, by_status: countBy(items, 'status'), by_department: countBy(due, (i) => i.department || 'unknown'), items };
}
