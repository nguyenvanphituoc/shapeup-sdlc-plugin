# Independent Audit & Evolution Plan — Shape Up SDLC Plugin

> An independent harness-engineering audit, written from the actual repository state on disk —
> **not** from `docs/plan/` or the prior `docs/research/` audits, which are treated as reference
> only. Where the existing docs and the code disagree, the code wins.
>
> - **Date:** 2026-06-26
> - **Auditor stance:** the project may be on the wrong track; nothing is assumed correct because
>   a doc says so.
> - **Restated ultimate goal (from the assignment):** *a plugin for an agent that guides it to use
>   the Shape Up methodology to build anything, with (a) evaluation output and (b) edge cases
>   handled.*

---

## 0. TL;DR

The plugin's **prose design is genuinely strong** — single-judge invariant, role separation,
once-per-round evaluation, a skeptical evaluator, a mechanically-derived test surface. All 9
skills are correctly Claude-Code-plugin-shaped (valid `name`+`description` frontmatter).

But three findings dominate everything else, and the first is new:

1. **The documented evidence layer does not exist.** `docs/plan/evolution-roadmap.md` and
   `docs/research/harness-design-audit.md` both state that Phase 0/1/4 "**LANDED**" — `evals/`,
   committed `evals/baselines/*.json`, a measured trigger-eval table, `make eval`,
   `evals/check-gate.py`, and an `eval-gate` CI job. **None of it is in the repo, and `git log
   --all` shows it was never committed on any branch.** The CI has exactly two jobs: manifest
   validate + JSON lint. The "first measured baseline" table in the roadmap describes runs whose
   artifacts are absent. The design audit then built a strength claim ("unusually well-grounded")
   on top of that fiction. **This is the project being on the wrong track: the docs describe a
   system that isn't there.**

2. **Gates are an honor system.** Every `⏸ GATE` is an instruction to the model to pause;
   `hooks/hooks.json` contains a single `SessionStart` echo and enforces nothing. `--unattended`
   (and `commands/ship.md`, which is in Vietnamese and hard-codes `auto_level = unattended`)
   removes the human from a control system whose safety depends on the human.

3. **The whole machine is functionally untested.** ~5,000 lines of invariants, zero executable
   tests of behavior. The keystone — `spec-evaluator` — is the least verifiable component
   (non-deterministic single-snapshot judging, no consistency ledger) and is deliberately excluded
   from any reward loop.

The good news: the goal is achievable and the design is mostly right. The work is to **make the
real artifacts catch up to the prose**, smallest-provable-thing first — and to delete or demote
the docs that claim otherwise so the team stops navigating by a false map.

---

## 1. What the repo actually contains (ground truth, 2026-06-26)

| Area | On disk | Notes |
|---|---|---|
| Skills | 9 (`ba-pitch-analyzer, coach, orient, qa-edge-hunter, shapeup, spec-evaluator, task-executor, tech-lead, translator`) | All have valid `SKILL.md` frontmatter. `skill-evolver` is referenced in `lib-harness.sh` as a stub-to-skip but **does not exist**. |
| Commands | 1 (`commands/ship.md`) | Vietnamese; `auto_level = unattended, max_rounds 3`. |
| Hooks | `SessionStart` echo only | No gate enforcement. |
| Manifests | `plugin.json` 0.2.6, `marketplace.json`, `package.json` 0.2.6 | Versions in sync ✅. |
| CI | `ci.yml` (validate + json-lint), `release.yml` (tag→VSIX/zip release; VS-Code/Open-VSX publish commented out) | No eval/test job. |
| Distribution | `scripts/distribute.js` → Cursor `.mdc` + Antigravity subagents + VS Code extension | Real and runnable. |
| Install / migrate | `install-harness.sh`, `migrate.sh` + `migrations/NNNN__*.sh`, `lib/lib-harness.sh`, `lib/lib-migrate.sh` | Bash only (macOS/Linux; Windows via WSL). Multi-CLI (claude/antigravity/codex); curl-pipe-able; versioned migrations. |
| **Evals / baselines / Makefile / check-gate** | **absent** | Claimed "LANDED" in roadmap; never committed. |
| `docs/shapeup-sdlc/`, `knowledge-base/` | absent in plugin repo | Created at install time in the *target* project, not here. |
| Doc cross-refs | roadmap references `AGENT.md` (singular) | File is `AGENTS.md`. Broken reference. |

**Action implied:** the docs in `docs/plan/` describe an aspirational system as a shipped one.
They must be relabelled as *plans* (status: not started) before they can be trusted again.

---

## 2. What is genuinely well-engineered (keep these)

These are real harness-engineering principles, correctly applied — confirmed by reading the
SKILL.md files, not the marketing:

1. **Single-judge invariant + role separation.** Verdict belongs to `spec-evaluator`; executor
   fixes, QA discovers (no verdict/score), tech-lead routes. The evaluator is *deliberately
   non-coachable* so the knowledge base can't become a covert second judge. This is the
   discipline that stops agents grading their own homework.
2. **EVAL exactly once per round, gated on a green board.** The correct cost/timing decision;
   `tech-lead` exists mainly to enforce a rule no stateless worker can see.
3. **Stateless workers + one stateful orchestrator.** Run-state is sole-writable by `tech-lead`;
   workers receive args and emit domain artifacts only. Protects `--from` resume.
4. **Anti-leniency protocol** in `spec-evaluator` (evidence-or-FAIL, forbidden-phrase list,
   probe-behavior-not-code, collect/grade phase separation).
5. **Mechanically-derived Test Surface** + anti-invention rule in `ba-pitch-analyzer` — directly
   serves the goal's "edge cases handled."
6. **Progress by Hill position, not task count.**

These map cleanly onto the stated goal: **shaping** (shapeup/ba) → **build** (task-executor) →
**evaluation output** (spec-evaluator) → **edge cases** (qa-edge-hunter). The skeleton is right.

---

## 3. Findings, by severity

### 🔴 F1 — The evidence layer is fiction (NEW, systemic)
The roadmap's "Phases 0/1/4 LANDED" and the design audit's inherited claims are unbacked by any
committed artifact. **Risk:** every downstream decision (Phase 2/3/5 sequencing, "well-grounded",
the seesaw gate) rests on infrastructure that does not exist. **This is the headline correction.**

### 🔴 F2 — Gates are unenforced; `--unattended` + `ship.md` remove the human
The design aspires to feedforward control but implements it as politeness. The one command that
ships is Vietnamese and runs the *entire* harness unattended for 3 rounds — the exact opposite of
"direct human input where it is most important." **Risk:** a false-PASS ships with nobody in the
loop.

### 🔴 F3 — The keystone judge is the least verifiable
`spec-evaluator` PASS closes the task; FAIL drives the loop. It is non-deterministic
(single Playwright snapshot per criterion), has no re-run consistency ledger, no second opinion,
and is excluded from any calibration. **Risk:** flaky false-PASS/false-FAIL with no detection.

### 🟠 F4 — `coach` RLHF loop has no safeguards
Committed, team-shared knowledge-base files with no provenance schema, no decay/pruning, no
poisoning guard, and a *read-back that is assumed, never verified*. **Risk:** one over-general
rule silently steers every future build; KB grows unbounded.

### 🟠 F5 — Unschematized cross-skill seams
`orient→ba` scope grouping and `coach→skills` KB read-back are the brittle joints with no schema
and no test. The skill *boundaries* are clean; the *glue* is implicit.

### 🟡 F6 — Reference-file duplication (e.g. `gates.md` in both `ba` and `task-executor`) with no
sync mechanism; 🟡 F7 — `translator` "faithful" check is Vietnamese-hardcoded despite "any
language"; 🟡 F8 — broken doc cross-reference (`AGENT.md`).

---

## 4. The core tension with the goal

The goal is "**build anything** with evaluation output and edge cases handled." Today the harness
is implicitly **web-app-shaped**: the evaluator and QA drive a *running app* through Playwright to
verify `[ui]` criteria. "Anything" (a CLI, a library, a data pipeline, a pure refactor) has no
defined evaluation path. **Decision needed (see §7):** either narrow the promise to "build
software features that have an observable runtime," or generalize the evaluation contract so a
non-UI deliverable has a defined oracle. I recommend the former first (honest scope), the latter
as evolution.

---

## 5. Evolution plan — re-sequenced, grounded, smallest-provable-first

The prior roadmap inverted the value chain (it "landed" the gate that polices a signal it admits
is unreliable, before the fixtures that produce a real signal). Corrected order:

### Stage A — Stop navigating by a false map *(hours)*
- **A1.** Relabel `docs/plan/evolution-roadmap.md` status to **"Phases 0/1/4 NOT STARTED — prior
  status was aspirational"**; move the unbacked baseline table to an explicit *target* section.
- **A2.** Fix the `AGENT.md`→`AGENTS.md` reference. Apply the citation-provenance rule from
  `harness-design-audit-proposal.md` (it's a good rule).
- **A3.** Localize/translate `commands/ship.md`; **remove `--unattended` as the shipped default** —
  make `interactive` the default, `--auto` opt-in, `--unattended` gated behind an explicit flag +
  a printed warning.

### Stage B — Make the harness testable at all *(this PR — see §6)*
- **B1.** Add a **zero-dependency structural test layer** (`tests/structural.mjs`): every skill has
  valid frontmatter (`name`+`description`), every `references/…` link in a SKILL.md resolves,
  manifests parse, plugin.json↔package.json versions match. This is *runnable today* and catches
  the broken-reference class of bug (F8) immediately.
- **B2.** Add a **worked example** (`examples/todo-cli/`): a tiny pitch + an expected-artifact
  checklist that asserts the harness produces (i) a doc tree with a Test Surface, (ii) an
  evaluation verdict with cited evidence, (iii) at least one edge-case finding. This is the
  smoke test of *the goal itself*.
- **B3.** Wire B1 into CI as a real job (§6).

### Stage C — Build the real evidence layer the docs pretended existed *(judge-first)*
- **C1.** Author **tier-1 trigger-evals** for real (`skills/<name>/evals/trigger-evals.json`) and
  commit *honest* baselines — measured with skills **installed** (`claude --plugin-dir .`),
  detecting real `Skill`-tool activation, not command self-invocation (the prior measurement's
  TPR≈0 was a proxy artifact and must not be repeated).
- **C2.** Author **tier-2 functional fixtures, starting with the `spec-evaluator` planted-bug
  fixture** — the anti-leniency regression test. Until that passes reproducibly, no other skill's
  correctness is trustworthy, because the judge asserts it. Then `ba` (no-invented-ACs),
  `task-executor` (minimum-code + checkbox), `translator` (faithful + untouched original).

### Stage D — Calibrate the keystone *(highest runtime leverage)*
- **D1.** Add re-probe-on-FAIL + per-criterion confidence to `spec-evaluator`; write a
  `.verdicts-<task>.jsonl` ledger that flags verdict flips across re-runs. Converts a
  non-deterministic oracle into a measurable one.

### Stage E — Enforce the one gate that matters
- **E1.** Use `hooks/hooks.json` (`PreToolUse`) to make GATE L2 a hard precondition: block EVAL
  delegation unless the board file is provably green. One real gate beats ten honor-system ones.

### Stage F — Then, and only then, the AEGIS loop & repair
- **F1.** The `skill-evolver` (Phase 3) + seesaw CI gate (real Phase 4) + HarnessFix-style repair
  memory (Phase 5). These are correct *destinations*; they were sequenced first by mistake. They
  need C+D to have anything real to optimize against.

### Stage G — Generalize "anything" (the goal's long pole)
- **G1.** Define an **evaluation-contract abstraction** so a non-UI deliverable (CLI, library,
  pipeline) has a declared oracle (exit code + stdout assertion, test-suite green, snapshot diff),
  with Playwright/`[ui]` as one implementation among several.
  - **Status (2026-06-26): steps 1–3 LANDED** — `oracle` tag + registry in the ba Test Surface
    schema (default `ui`); `spec-evaluator/references/probing.md` dispatches on it; the shared
    `process` runner `scripts/oracles/process-oracle.mjs` (declarative contract; reference
    `examples/todo-cli/todo.contract.json`) is wired and tested (structural #6, with a negative
    control). **Remaining: `test` + `snapshot` oracles (step 4), then `http` (step 5).** See
    `evaluation-contract-spec.md`.

**Dependency order:** A → B → C → (D, E in parallel) → F → G.

---

## 6. What this PR actually builds (so the audit isn't itself unbacked)

To avoid repeating the project's own sin (claims without artifacts), this audit ships with:
- `tests/structural.mjs` + `tests/README.md` — runnable today, no dependencies (Stage B1).
- `examples/todo-cli/` — pitch fixture + expected-output checklist (Stage B2).
- `.github/workflows/ci.yml` — a new `structural-tests` job + an **honest** `eval-gate` placeholder
  that states evals are not yet built (Stage B3) — *labelled as a stub, not as "landed."*
- `docs/audit/ci-cd-and-distribution.md` — the fresh-login (headless auth) + migration/update flow.

Run locally: `node tests/structural.mjs`.

---

## 7. PO decisions (made 2026-06-26 — these reshape the plan)
1. **Scope of "anything": GENERAL EVAL-CONTRACT, UP FRONT.** Stage G is promoted ahead of Stage F.
   See `evaluation-contract-spec.md`. The CLI oracle (`examples/todo-cli/eval-cli-contract.mjs`)
   becomes the reference `process` implementation; `ui`/`test`/`snapshot`/`http` oracles follow.
2. **Autonomy: ALWAYS REQUIRE HUMAN SIGN-OFF.** `--unattended` is demoted to a warned, explicit
   opt-in; `interactive` is the default. `commands/ship.md` rewritten accordingly (English,
   interactive-default). Follow-up: make `interactive` the documented default in the `tech-lead`
   skill body too.
3. **Evolution ambition: NORTH STAR, NOT NOW.** Stage F (skill-evolver + seesaw gate) is
   aspirational; effort goes to making the harness correct and tested first (Stages C, D) and to
   the eval-contract (G).

**Revised priority order given the decisions:** A (stop false map) → B (testable — done) →
**G (eval-contract)** + **C (judge-first fixtures)** → D (calibrate judge) + E (enforce L2 gate) →
F (AEGIS, later).

---

## Appendix — method
Full read of all 9 `SKILL.md` + reference dirs, all manifests, both CI workflows,
`distribute.js`, `install-harness.sh`, `lib-harness.sh`, the evolution roadmap, and the three
`docs/research/` audits. Ground-truth claims verified with `git log --all` and `find`. The prior
`docs/research/` audits are solid on *design* critique; this audit's new contribution is catching
that their *evidence-state* claims describe uncommitted infrastructure.
