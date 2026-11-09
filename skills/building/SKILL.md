---
name: building
description: "Use this skill whenever the user wants to ship a kicked-off Shape Up pitch end to end — orient, plan, build, evaluate, hunt, cut, ship — as the tech lead who drives the run in this session and sits at every gate with the PO. Trigger on: \"ship this feature\", \"run the harness\", \"build from this pitch\", \"from pitch to ship\", \"run the full harness\", \"orchestrate the build\", \"resume the run\". Also covers its sub-commands: translate a non-English pitch to English (intake), decide when to stop with the census and cut list (the Cut-List Review gate, \"hammer this down to must-haves\"), and file ship feedback or seed the knowledge base from the project or the platform docs (the retro, \"coach this feedback\", \"scan the project for guidelines\"). DEFAULT: /ship <pitch>. Use it even when the user describes a multi-step build flow without naming the skills."
---

# Building — the loop that drives a run

## ▶ RUN THIS FIRST — do not summarise this file

**Your first output is a tool call, not a plan.** Narrating the pipeline reads like a clean run and
leaves defects behind it. A run that left no receipt did not happen; loading these instructions is not
running them.

You drive the run, in this session. What stands between you and a claim of "done" is five mechanisms and
nothing else: the **receipt** `init run` writes, the **gate resolver**, the **T0 witness** that runs a
scope's fixtures and re-hashes what it cites, the **write fence** that refuses a worker's write outside
its order's substrate, and the **dispatch receipts** that name which agent ran. Everything else in this
file is your own discipline, and no script checks it for you — so after every action, read the files
again instead of remembering them.

Every kernel command below is run exactly as written, on ONE line (a grant matches a single-line
command; a `\`-continued one comes back "requires approval"). If a kernel command comes back "requires
approval", stop and say so — the scripts need a one-time grant (`npx shapeup-sdlc init`); never route
around it or hand-build the feature.

## Rules

1. **ASK, DON'T ASSUME.** Collect the intake explicitly (`resources/intake/open-run.md`); put every gate to the PO with a recommendation first.
2. **SIMPLEST FIRST.** The smallest change that satisfies the pitch.
3. **NON-REGRESSION.** Never touch what already works.
4. **A CLAIM NAMES ITS FILE.** Every "done", "green" or "shipped" you write cites the file or kernel output it came from.

## Step 0 — open the run

Resolve the intake and open it as `resources/intake/open-run.md` says: language check (a non-English pitch is made
English by you, right there: `<name>.en.md` and the glossary, and the run opens on the copy), the L0 collect-list,
`init run` — with every switch the operator typed, because it writes the launch record in the same act
as the receipt and refuses a model below the floor (exit 3 = a run is already open, or the worker roster is
missing: the record is kept and the loop continues from the files), the shared `project-profile.md`, and the
L0 gate.

## Where the facts are

`K` is `node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs"`. `<run>` is `.shapeup/<slug>/`, `<spec>` is `shapeup/<slug>/`.

| Fact | File |
|---|---|
| the launch record: models, `budgets.maxRounds`, `budgets.attemptBudget`, the answer set (`answers`), `noEval`, `noQa`, `maxParallelScopes` | `<run>/run-args.json` |
| the intake, and which plugin copy opened the run | `<run>/intake.md`, `<run>/receipt.json` |
| a gate is crossed when a row with that `gate` and `"status":"ok"` exists (matching `round` where it has one) | `<run>/gates.jsonl` |
| orders and results — a dispatch is answered when `results/<stem>.json` exists | `<run>/orders/<stem>.json`, `<run>/results/<stem>.json` |
| the scorer's verdict per attempt; the latest row per scope is its state | `<run>/t0/trials.jsonl`, `<run>/t0/verdicts/r<R>-a<A>-t<T>.json` |
| committed plan: requirements, spec tree, wiring map, scope contracts | `<spec>requirements.md`, `<spec>spec/`, `<spec>wiring-map.md`, `<spec>scopes/<id>.md` |
| the board: one `TASK-NNN.md` per task, `status:` in its frontmatter | `<run>/tasks/` |
| the census GATE L4 reads | `<run>/reports/hammer-census.json` |

## The phases — do the first one whose condition holds, then read the files again

A gate is crossed with `K gate --resolve <GATE> --slug <slug> [--round R] [--verdict V] --preset <set>` (exit 0 = crossed; 4 = ask the PO and
re-run with `--answer <decision>`; 5 = the set aborts: close the run as aborted and stop). `<set>` is the launch record's `answers`.

| # | Condition | Do |
|---|---|---|
| 0 | `<run>/close.json` exists | the run has ended: report its `status` and `cause`, and stop. Reopening it is the PO's decision (`init run --force`) |
| 1 | no `results/orient.json` | **dispatch** `orient` (below) |
| 2 | GATE L1a not crossed | `K gate --resolve L1a --slug <slug> --preset <set>` |
| 3 | no `<spec>requirements.md` | plan substep `requirements` |
| 4 | no spec tree or no board | plan substep `spec`; then read the board back against `resources/plan/spec.md`'s checklist |
| 5 | no `<spec>wiring-map.md` | plan substep `wire`; then GATE L1a.5 |
| 6 | no `<spec>scopes/*.md` | plan substep `scopes`; then GATE L1b |
| 7 | a scope has no green latest trial for round R (R starts at 1) | **build** it (below) |
| 8 | every scope green or out of attempts, GATE L2 not crossed for R | `K gate --resolve L2 --slug <slug> --round R --preset <set>` |
| 9 | no `results/evaluate-rR.json` (skipped under `noEval`) | **dispatch** `spec-evaluator` |
| 10 | GATE L3 not crossed for R | `K gate --resolve L3 --slug <slug> --round R --verdict <pass\|fail\|not-evaluated>`. On fail and `R < maxRounds`, round R+1 repeats 7 to 10 for the scopes the verdict's bugs name; otherwise go to 13 |
| 11 | GATE QA not crossed | `K gate --resolve QA --slug <slug> --round R --verdict pass --preset <set>` |
| 12 | QA answered `run` and no `results/hunt.json` (skipped under `noQa`) | **dispatch** `qa-edge-hunter`. Do not move on without it: GATE L4 refuses `ship` over a hunt the run owed and never ran, and the only recorded way out is `K gate --resolve QA … --answer skip` |
| 13 | no census file | do the census (`resources/ship/census.md`) and write `<run>/reports/hammer-census.json`; then GATE H |
| 14 | GATE H crossed, no `<spec>REPORT.md` | write the ship report (`resources/ship/report.md`); then GATE L4 |
| 15 | GATE L4 crossed | `K order close --slug <slug> --status <shipped\|escalated\|aborted> --cause "<verdict, rounds>"`; `shipped` is refused (exit 1) unless this run's L4 row says `ship`, so a refusal here means the gate was not crossed — go back to phase 14; then GATE COACH-1 |

**A plan substep** is done here, in this session, with no sub-agent: write the substep's order (`resources/orders.md`, operation `plan`,
`worker: "building"`), open it with `K order open`, write only what the substep produces (`resources/plan/substep.md` and its `resources/plan/*.md`
siblings say what and how), then write `results/plan-<step>.json` yourself (the order's `own` path, so it is writable though results are frozen) and read the artifact back, before you write the next order. The order's substrate is the
fence: while it is open, the staged pitch, the receipt and the other orders are frozen.

## A dispatch

The same five moves for every worker. `resources/orders.md` has the order for each operation.

1. **Write the order** to `<run>/orders/<stem>.json` from the template for the operation. It carries the substrate (the globs the worker may write,
   copied from the scope contract for a build) and the payload the worker needs, as paths where a path will do.
2. **Open it**: `K order open --slug <slug> --order "<run>/orders/<stem>.json"`. This stamps the order's time and names the live order to the fence; without it the fence allows every write.
3. **Spawn** the agent `shapeup-sdlc-plugin:<worker>` with the prompt `--order "<run>/orders/<stem>.json"` and one line of note, and pass the
   **model** the launch record names for the role: `models.exec` for `orient` and `task-executor`, `models.eval` for `spec-evaluator`, `models.qa`
   for `qa-edge-hunter`. The agent definitions say `inherit`, so a dispatch that carries no model runs on *your* session's model, whatever the
   record asked for. The dispatch is checked against the order schema before it leaves, and leaves a receipt naming the agent that ran, the model
   the call asked for and the model the host says ran. GATE L4 reads those receipts: an `exec` or `eval` worker that ran below the floor refuses
   `ship`, and a model other than the record's is written into the gate's row — say so in the ship report.
4. **Read the result** at `<run>/results/<stem>.json`: `K verify envelope "<run>/results/<stem>.json" "${CLAUDE_PLUGIN_ROOT}/kernel/schemas/work-result.schema.json"`.
   Invalid, or absent, goes back **once** with the reason; a second failure is a phase that did not complete — name it and stop at that phase.
5. **Apply it yourself**: update the board's `status:` for the tasks the result closed, append each discovery to `<run>/discovery/ledger.md`, append the
   evaluator's verdict-ledger lines to `<run>/evaluation/.verdicts-<target>.jsonl`, and state what the result changed. Nobody else writes these.

## Build a scope

For scope `S` in round `R`, attempt `A` (start at 1): dispatch `task-executor` with operation `execute` (round 1, or `fix` with the verdict's bugs on later rounds),
whose substrate is the scope contract's `allowed_file_substrate` and `shared_substrate`. The worker runs `K verify t0 "<spec>scopes/S.md" --round R --attempt A`
itself. After its result lands, **run the same command yourself** and read `status` from the JSON on stdout, never from the exit code (a `kept` red-but-improved attempt exits 1):

| `status` | You |
|---|---|
| `kept`, overall green | the scope is green for round R |
| `kept`, red | attempt A+1 builds on this tree; fold the digested errors into the next order |
| `reverted` or `crash` | attempt A+1; the tree was restored |

A scope that reaches `attemptBudget` attempts without a green is **out of attempts**: stop building it, record it as a proposal for GATE H, and go on. It never stops the round.
Build a scope only after the scopes in its contract's `depends_on` are green. Two scopes build at once only when no path is writable by both (read the contracts' substrates); otherwise one at a time.
Count an attempt from the dispatch receipts in `<run>/receipts/dispatch.jsonl`, not from your memory: a dispatch with no receipt did not run the shipped worker.

## The breakers

`maxRounds` ends the run: after a failed round R = `maxRounds`, go to the census. `attemptBudget` ends one scope. Neither ends the run from outside — both route to GATE H, where the
census compares what is green against the baseline and ships what works. A run killed from outside ships nothing.

## Sub-commands

`/ship` with none runs the whole loop. A sub-command does one activity of it:
`plan` (`/scopes`, `/wire`) — the planning substeps; `stop` (`/hammer`) — the census over the run in hand;
`retro` (`/retro`, `/retro --scan`, `/retro --research <stack>`) — `resources/retro/retro.md`, `resources/retro/scan.md`, `resources/retro/research.md`;
`intake <path>…` (`--check` writes nothing) — the language gate alone, `resources/intake/language.md`.

## Resume

`/ship` again over an open run is the resume (over a closed one, phase 0 reports the ending and stops): `init run` refuses and prints what is on disk, and you continue from the phase table, reading files and nothing else.
A run closed without shipping is reopened by `init run --force`, which resolves every order nobody answered as abandoned before it writes.

## Index — which file answers which row

Every phase row, step 0 and every sub-command is on one line. A file with rows opens with the four-row
contract; a line with `—` is a file the others read.

| Rows | What | File |
|---|---|---|
| `step 0` | open the run: the pitch, the collect-list, `init run`, the profile, the launch record | `resources/intake/open-run.md` |
| `sub-command` | `intake`: the language check and translation, alone or inside step 0 | `resources/intake/language.md` |
| `0`, `1`, `7`, `9`, `12` | the run has ended; a dispatch; build a scope | this file |
| `2`, `8`, `10`, `11` | how to put a gate to the PO, and what to have read first | `resources/gates.md` |
| `3` | planning: the requirements registry | `resources/plan/requirements.md` |
| `4` | planning: the spec tree and the board | `resources/plan/spec.md` |
| `5` | planning: the wiring map | `resources/plan/wire.md` |
| `6` | planning: the scope contracts | `resources/plan/scopes.md` |
| `13` | the census, the baseline comparison, the cut list (GATE H) | `resources/ship/census.md` |
| `14` | the ship report | `resources/ship/report.md` |
| `15` | after a ship: feedback and the retro gate | `resources/retro/retro.md` |
| `sub-command` | `retro --scan` | `resources/retro/scan.md` |
| `sub-command` | `retro --research <stack>` | `resources/retro/research.md` |
| — | planning: how a substep runs | `resources/plan/substep.md` |
| — | the order for each operation: substrate, payload, where each field comes from | `resources/orders.md` |
| — | which knowledge-base file is read where, and under what name a rule is filed | `resources/guidance.md` |
| — | what a round is; the attempt loop; why the loop stops where it does | `resources/build/round.md` |
| — | what the intake translation keeps and what it changes | `resources/intake/preservation.md` |
| — | the contract an activity file opens with | `resources/contract.md` |
