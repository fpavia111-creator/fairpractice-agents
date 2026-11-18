# Fixtures

Fictional data only: Bluewater Family Medicine (a made-up practice) and made-up staff. Any likeness to real people is chance.

- `roster.csv`: active staff in Texas and Oklahoma; the terminated front-desk worker is skipped.
- `lms-completions.csv`: Planted: an HB 300 refresher due within 30 days (T101), a new hire with fraud-and-abuse and HB 300 not due until late November (T102), an Oklahoma worker whose HIPAA refresher is overdue and who needs no HB 300 (T103), a physician with every course current, the course name written differently (T104), and a new hire with nothing done 45 days after hire, so HIPAA is late (T105).
- `settings.json`: HIPAA yearly (30 days for new hires), fraud waste and abuse yearly (90 days), HB 300 every two years for Texas staff (90 days). These are examples; your policy sets the real numbers. `settings-typo.json` misspells a setting and is refused.
