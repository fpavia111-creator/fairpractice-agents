# Fixtures

Fictional data only: Bluewater Family Medicine (a made-up practice) and its made-up systems.

- `risk-register.csv`: Planted: an open high risk past its date (R-01), a high risk with no owner (R-02), a high risk with no plan (R-03), a risk due within 30 days (R-04), an accepted risk nobody signed (R-05) and a closed risk (R-06).
- `assets.csv`: USB drives on the billing workstation hold patient data but are not in the register.
- `evidence.csv`: an EHR access review older than a year and policies never reviewed; the optional penetration test is not required.
- `settings.json`: last full analysis 2025-09-30 (so it is overdue), yearly interval, 30-day warning, high at a 4 x 3 score. `settings-typo.json` misspells a setting and is refused.
