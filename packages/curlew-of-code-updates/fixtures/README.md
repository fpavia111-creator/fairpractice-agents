# Fixtures

Invented data only. The codes starting with ZZ are made up so that no real CPT, HCPCS or ICD-10 content is shipped; they are not real codes or real changes. Patients are fictional.

- `code-changes.csv`: an invented update. Planted against the practice files:
  - Open claim OC-1 (service October 15) uses diagnosis ZZ9.01, deleted from October 1. OC-2 (September 20) is before the change and is fine.
  - ZZ101 and ZZ102 are active on the chargemaster and deleted January 1; ZZ201 is deleted too but already inactive.
  - The "Diabetes follow-up" order set uses ZZ101 and ZZ9.01.
  - ZZ102 is on two payers' fee schedules.
  - New codes ZZ111 (on the chargemaster with no price), ZZ112 and ZZ113 replace codes in use and need a price.
  - ZZ105 is revised.
