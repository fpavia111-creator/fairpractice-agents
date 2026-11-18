# Fixtures

Fictional data only: a made-up primary care practice, made-up patients. Any likeness to real people is chance.

- `apcm-enrolled.csv` and `claims-2026-10.csv` for October 2026. Planted:
  - N1: three chronic conditions but billed G0556 (the record points to G0557).
  - N2: G0557 and 99490 (chronic care management) in the same month.
  - N3: G0557 with no consent on file.
  - N4: G0557 billed twice in October.
  - N5: G0556 billed for a patient not on the APCM list.
  - N6: enrolled and consented as QMB, nothing billed (G0558 expected).
  - N7: G0558 with an office visit the same month is fine. N8 left the program in August and is not expected.
- `settings.json`: example rates. `settings-typo.json` misspells a setting and is refused.
