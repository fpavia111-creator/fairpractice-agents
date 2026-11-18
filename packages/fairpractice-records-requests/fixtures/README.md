# Fixtures

Fictional data only: Bluewater Family Medicine (a made-up practice) and made-up patients. Any likeness to real people is chance.

- `access-requests.csv`: Planted: a request answered in 11 days (AR-1001, clean), paper copies sent 8 days late and charged 25.00 against an allowed 15.00 (AR-1002), an open request 15 days past due (AR-1003), an extension whose notice went out after the first 30 days and 10 paper pages charged 8.00 against an allowed 7.50 (AR-1004), a request due within 7 days (AR-1005), a denial with no reason or date recorded (AR-1006), an email copy charged 15.00 against the 6.50 flat fee (AR-1007) and a new request not due yet (AR-1008).
- `settings.json`: 30 days plus one 30-day extension, a 6.50 flat fee for electronic copies, paper at 5.00 plus 0.25 a page, capped at 50. These are examples; use your policy and state law. `settings-typo.json` misspells a setting and is refused.
