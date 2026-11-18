# fairpractice-core

Shared helpers for the Fairpractice medical practice agents (sold as **Fairpractice** on [fair-agents.com](https://fair-agents.com/fairpractice.html)). It re-exports [`fairclaim-core`](../fairclaim-core) (masking of patient and staff identifiers, policy and approvals, audit log, MCP server, evals) and adds what practice back offices need:

- **Agent builder:** `medAgent` with `KESTREL_LIMITS` and the shared argument shapes `fileArg`, `DATE_ARG`, `MONTH_ARG`, `AS_OF_ARG`.
- **Column names** for common practice exports: `PATIENT_ID`, `PATIENT_NAME`, `STAFF_ID`, `STAFF_NAME`, `PROVIDER`, `NPI`, `PAYER`, `CLAIM_ID`, `CPT`, `MODIFIER_COL`, `UNITS`, `MINUTES`, `DOS`, `CHARGE`, `PAID`, `AMOUNT`, `DEPARTMENT`, `ROLE`, `HIRE_DATE`, `STATUS`.
- **Dates and clocks:** `federalHolidays`, `isBusinessDay`, `addBusinessDays`, `businessDaysBetween`, `weekOf`, `monthBounds`, `monthOf`, `dueStatus`, `clockMinutes`, `spanMinutes`, `durationMinutes`.
- **Matching and money:** `personKey`, `personSimilarity`, `codeKey`, `rateFor`, `ageDays`, `agingBucket`, `total`, `countBy`.
- **Demos:** `runDemo` for the `demo` command every agent has.

Administrative and financial checks only: no diagnosis, no treatment advice, and nothing reads clinical notes. Masking keeps identifiers away from the model; it is not a HIPAA compliance determination.

MIT. Node 20 or newer.
