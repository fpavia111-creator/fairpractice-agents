# Fixtures

Fictional data only: a made-up counseling practice, made-up clients and clinicians. Any likeness to real people is chance.

- `sessions-2026.csv`. Planted:
  - B1: 90837 on November 3 for 45 minutes (the time supports 90834).
  - B2: add-on 90833 on November 4 with no E/M visit that day (October 8 has one and is fine).
  - B3: 90792 billed under an LPC license (the default rules keep it for prescribers). Interactive complexity 90785 with 90834 is fine.
  - B4: crisis care for 100 minutes with 2 units of 90840 (the time supports 1).
  - B5: a fifth 2026 session with Cedar Mutual, which allows 4 a year in the settings.
- `settings.json`: example code rates and a yearly limit of 4 for Cedar Mutual. `settings-typo.json` misspells a setting and is refused.
