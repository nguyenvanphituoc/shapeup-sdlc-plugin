---
name: shapeup
description: >
  Use this skill for any Shape Up workflow before writing code. Triggers on:
  "shape this feature", "frame this problem", "breadboard this", "map affordances",
  "write a framing doc", "write a kickoff doc", "turn this transcript into a framing document",
  "turn this transcript into a kickoff document", "what should we build", "explore solutions",
  "is this shaped enough to build", "slice this into scopes", "fit check", "wiring diagram".
  Also triggers when user says "before we build...", "I want to think through...",
  "let's shape this", or provides a raw transcript and wants it structured.
  DEFAULT: if no sub-command given, run /shapeup full — ask clarifying questions at each gate,
  keep solutions as simple as possible, never touch parts that already work.

  Sub-commands: /shapeup full | /shapeup shaping | /shapeup spike | /shapeup breadboarding | /shapeup framing-doc | /shapeup kickoff-doc | /shapeup breadboard-reflection
---

# ShapeUp Skill — v2.1

Shape Up workflows for Claude Code — covering every stage from raw problem to
wiring diagram to structured handoff documents. Run these **before** writing code.

## Resource Files (Load On Demand)

This skill lazily loads detail from resource files. **Read the relevant resource before executing any workflow:**

| Sub-command | Resource to Read |
|---|---|
| `/shapeup shaping` | `resources/shaping.md` |
| `/shapeup spike` | `resources/spike.md` |
| `/shapeup breadboarding` | `resources/breadboarding.md` |
| `/shapeup framing-doc` | `resources/framing-doc.md` |
| `/shapeup kickoff-doc` | `resources/kickoff-doc.md` |
| `/shapeup breadboard-reflection` | `resources/breadboard-reflection.md` |
| `/shapeup full` | Read `resources/shaping.md` first, then `resources/breadboarding.md` before B-phases, and `resources/context-compaction.md` for the run digest |

> Resource paths are relative to this skill's directory. In Claude Code: `.claude/skills/shapeup/resources/`.
> Multi-gate runs maintain a derived **decision digest** so each gate reads a compact slice instead of full prose — see `resources/context-compaction.md` and the "Run Workspace & Digest" section below.

---

## Canonical Workflow Order

```
/shaping                    /breadboarding
─────────────────────────   ───────────────────────────────────
1. Problem frame             5. [optional] Fat marker sketch
2. Requirements (R)          6. Affordance tables + wiring
3. Solution shape (A)        7. SLICING → vertical scopes
4. Fit check (R ↔ A)
       ↓
   Spike docs
(for unknowns only)
       ↓
  breadboarding
```

**The single most common mistake:** putting slicing inside shaping. Slicing is the
final phase of breadboarding — not shaping. Shaping ends at the fit check.

---

## Which Sub-Command to Use

| You have... | Use... |
|---|---|
| A raw idea and want the full shaped pitch | `/shapeup full` |
| A raw problem or feature idea | `/shapeup shaping` |
| Shaped solution with unknowns to de-risk first | `/shapeup spike` |
| Shaped solution ready for concrete wiring | `/shapeup breadboarding` |
| A transcript of a problem/betting conversation | `/shapeup framing-doc` |
| A transcript of a shaped project kickoff | `/shapeup kickoff-doc` |
| An existing breadboard with design smells | `/shapeup breadboard-reflection` |

---

## Invocation

```bash
# DEFAULT — no sub-command = runs full pipeline automatically
/shapeup

# Explicit full pipeline (same as default)
/shapeup full

# Individual phases
/shapeup shaping
/shapeup spike "Does zoneinfo cover our timezone needs, or do we need a network API?"
/shapeup breadboarding

# Document skills (team/collaborative contexts)
/shapeup framing-doc < transcript.md
/shapeup kickoff-doc < transcript.md

# Maintenance
/shapeup breadboard-reflection < breadboard.md
```

---

## WORKFLOW 0 — `/shapeup full` (DEFAULT)

**Purpose:** End-to-end pipeline from raw idea to final `shaping.md` + `breadboard.md`.
**This is the default mode** — if no sub-command is given, run this.

**Load resources:** Read `resources/shaping.md`, then `resources/breadboarding.md` before B-phases.

**Three standing rules that apply for the entire pipeline:**

```
RULE 1 — ASK, DON'T ASSUME
  Never fill gaps with assumptions. When information is missing or ambiguous,
  STOP and ask the user before proceeding. One focused question at a time.
  Gate questions are mandatory (see below). Ad-hoc questions fire whenever
  Claude would otherwise have to guess something that affects the output.

RULE 2 — SIMPLEST SOLUTION FIRST
  At every decision point, prefer the simpler option.
  If two shapes cover the requirements equally, pick the one with fewer parts.
  If an affordance can be removed without breaking coverage, remove it.
  Complexity must be justified by a requirement — never added speculatively.

RULE 3 — NON-REGRESSION
  Do not change, refactor, or re-interpret anything the user has already
  confirmed as correct. If S1–S2 are signed off, S3 must not rewrite the
  problem frame or requirements. Scope only forward.
```

---

### Mandatory Gate Questions

At each gate below, Claude MUST pause and ask before continuing.

**Digest discipline (see `resources/context-compaction.md`).** On a multi-gate run,
maintain a derived decision digest at `.shapeup-sdlc/[slug]/digest.md`:
- **On entry to each phase** → `overwrite-head`: rebuild the digest's *working
  head* from the live source artifact.
- **At each gate, to make the decision** → read the gate's **minimal slice** (the
  consumer view), not full artifact prose:

  | Gate | Minimal slice to read |
  |---|---|
  | 0 | raw input only (nothing to compact) |
  | 1 | problem frame + R-list + **appetite** |
  | 2 | R-list (frozen) + shape + rationale + constraints |
  | 3 | R-list (frozen) + shape + **fit map** + spike results |
  | 4 | R-list (frozen) + places + **affordance table** (`U/N`) |

- **On gate confirm** → `promote-head`: collapse the working head into a one-line +
  wikilink in the *Confirmed* (frozen) zone, then open a fresh head for the next
  phase. The frozen zone is append-only and immutable (RULE 3). The digest is a
  derived read model — never the source of truth, never hand-edited.

```
GATE 0 — Before starting (fires if input is vague OR appetite is missing)
  Ask (two parts, one at a time if both missing):
    Part A: "Who is the user experiencing this problem, and what are they
             trying to accomplish? What's broken or missing for them today?"
    Part B: "What's the right time budget for this? (e.g. 1 week, 2 weeks, 6 weeks)
             Appetite anchors scope — without it, the shape has no natural stopping point."
  Skip Part A if: input already contains a clear user + problem statement.
  Skip Part B if: input already states an appetite / time budget.

GATE 1 — After S2 (Requirements)
  Show the R-list. Ask:
  "Are these the right requirements? Anything missing or out of scope?"
  Wait for explicit confirmation before shaping.

GATE 2 — After S3 (Shape selection)
  Show the selected shape with rationale. Ask:
  "Does this direction feel right? Any constraints I should know about
   (tech stack, team size, existing systems, appetite/time budget)?"
  Wait for confirmation before fit check.

GATE 3 — After S4 (Fit Check) / before breadboarding
  Show the fit check table. If any ❌ or ⚠️ exist, resolve them first.
  Ask: "Ready to move to wiring, or is there anything to adjust?"

GATE 4 — After B3 (Affordance Tables) / before slicing
  Show the affordance tables. Ask:
  "Do these affordances look right? Anything missing from the wiring?"
  Wait before slicing.
```

---

### Full Pipeline Execution Order

```
INPUT: raw idea / brief / feature description
   │
   ▼
[GATE 0] — ask if input is vague OR appetite is missing
   ▼
[S1] Problem Frame + Appetite
   │  → one-paragraph problem statement (no solution language)
   │  → appetite: e.g. "~1 week" or "~2 weeks" — anchors scope throughout
   ▼
[S2] Requirements (R)
   │  → R0..RN, observable, technology-agnostic
   ▼
[S2.5] Rabbit Holes
   │  → explicit list of known traps that could eat the appetite
   │  → no-goes: things explicitly outside this feature
   ▼
[GATE 1] ← PAUSE — confirm R-list + rabbit holes ───────┐
   ▼                                                      │ revise if needed
[S3] Solution Shape (A)                                   │
   │  → simplest shape that covers all R within appetite  │
   ▼                                                      │
[GATE 2] ← PAUSE — confirm shape + constraints ──────────┘
   ▼
[S4] Fit Check
   │  → every R mapped; ❌ items surface as gate blockers
   │
   ├─ unknowns? → SPIKE inline; if unresolvable → [SPIKE-UNRESOLVED] + continue
   │
   ▼
[GATE 3] ← PAUSE — confirm fit check, greenlight breadboarding
   ▼
[B0] Fat Marker Sketch (UI-heavy features only; skip otherwise)
   ▼
[B1] Identify Places
   ▼
[B2–B3] Map Affordances + Tables
   │  → keep affordance count minimal; remove any not required by an R
   ▼
[GATE 4] ← PAUSE — confirm affordance tables
   ▼
[B4] Wiring Verification (fix smells inline; do not stop)
   ▼
[B5] Slicing
   │  → ≤9 slices; each slice = one demonstrable capability
   ▼
[KICKOFF-READY] — assert before writing output files:
   ✅ appetite is set  ✅ all spikes resolved (or SPIKE-UNRESOLVED documented)
   ✅ rabbit holes listed  ✅ fit check clean  ✅ ≤9 slices
   ▼
OUTPUT: shaping.md + breadboard.md (+ spike-[part].md if applicable)
        → kicked-off pitch, ready for /ba-pitch-analyzer or /tech-lead
```

### Progress Markers

```
▶ S1 — Problem Frame + Appetite
▶ S2 — Requirements
▶ S2.5 — Rabbit Holes + No-goes
⏸ GATE 1 — Confirming requirements + rabbit holes...
▶ S3 — Solution Shape
⏸ GATE 2 — Confirming shape + constraints...
▶ S4 — Fit Check
⏸ GATE 3 — Greenlight breadboarding...
▶ B1 — Places
▶ B2-B3 — Affordances
⏸ GATE 4 — Confirming affordance tables...
▶ B4 — Wiring Verification
▶ B5 — Slices
✅ KICKOFF-READY — shaping.md + breadboard.md written (kicked-off pitch)
```

---

## WORKFLOW 1 — `/shapeup shaping`

**Load resource:** `resources/shaping.md`

**Purpose:** Iterate on both the problem (requirements) and solution (shapes) before
committing to implementation. **Stop here — do not slice yet.**

**Ends when:** Every requirement maps to a shape part. Unknowns are flagged for spikes.

For full phase detail (S1→S4, output format, common mistakes) → read `resources/shaping.md`.

---

## WORKFLOW 2 — `/shapeup spike`

**Load resource:** `resources/spike.md`

**Purpose:** De-risk an unknown before breadboarding. Time-boxed investigation that
answers a specific question so the breadboard can be grounded in fact.

For full spike process, output format, and SPIKE-UNRESOLVED fallback → read `resources/spike.md`.

---

## WORKFLOW 3 — `/shapeup breadboarding`

**Load resource:** `resources/breadboarding.md`

**Purpose:** Take the shaped solution and map every UI affordance, code affordance,
and wiring relationship. Then slice into vertical implementation scopes.

**Input required:** A `shaping.md` with a completed fit check. All spikes resolved.

For full phase detail (B0→B5), core concepts (Places, affordances, wiring), Mermaid conventions,
slicing rules, verification checks, and worked examples → read `resources/breadboarding.md`.

**Key things in the resource:**
- Blocking test for Places
- Place IDs + navigation wiring pattern
- Mermaid color conventions + classDef snippets
- Chunking pattern for complex subsystems
- Slice summary format + visualization
- Verification checklist

---

## WORKFLOW 4 — `/shapeup framing-doc`

**Load resource:** `resources/framing-doc.md`

**Purpose:** Turn a conversation transcript into a structured framing document.
GIGO warning applies — formats and distills only.

For full phases (F1→F3) and output template → read `resources/framing-doc.md`.

---

## WORKFLOW 5 — `/shapeup kickoff-doc`

**Load resource:** `resources/kickoff-doc.md`

**Purpose:** Turn a shaped project kickoff transcript into a builder reference document.
GIGO warning applies.

For full phases (K1→K3) and output template → read `resources/kickoff-doc.md`.

---

## WORKFLOW 6 — `/shapeup breadboard-reflection`

**Load resource:** `resources/breadboard-reflection.md`

**Purpose:** Review an existing breadboard for design smells and structural issues.
Fix wiring, naming, and causality problems before handing off to implementation.

For full smell catalog (naming / wiring / causality / scope) and review process → read `resources/breadboard-reflection.md`.

---

## Document Structure

All shaping **source** documents go in: `docs/shapeup-sdlc/[feature-slug]/shaping/`

```
docs/shapeup-sdlc/[feature-slug]/shaping/
├── frame.md          ← /shapeup framing-doc (team context only)
├── shaping.md        ← /shapeup shaping  (problem + R + A + fit check)
├── spike-[part].md   ← /shapeup spike    (one file per unknown)
├── breadboard.md     ← /shapeup breadboarding  (affordances + slices)
└── kickoff.md        ← /shapeup kickoff-doc (team context only)
```

All **source** files must have `shaping: true` in YAML frontmatter so the
ripple-check activates. Paths are **project-relative** (resolved from the project
root / cwd) — never `/mnt/...`, which is the authoring sandbox and dies in a user
repo.

---

## Run Workspace & Digest

Two roots, separated by artifact **nature** (full design →
`resources/context-compaction.md`). Both key off the feature `<slug>`:

| Root | Contents | Nature | Git |
|---|---|---|---|
| `docs/shapeup-sdlc/[slug]/shaping/` | shaping · breadboard · spike · pitch · kickoff | **durable source** | commit, shared |
| `docs/shapeup-sdlc/[slug]/spec/` | domain model · UC · contracts · tasks (ba-pitch-analyzer output) | **durable deliverable** | commit, shared |
| `.shapeup-sdlc/[slug]/` | run-state · gate log · **digest.md** · orient/ · evaluation/ · qa/ · ledger | **ephemeral / derived** | **gitignore (hidden)** |

- **Shared** root `docs/shapeup-sdlc/[slug]/` = what the team contributes to
  (source + deliverable). **Local** root `.shapeup-sdlc/[slug]/` = per-run scratch,
  hidden and fully gitignorable. Add **one** line to `.gitignore`: `.shapeup-sdlc/`.
  No carve-out needed — the one committed report surface, the harvest feed
  `docs/shapeup-sdlc/metrics.jsonl`, lives in the shared root.
- `digest.md` is the run's derived decision context (the 4-field, two-zone read
  model the gates consume). It is **never** the source of truth and never crosses
  a skill boundary — `ba-pitch-analyzer` reads `pitch.md`/`shaping.md`, never the
  digest.
- **Ripple-check rule (mandatory):** the digest carries **no `shaping: true`** —
  it is a sink, not a node. The ripple-check **must glob-exclude
  `.shapeup-sdlc/`**, or it will scan the digest as a source and ripple
  incorrectly.

---

## Integration with ba-pitch-analyzer

```
/shapeup shaping          → shaping.md
/shapeup spike            → spike-[part].md  (as needed)
/shapeup breadboarding    → breadboard.md (with slices)
         ↓
/ba-pitch-analyzer docs/shapeup-sdlc/[feature-slug]/shaping/shaping.md
         ↓
docs/shapeup-sdlc/[feature-slug]/spec/  (domain model, contracts, use cases, tasks)
```

Reference affordance IDs (U[N], N[N]) in task descriptions and commit messages
to maintain traceability: breadboard → task → commit.

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| 2.2 | 2026-06-18 | **Two-root workspace.** Collapsed the three artifact roots into two keyed off `<slug>`: **shared** `docs/shapeup-sdlc/[slug]/` (subfolders `shaping/` + `spec/`, committed) and **local** `.shapeup-sdlc/[slug]/` (run-state · digest · orient/ · evaluation/ · qa/ · ledger, hidden + gitignorable). `.gitignore` simplifies to one line `.shapeup-sdlc/` — no carve-out, since the committed harvest feed `docs/shapeup-sdlc/metrics.jsonl` now lives in the shared root. Ripple-check glob-exclude updated to `.shapeup-sdlc/`. Digest path → `.shapeup-sdlc/[slug]/digest.md`. |
| 2.1 | 2026-06-17 | **Context compaction** (`resources/context-compaction.md`): per-run derived decision digest at `.shapeup-sdlc/[slug]/digest.md` — 4 fields (appetite/confirmed/open/links), two-zone (append-only frozen zone + mutable working head), two writer ops (overwrite-head on phase entry, promote-head on gate confirm); each gate reads its minimal consumer slice instead of full prose; roots split by artifact nature (durable source / durable deliverable / ephemeral run); `.gitignore` line `.shapeup-sdlc/` (the committed `docs/shapeup-sdlc/metrics.jsonl` harvest feed stays tracked in the shared root); ripple-check must glob-exclude the run workspace (digest is a sink, no `shaping: true`); `schema_version: 1` for forward-compat; digest never crosses the ba-pitch-analyzer boundary. Plus (2026-06-16): appetite as mandatory gate-0 input (fires when appetite missing, not just when vague); Phase S2.5 Rabbit Holes + No-goes; KICKOFF-READY assertion block at pipeline end; output is now explicitly a "kicked-off pitch" consumable by /tech-lead; shaping.md template updated in resources/shaping.md |
| 2.0 | 2026-06-03 | Extracted workflow detail into `resources/` files (shaping.md, breadboarding.md, spike.md, framing-doc.md, kickoff-doc.md, breadboard-reflection.md); SKILL.md now acts as router with lazy-load directives; breadboarding resource upgraded from upstream rjs/shaping-skills (full concept catalog: Place IDs, navigation wiring, Chunking, Subplaces, Place References, Modes as Places, whiteboard breadboard reading, full Mermaid color conventions, side-effect stores, containing-box pattern) |
| 1.3 | 2026-06-02 | full pipeline is now DEFAULT; 3 standing rules; 5 mandatory gate pauses (GATE 0–4) |
| 1.2 | 2026-06-02 | Added WORKFLOW 0 /shapeup full — autonomous pipeline S1→S4→Spike→B0→B5; progress markers; SPIKE-UNRESOLVED fallback |
| 1.1 | 2026-05-28 | Workflow order corrected: Slicing moved from shaping into breadboarding; Spike added; fat marker sketch as B0 |
| 1.0 | 2026-05-28 | Initial: shaping, breadboarding, framing-doc, kickoff-doc, breadboard-reflection |
