# Fixtures

Fictional data only: a made-up home health agency, made-up patients. Any likeness to real people is chance.

- `periods.csv` and `visits.csv`. Planted:
  - S1: the notice of admission for the October 1 start of care was filed October 9 (due October 6), so the period payment is cut by 8/30.
  - S2: start of care November 3 with no notice of admission (due November 8).
  - S3: the period that ended October 14 had 2 visits against a threshold of 4.
  - S4: the second period starts November 1, inside the first (which runs to November 3), and a visit on September 30 falls before any period.
  - S5: the period ends November 18 with 2 visits against a threshold of 5.
- `settings.json`: 5 days for the NOA, a 180 average per-visit payment for the low-utilization estimate, and a 7-day warning. `settings-typo.json` misspells a setting and is refused.
