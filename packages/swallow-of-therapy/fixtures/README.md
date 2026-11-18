# Fixtures

Fictional data only: a made-up outpatient therapy clinic, made-up patients and staff. Any likeness to real people is chance.

- `visits-2026.csv` and `plans-of-care.csv`. Planted:
  - P1: PT spending passes the KX threshold on November 3 with no KX, and that day bills 4 timed units for 40 timed minutes (the 8-minute rule allows 3).
  - P2: an OT assistant (COTA) bills 97530 with GP and without CO; the OT plan of care from October 1 is still unsigned.
  - P3: the speech plan of care ends November 29 and the patient was seen November 6, so the recertification is due.
  - P4: PT on November 10 falls after the plan of care ended November 5. The PTA line carries CQ, so it is not flagged for the modifier.
- `settings.json`: KX threshold 2410 (set your year's figure), Medicare only, 30 days to sign, warn 21 days ahead. `settings-typo.json` misspells a setting and is refused.
