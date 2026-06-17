---
spec: shapeup-context-compaction
target_skill: shapeup
target_version: 2.1
status: ready-to-implement
date: 2026-06-17
supersedes: none
schema_version: 1
---

# Spec — Context Compaction for `/shapeup` (v2.1)

## Problem

Over a long-running project, shaping artifacts (`shaping.md`, `spike-*.md`,
`breadboard.md`, `pitch.md`) accumulate. At each decision gate the LLM is re-fed
raw prose: token-expensive, signal-diluting, and eventually context-overflowing.
Goal: **compact the accumulated state into a deterministic decision context and
feed only the decision-relevant slice at each gate** — without violating
non-regression.

## Non-negotiable framing

The accumulation itself is not the problem. The problem is using the
**source of truth** as the **decision context**. These are two layers:

- **Source** = full artifacts on disk. Immutable once confirmed. Traceability +
  non-regression record.
- **Decision context (digest)** = a cheap, regenerable **derived read model**.
  Never a write surface. The moment a gate's decision mutates the digest as if
  it were state, the confirmed source is lost.

> Compaction is lossy; RULE 3 (non-regression) is lossless.
> Therefore compaction lives **only** in the derived layer.

Shape Up already prescribes compaction tiers — breadboard compacts the idea,
the pitch compacts shaping into 5 ingredients, affordance IDs (`U[N]`/`N[N]`)
are a compact symbol table. We are adding the **missing read model for in-run
state**, not inventing a philosophy.

---

## Decision 1 — Compact form: deterministic tiered digest + wikilinks

**No vector DB at the gate.** Vector retrieval is top-k similarity → recall < 100%
by design. A gate decision needs *every constraint still in force* (a missed
No-Go or out-of-bounds = silent wrong decision). That is a deterministic need;
injecting a probabilistic source = a branching trust axis (rejected pattern).

Compaction = a single `digest.md` per shaping run, tiered with wikilinks down to
full source artifacts. The LLM reads the digest; it follows a wikilink only when
it must drill into one decision.

### Cross-run pitch RAG — DEFERRED (`~`)

Semantic search over a *pitch archive* across many cycles ("have we shaped
something like this before?", reviving passed pitches — *"important ideas come
back"*) is legitimate, but:
- it serves a **human at the betting table**, not an automated gate (probabilistic
  is harmless when a human reviews);
- it is a separate infrastructure bet (embedding model, store, re-index trigger).

Mark `~`. Revive as its own bet at a future betting table. When it lands, its
home is `.claude/shapeup/pitch-archive/` + index — a level-up, never a gate
dependency.

---

## Decision 2 — Producer / consumer split

- **Producer = per-phase, single-writer.** Each phase writes the digest. No new
  orchestration, no new writer — stays a stateless reducer.
- **Consumer = per-decision.** Each gate reads a filtered *view* of the digest.

### `digest.md` schema — 4 fields

| Field | Meaning |
|---|---|
| `appetite` | central Shape Up constraint — never drops out of context |
| `confirmed` | signed-off decisions, one line each + wikilink (frozen record) |
| `open` | open questions / unresolved spikes — the thing that blocks the next gate |
| `links` | wikilinks down to source artifacts |

Affordance tables are NOT inlined — they are their own symbol table in
`breadboard.md`; the digest links to them.

### Two-zone structure (resolves the append-only vs frozen-on-confirm conflict)

Shaping is **not** monotonic: GATE 1 can loop back and revise R; an UNRESOLVED
spike can force the shape to change at GATE 2/3. "Append-only" and
"revision-before-confirm" cannot both be literally true. Resolution — reuse the
existing `frozen zone untouched, append-only` pattern (`--surface-only`):

- **Frozen zone** — decisions that have *passed* a gate. Append-only,
  **absolutely immutable**. This *is* RULE 3 embodied. One line + wikilink.
- **Working head** — exactly one block: the current pre-confirm phase. Freely
  **overwritten / regenerated** until its gate confirms. On confirm → **promote**
  the block into the frozen zone; open a fresh working head for the next phase.

Staleness is **designed out**, not patched:
- frozen zone never stales (both source and digest are frozen — drift impossible);
- working head never stales (rebuilt from the live artifact before its gate fires).

Single-writer preserved; the writer just does one of two ops: *overwrite-head* or
*promote-head*.

> Corrected definition: not "append-only digest" but
> **"append-only frozen zone + mutable working head."**

---

## Decision 3 — Gate → minimal slice (consumer view)

| Gate | Decision | Minimal slice needed | Accumulated state |
|---|---|---|---|
| **0** | Idea has clear user+problem? | raw input only | ~0 — no compaction |
| **1** | R-list right? | problem frame + R-list + **appetite** | small |
| **2** | Shape ok? | R-list (**frozen**) + shape + rationale + constraints | R demoted to checklist |
| **3** | Fit check pass → breadboard? | R-list (frozen) + shape + **fit map** + spike results | S1 prose now useless |
| **4** | Affordances/wiring right? | R-list (frozen) + places + **affordance table** (`U/N`) | symbol table, no prose |
| *Pitch* | betting handoff | everything → 5 ingredients | compaction already exists |

Insight: confirmed state does not grow — it **shrinks in relevance**. GATE 3
needs zero S1 prose; it needs the R-list as a frozen checklist. Compaction is
mostly: *on confirm, demote the block from prose to a frozen one-liner + wikilink.*

Benefit is **back-loaded**: GATE 0–1 have almost nothing to compact; the wins are
at GATE 3–4 and especially the **handoff to ba-pitch-analyzer**. Build digest for
B-phases + pitch first if staging the work.

---

## Decision 4 — Three roots (by artifact *nature*, not by producer)

| Root | Contents | Nature | Git |
|---|---|---|---|
| `docs/shaping/[slug]/` | shaping · breadboard · spike · pitch · kickoff | **durable source** | commit, shared |
| `.claude/specs/[slug]/` | domain model · UC · tasks | **durable deliverable** | commit, shared |
| `.claude/shapeup/runs/[slug]/` | run-state · round ledger · gate log · **digest.md** | **ephemeral / derived** | **gitignore** |

- One anchor `.claude/` (existing Claude Code convention) — **no third top-level
  root.** Tracked `specs/` and ignored `shapeup/runs/` coexist under it.
- `.gitignore`: one line — `.claude/shapeup/runs/`.
- `digest.md` lives in `.claude/shapeup/runs/[slug]/` (it is derived/ephemeral, not
  a source — keep it out of git history and out of team context).

### Private ≠ hidden report

Gitignoring the run workspace must NOT swallow the **report surface**. Shape Up
mandates *"status without asking"*: hill position, verdict, ship sign-off, and
**surprise count** are signals, not noise. Split inside the workspace:
- **live scratch** (raw ledger, gate transition log, digest) → ephemeral, hidden;
- **report surface** (hill / surprise / verdict / sign-off) → harvested at ship
  (see Decision 5), surfaced or archived to a `run-summary.md`.

---

## Decision 5 — Harvest at SHIP (the report + eval-suite feed)

Raw ledger / EVAL prose = ephemeral-in-run (needed live for `--from-discovered`
reconcile and the FAIL-loop; worthless after ship). Harvested **signals** =
durable-mineable. At SHIP, tech-lead harvests one append-only row →
`.claude/shapeup/runs/metrics.jsonl` (**committed**).

Two hard rules (same discipline as Test Surface: *derived, never invented*):
1. Harvest **only fields that already exist as structured output at ship time**.
   If a field forces tech-lead to *evaluate something new* → reject (judgment in
   disguise).
2. Harvest records **facts, never computes a new verdict**. A self-computed
   `run_quality_score` = a second judge behind `spec-evaluator` → breaks
   "single judge" + invites Goodhart. The eval suite *interprets* downstream;
   harvest *records*.

Scope: harvest feeds **only tier-3 (e2e pipeline benchmark)**. Tier-1
(trigger-evals) and tier-2 (per-skill functional, golden fixtures) run on
isolated fixtures and do not consume harvest.

### Harvest schema (one row = one e2e run)

| Field | Existing source | Shape Up signal |
|---|---|---|
| `schema_version` | constant | forward-compat |
| `feature_slug` | run-state | identity |
| `terminal_state` | run-state final: `shipped` / `circuit_broken` / `abandoned` | circuit-breaker outcome |
| `round_count` | round ledger | effort-to-PASS |
| `final_audit_score` | final EVAL report (copied, not re-graded) | conformance |
| `surprise_count` | `discovery/ledger.md` | shaping quality — scope drift |
| `spike_unresolved_count` | `SPIKE-UNRESOLVED` markers at bet | shaping quality — open risk into bet |
| `scope_cut_count` | `~` items cut at SHIP S.0 | appetite pressure / scope hammer |
| `qa_findings` | `qa/hunt-report.md` + triage: `{total, promoted, held}` | edge quality |
| `slice_count` | breadboard B5 (≤9) | **normalizer** |
| `sources` | path/wikilink to each source artifact | auditability |

- `slice_count` is the **denominator**: `round_count=4` on a 2-slice feature is
  alarming, on a 9-slice feature is normal. Without it, e2e comparisons are
  apples-to-oranges. Enables `round-per-slice`, `surprise-per-slice`.
- `spike_unresolved_count` + `surprise_count` measure two of the three **downhill
  conditions** (open-risk-remaining, scope-drift-from-breadboard). A good shaping
  run drives both toward 0 — this is the shaping-quality signal, measured from the
  build trace, no manual grading.

Rejected: `time_spent` / velocity (no clock; Shape Up forbids counting hours —
`round_count` is the legitimate effort proxy); `run_quality_score` (second judge).

Dataflow stays single, no branch: ledger/EVAL/breadboard (existing) → tech-lead
harvests one row at ship (compact, no grading) → eval suite reads. No new writer,
no new judge, no new trust axis.

---

## Decision 6 — Handoff boundary (Axis D, closed)

**`ba-pitch-analyzer` does NOT read the digest. It reads `pitch.md`.**

The digest lives in `.claude/shapeup/runs/` — ephemeral, gitignored, run-scoped;
it dies when the shaping run ends. `pitch.md` is durable source, committed. Each
skill is a stateless reducer reading durable files — no reducer may depend on
another reducer's ephemeral scratch.

> Digest = internal context of **one** shaping run.
> Pitch = the cross-skill compaction.
> The digest never crosses a skill boundary.

---

## Decision 7 — Path & hook rules (anti-landmine, write into spec)

1. **All paths project-relative, resolved from one anchor** (project root / cwd).
   **No `/mnt/...`** anywhere in the distributed skill — `/mnt` is the claude.ai
   authoring sandbox and dies in a user repo.
2. **`schema_version` in both `digest.md` and `metrics.jsonl`** — 8-skill versioning
   is tightly coupled; v2.1 output must be readable by v2.2. Forward-compat for one
   field is cheap.
3. **Digest is a sink, not a node — it carries NO `shaping: true`.** It is outside
   the ripple graph (working-head regeneration absorbs upstream changes on the next
   phase). The ripple-check hook **must glob-exclude `.claude/shapeup/runs/`**, or it
   will scan the digest as a source and ripple incorrectly. This exclude line is
   mandatory config.

---

## Implementation checklist — `shapeup` v2.1

- [ ] Add `resources/context-compaction.md` (this design, operationalized: digest
      format, two-zone rules, overwrite-head vs promote-head ops, gate view table).
- [ ] SKILL.md: add a "Run Workspace & Digest" section pointing to the new resource;
      document the three roots and the gitignore line.
- [ ] Each phase (S1–S4, B1–B5): on entry, regenerate working head from the live
      artifact; on its gate confirm, promote head → frozen zone.
- [ ] Each gate (0–4): read the consumer view-slice (per Decision 3 table) instead
      of full artifact prose.
- [ ] Writer ops: `overwrite-head` and `promote-head` only; frozen zone append-only,
      never rewritten.
- [ ] Path audit: replace any `/mnt/...` assumption with project-relative resolution.
- [ ] Hook config: glob-exclude `.claude/shapeup/runs/`.
- [ ] `schema_version: 1` in digest + metrics templates.
- [ ] (tech-lead side, separate edit) SHIP step: harvest one row → `metrics.jsonl`,
      fields per Decision 5, fact-only.
- [ ] Verify: `grep -n` section headings preserved; `grep -c` field counts; digest
      regenerates deterministically from source on a clean run.

## Deferred (`~`)

- Cross-run pitch RAG / vector archive — own bet at a future betting table.
- Top-level `.shapeup-workspace/` root — only if/when cross-run discovery lands.
