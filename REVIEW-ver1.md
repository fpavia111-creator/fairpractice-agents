# Fairpractice ver 1: review

18 Nov 2026. What was built, how it was checked, what was found and fixed, and what is not checked yet.

## Scope
The 30 agents recommended in section 17 of the medical agents catalog (`medical-agents-catalog.md`), in five areas: compliance pack (10), specialty billing (7), care management and value-based care (5), home care (3), money recovery and practice finance (5). Plus `fairpractice-core` and a copy of `fairclaim-core` with the Fairstay masking fix. Version 0.1.0 of every agent; nothing published.

Every agent is administrative or financial. None diagnoses, gives treatment advice, or reads clinical notes to suggest codes; fairpractice-behavioral-health and fairpractice-remote-monitoring refuse `note_read` and `reading_interpret` by name so a model can see the line.

## Checks run, and results
| Check | Result |
|---|---|
| `npm test` (all workspaces, Node 22) | 721 tests, 721 pass (131 fairclaim-core, 7 fairpractice-core, 18 to 26 per agent) |
| `npm run evals` | 465 eval cases across 30 agents, all pass (every agent has 14 to 17) |
| `npm run hostile` (formulas, HTML, `../` ids, AI-aimed instructions planted in every fixture, every eval case) | 2,325 calls, 3,741 planted values, 0 findings |
| `npm run hostile:args` (null, numbers, arrays, a 200,000-character string, `../` and absolute paths in every argument of every tool) | 13,907 calls, 0 findings |
| `npm run check` (family rules) | 30 agents, 227 distinct tool names, 30 prefixes, all pass |
| Masking canaries | Every agent lists at least 3 fictional identifiers; none reaches any eval result |
| MCP stdio smoke test | Every agent: initialize, list tools, refuse an unknown tool, write the audit log |
| `npm pack --dry-run` | All 32 packages pack |
| Demos | Every demo run checked against the problems planted in its fixtures |

## Found and fixed during the build
- **Name clash in the core:** `fairpractice-core` exported a column definition called `MODIFIERS`, which shadowed the modifier code table in `fairclaim-core`. Renamed to `MODIFIER_COL`.
- **fairpractice-attribution-roster:** last month's roster was read as a plain argument, so the agent refused it ("prior is not a source kind"). It is now its own source with column matching and masking.
- **fairpractice-caregiver-hours:** live-in shifts were counted once as overtime and again as unpaid sleep time. Live-in findings now carry no amount of their own, and the overtime status was renamed `hours_underpaid` because it covers any shortfall.
- **fairpractice-capitation:** one "net" figure mixed money to dispute with money to set aside for retro terms. Now `to_dispute`, `to_set_aside` and `net`.
- **fairpractice-surprise-billing-disputes:** every payment a cent under the QPA was flagged. Added a `qpa_gap_pct` setting (default 10%).
- **fairpractice-recoupments:** a recoupment that matched no claim was also reported as "no notice". Now only matched claims are checked for a notice.
- **dove, linnet, egret, ibis, jay:** fixture and wording fixes (face-to-face dates, a September count, base code shown before the add-on, raw lot names in findings, grammar).
- **fairpractice-provider-pay:** the one-line description promised bonuses, which the agent does not compute. Description corrected; the report's limits section says quality bonuses and panel adjustments are outside ver 1.

## Not checked yet (say this out loud)
- **Export layouts:** column names for EHR, practice management, EVV, LMS and payroll exports come from general knowledge. No real export has been read. The first setup confirms them with `inspect`.
- **Rules:** Medicare thresholds (8-minute rule, KX amount, hospice cap, care management minutes, RPM day counts, APCM tiers), No Surprises Act windows, state breach and training laws, and EVV rules are summarized from public material as of 2026 and live in settings. A billing professional and a healthcare attorney should read the defaults before a client relies on them. CPT descriptors are not included (AMA licence); the code-update agent reads the files you have.
- **Node 20 and 24:** only Node 22 was available here. `engines` says Node 20 or newer; run `npm test` on 20 and 24 before publishing.
- **Translations:** report titles exist in nine languages through the core; READMEs, sample reports and sales copy are English only.
- **Sample reports** show raw numbers (no thousands separators or currency).
- No lawyer, billing expert, compliance officer or customer review yet.

## Ideas for ver 2
Money formatting in reports; one real de-identified export per system to confirm columns; port the Fairclaim `intl` check; a "monthly compliance pack" runner that runs heron, finch, robin, lark and swift in order; the 9 Fairstay agents generalized for practices (catalog section 13); pharmacy and hospital families from the catalog.

## Decisions left for Francisco
Family name Fairpractice (bird names, unconfirmed); prices (proposals in `sales/pricing-page-ver1.md`); publishing to npm/GitHub; a product page on mythosmachines.com; lawyer, insurer and BAA template before any real patient data (catalog section 15). The compliance pack agents that read staff or vendor data only (heron, finch, robin, swift, plover, lark, crane) can be sold before those steps; owl, hawk and wren touch patient information and wait for them.

## Final pass (19 Nov 2026)

Run on the main session's request (`FINAL-PASS-REQUEST.md`, including its lessons from other families), against the brief's eight-point checklist and Kurt's five review questions, by the session that built Fairpractice wave 2. Windows 10, Node 24.20. Local commits only; nothing pushed, published or uploaded.

### Shared cores

`fairclaim-core` and `fairpractice-core` are now the same as wave 2's (`fairpractice-core` 0.2.0 is wave 1's 0.1.0 plus additions), with four more fixes made here: `fairclaim-core` links point at fairclaim-agents (were remedy-agents); `safePath` refuses over-long paths before touching the disk (the hostile argument pass hung on Windows without it); a repeated column name keeps the first column instead of being overwritten (found by the CMS RVU file); the agent scaffolder takes `<product>-<what-it-does>` names and refuses `<figure>-of-<process>` (after the Fairclinic note). In `fairpractice-core`, `nearNameIndex` matches numbers exactly and skips very common words (a speed test had started failing: 5,000 vendors by 5,000 payees took 11.8 s, now 0.5 s). The agents depend on `fairpractice-core ^0.2.0`. Wave 2 does not yet have the two core fixes made here (repeated columns, scaffolder) or the index change; its agents do not use the index.

### The eight points

1. **Names.** No working names left outside history and folder names: reports go to `fairpractice-out/` (were `kestrel-out/`), `PRACTICE_LIMITS` (old name kept as an alias), the "kestrel" keyword removed from all 30 package and plugin files, old example names out of the core README and script comments, and 16 sample report files still named after birds (condor, dove, egret, falcon, heron, oriole, owl, swallow) removed. `fairclaim-core` keeps its `remedy-*` bins and `.remedy/` state folder, as in the canonical copy (a decision for the main session).
2. **Read as a buyer.** Each README says what the agent does, names what it refuses in bold and lists the columns and settings it needs; the demos and sample reports show the findings. Changed: the root README no longer says masking "keeps PHI away from the model", and says which public files were run as published; the review-replies description no longer promises replies "without a HIPAA fine".
3. **Honest copy.** Scan of READMEs, `sales/`, sample reports and docs for compliance, certification, savings, guarantee and advice claims: after the review-replies change, only domain words matched ("certification" of a plan of care, BLS "certification").
4. **Binding actions.** 60 binding tools across the 30 agents (submit claims, send, pay, post, publish, terminate, change a live system, read notes): all 60 come back `blocked` under each agent's default policy. The review post request and the memory approvals wait for a named person (`ask`).
5. **The full bar from a clean install:** see the table below.
6. **Fictional fixtures.** The two fixture NPIs were looked up in NPPES: 1234567893 (the CMS example) is not issued, but **1679576722 is a real provider in Kearney, Nebraska**; replaced with 1000000178, which is not issued. A law firm name that exists (Harbor Law Group) was replaced. Vendors were already marked "(fictional)".
7. **Site and sample reports.** There is no `sales/site.json` in wave 1 (the page on fair-agents.com was written by the main session); `sales/final-pass.json` uses the ten package names from that page. Sample reports regenerated.
8. **No secrets or state.** Checked by the release check (secret scan, `npm pack` contents); untracked `kestrel-out/` output folders from the build were deleted.

### Fresh clone, full bar

`git -c core.autocrlf=true clone` of this folder into `%TEMP%\fp-kestrel1`, `npm install --offline` with npm pointed at a dead address (127.0.0.1:9), then each check in order (19 Nov 2026, 07:13 to 08:35, with other sessions keeping the machine at 100% CPU). The only files checked out with CRLF are the 11 legacy-encoding test fixtures stored byte for byte (the new `.gitattributes`); the README check ignores CR anyway.

| Check | Result |
|---|---|
| Install | offline, 23 seconds, no network |
| `try_it` demo (`fairpractice-exclusion-screening demo`) | runs with no network and no setup: 11 people screened against 9 list entries, 9 findings, the agent's own attempt to act blocked |
| `npm test` | **830 tests, 830 pass** (721 in ver 1 on Node 22; added since: the wave-2 core tests and the tests for this pass's fixes) |
| `npm run evals` | **525 of 525** |
| `npm run check` | 30 agents, 227 tool names, 30 prefixes: pass |
| `npm run readme:check` | every agent README current |
| `npm run accuracy` | 30 of 30 agents; planted 207 of 207, 0 not planted; clean 2,297 rows, 0 findings; mutations 78 of 78 |
| `npm run model-view` | 3,645 masked values in 362 masked calls: 0 in a result |
| `npm run intl` | 433 cases in 8 languages: every case that passes in English passes in every language (125 of 444 column names have a translated word) |
| `npm run hostile` | 2,625 calls, 3,966 planted values: **0 findings** |
| `hostile --args` | on the 9 agents changed in this pass: 3,866 calls on 8 of them, 0 findings, and ABA (with compliance training and recoupments) finished in a full 30-agent pass that was then stopped for time, with no finding. Ver 1 ran the full pass: 13,907 calls, 0 findings |
| `npm run bench` | 60 tools at 10,000 rows, peak 302 MB, every tool growing in step with its input (at most 8.2 times the time for 10 times the rows). First run, with the argument passes running alongside: median 6.4 s, 7 tools over the 10-second line. Re-run of those five agents: 9 of 10 under 10 s; the EVV report takes 10.6 s |
| `npm run release:check:offline` | **Dry run passed**: metadata, secret scan, honest copy, one-click policy, tests 830, evals 525, hostile 0, `npm pack` 32 packages (578 KB, no tests, state, output or keys). One warning: `package-lock.json` had not been refreshed after the core dependency moved to ^0.2.0 (the clone's install changed it); refreshed and committed. npm names checked online, read-only: all 32 return 404, so nothing of Fairpractice is on npm yet |

### Kurt's five questions

**1. Accuracy** (`npm run accuracy`, `docs/accuracy.md`). Every agent now has `fixtures/accuracy.json`: the planted problems (from its fixture README, checked against the rows), a clean set (the wrong cell repaired where natural, otherwise the row dropped) and one-fact mutations. Family: **207 of 207 planted problems found, 0 findings that were not planted, 0 findings on 2,297 clean rows, 78 of 78 mutations caught**. One status is informational and left out of the counts: recoupments' `appeal_open` (every recent takeback is listed with its appeal window). The clean sets found one wrong finding: caregiver hours listed travel time even when payroll had paid it; now only when no payroll row shows it paid. About fifteen first-draft clean sets or mutations were wrong about the agent and were rewritten (a repair that set off a later deadline, a weekly respite plan, a joined shift with no meal break). Limit: written by the same author as the checks; not measured on a real practice's files.

**2. Security: what reaches the model** (`npm run model-view`, `docs/model-view.md`). 27 of 30 agents read a masked column: patient, client and member names and numbers, birth dates (cut to the year), phones and e-mails, and the names of providers, therapists, physicians under contract, caregivers, employees, people screened and reviewers. Three read no personal column (breach deadlines, business associates, security risk analysis). Sent in clear: NPIs, claim and case numbers, codes, dates, amounts, business names (payers, vendors, law firms). Free text sent with known names replaced: review texts and draft replies, reasons, descriptions, risk threats and plans (7 agents). Sent as written: risk owners and "accepted by" in the security risk analysis (usually a role, a name if typed), licence numbers, and staff health results ("positive", "declined") next to a pseudonymised name. Leak check: **3,645 masked values in 362 masked calls, 0 found in a result**, plus each agent's canary test. Fixed: five agents (ABA, attribution, behavioral health, provider pay, therapy) sent provider names in clear although the limits text says staff names are masked. Results go to whatever model the user's assistant uses; no claim of HIPAA compliance; masking is not de-identification.

**3. Compatibility** (`sales/final-pass.json`, "formats"). Tested on a real export: the OIG LEIE file and the CMS fee schedule RVU file. Tested on a public sample: 835 files (the core reader, Nevada Medicaid's sample). Written from knowledge of the export and not yet checked against documentation or a real export: state exclusion lists and every practice, hospice, home health, EVV, payroll, payer, HR, learning and accounts payable layout.

**4. Commercial traction.** No paying customers yet; no checkout is live (the main session's answer for the suite).

**5. Support** (`npm run settings-list`, `docs/settings.md`). 116 settings in 28 agents, each a named key in the customer's settings JSON (a misspelt key is refused). 24 follow a dated rule, listed with default, source and date checked: HIPAA breach notice (60 days, 500 for media and HHS) and a state attorney general example, right of access (30 days plus one 30-day extension, the $6.50 flat-fee option), No Surprises Act windows (30 and 4 business days) and the $115 administrative fee, the KX threshold (default 2,410 is the 2025 figure; the current-year figure was not re-checked), plan-of-care signature (30 days), hospice cap, NOE, NOTR and face-to-face windows, home health NOA (5 days) and LUPA thresholds, FLSA overtime, travel and sleep rules for home care, monthly exclusion screening, the nurse licensure compact list, APCM conflict codes and Medicare modifier payment percentages. Rules that live in code, not settings: CPT and CMS time and day rules (care management minutes, remote monitoring days including 99445 from 2026, the 8-minute rule, psychotherapy time ranges, ABA units, APCM tiers); Mythos Machines changes them in a release with a changelog line, usually each January.

### Real data (`npm run realdata:download`, `npm run realdata`, `docs/realdata.md`)

| Source (date, licence) | What ran | What it found |
|---|---|---|
| OIG LEIE full file (downloaded 19 Nov 2026; public HHS-OIG data) | 84,224 entries as the exclusion agent's list; 500 listed individuals entered as staff; 1,000 made-up staff from the most common first and last names with made-up birth dates | **500 of 500 listed people found.** Made-up staff: **6,357 findings before the fix, 5,902 of them near names** of excluded people with other birth dates; now near names with a different birth date on both sides are counted (6,029 pairs), not listed: **529 findings** (446 exact names with a different birth date, listed by design so the officer can note the check; 74 near names with no birth date; 9 name-only) |
| CMS physician fee schedule RVU file, January 2026 (19 Nov 2026; public CMS data, CPT descriptors not used) | the PPRRVU CSV as published as the provider pay agent's RVU file, with the fixture charges | **Every code came back "no RVU"** (the field named `code` took the STATUS "CODE" column), then **malpractice RVUs were read as work RVUs** (two columns headed "RVU"; the core kept the last). Fixed in the agent and the core; now 2,562.2 wRVUs on the fixture charges, close to the 2,544 of the rounded example file, no code missing |
| Nevada Medicaid sample 835 (19 Nov 2026; public sample, no real patients) | the PDF's text as an 835 through the core reader | the **1,812.27 check made only of provider-level adjustments is kept**, its PLB lines summing to -1,812.27. No wave-1 agent posts ERAs; the claim-less payment bug other families found is in an ERA agent, not in this reader |

Not run on real data: the other 27 agents read files private to a practice or agency. The HHS breach portal (breaches of 500 or more, not an incident log) and state licence lookups come close and were not used; SAM.gov exclusions need an API key.

### For the main session and Kurt

- **Decisions for Kurt:** whether wave 1 and wave 2 share one repository and one published `fairpractice-core` (both now carry the same core, wave 1's slightly newer); whether exact-name exclusion matches with a different birth date should stay listed (446 per 1,000 very common names on the real list, each to be noted and cleared once with `exclusions_learn`).
- **For the main session:** wave 2 and fairclaim-agents can take this repo's two `fairclaim-core` fixes (repeated column names, scaffolder) and the `nearNameIndex` change; the `remedy-*` bin names in `fairclaim-core` are still the canonical ones.
- **Still not checked:** Node 20 and 22; any real practice, EVV, payroll or HR export; the current-year KX threshold and hospice cap; a billing professional, compliance officer or healthcare attorney reading the dated defaults; native-speaker review of the README translations.
