---
description: Run the full Shape Up harness on a pitch, unattended, with a gate agent answering each gate
---
Use the **building** skill to run the full harness on $ARGUMENTS.

Every run is **unattended**: it never waits for a person. A gate agent answers each of the ten gates in the PO's
place, reading what the earlier gates decided from the run's decision log, and writes a baseline and a decision for
each. Where Claude would otherwise stop to ask, the gate agent decides. The PO reviews the decision log after the run.

**Before anything else, dispatch `building` and let it open the run** — its first action is
`harness init run`, which writes the run receipt and the launch record. Do not summarise what the harness will do:
a run that left no receipt did not happen.

With a sub-command as its first word, `building` does one activity of the loop and not the whole run:
`plan` (the planning substeps, through Board Review), `stop` (the census at the Cut-List Review gate), `retro` (file feedback, or seed the knowledge base with `--scan` or `--research <stack>`), `intake <path>` (the language gate alone; `--check` writes nothing).

## How the run executes

`building` drives the run in this session. It opens the run, then reads the run's files and takes the first
phase whose condition holds, over and over: dispatch a worker, build the released scopes, run a kernel
command, cross a gate, close. Three things follow:

- **A gate is answered where it is reached.** The loop starts the gate agent with the gate and the paths to read;
  the agent reads the decision log, decides, appends its entry and records the answer under its own name. There
  is no relaunch after an answer, and no pause.
- **A killed session loses nothing.** The next phase is read off the files on disk, never from
  the conversation, so `/ship` again over an open run resumes it: a finished phase is not re-run.
- **Every agent the run spawns is a worker** — `orient`, `task-executor`, `spec-evaluator` and
  `qa-edge-hunter` — and each leaves a row in the run's records. Planning is not a worker: the loop does it in this session, under a write fence of its own. Nor are the census at the Cut-List Review gate, the ship report, the retro after a ship, or the English copy of a non-English pitch: the loop does those itself.

**`--tiny` is no longer served** — a breaking change in 4.0. The separate small-change lane (the `tech-lead`
skill's prose loop) was retired with that skill, and `init run` refuses `--tiny` and `--lane` as unknown flags (exit 2). If
`--tiny` is typed, say so plainly and run the full loop instead, with the pitch's appetite small (`~1 week` gives
a two-round budget, and a small shape yields one scope): the gates and the verification floor are the same ones
a bigger pitch crosses, and nothing is waived for a one-file fix. Do not take any other route — a hand-built
change outside the loop is what the harness exists to prevent.

`--auto`, `--unattended` and `--gate-answers` are retired: a run is always unattended, so each is accepted and ignored.

Additional flags, pass through to `building` only when the user names them:
- `--breadboard <path>` → the pitch's breadboard, when it is not beside the pitch. A pitch shaped
  with `/shapeup` is `shaping.md` + `breadboard.md`; the loop finds a `breadboard.md` in the same
  folder (or in `shaping/`) on its own, and reads one written inline in a single `pitch.md`. Its
  Places become the spec's screens, and the Board Review gate is where a missing or folded one is caught.
- `--parallel-scopes N` → how many scopes build at once (default 4). Concurrency is a cost question
  before it is a speed one — every extra leg is another worker's full context. `1` builds scopes one
  at a time.
- `--no-qa` → skip the QA Edge Hunt. QA is a level-up, not a gate.
- `--no-eval` → skip the evaluator; the run ships as not evaluated, and says so.
- `--rounds N` → override the outer circuit breaker (build+eval cycles, default 3). Passed to `init run` as `--max-rounds N`.
- `--attempts N` → override the inner circuit breaker (per-scope T0 attempts, default 5). Passed to `init run` as `--attempts N`.
- `--exec-model / --eval-model / --qa-model <name>` → override the resolved model matrix for this run
  only (highest precedence over `.claude/settings.local.json` / `.claude/settings.json` / skill defaults).
