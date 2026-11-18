# Fixtures

Fictional data only: a made-up home care agency, clients and caregivers. Any likeness to real people is chance.

- `evv-visits.csv` and `claims.csv` for November 2 to 5, 2026. Planted:
  - Abby Lund: November 3 billed 8 units for a 90-minute verified visit (6 units).
  - Bruno Sato: November 4 billed with no EVV visit.
  - Celia Ward: billed under Omar Feld but verified by Tom Baptiste.
  - Dane Ivers: the visit was verified away from the client's address.
  - Lia Gruber: 2 of 3 visits entered or edited by hand, above the 20% limit.
- `settings.json`: 15-minute units, midpoint rounding, a 20% manual-edit limit. `settings-typo.json` misspells a setting and is refused.
