---
description: Run the code-quality workflow on the course API — parallel review and test-gap analysis, then targeted tests.
argument-hint: "[path inside course-api, default: whole course-api/]"
---

Run the course-quality workflow on: $ARGUMENTS

If no path was given, the scope is the whole `course-api/` directory (`server.js`, `routes/`,
`db/store.js`, `tests/`). Use the same scope for every step below.

## Step 1 — review and gap analysis, in parallel

Launch these two subagents **in a single message, as two tool calls**, so they run at the
same time. They are independent: both only read the same code, and neither needs the
other's answer.

- **code-reviewer** — review the scope for bugs and convention violations; return findings
  with `path:line`.
- **test-gap-finder** — map the routes in the scope against `course-api/tests/`; return the
  table of uncovered cases.

Wait until **both** have returned before going on. If one of them fails, report that and stop —
do not run Step 2 on half the input.

## Step 2 — write the tests (depends on Step 1)

Launch the **test-writer** subagent once. Its prompt must contain, verbatim:

1. the full table of uncovered cases from test-gap-finder;
2. every finding from code-reviewer with severity `bug` or `convention`, each as a case to
   test for the **expected** behaviour.

Tell it the scope and that it must not change production code. This step cannot start
earlier: what it writes is decided entirely by the two Step 1 reports.

## Step 3 — summary for the user (depends on Step 2)

Do not launch another agent. Reply with:

- **Findings** — the reviewer's list, unchanged, most severe first.
- **Tests added** — files and test titles from test-writer.
- **Test run** — the real `npm test` / `npm run lint` output test-writer reported, or the
  reason it could not run. Never write that tests pass unless that output shows it.
- **Open bugs** — tests that fail because of production code, one line each, with the
  reviewer finding they confirm.

Do not fix production code in this command. If the user wants a fix, that is a separate
request.
