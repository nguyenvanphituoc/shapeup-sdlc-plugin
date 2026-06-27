# Expected harness output — `todo-cli` example

This file is the **smoke test of the plugin's stated purpose**: *guide an agent through Shape Up
to build anything, with (a) evaluation output and (b) edge cases handled.* A correct run on
`idea.md` must produce all three blocks below. Each is a concrete, checkable assertion — not vibes.

If a run cannot satisfy these, the harness has not met its goal **for a non-UI deliverable**, which
is exactly the "build *anything*" gap flagged in `docs/audit/independent-audit-and-evolution-plan.md`
(§4) and addressed by Stage G (the evaluation-contract abstraction).

---

## A. Shape Up shaping produced a linked doc tree with a Test Surface

A `ba-pitch-analyzer` run on this pitch must emit a doc tree under `docs/shapeup-sdlc/<slug>/`
containing:

- [ ] a domain model (entities: `Todo`, `Store`)
- [ ] use cases for `add`, `list`, `done`, `rm`
- [ ] **a `## Test Surface` section** with rows derived mechanically from the use cases
      (no invented acceptance criteria — the anti-invention rule)
- [ ] at least one `TS-INV-*` invariant row for the corruption/edge behavior

## B. Evaluation produced a verdict with cited evidence (the "evaluation output")

A `spec-evaluator` run on the built CLI must emit a report that:

- [ ] states a single verdict per criterion: **PASS** or **FAIL** (no "looks good", no "probably")
- [ ] cites concrete evidence for each verdict — for a CLI that means the **command run, its exit
      code, and its observed stdout/stderr**, e.g.
      `$ todo done 99  → exit 1, stderr "no item 99"  ⇒ PASS (graceful, non-zero, no stack trace)`
- [ ] FAILs any criterion where evidence is absent (absence of evidence = FAIL)

> Note: a CLI has no browser, so the evaluator does not drive Playwright here. Stage G (the
> evaluation contract) is fully landed: each criterion carries an `oracle` tag and the evaluator
> dispatches on it via the registry `scripts/oracles/index.mjs` (`process`/`test`/`snapshot`/`http`,
> with `ui` handled in-skill). For this CLI the oracle is **`process`** — the shared runner
> `scripts/oracles/process-oracle.mjs` spawns the deliverable and grades exit code + stdout.
> Run it directly: `node scripts/oracles/process-oracle.mjs examples/todo-cli/todo.contract.json "node ./reference/todo.js"`.

## C. Edge cases were hunted and handled (the "edge cases handled")

The build + `qa-edge-hunter` pass must demonstrate sane behavior on every edge below. These are
the assertions a process-level evaluator (or a human, today) checks:

| # | Edge | Command | Expected |
|---|------|---------|----------|
| E1 | empty list | `todo list` (no items) | exit 0, prints "no todos" (not a crash, not empty silence ambiguous with error) |
| E2 | bad index | `todo done 99` | exit ≠ 0, clear message, **no stack trace** |
| E3 | non-numeric index | `todo done abc` | exit ≠ 0, clear message |
| E4 | corrupted store | store file is `{garbage` | exit ≠ 0, message naming the file, **does not delete user data** |
| E5 | missing store | first ever run | creates store, exit 0 |
| E6 | done already-done item | `todo done <n>` twice | idempotent or clear "already done", never crash |

A run that builds `add/list/done/rm` but crashes on E2/E4 has **not** met the goal — "edge cases
handled" is a first-class acceptance criterion here, not a nice-to-have.

---

## How to run this example

This is a **fixture**, not an automated test (driving the full harness needs an interactive Claude
session). To exercise it:

```
# in a Claude Code session with the plugin installed, from a scratch dir:
# 1. shape it
/shapeup   examples/todo-cli/idea.md
# 2. analyze → doc tree + Test Surface
use the ba-pitch-analyzer skill on the pitch
# 3. orchestrate build → evaluate
use the tech-lead skill to run the full harness on the pitch   (interactive, NOT --unattended)
```

Then check this file's three blocks against the artifacts produced. Block C is the differentiator:
most agents will build the happy path; the harness's value is that E1–E6 are surfaced and handled.
