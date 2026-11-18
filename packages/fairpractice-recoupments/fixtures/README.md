# Fixtures

Fictional data only: a made-up practice, patients and payers. Any likeness to real people is chance. The 18-month lookback and 120-day appeal window are examples, not any state's law or payer's rule.

- `recoupments.csv`, `paid-claims.csv` and `notices.csv`. Planted (as of November 15, 2026):
  - CL-202: taken back on September 1 and again on October 15. The first takeback's appeal window closes November 29.
  - CL-203: 220 taken back on a claim paid 180.
  - CL-204: paid December 2024, recouped October 2026, beyond the 18-month lookback.
  - CL-205: recouped November 2 with no notice on file.
  - CL-999: a takeback for a claim not in your paid claims.
  - CL-207: appeal window (120 days from the July 20 notice) closes November 17.
  - CL-201: recouped with notice; appeal open until January 13.
- `settings.json`: 120 days to appeal, 21-day warning, 18-month lookback. `settings-typo.json` misspells a setting and is refused.
