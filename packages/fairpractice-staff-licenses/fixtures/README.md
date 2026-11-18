# Fixtures

Fictional data only: Bluewater Regional (a made-up hospital) and made-up staff. Any likeness to real people is chance.

- `credentials.csv`: one row per license or certificate. Planted: an RN license that expired on 2026-10-31 with three shifts worked after it (N202), a BLS card that expired in September (N203), an RN license expiring in December (N203), a single-state California license for a nurse working in Texas (N204), an LVN license never verified (N205), a BLS card last verified in February 2025 (N201) and a respiratory therapist with no BLS (R301).
- `roster.csv`: active staff with work state; the terminated nurse is skipped.
- `shifts.csv`: shifts worked in October and November.
- `settings.json`: required credentials per role, 60-day warning, yearly re-verification, the compact states the hospital relies on (example only; check the current member list) and which credentials are state licenses. `settings-typo.json` misspells a setting and is refused.
