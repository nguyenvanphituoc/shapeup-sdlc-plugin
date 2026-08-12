---
description: Run the full Shape Up harness on a pitch, with human sign-off at gates
---
Use the **tech-lead** skill to run the full harness on $ARGUMENTS.

Default to **interactive** (`auto_level = interactive`): pause at every ⏸ gate and require PO
sign-off — especially the Ship gate (L4). The harness's safety depends on the human being in the
loop; do not skip gates by default.

**Before anything else, dispatch `tech-lead` and let it open the run** — its first action is
`scripts/init-run.mjs`, which writes the run receipt. Do not summarise what the harness will do;
a session that dispatches the orchestrator and leaves no receipt is blocked at `Stop` by
`hooks/gate-zerowork.mjs`.

## How the run actually executes

On a spec with committed `scopes/*.md` — the common case — `tech-lead` holds the L0 intake
conversation, writes `project-profile.md`, then hands the whole pipeline to a single background
launch and does not drive it turn by turn:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/run-workflow.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/workflows/shapeup-run.js" \
  --args-file .shapeup/<slug>/run-args.json --run-dir .shapeup/<slug>/workflow-run
```

ORIENT → L1a → ANALYZE → WIRE → L1a.5 → MAP SCOPES → L1b → rounds of BUILD/L2/EVAL → QA → GATE H
all run inside it. Three things follow, and they are the point of the cutover rather than trivia:

- **A gate pause is a return value, not a stop.** The launch returns `{status: "paused", paused_at,
  block}`; emit `block` **verbatim**, get the PO's decision, write it to
  `.shapeup/<slug>/gate-answers.json`, and **relaunch the same call with the same args**. The
  fast-forward re-derives position from disk and re-dispatches nothing already finished.
- **A killed session loses nothing.** Resume state comes off disk, never from context, so a fresh
  session picks the run up where it died — the property this migration exists to buy, and the one
  the kill/resume probe grades (`docs/migration/stage-a3-evidence.md` §4).
- **Headless runs need `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` in the environment.** Without it
  `claude -p` cuts the background wait at 600 s and **exits 0**, reporting a truncated run as a
  clean one. Set it for any `--unattended` or CI invocation.
- **Never launch this with the `Workflow` tool.** That call needs an interactive confirmation, so it
  is denied in every headless session and no permission string can grant it. Measured: across six
  benchmark runs the script executed **zero** times and the agent improvised instead, once reaching
  GATE L4 with a valid receipt while the pipeline had never started (`HD-007`). `run-workflow.mjs`
  runs the same script under the grant `npx shapeup-sdlc init` already writes.

`--tiny`, and any spec with no committed `scopes/*.md` yet, take the unchanged prose lane in
`skills/tech-lead/references/round-protocol.md` instead — non-regression, by design.

Only run headless/auto if the user explicitly asks for it in their message:
- `--auto` → advance low-risk gates automatically, still pause at L4 (Ship sign-off).
  Implies `--gate-answers guarded` unless a set is named.
- `--unattended` → fully headless, `max_rounds 3`. Intended for CI, not day-to-day local runs.
  Implies `--gate-answers ci` unless a set is named.
  **Typing the flag IS the confirmation — do not stop to ask for another one.** Emit the warning
  that no human will review the verdict before ship as the run's first line, then proceed straight
  into GATE L0 in the same turn.

  > Why this is spelled out: asking for confirmation here made `--unattended` unusable for the
  > only job it has. In a non-interactive invocation (`claude -p …`, a CI step, a benchmark probe)
  > there is no second turn in which to answer, so the run spent its turn requesting permission and
  > exited having written nothing. A headless flag that cannot complete a headless run is a defect,
  > not a safety feature — and the warning, which is the part that carries the safety value, is
  > still printed. `--auto` remains the middle setting that pauses at L4.

- `--tiny` → the small-change lane: orient (light) → single-task board → build → T0 → done.
  Skips wiring, scope contracts, EVAL, and QA; only gates L0 and L4 pause. The tech-lead's L0
  fit-check applies (≤ ~2 files, no new domain concept/dependency/flow) — if the change isn't
  tiny, it will say so and recommend the full lane.

Additional flags, pass through to `tech-lead` only when the user names them:
- `--gate-answers <ci|guarded|interactive|path.json>` → the pre-recorded PO decisions this run
  crosses its gates with. Gates still emit their blocks and still record a decision; the
  decision's **source** becomes the answer set instead of a live human, and the ledger says so.
  Generate one with `gate-answers.mjs --init --preset ci --by "<name>"`. This is what makes a
  headless lane finish: without it an unattended run waits at the first ⏸ until the wall-clock
  budget expires (measured: a benchmark DNF at 1800s on a feature the control finished in 51s).
- `--wall-clock-budget <seconds>` → arm the deadline breaker. Off by default. Set it in any lane
  with a hard clock (CI, a benchmark, an overnight run) and set it *below* the external kill, so
  the harness trips its own breaker first: past the deadline `hooks/gate-deadline.mjs` denies new
  `task-executor` work and routes to GATE H, where scope-hammer ships whatever is green. A run
  killed from outside ships nothing — including the scopes that already passed T0.
- `--rounds N` → override the outer circuit breaker (build+eval cycles, default 3).
- `--attempts N` → override the inner circuit breaker (per-scope T0 attempts, default 5;
  no-op on specs without scope contracts).
- `--orch-model / --exec-model / --eval-model / --qa-model <name>` → override GATE L0.8's
  resolved model matrix for this run only (highest precedence over `.claude/settings.local.json`
  / `.claude/settings.json` / skill defaults).
