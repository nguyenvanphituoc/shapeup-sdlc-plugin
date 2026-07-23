# Insight Report: `shapeup-sdlc-plugin` vs `dwarvesf/dwarves-kit`

- **Date:** 2026-07-14
- **Subject repos:** this repository (`shapeup-sdlc-plugin`, v1.0.0) and [dwarvesf/dwarves-kit](https://github.com/dwarvesf/dwarves-kit) (master @ 2026-07-12)
- **Method:** full local survey of this repo (skills, hooks, scripts, tests, evals, CHANGELOG, docs) against dwarves-kit's README, WORKFLOW, ADR index, file tree, and repo metadata via the GitHub API.

## TL;DR

These are two independent implementations of the **same emerging thesis**: LLM agents can't be
trusted to grade their own work, so the SDLC must be closed-loop — humans set gates up front,
agents iterate inside them, and only mechanical validators authorize progress. This repo
expresses that thesis as a **tightly-typed orchestration engine** (one orchestrator, JSON
envelope schemas, single-writer state, Shape Up methodology). dwarves-kit expresses it as a
**broad bash toolbox** (31 commands, 23 hooks, 25 agents, standalone CLIs, no orchestrator
"uber-binary"). This repo is deeper per mechanism; dwarves-kit is far wider in surface area and
life-cycle coverage. Each has built things the other lists as a roadmap item.

---

## 1. Identity at a glance

| | **shapeup-sdlc-plugin** (this repo) | **dwarves-kit** |
|---|---|---|
| One-liner | Shape Up SDLC harness: planner → generator → judge, orchestrated by `/tech-lead` | Closed-loop spec-driven workflow: worker → verifier → fix-agent |
| Methodology | Basecamp **Shape Up** (appetite, betting, hill charts, scope hammer) | Generic spec-as-contract lifecycle (think → spec → execute → review → ship → retro) |
| Tech | Node `.mjs` scripts + markdown skills, JSON Schema envelopes | **82% bash**, markdown commands, plus Python/Rust ancillaries |
| Size | ~145 tracked files, ~26k LOC (incl. docs), 12 skills, 1 command, 3 hooks, 1 agent | **1,459 files**; 31 commands, 23 hooks, 25 agents, 3 skills, 34 ADRs, 577 doc files |
| Version / age | v1.0.0; first commit 2026-06-17, 36 commits (~4 weeks old) | Created 2026-03-29, actively pushed through 2026-07-12 (~3.5 months); 6 ⭐ / 2 forks |
| Author / audience | Liberty Nguyen; **teams** (committed knowledge base inherited via `git pull`) | Dwarves Foundation; **solo tech lead + contractors**, heavy daily Claude Code users |
| License / distribution | MIT; self-hosted plugin marketplace + installer that also targets Antigravity & Codex | MIT; self-hosted plugin marketplace + layered `install.sh` (spine + opt-in modules) |

An amusing data point: dwarves-kit's GitHub description still says *"A minimal Claude Code
workflow kit… 12 hooks + 12 commands + 8 agents + 1 skill"* while the repo actually contains
23/31/25/3. The kit has roughly doubled its surface since the description was written — a
visible scope-growth signal in a project whose philosophy preaches minimalism.

## 2. Convergent architecture — the striking part

Both projects independently arrived at nearly identical invariants, with different names:

| Invariant | This repo | dwarves-kit |
|---|---|---|
| No self-grading | **Single judge**: `spec-evaluator` owns the verdict; QA has no score | Read-only `task-verifier`; "never grading their own homework" |
| Bounded iteration | **Two-level circuit breaker**: outer `round_budget`, inner per-scope `attempt_budget`; exhaustion queues a GATE H proposal | `fix-agent` retries **max 2**, then escalates to a human |
| Mechanical gates over prose | `gate-l2.mjs`, `sandbox-guard.mjs`, `validate-envelope.mjs` PreToolUse hooks; T0-verify artifacts; **mechanical hill derivation** (never self-reported) | Blocking vs advisory gate classes; ship-gate needs a proof-of-done record; bash hooks readable in 30 s |
| Single source of truth, controlled writes | `ingest-result.mjs` is the **only** writer of shared state; ledger = single source of truth | Append-only gate/run ledgers; "propose, never dispose" — automation ends at staging files, a human promotes |
| Parallel-safety via disjointness | Substrate **disjointness** checked by `spec-lint.mjs`; write-whitelist sandbox per scope | `dispatch-gate.sh` disjointness gate for parallel worktrees; `## Touches` declarations for wavefront scheduling |
| Mid-build escalation with budget | `advisor-protocol` adjudicates structured `ESCALATE` within a per-scope-per-round budget | `FAIL:escalate` path + `advisor` agent as a cross-cutting lens |
| Learning loop with a human gate | `/coach` + GATE COACH-1 (PO categorizes each rule, never auto-assigned) → committed per-skill knowledge base | `learn propose` → staging → `board promote` (human turns proposal into backlog row) |
| Right-size the ceremony | `--no-qa` skip; T0 gates only active when scope contracts exist (non-regression on old specs) | Risk lanes: tiny / normal / full / bug — tiny skips ceremony entirely |

This is convergent evolution, not copying: dwarves-kit's Credits list traces its patterns to
GSD, gstack, Trail of Bits, ClaudeKit, etc.; this repo credits `rjs/shaping-skills` (Ryan
Singer) and Basecamp. Neither cites the other. That two unrelated Vietnamese-authored projects
landed on "single judge + bounded retries + mechanical gates + append-only ledgers +
human-gated learning" within months of each other is strong evidence these are the natural
fixed points of agent-harness design in 2026.

## 3. Where they genuinely diverge

### 3.1 Control plane: typed data vs prose + bash

This is the deepest architectural difference.

- **This repo (v1.0 "pure-skill architecture")** built a *typed data plane*: every worker
  dispatch is a **WorkOrder in / WorkResult out**, validated against JSON Schemas
  (`skills/tech-lead/schemas/`) by a PreToolUse hook that **denies** malformed envelopes before
  they reach a worker. Workers are stateless and pipeline-blind by construction;
  `compile-order.mjs` assembles facts, `ingest-result.mjs` applies results. Pipeline
  correctness is enforced structurally, not by prompt discipline.
- **dwarves-kit** keeps the interface *prose + files*: the spec markdown is the contract,
  commands are markdown prompts, and coordination state lives in TSV/NDJSON ledgers manipulated
  by bash. Its rigor lives in the *gates around* the work (ship-gate, gate-ledger,
  recheck-verifier re-audits) rather than in schema-validating the worker interface itself.

Trade-off: the envelope port makes single-writer and sandboxing *mechanically true* (this
repo's "D6 closed"), at the cost of a heavyweight orchestrator (`tech-lead/SKILL.md` is 736
lines). dwarves-kit's bash-first toolbox is inspectable and usable piecemeal
(`bash lib/board/board.sh --help` works with no install), at the cost of trusting more behavior
to prompt text and convention.

### 3.2 Orchestration ambition

dwarves-kit has built an entire **execution-infrastructure layer** this repo doesn't attempt:

- DAG-wavefront scheduling of dependent sub-goals across git worktrees (`WAVE_CAP`,
  `## Touches` disjointness)
- An overnight queue launcher driving real interactive Claude sessions via tmux `send-keys`,
  with completion-marker polling and a two-strikes abort rule
- Mega-goal decomposition (`/kit:mega`) with ship-layer auto-merge that still rides the
  ship-gate
- A git ↔ Hermes kanban bridge with snapshot-hash conflict rules ("git wins, always"; a
  corrupt snapshot refuses all edits)
- Session-lifecycle machinery: pre-compact backup, post-compact re-inject, session-state save,
  output offload, statusline HUD, lane telemetry, weekly LaunchAgent digests

This repo deliberately stays inside **one run of one pitch**: sequential vertical build per
scope, no parallel dispatch, no cross-session registry, no telemetry read-plane beyond a
metrics JSONL shard. Within that run, though, its verification is *more substantive* than
dwarves-kit's: T0 artifacts (fixtures + DB probe + seesaw), sha256-recomputed artifact
citations required by the judge, and hill phase derived only from T0/T1 facts.

### 3.3 What one has that the other lists as "not yet built"

- **dwarves-kit v2 roadmap** items *already shipped here*: headless-browser QA (this repo's
  `qa-edge-hunter` + `spec-evaluator` drive Playwright and it's a declared plugin dependency)
  and multi-harness packaging (the installer scaffolds Antigravity `.agents/` and Codex
  `.codex/` today, with a Flyway-style **versioned data-migration system** — `migrate.sh` +
  numbered migrations + a committed ledger — that dwarves-kit has no equivalent of).
- **This repo lacks** what dwarves-kit ships as its unconditional "spine": general safety hooks
  (block `rm -rf`, force-push, push-to-main, secret-file reads, commit format). All three hooks
  here are pipeline-specific (EVAL gate, sandbox, envelope validation); nothing protects the
  machine or the git remote. dwarves-kit also has session-compaction resilience; this repo has
  only a design doc (`docs/plan/shapeup-v2.1-context-compaction-spec.md`).

### 3.4 Quality assurance of the harness itself

- This repo: `tests/structural.mjs` (223 checks incl. envelope round-trips), per-skill
  **trigger-eval datasets** with a committed baseline (`evals/baselines/`) — i.e., it evals
  whether skills *fire* correctly, which dwarves-kit doesn't do.
- dwarves-kit: 131 test files (hook behavior + structural meta), a
  `.skillspector-baseline.yaml`, **195 files of pinned verification records**
  (`docs/verification/`, byte-identical non-regression pins), 34 ADRs, per-cycle retros, and
  dated "absorption" audits of its upstream sources. Its *design record* is an order of
  magnitude richer.

### 3.5 Distinct flavors

- Unique to this repo: `/translator` (Vietnamese/English intake gate — the harness is
  English-only downstream), Shape Up betting/appetite economics, `scope-hammer`
  baseline-vs-ideal cut lists, PO-facing gates (L0–L4) that assume a human product owner at
  the table.
- Unique to dwarves-kit: intent-driven invocation ("say what you want, it picks the command"),
  understanding gates (`/kit:explain`, `/kit:quiz-gate` — quizzing the *human* on the diff
  before merge, a genuinely novel inversion), money-gate, prose-RAG recall, and dynamic agent
  synthesis (SPEC-089: it writes a specialized worker on the fly when no built-in role fits).

## 4. Insights & takeaways

1. **Depth vs breadth is the real axis.** This repo is a *vertical* bet: one methodology, one
   orchestrator, mechanically-enforced invariants, ~26k LOC. dwarves-kit is a *horizontal* bet:
   cover the whole operator's day (safety, sessions, boards, overnight runs, retros) with
   loosely-coupled bash. They're closer to complements than competitors — dwarves-kit even says
   "pair with X" about tools it overlaps.

2. **This repo's envelope port is ahead of the field.** Schema-validated WorkOrder/WorkResult
   with hook-level denial and a single-writer ingest is a stronger correctness story than any
   mechanism in dwarves-kit, which still trusts markdown prompts to keep workers in their lane
   (mitigated by recheck/claim verifiers after the fact). If dwarves-kit absorbed one idea from
   here, it should be this; its Credits history shows it does absorb aggressively.

3. **What this repo should absorb from dwarves-kit** (highest value first):
   - (a) a **safety spine** — its three hooks guard the pipeline but not the machine; a
     destructive-command/secrets/push-to-main guard is cheap and orthogonal;
   - (b) **session-compaction persistence** — the v2.1 spec here is unbuilt while dwarves-kit
     has five shipped hooks for exactly this;
   - (c) **parallel scope dispatch** — substrate disjointness is *already verified* by
     `spec-lint.mjs`, so the precondition for worktree fan-out (what dwarves-kit's
     dispatch-gate exists to check) is already met; the harness just doesn't exploit it;
   - (d) a **telemetry read-plane** — metrics JSONL shards are written but nothing like
     `stats`/`lane-telemetry` reads them back.

4. **Both have a heavy-prompt risk, in different places.** Here it's the 736-line `tech-lead`
   orchestrator prompt; there it's 31 commands × 25 agents of prose whose mutual consistency is
   maintained by meta-tests and discipline. Both projects' own philosophies ("mechanical over
   prose") argue for continuing to push logic out of prompts into scripts — this repo's v1.0
   rewrite (task-executor 580→210 lines, ba-pitch-analyzer 670→190) is exactly that motion,
   further along.

5. **Maturity read.** dwarves-kit is older, battle-worn (its docs record real bugs its own E2E
   caught, e.g. the multi-line kanban-body argv split), and community-fed via absorptions — but
   visibly sprawling against its "minimal" branding. This repo is younger, more coherent, and
   more aggressive architecturally (four breaking versions in four weeks), but has a bus factor
   of one, a 36-commit history, and no external adoption signal yet. For a team standardizing
   on Shape Up with a PO in the loop, this repo fits; for a solo operator living in Claude Code
   all day across many repos, dwarves-kit fits.

## Sources

- This repository: `README.md`, `AGENTS.md`, `CHANGELOG.md`, `package.json`, skill/hook/script/test/eval file survey, git history.
- [dwarvesf/dwarves-kit](https://github.com/dwarvesf/dwarves-kit): `README.md`, `WORKFLOW.md`, `docs/decisions/` ADR index (0001–0034), full file tree and repo metadata via the GitHub API (master @ 2026-07-12).
