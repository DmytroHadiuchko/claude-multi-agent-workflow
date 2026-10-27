# course-quality — notes

## What the plugin does

`course-quality` is a code-quality plugin for the Express API in `course-api/`.

| Piece | Name | What it does |
|---|---|---|
| Command | `/course-quality:quality [path]` | Runs the whole workflow below |
| Subagent | `course-quality:code-reviewer` | Read-only review: bugs and convention violations with `path:line` |
| Subagent | `course-quality:test-gap-finder` | Read-only map of routes vs tests: table of uncovered cases |
| Subagent | `course-quality:test-writer` | Writes tests for those cases, runs `npm test` and `npm run lint` |
| Skill | `course-quality:course-api-conventions` | The API's route and test rules as a checklist |
| Hook | `PostToolUse` on `Edit\|Write` | Lints an edited `course-api/**/*.js` file with the project's ESLint |

The workflow never changes production code: bugs come back as findings and as failing tests.

## Install

Prerequisites: Node.js 18+ and `cd course-api && npm install` (the hook and the test-writer
use the project's own ESLint and test runner).

Try it from a checkout, without installing:

```bash
claude --plugin-dir .
# inside the session
/course-quality:quality
```

Install it as a marketplace plugin:

```text
/plugin marketplace add DmytroHadiuchko/claude-multi-agent-workflow
/plugin install course-quality@dmytro-plugins
```

After editing plugin files in a running session, use `/reload-plugins`.

## Scoping decision — who gets which tools and model

The two analysis agents get `Read, Grep, Glob` only. Their job is to look and report;
without `Edit`, `Write` or `Bash` a reviewer cannot "helpfully" fix the code it is
reviewing, and it cannot run anything with side effects. That also means everything it
reports is traceable to a line it read.

`Bash` exists in exactly one place — `test-writer` — because it is the only agent that
must run `npm test` and `npm run lint` to prove its work. It also gets `Edit` and `Write`,
but its prompt restricts it to `tests/`.

Models follow difficulty, not importance:

- `test-gap-finder` runs on **haiku**: listing routes and tests and diffing two lists is
  mechanical, and it runs on every invocation, so the cheap model pays off.
- `code-reviewer` runs on **sonnet**: deciding that `/users/abc` returning `404` instead of
  `400` is a defect needs judgment.
- `test-writer` runs on **sonnet**: it has to write tests that compile, match the existing
  style and assert the right thing.

## Orchestration decision — parallel vs sequential

**Step 1 is parallel** (`code-reviewer` + `test-gap-finder`): both read the same code and
neither needs the other's output, so running them one after the other would only add
wall-clock time. The command tells Claude to launch them in one message so they really
start together.

**Step 2 is sequential** (`test-writer`): what it writes is defined by both Step 1
reports — the uncovered cases from the gap finder and the bugs from the reviewer, each
turned into a test for the expected behaviour. Starting it earlier would mean writing
tests blind, so it waits for both, and the command stops if either report is missing.

**Step 3** (summary) depends on Step 2 and is done by the main session, not by another
agent: it only assembles reports, and it must quote the real test output instead of
claiming a pass.
