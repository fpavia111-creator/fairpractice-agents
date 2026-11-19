#!/usr/bin/env node
// Every setting of every agent, and which defaults follow a dated rule: where it lives, its source,
// the date it was checked, and how a customer changes it. Writes docs/settings.md and docs/settings.json.
//   npm run settings-list
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(ROOT, 'packages');
const CHECKED = '18 Nov 2026 (build), re-read 19 Nov 2026 (final pass)';
// Defaults that follow a law, a regulation, a CMS or HHS rule, or an industry change. Summaries for orientation,
// not legal advice; the customer's compliance lead or counsel confirms each before relying on it.
const DATED = {
  'breach-deadlines.notice_days': ['60 days', 'HIPAA Breach Notification Rule: individuals without unreasonable delay and no later than 60 days after discovery (45 CFR 164.404(b))'],
  'breach-deadlines.large_threshold': ['500', 'Same rule: media and HHS notice within 60 days for breaches of 500 or more (45 CFR 164.406, 164.408); smaller breaches go on the yearly HHS log within 60 days after year end'],
  'breach-deadlines.state_rules': ['example: TX, 250 residents, 30 days', 'State attorney general rules (the example follows Texas Business and Commerce Code 521.053 as amended in 2023); each state differs and counsel confirms them'],
  'records-requests.response_days': ['30 days', 'HIPAA right of access: act within 30 days of the request (45 CFR 164.524(b)(2)); some states are shorter'],
  'records-requests.extension_days': ['30 days', 'Same rule: one 30-day extension with a written notice inside the first 30 days'],
  'records-requests.flat_fee': ['your setting (fixture: 6.50)', 'HHS guidance (2016) describes a flat fee of up to $6.50 for electronic copies as one option'],
  'surprise-billing-disputes.negotiation_days': ['30 business days', 'No Surprises Act open negotiation: start within 30 business days of the initial payment or denial, and it lasts 30 business days (45 CFR 149.510(b)(1))'],
  'surprise-billing-disputes.idr_days': ['4 business days', 'Same rule: federal IDR may start within 4 business days after open negotiation ends (45 CFR 149.510(b)(2))'],
  'surprise-billing-disputes.admin_fee': ['115', 'CMS administrative fee per party per dispute ($115 for disputes from 2025); CMS sets it by year'],
  'therapy-billing.kx_threshold': ['2410', 'CMS KX modifier threshold for outpatient therapy; 2,410 is the 2025 figure, CMS publishes a new one each year (check the current year; not re-checked in this pass)'],
  'therapy-billing.sign_days': ['30 days', 'Plan of care certification by the physician or NPP within 30 days of the initial evaluation (Medicare Benefit Policy Manual ch. 15, 220.1.3)'],
  'hospice-billing.cap_amount': ['none (your cap year; fixture example 35,361.44)', 'CMS hospice aggregate cap per beneficiary, published each year in the hospice wage index final rule'],
  'hospice-billing.noe_days': ['5 days', 'Notice of election within 5 calendar days after the election (42 CFR 418.24(b)(2))'],
  'hospice-billing.notr_days': ['5 days', 'Notice of termination or revocation within 5 calendar days (42 CFR 418.26(e))'],
  'hospice-billing.f2f_window': ['30 days', 'Face-to-face encounter no more than 30 days before the third and later benefit periods (42 CFR 418.22(a)(4))'],
  'home-health.noa_days': ['5 days', 'Notice of admission within 5 calendar days from the start of care, from 2022 (42 CFR 484.205(j))'],
  'home-health.lupa_default': ['2', 'Low-utilization thresholds of 2 to 6 visits by case-mix group under the home health PDGM; your periods carry their own threshold'],
  'caregiver-hours.ot_hours': ['40', 'FLSA overtime after 40 hours a week, home care workers covered since the 2015 Home Care Rule (29 CFR 552); states may add daily rules'],
  'caregiver-hours.max_travel_minutes': ['60', 'Travel between clients during the workday is hours worked (29 CFR 785.38); the 60-minute window is an example'],
  'caregiver-hours.sleep_cap_minutes': ['480', 'Up to 8 hours of sleep may be left unpaid on a 24-hour shift when the conditions are met (29 CFR 785.22)'],
  'exclusion-screening.screening_interval_days': ['31 days', 'Monthly checks of the OIG LEIE (OIG guidance) and the state Medicaid lists many states require'],
  'staff-licenses.compact_states': ['example list', 'Nurse Licensure Compact member states change; the example list must be checked against the current NCSBN list'],
  'primary-care-apcm.conflict_codes': ['CCM, PCM, TCM codes', 'Advanced primary care management (G0556 to G0558) from 2025, not billed in the same month as those services (CMS 2025 physician fee schedule final rule)'],
  'provider-pay.modifier_pct': ['50: 150, 51: 50, 62: 62.5, 80/82/AS: 16', 'Medicare payment adjustments for bilateral, multiple, co-surgeon and assistant-at-surgery modifiers (Medicare Claims Processing Manual ch. 12)'],
};

const out = []; const md = ['# Settings and dated rules (Fairpractice, wave 1)', '', `Written by \`npm run settings-list\` on ${new Date().toISOString().slice(0, 10)} from each agent's settings schema. Every number below is a named setting: a customer changes it in the settings JSON file the agent is given (\`settings\` argument; a misspelt key is refused, so a typo cannot silently fall back to a default). Nothing changes by itself when a rule changes.`, '',
  '**Who maintains them:** the customer confirms each dated default with their compliance lead or counsel at setup and keeps their own settings file. Mythos Machines changes a default only in a new release with a changelog line, and checking the dated defaults below against their sources is part of the support plan. No rule here is legal, billing or compliance advice.', '',
  '## Dated defaults', '', '| Agent | Setting | Default | Source (summary) | Checked |', '| --- | --- | --- | --- | --- |'];
const rows = [];
for (const n of readdirSync(PK).filter((x) => /^fairpractice-(?!core$)/.test(x)).sort()) {
  const { manifest } = await import(pathToFileURL(join(PK, n, 'src', 'index.js')).href); const short = n.replace(/^fairpractice-/, '');
  for (const sc of Object.values(manifest.configSchemas || {})) for (const [k, d] of Object.entries(sc.properties || {})) {
    const dated = DATED[`${short}.${k}`]; out.push({ agent: n, setting: k, description: d.description || '', dated: dated ? { default: dated[0], source: dated[1], checked: CHECKED } : null });
    if (dated) md.push(`| ${short} | \`${k}\` | ${dated[0]} | ${dated[1]} | 19 Nov 2026 |`);
    rows.push(`| ${short} | \`${k}\` | ${(d.description || '').replace(/\|/g, '/')} | ${dated ? 'yes' : '-'} |`);
  }
}
const missing = Object.keys(DATED).filter((k) => !out.some((o) => `${o.agent.replace(/^fairpractice-/, '')}.${o.setting}` === k));
if (missing.length) { console.error(`dated entries with no setting: ${missing.join(', ')}`); process.exitCode = 1; }
md.push('', `## Every setting (${out.length})`, '', '| Agent | Setting | What it is, with its default | Dated |', '| --- | --- | --- | --- |', ...rows, '');
md.push('**Rules in the code, not in settings:** CPT and HCPCS time and day rules (care management 20 minutes for 99490 and its add-ons, remote monitoring 16 days for 99454 and 2 to 15 days for 99445 from 2026, 20 minutes for 99457, the 8-minute rule for timed therapy units, psychotherapy time ranges, ABA 15-minute units, the APCM tiers by chronic conditions and QMB status) are written into the `src/logic.js` of each agent from the 2026 code books and CMS rules as read on 18 November 2026. A customer cannot change them by settings; Mythos Machines changes them in a release with a changelog line when CPT or CMS changes them (usually each January).', '');
md.push('Thresholds that are not dated (tolerances, warning days, look-back windows, name similarity) are working examples chosen for version 0.1.0 on 18 November 2026; each practice sets its own.', '');
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'settings.md'), md.join('\n'));
writeFileSync(join(ROOT, 'docs', 'settings.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), settings: out }, null, 2) + '\n');
console.log(`docs/settings.md: ${out.length} settings in ${new Set(out.map((o) => o.agent)).size} agents, ${out.filter((o) => o.dated).length} dated`);
