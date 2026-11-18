# Fixtures

Fictional data only: a made-up cardiology practice's monitoring program, made-up patients. Any likeness to real people is chance.

- `readings.csv`, `management-time.csv`, `claims.csv` and `enrolled.csv`, mostly October 2026. Planted:
  - T1: 99454 for October with 12 days of readings (16 needed; 99445 fits).
  - T2: setup 99453 billed in August and again in October in the same episode.
  - T3: 99457 for October with 25 minutes but no interactive contact logged.
  - T4: 45 minutes with 99457 and two units of 99458 (the time supports one).
  - T5: 99454 for the period ending October 15 and again for the period ending October 31; they overlap.
  - T6: RPM and remote therapeutic monitoring (98980) billed in the same month.
- `settings.json`: example rates. `settings-typo.json` misspells a setting and is refused.
