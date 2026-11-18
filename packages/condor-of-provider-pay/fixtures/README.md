# Fixtures

Fictional data only: a made-up practice, providers and patients. The work RVUs are rounded example values, not the current CMS file, and the comp plan is an example.

- `charges-2026-q3.csv`, `rvus.csv` and `comp-plan.json` for July to September 2026 (one October charge is outside the period). Planted:
  - Rhea Lin: 1,160 wRVUs earn 53,320 under the default tiers against 50,000 in draws, so 3,320 is owed at true-up. Ten 99417 lines have no work RVU in the file.
  - Sam Otto: 674 wRVUs (20 bilateral injections with modifier 50 at 150%) earn 30,330 against 33,000 in draws, so 2,670 was paid ahead.
  - June Park: 710 wRVUs earn 29,060 under her own tiers against 27,000 in draws, so 2,060 is owed.
  - Five charge lines have no rendering provider.
- `settings-typo.json` misspells a setting and is refused.
