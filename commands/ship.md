---
description: Run the full Shape Up harness on a pitch, with human sign-off at gates
---
Use the **building** skill to run the full harness on $ARGUMENTS.

Default to **interactive** (`auto_level = interactive`): pause at every ⏸ gate and require PO
sign-off — especially the Ship gate (L4). The harness's safety depends on the human being in the
loop; do not skip gates by default.

**Before anything else, dispatch `building` and let it open the run** — its first action is
`harness init run`, which writes the run receipt. Do not summarise what the harness will do;
a session that dispatches the loop and leaves no receipt is blocked at `Stop` by
`hooks/gate-zerowork.mjs`.

## How the run executes

`building` drives the run in this session. It opens the run, then asks the kernel `probe next` what
comes next and does exactly that, over and over: dispatch a worker, build the released scopes in
parallel, run a kernel command, cross a gate, close. Three things follow:

- **A gate is answered where it is reached.** The loop prints the gate block, asks the PO one
  question with a recommendation, records the answer with the source `PO (live)`, and goes on. There
  is no relaunch after an answer.
- **A killed session loses nothing.** The next step is derived from artifacts on disk, never from
  the conversation, so `/ship` again over an open run resumes it: a finished phase is not re-run.
- **Every agent the run spawns is a worker** — `orient`, `task-executor`, `spec-evaluator`,
  `qa-edge-hunter`, and the planning and census workers — and each leaves a row in the run's records.

`--tiny` takes the small-change lane in the `tech-lead` skill instead: orient (light) → single-task
board → build → T0 → done, only gates L0 and L4 pause. Its fit-check applies (≤ ~2 files, no new
domain concept/dependency/flow); if the change isn't tiny it says so and recommends the full lane.

Only run headless/auto if the user explicitly asks for it in their message:
- `--auto` → advance low-risk gates automatically, still pause at L4 (Ship sign-off).
  Implies `--gate-answers guarded` unless a set is named.
- `--unattended` → fully headless, `max_rounds 3`. Intended for CI, not day-to-day local runs.
  Implies `--gate-answers ci` unless a set is named. **Typing the flag IS the confirmation — do not
  stop to ask for another one.** Emit the warning that no human will review the verdict before ship as
  the run's first line, then proceed straight into GATE L0 in the same turn. (In a non-interactive
  invocation there is no second turn in which to answer; a headless flag that waits for one cannot
  complete a headless run.)

Additional flags, pass through to `building` only when the user names them:
- `--breadboard <path>` → the pitch's breadboard, when it is not beside the pitch. A pitch shaped
  with `/shapeup` is `shaping.md` + `breadboard.md`; the run finds a `breadboard.md` in the same
  folder (or in `shaping/`) on its own, and reads one written inline in a single `pitch.md`. Its
  Places become the spec's screens, and spec-lint stops the run at GATE L1b when one is missing or
  folded into another screen.
- `--gate-answers <ci|guarded|interactive|path.json>` → the pre-recorded PO decisions this run
  crosses its gates with. Gates still emit their blocks and still record a decision; the decision's
  **source** becomes the answer set instead of a live human, and the ledger says so. Generate one
  with `harness gate --init --preset ci --by "<name>"`. Without one an unattended run waits at the
  first ⏸ until the wall-clock budget expires, having built nothing.
- `--wall-clock-budget <seconds>` → arm the deadline breaker. Off by default. Set it in any lane
  with a hard clock and *below* the external kill, so the harness trips its own breaker first: past
  the deadline no new build round opens and the run routes to GATE H, where the census ships whatever
  is green. A run killed from outside ships nothing.
- `--parallel-scopes N` → how many scopes build at once (default 4). Concurrency is a cost question
  before it is a speed one — every extra leg is another worker's full context. `1` builds scopes one
  at a time.
- `--no-qa` → skip the QA Edge Hunt. QA is a level-up, not a gate.
- `--no-eval` → skip the evaluator; the run ships as not evaluated, and says so.
- `--rounds N` → override the outer circuit breaker (build+eval cycles, default 3).
- `--attempts N` → override the inner circuit breaker (per-scope T0 attempts, default 5).
- `--exec-model / --eval-model / --qa-model <name>` → override the resolved model matrix for this run
  only (highest precedence over `.claude/settings.local.json` / `.claude/settings.json` / skill defaults).
