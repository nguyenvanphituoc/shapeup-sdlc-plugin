# Context Compaction — Reference

> Loaded on demand by the shapeup skill for `/shapeup full` (and any multi-gate
> run). Operationalizes the v2.1 context-compaction design: digest format,
> two-zone rules, writer ops, and the per-gate consumer view.

---

## Why this exists

Over a long shaping run the artifacts (`shaping.md`, `spike-*.md`,
`breadboard.md`, `pitch.md`) accumulate. Re-feeding raw prose into the LLM at
every gate is token-expensive, signal-diluting, and eventually
context-overflowing. The fix is **not** to stop accumulating — it is to stop
using the **source of truth** as the **decision context**.

Two layers, never collapsed into one:

- **Source** = the full artifacts on disk (`docs/shapeup-sdlc/[slug]/shaping/...`). Immutable
  once confirmed. The traceability + RULE 3 non-regression record.
- **Decision context (the digest)** = a cheap, regenerable **derived read
  model**. Never a write surface. The moment a gate's decision mutates the
  digest as if it were state, the confirmed source is lost.

> Compaction is lossy; RULE 3 (non-regression) is lossless.
> Therefore compaction lives **only** in the derived layer.

This is not a new philosophy — Shape Up already compacts (breadboard compacts the
idea, the pitch compacts shaping into 5 ingredients, affordance IDs `U[N]`/`N[N]`
are a compact symbol table). The digest is the missing read model for **in-run
state**.

---

## The digest — `digest.md`

One digest per shaping run. It lives in the **ephemeral, gitignored** run
workspace, not next to the source artifacts:

```
.shapeup-sdlc/[feature-slug]/digest.md
```

The LLM reads the digest at each gate; it follows a wikilink down to a full
source artifact **only** when it must drill into one decision. No vector DB at
the gate — a gate decision needs *every* constraint still in force (a missed
No-Go or out-of-bounds = a silent wrong decision), which is a deterministic need.

### Schema — 4 fields

| Field | Meaning |
|---|---|
| `appetite` | central Shape Up constraint — never drops out of context |
| `confirmed` | signed-off decisions, one line each + wikilink (frozen record) |
| `open` | open questions / unresolved spikes — the thing that blocks the next gate |
| `links` | wikilinks down to source artifacts |

Affordance tables are **NOT** inlined — they are their own symbol table in
`breadboard.md`; the digest links to them.

`schema_version: 1` is carried in the frontmatter — v2.1 output must be readable
by v2.2 (8-skill versioning is tightly coupled; forward-compat for one field is
cheap).

### Two-zone structure

Shaping is **not** monotonic: GATE 1 can loop back and revise the R-list; an
UNRESOLVED spike can force the shape to change at GATE 2/3. "Append-only" and
"revision-before-confirm" cannot both be literally true. The resolution reuses
the existing *frozen zone untouched, append-only* pattern:

- **Frozen zone** — decisions that have *passed* a gate. Append-only,
  **absolutely immutable**. This *is* RULE 3 embodied. One line + wikilink each.
- **Working head** — exactly one block: the current pre-confirm phase. Freely
  **overwritten / regenerated** until its gate confirms. On confirm → **promote**
  the block into the frozen zone; open a fresh working head for the next phase.

> Corrected definition: not "append-only digest" but
> **"append-only frozen zone + mutable working head."**

Staleness is **designed out**, not patched:
- the frozen zone never stales (both source and digest are frozen — drift
  impossible);
- the working head never stales (rebuilt from the live artifact before its gate
  fires).

### Digest template

```markdown
---
schema_version: 1
type: shaping-digest
feature: [feature-slug]
appetite: [~1 week | ~2 weeks | ~6 weeks | TBD (uncapped)]
---

# [Feature] — Shaping Digest (derived read model — DO NOT hand-edit)

> Regenerated from source on each phase. Source of truth is the artifacts under
> `docs/shapeup-sdlc/[feature-slug]/shaping/`. This file is ephemeral + gitignored.

## Appetite
[~N weeks — anchors scope for every gate below]

## Confirmed (frozen — append-only, immutable)
- [S1] Problem frame: [one line] → [[shaping#problem-frame]]
- [S2] R-list: R0..RN [one-line gist] → [[shaping#requirements]]
- [S2.5] Rabbit holes / no-goes: [one line] → [[shaping#rabbit-holes]]
- [S3] Shape: [name] — [one line rationale] → [[shaping#selected-shape]]
- [S4] Fit check: clean (or: R3 ⚠️ → [[spike-pagination]]) → [[shaping#fit-check]]
- [B1] Places: [list] → [[breadboard#places]]
- [B3] Affordances: U0..UN / N0..NN → [[breadboard#affordances]]
- [B5] Slices: [count] (≤9) → [[breadboard#slicing]]

## Working head — [current phase, e.g. "S3 — Solution Shape"]
[the full pre-confirm content of the current phase; freely overwritten until its
 gate confirms, then promoted to a one-liner above and replaced by the next phase]

## Open (blocks the next gate)
- [ ] [unresolved spike / open question] → [[spike-xxx]]

## Links
- shaping → [[../../docs/shapeup-sdlc/[feature-slug]/shaping/shaping.md]]
- breadboard → [[../../docs/shapeup-sdlc/[feature-slug]/shaping/breadboard.md]]
- spikes → [[../../docs/shapeup-sdlc/[feature-slug]/shaping/spike-*.md]]
```

---

## Writer ops — exactly two

The digest stays **single-writer** (the running phase). The writer does exactly
one of two operations — never an arbitrary edit:

| Op | When | Effect |
|---|---|---|
| **overwrite-head** | On entry to a phase, and on any pre-confirm revision | Rebuild the *Working head* block from the live source artifact. The frozen zone is never touched. |
| **promote-head** | On the phase's gate confirm | Collapse the working head into a one-line + wikilink entry appended to the *Confirmed* (frozen) zone; open a fresh working head for the next phase. |

The frozen zone is **append-only and never rewritten**. A revision loop (GATE 1
loops back, a spike forces a shape change) is just repeated `overwrite-head` on
the *current* head — it can never mutate an already-frozen line, because the
phase that wrote it has already passed its gate.

---

## Gate → minimal slice (the consumer view)

At each gate, read the **filtered view** below from `digest.md` — not the full
artifact prose. Confirmed state does not grow; it **shrinks in relevance** (GATE
3 needs zero S1 prose — it needs the R-list as a frozen checklist). Compaction is
mostly: *on confirm, demote the block from prose to a frozen one-liner + wikilink.*

| Gate | Decision | Minimal slice to read | Accumulated state |
|---|---|---|---|
| **0** | Idea has clear user + problem? | raw input only | ~0 — nothing to compact |
| **1** | R-list right? | problem frame + R-list + **appetite** | small |
| **2** | Shape ok? | R-list (**frozen**) + shape + rationale + constraints | R demoted to checklist |
| **3** | Fit check → breadboard? | R-list (frozen) + shape + **fit map** + spike results | S1 prose now useless |
| **4** | Affordances/wiring right? | R-list (frozen) + places + **affordance table** (`U/N`) | symbol table, no prose |
| *Pitch* | betting handoff | everything → 5 ingredients | compaction already exists |

**Benefit is back-loaded.** GATE 0–1 have almost nothing to compact; the wins are
at GATE 3–4 and especially the **handoff to ba-pitch-analyzer**. If staging the
work, build the digest for the B-phases + pitch first.

---

## The two roots (by artifact *nature*, not by producer)

Everything keys off the feature `<slug>`. Two roots, split by **who needs it**:

| Root | Contents | Nature | Git |
|---|---|---|---|
| `docs/shapeup-sdlc/[slug]/shaping/` | shaping · breadboard · spike · pitch · kickoff | **durable source** | commit, shared |
| `docs/shapeup-sdlc/[slug]/spec/` | domain model · UC · contracts · tasks | **durable deliverable** | commit, shared |
| `.shapeup-sdlc/[slug]/` | run-state · round ledger · gate log · **digest.md** · orient/ · evaluation/ · qa/ · discovery/ledger.md · harness-run.md | **ephemeral / derived** | **gitignore (hidden)** |

- The **shared** root `docs/shapeup-sdlc/[slug]/` holds what the team contributes
  to and reviews — source (shaping) + deliverable (spec). One feature folder, two
  subfolders.
- The **local** root `.shapeup-sdlc/[slug]/` is per-run scratch + reports — hidden,
  fully gitignorable, dies with the run. It is derived from the same `<slug>`.
- `.gitignore`: one line — `.shapeup-sdlc/`. The whole local root is ignored; no
  carve-out is needed because the one committed report surface, the harvested
  signal feed `docs/shapeup-sdlc/metrics.jsonl` (written by the tech-lead at SHIP,
  fact-only; see the tech-lead skill's SHIP step), lives in the **shared** root.
- All paths are **project-relative, resolved from the project root / cwd.** Never
  `/mnt/...` — that is the claude.ai authoring sandbox and dies in a user repo.

### Private ≠ hidden report

Gitignoring the run workspace must NOT swallow the **report surface**. Shape Up
mandates *status without asking* — hill position, verdict, ship sign-off, and
surprise count are signals, not noise. Split inside the workspace:
- **live scratch** (raw ledger, gate transition log, digest) → ephemeral, hidden;
- **report surface** (hill / surprise / verdict / sign-off) → harvested at ship
  (the tech-lead's metrics row), surfaced or archived to a `run-summary.md`.

---

## Handoff boundary — the digest never crosses a skill

**`ba-pitch-analyzer` does NOT read the digest. It reads `pitch.md` / `shaping.md`.**

The digest lives in `.shapeup-sdlc/` — ephemeral, gitignored, run-scoped;
it dies when the shaping run ends. `pitch.md`/`shaping.md` are durable source,
committed. Each skill is a stateless reducer reading durable files — no reducer
may depend on another reducer's ephemeral scratch.

> Digest = internal context of **one** shaping run.
> Pitch = the cross-skill compaction.
> The digest never crosses a skill boundary.

---

## The digest is a sink, not a node — the ripple-check rule

The digest carries **NO `shaping: true`** in its frontmatter. It is *outside* the
ripple graph: working-head regeneration absorbs any upstream change on the next
phase, so the digest never needs to be rippled into.

**Mandatory config:** the ripple-check must **glob-exclude
`.shapeup-sdlc/`**. Without the exclude, the check scans the digest as a
source artifact and ripples incorrectly (the digest links *down* to sources; a
naive scanner reads those wikilinks as upstream edges and inverts the graph).

---

## Deferred (`~`)

- **Cross-run pitch RAG / vector archive** — semantic search over a *pitch
  archive* across cycles ("have we shaped this before?", reviving passed pitches)
  serves a **human at the betting table**, not an automated gate, so probabilistic
  recall is harmless there. It is a separate infrastructure bet (embedding model,
  store, re-index trigger). Revive as its own bet at a future betting table; its
  home would be `.shapeup-sdlc/pitch-archive/` + index — a level-up, never a
  gate dependency.
- **Cross-run pitch archive** under `.shapeup-sdlc/pitch-archive/` — only if/when
  cross-run discovery lands. (The two-root workspace itself shipped in v2.2.)
