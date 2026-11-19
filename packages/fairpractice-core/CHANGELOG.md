# Changelog

## 0.2.0 (unreleased, Fairpractice wave 2, 2026-11-18)

Additions, plus two renames in the final pass (below). The first 30 agents can move to 0.2.0 without a change in results; their reports would be written under `fairpractice-out/` instead of `kestrel-out/`.

- Column definitions `ACCOUNT`, `NDC`, `REV_CODE`, `ADMIT`, `DISCHARGE`, `DX`, `DRUG`, `PHONE` and `ORG` for hospital, pharmacy and front-desk exports.
- Helpers `ndcKey` (NDC to 11 digits), `inCodeList` (single codes, ranges such as 70450-70498 and wildcards such as E11.*), `fplPercent` (income as a percent of a poverty guideline you set), `pctOf`, `daysSince`, `latestBy` and `lookupRule`.
- Tests for the helpers and for the new columns.

Changed in the final pass (19 Nov 2026), names only:

- The report folder default is `fairpractice-out/<prefix>` (was `kestrel-out/<prefix>`, a working name).
- `KESTREL_LIMITS` is now `PRACTICE_LIMITS`; the old name stays as an alias so 0.1.x agents keep working.
- `nearNameIndex` (wave 1 final pass): numbers in names match exactly (no typo variants), and a word variant shared by more than 500 names is not used to find candidates when the name has a rarer one. 5,000 vendors against 5,000 payees took 11.8 seconds, now 0.5. Only wave 1's business associate and exclusion agents use it.

## 0.1.0

- First release: the medical practice helpers (business days with federal holidays, clock and duration minutes, name and code matching, aging, common practice export columns) and the `medAgent` builder on top of `fairclaim-core`.
- 18 Nov 2026: README and changelog added; the Windows fixes of `fairclaim-core` (relative paths with `/`) apply here too.
