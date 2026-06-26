# Correction Audit — Fact-Checking the Harness Design Audit's Citations

> A primary-source verification of every external citation relied on by
> [`harness-design-audit.md`](./harness-design-audit.md) and inherited from
> [`docs/plan/evolution-roadmap.md`](../plan/evolution-roadmap.md).
>
> - **Date:** 2026-06-26
> - **Trigger:** the design audit was challenged as possibly "inflecting" (embellishing /
>   fabricating) information — future-dated arXiv IDs (`2606.*`) with invented-sounding names
>   (HarnessX, HarnessFix, AEGIS, ETCLOVG, "seesaw") are the textbook signature of LLM citation
>   hallucination.
> - **Method:** direct queries to the authoritative arXiv export API
>   (`export.arxiv.org/api/query`), arXiv abstract + full-text HTML, `martinfowler.com`, and web
>   search — **with positive and negative controls** to rule out a "the tool just confirms
>   whatever you ask" failure mode (see §4). No claim below rests on a single fetch.

---

## 1. Headline finding — the opposite of the hypothesis

**The suspected fabrication did not happen.** Every primary citation the audit leans on is
**real and resolves to a genuine arXiv paper or web page**, and the most load-bearing technical
claims (AEGIS's four stages, the "seesaw constraint", ETCLOVG) are **verbatim-accurate to the
source papers**. The "future-dated arXiv ID with a funny acronym" smell was a false positive: it
is June 2026, and these papers were published 1–3 weeks before the audit was written.

That said, the verification surfaced **three real defects** — narrower than "fabrication" but
worth fixing:

1. **One genuine misattribution.** `2606.06324` is cited as the paper *"HarnessFix"*. That is
   the **framework name inside the paper**, not the paper's title. The actual title is
   *"From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws."*
2. **One false-precision embellishment.** The acceptance rule `Δtarget ≥ δmin ∧ regression ≤ rmax`
   is presented as a quoted formula from HarnessFix. The paper's abstract states the *concept*
   ("reduce target flaws without introducing unacceptable regressions") but does **not** surface
   that inequality; the formula is stated with unearned precision and should be marked as a
   project restatement, not a quotation, until verified against the paper body.
3. **A methodological lesson (the real story).** Neither the roadmap nor the audit shows any
   sign of having *verified* these citations before building load-bearing rhetoric on them
   ("the ultimate goal is **unusually well-grounded**"). The papers turning out to be real is
   **epistemic luck, not diligence** — and the audit thereby committed the exact sin it accuses
   the harness of in its own Finding B: *confident claims without cited evidence.* The fix is
   not to retract the conclusion (it survived) but to attach the evidence that should have been
   there from the start.

---

## 2. Verdict table (every claim, primary-source-checked)

| # | Claim as written in the docs | Verdict | Correct / verified fact |
|---|---|---|---|
| 1 | arXiv **2606.14249** = *"HarnessX: A Composable, Adaptive, and Evolvable Agent Harness Foundry"* | ✅ **REAL & ACCURATE** | Title exact. 14 authors (Tingyang Chen, Shuo Lu, Kang Zhao … Jian Luan). Published **2026-06-12**. `totalResults=1`. |
| 2 | **AEGIS** = four-stage **Digester → Planner → Evolver → Critic** + **Deterministic Gate** | ✅ **REAL & ACCURATE** | Verbatim in the paper body: *"AEGIS … comprises four stages … Digester, Planner, Evolver, Critic."* `DeterministicGate(·)` appears in Algorithm 1. |
| 3 | **"seesaw constraint"** = *a candidate must not regress any previously-passing task* | ✅ **REAL & ACCURATE** (paper-specific term) | Verbatim: *"enforcing the seesaw constraint: the candidate must not regress any previously solved task recorded in 𝒯ₜ."* Note: "seesaw" is **this paper's coinage**, not a broad community term — the general concept is *non-regression / regression gating / monotonic improvement*. Attribution to HarnessX is correct. |
| 4 | arXiv **2606.06324** = *"HarnessFix"* | ⚠️ **MISATTRIBUTED TITLE** (paper is real) | Real title: ***"From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws."*** Authors: Mengzhuo Chen, Junjie Wang, Zhe Liu, Yawen Wang, Qing Wang. Published **2026-06-04**. "HarnessFix" is the **framework**, not the title. |
| 5 | **ETCLOVG** layer taxonomy | ✅ **REAL** | Confirmed: *"recurring harness-flaw patterns across ETCLOVG layers."* The acronym maps to the harness layers the abstract enumerates — **E**xecution, **T**ool, **C**ontext, **L**ifecycle, **O**bservability, **V**erification, **G**overnance *(letter-mapping inferred from the abstract's layer list; exact gloss should be confirmed in the paper body)*. |
| 6 | **HTIR** (Harness-aware Trace Intermediate Representation) | ✅ **REAL** (not previously cited, should be) | The actual named artifact of the paper: *"compiles raw execution traces and harness code into a Harness-aware Trace Intermediate Representation (HTIR)."* The docs omit it. |
| 7 | HarnessFix acceptance rule `Δtarget ≥ δmin ∧ regression ≤ rmax` | ❌ **OVERSTATED PRECISION** | Abstract supports only the *concept*: *"reduce target flaws without introducing unacceptable regressions."* No such inequality appears in the abstract. Treat as a project restatement; cite a section/equation or soften. |
| 8 | M. Fowler, *"Harness engineering for coding agent users"* — feedforward/feedback controls | ✅ **REAL & ACCURATE** | Live at **martinfowler.com/articles/harness-engineering.html** (~2026-04). Distinguishes **guides (feedforward)** vs **sensors (feedback)**, and **computational** vs **inferential** controls. The audit's "Fowler-style feedforward control" framing is faithful. |
| 9 | Anthropic **skill-creator** (`run_loop.py`, `run_eval.py`, `aggregate_benchmark.py`) | ✅ **REAL** | Official Anthropic plugin; present on this machine under `~/.claude/plugins/marketplaces/…/skill-creator/`. The with-skill-vs-without-skill delta method is genuine. |

**Net:** 6 of 9 fully correct, 1 misattributed title, 1 overstated formula, 1 omission (HTIR).
Zero fabrications.

---

## 3. What this means for the audit's conclusions

- **The engineering critique is untouched.** Findings A (honor-system gates), B (functionally
  untested), C (the non-deterministic judge), and the per-skill grilling do **not** depend on any
  external citation. They stand exactly as written.
- **The "well-grounded" claim is vindicated — but must now carry its evidence.** Line 138 of the
  audit ("*unusually well-grounded (HarnessX/HarnessFix, AEGIS, seesaw)*") is, post-verification,
  **true**. The correction is to fix the HarnessFix title, drop the false-precision formula, and
  cite the verification — converting an unsupported assertion into a supported one.
- **One neutral observation worth recording (not an accusation).** Both papers appeared **within
  ~3 weeks of the audit** and map onto this project's architecture with unusual exactness (typed
  primitives, trace-driven evolution, deterministic gate, non-regression, layered taxonomy).
  Convergent zeitgeist is the simplest explanation. But because the docs cite them as settled
  *foundations* of a half-built roadmap, the team should confirm it has actually **read** these
  papers (not just their abstracts) before Phase 3/5 designs cite their internals as load-bearing.

---

## 4. Why the verification itself is trustworthy (controls)

The risk in this exercise is a hall of mirrors: a fetch tool that "confirms" whatever URL you
hand it would happily validate a fake paper. The verdicts above survive that risk because the
arXiv export channel was **probed with controls and behaved honestly**:

| Probe | Expected if channel is honest | Result |
|---|---|---|
| `2303.08774` (known real) | "GPT-4 Technical Report" | ✅ returned exactly that |
| `2606.99999` (impossible ID) | empty / `totalResults=0` | ✅ NO ENTRY, `totalResults=0` |
| `2606.14250` (adjacent guess) | unrelated paper, **not** an agent/harness echo | ✅ returned *"SyLink Hand"* (robotics) |
| `2505.22954 / 2408.08435 / 2504.15228 / 2410.04444` (real SOTA) | titles/authors matching independent knowledge | ✅ all four matched (see §5) |

A channel that returns *empty* on a miss and an *unrelated* paper on a near-miss is indexing real
data, not parroting the query. That is what lets us trust the positive hits.

---

## 5. The genuine literature (verified — use these going forward)

The roadmap cites HarnessX/HarnessFix but omits the prior art they themselves build on. For a
roadmap whose whole thesis is *self-improving harnesses*, the canon below is the real grounding —
all IDs verified via the export API in this audit:

| Work | arXiv | First author | Year | Relevance |
|---|---|---|---|---|
| **Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents** | 2505.22954 | Jenny Zhang | 2025 | The reference design for an agent that rewrites its own code under an empirical (benchmark) gate — the direct ancestor of "evolve the harness, keep only what doesn't regress." |
| **A Self-Improving Coding Agent (SICA)** | 2504.15228 | Maxime Robeyns | 2025 | An agent that edits its own toolset/harness and measures the delta — closest analogue to this project's tier-2 with/without-skill method. |
| **Automated Design of Agentic Systems (ADAS)** | 2408.08435 | Shengran Hu | 2024 | Meta-search over agent designs; the formalization of "the harness is a first-class object you can optimize." |
| **Gödel Agent: A Self-Referential Framework for Recursive Self-Improvement** | 2410.04444 | Xunjian Yin | 2024 | Theoretical framing for recursive self-modification with a verifier gate. |
| **AlphaEvolve** (Google DeepMind) | — *(whitepaper, not a standard arXiv ID — cite the DeepMind publication, do not invent an arXiv number)* | — | 2025 | Evolutionary coding agent with an automated evaluator selecting survivors — the seesaw/non-regression idea at scale. |

These belong in `evolution-roadmap.md`'s References as the *lineage*, with HarnessX/HarnessFix as
the most recent point on it.

---

## 6. Correction summary (one line each)

- ✅ Keep: HarnessX (2606.14249), AEGIS four stages, Deterministic Gate, seesaw constraint, ETCLOVG, Fowler article, skill-creator — all verified.
- ✏️ Fix: cite `2606.06324` by its **real title**, with HarnessFix as the framework.
- ✏️ Fix: demote `Δ≥δmin ∧ R≤rmax` from "quoted formula" to "our restatement of the paper's non-regression criterion" (or cite the exact equation).
- ➕ Add: HTIR (the paper's actual core artifact) and the verified prior-art lineage (§5).
- ➕ Add: a one-line provenance note that these citations were primary-source-verified on 2026-06-26.

See [`harness-design-audit-proposal.md`](./harness-design-audit-proposal.md) for the exact patches.
