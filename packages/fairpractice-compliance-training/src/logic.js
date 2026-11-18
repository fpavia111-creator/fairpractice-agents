// Fairpractice Compliance Training logic: required compliance courses per role and state against completions. No I/O.
import { str, isoDate, addDays, daysBetween, sortByStatus, countBy } from 'fairpractice-core';

const ORDER = { new_hire_overdue: 0, never_completed: 1, refresher_overdue: 2, due_soon: 3 };
export const courseKey = (v) => str(v).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]/g, '');

/** Does a course apply to a person (roles and states empty: everyone)? */
export function applies(course, p) {
  if (course.roles && course.roles.length && !course.roles.some((r) => courseKey(r) === courseKey(p.role))) return false;
  if (course.states && course.states.length && !course.states.some((s) => str(s).toUpperCase() === str(p.work_state).toUpperCase())) return false;
  return true;
}

/**
 * completions: [{ person_id, course, completed }]; roster: [{ person_id, name, role, department, hire_date, work_state, status }]
 * courses: [{ course, aliases?, roles?, states?, every_days?, new_hire_days? }]
 */
export function checkTraining(completions, roster, courses, { asOf, warnDays = 30 } = {}) {
  const done = new Map();
  for (const c of completions) { const d = isoDate(c.completed); if (!d || d > asOf) continue; const k = `${str(c.person_id)}|${courseKey(c.course)}`; if (!done.has(k) || d > done.get(k)) done.set(k, d); }
  const items = []; let staff = 0; let required = 0;
  for (const r of roster) {
    const p = { person_id: str(r.person_id), name: str(r.name) || null, role: str(r.role) || null, department: str(r.department) || null, hire: isoDate(r.hire_date), work_state: str(r.work_state).toUpperCase() || null };
    if (!p.person_id || /term|inactive|separated|left/i.test(str(r.status))) continue; staff++;
    for (const c of courses) {
      if (!applies(c, p)) continue; required++;
      const keys = [c.course, ...(c.aliases || [])].map(courseKey);
      const last = keys.map((k) => done.get(`${p.person_id}|${k}`)).filter(Boolean).sort().at(-1) || null;
      const base = { ...p, course: c.course, last_completed: last };
      if (!last) {
        const newHire = p.hire && c.new_hire_days !== undefined && daysBetween(p.hire, asOf) <= Math.max(365, (c.new_hire_days || 0) + 30);
        if (newHire) {
          const due = addDays(p.hire, c.new_hire_days);
          if (due < asOf) items.push({ ...base, status: 'new_hire_overdue', due, days: daysBetween(due, asOf) });
          else if (daysBetween(asOf, due) <= warnDays) items.push({ ...base, status: 'due_soon', due, days: daysBetween(asOf, due) });
        } else items.push({ ...base, status: 'never_completed', due: null, days: null });
        continue;
      }
      if (!c.every_days) continue;
      const due = addDays(last, c.every_days); const left = daysBetween(asOf, due);
      if (left < 0) items.push({ ...base, status: 'refresher_overdue', due, days: -left });
      else if (left <= warnDays) items.push({ ...base, status: 'due_soon', due, days: left });
    }
  }
  const T = {
    new_hire_overdue: (x) => [`${x.name} (hired ${x.hire}) has not finished ${x.course}; it was due ${x.due}.`, 'Assign it today and follow up with their manager.'],
    never_completed: (x) => [`${x.name} has no record of ${x.course}.`, 'Assign it, or add the completion if it was done elsewhere.'],
    refresher_overdue: (x) => [`${x.name}'s ${x.course} was last done ${x.last_completed}; the refresher was due ${x.due}.`, 'Assign the refresher.'],
    due_soon: (x) => [`${x.name}'s ${x.course} is due ${x.due} (in ${x.days} days).`, 'Send a reminder.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'days');
  const late = items.filter((i) => i.status !== 'due_soon');
  return { staff, assignments: required, completion_rate: required ? Math.round(((required - late.length) / required) * 1000) / 10 : null, by_status: countBy(items, 'status'), by_course: countBy(late, 'course'), by_department: countBy(late, (i) => i.department || 'unknown'), items };
}
