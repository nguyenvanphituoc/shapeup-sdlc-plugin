# Intake — opening a run

| Contract | |
|---|---|
| Phase | `step 0` |
| Order | `none` |
| Gate | `L0` |
| Done when | `<run>/receipt.json` and `<run>/run-args.json` exist, and GATE L0 is crossed |

Everything the run needs is pinned once, here, so the loop never has to guess. The intake is a
**kicked-off pitch**: shaping, betting and kick-off are the PO's own and happen upstream. A raw idea is
not an intake.

## 1. Resolve the pitch

In order: `--pitch <path>` (a shaping or pitch file), `--spec <folder>`, requirement text passed to the
skill. **None resolvable → stop.** Print "✋ NO INTAKE — name a kicked-off pitch (`--pitch <path>`)" and
nothing else: do not emit the L0 block, list downstream gates, or describe the pipeline that "will" run.
A run with no spec has nothing to drive, and narrating one reads exactly like a run that worked.

A pitch is `shaping.md` plus its `breadboard.md`. You find the breadboard beside the pitch, in
`shapeup/<slug>/shaping/`, one the PO names, or inline in a single `pitch.md`, and you copy it to
`.shapeup/<slug>/breadboard.md` once the run is open: that is the path every planning order freezes and every worker reads.

Step 2, the language check, has its own file: `resources/intake/language.md`.

## 3. Collect, explicitly

Never inferred from nothing: read what the pitch, the command line and the settings say; for a value none of them gives, use the documented default and ask the gate agent to record that it was used (a question entry).

| | |
|---|---|
| Appetite | the pitch frontmatter's `appetite`. Missing or uncapped is a risk: say so at L0 and again at the board gate. It sizes the round budget: 1 week → 2 rounds, 2 weeks → 3, 6 weeks → 4. |
| Lens | `lite` \| `standard` \| `cross-context` (default `standard`) — carried as `lens` in every `plan` order's payload |
| Stack hint | aims the Scout's sweeps and the run commands (e.g. "pnpm, Next 16 web :3000") |
| Eval dimensions | default `auto`: the order resolves the set from the spec. Name a set only on request; it must reach every `evaluate` order's `dimensions`, or it grades nothing. What is left out is reported at the ship gate as not evaluated. |
| Rounds, attempts | default 3 rounds, 5 attempts per scope per round. `resources/build/round.md` says why there are two breakers |
| Auto level | `unattended`: every run is; the gate agent answers each gate (until the answer sets are removed the launch record may still carry a preset, which the loop does not pass) |
| Models | resolve once: flags, then `.claude/settings.local.json`, then `.claude/settings.json`, then defaults, and pass the result as `--exec-model` / `--eval-model` / `--qa-model`. Exec and eval must be sonnet or above — `init run` refuses a cheaper tier. A model the member's plan does not offer degrades one tier down, and the degrade is said at the L0 gate, never silent. |
| Run commands | the build command (`run_cmd`), and the profile's `build_probe` and `launch_probe`. A `mobile` profile with no launch probe has nobody owning the install and launch risk: say so. |
| Knowledge base | read `shapeup/knowledge-base/building.md` and then `tech-lead.md` (the same guidance under its old name; `resources/guidance.md`) if they exist. It may add a question or a check to a gate block and may propose run values (not applied by the loop: the gate agent records that it was proposed, as a question entry). It never answers, skips or reorders a gate. With no file at all, go on: the PO may run `/retro --scan` between runs. |

## 4. Open the run

Write the requirement to a file first and pass the path; a multi-line requirement inlined into a shell
argument is where this step goes wrong. **Every switch the operator typed goes on this one command**: `init
run` writes the launch record (§7) in the same act as the receipt, so a switch left off it does nothing.

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" init run --slug <slug> --intake-file <path> --auto-level unattended [--max-rounds 3] [--attempts 5] [--exec-model <m>] [--eval-model <m>] [--qa-model <m>] [--no-eval] [--no-qa] [--parallel-scopes <N>]
```

Collect every value in §3 *before* this command, so the record is right the first time; a change the gate agent asks
for at the L0 gate (§6) re-opens the run with `--force` — nothing has been planned yet.

**Exit 2 naming a role** means a model is below the floor (`exec` and `eval` must be sonnet or above; `qa` and,
under `--no-eval`, `eval` are not checked): say which and stop: a failed preflight is the PO's to fix, and is never put to the gate agent. An unknown switch exits 2 too, naming it.

**Exit 3 means a run is already open, or the worker roster is missing.** For an open run the refusal prints the
launch record it keeps — the switches typed to *this* call were not applied — and the loop continues from the phase
table in `SKILL.md`. `--force` reopens deliberately: it answers every order nobody answered as abandoned, retires the
fence's pointer and writes a fresh record; only the PO asks for it.

## 5. The shared profile

Write `shapeup/<slug>/project-profile.md`: frontmatter `{schema_version: 1, archetype, entry_point}` plus,
when the project has them, `build_probe` and `launch_probe`. Nothing downstream can be
wired without it, and a typo in the `archetype` enum must fail rather than silently disable a check.

| Field | Meaning |
|---|---|
| `archetype` | `client-only-game` · `web-service` · `mobile` · `library` · `data-pipeline` |
| `entry_point` | the composition root the wiring map names its call sites against. Where some module composes the app, name that one rather than the file the platform happens to start |
| `build_probe` | asserts the BUILT ARTIFACT covers what the run wrote — a green exit code is not proof the feature compiled when the toolchain compiles only what an entry point reaches |
| `launch_probe` | installs, starts and asserts the first screen. A `mobile` profile without one is worth saying at L0, because nothing else launches the app |

The loop runs them itself, once per round before it dispatches the evaluator: a scope's fixture can be green while its
code never compiles, on any toolchain that compiles only what the entry point reaches, so `build_probe` asserts the
built artifact. A red step ends the round with no verdict, and its failure is the next round's bug.

## 6. The L0 gate

Emit the block, then put it to the gate agent like every other gate (it sees the block, `run-args.json`, the pitch and the profile; `abort` closes the run):

```
⏸ GATE L0 — Intake & Run Config
Feature      : <slug>   (kicked-off pitch: <path>)
Intake lang  : English | translated → <name>.en.md
Appetite     : ~1 week | ~2 weeks | ~6 weeks | ⚠ missing — scope uncapped
Eval dims    : auto | the named set        Rounds: <N>     Auto: <level>
Run commands : <run_cmd> · build_probe <set|—> · launch_probe <set|— ⚠ mobile>
Model matrix : exec=<m> eval=<m> qa=<m>   (source: flags | settings.local | settings.json | default)
Budgets      : round_budget=<N> (outer)   attempt_budget=<N> (inner, per scope)
Knowledge    : building.md — <N> rules | none
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" gate --resolve L0 --slug <slug> --answer <proceed|abort> --by agent:gate-agent --note "<reason>"
```

Exit 0 `proceed`: continue. Exit 5 (`abort`): close the run `aborted` and stop. Exit 4: the kernel refused on the evidence; close the run `escalated`. Use the absolute kernel path in the command, as `resources/gates.md` says.

## 7. The launch record

`.shapeup/<slug>/run-args.json` is what this run was launched with, written by `init run` and read by the loop;
it is the only place a typed switch survives. The loop reads nothing but the record and the artifacts.

| Switch on `init run` | Field |
|---|---|
| `--auto-level` | `autoLevel` |
| `--gate-answers <set>` | `answers` — the answer set the gates resolve through |
| `--exec-model` `--eval-model` `--qa-model` | `models.{exec,eval,qa}` — a flag, else `SHAPEUP_EXEC_MODEL` / `SHAPEUP_EVAL_MODEL` / `SHAPEUP_QA_MODEL`, else `sonnet`; `qa` follows `exec` |
| `--max-rounds` `--attempts` | `budgets.{maxRounds,attemptBudget}` |
| `--no-eval` | `noEval` — skips the evaluation; the ship report says so in its first line and never reads as verified; you do not write PASS over a run launched with it |
| `--no-qa` | `noQa` — skips the QA hunt |
| `--parallel-scopes N` | `maxParallelScopes` — how many scopes build at once (default 4; `1` = sequential) |

Then go to the loop.
