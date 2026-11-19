# Fairpractice (wave 1): accuracy on fictional test data

Written by `npm run accuracy` (scripts/accuracy.mjs) on 2026-11-19. Fictional fixtures only; no real practice, pharmacy, hospital or patient data.

**Family:** 30 of 30 agents measured. Planted problems found: **207 of 207**; findings on the planted set that were not planted: **0**. Clean set: **2297 rows, 0 findings** (false positives). One-fact mutations caught: **78 of 78**.

Planted: every problem written into the fixtures on purpose, listed in each agent's `fixtures/accuracy.json` and described in its `fixtures/README.md`. Clean: the same files with the one wrong cell repaired (or, where a repair would not be natural, the row dropped); it must give no finding. Mutation: one fact changed in the clean set (one cell or one setting); exactly the named findings must appear and nothing else.

Limits: the fixtures, planted lists, clean sets and mutations were written by the same author as the checks. They show the checks do what their author meant on small fictional files; they do not show how the checks do on a real practice's, pharmacy's or hospital's exports, which have not been measured.

| Agent | Planted found | Not planted | Clean rows | Clean findings | Mutations caught |
| --- | --- | --- | --- | --- | --- |
| fairpractice-aba-therapy | 8 / 8 | 0 | 17 | 0 | 2 / 2 |
| fairpractice-attribution-roster | 6 / 6 | 0 | 26 | 0 | 3 / 3 |
| fairpractice-behavioral-health | 5 / 5 | 0 | 14 | 0 | 3 / 3 |
| fairpractice-breach-deadlines | 11 / 11 | 0 | 5 | 0 | 2 / 2 |
| fairpractice-business-associates | 8 / 8 | 0 | 15 | 0 | 3 / 3 |
| fairpractice-capitation | 8 / 8 | 0 | 26 | 0 | 3 / 3 |
| fairpractice-care-management | 6 / 6 | 0 | 26 | 0 | 3 / 3 |
| fairpractice-care-plan-hours | 4 / 4 | 0 | 37 | 0 | 2 / 2 |
| fairpractice-caregiver-hours | 6 / 6 | 0 | 17 | 0 | 3 / 3 |
| fairpractice-code-updates | 10 / 10 | 0 | 26 | 0 | 3 / 3 |
| fairpractice-compliance-training | 5 / 5 | 0 | 20 | 0 | 2 / 2 |
| fairpractice-evv-claims | 5 / 5 | 0 | 16 | 0 | 3 / 3 |
| fairpractice-exclusion-screening | 9 / 9 | 0 | 13 | 0 | 3 / 3 |
| fairpractice-home-health | 6 / 6 | 0 | 33 | 0 | 3 / 3 |
| fairpractice-hospice-billing | 7 / 7 | 0 | 8 | 0 | 2 / 2 |
| fairpractice-injury-liens | 7 / 7 | 0 | 6 | 0 | 3 / 3 |
| fairpractice-physician-contracts | 9 / 9 | 0 | 13 | 0 | 3 / 3 |
| fairpractice-primary-care-apcm | 6 / 6 | 0 | 16 | 0 | 2 / 2 |
| fairpractice-provider-pay | 5 / 5 | 0 | 1586 | 0 | 3 / 3 |
| fairpractice-records-requests | 8 / 8 | 0 | 8 | 0 | 3 / 3 |
| fairpractice-recoupments | 7 / 7 | 0 | 17 | 0 | 3 / 3 |
| fairpractice-remote-monitoring | 6 / 6 | 0 | 206 | 0 | 3 / 3 |
| fairpractice-review-replies | 6 / 6 | 0 | 6 | 0 | 2 / 2 |
| fairpractice-secondary-claims | 5 / 5 | 0 | 23 | 0 | 1 / 1 |
| fairpractice-security-risk-analysis | 9 / 9 | 0 | 19 | 0 | 3 / 3 |
| fairpractice-staff-health | 9 / 9 | 0 | 21 | 0 | 3 / 3 |
| fairpractice-staff-licenses | 7 / 7 | 0 | 27 | 0 | 2 / 2 |
| fairpractice-surprise-billing-disputes | 7 / 7 | 0 | 10 | 0 | 1 / 1 |
| fairpractice-therapy-billing | 7 / 7 | 0 | 17 | 0 | 3 / 3 |
| fairpractice-wound-products | 5 / 5 | 0 | 23 | 0 | 3 / 3 |

No problems: every planted finding found, nothing else on the planted set, nothing on the clean set, every mutation caught.
