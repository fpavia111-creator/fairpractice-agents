# Kestrel: medical practice admin, billing and compliance agents (ver 1)

English · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md)

30 MCP agents for medical practices, home care agencies, hospices and therapy clinics: the recommended first 30 from the medical agents catalog. Each one reads files a practice already exports (claims, remits, schedules, rosters, EVV visits, payroll, staff lists, vendor lists), flags what a biller, compliance officer or practice manager would catch by hand, and writes a CSV worklist and an HTML report for staff.

Built on `remedy-core` (masking, policy, approvals, audit log, MCP server, memory, nine-language reports) plus `kestrel-core` (business days with federal holidays, month and week helpers, clock and duration minutes, name and code matching, and common practice column names).

- **Administrative and financial only.** No diagnosis, no treatment advice, and no agent reads clinical notes to suggest codes. They check what was billed, paid, filed, signed or scheduled against rules and settings you give them.
- **Local files only.** No logins to an EHR, a clearinghouse, a payer portal, a state EVV system or the OIG site. No network calls, no telemetry. You download the lists (for example the OIG exclusion file) and point the agent at them.
- **Masked before the model sees it.** Patient and staff names become pseudonyms (`PT-3f9a1c2e`), record and account numbers become `MRN-…` and `ACCT-…`, e-mails and phones are removed. Names with junk in front of them (spaces, quotes, formula characters) are masked too. Report files on disk keep real names for staff.
- **People send.** Every agent refuses the live action next to its job (submitting claims or disputes, filing breach notices, posting review replies, running payroll, changing comp plans). Drafts that could go out wait for one named click, even in Auto, tied to the sha256 of the draft.
- **Settings, not hard-coded rules.** Thresholds, limits, windows and state rules are JSON settings you pass. A misspelled setting is refused by name. Where a rule depends on a state or a payer, the sample settings say so and ask for your own check.
- **Fictional data only.** Every patient, provider, payer, attorney and vendor in the fixtures is made up. Code-update fixtures use invented ZZ codes.

This keeps PHI away from the model; it is **not** a HIPAA compliance determination, and not billing, coding, legal, tax, accounting or clinical advice. Column names were written from general knowledge of common exports and **have not been checked against real exports** from any EHR or billing system.

## The 30 agents

### Compliance pack

| Agent | What it checks |
|---|---|
| [heron-of-exclusions](packages/heron-of-exclusions) | Exclusion screening for everyone a practice pays: staff, providers, contractors and vendors checked against the OIG exclusion list, SAM and state Medicaid exclusion files you download, with NPI and birth-date matches, near-name matches to clear, reinstatements and people not screened this month. |
| [finch-of-licenses](packages/finch-of-licenses) | Staff licenses and certifications: nursing and allied licenses, BLS, ACLS and other certificates expired or expiring, missing for the role, verification older than your policy, compact-state licenses used out of state, and staff working shifts on an expired license. |
| [robin-of-staff-health](packages/robin-of-staff-health) | Employee health compliance (HR records, not care): TB tests, flu and other required vaccines or declinations, mask fit tests and annual health screens due or overdue by department and role. |
| [owl-of-access-requests](packages/owl-of-access-requests) | Patient right-of-access requests: the 30-day clock and one 30-day extension, requests past due, extensions without a written notice, fees above your limit or the flat fee, and denials without a reason. |
| [hawk-of-breaches](packages/hawk-of-breaches) | Privacy incident and breach clocks: risk assessments not done, the 60-day notice deadline to patients, the media and HHS for large breaches, the annual HHS log for small ones, and notices sent late. |
| [swift-of-associates](packages/swift-of-associates) | Business associate inventory: every vendor that touches patient data with a BAA on file or missing, BAAs expired or ending, security reviews overdue, and vendors paid with no contract on the list. |
| [plover-of-risk-analysis](packages/plover-of-risk-analysis) | Security risk analysis tracker: the annual risk analysis evidence checklist, open risks past their due date, high risks with no owner or plan, and systems with patient data missing from the asset list. |
| [lark-of-training](packages/lark-of-training) | Compliance training: required courses per role and state (HIPAA, fraud and abuse, Texas HB 300 and others), new hires not trained within the days your policy allows, annual refreshers overdue and courses missing for a role. |
| [wren-of-reviews](packages/wren-of-reviews) | Online review replies without a HIPAA fine: checks drafted replies for words that confirm someone is a patient (visit, treatment, chart, diagnosis, their name) and writes safe, generic reply drafts a person approves. |
| [crane-of-physician-contracts](packages/crane-of-physician-contracts) | Payments to referral-source physicians against their contracts (Stark and anti-kickback admin checks): payments with no signed or current agreement, expired agreements still paid, payments above the contract or your fair-market-value range, and missing time logs. |

### Specialty billing

| Agent | What it checks |
|---|---|
| [magpie-of-aba](packages/magpie-of-aba) | ABA therapy units against authorizations: units delivered vs authorized hours per week and in total, sessions outside the authorization dates, supervision below the share the payer requires, unit math against session minutes, and authorizations ending with hours unused. |
| [swallow-of-therapy](packages/swallow-of-therapy) | Outpatient therapy billing (PT, OT, speech): timed units against the 8-minute rule, the KX threshold per patient per year, CQ and CO assistant modifiers, GP/GO/GN discipline modifiers, and plan-of-care certifications and recertifications due. |
| [dove-of-hospice](packages/dove-of-hospice) | Hospice billing deadlines and the cap: notices of election and termination filed late, benefit periods and face-to-face encounters before the third period, the aggregate cap per cap year and the live-discharge rate. |
| [sparrow-of-home-health](packages/sparrow-of-home-health) | Home health 30-day periods: notices of admission filed late (with the payment cut per day), visits under the low-utilization threshold, periods that overlap another period, and visits outside any period. |
| [jay-of-behavioral-health](packages/jay-of-behavioral-health) | Behavioral health billing: psychotherapy codes against session minutes, add-on codes without their base code, crisis time, sessions over the payer's yearly limit, and providers billing codes their license type cannot bill. |
| [ibis-of-wound-products](packages/ibis-of-wound-products) | Wound care product billing: skin substitute units against the product size used and wasted (JW/JZ), application codes against the product lines, products billed with no invoice and paid below what they cost. |
| [raven-of-liens](packages/raven-of-liens) | Personal injury liens and letters of protection: open balances by attorney and case, cases with no update, settled cases not paid, reductions accepted and balances past the statute window you set. |

### Care management and value-based care

| Agent | What it checks |
|---|---|
| [egret-of-care-management](packages/egret-of-care-management) | Care management time billing: minutes per patient per month against the thresholds for chronic care, principal care and behavioral health codes, add-on units, consent on file, and two practices or overlapping codes in the same month. |
| [tern-of-remote-monitoring](packages/tern-of-remote-monitoring) | Remote monitoring billing: days of readings per 30-day period against each device code's day threshold, management minutes and interactive contact, setup billed once, and overlaps with care management. |
| [linnet-of-primary-care](packages/linnet-of-primary-care) | Advanced primary care management: monthly codes against patient tiers, consent, care management codes billed in the same month that the rules do not allow, and enrolled patients not billed. |
| [stork-of-attribution](packages/stork-of-attribution) | Attribution reconciliation for value-based contracts: patients the payer attributes to you that you never saw, your active patients the payer left out, patients attributed to the wrong provider, and changes since last month. |
| [pelican-of-capitation](packages/pelican-of-capitation) | Capitation reconciliation: per-member payments against the roster month by month, members paid at the wrong rate, members on the roster not paid, retro adds and terms, and the net amount to dispute. |

### Home care

| Agent | What it checks |
|---|---|
| [oriole-of-evv](packages/oriole-of-evv) | Electronic visit verification against Medicaid claims: claim lines with no matching EVV visit, units billed above the verified time, visits verified at the wrong place or by another caregiver, and manual edits above your limit. |
| [thrush-of-caregiver-hours](packages/thrush-of-caregiver-hours) | Caregiver hours and pay: weekly hours across clients, overtime owed above 40 hours, travel time between clients, split shifts, missed meal breaks under your state settings, and live-in shifts. |
| [warbler-of-care-plans](packages/warbler-of-care-plans) | Home care hours against the plan of care: hours delivered vs authorized per week, under-delivery, over-delivery that will not be paid, services not on the plan and plans or authorizations ending. |

### Money recovery and practice finance

| Agent | What it checks |
|---|---|
| [falcon-of-disputes](packages/falcon-of-disputes) | No Surprises Act payment disputes: the 30-business-day open negotiation, the 4-business-day window to start IDR, offers below the QPA, batching groups, outcomes by payer and fees paid. |
| [osprey-of-secondary-claims](packages/osprey-of-secondary-claims) | Secondary and tertiary claims: primary paid with a balance left and no secondary claim sent, secondaries sent without the primary's payment, wrong payer order, and secondary timely filing windows closing. |
| [gull-of-recoupments](packages/gull-of-recoupments) | Payer recoupments and offsets: takebacks matched to the original claim, recoupments with no notice on file, the same claim taken back twice, and appeal windows still open. |
| [curlew-of-code-updates](packages/curlew-of-code-updates) | Code-set update impact: deleted and changed CPT, HCPCS and ICD-10 codes found in your chargemaster, fee schedule, order sets and open claims, with new codes that need a fee. |
| [condor-of-provider-pay](packages/condor-of-provider-pay) | Provider pay by work RVU: wRVUs per provider from charges and the RVU file, tiered pay and draws trued up, plus codes with no RVU and charges missing a provider. |

## Try it (Node 20 or newer)

```bash
npm install
npm test                      # 721 tests across the cores and 30 agents
npm run evals                 # 465 eval cases on the fictional fixtures
npm run hostile               # plants formulas, HTML, "../" and AI-aimed instructions in every fixture
npm run hostile:args          # broken and hostile arguments on every tool
npm run check                 # family rules: unique tools, refused tools, canaries, READMEs
npm run samples               # writes sample-reports/ (open sample-reports/index.html)
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

Every agent has `demo`, `eval`, `tools`, `sources`, `inspect` and `mcp`. In Claude Code before anything is published:

```bash
claude mcp add heron-of-exclusions -- node /path/to/kestrel-agents/packages/heron-of-exclusions/bin/heron-of-exclusions.js mcp --root .
```

Only Node 22 was run while building ver 1. The package files say Node 20 or newer; run the tests on your Node version before relying on it.

## Layout

```
packages/remedy-core       shared runtime (from the Remedy family, with the Evergreen masking fix)
packages/kestrel-core      practice helpers and the agent builder (medAgent)
packages/<bird>-of-<job>   one agent: src/logic.js (pure), src/manifest.js, src/demo.js,
                           fixtures/, evals/cases.json, test/, README.md (generated)
scripts/agents.json        the 30 agents with their one-line descriptions
scripts/new-agent.mjs      package boilerplate for every agent in scripts/agents.json
scripts/readme.mjs         writes every agent README from the agent itself
scripts/run-all-evals.mjs  all eval cases
scripts/hostile.mjs        hostile-input check (add --args for broken arguments on every tool)
scripts/family-check.mjs   family-wide rules
scripts/sample-reports.mjs the sample reports for prospects
```

## Licence

MIT. Nothing here is published to npm or GitHub yet.
