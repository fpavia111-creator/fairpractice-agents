# Settings and dated rules (Fairpractice, wave 1)

Written by `npm run settings-list` on 2026-11-19 from each agent's settings schema. Every number below is a named setting: a customer changes it in the settings JSON file the agent is given (`settings` argument; a misspelt key is refused, so a typo cannot silently fall back to a default). Nothing changes by itself when a rule changes.

**Who maintains them:** the customer confirms each dated default with their compliance lead or counsel at setup and keeps their own settings file. Mythos Machines changes a default only in a new release with a changelog line, and checking the dated defaults below against their sources is part of the support plan. No rule here is legal, billing or compliance advice.

## Dated defaults

| Agent | Setting | Default | Source (summary) | Checked |
| --- | --- | --- | --- | --- |
| breach-deadlines | `notice_days` | 60 days | HIPAA Breach Notification Rule: individuals without unreasonable delay and no later than 60 days after discovery (45 CFR 164.404(b)) | 19 Nov 2026 |
| breach-deadlines | `large_threshold` | 500 | Same rule: media and HHS notice within 60 days for breaches of 500 or more (45 CFR 164.406, 164.408); smaller breaches go on the yearly HHS log within 60 days after year end | 19 Nov 2026 |
| breach-deadlines | `state_rules` | example: TX, 250 residents, 30 days | State attorney general rules (the example follows Texas Business and Commerce Code 521.053 as amended in 2023); each state differs and counsel confirms them | 19 Nov 2026 |
| caregiver-hours | `ot_hours` | 40 | FLSA overtime after 40 hours a week, home care workers covered since the 2015 Home Care Rule (29 CFR 552); states may add daily rules | 19 Nov 2026 |
| caregiver-hours | `max_travel_minutes` | 60 | Travel between clients during the workday is hours worked (29 CFR 785.38); the 60-minute window is an example | 19 Nov 2026 |
| caregiver-hours | `sleep_cap_minutes` | 480 | Up to 8 hours of sleep may be left unpaid on a 24-hour shift when the conditions are met (29 CFR 785.22) | 19 Nov 2026 |
| exclusion-screening | `screening_interval_days` | 31 days | Monthly checks of the OIG LEIE (OIG guidance) and the state Medicaid lists many states require | 19 Nov 2026 |
| home-health | `noa_days` | 5 days | Notice of admission within 5 calendar days from the start of care, from 2022 (42 CFR 484.205(j)) | 19 Nov 2026 |
| home-health | `lupa_default` | 2 | Low-utilization thresholds of 2 to 6 visits by case-mix group under the home health PDGM; your periods carry their own threshold | 19 Nov 2026 |
| hospice-billing | `cap_amount` | none (your cap year; fixture example 35,361.44) | CMS hospice aggregate cap per beneficiary, published each year in the hospice wage index final rule | 19 Nov 2026 |
| hospice-billing | `noe_days` | 5 days | Notice of election within 5 calendar days after the election (42 CFR 418.24(b)(2)) | 19 Nov 2026 |
| hospice-billing | `notr_days` | 5 days | Notice of termination or revocation within 5 calendar days (42 CFR 418.26(e)) | 19 Nov 2026 |
| hospice-billing | `f2f_window` | 30 days | Face-to-face encounter no more than 30 days before the third and later benefit periods (42 CFR 418.22(a)(4)) | 19 Nov 2026 |
| primary-care-apcm | `conflict_codes` | CCM, PCM, TCM codes | Advanced primary care management (G0556 to G0558) from 2025, not billed in the same month as those services (CMS 2025 physician fee schedule final rule) | 19 Nov 2026 |
| provider-pay | `modifier_pct` | 50: 150, 51: 50, 62: 62.5, 80/82/AS: 16 | Medicare payment adjustments for bilateral, multiple, co-surgeon and assistant-at-surgery modifiers (Medicare Claims Processing Manual ch. 12) | 19 Nov 2026 |
| records-requests | `response_days` | 30 days | HIPAA right of access: act within 30 days of the request (45 CFR 164.524(b)(2)); some states are shorter | 19 Nov 2026 |
| records-requests | `extension_days` | 30 days | Same rule: one 30-day extension with a written notice inside the first 30 days | 19 Nov 2026 |
| records-requests | `flat_fee` | your setting (fixture: 6.50) | HHS guidance (2016) describes a flat fee of up to $6.50 for electronic copies as one option | 19 Nov 2026 |
| staff-licenses | `compact_states` | example list | Nurse Licensure Compact member states change; the example list must be checked against the current NCSBN list | 19 Nov 2026 |
| surprise-billing-disputes | `negotiation_days` | 30 business days | No Surprises Act open negotiation: start within 30 business days of the initial payment or denial, and it lasts 30 business days (45 CFR 149.510(b)(1)) | 19 Nov 2026 |
| surprise-billing-disputes | `idr_days` | 4 business days | Same rule: federal IDR may start within 4 business days after open negotiation ends (45 CFR 149.510(b)(2)) | 19 Nov 2026 |
| surprise-billing-disputes | `admin_fee` | 115 | CMS administrative fee per party per dispute ($115 for disputes from 2025); CMS sets it by year | 19 Nov 2026 |
| therapy-billing | `kx_threshold` | 2410 | CMS KX modifier threshold for outpatient therapy; 2,410 is the 2025 figure, CMS publishes a new one each year (check the current year; not re-checked in this pass) | 19 Nov 2026 |
| therapy-billing | `sign_days` | 30 days | Plan of care certification by the physician or NPP within 30 days of the initial evaluation (Medicare Benefit Policy Manual ch. 15, 220.1.3) | 19 Nov 2026 |

## Every setting (116)

| Agent | Setting | What it is, with its default | Dated |
| --- | --- | --- | --- |
| aba-therapy | `unit_minutes` | Minutes in one unit; default 15 | - |
| aba-therapy | `supervision_pct` | Minimum supervision as a percent of technician direct time per client per month (certification and payer minimums vary); default 5 | - |
| aba-therapy | `direct_codes` | Codes for technician direct treatment; default 97153, 97154 | - |
| aba-therapy | `supervision_codes` | Codes that count as supervision when a BCBA bills them; default 97155 | - |
| aba-therapy | `qualified_only_codes` | Codes only a qualified professional may bill; default 97151, 97155, 97156, 97157 | - |
| aba-therapy | `rates` | Expected payment per unit by code, for dollar totals | - |
| aba-therapy | `warn_days` | Days ahead to warn about authorizations ending; default 30 | - |
| aba-therapy | `unused_pct` | Percent unused at which an ending authorization is listed; default 25 | - |
| attribution-roster | `lookback_months` | Months of visits that make a patient active; default 24 (contracts vary) | - |
| attribution-roster | `payer_words` | Words in the visit payer column that mean this contract's payer | - |
| attribution-roster | `pmpm` | Monthly payment per attributed member, to price patients left out or dropped | - |
| behavioral-health | `rates` | Expected payment by code, for dollar estimates | - |
| behavioral-health | `yearly_limits` | Sessions a year each payer allows per patient, by payer name | - |
| behavioral-health | `license_rules` | Licenses allowed to bill a code; a trailing * covers a code range. Replaces the default rules (prescriber codes and psychological testing). | - |
| breach-deadlines | `notice_days` | Days from discovery to notify individuals (HIPAA outer limit: 60; notify sooner when you can) | yes |
| breach-deadlines | `assess_days` | Your target days from discovery to a finished risk assessment; default 10 | - |
| breach-deadlines | `large_threshold` | People affected at which HHS and media notices are due within the notice window (HIPAA: 500) | yes |
| breach-deadlines | `warn_days` | Days ahead to warn; default 14 | - |
| breach-deadlines | `state_rules` | State attorney general notice rules you follow (example values; confirm with counsel) | yes |
| business-associates | `review_days` | Days between vendor security reviews; default 365 | - |
| business-associates | `warn_days` | Days ahead to warn about a BAA ending; default 60 | - |
| business-associates | `min_paid` | Smallest total paid to list a vendor missing from the inventory; default 0 | - |
| business-associates | `not_business_associates` | Vendors you have decided are not business associates (utilities, food, janitorial with no record access) | - |
| business-associates | `phi_service_words` | Words in a service description that suggest patient data (replaces the built-in list) | - |
| capitation | `rates` | Expected monthly rate by rate category, when the roster has no rate column | - |
| capitation | `tolerance` | Difference ignored as rounding; default 0.01 | - |
| care-management | `rates` | Expected payment by code, for dollar estimates | - |
| care-plan-hours | `weeks` | Full weeks to check, ending with the last full week on or before as_of; default 4 | - |
| care-plan-hours | `under_pct` | Percent short of authorized hours that counts as under-delivery; default 20 | - |
| care-plan-hours | `warn_days` | Days ahead to warn about plans ending; default 30 | - |
| care-plan-hours | `rates` | Hourly rate by service code, for dollar estimates | - |
| caregiver-hours | `ot_hours` | Weekly hours after which overtime is owed; default 40 | yes |
| caregiver-hours | `week_start` | First day of your workweek; default monday | - |
| caregiver-hours | `max_travel_minutes` | Same-day gaps between different clients up to this many minutes count as travel worked; default 60 | yes |
| caregiver-hours | `split_gap_minutes` | Longer unpaid gaps count as a split shift; default 60 | - |
| caregiver-hours | `split_premium` | Split-shift premium your state requires, per split; off when not set | - |
| caregiver-hours | `meal_after_hours` | Shifts longer than this need a meal break under your state rules; off when not set | - |
| caregiver-hours | `meal_minutes` | Length of the required meal break; default 30 | - |
| caregiver-hours | `sleep_cap_minutes` | Most live-in sleep time that may be left unpaid; default 480 | yes |
| compliance-training | `courses` | Required courses | - |
| compliance-training | `warn_days` | Days ahead to remind; default 30 | - |
| evv-claims | `unit_minutes` | Minutes in one billing unit; default 15 | - |
| evv-claims | `rounding` | How partial units count under your state rules; default midpoint (8 of 15 minutes) | - |
| evv-claims | `max_distance` | Distance from the client's address above which a visit is flagged, in the unit your EVV export uses | - |
| evv-claims | `max_manual_pct` | Share of a caregiver's visits entered or edited by hand above which to flag; default 10 | - |
| evv-claims | `min_visits` | Visits a caregiver needs before the manual-edit share is judged; default 3 | - |
| exclusion-screening | `near_name_threshold` | Name similarity (0.8-1) at which a different spelling is shown as a near-name match; default 0.92 | - |
| exclusion-screening | `screening_interval_days` | Days after which a person counts as not screened recently; default 31 (monthly) | yes |
| home-health | `noa_days` | Calendar days to file the notice of admission; default 5 | yes |
| home-health | `lupa_default` | Low-utilization threshold when a period has none; default 2 (thresholds run 2 to 6 by case-mix group) | yes |
| home-health | `per_visit_rate` | Average per-visit payment, to estimate the loss on a low-utilization period; default 0 | - |
| home-health | `warn_days` | Days before a period ends to warn about low visits; default 7 | - |
| hospice-billing | `cap_amount` | Per-beneficiary cap amount for the cap year (CMS publishes it each year); no cap check without it | yes |
| hospice-billing | `cap_year` | Cap year to check, named by the year it ends (2026 = October 1 2025 to September 30 2026); default the one holding as_of | - |
| hospice-billing | `cap_warn_pct` | Percent of the cap at which to warn; default 90 | - |
| hospice-billing | `daily_rate` | Routine home care daily rate, for dollars on late notices; default 0 | - |
| hospice-billing | `noe_days` | Calendar days to file the NOE; default 5 | yes |
| hospice-billing | `notr_days` | Calendar days to file the NOTR; default 5 | yes |
| hospice-billing | `f2f_window` | Days before a period starts that a face-to-face may happen; default 30 | yes |
| hospice-billing | `warn_days` | Days ahead to list face-to-face encounters coming due; default 45 | - |
| hospice-billing | `live_discharge_pct` | Live discharge rate over 12 months to flag; default 20 | - |
| injury-liens | `statute_years` | Filing window in years by state code, plus "default". You set these; Fairpractice Injury Liens does not know any state's law | - |
| injury-liens | `warn_days` | Days before the window ends to warn; default 60 | - |
| injury-liens | `pay_days` | Days after settlement to expect payment; default 30 | - |
| injury-liens | `stale_days` | Days without an update before a case is stale; default 90 | - |
| injury-liens | `max_reduction_pct` | Largest reduction your policy allows without sign-off; default 33 | - |
| physician-contracts | `fmv_hourly` | Your fair-market-value hourly range by arrangement type, from your valuation, e.g. {"medical director": {"low": 150, "high": 275}} | - |
| physician-contracts | `warn_days` | Days ahead to list contracts ending; default 60 | - |
| primary-care-apcm | `rates` | Expected payment by code, for dollar estimates | - |
| primary-care-apcm | `conflict_codes` | Codes not billed in the same month as APCM; replaces the default list (CCM, PCM, TCM) | yes |
| provider-pay | `tiers` | Default pay per wRVU by marginal tier: [{ "up_to": 1000, "rate": 45 }, { "rate": 52 }] | - |
| provider-pay | `providers` | Per-provider tiers and draws paid, by provider name | - |
| provider-pay | `modifier_pct` | Percent of the work RVU credited with a modifier, when the RVU file has no row for it; replaces the default (50: 150, 51: 50, 62: 62.5, 80/82/AS: 16) | yes |
| records-requests | `response_days` | Calendar days to answer (HIPAA: 30; some states are shorter) | yes |
| records-requests | `extension_days` | Days one extension adds (HIPAA: 30) | yes |
| records-requests | `warn_days` | Days ahead to warn; default 7 | - |
| records-requests | `flat_fee` | Flat fee you charge for electronic copies (HHS describes $6.50 as an option), or null | yes |
| records-requests | `per_page` | Per-page fee for paper copies under your policy or state law, or null | - |
| records-requests | `base_fee` | Fixed fee added to per-page fees (labor or search fee your state allows), default 0 | - |
| records-requests | `fee_cap` | Most you charge for one request, or null | - |
| recoupments | `appeal_days` | Days to appeal from the notice (or the recoupment if no notice), by payer name, plus "default" (default 120). Set from your contracts. | - |
| recoupments | `warn_days` | Days ahead to warn about an appeal window closing; default 21 | - |
| recoupments | `lookback_months` | Months after payment beyond which a recoupment is flagged (your state limit or contract); off when not set | - |
| recoupments | `notice_lead_days` | Days of notice required before a recoupment; default 0 (any notice before it) | - |
| remote-monitoring | `rates` | Expected payment by code, for dollar estimates | - |
| review-replies | `practice_name` | Name to sign replies with | - |
| review-replies | `contact_phone` | Office manager phone (or email) to move complaints offline | - |
| review-replies | `low_rating` | Ratings at or below this need a reply; default 2 | - |
| review-replies | `extra_phrases` | More phrases that confirm a visit in your specialty | - |
| review-replies | `extra_words` | More health words to flag | - |
| secondary-claims | `filing_days` | Days after the prior payer's adjudication to file with the next payer, by payer name, plus "default" (default 90). Set from your payer contracts. | - |
| secondary-claims | `warn_days` | Days ahead to warn about a filing window closing; default 21 | - |
| security-risk-analysis | `last_analysis` | Date the last full security risk analysis was finished | - |
| security-risk-analysis | `interval_days` | Days between full risk analyses and between evidence refreshes; default 365 | - |
| security-risk-analysis | `warn_days` | Days ahead to show risks coming due; default 30 | - |
| security-risk-analysis | `high_score` | Likelihood x impact score (1-5 scales) that counts as high; default 12 | - |
| staff-health | `requirements` | What each role must keep current | - |
| staff-health | `warn_days` | Days ahead to show items coming due; default 30 | - |
| staff-licenses | `required_by_role` | Credentials each role must hold, e.g. {"RN": ["RN License", "BLS"]} | - |
| staff-licenses | `warn_days` | Days before expiry to start warning; default 60 | - |
| staff-licenses | `verify_days` | Days after which a primary-source verification counts as stale; default 365 | - |
| staff-licenses | `compact_states` | Two-letter states in the license compact you rely on (check the current member list) | yes |
| staff-licenses | `state_licensed` | Credential names that are state licenses, so the work state is checked | - |
| surprise-billing-disputes | `negotiation_days` | Business days for open negotiation (to start it, and its length); default 30 | yes |
| surprise-billing-disputes | `idr_days` | Business days after negotiation ends to start IDR; default 4 | yes |
| surprise-billing-disputes | `warn_days` | Business days ahead to warn about the negotiation start deadline; default 10 | - |
| surprise-billing-disputes | `admin_fee` | Administrative fee per party per dispute for your year (check CMS); default 115 | yes |
| surprise-billing-disputes | `entity_fee` | Expected IDR entity fee, for judging low-value disputes; default 0 | - |
| surprise-billing-disputes | `qpa_gap_pct` | Percent below the QPA a payment must be to be listed; default 10 | - |
| surprise-billing-disputes | `holidays` | Extra non-business days (YYYY-MM-DD) beyond federal holidays | - |
| therapy-billing | `kx_threshold` | Yearly KX threshold amount for your year (CMS publishes it each year; check the current figure); default 2410 | yes |
| therapy-billing | `kx_payers` | Words in payer names the KX threshold applies to; default ["medicare"] | - |
| therapy-billing | `timed_codes` | Timed codes counted under the 8-minute rule | - |
| therapy-billing | `rates` | Expected payment per unit by code, used when the file has no allowed amount | - |
| therapy-billing | `sign_days` | Days after the plan start to have the certification signed; default 30 | yes |
| therapy-billing | `warn_days` | Days ahead to warn about plans of care ending; default 21 | - |

**Rules in the code, not in settings:** CPT and HCPCS time and day rules (care management 20 minutes for 99490 and its add-ons, remote monitoring 16 days for 99454 and 2 to 15 days for 99445 from 2026, 20 minutes for 99457, the 8-minute rule for timed therapy units, psychotherapy time ranges, ABA 15-minute units, the APCM tiers by chronic conditions and QMB status) are written into the `src/logic.js` of each agent from the 2026 code books and CMS rules as read on 18 November 2026. A customer cannot change them by settings; Mythos Machines changes them in a release with a changelog line when CPT or CMS changes them (usually each January).

Thresholds that are not dated (tolerances, warning days, look-back windows, name similarity) are working examples chosen for version 0.1.0 on 18 November 2026; each practice sets its own.
