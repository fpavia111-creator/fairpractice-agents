# Fixtures

Fictional data only: Bluewater Family Medicine (a made-up practice), made-up staff and vendors, and made-up list entries marked "(FICTIONAL)". Any likeness to real people or firms is chance. The real OIG and state files are public downloads; these only copy their layout.

- `people.csv`: staff, a provider, a contractor and vendors. Planted: an NPI on the list (E102), a name and birth-date match (E103), a name match with no birth date (E104), a near name with the same birth date (E105), same name but a different birth date (E106), a reinstated entry (E107), someone never screened (E108), someone last screened in August (E109) and a vendor on the state list (V201).
- `leie-2026-11.csv`: OIG LEIE layout (dates as YYYYMMDD, zeros for blanks).
- `state-medicaid-2026-11.csv`: a state list with different column names.
- `settings.json`: near-name threshold 0.9 and a 31-day screening interval. `settings-typo.json` misspells a setting and is refused.
