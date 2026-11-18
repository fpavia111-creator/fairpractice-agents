# Fixtures

Fictional data only: a made-up practice, patients and payers. Any likeness to real people is chance. Filing windows in the settings are examples, not any payer's rule.

- `claims.csv` and `coverage.csv`. Planted (as of November 15, 2026):
  - S1: 120 left after the primary paid October 1; the Cedar Supplement claim (60 days) is due November 30.
  - S2: 200 left after the primary paid August 1; the Cedar Supplement claim was due September 30 and was never sent.
  - S3: 80 left after the primary paid November 1; no State Medicaid claim yet (365 days).
  - S4: billed to Cedar Supplement as primary, but coverage has it as secondary.
  - S5: the Cedar Supplement claim was sent October 5, a week before the primary adjudicated.
  - S6: billed in the right order with the EOB, and is fine.
- `settings.json`: 90 days by default, 60 for Cedar Supplement, 365 for State Medicaid, 21-day warning. `settings-typo.json` misspells a setting and is refused.
