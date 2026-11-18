# Fixtures

Fictional data only: a made-up home care agency, caregivers and clients. Any likeness to real people is chance. The settings are examples, not any state's law.

- `shifts.csv` and `payroll.csv` for the week of November 2, 2026. Planted:
  - Ana Ruiz: two clients a day with 20 minutes between them, Monday to Friday: 45 hours of shifts plus 1.67 hours of travel. Payroll paid 40 regular and 5 overtime, missing the travel.
  - Bo Chen: a 6.5-hour shift with no meal break (meal rule set at 5 hours).
  - Cy Ames: two shifts with a 4-hour unpaid gap (split shift).
  - Di Park: a 24-hour live-in shift with 10 hours of sleep recorded; only 8 may be left unpaid, so 2 count back as worked. Payroll paid 13 hours, short of the 15 worked.
- `settings.json`: 40-hour week from Monday, 60-minute travel window, a 16.50 split premium, a meal break after 5 hours, an 8-hour sleep cap. `settings-typo.json` misspells a setting and is refused.
