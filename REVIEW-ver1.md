# Kestrel ver 1: review

18 Nov 2026. What was built, how it was checked, what was found and fixed, and what is not checked yet.

## Scope
The 30 agents recommended in section 17 of the medical agents catalog (`medical-agents-catalog.md`), in five areas: compliance pack (10), specialty billing (7), care management and value-based care (5), home care (3), money recovery and practice finance (5). Plus `kestrel-core` and a copy of `remedy-core` with the Evergreen masking fix. Version 0.1.0 of every agent; nothing published.

Every agent is administrative or financial. None diagnoses, gives treatment advice, or reads clinical notes to suggest codes; jay-of-behavioral-health and tern-of-remote-monitoring refuse `note_read` and `reading_interpret` by name so a model can see the line.

## Checks run, and results
| Check | Result |
|---|---|
| `npm test` (all workspaces, Node 22) | 721 tests, 721 pass (131 remedy-core, 7 kestrel-core, 18 to 26 per agent) |
| `npm run evals` | 465 eval cases across 30 agents, all pass (every agent has 14 to 17) |
| `npm run hostile` (formulas, HTML, `../` ids, AI-aimed instructions planted in every fixture, every eval case) | 2,325 calls, 3,741 planted values, 0 findings |
| `npm run hostile:args` (null, numbers, arrays, a 200,000-character string, `../` and absolute paths in every argument of every tool) | 13,907 calls, 0 findings |
| `npm run check` (family rules) | 30 agents, 227 distinct tool names, 30 prefixes, all pass |
| Masking canaries | Every agent lists at least 3 fictional identifiers; none reaches any eval result |
| MCP stdio smoke test | Every agent: initialize, list tools, refuse an unknown tool, write the audit log |
| `npm pack --dry-run` | All 32 packages pack |
| Demos | Every demo run checked against the problems planted in its fixtures |

## Found and fixed during the build
- **Name clash in the core:** `kestrel-core` exported a column definition called `MODIFIERS`, which shadowed the modifier code table in `remedy-core`. Renamed to `MODIFIER_COL`.
- **stork-of-attribution:** last month's roster was read as a plain argument, so the agent refused it ("prior is not a source kind"). It is now its own source with column matching and masking.
- **thrush-of-caregiver-hours:** live-in shifts were counted once as overtime and again as unpaid sleep time. Live-in findings now carry no amount of their own, and the overtime status was renamed `hours_underpaid` because it covers any shortfall.
- **pelican-of-capitation:** one "net" figure mixed money to dispute with money to set aside for retro terms. Now `to_dispute`, `to_set_aside` and `net`.
- **falcon-of-disputes:** every payment a cent under the QPA was flagged. Added a `qpa_gap_pct` setting (default 10%).
- **gull-of-recoupments:** a recoupment that matched no claim was also reported as "no notice". Now only matched claims are checked for a notice.
- **dove, linnet, egret, ibis, jay:** fixture and wording fixes (face-to-face dates, a September count, base code shown before the add-on, raw lot names in findings, grammar).
- **condor-of-provider-pay:** the one-line description promised bonuses, which the agent does not compute. Description corrected; the report's limits section says quality bonuses and panel adjustments are outside ver 1.

## Not checked yet (say this out loud)
- **Export layouts:** column names for EHR, practice management, EVV, LMS and payroll exports come from general knowledge. No real export has been read. The first setup confirms them with `inspect`.
- **Rules:** Medicare thresholds (8-minute rule, KX amount, hospice cap, care management minutes, RPM day counts, APCM tiers), No Surprises Act windows, state breach and training laws, and EVV rules are summarized from public material as of 2026 and live in settings. A billing professional and a healthcare attorney should read the defaults before a client relies on them. CPT descriptors are not included (AMA licence); the code-update agent reads the files you have.
- **Node 20 and 24:** only Node 22 was available here. `engines` says Node 20 or newer; run `npm test` on 20 and 24 before publishing.
- **Translations:** report titles exist in nine languages through the core; READMEs, sample reports and sales copy are English only.
- **Sample reports** show raw numbers (no thousands separators or currency).
- No lawyer, billing expert, compliance officer or customer review yet.

## Ideas for ver 2
Money formatting in reports; one real de-identified export per system to confirm columns; port the Remedy `intl` check; a "monthly compliance pack" runner that runs heron, finch, robin, lark and swift in order; the 9 Evergreen agents generalized for practices (catalog section 13); pharmacy and hospital families from the catalog.

## Decisions left for Francisco
Family name Kestrel (bird names, unconfirmed); prices (proposals in `sales/pricing-page-ver1.md`); publishing to npm/GitHub; a product page on mythosmachines.com; lawyer, insurer and BAA template before any real patient data (catalog section 15). The compliance pack agents that read staff or vendor data only (heron, finch, robin, swift, plover, lark, crane) can be sold before those steps; owl, hawk and wren touch patient information and wait for them.
