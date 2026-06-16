# Audit Rules — Layer 0-3 Quality Checks

Used in Phase 7a. Every check is deterministic — pass or fail, no partial credit
unless stated. Final score = weighted sum across all layers.

## Scoring Weights

| Layer | Name | Weight |
|-------|------|--------|
| L0 | Input Quality | 10% |
| L1 | Generation Completeness | 20% |
| L2 | Document Quality | 30% |
| L3 | Execution Readiness | 40% |

Score formula per layer: `(passed checks / total checks) × 100 × weight`
Final score: sum of all layer scores (0–100).

---

## Layer 0 — Input Quality (10%)

Evaluate the original pitch input BEFORE generation. Score this first.

| Check | Rule | Points |
|-------|------|--------|
| L0-01 | Appetite is stated (time box present) | 20 |
| L0-02 | In-scope boundaries listed (≥ 2 items) | 20 |
| L0-03 | Non-go list present (≥ 1 item) | 20 |
| L0-04 | At least one rabbit hole identified | 20 |
| L0-05 | Rabbit hole has mitigation stated | 20 |

**Total L0: 100 points (base)**

**L0 Extension — Third-Party API Checks (additive penalty, −15 each if failed):**
These checks apply ONLY when pitch contains a third-party API/SDK mention.
Failures subtract directly from the L0 weighted contribution.

| Check | Rule | Penalty |
|-------|------|---------|
| L0-06 | Third-party API assumptions declared: `api-feasibility.md` exists AND every SPIKE task has non-empty `blocks:` field | −15 pts |
| L0-07 | No unverified capability in implementation tasks: every implementation task touching an unconfirmed third-party repository has `⏳ BLOCKED` annotation referencing a SPIKE task | −15 pts |

If L0 score < 60: add warning to Audit Report — "Pitch was underspecified.
Generated docs contain BA assumptions. PO review is mandatory before dev starts."

---

## Layer 1 — Generation Completeness (20%)

Check that all expected files exist and have valid frontmatter.

### File Existence (50 points)

| Check | Rule | Points |
|-------|------|--------|
| L1-01 | `_index.md` exists | 10 |
| L1-02 | `domain-model.md` exists | 10 |
| L1-03 | `ux-behavior.md` exists | 10 |
| L1-04 | `usecases/_index.md` exists | 5 |
| L1-05 | At least one `usecases/UC-*.md` exists | 5 |
| L1-06 | `integration.md` exists | 5 |
| L1-07 | `tasks/_index.md` exists | 5 |

### Frontmatter Completeness (30 points)

For each document, check these fields are present and non-empty:

| Check | Rule | Points |
|-------|------|--------|
| L1-08 | All docs have `type` field | 5 |
| L1-09 | All docs have `feature` field matching feature-slug | 5 |
| L1-10 | All docs have `status` field | 5 |
| L1-11 | All task docs have `package` field | 5 |
| L1-12 | All task docs have `priority` field (integer) | 5 |
| L1-13 | All task docs have `estimated_hours` field | 5 |

### Wikilink Integrity (20 points)

| Check | Rule | Points |
|-------|------|--------|
| L1-14 | All `[[wikilinks]]` in all docs resolve to existing files | 20 |

For L1-14: scan every `[[...]]` pattern across all generated files.
A link resolves if the target file exists relative to the specs folder.
Score is proportional: `(resolved / total) × 20`

**Total L1: 100 points**

---

## Layer 2 — Document Quality (30%)

Check semantic completeness of each document type.

### domain-model.md (25 points)

| Check | Rule | Points |
|-------|------|--------|
| L2-01 | At least one Aggregate section present | 5 |
| L2-02 | Every aggregate has Invariants subsection with ≥ 1 item | 5 |
| L2-03 | Every aggregate has State Transitions diagram | 5 |
| L2-04 | Domain Events table present with ≥ 1 event | 5 |
| L2-05 | Repository Interfaces section has TypeScript interface block | 5 |

### ux-behavior.md (25 points)

| Check | Rule | Points |
|-------|------|--------|
| L2-06 | Screen Flow diagram present | 5 |
| L2-07 | Every screen has States table | 5 |
| L2-08 | Every screen has Behavior Rules section (≥ 1 rule) | 5 |
| L2-09 | Every screen has Error Catalog table | 5 |
| L2-10 | Every error catalog row has: code, condition, message, action | 5 |

### usecases/UC-*.md (25 points, averaged across all UCs)

| Check | Rule | Points |
|-------|------|--------|
| L2-11 | `domain_events_emitted` frontmatter is non-empty | 5 |
| L2-12 | Input has TypeScript interface block | 5 |
| L2-13 | Steps are numbered (not bullets) | 5 |
| L2-14 | Output has TypeScript interface block | 5 |
| L2-15 | Error Cases table present with ≥ 1 row | 5 |

### tasks/TASK-*.md (25 points, averaged across all tasks)

| Check | Rule | Points |
|-------|------|--------|
| L2-16 | `linked_docs` frontmatter has ≥ 1 wikilink | 5 |
| L2-17 | Context section has ≥ 1 wikilink to source spec | 5 |
| L2-18 | Acceptance Criteria has ≥ 3 items | 5 |
| L2-19 | Non-Go section present with ≥ 1 item | 5 |
| L2-20 | `depends_on` is present (empty array is valid for priority-1 tasks) | 5 |

### contracts/[repo].contract.md (bonus layer, averaged across all contracts)

These checks apply ONLY when `contracts/` folder exists. Failures reduce L2 weighted score.

| Check | Rule | Points |
|-------|------|--------|
| L2-21 | Every repository interface in `domain-model.md` has a corresponding `.contract.md` | 15 |
| L2-22 | Every Request field in every contract has a non-empty `Source` column tracing to UC, env, session, or domain | 10 |
| L2-23 | Every third-party contract has `⚠️ SPECULATIVE` header OR the corresponding SPIKE task `status` is `done` | 10 |

**Total L2: 100 points**

---

## Layer 3 — Execution Readiness (40%)

The most important layer. Checks whether a dev (or Claude Code) can execute
tasks without asking clarifying questions.

### Task Self-Sufficiency (70 points, per-task average)

Run this checklist for EVERY task file. Score = average across all tasks.

| Check | Rule | Detection Method | Points |
|-------|------|-----------------|--------|
| L3-01 | Exactly one package in frontmatter | `package:` field has single value | 10 |
| L3-02 | At least one wikilink to source spec | `[[` present in Context section | 10 |
| L3-03 | ≥ 3 acceptance criteria | Count `- [ ]` lines in AC section | 5 |
| L3-04 | Every AC is verifiable by command or observable outcome | AC lines contain: `pnpm` OR `npm` OR `curl` OR `returns` OR `exists` OR `exported` OR `passes` OR `exits 0` OR `does NOT` OR `renders` OR `rejects` | 15 |
| L3-05 | Non-Go section has ≥ 1 item | Section exists and is non-empty | 5 |
| L3-06 | `unlocks` field is present | Field exists in frontmatter | 5 |
| L3-10 | Required AC sub-sections present and filled (per AC Trigger Matrix) | For each triggered sub-section: present+filled = full credit · present+empty = −3pts · absent = −5pts · INFRA/CONFIG/MIGRATION/DOCS exempt | 15 |
| L3-11 | Dependency-blocked ACs are annotated, not silently omitted | Blocked AC slots use `⏳ BLOCKED:` prefix and reference a `TASK-NNN` | 5 |

**Self-sufficiency threshold:** Task scores 70+/100 → self-sufficient.
Tasks scoring below 70 are listed individually in the Audit Report as blockers.

### Dependency Graph Integrity (30 points)

| Check | Rule | Points |
|-------|------|--------|
| L3-07 | No circular dependencies in `depends_on` graph | Run cycle detection | 15 |
| L3-08 | Every non-priority-1 task has ≥ 1 entry in `depends_on` | Check frontmatter | 10 |
| L3-09 | All TASK IDs referenced in `depends_on` exist as files | Check file existence | 5 |

**Total L3: 100 points**

---

## Audit Report Format

Write this section into `_index.md` after running all checks.

```markdown
## Audit Report
*Generated: [date] | Feature: [feature-slug] | skill_version: 2.1 | audit_rules_version: 2.1*

### Version Delta Warning
<!-- Render ONLY when skill_version < audit_rules_version -->
⚠️ Spec generated by SKILL v[X], audited against rules v[Y].
L3-10 and L3-11 (AC coverage checks) not applicable to this spec.
Recommend regenerating with current SKILL version before execution.

### Score Summary

| Layer | Weight | Raw Score | Weighted |
|-------|--------|-----------|---------|
| L0 Input Quality | 10% | XX/100 | XX.X |
| L1 Generation Complete | 20% | XX/100 | XX.X |
| L2 Document Quality | 30% | XX/100 | XX.X |
| L3 Execution Readiness | 40% | XX/100 | XX.X |
| **TOTAL** | | | **XX/100** |

### Execution Gate
[✅ PASS — Score ≥ 90. Safe for autonomous execution via /execute-plan]
[⚠️ REVIEW — Score 70–89. 15-min PO + Dev walkthrough recommended]
[🚫 BLOCK — Score < 70. Fix L3 failures before dev starts]

### Issues Found

**Critical (L3 failures — block execution):**
- [ ] TASK-005: AC items are not verifiable (no commands) — L3-04
- [ ] TASK-008: Missing Non-Go section — L3-05
- [ ] TASK-006: Required ac_empty_state absent (layer=repository triggered) — L3-10 (−5pts)

**Warnings (L2 failures — review recommended):**
- [ ] ux-behavior.md: PaymentScreen missing Error Catalog — L2-09
- [ ] UC-InitiatePayment: domain_events_emitted is empty — L2-11

**Info (L0/L1 notes):**
- Pitch missing rabbit hole mitigations (L0-05) — BA filled assumptions
```

---

## metrics.md Format

Maintained at `.claude/metrics.md` in project root. Append one row per feature run.

```markdown
# SKILL Metrics

| Feature | Date | L0 | L1 | L2 | L3 | Score | Gate | PO* | Dev* |
|---------|------|----|----|----|----|-------|------|-----|------|
| checkout-vnpay | 2026-05-20 | 72 | 95 | 84 | 81 | 84 | ⚠️ | — | — |
| user-profile | 2026-05-27 | 100 | 98 | 91 | 88 | 91 | ✅ | — | — |

*PO and Dev scores filled post-sprint from feedback.md (1–5 scale)
```

---

## Output Checklist (Phase 7a final gate)

<!-- Moved from SKILL.md (v2.9 slim-down). Phase 7a runs the L0–L3 scored checks above,
     THEN walks this checklist as the final boolean gate before GATE 7. -->

**Structure & State**
- [ ] All documents have YAML frontmatter with `lens` field
- [ ] All `depends_on` use `[[wikilinks]]`
- [ ] `run-state.md` has: `pitch_hash`, `lens`, `phases_completed`, `files_generated`, `output_path`
- [ ] `run-state.md` has gate answer arrays: `gate0_answers`, `gate_pregen_answers`, `gate1_answers`, `gate1b_answers`, `gate2_answers`, `gate2b_answers`, `gate3_answers`, `gate4_answers`, `gate5_answers`, `gate6_answers`, `gate7_acknowledged_risks`
- [ ] `assess-report.md` exists (or `--skip-assess` explicitly passed)
- [ ] `_index.md` frontmatter: `skill_version: "2.9"` and `audit_rules_version: "2.9"`

**Traceability**
- [ ] Every task has `use_case_refs` → ≥1 UC, OR gap listed in synthesis S-01
- [ ] Every UC links back to ≥1 domain event
- [ ] `tasks/_index.md` lists all tasks with current status

**LITE specific**
- [ ] `ux-behavior.md` has Navigation Stack, Offline Behavior Rules, Platform Differences, API Stub Contracts
- [ ] Tasks follow layer order: ui-component → local-state → offline-storage → api-stub
- [ ] `synthesis.md` has minimal Health Dashboard + S-01 UC×Task

**STANDARD specific**
- [ ] `contracts/_index.md` exists + all contracts registered
- [ ] Every repository in `domain-model.md` has a `.contract.md`
- [ ] Every contract Request field has non-empty `Source`
- [ ] Every third-party contract has `⚠️ SPECULATIVE` OR SPIKE status `done`
- [ ] Every repo implementation task has AC verifying contract shapes
- [ ] No unconfirmed third-party task missing `⏳ BLOCKED`
- [ ] Phase 1b triggered → `api-feasibility.md` + ≥1 SPIKE with non-empty `blocks:`
- [ ] `synthesis.md` has full S-01 + S-02 + S-03

**LITE → STANDARD upgrade**
- [ ] Reconciled UCs have `## API Contract` sub-section (Steps NOT overwritten)
- [ ] Reconciled files in `run-state.human_edited_files`

**Discovered-task mode (`--tasks-only --from-discovered`)**
- [ ] `run-state.pitch_hash` verified against `ledger.source` before any write
- [ ] Frozen zone untouched: domain-model, usecases/ Steps, ux-behavior, contracts/ unchanged
- [ ] New tasks continue numbering; no existing TASK renumbered
- [ ] Every new task anchors `use_case_refs` to a UC (no `scope`/`invariant` frontmatter on tasks)
- [ ] Invariant-backed task has command-verifiable regression AC (passes L3-04)
- [ ] Newly appended `[INV-NN]` also appends its `TS-INV-NN` row to that UC's Test Surface
- [ ] Any appended `## Invariants` UC logged in `run-state.human_edited_files`
- [ ] Cut items appear only in synthesis "Hammered Out" — no orphan task files
- [ ] `run-state.discovered_rounds` incremented

**Test Surface (v2.9 spec, or run-state.test_surface: true)**
- [ ] Every UC has `## Test Surface` with ≥1 row OR the explicit empty-sources line
- [ ] Every `[INV-NN]` has a `TS-INV-NN` row; every Error Case code has a `TS-ERR-*` row
- [ ] Every TS row cites a D1–D4 source (no invented rows); probes are executable (cmd/ui/data), not static
- [ ] `--surface-only` runs: frozen zone untouched, touched UCs in `human_edited_files`

**Cross-context**
- [ ] `context-map.md`, `event-choreography.md` (timeout register + dead-letter)
- [ ] `migration-plan.md` if schema change detected
- [ ] `team-handoff.md` with blocking deps + parallel wave table

**Synthesis & Audit**
- [ ] `scope-summary.md` with critical path
- [ ] `synthesis.md` Health Dashboard: all 3 indicators computed (not placeholder)
- [ ] `synthesis.md` Synthesis Gate consistent with indicators
- [ ] `_index.md` Audit Report populated
- [ ] Audit score + Synthesis Gate + token actuals in `.claude/metrics.md`

**AC Quality**
- [ ] `layer: ui` + conditional rendering → `### 🔁 Inverse Conditions`
- [ ] `task.type: FIX` + `layer: ui` → `### 🔁 Inverse Conditions` (unconditional)
- [ ] Data-fetching tasks → `### 📭 Empty & Null States`
- [ ] Numeric limit tasks → `### 🔢 Boundary Values`
- [ ] No non-verifiable AC ("Implementation matches...", "All error cases handled")
