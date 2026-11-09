# Intake — opening a run

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

## 2. Language check — the harness is English end to end

The planner, the doers and the judge all assume English and fail hard on anything else, so this is the one
place a non-English intake is made English: **faithfully, once, by you, in this context** — no sub-agent. It
normalises language and nothing else: it never plans, builds or judges, never summarises, adds or drops a
requirement, and never translates harness *output* back into the PO's language. `/ship intake <path>…` (the
`intake` sub-command) runs just this step over named files, and with `--check` stops after the detection and
writes nothing.

**Detect.** For the pitch **and** its breadboard, sample headings and body prose (ignore code, identifiers and
URLs): `English` → used as it is, no `.en.md` written (idempotent, so a re-run and `--check` are safe and
cheap); `non-English` → queue; `mixed` → queue, and leave the English spans exactly as written.

**Glossary.** One English term per source term, across every document and every run — two spellings read as two
concepts to the planner's domain pass. Load the feature's `shapeup/<slug>/shaping/glossary.md` when it exists as
the base map; extract domain nouns, actor names, status/enum values, screen names and feature jargon with a
proposed English term each; mark the do-not-translate tokens (proper nouns, brand and product names, code
identifiers, API names, env vars, file paths), which pass through verbatim. **An ambiguous term (one source
word, several valid English terms) is asked of the PO and never guessed** — a wrong canonical term cascades
into every document and every round. `auto` and `unattended` runs go on when nothing is ambiguous, and still
stop when something is.

**Translate.** Write `<name>.en.md` beside its source — under `shapeup/<slug>/shaping/` when the source lives
there; the **original is never overwritten**. This is the committed tier, and the loop is its writer. Prose
becomes English with the glossary applied to every domain term; everything a machine parses stays byte
identical, and structure stays 1:1 — same headings, table rows, list items, order. What is kept and what is
translated, the glossary protocol and the verification scan are in `resources/intake/preservation.md`; read it
before translating any file.

**Verify, then sign off.** A residual-language scan of every `.en.md` outside code and do-not-translate tokens
(any hit lists `file:line` and the file does not pass), a structural diff against the source (heading, table-row,
list-item, wikilink and code-block counts must match — a mismatch is a requirement dropped or added), and a
glossary with no unresolved term. A dirty scan stops the run in every lane: a half-translated intake makes the
planner fail mid-run, which is worse than stopping here. Clean →

```
Translated   : <k> files → <name>.en.md
Glossary     : shapeup/<slug>/shaping/glossary.md (<t> terms, <a> resolved ambiguities)
Residual scan: clean | <n> non-English spans → [file:line …]
Structure    : matches source | <diff>
```

The run **opens on the `.en.md` files** (`--intake-file <name>.en.md`, and the `<breadboard>.en.md` copied to `.shapeup/<slug>/breadboard.md`):
the intake is what every planning step reads, so a translation made after the run opened reaches nobody. A run
already open on the original is reopened with `init run --force` — nothing has been planned yet. Once the run
is open, write the audit trail (what was detected, skipped or flagged, the glossary diff, the scan result) to
`.shapeup/<slug>/translation-report.md`.

## 3. Collect, explicitly

Never inferred; ask for what the pitch does not say.

| | |
|---|---|
| Appetite | the pitch frontmatter's `appetite`. Missing or uncapped is a risk: say so at L0 and again at the board gate. It sizes the round budget: 1 week → 2 rounds, 2 weeks → 3, 6 weeks → 4. |
| Lens | `lite` \| `standard` \| `cross-context` (default `standard`) — carried as `lens` in every `plan` order's payload |
| Stack hint | aims the Scout's sweeps and the run commands (e.g. "pnpm, Next 16 web :3000") |
| Eval dimensions | default `auto`: the order resolves the set from the spec. Name a set only on request; it must reach every `evaluate` order's `dimensions`, or it grades nothing. What is left out is reported at the ship gate as not evaluated. |
| Rounds, attempts | default 3 rounds, 5 attempts per scope per round. `resources/build/round.md` says why there are two breakers |
| Auto level | `interactive` (default): pause at every gate · `auto`: low-risk gates pre-answered, still pause at the judgment gates and ship · `unattended`: headless, needs an answer set |
| Models | resolve once: flags, then `.claude/settings.local.json`, then `.claude/settings.json`, then defaults, and pass the result as `--exec-model` / `--eval-model` / `--qa-model`. Exec and eval must be sonnet or above — `init run` refuses a cheaper tier. A model the member's plan does not offer degrades one tier down, and the degrade is said at the L0 gate, never silent. |
| Run commands | the build command (`run_cmd`), and the profile's `build_probe` and `launch_probe`. A `mobile` profile with no launch probe has nobody owning the install and launch risk: say so. |
| Knowledge base | read `shapeup/knowledge-base/building.md` and then `tech-lead.md` (the same guidance under its old name; `resources/guidance.md`) if they exist. It may add a question or a check to a gate block and may propose run values (confirm each with the PO and note `(source: knowledge-base)`). It never answers, skips or reorders a gate. With no file at all, offer `/retro --scan` once and go on whether or not the PO takes it. |

## 4. Open the run

Write the requirement to a file first and pass the path; a multi-line requirement inlined into a shell
argument is where this step goes wrong. **Every switch the operator typed goes on this one command**: `init
run` writes the launch record (§7) in the same act as the receipt, so a switch left off it does nothing.

```bash
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" init run --slug <slug> --intake-file <path> --auto-level <interactive|auto|unattended> [--gate-answers <ci|guarded|path.json>] [--max-rounds 3] [--attempts 5] [--exec-model <m>] [--eval-model <m>] [--qa-model <m>] [--no-eval] [--no-qa] [--parallel-scopes <N>]
```

Ask for every value in §3 *before* this command, so the record is right the first time; a change the PO asks
for at the L0 gate (§6) re-opens the run with `--force` — nothing has been planned yet.

**Exit 2 naming a role** means a model is below the floor (`exec` and `eval` must be sonnet or above; `qa` and,
under `--no-eval`, `eval` are not checked): say which, and ask for another. An unknown switch exits 2 too, naming it.

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

Emit the block, then resolve it like every other gate:

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
node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" gate --resolve L0 --slug <slug> [--file <path>|--preset <name>]
```

Exit 4: put the block to the PO and wait. Exit 0 `proceed`: continue. Exit 5: stop; do not launch.

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
