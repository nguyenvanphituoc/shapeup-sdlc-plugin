# ShapeUp SDLC v2.0 — The Strip-Down Plan

**Goal:** fix every finding from the review (BAD-1…7), close the permission fragility, and land on **Tier 2** — markdown skills + native Dynamic Workflow + one tiny deterministic kernel — so the plugin is small enough for one person to maintain and robust in environments that ignore permission grants.

**One sentence:** *delete the runtime, fan out the scopes, shrink 21 scripts to 1 kernel, make the state a graph, keep only the hooks that are walls.*

**Target metrics — measured bottom-up, not estimated.**

> **Correction (v2 of this plan).** An earlier draft targeted "≤15,000 LOC repo-wide." Measurement disproved it: consolidation removes *surface area*, not proportional lines (`compile-order.mjs` is 565 lines because compiling a WorkOrder genuinely takes 565 lines), and it conflated shipped LOC with repo LOC. The realistic cut is **−33%, not −67%**. More importantly, **LOC is the wrong primary target here** — it rewards deleting templates and references, which are the product, not the bloat. Surface area is what actually tracks maintainability.

**Primary metrics (surface area):**

| Metric | Today (v1.7.0) | Target (v2.0) |
|---|---|---|
| Executable script files | 24 | **~11** (1 entry + core modules) |
| Permission strings written by `init` | **6** (3 owners × 2 spellings) | **1** |
| Runtimes owned | 1 (`run-workflow.mjs`) | **0** — native Workflow tool |
| Hooks | 10 | **4 hard** |
| Comment density, shipped JS | **36%** (3,649 / 10,056) | **~18%** |
| Orchestrator script | 911 lines, courier-defended | ≤ 600, zero couriers |
| Skills requiring any change | — | **2 of 12** |
| Scope build | sequential | parallel (`pipeline()`; worktree isolation declined, see Phase 3 update) |
| Resume | directory re-scan every launch | one bounded graph query |
| Sub-agent dispatch | cold `claude -p` per worker | in-session, prompt-cache-warm |

**Secondary metric (LOC budget, measured):**

| Bucket | Today | v2 | What changes |
|---|---|---|---|
| Logic (kernel + schema) | 9,492 | ~6,400 | −`run-workflow`, −boilerplate, −trimmed `$defs` |
| Content (SKILL.md, references, templates) | 10,091 | ~8,200 | consolidation only — capability preserved |
| Hooks | 2,144 | ~1,100 | 10 → 4 |
| **Shipped total** (`package.json` `files`) | **~24,240** | **~17,000** | **−30%** |
| Non-shipped (tests, docs, evals, `.claude/`) | ~21,250 | ~13,500 | −evals, −CHANGELOG, +ADRs, +6 probes |
| **Repo total** | **45,490** | **~30,500** | **−33%** |

**Where the mass actually is** — two skills are 75% of all skill code; the other ten are already lean and are *not touched* by this plan:

| Skill | SKILL.md | refs | templates | scripts | schemas | total |
|---|---|---|---|---|---|---|
| **tech-lead** | 136 | 1,326 | — | 6,189 | 2,657 | **11,290** |
| **ba-pitch-analyzer** | 180 | 1,746 | 1,822 | 480 | — | **4,228** |
| spec-evaluator | 220 | 1,319 | — | 166 | — | 1,798 |
| shapeup | 403 | — | 1,130 | — | — | 1,533 |
| *other 8 skills* | 116–339 each | 102 | — | — | — | **1,875** |

---

## 0 · The target architecture (what v2.0 looks like)

**Three layers, five planes respected:**

1. **Skills = markdown.** All 10 workers + tech-lead stay pure SKILL.md + references. No worker ever needs a permission grant — craft is prompts. Structured responses come from the native runtime's `agent(prompt, {schema})`, not from scripts. (Property A of the Tier discussion: free.)

2. **Control = one native Workflow script.** `shapeup-run.native.js` (already drafted) runs on the `Workflow` tool: fan-out via `pipeline()`, per-scope worktree isolation, schema-validated returns, no shell of its own, no courier.

3. **Kernel = one deterministic CLI.** Everything that *must* be hard — verify, reduce, gate, probe — becomes subcommands of a single script:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs <verify|reduce|gate|probe|init|report> [flags]
   ```

   One entry point ⇒ **one permission prefix** ⇒ the whole permission story is one line:
   `Bash(node ${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs:*)`.
   The kernel is called from *inside worker legs* (which have real shells), so the control script needs no Bash at all.

   | Subcommand | Absorbs today's | Why it must stay deterministic |
   |---|---|---|
   | `verify` | t0-verify, ratchet-tree, seesaw, budget-check | "Measured, not claimed" — a model verifying itself is claimed |
   | `reduce` | ingest-result, hill-derive, run-snapshot, ship-report | Single-writer invariant; also appends the run graph |
   | `gate` | gate-answers (0/4/5 exit convention unchanged) | An answer file, not a vibe; audit record |
   | `probe` | resume-state, stats, aegis-digest | Fast-forward = bounded graph query, byte-stable |
   | `init` | init-run, fit-check (bin/init.mjs stays separate for install) | Receipt + run open/refuse (exit 3) |

4. **State = one run graph.** `.shapeup/<slug>/graph.jsonl` — append-only, one JSON node/edge per line, written *only* by `reduce`. Two node families kept deliberately separate (article: commit DAG ≠ knowledge graph): work-lineage (`Order, Result, Verdict, Trial, GateDecision`) and domain (`Requirement, UseCase, Scope, Seam`). Markdown artifacts (spec tree, reports) remain the human-readable projections; the graph is the machine-readable truth `probe` queries.

**What is deliberately NOT changed:** the envelope port (WorkOrder/WorkResult + `domain.schema.json`), the gate semantics and `RunReturn` union, the operation vocabulary, the single-judge + EVAL-once-per-round invariants, the three-level breaker, Shape Up phase order. The tech-lead Step-3 branch table keeps working unmodified.

---

## 1 · The phases

Seven phases, each independently shippable, each with a hard "done when." Order matters: subtraction first, capability second, polish last. Run each phase through your own harness (`/ship`) — the plugin should eat its own dog food during its rebuild.

### Phase 0 — Freeze & baseline *(half a day)*
- Tag `v1.7.0-final`; branch `v2`. CHANGELOG note: v1.x is the script-runtime line, maintenance-only.
- Record baseline: one full run of the example feature on today's lane; keep its `.shapeup/` tree and cost/wall-clock numbers as the comparison fixture for Phase 7.
- **Done when:** tag pushed, baseline run archived.

### Phase 1 — Kernel consolidation *(fixes: permission fragility, BAD-6 partially)* *(2–3 days)*
The subtraction that unlocks everything else, and it doesn't touch behavior.
- Create `kernel/harness.mjs` + `kernel/lib/{paths,argv,schema}.mjs`. Move the 21 scripts' logic under the five subcommands; **delete originals** as each moves. Keep exit-code contracts identical (gate 0/4/5, init 3, budget 6).
- While moving, apply the archaeology rule (BAD-6): keep comments stating the *current* contract; delete narrated dead bugs. **This is measurable** — shipped JS is 36% comments today (`paths.mjs` 70%, `t0-verify.mjs` 47%). Target ~18%, worth ~1,200 lines and the single largest recoverable block in the repo.
- `bin/init.mjs`: replace the prefix set with the single kernel line + write the optional `"Workflow"` grant behind a `--native-workflow` flag (default **on** in v2; `--no-native-workflow` documented for locked-down orgs, falling back to interactive-only use). Update `.claude/settings.local.example.json` to show exactly these two lines.
- **Experiment (optional, ~half a day):** test whether *vendoring* the kernel into the project at init time (`.shapeup/kernel/harness.mjs`, version-stamped, refusing to run on a stamp mismatch) reduces permission friction versus running it from `${CLAUDE_PLUGIN_ROOT}`. Pass criterion: a headless run with **zero** approval prompts under `default` permission mode. If it passes, adopt it; if not, keep the plugin-root path and record the result. Do not assume either way — measure.
- **Done when:** structural tests green against the kernel; `grep -r "scripts/" skills/` finds only `kernel/harness.mjs` references; init writes ≤2 permission lines; executable script files down from 24 to ~11.

### Phase 2 — Native runtime swap *(fixes: BAD-1, BAD-2, BAD-5)* *(2–3 days)*
- Adopt `shapeup-run.native.js` (delivered with the review) as `skills/tech-lead/workflows/shapeup-run.js`. Tech-lead SKILL.md Step 2 changes from "background Bash + run-workflow.mjs" to "launch via the `Workflow` tool with `{scriptPath, args}`"; Step 3 branch table unchanged.
- **Delete** `run-workflow.mjs` and every courier defense: `mech()`, `parseMechJson`, `mechEnvelope`, the EXIT-marker prompts, `resultFor`/`baseOf`. Workers now compile/ingest via the kernel *in their own shells*; the control script only branches on schema-validated `agent()` returns.
- Mechanical calls the control script still needs (gate, probe, reduce-checkpoints) go through the `cmd()`/`worker()` helpers already in the native script — a cheap sub-agent runs the kernel and returns `{exit_code, ok, detail}` typed. No stdout parsing anywhere.
- Keep the sequential scope loop for THIS phase (one change class at a time).
- **Done when:** the baseline feature ships end-to-end on the native tool, interactive and headless (`--unattended` with `preset:ci`); repo contains zero `claude -p` spawns; diff is net-negative ≥1,500 LOC.

### Phase 3 — Fan-out *(fixes: BAD-3)* *(2 days)*
- Flip the scope loop to `pipeline(scopes, buildScope, reduceScope)` with `isolation:'worktree'` on build legs. The attempt-ratchet already lives inside the worker leg (`kernel verify` called per attempt).
- **Delete** branch-per-scope checkout and the shared `active-scope` pointer — the worktree *is* the isolation; `sandbox-guard` still enforces each order's substrate whitelist (it reads the order, not the pointer — verify this, it's the one hook-coupling risk in the plan).
- Add `args.maxParallelScopes` (default 4) so cost stays a dial, honoring the article's "can the organization afford the cost?" question.
- **Done when:** a 3-scope feature builds with ≥2 scopes concurrently, board/ledger uncorrupted (the reducer proves itself), wall-clock beats Phase-2 baseline by ≥30%.

> **Closed — see `RESULT-P3.md`.** D1 met and now measurable rather than asserted (`2 (exact)` on a
> shipped run); D2 met, and it was false before (four concurrency defects, each invisible to a green
> suite); **D3 not met, and measured rather than estimated** — 62% on the wave that can fan out,
> ~21% on the round, 0% from the scheduler change itself. The ceiling is arithmetic: a feature with
> three waves of which one is wide can never hide more than one leg's duration behind another. The
> clause's own baseline is also the wrong comparison — Phase 2 kept the *sequential* loop, so the 30%
> was bought by fan-out existing at all. And the experiment as specified is unrunnable: it asks for
> "everything else held" while the scope cut is decided by a model each run, which on this pitch gave
> four scopes once and one the next time. Two items go
> against the text above with the evidence recorded: `isolation:'worktree'` is declined in ADR-0003
> (the reason on record turned out to be false; what declines it is that a worktree disarms the
> substrate wall and nothing merges it back), and the `active-scope` pointer is kept because the
> dangerous *substrate* pointer was already gone and what carries the name is a write-once *run*
> pointer. The one hook-coupling risk this phase was told to verify was real and misnamed:
> `sandbox-guard` is coupled to `cwd`, not to that pointer.

> **Update — D3 retired (double-checked against the `D3-fanout-analysis` and `FINAL-harness-report`
> artifacts, 2026-08-19).** The box above's "not met" undersold it: D3 is not merely unmet this
> round, it is unreachable by the only mechanism anyone has proposed. The obvious next step —
> release a dependent scope at T0-settled instead of leg-settled — was modeled at 31.6–36.6% and
> then actually built and measured at **23.005%**, because the model's premise was wrong: T0-settled
> and leg-settled are both written inside one sub-agent turn, so the control script cannot observe
> the earlier boundary at all. A companion fix (batching dispatch counts) added **21.884%** measured
> separately; the two are substitutes, not complements — **25.510% jointly**, still short of 30%.
> No further scheduler work closes this; it is a platform limit on the `agent()` abstraction, not a
> tuning gap.
>
> It also would not have mattered much if it had closed. BUILD's fan-out returns **3.3–3.6% of a
> total run** on the two runs measured — the round D3 grades is 11–20% of a run whose phase shares
> move up to 3.17× between identical-pitch runs (QA alone: 620s / 276s / 208s / 195s across four runs
> of one pitch). ANALYZE, not BUILD, is the phase that's actually large and stable (22–27% across
> runs) — and it is a constant-rate writer (measured 95.8 B/s ±9.9%), not a schedulable phase. The
> one attempt to speed it by splitting it produced a *thinner, less correct* spec tree that still
> shipped a PASS verdict with fewer EVAL criteria, undetected — so "make ANALYZE faster" is not a
> safe substitute goal for D3 either.
>
> **D3 is retired as written.** D1 and D2 stand — the scope loop is genuinely parallel and the
> corruption probes did their job. A run-level wall-clock clause may replace D3 later, but only after
> Phase 3.5 below closes the certification gap; a speed number measured on a harness that can
> silently skip building a scope is not a number worth keeping. Two smaller corrections while
> re-reading this phase: `isolation:'worktree'` in the bullets above reads as shipped — the box above
> already says it was declined, so no code should exist that uses it. And `maxParallelScopes`
> default 4 in the bullets above is a ceiling the contracts usually don't reach — this feature's own
> realized ceiling was 2 — so the dial is not the lever the bullet implies; a scope cut's dependency
> depth is.

### Phase 3.5 — Close the certification gap *(new, from the two-artifact review)* *(6–7 days)*
Phase 3's own probes only looked for corruption. The nine-arm review that produced the D3 verdict
above went looking for speed and found something worse: the harness can report success on work it
did not do, and every layer built to catch that reports success too. This phase closes that gap
before Phase 4 builds a queryable graph on top of it — a graph derived from a system that can
silently skip dispatching a scope is confidently wrong, not just incomplete.

- **Two run-killers, first.** The model floor (`shapeup-run.js`) tests exact spelling against a
  two-entry allowlist, so every real model id (`claude-opus-5`, `claude-sonnet-4-5`, `opusplan`)
  aborts the run before Preflight — following the shipped documentation kills the run. Fix: reject
  only what is *provably* below the floor; an unrecognized string passes, matching this repo's own
  fail-open rule. Separately, a dispatched-but-unanswered order wedges the tech lead's committed
  writes and `--force` does not clear it — needs a real unwedge path.
- **The T0 ratchet's revert.** `kernel/verify/t0.mjs:530` reads `contract.substrate?.allowed` — a
  path no `ScopeContract` has; every sibling reader uses `allowed_file_substrate`. The bound is
  therefore always `[]`, the pathspec-bounded `restore()` in `ratchet-tree.mjs` correctly refuses on
  principle every time, and the caller's own "first trial, nothing to restore to yet" fallback fires
  on *every* subsequent restore too — silently promoting a **failing** attempt's tree as the new
  baseline. Fix the field name **and** gate the fallback on "no prior kept trial exists," not on
  "restore returned not-ok for any reason" — a field-name fix alone still falls through to the same
  wrong behavior on a genuine git-level restore failure. A companion fix is needed at
  `kernel/reduce/graph.mjs:202` — the report ships these together and warns that the field fix alone
  leaves a related path ungated. Add a test that drives this through `t0.mjs`'s own CLI entry with a
  real contract object, not `restore()` called directly — no existing test does, which is why this
  survived.
- **Stop certifying an unrun regression check.** `hill.mjs` infers `seesawGreen` from
  `regression === false` on a green T0, but nothing anywhere writes the seesaw registry or passes
  `--seesaw-registry`, so `regression` is always `false` — "not asked," read as "clean." A scope
  reaches FINISHED on a check that has never executed. Stop the inference; then explicitly choose,
  as a Betting Table decision, whether to wire the registry for real (cost: re-runs every finished
  scope's fixtures on every later attempt) or delete the dead plumbing. Do not ship the machinery
  half-armed and silent about it.
- **Fix the order-id collision.** `compile.mjs`'s order suffix is unique per scope only for BUILD
  orders (`scopeId-r{round}-a{attempt}`); every other operation falls back to
  `{operation}-r{round}` or bare `operation`, so N concurrent legs of the same non-BUILD operation
  overwrite each other's dispatch file while the run reads green. Give every operation the same
  per-leg discriminator BUILD already has.
- **Reconcile the board against contracts on disk.** The defect that motivated this whole phase: a
  whole scope was cut, never dispatched, and the board still read `✅ done` because nothing compares
  the board's rows to what's actually on disk (contracts, task files, dispatched orders). This is the
  cheapest fix in the phase — both artifacts already exist on disk — and no check does this today.
- **Floor the spec tree.** The correctness hole behind the ANALYZE-speed trap above: nothing stops a
  spec tree that derives *nothing* from the pitch from shipping green, because a criteria-count check
  can't tell a healthy small tree from a silently thin one. Add a lint that fails when the raw idea
  names explicit constraints (a No-gos/Constraints/Edge-cases section) and the tree declares zero
  invariants anywhere.
- **Verification hygiene, before trusting any number this phase produces.** Confirm the concurrency
  probe's own process-matching doesn't match its own command line, and that whatever reads "which
  run is this" doesn't cross two run directories when more than one exists. An instrument that has
  never once said no is not evidence — the same standard this phase holds the product to applies to
  the tools measuring it.
- **Done when:** every fix above is watched red first (re-introduce the defect, confirm the specific
  new test fails for the reason it should, restore, confirm green — this repo's own standing method),
  `npm test` stays green throughout, and a fresh live run of a multi-scope feature — forced to include
  at least one failing attempt on one scope and a legitimate concurrent build on another — produces a
  board, a T0 trial history, and a hill status that all agree with the actual dispatched orders on
  disk.

*(Lower priority, only if capacity remains after the above: the small proven perf wins the same
review found — dispatch batching, dropping a projection call nothing reads, trimming the relaunch
fast-forward. Together worth roughly 5% of a run. Not worth their own phase.)*

> **Closed — see `RESULT-P3.5.md`.** All eight items and the Done-when both met. The T0 ratchet
> field-name bug was the most load-bearing fix in the phase — the fallback was silently promoting a
> **failing** attempt's tree as the new kept baseline on every genuine restore failure, not only the
> first-trial case the field-name fix alone would have covered. The seesaw check got the Betting
> Table decision the plan asked for rather than a silent default: registry-wiring deferred (real
> running cost), the false-positive inference removed either way. Verification hygiene on the
> measuring tools came back **confirmed safe, not a defect** — both claims were watched red before
> being accepted, which is not the same thing as assumed clean. The Done-when's live run exercised
> the T0 ratchet fix for real (a genuine CRLF-parsing failure, retried, fixed) and S8's own
> concurrency probe measured real `max_concurrent: 2`, inside a dedicated `git worktree`, never the
> working tree or a plain clone. One incident worth carrying forward: a leftover scratch clone in
> the execution run's own working directory got mistaken for a working copy by three separate
> stage-executing agents, and one recovery attempt was phrased as a push to a remote and correctly
> blocked by the safety classifier before anything was touched — the lesson recorded in
> `RESULT-P3.5.md` §3 is about workdir hygiene during a run, not about this phase's fixes. Phase 4 is
> now unblocked: the graph it builds is no longer built over a system that can silently skip
> dispatching a scope.

### Phase 4 — The run graph *(fixes: BAD-4)* *(2–3 days)*
- `reduce` appends typed nodes/edges to `graph.jsonl` alongside its existing writes; `probe` answers from the graph (`--subgraph run` returning the `SUBGRAPH` shape the native script already expects). Markdown board/ledger become projections regenerated by `reduce` — humans keep their files, machines stop parsing them.
- Migration shim: on first v2 run over a v1 `.shapeup/` tree, `probe` falls back to the directory walk once and `reduce` backfills the graph from it.
- Retire `session-rehydrate` + `compact-snapshot` hooks: rehydration after compaction is now "run `probe`" — one line in tech-lead SKILL.md, not two hooks.
- **Done when:** kill -9 mid-BUILD → relaunch fast-forwards from the graph re-dispatching nothing completed (the kill/resume probe, rerun); the reliability sentence is demonstrable: pick any verdict node, walk edges back to objective/plan/artifact/T0/gate in one query.

> **Closed — see `RESULT-P4.md`.** Most of this phase's own text had already shipped before Phase
> 3.5 even closed (commit `94acc4b`, 2026-08-14): the graph read model, the migration/backfill
> shim (by a simpler, single-path design than the plan described — no separate directory-walk
> fallback was needed, since `appendGraph`'s backfill already covers a v1-vintage tree through the
> same code path as a fresh run), and the `session-rehydrate`/`compact-snapshot` hook retirement.
> The one real gap, confirmed by reading the code rather than assumed: gate crossings were never
> durably recorded anywhere on disk — `gate.mjs` computed a ledger row on every resolve but nothing
> wrote it — so the Done-when's own "…T0/gate…" reachability requirement was unmet and no
> `GateDecision` node type existed. Fixed: `gate.mjs` now appends every resolved crossing to
> `.shapeup/<slug>/gates.jsonl`; `reduce graph` projects it into a `GateDecision` node keyed on gate
> id **+ occurrence ordinal** (the same fix this file already applied once to a trial-id collision,
> generalized correctly), wired via `DEPENDS_ON` to its round's T0 verdict when one exists, else to
> the `Run` node. Both Done-when clauses demonstrated live, not only in a fixture: a genuine `kill
> -9` mid-BUILD, relaunched fresh, correctly skipped the completed scope (byte-identical order/result
> files) and built only the incomplete one; a real `reduce graph --trace` query against that live
> run's own graph, from a real verdict node, reached two `GateDecision` nodes at hop 1. One finding
> surfaced, not a phase failure: the new instrumentation made visible (for the first time — nothing
> could see it before) that a relaunch re-crosses `L1a`/`L1a.5`/`L1b` a second time even though those
> phases' *work* is correctly fast-forwarded — a pre-existing characteristic of the orchestrator's
> resume model, not a regression from this phase, and not a defect this phase's own Done-when is
> about; left on record for whoever next touches `kernel/probe/resume.mjs`.

### Phase 5 — Hook diet & enforcement honesty *(fixes: permission story, BAD-6 rest)* *(1 day)*
- **Keep 4 hard hooks:** `safety-spine` (machine safety), `sandbox-guard` (substrate walls — the parallel-safety backstop), `gate-intake` (no empty dispatch), `validate-envelope` (no uncompiled order).
- **Delete 6:** `gate-l2` (already advisory — becomes a `reduce` warning in the L2 gate context), `gate-deadline` (breaker already lives in `verify`/budget), `gate-zerowork`, `anti-rationalization`, `slop-cleaner` (fold the useful checks into spec-evaluator's dimensions or the ship report), `session-rehydrate`/`compact-snapshot` (Phase 4).
- **Write the diet up as a decision record.** Deleting an enforcement control is security-adjacent: never remove one silently — record the decision and either name the compensating control or state the accepted risk. Git preserves the code; the ADR preserves the *judgment*, and git is a pull medium nobody queries for a file they never knew existed. Triage: one line each for the four that were **relocated** (`gate-l2`, `gate-deadline`, `session-rehydrate`, `compact-snapshot`) and for `slop-cleaner` (folded); a **full entry** for `gate-zerowork` and `anti-rationalization`, which have **no compensating control** — each encodes an expensively-learned failure mode ("the agent described the work instead of doing it"; "claimed done while the facts disagreed"). For each: what it caught, what replaced it or why the risk is accepted, and what evidence would justify reinstating it.
- Those two dropped guarantees also belong in the **CHANGELOG + upgrade notes** — anyone running unattended needs to know *before* upgrading, not after.
- **No tombstone comments in code** ("we used to have a hook here that…"). That is the same BAD-6 archaeology this plan deletes elsewhere; deleted code leaves a clean codebase, the record lives in the write-up.
- README enforcement table rewritten honestly: which guarantees are walls (hooks — work under every permission mode), which are runtime (schemas, worktrees), which are advisory. This is the direct answer to the bypassPermissions concern: **nothing load-bearing depends on permission mode anymore.**
- **Done when:** hooks/ contains 4 files + hooks.json; the judgment is recorded somewhere a reader lands on without knowing to look — it went into the v2.0.0 CHANGELOG entry and `docs/design/03-system-design.md` §3.2/§3.2c/§3.2e rather than a new ADR, because the diet changed the enforcement model those sections describe and belongs next to it; README table matches reality.

> **Closed — done in two waves, both already on `main` before this box was written.** The diet
> itself landed 2026-08-14 (`aa63ce8`): `gate-l2`, `gate-deadline`, `session-rehydrate`,
> `compact-snapshot`, `anti-rationalization`, and `slop-cleaner` are all deleted from `hooks/` —
> six files, matching the plan's count — with the triage table (relocated vs. folded vs. accepted
> risk) shipped in the same commit into README's enforcement table, `CHANGELOG.md`, and
> `docs/design/03-system-design.md` §3.2/§3.2b/§3.2c/§3.2e, exactly where the Done-when asked for
> it, not as a new ADR.
>
> One deviation from the bullet text, made deliberately and documented at the time rather than
> silently: **`gate-zerowork` was kept, not deleted.** The plan's delete-list named it alongside
> the other six; the commit message gives the reason — it is the one check with a mechanical,
> unspoofable predicate ("dispatched the orchestrator, left no run receipt") that catches the
> failure mode this harness was built for, a run that narrates its own pipeline and does none of
> it. §3.2b records why nothing else in the runtime can substitute for it. That leaves **4 hard
> `PreToolUse`/`Stop` walls**, matching the plan's real target (`safety-spine`, `sandbox-guard`,
> `gate-intake`, `verify envelope` + `gate-zerowork` as the one blocking `Stop` hook) — the bullet
> text's own count was one hook short of what its rationale actually argued for.
>
> A second, later addition means the Done-when's literal "4 files" is no longer true on disk.
> `863e894` (2026-08-15, Phase 3.5-adjacent) added `hooks/dispatch-receipt.mjs` — a `PostToolUse`,
> records-only hook answering a question the diet never asked ("did the shipped skill actually
> run", not "may this call proceed"). `hooks/` therefore holds **5** `.mjs` files today, not 4.
> This is not drift: it is documented in its own right (§3.2a), it has no deny path so it adds no
> new wall to audit, and `tests/structural/08-docs.mjs` §26 mechanically checks hook-inventory
> parity across `hooks.json`, README, `docs/design/03-system-design.md`, and `SECURITY.md` on
> every run — currently green. The number in this phase's own bullet is stale; the enforcement
> model it was protecting (four hard walls + one narrow Stop block) is intact, and everything that
> arrived afterward earned its place by the same standard, on the record, in the same places a
> reader already lands.
>
> `npm test` — 1203 checks, including the doc-drift parity check above — is green throughout; no
> code or doc changes were needed to close this phase, only recording that it already had been.

### Phase 6 — Skill & docs diet *(maintainability)* *(2 days)*
**Scope is narrower than it looks: only 2 of 12 skills need work.** `tech-lead` (11,290 lines) and `ba-pitch-analyzer` (4,228) are 75% of all skill mass; the other ten are 116–403-line SKILL.md files that are already lean and are **not touched**. Do not "tidy" them — that is scope creep with no payoff.
- **tech-lead:** SKILL.md shrinks to open run → launch Workflow → branch on RunReturn → L4 (the `--tiny` prose fork stays, now the *only* prose lane). Consolidate `references/` (8 files, 1,326 lines) into 3: `gates.md`, `protocol.md` (round+delegation+state), `tiny-lane.md`. Trim `domain.schema.json`'s unused `$defs` — but treat the schema as **contract, not bloat**: it is 2,466 lines because it defines every cross-boundary record, and cutting it is capability loss.
- **ba-pitch-analyzer:** its 1,746 lines of references and 1,822 of templates are **product, not waste** — they are what the planner actually emits. Consolidate overlapping reference files only; do not delete templates to hit a line count.
- Delete the three per-skill `README.md` files (230 lines) that duplicate their SKILL.md.
- Every SKILL.md: keep the envelope contract + craft; move history/rationale to `docs/design/`.
- Trim `CHANGELOG.md` (99 KB!) to v2-relevant history + link to the v1 tag. Rewrite README around the three-layer architecture; quickstart unchanged (`/ship` still the whole story).
- Version 2.0.0 in both manifests; upgrade notes: what v1 users must re-run (`npx shapeup-sdlc init`), what got deleted and why.
- **Done when:** a newcomer can read README + tech-lead SKILL.md + the workflow script in under an hour and correctly answer "where is a gate enforced?"

> **Closed.** Most of this phase had already shipped before this session touched anything: both
> manifests read `2.0.0`; `CHANGELOG.md` sits at 459 lines with a `v1.7.0-final` pointer for v1.x
> history; root `README.md` is rewritten around the Wall/Runtime/Advisory table; `tech-lead/SKILL.md`
> was already the 148-line runbook the plan describes (open run → branch on `RunReturn.status` → GATE
> L4); `references/` was already down to 4 files (1,364 lines) from the plan's stated 8. Three things
> were left, plus one thing to check honestly rather than assume, plus one that turned out to need no
> action.
>
> **References: 4 → 3.** `state.md` (295 lines: state ownership/D6, the central domain registry, the
> two-ledger split, the full `harness-run.md` schema, `round-ledger.md`, the harvest-row schema) is
> merged into `protocol.md` as a new "Part 4 — State" (550 → 832 lines) and deleted. Every citation
> pointing at it now points at `protocol.md` instead — two in `SKILL.md`'s citation block, four in
> `gates.md` (Hill report ×2, Harvest row, Rejected fields) — plus three this session's own grep
> found that weren't on the known list: a doc comment in `kernel/init/run.mjs`, a doc comment in
> `kernel/probe/resume.mjs`, and a live error string in the same file (`setRunStatus`'s "malformed
> frontmatter" message) — all three cited the reference path directly and would have gone stale
> silently otherwise. `references/` now totals 1,351 lines across 3 files — 13 fewer than the
> 4-file total, because the merge dropped two title-only wrapper headings ("Part 1 — State
> ownership", "Part 2 — The ledger schema") that existed only to name a file boundary that no longer
> exists; every substantive line moved, nothing was cut for content. Two `docs/skills/changelog-
> tech-lead.md` rows still say `references/state.md` — left alone on purpose: they're dated v1.4/
> v0.8 history entries describing what the file was called *at that version*, and rewriting a
> changelog to match a later refactor is exactly the revisionism CLAUDE.md's changelog rule exists
> to forbid.
>
> **`domain.schema.json`: no cut.** Checked all 41 `$defs` against actual usage — internal `$ref`
> within the schema, external `$ref` from `work-order.schema.json`/`work-result.schema.json`, and
> (the case a naive grep misses) programmatic `validate(x, {$ref: "domain.schema.json#/$defs/X"})`
> calls in kernel code (`RunSnapshot` in `kernel/reduce/snapshot.mjs`, `StatsReport` in
> `kernel/probe/stats.mjs`, `WorkerName` read straight off `schema.$defs.WorkerName.enum` in
> `kernel/verify/skills.mjs`). Every entry resolved to a real file format the harness reads or
> writes — `ActiveScopePointer` to `.shapeup/active-scope` (read in `kernel/verify/budget.mjs`,
> `kernel/reduce/snapshot.mjs`, `hooks/sandbox-guard.mjs`), `HillShard` to `hill/<scope-id>.yml`
> (`kernel/reduce/hill.mjs`, `board.mjs`), `SeesawRegistry` to `seesaw/registry.json`
> (`kernel/verify/t0.mjs`), and so on down the list — zero orphans. Left at 2,540 lines, unchanged.
> The plan named this outcome explicitly ("cutting it is capability loss") and it's the one that held.
>
> **Three duplicate READMEs deleted.** Was `skills/tech-lead/README.md` (71 lines). Was
> `skills/spec-evaluator/README.md` (93 lines). Was `skills/translator/README.md` (66 lines) — 230
> total, matching the plan's own number exactly. Re-grepped the whole repo before deleting; nothing
> referenced them, before or after.
>
> **`ba-pitch-analyzer` references: read all 7 (1,746 lines), changed none.** The plausible pair —
> `contract-patterns.md` (Phase 2b, the wire shape of one repository call) and
> `integration-analysis.md` (Phase 5, feature-level system impact) — turned out to be topically
> adjacent, not duplicative: different artifacts, different phases, different audiences. The one
> literal overlap found — a 3-line AC template ("Request shape matches… / Response mapping
> matches… / All error codes… are handled") appearing verbatim in both `contract-patterns.md`'s
> "Contract → Task Traceability" and `task-generation.md`'s "Contract-First Rule" — is normal
> cross-phase restatement (Phase 6 task generation quoting what Phase 2b's contract already
> requires), not a redundant file. `doc-schemas.md` is a cross-cutting meta-reference (frontmatter
> taxonomy for every doc type) with no single-phase peer to fold into. `ddd-patterns.md`,
> `test-surface.md`, `ux-behavior-patterns.md` are each the sole reference for their phase. No merge
> made: collapsing e.g. contract-patterns into integration-analysis would force a reader looking for
> "how do I write a `.contract.md`" to wade through unrelated system-impact material — the
> false-consolidation failure mode the brief warned against by name.
>
> **Verification.** `npm test` green throughout every structural change, settling at **1199
> checks** (measured baseline before this phase's edits was 1203-1204 depending on worktree, since
> the calling session's own working tree carried an uncommitted Phase 5 closure-box edit to this
> same file that the execution worktree did not — both baselines were green, and the one-check gap
> predates this phase's work). The four fewer than baseline are parametrized checks that scale with
> file/section counts (doc-drift, prompt line-count ratchet) correctly reacting to 4 reference files
> becoming 3 and 3 fewer README.md files existing — not a weakened suite. `claude plugin validate .
> --strict` and the marketplace validate stayed green throughout. Final repo-wide grep for dangling
> references to `state.md`, the three deleted READMEs, or any ba-pitch-analyzer reference filename
> (none renamed): clean.
>
> **Done when — met, with one honest hedge.** README (389 lines) + `tech-lead/SKILL.md` (148 lines)
> + the workflow script (`shapeup-run.js`, 1,369 lines, untouched by this phase) totals ~1,900
> lines, roughly a third prose and two-thirds JS. A linear, careful read of all three plausibly runs
> past an hour on the script alone. But the Done-when's actual question — "where is a gate
> enforced?" — doesn't require a linear read: `SKILL.md`'s own citation block points straight at
> `references/gates.md` for the collect-lists and `references/protocol.md` for the invocation
> mechanism, and the script concentrates gate logic in one findable place (`gateBlock()`/`paused()`
> at line 736, `GATE` appearing 22 times, never scattered across the file) rather than diffusing it.
> Met in the sense the line intends — a newcomer chasing that specific question finds it fast — not
> mechanically re-verified against a live newcomer this session.

### Phase 7 — Verification gauntlet *(1–2 days)*
Rerun every probe the v1 code memorializes in comments, as real checks:
1. Kill/resume probe (SIGKILL mid-BUILD, relaunch, assert no re-dispatch) — now against the graph.
2. Headless CI run (`--unattended`, `preset:ci`) with **zero** permission prompts on a fresh clone + init.
3. Parallel-corruption probe: 3 scopes, forced concurrency, assert board/ledger/graph consistency.
4. Dead-worker probe: kill one build leg's sub-agent; assert spent-attempt (not dead-run) semantics survive.
5. Gate-refusal probe: missing gate answer under `--unattended` → clean `aborted`, never silent proceed.
6. Baseline comparison: cost + wall-clock vs Phase 0 fixture; expect wall-clock ↓ (fan-out) and per-worker token cost ↓ (warm cache).
7. **Metrics audit** — verify against the measured budget at the top of this plan, not against a remembered number: executable script files ≤11, permission strings = 1, runtimes owned = 0, hooks = 4, comment density ~18%, shipped LOC ~17,000 (±10%). A miss is a finding to record, not a number to explain away — the same standard the harness holds its own workers to.
- **Done when:** all seven pass and are committed as CI-runnable checks (they replace the deleted eval machinery as the repo's proof of behavior).

> **Closed — see `RESULT-P7.md`. The Done-when's literal "all seven pass" is not met, recorded
> plainly rather than smoothed, the same standard Phase 3's D3 box already applied to itself.**
> 4 of 7 (G1 kill/resume, G3 parallel safety, G4 dead worker, G5 gate refusal) were already written
> and pass as committed CI checks (`tests/structural/21-gauntlet.mjs`) before this phase started —
> confirmed still green, not re-implemented. G2 and G6 had also already been run live by a prior
> session (`docs/output/EXP-A-G2-G6.md`) before this phase's own contract was compiled: **G2
> measured FAIL** (two characterized, non-hang, non-crash stalls; root cause already folded into
> shipped `AGENTS.md` by commit `7d5a850` — the documented grant is necessary but not sufficient for
> `--unattended`), and **G6 produced v2.0's first cost/wall-clock number** (73m 30.8s / ~$34.50
> combined pipeline, `todo-cli`, 2 rounds) with no v1 baseline yet to compare it against. This
> phase's own new live work (Stage S4) supplied that missing half — and found the comparison
> **impossible to make on wall-clock/cost terms at all**: v1.7.0's headless permission grant is keyed
> on a literal, unexpanded `${CLAUDE_PLUGIN_ROOT}` token, and the current Claude Code CLI now
> categorically rejects any `${VAR}`-expansion Bash command before permission-mode is even
> consulted — confirmed at two independent code paths (41 permission denials across two full
> attempts, plus a direct `run-workflow.mjs` invocation that aborted cleanly at its very first
> dispatch, 41.369s / $0.198, from an independent path). Neither smoothed nor treated as v1 "just
> being slower" — v1's own dispatch mechanism does not run at all against this CLI version, which is
> arguably a *stronger* signal in probe 6's predicted direction than a completing-but-slower v1
> number would have been, stated as the different claim it actually is.
>
> **Probe 7 (the metrics audit, `docs/output/METRICS-P7.md`) re-measured all six named metrics
> directly and found 1 match, 5 misses** — executable script files (33 under `kernel/` vs. a ~11
> target), permission strings (3 by default vs. 1, though a genuine 3-owner→1-owner reduction),
> hooks (5 hard walls vs. 4, already-documented non-drift), comment density (41.0% vs. an ~18%
> target — the wrong direction), and shipped LOC (28,257 vs. ~17,000±10%, ~64–66% over). Runtimes
> owned matched (0). None redefined or explained away; each carries its derivation and largest
> contributors. Acting on these misses is out of this phase's own scope, per its guardrails.
>
> G2 and G6 are deliberately **not** wrapped in CI assertions — `21-gauntlet.mjs`'s own architecture
> already reasons why (a check that cannot fail is worse than a missing one), and forcing either
> green would itself be the "explain away a miss" move probe 7 forbids. Probe 7 likewise stays a
> point-in-time measurement document, not a ratchet, for the same reason. What the Done-when's own
> premise missed: a probe can be genuinely **answered** — executed for real, its outcome on record,
> independently re-verified in a fresh clone rather than trusted from any run's own say-so — without
> **passing**. All seven were answered. Four pass as committed checks; G2 measured FAIL; G6's
> comparison proved unmakeable rather than unfavorable; probe 7 found five real misses. That is the
> honest closing state, not "all seven pass," and per this plan's own §4 note on reading its
> targets, the plan does not get an exemption from the standard it holds its own workers to. `npm
> test` green throughout (1200 → 1208 checks, parametrized growth, not a weakened suite); every
> stage's acceptance independently re-verified in a fresh clone by the operator session, not trusted
> from the executing workflow's own report.

---

## 2 · Traceability — every finding → its fix

| Finding | Fixed in | Mechanism |
|---|---|---|
| BAD-1 hand-rolled runtime | Phase 2 | native Workflow tool; delete run-workflow.mjs |
| BAD-2 courier pattern | Phase 2 | schema-validated `agent()` returns; kernel runs in worker shells |
| BAD-3 sequential chain | Phase 3 | `pipeline()` + worktree isolation + concurrency dial |
| BAD-4 no queryable graph | Phase 4 | `graph.jsonl` via `reduce`; `probe` = bounded query |
| BAD-5 cold sub-agents | Phase 2 | in-session sub-agents, prompt-cache-warm |
| BAD-6 archaeology | Phases 1, 6 | contract-comments-only rule; references consolidation |
| BAD-7 single-judge bottleneck | Phase 3+ | opt-in refute wave already in native script (`args.adversarialVerify`) |
| Permission fragility / bypassPermissions | Phases 1, 2, 5 | 1-line kernel grant + documented `Workflow` grant; hooks (mode-independent) carry all hard enforcement; no external-script sprawl |
| Tier-2 adoption | All | markdown skills + native runtime + kernel + 4 hooks |

## 3 · Risks & mitigations

- **`Workflow` grant is unscoped** (grants every dynamic script). Mitigation: it's opt-in at init, documented honestly; the only workflow shipped is yours; locked-down orgs use `--no-native-workflow` and run interactive-only. Revisit if the platform ships path-scoped Workflow grants — then delete the flag.
- **Worktree-parallel safety of workers** ([REQ] in the native script). Mitigation: Phase 3's corruption probe is the gate; if a worker proves unsafe, drop `maxParallelScopes` to 1 for that archetype and file it — the architecture still holds.
- **Graph/markdown divergence.** Mitigation: markdown is always a *projection regenerated by reduce*, never hand-edited (extends today's single-writer invariant); `probe --check` compares projections to graph in CI.
- **Sandbox-guard coupling** (reads active-scope pointer today). Mitigation: Phase 3 explicitly re-points it at the order's substrate block before deleting the pointer — checked in the corruption probe.
- **Scope creep during the rewrite.** Mitigation: the phase "done when" lines are the walls; anything else goes to the discovered ledger, exactly as the harness itself would insist.

## 4 · Estimated effort

Roughly **17–22 working days** end-to-end (Phase 6 narrowed once measurement showed only 2 of 12 skills need work; Phase 3.5 added — 6–7 days — once the two-artifact review showed the certification gap gates everything after it), but each phase ships alone; Phases 1–2 (≈5 days) already deliver the permission fix and the biggest deletion. If you only get one week: do 0–2 and stop — you'll have a smaller, cheaper, native-runtime v2.0-beta with today's exact behavior. Phase 3.5 should land before Phase 4 regardless of what else is sequenced around it — a run graph built on a system that can silently skip dispatching a scope is confidently wrong, not just incomplete.

**A note on how to read the targets.** The numbers above are measured, not aspirational, and they are deliberately less dramatic than the first draft's. A plan that promises −67% and delivers −33% teaches you to discount its next estimate; one that promises −33% and hits it stays useful. If a phase misses its target, record it as a finding — that is the standard this harness holds its own workers to, and the plan should not get an exemption.

---

*The one-line test from the review still closes the loop: after Phase 4, "every important output traces to an objective, a plan, an artifact, a source, a graph path, an evaluator decision, and a bounded execution record" stops being a grep and becomes an edge walk — on a codebase a third smaller, with half the executable surface and one permission string.*
