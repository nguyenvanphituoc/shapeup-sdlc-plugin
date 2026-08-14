# ShapeUp SDLC v2.0 — The Strip-Down Plan

**Goal:** fix every finding from the review (BAD-1…7), close the permission fragility, and land on **Tier 2** — markdown skills + native Dynamic Workflow + one tiny deterministic kernel — so the plugin is small enough for one person to maintain and robust in environments that ignore permission grants.

**One sentence:** *delete the runtime, fan out the scopes, shrink 21 scripts to 1 kernel, make the state a graph, keep only the hooks that are walls.*

**Target metrics (measurable, checked at the end):**

| Metric | Today (v1.7.0) | Target (v2.0) |
|---|---|---|
| Repo size | ~45,500 LOC | ≤ 15,000 LOC |
| Pipeline scripts (`skills/tech-lead/scripts/`) | 16 + 5 lib = 21 | **1 kernel CLI** + ≤3 lib |
| Hand-rolled runtime | `run-workflow.mjs` (~380 LOC) | **0** — native Workflow tool |
| Orchestrator script | 911 lines, courier-defended | ≤ 600 lines, zero couriers |
| Hooks | 10 | **4 hard** (rest deleted or folded) |
| Permission grant lines written by init | N prefix rules + fragile merge | **2 lines** (one Bash prefix, one optional `Workflow`) |
| Scope build | sequential | parallel (`pipeline()` + worktree) |
| Resume | directory re-scan every launch | one bounded graph query |
| Sub-agent dispatch cost | cold `claude -p` per worker | in-session, prompt-cache-warm |

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
- While moving, apply the archaeology rule (BAD-6): keep comments stating the *current* contract; delete narrated dead bugs. Target: every kernel file readable in one sitting.
- `bin/init.mjs`: replace the prefix set with the single kernel line + write the optional `"Workflow"` grant behind a `--native-workflow` flag (default **on** in v2; `--no-native-workflow` documented for locked-down orgs, falling back to interactive-only use). Update `.claude/settings.local.example.json` to show exactly these two lines.
- **Done when:** structural tests green against the kernel; `grep -r "scripts/" skills/` finds only `kernel/harness.mjs` references; init writes ≤2 permission lines.

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

### Phase 4 — The run graph *(fixes: BAD-4)* *(2–3 days)*
- `reduce` appends typed nodes/edges to `graph.jsonl` alongside its existing writes; `probe` answers from the graph (`--subgraph run` returning the `SUBGRAPH` shape the native script already expects). Markdown board/ledger become projections regenerated by `reduce` — humans keep their files, machines stop parsing them.
- Migration shim: on first v2 run over a v1 `.shapeup/` tree, `probe` falls back to the directory walk once and `reduce` backfills the graph from it.
- Retire `session-rehydrate` + `compact-snapshot` hooks: rehydration after compaction is now "run `probe`" — one line in tech-lead SKILL.md, not two hooks.
- **Done when:** kill -9 mid-BUILD → relaunch fast-forwards from the graph re-dispatching nothing completed (the kill/resume probe, rerun); the reliability sentence is demonstrable: pick any verdict node, walk edges back to objective/plan/artifact/T0/gate in one query.

### Phase 5 — Hook diet & enforcement honesty *(fixes: permission story, BAD-6 rest)* *(1 day)*
- **Keep 4 hard hooks:** `safety-spine` (machine safety), `sandbox-guard` (substrate walls — the parallel-safety backstop), `gate-intake` (no empty dispatch), `validate-envelope` (no uncompiled order).
- **Delete 6:** `gate-l2` (already advisory — becomes a `reduce` warning in the L2 gate context), `gate-deadline` (breaker already lives in `verify`/budget), `gate-zerowork`, `anti-rationalization`, `slop-cleaner` (fold the useful checks into spec-evaluator's dimensions or the ship report), `session-rehydrate`/`compact-snapshot` (Phase 4).
- README enforcement table rewritten honestly: which guarantees are walls (hooks — work under every permission mode), which are runtime (schemas, worktrees), which are advisory. This is the direct answer to the bypassPermissions concern: **nothing load-bearing depends on permission mode anymore.**
- **Done when:** hooks/ contains 4 files + hooks.json; README table matches reality.

### Phase 6 — Skill & docs diet *(maintainability)* *(2–3 days)*
- Every SKILL.md: workers keep the envelope contract + craft; move history/rationale to `docs/design/`. Tech-lead SKILL.md shrinks to: open run → launch Workflow → branch on RunReturn → L4 (the two-lane prose fork for `--tiny` stays, now the *only* prose lane).
- Consolidate `tech-lead/references/` (8 files) into 3: `gates.md`, `protocol.md` (round+delegation+state), `tiny-lane.md`. Delete what the code now self-documents.
- Trim `CHANGELOG.md` (99 KB!) to v2-relevant history + link to the v1 tag. Rewrite README around the three-layer architecture; quickstart unchanged (`/ship` still the whole story).
- Version 2.0.0 in both manifests; upgrade notes: what v1 users must re-run (`npx shapeup-sdlc init`), what got deleted and why.
- **Done when:** a newcomer can read README + tech-lead SKILL.md + the workflow script in under an hour and correctly answer "where is a gate enforced?"

### Phase 7 — Verification gauntlet *(1–2 days)*
Rerun every probe the v1 code memorializes in comments, as real checks:
1. Kill/resume probe (SIGKILL mid-BUILD, relaunch, assert no re-dispatch) — now against the graph.
2. Headless CI run (`--unattended`, `preset:ci`) with **zero** permission prompts on a fresh clone + init.
3. Parallel-corruption probe: 3 scopes, forced concurrency, assert board/ledger/graph consistency.
4. Dead-worker probe: kill one build leg's sub-agent; assert spent-attempt (not dead-run) semantics survive.
5. Gate-refusal probe: missing gate answer under `--unattended` → clean `aborted`, never silent proceed.
6. Baseline comparison: cost + wall-clock vs Phase 0 fixture; expect wall-clock ↓ (fan-out) and per-worker token cost ↓ (warm cache).
- **Done when:** all six pass and are committed as CI-runnable checks (they replace the deleted eval machinery as the repo's proof of behavior).

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

Roughly **12–16 working days** end-to-end, but each phase ships alone; Phases 1–2 (≈5 days) already deliver the permission fix and the biggest code deletion. If you only get one week: do 0–2 and stop — you'll have a smaller, cheaper, native-runtime v2.0-beta with today's exact behavior.

---

*The one-line test from the review still closes the loop: after Phase 4, "every important output traces to an objective, a plan, an artifact, a source, a graph path, an evaluator decision, and a bounded execution record" stops being a grep and becomes an edge walk — on a codebase a third the size.*
