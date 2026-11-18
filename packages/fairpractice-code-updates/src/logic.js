// Fairpractice Code Updates logic: code-set update impact on your chargemaster, fee schedules, order sets and open claims. No I/O.
import { str, num, isoDate, sortByStatus, countBy, codeKey, listOf, yes } from 'fairpractice-core';

const ORDER = { deleted_on_open_claim: 0, deleted_in_chargemaster: 1, deleted_in_order_set: 2, deleted_in_fee_schedule: 3, new_code_no_fee: 4, revised_code: 5 };
const actionOf = (v) => { const s = str(v).toLowerCase(); if (/del|retir|term|invalid|discontinu/.test(s)) return 'deleted'; if (/add|new|creat/.test(s)) return 'added'; if (/rev|chang|modif|updat/.test(s)) return 'revised'; return null; };
const setOf = (v, code) => { const s = str(v).toUpperCase().replace(/[^A-Z0-9]/g, ''); if (/ICD/.test(s)) return 'ICD-10'; if (/HCPCS/.test(s)) return 'HCPCS'; if (/CPT/.test(s)) return 'CPT'; return /\./.test(str(code)) ? 'ICD-10' : 'CPT'; };
const inactive = (v) => /^(n|no|false|0|inactive|retired)$/i.test(str(v));

/**
 * changes: [{ code, code_set, action, effective, replacement, description }]
 * chargemaster: [{ code, description, price, active }]; feeSchedule: [{ payer, code, rate }]
 * orderSets: [{ order_set, code }]; openClaims: [{ claim_id, patient_id, patient_name, dos, codes, diagnoses }]
 */
export function checkCodeUpdates(changes, chargemaster, { feeSchedule = [], orderSets = [], openClaims = [] } = {}) {
  const items = [];
  const CH = changes.map((c) => ({ code: codeKey(c.code), raw: str(c.code), set: setOf(c.code_set, c.code), action: actionOf(c.action), eff: isoDate(c.effective), repl: listOf(c.replacement).map(codeKey), replRaw: listOf(c.replacement).join(', ') || null, desc: str(c.description) || null })).filter((c) => c.code && c.action);
  const del = new Map(CH.filter((c) => c.action === 'deleted').map((c) => [c.code, c]));
  const cdm = new Map(chargemaster.map((r) => [codeKey(r.code), { raw: str(r.code), price: num(r.price), active: !inactive(r.active) }]).filter(([k]) => k));
  const b = (c) => ({ code: c.raw, code_set: c.set, effective: c.eff, replacement: c.replRaw, date: c.eff });
  for (const [k, row] of cdm) { const c = del.get(k); if (c && row.active) items.push({ ...b(c), status: 'deleted_in_chargemaster', price: row.price, amount: 0 }); }
  const sets = new Map(); for (const o of orderSets) { const k = codeKey(o.code); if (!del.has(k)) continue; const key = `${str(o.order_set)}|${k}`; if (!sets.has(key)) sets.set(key, { ...b(del.get(k)), status: 'deleted_in_order_set', order_set: str(o.order_set) || null, amount: 0 }); }
  items.push(...sets.values());
  const fees = new Map(); for (const f of feeSchedule) { const k = codeKey(f.code); if (!del.has(k)) continue; const key = k; const x = fees.get(key) || { ...b(del.get(k)), status: 'deleted_in_fee_schedule', payers: [], amount: 0 }; if (str(f.payer) && !x.payers.includes(str(f.payer))) x.payers.push(str(f.payer)); fees.set(key, x); }
  items.push(...[...fees.values()].map((x) => ({ ...x, payers: x.payers.join(', ') || null })));
  for (const [i, cl] of openClaims.entries()) {
    const dos = isoDate(cl.dos); const codes = [...listOf(cl.codes), ...listOf(cl.diagnoses)];
    for (const raw of codes) { const c = del.get(codeKey(raw)); if (c && (!c.eff || !dos || dos >= c.eff)) items.push({ ...b(c), status: 'deleted_on_open_claim', claim_id: str(cl.claim_id) || `line ${i + 1}`, patient_id: str(cl.patient_id) || null, patient_name: str(cl.patient_name) || null, dos, date: dos, amount: 0 }); }
  }
  // New codes that need a price: replacements for deleted codes you use, and added codes already on the chargemaster with no price.
  const used = new Set([...cdm.entries()].filter(([, r]) => r.active).map(([k]) => k).concat(orderSets.map((o) => codeKey(o.code)), feeSchedule.map((f) => codeKey(f.code))));
  const needFee = new Map();
  for (const c of del.values()) if (used.has(c.code)) for (const r of c.repl) needFee.set(r, c.raw);
  for (const c of CH.filter((x) => x.action === 'added' && x.set !== 'ICD-10')) {
    const row = cdm.get(c.code); const replaces = needFee.get(c.code);
    if ((replaces && (!row || !row.price)) || (row && row.active && !row.price)) items.push({ ...b(c), status: 'new_code_no_fee', replaces: replaces || null, on_chargemaster: !!row, amount: 0 });
  }
  for (const c of CH.filter((x) => x.action === 'revised')) if (cdm.get(c.code)?.active) items.push({ ...b(c), status: 'revised_code', amount: 0 });
  const T = {
    deleted_on_open_claim: (x) => [`Open claim ${x.claim_id} (service ${x.dos}) uses ${x.code_set} ${x.code}, deleted from ${x.effective}.`, `Recode before sending${x.replacement ? `; the update names ${x.replacement}` : ''}. The choice of code is the coder's, from the record.`],
    deleted_in_chargemaster: (x) => [`${x.code_set} ${x.code} is active on the chargemaster and is deleted from ${x.effective}.`, `Inactivate it for services from ${x.effective}${x.replacement ? ` and set up ${x.replacement}` : ''}.`],
    deleted_in_order_set: (x) => [`Order set "${x.order_set}" uses ${x.code_set} ${x.code}, deleted from ${x.effective}.`, `Update the order set${x.replacement ? ` (the update names ${x.replacement})` : ''} before ${x.effective}.`],
    deleted_in_fee_schedule: (x) => [`${x.code} is on the fee schedule${x.payers ? ` (${x.payers})` : ''}; it is deleted from ${x.effective}.`, 'Load rates for the replacement codes and check the payer contract terms for new codes.'],
    new_code_no_fee: (x) => [`New ${x.code_set} code ${x.code} (from ${x.effective})${x.replaces ? ` replaces ${x.replaces}, which you use,` : ''} and has no price on the chargemaster.`, 'Set a charge and add it to the fee schedules before the effective date.'],
    revised_code: (x) => [`${x.code_set} ${x.code} is revised from ${x.effective} and is on your chargemaster.`, 'Review the new descriptor in the official release and update the chargemaster description.'],
  };
  for (const it of items) { const [m, f] = T[it.status](it); it.message = m; it.fix = f; }
  sortByStatus(items, ORDER);
  return { changes: CH.length, deleted: del.size, added: CH.filter((c) => c.action === 'added').length, revised: CH.filter((c) => c.action === 'revised').length, chargemaster_codes: cdm.size, by_status: countBy(items, 'status'), items };
}
