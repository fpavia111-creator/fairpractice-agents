# Fixtures

Fictional data only: a made-up hospice, made-up patients. Any likeness to real people is chance.

- `census.csv`. Planted:
  - H1: elected November 2, NOE filed November 10 (due November 7), so 8 days are not covered.
  - H2: elected November 6 with no NOE on file (due November 11).
  - H3: revoked November 3 with no NOTR (due November 8).
  - H4: benefit period 4 started September 7 with no face-to-face encounter in the 30 days before.
  - H5: transferred in at period 3; period 4 starts December 24, so a face-to-face is coming due.
  - Cap year October 2025 to September 2026: five new elections (H3, H4, H6, H7, H8) and 205,000 paid against an estimated 176,807.20 cap.
  - Live discharges: 2 of the 4 discharges in the last 12 months (H3, H8) were live.
- `settings.json`: an example cap amount of 35,361.44 per beneficiary (check the CMS figure for your cap year), cap year 2026, routine home care at 220 a day for the late-notice dollars, and a 20% live-discharge flag. `settings-typo.json` misspells a setting and is refused.
