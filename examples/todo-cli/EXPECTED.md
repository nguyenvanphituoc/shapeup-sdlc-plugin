# Expected harness output — `todo-cli` example

This file is the **smoke test of the plugin's stated purpose**: *guide an agent through Shape Up
to build anything, with (a) evaluation output and (b) edge cases handled.* A correct run on
`idea.md` must produce all three blocks below. Each is a concrete, checkable assertion — not vibes.

If a run cannot satisfy these, the harness has not met its goal **for a non-UI deliverable** — the
case that separates "build anything" from "build a web app". A UI deliverable can be graded by
driving a browser; a CLI cannot, and a harness whose only notion of evidence is a screenshot quietly
excludes half of what people build. That is what the evaluation-contract abstraction exists for, and
what this fixture holds it to.

Since Phase 2 this file is also the **acceptance contract for the harness's own release criterion**:
the baseline feature must ship end-to-end, interactive and headless, and be graded against the three
blocks below. It is not a wishlist — a run either satisfies these or the criterion is not met.

---

## A. Shape Up shaping produced a linked doc tree with a Test Surface

A `ba-pitch-analyzer` run on this pitch must emit a doc tree under `shapeup/<slug>/`
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

> Note: a CLI has no browser, so the evaluator does not drive Playwright here. Each criterion carries
> an `oracle` tag and the evaluator dispatches on it via the registry `oracles/index.mjs`
> (`process`/`test`/`snapshot`/`http`, with `ui` handled in-skill). For this CLI the oracle is
> **`process`** — the shared runner
> `oracles/process-oracle.mjs` spawns the deliverable and grades exit code + stdout.
> Run it directly (the deliverable path must be **absolute** — the oracle spawns it inside a
> throwaway temp dir, so a relative path resolves against the sandbox, not the repo):
> `node oracles/process-oracle.mjs examples/todo-cli/todo.contract.json "node $PWD/examples/todo-cli/reference/todo.js"`.

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

This is a **fixture**, not an automated test: exercising it costs real model calls, so it can never
be part of the zero-dependency structural suite.

### Where it runs — outside this repo, always

The workers build a real `todo` CLI. `.shapeup/` is gitignored, but **the implementation they write
is not**, so a run started inside the plugin tree leaves an unrelated CLI sitting in the repo and
invites a worker's writes near the plugin's own files. Copy the pitch into a scratch checkout and run
there:

```
mkdir -p /tmp/todo-cli-run && cd /tmp/todo-cli-run && git init -q
cp <plugin>/examples/todo-cli/idea.md .
```

### Launching it

Load the plugin (`claude --plugin-dir <plugin>`, or install and enable it), then in that session:

```
/ship
```

That is the whole launch. `/ship` reaches the `tech-lead` skill, which opens the run
(`harness init run`, whose receipt mints the `run_id` every later step is keyed by), resolves GATE
L0, and launches the orchestrator with the `Workflow` tool.

> **Do not call the `Workflow` tool directly instead.** GATE L0 is where `tech-lead` writes
> `shapeup/<slug>/project-profile.md` — the only artifact that skill writes itself, because the run
> script has no filesystem of its own. Skip it and the run reaches WIRE, `solution-architect`
> escalates by contract (it resolves every wiring seam against the profile's declared `entry_point`
> and is forbidden to guess one), and the phase post-condition aborts. Measured, not theorised: this
> is exactly how the first attempt at the headless lane died.

For the headless lane, ask for it unattended — `tech-lead` passes `--auto-level unattended` with
`--gate-answers ci`, and gates then resolve from the answer set instead of pausing.

### Grading the result

Check this file's three blocks against the artifacts produced. Block C is the differentiator: most
agents will build the happy path, and the harness's value is that E1–E6 are surfaced and handled.

The oracle grades the deliverable mechanically, and the fixture ships its own negative control — the
reference implementation must PASS and a deliberately broken one must FAIL. An oracle that has only
ever been seen pass is not known to discriminate.
