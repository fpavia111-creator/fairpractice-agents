# Fixtures

Fictional data only: a made-up primary care practice, made-up patients. Any likeness to real people is chance.

- `time-log.csv`, `claims.csv` and `enrolled.csv` for October 2026. Planted:
  - E1: 45 minutes of CCM with 99490 and two units of 99439 (the time supports one).
  - E2: 99490 billed on 15 minutes.
  - E3: 99490 billed with no consent on file.
  - E4: CCM (99490) and PCM (99426) billed in the same month.
  - E5: CCM billed in a month another practice bills it.
  - E6: 40 minutes of CCM logged, consent on file, nothing billed.
  - E7: CCM and BHI in the same month with separate time is fine.
- `settings.json`: example rates for dollar estimates. `settings-typo.json` misspells a setting and is refused.
