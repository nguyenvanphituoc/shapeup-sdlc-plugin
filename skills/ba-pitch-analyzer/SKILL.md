---
name: ba-pitch-analyzer
description: >
  Use this skill whenever a user provides a product requirement, pitch, or feature description
  and wants it broken down into structured, executable development tasks. Triggers on: "analyze
  this pitch", "break this into tasks", "generate tasks from requirement", "act as BA",
  "create spec from PRD", "turn this into dev tasks", or any request to decompose a feature
  into DDD-structured documents and implementation tasks for Claude Code CLI execution.
  Also triggers when user mentions Shape Up, bounded context, domain model, or use cases.
  Output is a linked document tree (pitch → domain model → use cases → tasks).
  Emits BDD scenarios + integration flow in task AC, a UC System Flow tracing UI→API→UC→DB,
  a derived UC Test Surface, and per-phase gates (summary + max 2 questions, never assumes).
---

# BA Pitch Analyzer

Converts a Shape Up Pitch (or any product requirement) into a fully linked document tree:
`_index` → `domain-model` → `ux-behavior` → `usecases/` → `integration` → `tasks/`

Each document uses Obsidian-style wikilinks and shared frontmatter taxonomy so the entire
spec is navigable and traceable from pitch to atomic task.

> **Gate definitions** (formats, question rules, resolution logic) → `references/gates.md`
> Read it before printing any ⏸ GATE prompt.

---

## Workflow Overview

```
INPUT: Pitch / PRD / Requirement
         │
⏸ GATE 0 │  Input Enrichment ──────────► ask missing context (fires only when ambiguous)
         │
Phase 0  │  Assess ───────────────────► L0 preview + codebase fit + token estimate
         │  (default: always runs, pauses for confirm)
         │
⏸ GATE-PRE-GEN │ Output Path + Final Input Check (mandatory before generate)
         │
         ▼ [confirm: --lens lite | --lens standard | --cross-context + output path]
         │
Phase 1  │  Ingest & Scan ────────────► understand pitch + codebase
⏸ GATE 1 │  Ingest Confirmation
         │
Phase 1b │  API Feasibility Scan ──────► third-party capability verification (if triggered)
⏸ GATE 1b│  Feasibility Review
         │
Phase 2  │  DDD Analysis ─────────────► aggregates, events, repositories
⏸ GATE 2 │  Domain Model Review
         │
Phase 2b │  Contract Generation ───────► typed Request/Response/Error (standard only)
⏸ GATE 2b│  Contract Review (lite: auto-proceed)
         │
Phase 3  │  UX Behavior ──────────────► screens, states, error flows
⏸ GATE 3 │  UX Behavior Review
         │
Phase 4  │  Use Cases ────────────────► application layer per actor
⏸ GATE 4 │  Use Case Review
         │
Phase 5  │  Integration Map ───────────► cross-system impact (standard only)
⏸ GATE 5 │  Integration Review (lite: auto-proceed)
         │
Phase 6  │  Task Generation ───────────► atomic, ordered, executable
⏸ GATE 6 │  Task Graph Review
         │
Phase 7a │  Self-Audit ────────────────► Layer 0-3 checks, weighted score
Phase 7b │  Scope Summary ─────────────► critical path, estimates, blockers
Phase 7c │  Synthesis ─────────────────► Health Dashboard + traceability + risk + dependency
⏸ GATE 7 │  Synthesis & Execution Decision
         │
Phase 8  │  Index + Feedback ──────────► master document + metrics update
```

**Output directories:**

| Lens | Output |
|------|--------|
| `--lens lite` | `_index`, `assess-report`, `run-state`, `scope-summary`, `synthesis` (minimal), `domain-model`, `ux-behavior` ← PRIMARY, `usecases/`, `tasks/`, `feedback` |
| `--lens standard` | All lite files + `api-feasibility` (if 1b), `contracts/` ← PRIMARY, `integration`, `synthesis` (full S-01+S-02+S-03) |
| `--cross-context` | `_cross-context/`: `context-map`, `event-choreography`, `migration-plan` (if schema change), `team-handoff` |

**Autonomous Execution Gate:** Requires BOTH:
1. Audit score ≥ 90 (Phase 7a)
2. Synthesis gate = ✅ PASS — Coverage 🟢 AND Risk 🟢 (Phase 7c)

---

## Reference Files

| Phase | Read This First |
|-------|-----------------|
| All gates | `references/gates.md` — gate formats, question rules, resolution logic |
| All phases | `references/doc-schemas.md` — frontmatter taxonomy + lens-aware schemas |
| Phase 0 | `assets/templates/assess-report.tmpl.md` |
| Phase 2 | `references/ddd-patterns.md` |
| Phase 2b | `references/contract-patterns.md` (standard only) |
| Phase 3 | `references/ux-behavior-patterns.md` |
| Phase 5 | `references/integration-analysis.md` (standard only) |
| Phase 6 | `references/task-generation.md` |
| Phase 7a | `references/audit-rules.md` |
| Phase 7c | `assets/templates/synthesis.tmpl.md` |
| Cross-context | `assets/templates/cross-context/` |

Templates: `assets/templates/` — use as starting structure for each output file.

---

## Phase 0 — Assess

**Goal:** Give sponsor full visibility before committing tokens.
Always runs unless `--skip-assess` passed. Read `assets/templates/assess-report.tmpl.md` first.

```
0a  Parse pitch (no file writes):
    Extract appetite, in/out boundaries, rabbit holes, third-party mentions
    Compute L0 preview score

0b  Codebase surface scan (max 10 bash calls):
    find . -name "CLAUDE.md" | xargs cat 2>/dev/null
    find . -path "*/schema*" -name "*.ts" | head -20
    find . -path "*/repository*" | head -10
    ls packages/ apps/ 2>/dev/null
    Confidence: +25 CLAUDE.md, +25 schema, +25 repository, +15 monorepo, +10 test config

0c  Complexity estimation:
    base_ucs = count distinct user-facing actions
    Lens: LITE if appetite ≤ 2w + no third-party + base_ucs ≤ 3 + mobile-only signals
          STANDARD if app+API teams, OR third-party, OR appetite > 2w
          ASK if unclear → 1 binary question
    Tokens: LITE ~6–8k, STANDARD ~14–22k

0d  Multi-context detection:
    2+ distinct domain areas → print Option A (single) vs Option B (split + cross-context)
    Wait for choice

0e  Proceed recommendation:
    ✅ GO      = L0 ≥ 80 AND confidence ≥ 70
    ⚠️ GO+FIX = L0 60–79 OR confidence 50–69 → print fix list
    🚫 NO-GO  = L0 < 60 OR confidence < 50 → block, require --skip-assess

0f  Write assess-report.md + run-state.md (initial) to the LOCAL root
    `.shapeup-sdlc/<feature-slug>/` (run-trace, gitignorable)
    PAUSE: wait for user confirmation
```

**Phase 1 cache rule:** If `.shapeup-sdlc/<slug>/assess-report.md` exists AND
`run-state.pitch_hash` matches → Phase 1 fully skipped (~2–3k token savings).

**Output (LOCAL root `.shapeup-sdlc/<slug>/`):** `assess-report.md` + `run-state.md`.
The durable spec tree (Phases 2–8) is written to the SHARED spec dir
`docs/shapeup-sdlc/<slug>/spec/` (the output path confirmed at GATE-PRE-GEN).

---

## Phase 1 — Ingest & Scan

**Goal:** Fully understand the pitch and codebase before writing anything.

```
0. Read team guidelines: docs/shapeup-sdlc/knowledge-base/ba-pitch-analyzer.md (if present).
   `/coach`-distilled scoping/decomposition habits from past Ship-Gate feedback (e.g. "the BA
   under-scopes mobile"). Steering, not spec — they shape how you scope and split tasks; they
   never override the pitch. Absent file = none recorded yet; proceed normally.
1. Extract: feature-slug (kebab-case), appetite, in/out boundaries,
            breadboarding elements, rabbit holes
2. Scan monorepo:
   find . -path "*/schema*" -name "*.ts" | head -30
   find . -path "*/usecase*" -o -path "*/repository*" | head -30
   find . -name "CLAUDE.md" | xargs cat 2>/dev/null
3. Record: existing bounded contexts, new vs existing entities
```

**Output:** Internal analysis only — do NOT write files yet.
→ Read `references/gates.md#GATE-1` and print GATE 1.

---

## Phase 1b — Third-Party API Feasibility Scan

**Trigger:** Pitch contains named third-party / `API` / `SDK` / `webhook` / `integrate with`.
**Skip:** All deps internal OR third-party already has adapter in codebase.

```
For each third-party mention:
  1. Extract capability claim from pitch
  2. List verification questions
  3. Identify sources: official docs URL, community threads
  4. Define fallback scope impact
  5. Assign API-NN reference ID
```

**Write:** `api-feasibility.md` — use `assets/templates/api-feasibility.tmpl.md`
→ Read `references/gates.md#GATE-1b` and print GATE 1b.

---

## Phase 2 — DDD Analysis

**Goal:** Design the domain model. Read `references/ddd-patterns.md` first.

Decide: bounded context ownership, aggregate roots (new vs extending), value objects,
domain events, repository interfaces.

**Write:** `domain-model.md` — use `assets/templates/domain-model.tmpl.md`
→ Read `references/gates.md#GATE-2` and print GATE 2.

---

## Phase 2b — Repository Contract Generation

**Goal:** Typed Request/Response/Error per repository. Standard lens only.
Read `references/contract-patterns.md` first.

**Source types:** `be-service` | `third-party-api` (⚠️ SPECULATIVE until SPIKE) | `offline-storage`

**Two-pass discipline:**
- Pass 1 (spec time): fill from pitch; unresolvable → `⏳ TBD — verify in TASK-NNN-spike-[api]`
- Pass 2 (post-SPIKE): dev replaces ⏳ TBD with actual values + source citation

**Request field `source` must trace to:** `UC-[Name].input.[field]` | `env.[VAR]` | `session.[claim]` | `domain.[Agg].[field]`

**Write:** `contracts/[repo].contract.md` + `contracts/_index.md`
Use `assets/templates/contracts/[source-type].contract.tmpl.md`
→ Read `references/gates.md#GATE-2b` and print GATE 2b (lite: auto-proceed).

---

## Phase 3 — UX Behavior

**Goal:** Map every screen, state transition, and error case.
Read `references/ux-behavior-patterns.md` first.

One section per screen: state table (idle→loading→error→success), error cases with message+action, ASCII flow diagrams.

**Write:** `ux-behavior.md` — use `assets/templates/ux-behavior.tmpl.md`
→ Read `references/gates.md#GATE-3` and print GATE 3.

---

## Phase 4 — Use Cases

**Goal:** Application layer — one file per actor+action pair.

Each UC must: trace to domain event (Phase 2) + screen state (Phase 3), typed Input/Output,
numbered steps, all error cases with codes.

**Test Surface (v2.9):** after Error Cases, derive `## Test Surface` mechanically per
`references/test-surface.md` (D1 Invariants · D2 Error Cases · D3 Contract/Input shape ·
D4 No-gos). Derived-only — a test idea with no D1–D4 source is a spec gap to raise at
GATE 4, never a row to invent. Included in the GATE 4 review.

**System Flow (v3.0):** after Output, write `## System Flow` tracing the call path
`UI screen → API endpoint → Use Case → Repository → DB` and any domain events emitted.
Include only layers known at this phase; omit section if a SPIKE is unresolved.

**Write:** `usecases/UC-[Name].md` + `usecases/_index.md`
Use `assets/templates/usecase.tmpl.md`
→ Read `references/gates.md#GATE-4` and print GATE 4.

---

## Phase 5 — Integration Map

**Goal:** Document cross-system impact. Standard lens only.
Read `references/integration-analysis.md` first.

Per external system: data flows, events produced/consumed, components with changed behavior, silent failure risks.

**Write:** `integration.md` — use `assets/templates/integration.tmpl.md`
→ Read `references/gates.md#GATE-5` and print GATE 5 (lite: auto-proceed).

---

## Phase 6 — Task Generation

**Goal:** Atomic, ordered, executable tasks for Claude Code CLI.
Read `references/task-generation.md` first.

**Core rules:**
- One task = one verifiable change (one package, one concern)
- `depends_on` explicit — no implicit ordering
- `packages/shared` tasks first; never bundle schema + implementation
- AC checkable by running commands

**Contract-first rule:** Before any implementation task touching a repository:
```
1. Contract file must exist → else generate contract-stub task first
2. third-party + ⏳ TBD fields → implementation task gets ⏳ BLOCKED + SPIKE precedes it
3. Task description: "Implement [Repo] per [[contracts/[repo].contract.md]]"
4. AC must verify: Request shape / Response mapping / Error codes all match contract
```

**SPIKE task** (when Phase 1b detected unverified capability):
```yaml
type: SPIKE
time_box_hours: N       # hard cap
api_ref: API-NN         # links to api-feasibility.md
blocks: [TASK-NNN, ...]  # REQUIRED
```
Done when: all API-NN questions answered + contract ⏳ TBD fields updated.

**Mandatory ordering with SPIKE:**
```
TASK-001 [SPIKE]  spike-[api]-feasibility       ← first if third-party
TASK-002 [TASK]   shared-schema                 ← unblocked
TASK-003 [TASK]   [repo]-contract-stub          ← unblocked
TASK-004 [FEAT]   implement-[repo]              ← ⏳ BLOCKED by TASK-001
TASK-005 [FEAT]   [use-case]-service            ← depends_on: TASK-004
TASK-006 [FEAT]   [feature]-ui                 ← depends_on: TASK-005
```

**AC Trigger Matrix** (check `references/task-generation.md#AC-Trigger-Matrix` for full rules):
- `layer: ui` + conditional rendering → `### 🔁 Inverse Conditions`
- `task.type: FIX` + `layer: ui` → `### 🔁 Inverse Conditions` (unconditional)
- data-fetching or UI data prop reference → `### 📭 Empty & Null States`
- numeric limit in description → `### 🔢 Boundary Values`
- `task.type: FEAT` + user-actor OR cross-layer boundary → `### 🧪 BDD Scenarios` (v3.0)
- task crosses ≥1 service boundary → `### 🔗 Integration Flow` (v3.0)
- Not triggered → remove section entirely

**Integration Test Task (v3.0):** after all implementation tasks for a feature, generate a
dedicated integration-test task (layer: integration) covering DB round-trip, auth rejection,
and cross-service BDD scenarios. See `references/task-generation.md#Pattern:-Integration-Test`.

**Write:** `tasks/TASK-[NNN]-[slug].md` + `tasks/_index.md`
Use `assets/templates/task.tmpl.md` (FEAT/FIX/CHORE) or `task-spike.tmpl.md` (SPIKE)
→ Read `references/gates.md#GATE-6` and print GATE 6.

---

## Phase 7a — Self-Audit

Read `references/audit-rules.md` first.

Run all L0–L3 checks. Weighted score:
- L0 Input Quality × 10% · L1 Generation Complete × 20% · L2 Document Quality × 30% · L3 Execution Readiness × 40%

Score < 70 → fix all L3 failures before proceeding. Score 70–89 → flag for review. Score ≥ 90 → execution gate passed.

---

## Phase 7b — Scope Summary

Parse all TASK files: total count, estimated_hours, package, depends_on graph.
Compute: total hours, package distribution, critical path (BFS longest chain), parallel opportunities, external blockers from integration.md.

**Appetite Guard (forcing function, runs here and on every `--tasks-only` round):**
```
appetite_hours = parse from pitch frontmatter (e.g. ~3 weeks → hours)
keep_hours     = Σ estimated_hours over tasks with status ≠ cut
IF keep_hours > appetite_hours:
   ⏸ HAMMER prompt — surface overflow + candidate cuts (must→nice), then WAIT.
     Never auto-resolve. Options: cut TASK-NNN | shrink new task | expand appetite (PO re-bet).
```
This turns scope overflow into a gate-boundary decision (scope hammering), never a silent number.

**Write:** `scope-summary.md` — use `assets/templates/scope-summary.tmpl.md`

---

## Phase 7c — Synthesis

Parse-only steps 1–5 (no AI inference). Inference only for gap severity classification.

**Steps 1–5:** Parse UC frontmatter, task frontmatter, domain-model, ux-behavior, scope-summary + api-feasibility + rabbit holes.

**Health Indicators:**

| Indicator | 🟢 | 🟡 | 🔴 |
|-----------|----|----|-----|
| Coverage | 100% UCs have ≥1 task + 0 aggregate orphans | >80% UCs covered OR non-aggregate orphans | any UC has 0 tasks OR aggregate root unreferenced |
| Risk | 0 open SPIKEs + 0 rabbit holes missing mitigation | SPIKE(s) but impact ≤20% appetite OR low-likelihood hole | open SPIKE impact >20% appetite OR high-likelihood unmitigated hole |
| Dependency | critical_path ≤60% total_hours | 61–80% | >80% |

**Single coverage trust = UC.** An invariant-backed regression task (one verifying a UC `[INV-NN]`)
still carries `use_case_refs` to its owning UC, so it counts toward that UC's coverage like any
other task — no separate "scope-anchored" trust exists. A task with no `use_case_refs` is still
a 🔴 orphan; the invariant mechanism never creates a second valid path to green.

**Synthesis Gate:** ✅ PASS = Coverage 🟢 AND Risk 🟢 · ⚠️ REVIEW = any 🟡, none 🔴 · 🚫 BLOCK = any 🔴

**Sections:** Health Dashboard → S-01 Traceability Matrix (UC×Task, UC×Entity, Screen→UC, Event Flow) → S-02 Risk Register (SPIKEs + rabbit holes) → S-03 Dependency Graph (critical path ASCII + parallel wave table + single points of failure)

**Write:** `synthesis.md` — use `assets/templates/synthesis.tmpl.md`
→ Read `references/gates.md#GATE-7` and print GATE 7.

---

## Phase 8 — Index + Feedback

**Write:** `_index.md` (pitch digest + document map + audit report) — use `assets/templates/_index.tmpl.md`
**Write:** `feedback.md` (empty template for post-sprint) — use `assets/templates/feedback.tmpl.md`

---

## Output Checklist

→ Moved to `references/audit-rules.md#Output-Checklist` (v2.9 slim-down). Phase 7a MUST
read it there and walk every box as the final boolean gate before GATE 7 — covers
Structure/State, Traceability, per-lens, upgrade modes, Discovered-task, Test Surface,
Cross-context, Synthesis, AC Quality.

---

## Invocation

```bash
# DEFAULT — Gate 0 → Assess → GATE-PRE-GEN → confirm → Generate
/ba-pitch-analyzer docs/pitch.md

# Assess only
/ba-pitch-analyzer --assess docs/pitch.md

# Explicit lens (skips Assess pause if assess-report exists)
/ba-pitch-analyzer --lens lite docs/pitch.md
/ba-pitch-analyzer --lens standard docs/pitch.md

# Specify output path (skips that question in GATE-PRE-GEN)
/ba-pitch-analyzer --lens standard --output-path src/specs/checkout/ docs/pitch.md

# Gate overrides
/ba-pitch-analyzer --skip-gate0 docs/pitch.md           # proceed with best-guess assumptions
/ba-pitch-analyzer --skip-gate-pregen --lens standard docs/pitch.md
/ba-pitch-analyzer --lens standard --auto docs/pitch.md # skip all mid-phase gates
/ba-pitch-analyzer --lens standard --skip-gate 2,2b docs/pitch.md

# Cross-context (requires ≥2 STANDARD spec dirs)
/ba-pitch-analyzer --cross-context checkout-feature \
    docs/shapeup-sdlc/order-context/spec/ docs/shapeup-sdlc/payment-context/spec/

# Status + upgrade
/ba-pitch-analyzer --status docs/shapeup-sdlc/checkout-vnpay/spec/
/ba-pitch-analyzer --upgrade standard docs/shapeup-sdlc/checkout-vnpay/spec/
/ba-pitch-analyzer --upgrade contracts docs/shapeup-sdlc/checkout-vnpay/spec/
/ba-pitch-analyzer --tasks-only docs/shapeup-sdlc/checkout-vnpay/spec/

# Retrofit Test Surface onto a pre-v2.9 spec (incremental; frozen zone untouched)
/ba-pitch-analyzer --surface-only docs/shapeup-sdlc/checkout-vnpay/spec/
```

### Progress Markers
```
▶/⏸ GATE 0         Input enrichment (silent if pitch complete)
▶ Phase 0           Assess
⏸ GATE-PRE-GEN      Confirming output path + inputs
▶ Phase 1           Ingest & Scan          ⏸ GATE 1
▶ Phase 1b          API Feasibility        ⏸ GATE 1b
▶ Phase 2           DDD Analysis           ⏸ GATE 2
▶ Phase 2b          Contract Generation    ⏸ GATE 2b (lite: auto)
▶ Phase 3           UX Behavior            ⏸ GATE 3
▶ Phase 4           Use Cases              ⏸ GATE 4
▶ Phase 5           Integration Map        ⏸ GATE 5 (lite: auto)
▶ Phase 6           Task Generation        ⏸ GATE 6
▶ Phase 7a/7b/7c    Audit + Scope + Synthesis ⏸ GATE 7
▶ Phase 8           Index + Feedback
✅ Done              [N] files → [output-path]
```

### Upgrade Behavior
```
--upgrade standard:
  1. Confirm run-state.lens = lite
  2. Conflict check (mtime vs generation timestamps)
     → human-edited: skip, log in run-state.human_edited_files
     → unchanged: safe to extend
  3. Reconciliation Pass: add "## API Contract" to each UC (do NOT overwrite Steps)
  4. Generate contracts/ from reconciled UC API Contract sections
  5. Generate integration.md
  6. Regenerate synthesis.md (full S-01+S-02+S-03)
  7. Update run-state: lens → standard

--cross-context prerequisite:
  → All input dirs must have run-state.lens = standard
  → Any lite: block + suggest upgrade
  → Any missing: offer --ignore-missing [context]

--tasks-only --from-discovered [ledger]:
  Incremental reducer at a build round boundary. The pitch + DDD layer are FROZEN.
  Never re-runs Phase 1–5. Full rules → references/task-generation.md#Discovered-Task-Reconciliation.
  1. Verify ledger belongs to spec: ledger.feature == run-state.feature (REQUIRED; mismatch → STOP).
     A discovered ledger usually has no pitch_hash (frontmatter names raw materials); if it does,
     it must also match run-state.pitch_hash.
  2. READ-ONLY frozen zone: domain-model, usecases/ Steps, ux-behavior, contracts/
  3. Map each ledger scope → its owning UC. New actor/action with no UC → STOP, escalate to PO
     (spawning a UC mid-cycle = silent re-shaping)
  4. [+] Keep → new task (continue numbering, NEVER renumber existing) · ~/Cut → row in synthesis Hammered Out, no file
  5. Keep item asserting a new invariant → APPEND [INV-NN] to that UC's ## Invariants
     (append-only, never touch Steps); log UC in run-state.human_edited_files;
     generate regression task with command-verifiable AC
  6. Regenerate ONLY: tasks/_index.md, scope-summary.md, synthesis.md
  7. Phase 7b Appetite Guard; run-state.discovered_rounds += 1

--surface-only [spec-dir]:
  Incremental reducer — retrofit `## Test Surface` onto a pre-v2.9 spec.
  Full rules → references/test-surface.md#Generation-points. Essence: frozen zone
  READ-ONLY (only `## Test Surface` sections appended, after Error Cases); touched UCs →
  run-state.human_edited_files; set run-state.test_surface: true; all-sources-empty UC
  gets the explicit empty-sources line; then STOP (next evaluator pass auto-enables the
  dimension — no audit re-run here).
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2026-06-16 | BDD Scenarios (`### 🧪`) required for FEAT tasks with user-actor or cross-layer boundary; Integration Flow (`### 🔗`) required for tasks crossing ≥1 service boundary; UC `## System Flow` section traces UI→API→UC→DB call path; Integration Test task pattern added to task-generation.md; AC Trigger Matrix extended with two new triggers; SKILL.md Phase 4 + Phase 6 updated to reflect new sections. |
| 2.9 | 2026-06-11 | QA-meeting Bước 1a: UC `## Test Surface` — DERIVED rows from D1 Invariants + D2 Error Cases + D3 Contract/Input shape + D4 No-gos (rules: references/test-surface.md; anti-invention hard rule — sourceless test idea = GATE 4 question, never a row). Generated in Phase 4; `--surface-only` retrofits pre-v2.9 specs (frozen zone untouched, append-only, `run-state.test_surface`, same discipline as `--tasks-only`); `--tasks-only` invariant-append now also appends TS-INV row. New audit block; skill_version 2.9. Consumed by spec-evaluator `test-surface-conformance` (auto-enable). Division of labor: derivable = BA+Evaluator; exploratory edges = /qa-edge-hunter post-PASS. Slim-down: Output Checklist → references/audit-rules.md#Output-Checklist, --surface-only detail → references/test-surface.md (pointers retained; SKILL.md back under 500 lines). |
| 2.8 | 2026-06-10 | `--tasks-only --from-discovered [ledger]` incremental reducer (feature-slug verify, frozen DDD zone read-only, tasks continue-numbering no-renumber, regenerate only tasks/_index+scope-summary+synthesis). UC `## Invariants` (append-only, logged in human_edited_files) absorbs Basecamp scope + invariant into single UC trust — Coverage stays one-anchor. Appetite Guard at Phase 7b = forcing function (HAMMER on overflow, never auto-resolve). Cut tasks → synthesis "Hammered Out", no file. New-actor/action scope → STOP+escalate. Open decision locked: ledger scope → use-case. |
| 2.6 | 2026-06-03 | GATE 0 Input Enrichment (pre-Assess, max 3 questions); GATE-PRE-GEN (post-Assess, output path + gap surfacing); --output-path, --skip-gate0, --skip-gate-pregen flags. |
| 2.5 | 2026-05-29 | Phase 0 Assess; Lenses (lite/standard); --cross-context; LITE→STANDARD Reconciliation; run-state.md; --upgrade/--status commands. |
| 2.4 | 2026-05-29 | Phase 7c Synthesis: synthesis.md, Health Dashboard, S-01/S-02/S-03, dual execution gate. |
| 2.3 | 2026-05-27 | Phase 1b API Feasibility; Phase 2b Contracts; SPIKE task type; contract-first rule; audit checks L0-06/07, L2-21–23. |
| 2.2 | 2026-05-27 | KI-01 fix: FIX+ui unconditionally triggers ac_inverse. |
| 2.1 | 2026-05-27 | AC sub-sections (Inverse/Empty/Boundary); AC Trigger Matrix; L3-10/11; L3 rebalanced. |
| 2.0 | — | Phase 7a/7b audit system; L0–L3 weighted scoring; execution gate. |
