# Fixtures

Fictional data only: a made-up out-of-network emergency group, patients and payers. Any likeness to real people is chance.

- `disputes.csv`. Planted (as of November 15, 2026):
  - ER-1001: negotiation ended October 2 and the 4-business-day IDR window closed October 8 with no IDR.
  - ER-1002: open negotiation had to start by October 15 and was never sent.
  - ER-1003: negotiation ended November 10; IDR must start by November 17.
  - ER-1004: open negotiation must start by November 27.
  - ER-1005: paid 400 against a QPA of 900.
  - ER-1006: 40 in dispute against about 465 in fees.
  - ER-1007 and ER-1008: two Cedar Mutual 99291 claims in negotiation that may be batched.
  - ER-0901 (won) and ER-0902 (lost) give outcomes and fees by payer.
- `settings.json`: 30 and 4 business days, a 10-day warning, a 115 administrative fee and a 350 example entity fee. `settings-typo.json` misspells a setting and is refused.
