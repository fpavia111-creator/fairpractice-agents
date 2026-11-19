# Changelog

Renamed from `stork-of-attribution` on 18 Nov 2026 (tool names were `stork_*`, now `attribution_*`).

## 0.1.0 (unreleased)

- First version (Fairpractice ver 1).
- Final pass (19 Nov 2026): a fixture NPI turned out to belong to a real provider in NPPES; replaced with 1000000178, which is not issued.
- Final pass (19 Nov 2026): provider and staff names are masked before results reach the model, as the limits text says (they were sent as written); the eval that compared a name expects a pseudonym, and the names are in the masking canaries.
