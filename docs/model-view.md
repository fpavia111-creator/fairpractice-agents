# What reaches the AI model (Fairpractice, wave 1)

Written by `npm run model-view` on 2026-11-19 from each agent's own column definitions and the core masker (`fairclaim-core/src/phi.js`) in its default mode (`--phi mask`). Every tool result, error and approval request passes through the masker before it leaves the agent. The checks themselves read the real values on your computer; only what is returned is masked.

- **Masked:** patient names, patient numbers and MRNs, account and encounter numbers, member and policy numbers (stable pseudonyms such as `PT-3f2a9c1d`, `MRN-…`, `ACCT-…`, `MBR-…`); staff and provider names in the columns the agents read as people (rendering providers, therapists, physicians under contract, caregivers, employees in the training, health and licence files, people screened for exclusions, reviewers); birth dates cut to the year; phones, e-mails, addresses and SSNs (placeholders). A masked value is also replaced wherever it appears inside other text in the same result.
- **Sent as they are:** NPIs, claim, request, invoice, referral, message and audit numbers (claim numbers are pseudonymised with `--phi strict`), CPT, HCPCS, NDC, revenue and diagnosis codes, dates (cut to the month with `--phi strict`), amounts and counts, and business names (payers, vendors, law firms, review platforms). Risk owners and the person who accepted a risk in the security risk analysis are sent as written (usually a role such as "IT Lead", but a name if you type one); licence numbers and staff health results ("positive", "declined") go with a pseudonymised name.
- **Free text** (online review texts and draft replies, threats and plans in the risk register, denial, discharge and recoupment reasons, descriptions) is sent as written, with known names and SSN, e-mail and phone patterns replaced. Anything else a person typed there reaches the model: a review in which the writer names a condition, for example, which is what the review-reply agent looks for in draft replies.
- Results go to whatever model the user's AI assistant uses. For patient data, use a model your organisation has a business associate agreement with, or a local model, and consider `--phi strict`. A business associate agreement is required before any real patient file is held. No claim of HIPAA or any other compliance is made; masking is not de-identification under the HIPAA Safe Harbor or Expert Determination methods.
- The worklists and reports written on the user's computer keep the real values, for the people working them.

Agents with masked columns: 27 of 30. Agents with a free-text column: 7. Leak check: 3645 masked values looked for across 362 masked tool calls on the fixtures; **0 found in a result**.

Also: every agent's shared test runs every eval case and fails if a value in its `fixtures/phi-canaries.json` reaches a result.

| Agent | Masked | Ids and codes sent | Business names sent | Dates, amounts | Free text sent | Leak check |
| --- | --- | --- | --- | --- | --- | --- |
| aba-therapy | `patient_id` (pseudonym), `patient_name` (pseudonym), `provider` (pseudonym) | `start`, `end`, `cpt`, `provider_role`, `auth_number` | - | 1 dates, 3 amounts or counts | none | 96 checked, 0 leaked |
| attribution-roster | `member_id` (pseudonym), `patient_name` (pseudonym), `dob` (birth year), `provider` (pseudonym), `patient_id` (pseudonym) | `npi` | `payer` | 1 dates, 0 amounts or counts | none | 364 checked, 0 leaked |
| behavioral-health | `patient_id` (pseudonym), `patient_name` (pseudonym), `provider` (pseudonym) | `cpt`, `start`, `end`, `license` | `payer` | 1 dates, 3 amounts or counts | none | 88 checked, 0 leaked |
| breach-deadlines | none read | `incident_id`, `determination`, `states` | - | 6 dates, 1 amounts or counts | none | 0 checked, 0 leaked |
| business-associates | none read | `service`, `touches_phi`, `category` | `vendor` | 4 dates, 1 amounts or counts | none; names as written: `owner` | 0 checked, 0 leaked |
| capitation | `member_id` (pseudonym), `patient_name` (pseudonym) | `category`, `month` | - | 3 dates, 2 amounts or counts | none | 196 checked, 0 leaked |
| care-management | `patient_id` (pseudonym), `patient_name` (pseudonym) | `program`, `staff_type`, `cpt`, `other_practice_months` | - | 2 dates, 2 amounts or counts | none | 98 checked, 0 leaked |
| care-plan-hours | `client_id` (pseudonym), `client_name` (pseudonym) | `service`, `auth_number`, `clock_in`, `clock_out` | - | 3 dates, 3 amounts or counts | none | 56 checked, 0 leaked |
| caregiver-hours | `caregiver_id` (pseudonym), `caregiver_name` (pseudonym), `client_id` (pseudonym) | `clock_in`, `clock_out`, `live_in`, `sleep_interrupted` | - | 2 dates, 6 amounts or counts | none | 56 checked, 0 leaked |
| code-updates | `patient_id` (pseudonym), `patient_name` (pseudonym) | `code`, `code_set`, `action`, `replacement`, `active`, `order_set`, `claim_id`, `codes`, `diagnoses` | `payer` | 2 dates, 2 amounts or counts | `description` | 24 checked, 0 leaked |
| compliance-training | `person_id` (pseudonym), `name` (pseudonym) | `course`, `role`, `work_state`, `status` | `department` | 2 dates, 0 amounts or counts | none | 172 checked, 0 leaked |
| evv-claims | `client_id` (pseudonym), `client_name` (pseudonym), `caregiver_id` (pseudonym), `caregiver_name` (pseudonym) | `clock_in`, `clock_out`, `service`, `location_ok`, `manual` | - | 1 dates, 4 amounts or counts | none | 126 checked, 0 leaked |
| exclusion-screening | `id` (pseudonym), `name` (pseudonym), `dob` (birth year), `last_name` (pseudonym), `first_name` (pseudonym), `middle_name` (pseudonym) | `type`, `npi`, `exclusion_type`, `state`, `source` | `business_name` | 3 dates, 0 amounts or counts | none | 656 checked, 0 leaked |
| home-health | `patient_id` (pseudonym), `patient_name` (pseudonym) | `admission`, `discipline` | `payer` | 4 dates, 2 amounts or counts | none | 75 checked, 0 leaked |
| hospice-billing | `patient_id` (pseudonym), `patient_name` (pseudonym) | `f2f` | - | 4 dates, 3 amounts or counts | `discharge_reason` | 88 checked, 0 leaked |
| injury-liens | `patient_id` (pseudonym), `patient_name` (pseudonym) | `case_id`, `state`, `status`, `suit_filed` | `attorney` | 4 dates, 3 amounts or counts | none | 77 checked, 0 leaked |
| physician-contracts | `physician` (pseudonym) | `contract_id`, `npi`, `type`, `time_log_required`, `time_log` | - | 4 dates, 4 amounts or counts | none | 89 checked, 0 leaked |
| primary-care-apcm | `patient_id` (pseudonym), `patient_name` (pseudonym) | `qmb`, `tier`, `cpt` | - | 4 dates, 2 amounts or counts | none | 107 checked, 0 leaked |
| provider-pay | `provider` (pseudonym), `patient_id` (pseudonym), `patient_name` (pseudonym) | `cpt`, `modifiers`, `hcpcs`, `modifier` | - | 1 dates, 2 amounts or counts | none | 84 checked, 0 leaked |
| records-requests | `patient_id` (pseudonym), `patient_name` (pseudonym) | `request_id`, `requester_type`, `format`, `extended`, `denied` | - | 4 dates, 3 amounts or counts | `denial_reason` | 192 checked, 0 leaked |
| recoupments | `patient_id` (pseudonym), `patient_name` (pseudonym) | `claim_ref`, `check`, `claim_id` | `payer` | 4 dates, 2 amounts or counts | `reason` | 78 checked, 0 leaked |
| remote-monitoring | `patient_id` (pseudonym), `patient_name` (pseudonym) | `interactive`, `cpt` | - | 3 dates, 2 amounts or counts | none | 84 checked, 0 leaked |
| review-replies | `reviewer` (pseudonym) | `review_id` | `platform` | 0 dates, 1 amounts or counts | `review`, `reply` | 48 checked, 0 leaked |
| secondary-claims | `patient_id` (pseudonym), `patient_name` (pseudonym) | `claim_id`, `order`, `eob_attached` | `payer` | 5 dates, 3 amounts or counts | none | 84 checked, 0 leaked |
| security-risk-analysis | none read | `risk_id`, `asset`, `likelihood`, `impact`, `rating`, `status`, `holds_phi`, `item`, `required` | - | 2 dates, 0 amounts or counts | `threat`, `plan`; names as written: `owner`, `accepted_by` | 0 checked, 0 leaked |
| staff-health | `person_id` (pseudonym), `name` (pseudonym) | `role`, `item`, `result`, `declined`, `form_on_file`, `status` | `department` | 3 dates, 0 amounts or counts | none | 204 checked, 0 leaked |
| staff-licenses | `person_id` (pseudonym), `name` (pseudonym) | `role`, `credential`, `number`, `state`, `compact`, `work_state`, `status` | `department` | 3 dates, 0 amounts or counts | none | 210 checked, 0 leaked |
| surprise-billing-disputes | `patient_id` (pseudonym), `patient_name` (pseudonym) | `claim_id`, `cpt` | `payer` | 4 dates, 5 amounts or counts | `outcome` | 110 checked, 0 leaked |
| therapy-billing | `patient_id` (pseudonym), `patient_name` (pseudonym), `provider` (pseudonym) | `cpt`, `modifiers`, `provider_role`, `discipline` | `payer` | 4 dates, 3 amounts or counts | none | 108 checked, 0 leaked |
| wound-products | `patient_id` (pseudonym), `patient_name` (pseudonym) | `cpt`, `modifiers`, `product`, `lot`, `invoice` | - | 1 dates, 7 amounts or counts | none | 75 checked, 0 leaked |
