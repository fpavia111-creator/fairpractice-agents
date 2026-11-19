# Real public data through Fairpractice (wave 1)

Written by `npm run realdata` (scripts/realdata.mjs) on 2026-11-19. The public files are downloaded by `npm run realdata:download` into `_realdata/`, which git ignores; they are not in the repo, and no name from them is copied here. Staff lists and charges placed next to them are the fixtures or made up by the script.

## OIG LEIE: fairpractice-exclusion-screening

Source: [OIG List of Excluded Individuals/Entities (LEIE), full file](https://oig.hhs.gov/exclusions/exclusions_list.asp) (file: https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv; licence: Public data from HHS-OIG (US government work)).

- The full file as published: 84,224 entries (dates as YYYYMMDD, zeros for blanks), 79,818 individuals with a birth date.
- 500 listed individuals entered as if they were staff (name and birth date as the LEIE has them; 61 with an NPI): **500 of 500 flagged** as an NPI or name-and-birth-date match ({"npi_match":63,"confirmed_match":440,"dob_differs":13}). 2,898 ms.
- 1,000 made-up staff built from the 40 most common first names and 25 most common last names, with made-up birth dates (a worst case for name collisions): 529 findings {"possible_match":9,"near_name":74,"dob_differs":446}; 6,029 near-name pairs with a different birth date on both sides counted and not listed. **Before the fix this run led to: 6,357 findings, 5,902 of them near names** of real excluded people with other birth dates. Exact-name matches with a different birth date are still listed (446 here), so the compliance officer can note the check; near names with no birth date to compare stay listed (74). 3,292 ms.

## Nevada Medicaid sample 835: fairclaim-core 835 reader

Source: [Nevada Medicaid sample 835 file](https://www.medicaid.nv.gov/) (file: https://www.medicaid.nv.gov/Downloads/provider/Sample_835_File.pdf; licence: Public sample published by Nevada Medicaid (state government); sample data, no real patients).

- Text taken from the PDF (pdftotext -layout), page lines dropped, 67 segments, 3 transactions, 1 reader problem(s) (a control count that the PDF layout breaks).
- **The 1812.27 check made only of provider-level adjustments (PLB, no claims) is in the payments**, with its PLB lines summing to -1812.27. No wave-1 agent posts ERAs; the ERA-matching bug other families found is in an agent that builds checks from claims only, not in this reader.

## CMS physician fee schedule RVU file (January 2026): fairpractice-provider-pay

Source: [CMS physician fee schedule relative value file, January 2026 (RVU26A)](https://www.cms.gov/medicare/payment/fee-schedules/physician/pfs-relative-value-files) (file: https://www.cms.gov/files/zip/rvu26a.zip; licence: Public CMS data (US government work); CPT descriptors in it are AMA copyright and are not used or copied here).

- The CSV as published: 19,237 lines, column names on row 10 under title rows, a STATUS column headed "CODE" and two columns headed "RVU" (work and malpractice).
- **Before the fixes: every code came back "no RVU"** (the agent's own field name `code` took the STATUS "CODE" column), then, with that fixed, work RVUs read from the malpractice column (Rhea Lin 84.9 wRVUs instead of about 1,170), because the core kept the last of two same-named columns. Fixed in the agent (the field is `hcpcs`, HCPCS first) and in fairclaim-core (a repeated column name keeps the first column).
- After: fixture charges priced with the real file: {"no_provider":1,"draw_over_earned":1,"true_up_owed":2}, 2562.2 wRVUs (Rhea Lin MD 1174.1, June Park NP 712, Sam Otto DO 676.1); with the fixture's rounded example file: 2544 wRVUs. No code missing from the real file.

## Agents with no public data in their real format

The other 28 agents read files private to a practice or agency (sessions, authorizations, rosters, claims, time logs, payroll, EVV visits, incident logs, vendor lists, training and health records, credentials, contracts and payments, lien cases, disputes, reviews, risk registers, care plans, recoupments). No public file in those layouts was found. Two public sources come close and were not used in this pass: the HHS breach portal (breaches of 500 or more, not an incident log) and state licence lookups (credential status, not a hospital credential file; the Fairclinic pass used Washington's). SAM.gov exclusions need an API key and were not used.
