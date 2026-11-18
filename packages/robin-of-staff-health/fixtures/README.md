# Fixtures

Fictional data only: Bluewater Regional (a made-up hospital) and made-up staff. Any likeness to real people is chance. Results are flags only; the agent never reads them as health information.

- `roster.csv`: active staff with hire dates; the terminated nurse is skipped and the lab tech starting 2026-12-01 shows a TB test due before the first day.
- `health-records.csv`: Planted: a fit test past its year (H101), a TB test coming due within 30 days (H102), a flu declination with no signed form (H102), a TB result flagged for follow-up with no follow-up date (H103), last season's flu shot only (H103), a nurse hired 2026-11-02 with no TB test, flu or fit test (H104) and a CNA with every item current (H105).
- `settings.json`: yearly TB (before the first day), seasonal flu (August to November 1, declination allowed) and yearly fit tests for RNs and respiratory therapists. `settings-typo.json` misspells a setting and is refused.
