# Proposal — Citation Corrections & Citation-Hygiene Process

> Companion to [`harness-design-audit-correction.md`](./harness-design-audit-correction.md).
> Concrete, copy-pasteable edits + a lightweight process so the next doc can't repeat the
> "confident-but-unverified" pattern.
>
> - **Date:** 2026-06-26
> - **Scope of edits:** `docs/plan/evolution-roadmap.md`, `docs/research/harness-design-audit.md`,
>   `docs/enhancements.md`, `docs/repair-memory.md` (citation lines only — no behavior change).

---

## Part A — Exact text patches

### A1. `evolution-roadmap.md` — the HarnessFix title (the one real misattribution)

**Lines 57–60, replace:**

> Companion paper **HarnessFix** (arXiv **2606.06324**) adds *diagnosis-driven* repair: trace →
> localize the failing step → map to a **scoped repair operator** → a patch is accepted only if
> `Δtarget ≥ δmin` **and** `regression ≤ rmax`.

**with:**

> The companion paper *"From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing
> Harness Flaws"* (arXiv **2606.06324**) introduces the **HarnessFix** framework: it compiles
> traces + harness code into a **Harness-aware Trace Intermediate Representation (HTIR)**,
> attributes failures to the responsible step and harness layer, and maps them to **scoped repair
> operators** — accepting a patch only when it *"reduce[s] target flaws without introducing
> unacceptable regressions"* (our shorthand: `Δtarget ≥ δmin ∧ regression ≤ rmax`; confirm the
> exact threshold form against the paper body before treating it as a quote).

### A2. `evolution-roadmap.md` — References (lines 218–219), replace:

> - HarnessX — arXiv 2606.14249 (AEGIS four-stage loop; seesaw constraint).
> - HarnessFix — arXiv 2606.06324 (diagnosis-driven repair; ETCLOVG; `Δ≥δmin ∧ R≤rmax`).

**with:**

> - **HarnessX: A Composable, Adaptive, and Evolvable Agent Harness Foundry** — Tingyang Chen et
>   al., arXiv **2606.14249** (2026-06-12). AEGIS = Digester → Planner → Evolver → Critic +
>   Deterministic Gate; "seesaw constraint" (no regression on previously-solved tasks).
>   *Verified against arXiv abstract + full text, 2026-06-26.*
> - **From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws**
>   (framework: **HarnessFix**) — Mengzhuo Chen et al., arXiv **2606.06324** (2026-06-04). HTIR;
>   ETCLOVG layer taxonomy; scoped repair operators. *Verified 2026-06-26.*
> - **Prior art / lineage:** Darwin Gödel Machine (2505.22954), SICA (2504.15228), ADAS
>   (2408.08435), Gödel Agent (2410.04444), AlphaEvolve (DeepMind, 2025).

### A3. `evolution-roadmap.md` — the AEGIS-map row (line 87), replace:

> | HarnessFix repair operator + `Δ≥δmin ∧ R≤rmax` | Phase-5 scoped repair, same accept rule as the seesaw gate |

**with:**

> | HarnessFix scoped repair operator (accept iff target flaws ↓ without unacceptable regression) | Phase-5 scoped repair, same non-regression accept rule as the seesaw gate |

### A4. `harness-design-audit.md` — line 25, replace:

> grounded in HarnessX (arXiv 2606.14249) / HarnessFix (arXiv 2606.06324).

**with:**

> grounded in HarnessX (arXiv 2606.14249) and the HarnessFix framework (*"From Failed
> Trajectories to Reliable LLM Agents…"*, arXiv 2606.06324). *Citations primary-source-verified —
> see `harness-design-audit-correction.md`.*

### A5. `harness-design-audit.md` — line 138, append a clause:

> The ultimate goal is sound and unusually well-grounded (HarnessX/HarnessFix, AEGIS, seesaw) —
> **and, as of 2026-06-26, each of those citations has been confirmed against the primary
> sources** (see the correction audit).

### A6. `enhancements.md` (line 46) & `repair-memory.md` (line 3)

No change required — both reference HarnessX/HarnessFix/AEGIS *as framework names*, which is
correct usage. Optionally add the arXiv IDs inline for traceability.

---

## Part B — The process fix (so this can't recur)

The defect was not "bad papers"; it was **building rhetoric on unverified references**. One
lightweight rule closes it:

> **Citation-provenance rule.** Any external citation (arXiv ID, paper title, named framework, or
> a quoted formula/term) introduced into `docs/` must carry an inline *verification stamp* —
> `*Verified <date> via <source>*` — added by the author at the time of writing. A citation
> without a stamp is treated as **unverified** and may not be used as the basis for a strength
> claim ("well-grounded", "proven", "state-of-the-art").

Why this and not something heavier:
- It mirrors the harness's own best instinct — the `spec-evaluator` "**evidence-or-FAIL**" rule —
  applied to *documentation* instead of code.
- It is the doc-layer analogue of Finding B's prescription: the project demands cited evidence
  from its agents; its own design docs should meet the same bar.
- It costs one line per citation and is checkable by a trivial lint (grep for arXiv IDs lacking a
  nearby "Verified" stamp) if the team wants to enforce it in CI later.

**Optional, higher-effort:** add a `docs/research/citations.md` ledger (ID → title → authors →
date → verified-on) that all docs link to, so a citation is verified once and reused. Recommended
only if the bibliography keeps growing.

---

## Part C — Suggested commit

These are documentation-only edits. Suggested grouping:

1. `docs: correct HarnessFix paper title + add HTIR/lineage citations (primary-source-verified)`
2. `docs: add citation-provenance rule to AGENTS.md` *(if the team adopts Part B)*

No code, skills, or evals are touched; the seesaw gate / CI are unaffected.

---

## Part D — What NOT to change

To keep the correction honest and proportionate:
- **Do not** retract the "well-grounded" thesis — it verified true.
- **Do not** remove HarnessX/HarnessFix/AEGIS/seesaw/ETCLOVG — all real.
- **Do not** invent an arXiv ID for AlphaEvolve — it is a DeepMind publication; cite it as such.
- **Do not** treat the ~3-week recency of the papers as evidence of fabrication — it isn't; it is
  just recency. Flag it only as a "read the full papers before Phase 3/5" reminder.
