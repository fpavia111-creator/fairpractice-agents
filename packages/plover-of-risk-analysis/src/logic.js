// Plover logic: the security risk analysis, the risk register and the asset list. No I/O.
import { str, num, isoDate, addDays, daysBetween, yes, normalizeName, sortByStatus, countBy } from 'kestrel-core';

const ORDER = { sra_overdue: 0, high_no_owner: 1, high_no_plan: 2, past_due: 3, asset_not_assessed: 4, evidence_missing: 5, accepted_no_signoff: 6, due_soon: 7 };
const LEVEL = { low: 1, l: 1, medium: 2, moderate: 2, med: 2, m: 2, high: 3, h: 3, critical: 4, crit: 4, very_high: 4 };

/** Risk level 1-4 from a rating word or from likelihood x impact (each 1-5, or words). */
export function riskLevel(r, { highScore = 12 } = {}) {
  const w = str(r.rating).toLowerCase().replace(/\s+/g, '_'); if (LEVEL[w]) return LEVEL[w];
  const sc = (v) => { const n = num(v); if (n !== null) return n; const x = LEVEL[str(v).toLowerCase()]; return x ? x + (x >= 3 ? 1 : 0) : null; };
  const l = sc(r.likelihood), i = sc(r.impact); if (l === null || i === null) return null;
  const s = l * i; return s >= highScore + 8 ? 4 : s >= highScore ? 3 : s >= Math.ceil(highScore / 2) ? 2 : 1;
}
const closed = (s) => /closed|done|resolved|mitigated|complete/i.test(str(s));
const accepted = (s) => /accept/i.test(str(s));

/**
 * risks: [{ risk_id, asset, threat, likelihood, impact, rating, owner, plan, due, status, accepted_by }]
 * assets: [{ asset, holds_phi }] (optional); evidence: [{ item, done_on, required }] (optional)
 * opts: { asOf, lastAnalysis, intervalDays = 365, warnDays = 30, highScore = 12 }
 */
export function checkRisks(risks, assets = [], evidence = [], { asOf, lastAnalysis = null, intervalDays = 365, warnDays = 30, highScore = 12 } = {}) {
  const items = [];
  const add = (status, x) => items.push({ status, risk_id: null, asset: null, level: null, owner: null, due: null, days: null, ...x });
  if (lastAnalysis === null || daysBetween(lastAnalysis, asOf) > intervalDays) add('sra_overdue', { due: lastAnalysis ? addDays(lastAnalysis, intervalDays) : null, days: lastAnalysis ? daysBetween(lastAnalysis, asOf) - intervalDays : null, last_analysis: lastAnalysis });
  const covered = new Set(); let open = 0, high = 0;
  for (const [i, r] of risks.entries()) {
    const asset = str(r.asset); if (asset) covered.add(normalizeName(asset, { stripEntity: false }));
    const lvl = riskLevel(r, { highScore }); const due = isoDate(r.due);
    const base = { risk_id: str(r.risk_id) || `line ${i + 1}`, asset: asset || null, threat: str(r.threat) || null, level: lvl, owner: str(r.owner) || null, due, line: i + 1 };
    if (closed(r.status)) continue;
    if (accepted(r.status)) { if (!str(r.accepted_by)) add('accepted_no_signoff', base); continue; }
    open++; if (lvl >= 3) high++;
    if (lvl >= 3 && !base.owner) add('high_no_owner', base);
    if (lvl >= 3 && !str(r.plan)) add('high_no_plan', base);
    if (due && due < asOf) add('past_due', { ...base, days: daysBetween(due, asOf) });
    else if (due && daysBetween(asOf, due) <= warnDays) add('due_soon', { ...base, days: daysBetween(asOf, due) });
  }
  for (const a of assets) {
    const name = str(a.asset); if (!name || !yes(a.holds_phi)) continue;
    if (!covered.has(normalizeName(name, { stripEntity: false }))) add('asset_not_assessed', { asset: name });
  }
  for (const e of evidence) {
    if (str(e.required) && !yes(e.required)) continue;
    const d = isoDate(e.done_on);
    if (!d || daysBetween(d, asOf) > intervalDays) add('evidence_missing', { asset: str(e.item) || null, evidence: str(e.item), last_done: d, days: d ? daysBetween(d, asOf) : null });
  }
  const T = {
    sra_overdue: (x) => [x.last_analysis ? `The last full security risk analysis was ${x.last_analysis}, more than ${intervalDays} days ago.` : 'No date is recorded for the last full security risk analysis.', 'Schedule the yearly risk analysis; OCR asks for it first in almost every investigation.'],
    high_no_owner: (x) => [`High risk ${x.risk_id} (${x.asset || 'no asset'}${x.threat ? `: ${x.threat}` : ''}) has no owner.`, 'Name one person who owns the fix.'],
    high_no_plan: (x) => [`High risk ${x.risk_id} (${x.asset || 'no asset'}) has no treatment plan.`, 'Write what will be done and by when, or record a signed acceptance.'],
    past_due: (x) => [`Risk ${x.risk_id} (${x.asset || 'no asset'}) was due ${x.due} and is still open (${x.days} days).`, 'Finish it or set a new date with the reason.'],
    asset_not_assessed: (x) => [`${x.asset} holds patient data but is not in the risk register.`, 'Add it to the risk analysis with its threats and controls.'],
    evidence_missing: (x) => [x.last_done ? `Evidence "${x.evidence}" was last done ${x.last_done} (${x.days} days ago).` : `Evidence "${x.evidence}" is missing.`, 'Collect it for the risk analysis binder.'],
    accepted_no_signoff: (x) => [`Risk ${x.risk_id} is marked accepted, but nobody signed off.`, 'Record who accepted it and when (usually the security officer or leadership).'],
    due_soon: (x) => [`Risk ${x.risk_id} (${x.asset || 'no asset'}) is due ${x.due} (in ${x.days} days).`, 'Check progress with the owner.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER, 'level');
  return { risks: risks.length, open_risks: open, high_open: high, assets_with_phi: assets.filter((a) => yes(a.holds_phi)).length, last_analysis: lastAnalysis, by_status: countBy(items, 'status'), items };
}
