# Fixtures

Fictional data only: Bluewater Family Medicine (a made-up practice) and made-up incidents. The log holds counts, not names.

- `incidents.csv`: Planted: a small breach noticed on time, still owed on the year-end HHS log (INC-2026-01); a 2,400-person breach with letters and media notice sent after day 60 and no HHS report or Texas attorney general notice (INC-2026-02); a 40-person breach with no letters 27 days past the deadline (INC-2026-03); an incident from September with no assessment and no decision after 60 days (INC-2026-04); an incident decided not to be a breach (INC-2026-05); a 600-person breach with letters due within 14 days and the Texas attorney general notice already late (INC-2026-06); and a new incident whose assessment is overdue (INC-2026-07).
- `settings.json`: 60 days, a 10-day assessment target, 500 for large breaches and an example Texas rule (250 residents, 30 days) that counsel must confirm. `settings-typo.json` misspells a setting and is refused.
- `phi-canaries.json`: names that must never appear in results.
