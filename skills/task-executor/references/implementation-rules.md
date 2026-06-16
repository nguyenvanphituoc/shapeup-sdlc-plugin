# Implementation Rules — Phase 2

Rules for writing code during task execution. Read before Phase 2.

---

## Karpathy Principles Quick Reference (from AGENTS.md)

The full guidelines live in `AGENTS.md`. Below is their translation into implementation-time behaviors. These are a reasoning posture, not a checklist — internalize them before Phase 2 begins.

| Principle | At implementation time |
|-----------|----------------------|
| **A. Think Before Coding** | State every non-obvious decision before writing; if you had to "pick" between two valid readings of the AC, that pick must appear in GATE C "Explicit assumptions" — never silently decided |
| **B. Simplicity First** | Before each AC, state the minimum code needed. Senior-engineer test: "would a seasoned engineer call this overcomplicated?" If yes, simplify before continuing. No speculative abstractions, no error handling for impossible cases, no config options not requested |
| **C. Surgical Changes** | Touch only files the AC requires. Match existing file style. Remove imports/vars/functions your change makes unused. Note adjacent "improvable" code without touching it — capture via P3.7 if worth tracking |
| **D. Goal-Driven Execution** | "Add validation" alone is not a success criterion. "POST /orders amount=-1 → 422 {error:'...'}" is. Write the observable outcome at GATE C; build to it; verify it at GATE D |

---

## Core Constraint

**Implement exactly what the AC specifies. No more, no less.**

If implementing an AC naturally leads to touching a Non-Go item:
- STOP immediately
- Print: "⚠️ Non-Go boundary reached: [what was about to be touched]"
- Ask user to confirm scope expansion before continuing

---

## AC Execution Order

Process AC checkboxes in the order they appear in the task file:

```
## Acceptance Criteria
- [ ] AC-1: [baseline]       ← implement this first
- [ ] AC-2: [baseline]
### 🔁 Inverse Conditions
- [ ] AC-3: [inverse]        ← implement after baseline
### 📭 Empty & Null States
- [ ] AC-4: [empty state]
### 🔢 Boundary Values
- [ ] AC-5: [boundary]
```

Do not skip sub-sections. If an AC is ⏳ BLOCKED: skip it and note in GATE D.

---

## Layer Ordering Enforcement

From ba-pitch-analyzer task-generation.md layer rules:

**STANDARD layer sequence:**
```
Layer 1 (types/schema) → Layer 2 (domain) → Layer 3 (contracts)
→ Layer 4 (use cases) → Layer 5 (HTTP) → Layer 6 (mobile) → Layer 7 (e2e)
```

**LITE layer sequence:**
```
Layer 1 (local schema) → Layer 2 (state mgmt) → Layer 3 (API stubs)
→ Layer 4 (UI) → Layer 5 (smoke tests)
```

If this task is Layer N, verify Layer N-1 files exist (written in this session
or already in codebase) before writing Layer N code.

---

## Contract Reference Rule (STANDARD)

For any task that implements a repository:
1. Read `contracts/[repo].contract.md` completely
2. Use the typed interfaces defined there — do NOT redefine inline
3. Every method signature must match the contract

For TypeScript: import from the contract-defined types file.
Never write `any` for contract-defined shapes.

---

## SPIKE Output Format

SPIKE tasks produce a decision document, not code.

Output file: `spec_folder/spikes/SPIKE-[slug]-findings.md`

```markdown
---
type: spike-findings
task_ref: TASK-NNN
api_ref: API-NN         # from task frontmatter
status: resolved | inconclusive | blocked
date: [ISO date]
---

# SPIKE Findings: [API / topic name]

## Questions Investigated
> (copy from api-feasibility.md API-NN block)

## Findings

### Q1: [question text]
**Answer:** [answer]
**Source:** [URL or "sandbox test on [date]"]
**Confidence:** confirmed | probable | unconfirmed

### Q2: ...

## Decision

**Capability confirmed?** yes | no | partial

**Recommendation:**
[What to do next — proceed / use fallback / escalate to PO]

**Impact on blocked tasks:**
- TASK-NNN: [unblocked | still blocked because ...]

## Evidence Artifacts
- [curl output / screenshot / SDK response — paste relevant snippet]
```

After writing findings: read the original SPIKE task's "Definition of Done" checklist
and verify each item is satisfied before GATE D.

---

## Common Patterns Quick Reference

### TypeScript Type Export
```typescript
// Always export both table schema and inferred type
export const orders = pgTable('orders', { ... })
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
```

### Repository Method Signatures
```typescript
// Match contract exactly — see contracts/[repo].contract.md
interface OrderRepository {
  findById(id: string): Promise<Order | null>  // null, not throws
  findAll(): Promise<Order[]>                  // [], not null
  save(order: Order): Promise<Order>
}
```

### Error Handling Pattern
```typescript
// Use domain errors, not raw DB errors
try {
  return await db.query(...)
} catch (err) {
  throw new RepositoryError('OrderRepository.findById failed', { cause: err })
}
```
