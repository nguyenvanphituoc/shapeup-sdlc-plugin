---
description: Run the full Shape Up harness on a pitch, with human sign-off at gates
---
Use the **building** skill to run the full harness on $ARGUMENTS.

Default to **interactive** (`auto_level = interactive`): pause at every ⏸ gate and require PO
sign-off — especially the Ship gate (L4). The harness's safety depends on the human being in the
loop; do not skip gates by default.

**Before anything else, dispatch `building` and let it open the run** — its first action is
`harness init run`, which writes the run receipt and the launch record. Do not summarise what the harness will do:
a run that left no receipt did not happen.

## How the run executes

`building` drives the run in this session. It opens the run, then reads the run's files and takes the first
phase whose condition holds, over and over: dispatch a worker, build the released scopes, run a kernel
command, cross a gate, close. Three things follow:

- **A gate is answered where it is reached.** The loop prints the gate block, asks the PO one
  question with a recommendation, records the answer with the source `PO (live)`, and goes on. There
  is no relaunch after an answer.
- **A killed session loses nothing.** The next phase is read off the files on disk, never from
  the conversation, so `/ship` again over an open run resumes it: a finished phase is not re-run.
- **Every agent the run spawns is a worker** — `orient`, `task-executor`, `spec-evaluator` and
  `qa-edge-hunter` — and each leaves a row in the run's records. Planning is not a worker: the loop does it in this session, under a write fence of its own. Nor are the census at GATE H, the ship report, the retro after a ship, or the English copy of a non-English pitch: the loop does those itself.

**`--tiny` is no longer served** — a breaking change in 4.0. The separate small-change lane (the `tech-lead`
skill's prose loop) was retired with that skill, and `init run` refuses `--tiny` and `--lane tiny` with exit 2. If
`--tiny` is typed, say so plainly and run the full loop instead, with the pitch's appetite small (`~1 week` gives
a two-round budget, and a small shape yields one scope): the gates and the verification floor are the same ones
a bigger pitch crosses, and nothing is waived for a one-file fix. Do not take any other route — a hand-built
change outside the loop is what the harness exists to prevent.

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
  with `/shapeup` is `shaping.md` + `breadboard.md`; the loop finds a `breadboard.md` in the same
  folder (or in `shaping/`) on its own, and reads one written inline in a single `pitch.md`. Its
  Places become the spec's screens, and GATE L1b is where a missing or folded one is caught.
- `--gate-answers <ci|guarded|interactive|path.json>` → the pre-recorded PO decisions this run
  crosses its gates with. Gates still emit their blocks and still record a decision; the decision's
  **source** becomes the answer set instead of a live human, and the ledger says so. Generate one
  with `harness gate --init --preset ci --by "<name>"`. Without one an unattended run waits at the
  first ⏸, having built nothing.
- `--parallel-scopes N` → how many scopes build at once (default 4). Concurrency is a cost question
  before it is a speed one — every extra leg is another worker's full context. `1` builds scopes one
  at a time.
- `--no-qa` → skip the QA Edge Hunt. QA is a level-up, not a gate.
- `--no-eval` → skip the evaluator; the run ships as not evaluated, and says so.
- `--rounds N` → override the outer circuit breaker (build+eval cycles, default 3). Passed to `init run` as `--max-rounds N`.
- `--attempts N` → override the inner circuit breaker (per-scope T0 attempts, default 5). Passed to `init run` as `--attempts N`.
- `--exec-model / --eval-model / --qa-model <name>` → override the resolved model matrix for this run
  only (highest precedence over `.claude/settings.local.json` / `.claude/settings.json` / skill defaults).
