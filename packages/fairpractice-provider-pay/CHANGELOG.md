# Changelog

Renamed from `condor-of-provider-pay` on 18 Nov 2026 (tool names were `condor_*`, now `providerpay_*`).

## 0.1.0 (unreleased)

- First version (Fairpractice ver 1).
- Final pass (19 Nov 2026), from the real CMS RVU file: the RVU code column is the field `hcpcs` (HCPCS read before "Code"), because the field named `code` took the file's STATUS "CODE" column; with the shared core keeping the first of two same-named "RVU" columns, the work RVU is read, not the malpractice RVU. A test reads a CMS-shaped file.
- Final pass (19 Nov 2026): provider and staff names are masked before results reach the model, as the limits text says (they were sent as written); the eval that compared a name expects a pseudonym, and the names are in the masking canaries.
