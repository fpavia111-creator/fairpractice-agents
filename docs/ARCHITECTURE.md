# Fairpractice architecture

```
fairclaim-core  (shared runtime: file reading, column matching in 9 languages, PHI masking,
              policy and approvals, audit log, memory, MCP stdio server, reports, eval runner)
     |
fairpractice-core (medAgent builder, practice column names, business days with federal holidays,
              month/week helpers, clock and duration minutes, name/code/id matching, sorting)
     |
<bird>-of-<job> x 30
   src/logic.js     pure functions, no I/O: rows in, findings out
   src/manifest.js  tools, sources (columns), settings schema, refused tools, report layout
   src/demo.js      the demo run on fixtures/
   fixtures/        fictional data with planted problems, phi-canaries.json, a typo settings file
   evals/cases.json deterministic eval cases (no model is called)
   test/            domain tests (logic), shared tests (masking, report, MCP), contract tests
```

## A call, start to end
1. The model calls `<prefix>_check` with file paths and settings paths, relative to the `--root` folder. Paths outside the root are refused.
2. fairclaim-core reads each file (CSV, TSV, xlsx, JSON, JSONL), matches columns by name in any of nine languages, converts dates and amounts, and refuses misspelled settings by name.
3. `logic.js` runs on the real values and returns findings with a status, amount, message and fix.
4. Before the result goes back to the model, patient and staff names become stable pseudonyms, ids become `MRN-…`/`ACCT-…`, e-mails and phones are removed, also inside free text and with junk characters in front.
5. `<prefix>_write_report` writes a CSV worklist (owner and decision columns) and an HTML report with real names, for staff, to the output folder. Drafts that could be sent need one named click tied to the sha256 of the draft.
6. Every call is written to the audit log. Tools not in the manifest, and the refused live actions, are blocked.

## Adding an agent
Add a line to `scripts/agents.json`, run `node scripts/new-agent.mjs`, write `logic.js`, `manifest.js`, `demo.js` and fixtures, add domain tests and eval cases, then `npm test`, `npm run check`, `npm run hostile` and `npm run readme`.
