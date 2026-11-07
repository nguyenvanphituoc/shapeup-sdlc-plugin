# Review — the v4 design, read against a single-loop target

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Baseline** | 3.18.4 at `0081c38` (branch `docs/v4-design`); `npm test` green, 2381 checks |
| **Reviewed** | `requirements.md`, `analysis/01`, `analysis/02`, `analysis/_template.md` — and the shipped tree they describe |
| **Goal given** | Turn the plugin into a single loop; cut the scripts and kernel the loop does not need |
| **Amended** | 2026-11-07, against `constraints-2026-11-07.md`: rows for `run-args`, the `Workflow` grant, `probe stats` and `gate-zerowork` below are corrected in place and marked *(amended)*; the ~7,000-line total is now about 6,500 and the kernel and hook share about 3,200, as arithmetic on the old estimate, not a re-measurement |
| **Method** | Every count below is derived: enums from `kernel/schemas/domain.schema.json`, line counts from the filesystem, hook behaviour from the nine archived run ledgers under `traces/`. Nothing is taken from prose. Commands to re-run are in §9 |

## 1. Verdict

**The v4 folder is not yet a design of a single loop. It is a method for deciding whether to fold
workers — and it has one accepted requirement whose scope lives in a file that does not exist.**
Both analyses land on the same, correct line ("rent the loop, own a thin layer"), and both inventory
the ten *workers* as the things to audit. Neither names the **control plane**, which is where most of
the removable code is.

Three things follow, and they reorder the work:

1. **The largest "agent with no reason to exist" is not a worker. It is the courier.** The run
   script owns no shell, so every kernel command it needs is run by spawning a sub-agent whose whole
   job is to type one `node` command and relay the exit code. There are 51 such call sites in
   `tech-lead/workflows/shapeup-run.js` against 11 worker dispatch sites. None of the 51
   passes any of the kit's three criteria in `analysis/02`, and none of them appears in the run's own
   export — a courier leaves only an anonymous allow row in the safety spine's ledger.
2. **The control plane needs no ablation to remove.** `analysis/01`'s rule is that every component
   encodes an assumption about what the *model* cannot do. The couriers, the fast-forward, the
   `RunArgs`/`RunReturn` relaunch protocol, the staged script copy and the `Workflow` grant encode an
   assumption about what the *Workflow runtime* cannot do (hold a shell, pause for a human). Change
   the runtime shape and they have nothing left to assume. The measured-migration discipline of
   `analysis/02` is owed to the planning-chain fold — where the assumption really is about the
   model — and to nothing else on the cut list.
3. **What a single loop must keep is already written down**, as the "own" column of `analysis/01`
   and the invariants in `AGENTS.md`: a mechanical T0 the judge re-hashes, a write fence at the
   write, a gate ledger with a source, one writer for shared state, and an evaluator that did not
   see how the work was produced. Every one of those is a kernel subcommand or a hook today, and
   every one survives the loop unchanged (§6).

## 2. The v4 folder itself

| # | Finding | Evidence |
|---|---|---|
| F1 | **Broken scaffolding.** `requirements.md` sends the reader to a `README.md` beside it for "method and rules" and for the low-level scope of `V4-REQ-2`; `analysis/02` cites `analysis/03-context-first-audit.md` five times and `analysis/04-planning-chain-ablation-plan.md` twice. None of the three exists on any branch. The "Open questions" list ends with a heading for `analysis/02` and no items | `git ls-files docs/design/v4` → 4 files; `git log --all -- 'docs/design/v4/analysis/03*'` → empty |
| F2 | **The drift check cannot see this.** The structural suite's path check (`tests/structural/08-docs.mjs`, section 26c) matches citations that start with `docs/`, `skills/`, … — the v4 files cite each other by *relative* link, which the pattern does not reach. A whole folder of dead links is green | the regex in that file; this review is written to pass it, which is itself the demonstration |
| F3 | **One requirement, scoped off-repo.** `V4-REQ-2` is `accepted (narrowed: coverage + analyze)`, decided 2026-11-07 "by setting the implementation goal". The narrowing is the whole decision and it is recorded only in the missing `README.md`. `V4-REQ-1` is reserved for `analysis/01` and unassigned; `analysis/01` proposes no requirement | `requirements.md` rows |
| F4 | **The method contradicts its own first use.** `analysis/02`'s finding is that the fold question "cannot be closed from this repo's records" (no eval, no ablation, no cost axis). The requirement that folds two operations was accepted the next day. Either the method is "measure first" and the row is `proposed`, or the row is a *bet* and the registry should say so — a `Status` value for "accepted on architectural grounds, unmeasured" would make the distinction honest | `analysis/02` Finding; `requirements.md` row 2 |
| F5 | **Both analyses stop at the worker boundary.** The roster table in `analysis/02` has ten rows, one per `WorkerName`. The 51 courier dispatches, the 1,161-line fast-forward and the relaunch protocol are mentioned nowhere in the folder, although they are what §3 shows a run is mostly made of | §3 |

**What the folder does well, and should keep:** the template's "Claim / Command / Result" table;
"What would change this answer" in every file; the refusal to carry a number without a model and a
date. §9 of this review follows the same form so it can be re-run.

## 3. What a run is made of today

### 3.1 Code, by layer (shipped unless marked)

| Layer | Lines | Files | Note |
|---|---|---|---|
| `kernel/` (`.mjs`) | 16,527 | 43 | 32 subcommands under one entry point |
| `kernel/schemas/` | 149 KB | 4 | `ResumeState` + `RunArgs` + `RunReturn` = 20.7 KB, 22 % of the domain schema's definitions |
| `hooks/` | 1,904 | 7 | |
| `skills/` | 14,663 | 67 | `tech-lead` alone 3,932 — the run script 2,234, `references/protocol.md` 889, `references/gates.md` 605 |
| `oracles/` | 640 | 6 | T0's probing grammar |
| `commands/` | 269 | 11 | |
| `bin/` | 462 | 2 | |
| `scripts/` *(repo, public URL)* | 580 | 3 | frozen `curl` entry points |
| `tests/` *(repo)* | 26,644 | 131 | 1.4× kernel + hooks; 126 of them name `init/run.mjs` |

### 3.2 Agents per one-round run

From the fan-out arm under `traces/phase3/` (shipped, PASS in round 1, 4 scopes):

| Kind | Count | Where |
|---|---|---|
| Worker legs (`legs.jsonl`) | 11 — orient, analyze, wire, map-scopes, execute ×4, evaluate, hunt, hammer | 34 min of leg time |
| Courier call sites in the run script | 51 — `reduce graph` ×8, `probe resume` ×6, `reduce hill` ×5, `probe leg` ×4, `reduce ingest` ×3, two each of `verify trace`, `verify build`, `report export`, `reduce ship`, `probe eval`, `probe concurrency`, one each of eight others | each is `agent({model:"sonnet"})` running one command (`cmd()`, `query()`, `advisory()` in the script) |
| Courier executions | **not countable from the record.** A courier leaves no leg row, no receipt and no export row; its only trace is a `safety-spine` allow row whose `subject` is null | the plumbing is invisible to the instrument `V4-REQ-2` would need |

### 3.3 What the hooks decided, across all nine archived runs (6,861 rows)

| Hook | allow | deny | What the denials were |
|---|---|---|---|
| `safety-spine` | 5,268 | 0 | — |
| `sandbox-guard` | 748 | 22 | 13 scratch files under `/tmp` written by a worker's probe; 7 committed-tier files (`project-profile.md` ×3, a use-case file ×2, a scope contract, the knowledge base); 2 other |
| `validate-envelope` | 260 | 3 | order file not found |
| `dispatch-receipt` | 260 | — | records only |
| `gate-intake` | 243 | 0 | — |
| `gate-zerowork` | 57 | 0 | — |

This is the with/without evidence `analysis/01` asked for, as far as the record can give it: one hook
has a measured effect (the fence, and 7 of its 22 denials are the class it was built for), and three
have none on record. A zero is not proof of no value — a deterrent that is never tested leaves no
rows — but it is the number the ablation rule says to start from.

## 4. The target: one loop, four kinds of sub-agent

The session that runs `/ship` **is** the loop. No `Workflow` launch, no relaunch, no staged copy.

```
/ship <pitch>
  init run ──────────── receipt, run_id, gate ledger opened            (kernel, run by the loop)
  Orient ────────────── sub-agent: orient                               ⏸ L1a
  Plan (in the loop) ── coverage → analyze → wire → map-scopes          ⏸ L1b
                         verify spec is the only check between them
  Build ─────────────── per scope: compile → sub-agent: task-executor → ingest → verify t0
                         verify build once per round                    ⏸ L2
  Eval ──────────────── sub-agent: spec-evaluator                       ⏸ L3   FAIL → Build
  QA ────────────────── sub-agent: qa-edge-hunter
  Census (in the loop)  probe owner / requirements / attempts → cut list ⏸ H
  Ship ──────────────── reduce ship → REPORT.md → report export         ⏸ L4
  Retro (in the loop) ─ coach's questions to the PO                     ⏸ COACH-1
```

| Today | Under the loop | Why this is allowed |
|---|---|---|
| A gate is a `paused` return value; the PO answers; the orchestrator relaunches and the script fast-forwards from disk | A gate is one question to the PO in the same session (or a preset read); the answer is written to `gate-answers.json` and `harness gate --resolve` writes the ledger row with its source | The ledger row, its source and `on_missing: abort` for headless lanes are unchanged — the reason `gate.mjs` exists ("consent in prose gets paraphrased") is met by the row, not by the relaunch |
| 51 couriers | The loop runs `node harness.mjs …` itself and reads the exit code | `harness.mjs`'s own contract: exit codes are the API |
| Ten workers, each a `WorkOrder` in / `WorkResult` out | Four stay sub-agents — `orient` (reads far more than it returns), `task-executor` (parallel, fresh write fence per order), `spec-evaluator` (must not see how the work was produced), `qa-edge-hunter` (independent exploration against the running app). Six fold into the loop — `ba-pitch-analyzer`, `solution-architect`, `scope-architect`, `scope-hammer`, `coach`, `translator` | The four are exactly the rows `analysis/02` marks with kit criteria (1) or (2); the six are its `merge`/`fold` rows. `AGENTS.md` already says the committed tier "belongs to the orchestrator", so planning artifacts written by the loop obey the existing tier rule rather than breaking one |
| Resume after a kill is the script's fast-forward over a 10 KB `ResumeState` | Resume is `/ship` again: the loop reads the artifact predicates (`PHASE_ARTIFACT` in `kernel/probe/resume.mjs`) before it acts | Same property — state lives on disk, never in memory — with one mechanism instead of three |
| `--parallel-scopes N` is a scheduler inside the script | The loop spawns N `task-executor` sub-agents at once | ADR-0003: isolation is per write, enforced by the fence on each sub-agent's own calls; the scheduler's wave logic (`scopeEdges`, `releaseCeiling`) moves with it |
| `--tiny` and scope-less specs take a second, prose implementation of the loop (`references/protocol.md` Parts 1–2) | One loop; `--tiny` is a set of skip flags | A second implementation of the loop is the drift this repo's own rules warn about |

## 5. Cut list

"Lines" are today's. Verdicts: **cut** · **shrink** · **keep** · **PO** (a product promise, not a
mechanism — the PO's call).

### A — control plane (removable with the runtime change; no ablation owed)

| Path | Lines | Exists because | Verdict |
|---|---|---|---|
| `tech-lead/workflows/shapeup-run.js` | 2,234 | the run is a Workflow script | **cut** — the loop is the skill's own body; the wave scheduler and `sendBackOnce` move to the loop |
| `kernel/probe/resume.mjs` | 1,161 | fast-forward across relaunches; status machine; `closeRun` | **shrink** to the artifact predicates and the close (`PHASE_ARTIFACT`, `nextPhase`, `closeRun`, `markRelaunch`) — the part every ending still needs |
| `kernel/reduce/snapshot.mjs` | 291 | compaction resilience, derived from files | **shrink/merge** into the same predicates — two modules derive "where is the run" from the same files |
| `kernel/init/run-args.mjs` | 206 | compiles `RunArgs` for the launch | **cut, but its record moves into `init run`** *(amended)* — `reduce ship` reads the record to refuse a PASS for a run launched with no evaluation, and the model floor needs a new home in the kernel |
| `kernel/probe/staged.mjs` | 83 | finds the staged script copy | **cut** |
| `kernel/init/run.mjs` — the `.shapeup/workflows/` staging | part of 734 | the tool loads scripts only from the project | **cut** that part |
| `bin/lib/grant.mjs` `WORKFLOW_RULE`; `bin/init.mjs` `--no-native-workflow` | ~40 | the unscoped `Workflow` token | **stop adding it; delete nothing** *(amended)* — it is the user's token and a project may use it for its own scripts |
| `$defs` `RunArgs`, `RunReturn`, `ResumeState`, `Lane`, `RunSnapshot` | ~25 KB | the launch/return contract | **cut/shrink** with the above |
| `tech-lead/references/protocol.md` Parts 1–2 | ~550 of 889 | the prose lane | **cut** — Parts 3–4 (invariants, ledger format) stay |
| `commands/ship.md`, `commands/build.md` — the `Workflow({…})` blocks | ~60 | | **rewrite** |

### B — the folded workers (the craft stays; the envelope plumbing goes)

| Item | Today | Under the loop |
|---|---|---|
| `WorkerName` enum | 10 | 4 |
| `Operation` enum | 18 | 6 — `orient`, `execute`, `fix`, `spike`, `evaluate`, `hunt` |
| `kernel/compile.mjs` | 1,419; 18 operation cases with substrate templates, bug routing, trial history | the 12 folded cases and their `WorkOrderPayload` fields go; build/eval/hunt/orient stay (order of 600–700 lines) |
| Skill bodies of the six folded workers | 1,422 lines of `SKILL.md`, plus references | stay as skills the loop loads on demand — the kit's own prescription. What goes is each one's `--order` contract section and `payload` table |

The one fold that *is* a model-capability assumption — coverage, analyze, wire and map-scopes in one
context — is the row `V4-REQ-2` already accepted for the first two. Wire and map-scopes should follow
only after the handoff trace `analysis/02` asked for (its question 3), because that is the one place
the kit's `merge` and `fold` verdicts differ in what they cost.

### C — projections

| Path | Lines | Verdict | Why |
|---|---|---|---|
| `kernel/reduce/verdict.mjs` | 172 | **cut now** | Its own header: "not invoked at runtime". No caller in the run script, any skill, hook or command. Dead code that ships |
| `kernel/reduce/graph.mjs` | 482 | **cut — held** | 8 of the 51 courier sites. Built to answer "where am I" after a context loss and to trace a verdict; the first is the loop's own context plus the predicates, the second is a query over the export. Held: the PO kept `hill-chart` (proposal, decision 3), and the dashboard renders this graph |
| `kernel/probe/concurrency.mjs` | 535 | **cut** | Measures the fan-out dial. Its one measurement is frozen in `traces/phase2-criterion1/CONCURRENCY-BASELINE.json`; keep the record, drop the instrument |
| `kernel/probe/stats.mjs` | 477 | **shrink to the `--hooks` reader** *(amended; was: cut)* | ADR-0001's `warn` verdict exists so this reader can count advisory permits; it is cited by the design doc, the gate playbook and `AGENTS.md`. About 100 lines stay |
| `kernel/report/export.mjs` + `report/facts.mjs` | 618 | **keep, extend** | The fact tables are the only measurement substrate v4 has. Add the token/cost axis both analyses name as missing |
| `kernel/reduce/hill.mjs` + `skills/hill-chart/` | 322 + 1,586 | **PO** | A dashboard is a product promise, not a loop mechanism |
| `probe/leg`, `probe/eval`, `probe/hunt`, `probe/attempts`, `probe/owner`, `probe/requirements`, `probe/t0`, `probe/rounds`, `probe/digest` | 1,753 | **keep** | These are the "did the result say what the agent claims" checks and the census the loop branches on — the mechanical half of every gate |

### D — hooks

| Hook | Lines | Record | Verdict |
|---|---|---|---|
| `hooks/sandbox-guard.mjs` | 500 | 22 denials / 9 runs | **keep**; narrow the `/tmp` scratch class (13 of 22) so the fence's record is the writes it exists for |
| `hooks/tier-guard.mjs` | 162 | — (added after the traces) | **keep** — a rule at the write, the loop writes the committed tier more often, not less |
| `hooks/dispatch-receipt.mjs` + `kernel/verify/dispatch.mjs` + `kernel/verify/skills.mjs` | 437 | 260 receipts | **keep, shrink** to four skills |
| `verify envelope` on `Skill` | 288 | 3 denials | **keep** for the four dispatches that remain |
| `hooks/safety-spine.mjs` | 333 | 0 / 5,268 | **keep as insurance, mark as ablation candidate** at the next model upgrade (`analysis/01`'s rule) |
| `gate-intake.mjs` (in `hooks/`) | 109 | 0 / 243 | **cut** — in the loop the pitch is read by the session that was given it; an empty intake fails in view, not in a hand-off |
| `hooks/gate-zerowork.mjs` | 349 | 0 / 57 | **re-key**, about 200 lines *(amended; was: shrink to ~60)*. The predicate is "dispatched the orchestrator AND no receipt", so the dispatch detector stays; only the `Workflow` and Bash-launch arms and the `tech-lead` name go. The pathology it guards — a run narrated instead of run — gets *more* likely when the orchestrator is the model's own turn |

### E — the rest

| Path | Lines | Verdict |
|---|---|---|
| `scripts/` (`install-harness.sh`, `migrate.sh`, `shapeup-sdlc/lib/lib-harness.sh`) | 580 | **shrink to shims** that exec `npx shapeup-sdlc init`. `scripts/FROZEN.md` freezes the URLs, not the behaviour, and says so |
| `oracles/` | 640 | **keep** — T0 is the one measurement no agent can fabricate |
| `tests/` | 26,644 | follows the cut: a removed module takes its tests; `init/run.mjs` is named by 126 files, so that shrink is the expensive one. The `harness-maintenance-audit` skill is the tool for the pass |

**Order of magnitude:** sections A, C, D and E remove about 6,500 lines *(amended; was 7,000)* across the run script, the
kernel, the hooks, the prose lane and the install scripts, plus ~25 KB of schema — before any worker
is folded. The `kernel/` + `hooks/` share of that is about 3,200 lines *(amended; was 3,600)*, roughly one sixth of those two trees. Section B is
where the design decision sits; its line count is small next to A.

## 6. What the loop keeps, and the reason each one survives

| Invariant (`AGENTS.md`) | Mechanism | Why the loop does not weaken it |
|---|---|---|
| Measured, not claimed | `verify t0`, `verify build`, the oracles, the T0 citation the judge re-hashes | run by the loop, graded by a sub-agent that did not write the code |
| Writes outside the substrate are refused at the write | `sandbox-guard` on live orders; `tier-guard` on content | hooks fire on every tool call, the loop's and the sub-agents' |
| One writer for shared state | `reduce ingest` and its lock | still the only path a `WorkResult` takes to the board |
| A gate is a ledger row with a source | `gate --resolve`, presets, `on_missing: abort` | the question moves into the session; the row does not |
| Attested, not assumed | `dispatch-receipt`, `verify dispatch`, `verify skills` | four dispatches instead of ten; the false-green it closes is unchanged |
| Single judge; QA has no verdict | `spec-evaluator` and `qa-edge-hunter` stay sub-agents | the two separations both Anthropic lines in `analysis/02` keep |
| Every ending records a close and exports | `closeRun`, `report export` | one ending site instead of many — easier to keep, not harder |

## 7. Risks the loop re-opens, and the check for each

| Risk | Why the loop makes it worse | Check |
|---|---|---|
| **Narration.** The session describes the run instead of running it | the orchestrator is now the model's own turn; nothing dispatches it | the Stop receipt check (re-keyed `gate-zerowork`); every phase advance reads a kernel exit code, never the loop's own prose |
| **Context.** Planning for a large pitch in one window | spec tree + wiring map + scope contracts are the biggest artifacts a run writes | `V4-REQ-2`'s narrowing; the handoff trace before wire/map-scopes follow; the artifact predicates make a compaction a resume, not a loss |
| **The loop edits while an order is live** | the fence covers the loop's Edit/Write only inside a live order's substrate | discipline plus the existing `sandbox-guard` row; measure its deny count on the loop |
| **Prompt-cache cost.** The repo's own docs say the run script's sub-agents share the session's cache; Agent-tool sub-agents may not | more cold starts per dispatch | the token/cost axis on the `leg` table — the measurement v4 already owes itself |
| **Headless lanes.** No `Workflow` means no resume-from-journal | a `claude -p` run that dies mid-round | `/ship` re-derives from disk on entry; the same property, one mechanism |

## 8. Candidate requirements

For `requirements.md`, as `proposed`; the PO decides. Each is one outcome a maintainer can observe.

| Candidate | Requirement | Priority |
|---|---|---|
| V4-REQ-3 | Every agent a run spawns has a row in the run's export naming its worker and duration; a run has no agent its own records cannot see | must |
| V4-REQ-4 | A gate is answered in the session that reached it; no relaunch and no fast-forward follow a PO's answer, and the gate row still carries its source | must |
| V4-REQ-5 | Opening a run needs no permission beyond the kernel's two Bash rules: the installer adds no `Workflow` token, and no copy of the orchestrator is staged into the project | must |
| V4-REQ-6 | Every kernel subcommand that ships has a runtime caller; one with none is removed in the same release that finds it | must |
| V4-REQ-7 | A run killed at any point resumes by invoking `/ship` again; the resume point is read from artifacts on disk and from nothing else | must |
| V4-REQ-8 | The export's `leg` table carries tokens and cost per leg | should |
| V4-REQ-9 | The published install URLs keep resolving and delegate to the installer | should |
| V4-REQ-10 | Each hook's release notes carry its deny count over the archived runs; a hook at zero across them is named as an ablation candidate at the next model upgrade | could |
| V4-REQ-11 | Wire and map-scopes produce their committed artifacts from the same context as coverage and analyze — *after* the handoff trace `analysis/02` question 3 asks for | could |

Housekeeping the folder needs before any row is judged: write the `README.md` the registry already
points at (method, and the `V4-REQ-2` low-level scope); either write `analysis/03` and `analysis/04`
or remove the seven citations; fill or delete the empty "From analysis/02" list; and give the drift
check a rule for relative links inside `docs/` (a code fix, reported separately from the doc fixes,
as the maintenance audit's own convention requires).

## 9. Evidence — re-run these

| Claim | Command | Result on 2026-11-07 |
|---|---|---|
| 10 workers, 18 operations, 32 subcommands | `node -p "require('./kernel/schemas/domain.schema.json').$defs.WorkerName.enum.length"`; same for `Operation`; `node kernel/harness.mjs --help` | 10 · 18 · 32 |
| 51 courier call sites, 11 worker sites | `grep -cE '\b(cmd\|query\|advisory)\(' tech-lead/workflows/shapeup-run.js`; `grep -c 'skill: "' …` | 51 · 11 |
| Courier verbs | `grep -oE '(cmd\|query\|advisory)\(\s*\`[^\`]*\`' …` then tally the first two words | `reduce graph` 8, `probe resume` 6, `reduce hill` 5, `probe leg` 4 … |
| Hook verdicts | tally `hook` × `verdict` over every `decisions.jsonl` under `traces/` | 6,861 rows; `sandbox-guard` 22 deny; `safety-spine`, `gate-intake`, `gate-zerowork` 0 deny |
| Couriers leave no record | the same rows: `safety-spine` Bash rows carry `subject: null` | 0 kernel commands attributable from the ledger |
| One-round run | `legs.jsonl` in `traces/phase3/fanout-arm-shipped/` | 11 legs, 34.1 min; the sequential arm 10 legs, 28.9 min |
| Schema weight | `JSON.stringify` each `$defs` entry | `ResumeState` 10,285 B, `RunArgs` 5,630 B, `RunReturn` 4,817 B of 93,205 B |
| `reduce verdict` has no caller | `grep -rn "reduce verdict" skills hooks commands` | no match; the module's header says the same |
| Missing v4 files | `git log --all --oneline -- 'docs/design/v4/analysis/03*' 'docs/design/v4/analysis/04*'` | empty |
| Tests pin the cut | `grep -rl init/run tests \| wc -l` | 126 files |

## 10. What would change this review

- A measured run of the loop on the same pitch as the fan-out arm, same model, dated, showing more
  tokens *per shipped scope* than the archived run. That would put a price on the lost prompt-cache
  sharing and could keep the Workflow launch for the build phase only.
- A trace showing the planning chain loses an id, a clause or a seam when wire and map-scopes run
  in the planning context. That keeps those two as sub-agents and leaves `V4-REQ-2` where the PO put it.
- A denial from `gate-intake` or `gate-zerowork` on a live run. One row would move either from
  **cut** to **keep**.
- The `Workflow` runtime gaining a shell for the control plane, or a pause that does not end the
  launch. Either removes the courier and the relaunch without removing the script, and §5-A would be
  re-read against that.
