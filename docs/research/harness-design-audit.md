# Harness Design Audit — Shape Up SDLC Local Harness

> An expert assessment of the scaffolding, with a path to the project's stated ultimate
> goal: a **self-improving (AEGIS-evolvable) coding-agent harness**.
>
> - **Date:** 2026-06-25
> - **Scope:** all 8 runtime skills (`skills/*`) + the orchestration core (`tech-lead`) +
>   the evolution layer (`docs/plan/evolution-roadmap.md`, `docs/mechanism-roadmap.md`).
> - **Method:** full read of `tech-lead/SKILL.md` + references and the strategy docs; deep
>   per-skill grilling of `ba-pitch-analyzer`, `task-executor`, `spec-evaluator`,
>   `qa-edge-hunter`, `shapeup`, `orient`, `coach`, `translator` (SKILL.md + references).

---

## 1. What this project actually is (the goal, stated plainly)

Two layers, and they must not be confused:

- **The runtime harness** — 8 hand-tuned prose skills implementing the Shape Up Building
  phase as a controlled loop: `orient → ba-pitch-analyzer → task-executor → spec-evaluator`,
  conducted by `tech-lead`, with `qa-edge-hunter`, `coach`, `translator` on the flanks.
- **The evolution layer** — the *real* ultimate goal (`docs/plan/evolution-roadmap.md`): make
  those 8 skills **provably improvable** via an AEGIS loop
  (Digester → Planner → Evolver → Critic + deterministic seesaw gate), grounded in
  HarnessX (arXiv 2606.14249) / HarnessFix (arXiv 2606.06324).

**Headline finding.** The runtime harness is one of the more sophisticated agent-control
designs achievable in prose — and it is **almost entirely unverified**. The evolution layer
that exists to fix exactly that is **half-built, and built in the wrong order**. The project's
biggest risk is that its complexity has already outrun its evidence, and the machinery meant
to close that gap (tier-2 functional fixtures) is the one piece not yet landed.

---

## 2. What is genuinely well-engineered

Real harness-engineering principles correctly applied — not cargo-culted:

1. **Single-judge invariant + role separation.** Verdict belongs to `spec-evaluator` alone;
   `task-executor` fixes, `qa-edge-hunter` discovers (no verdict, no score), `tech-lead`
   routes but never diagnoses. The discipline that stops LLM agents from grading their own
   homework — enforced down to *deliberately making the judge non-coachable* so the knowledge
   base can never become a covert second judge.
2. **EVAL exactly once per round, gated on a 100%-green board (GATE L2).** The load-bearing
   cost decision, and it is correct: end-of-round QA, never per-task. `tech-lead` exists
   primarily to enforce a timing rule no stateless worker can see.
3. **Stateless workers, one stateful orchestrator.** `harness-run.md` is sole-writable by
   `tech-lead`; workers receive run metadata as args and emit only domain artifacts. The right
   state topology, and it protects `--from` resume.
4. **Anti-leniency protocol in `spec-evaluator`** — skeptical-by-default, evidence-or-FAIL,
   forbidden-phrase list, probe-behavior-not-code-presence, Phase A (collect) / Phase B (grade)
   separation. A textbook attack on the documented LLM-as-judge failure mode.
5. **Progress by Hill position, not task-count.** Forbidding "N/M done" as the headline is a
   genuine insight — a 90%-done slice stuck on the one unknown that matters is *not* 90% done.
6. **Context-compaction digest (`shapeup` v2.2)** with frozen-zone/working-head and per-gate
   minimal slices is a real answer to context-budget decay.

The dimension-contract injection model in `spec-evaluator` and the mechanically-derived
**Test Surface** (anti-invention rule) in `ba-pitch-analyzer` are also above-average designs.

---

## 3. The cross-cutting thesis: prose-rich, evidence-poor

Every per-skill audit independently converged on the same three structural weaknesses. These
matter far more than any single-skill nit.

### Finding A — Gates are an honor system, not a control system
Every `⏸ GATE` is an *instruction to the model to pause*. Nothing enforces it.
`--auto`/`--unattended`, and `--auto`-style escape hatches (in `qa-edge-hunter`, `shapeup`),
make the pause optional by design. The harness *aspires* to Fowler-style feedforward control
(cited in the evolution roadmap) but implements it as politeness. The repo already ships
`hooks/hooks.json` — gate enforcement (e.g., blocking EVAL delegation until the board file is
provably green) is the obvious place to convert honor-system gates into real ones.

### Finding B — The whole machine is functionally untested
~4,800 lines of meticulous invariants, and the project's own roadmap admits **tier-2
functional fixtures do not exist** (Phase 2 unbuilt). Every behavioral claim is therefore
unverified:
- Does anti-leniency actually catch a planted bug? (no `spec-evaluator` planted-bug fixture)
- Does the `coach` read-back loop actually change downstream behavior? (no test proves
  `task-executor` acts on a written rule — the read-back is *assumed*)
- Does discovered-task reconciliation converge? Does `--tasks-only` freeze-zone avoid
  fossilizing UCs?

The harness exhibits the exact pathology its `spec-evaluator` is built to punish: confident
claims without cited evidence.

### Finding C — The most critical component is the least verifiable
`spec-evaluator`'s PASS closes the task; FAIL drives the loop. It is the single
highest-blast-radius component. Yet by design it is **non-deterministic** (single Playwright
snapshot per criterion → flaky false-PASS/false-FAIL), has **no consistency check or second
opinion**, **no audit trail across re-runs**, and is **deliberately excluded from the
evolution reward loop** (single-judge rule). The keystone is the least-measured stone.

---

## 4. Per-skill grilling — sharpest finding each

| Skill | Sharpest design risk | Severity |
|---|---|---|
| **tech-lead** | Gates are honor-system (Finding A); `--unattended` removes the human from a harness whose safety *depends* on the human gate. Otherwise the thinnest, cleanest skill. | Med |
| **spec-evaluator** | Non-deterministic single-snapshot judging + no re-run consistency ledger + integration-mock detection is `grep`, not semantic → false PASS undetectable. Keystone with no calibration. | **High** |
| **ba-pitch-analyzer** | Contract `source:` fields traced but never *validated* at GATE 2b → silent contract↔UC drift surfaces only at SPIKE-fail. Lens-detection heuristics ("mobile-only signals") undefined → wrong lens wastes phases. Heaviest reference footprint (~1.2k lines). | **High** |
| **task-executor** | "Explicit assumptions" + "minimum code" + AC-checkbox-ticking are all LLM-judgment with no objective anchor → non-reproducible scope. KB read-back can silently override spec with no conflict gate. | Med |
| **qa-edge-hunter** | Charter = "6 lenses × UC tree − EVAL-covered set" is procedural set-subtraction over tabular data — the LLM's weakest skill. Concurrency-lens findings can't reliably reproduce → false "✦ fixed". | Med |
| **coach** | RLHF loop has **no feedback-poisoning safeguard, no provenance, no decay/pruning trigger** → one over-generalized rule cascades across the team's next N builds; KB grows unbounded and dilutes attention. Read-back is *assumed*, not verified. | **High** |
| **shapeup** | RULE 2 ("simplest first") undefined when coverage↔complexity trade off → non-deterministic shape selection. Digest can be silently corrupted by hand-edits or a missing ripple-check glob-exclude config. | Med |
| **orient** | The `orient → ba` "scope" handoff has **no schema** — Scout groups by file/module, `ba` consumes as scopes; definitions can diverge with no feedback loop to reconcile. | Med |
| **translator** | "Faithful" verification is Vietnamese-hardcoded (diacritic ranges) despite "any language" claim; structural diff is syntactic count → false-negatives; no frontmatter enum whitelist → valid translation can produce an invalid enum value downstream. | Med |

**Cross-skill seam risk (highest):** the implicit, unschematized contracts — `orient→ba`
scope grouping, `coach→skills` KB read-back — are the brittle joints, and exactly what no
current eval covers.

---

## 5. The evolution layer is built in the wrong order

The most important strategic observation for the *ultimate goal*.

The roadmap landed **Phase 0 (baselines), Phase 1 (trigger-evals), Phase 4 (seesaw gate)** —
and deferred **Phase 2 (functional fixtures), Phase 3 (evolution loop), Phase 5 (repair)**.
That sequencing inverts the value chain:

- **The seesaw gate (Phase 4) now guards a signal the team itself documents as unreliable.**
  Phase 1's own notes admit TPR ≈ 0 is a *proxy artifact* (it measures slash-command
  self-invocation, not real skill auto-activation), accuracy is 0.40–0.55, and "before driving
  description rewrites off TPR, validate proxy fidelity." The deterministic gate is real but
  currently polices a near-meaningless number.
- **The evolution loop (Phase 3) has nothing to optimize against** until Phase 2 exists — the
  genuine reward signal (with-skill vs without-skill functional delta) lives *only* in tier-2
  fixtures.
- **The reward signal is correctly kept out of production** (`metrics.jsonl` stays facts-only,
  no second judge) — good — but that means tier-2 fixtures are the *sole* place real quality is
  measured, and they don't exist.

The ultimate goal is sound and unusually well-grounded (HarnessX/HarnessFix, AEGIS, seesaw).
It is gated entirely on **Phase 2**, which is the missing keystone of the *evolution* layer
just as `spec-evaluator` reliability is the missing keystone of the *runtime* layer. They are
the same problem wearing two hats: **no functional ground truth.**

---

## 6. Recommended path to evolve the goal (prioritized)

**P0 — Build Phase 2 functional fixtures, judge-first.** Start with the `spec-evaluator`
planted-bug fixture (the anti-leniency regression test). Until that one fixture passes
reproducibly, *nothing else in the harness is trustworthy*, because every other skill's
correctness is ultimately asserted by the judge. Then `ba` (no-invented-ACs), `task-executor`
(minimum-code + checkbox), `translator` (faithful + untouched original). This unblocks Phase 3
and gives Phase 4 a real signal.

**P1 — Calibrate the keystone judge.** Add re-probe-on-FAIL + a per-criterion confidence
score, and a `.verdicts-<task>.jsonl` consistency ledger that flags verdict flips. The single
highest-leverage runtime fix; it converts a non-deterministic oracle into a measurable one —
a precondition for ever evolving it.

**P2 — Promote gates from honor-system to enforced.** Use `hooks/hooks.json` to make at least
the load-bearing gate (L2: no EVAL on a non-green board) a hard precondition the model cannot
narrate past. Closes the gap between the harness's control-theory aspiration and its actual
mechanism.

**P3 — Schematize the implicit cross-skill contracts and add coverage.** Define the
`orient→ba` scope schema and the `coach` KB rule schema (id, rule, why, origin, date,
confidence, `contradicts:`). Add the missing safeguards to the learning loop: provenance
archive, decay/pruning trigger, and one verification fixture that proves a written rule
actually changes a downstream skill's behavior (or the RLHF loop is decorative).

**P4 — Close the trigger-eval proxy gap** before letting any `run_loop` description rewrite
touch `main` — measure with skills *installed* (`claude --plugin-dir .`) detecting real
`Skill`-tool activation, not command self-invocation. Otherwise Phase 1's gate optimizes a
phantom.

**Net.** The runtime design is excellent and the evolution thesis is correct; both are
bottlenecked on the *same missing thing* — functional ground truth. Build tier-2 fixtures
judge-first, calibrate the judge, enforce the one gate that matters, and the self-improving
harness stops being an aspiration and starts being measurable.

---

## Appendix — severity legend & blast radius

- **High** = can silently corrupt the verdict or cascade across multiple future builds
  (`spec-evaluator` non-determinism, `ba` contract drift, `coach` feedback poisoning).
- **Med** = degrades reproducibility or wastes a phase but is locally contained and usually
  loud.
- The two **highest-leverage** items are not in the table: (A) gates-as-honor-system and
  (B) absence of tier-2 functional ground truth — they are systemic, not per-skill.
