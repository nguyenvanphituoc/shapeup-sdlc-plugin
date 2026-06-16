---
name: task-executor
description: >
  Use this skill whenever a user wants to execute, implement, or run a specific task generated
  by the ba-pitch-analyzer skill. Triggers on: "execute task TASK-NNN", "implement TASK-NNN",
  "run this task", "thi hành task", "thực hiện task", "start working on TASK-NNN",
  "implement the task in [folder]", "run task from spec folder", or when user points to a
  tasks/ directory and asks to implement one or more items. Also triggers when user says
  "pick up the next task", "what should I work on next", or "continue from where we left off"
  with a spec folder in context. Always use this skill when the deliverable is code/files
  produced by reading a TASK-NNN.md spec and updating the task status afterward.
  v1.3: Karpathy principles embedded — assumption scan (Phase 1), explicit assumptions + verifiable success criteria (GATE C), minimum-code + surgical-changes discipline (Phase 2 P2.7/P2.8), goal-driven verification (GATE D). v1.2: AC checkbox ticking. v1.1: discovered-task ledger. v1.0: GATE A–E pipeline.
---

# Task Executor

Executes a single TASK-NNN from a `ba-pitch-analyzer` spec tree, then updates
all linked documents to reflect completion.

**Core guarantee:** No assumption is ever made silently. Every ambiguity surfaces
as an explicit gate question before work begins.

> **Gate definitions and question rules** → `references/gates.md`
> Read it before printing any ⏸ GATE prompt.

---

## Workflow Overview

```
INPUT: task identifier + spec folder path
         │
⏸ GATE A │  Locate & Validate ─────────► confirm spec folder, task file, run-state
         │
⏸ GATE B │  Pre-Flight Check ──────────► confirm dependencies done, env ready, no blockers
         │
Phase 1  │  Context Load ─────────────► read task + all linked docs
⏸ GATE C │  Scope Confirmation ────────► confirm scope boundaries before writing code
         │
Phase 2  │  Implementation ────────────► write code per AC, one AC at a time
⏸ GATE D │  Verification ──────────────► run AC commands, confirm all pass
         │
Phase 3  │  Doc Update ───────────────► update task status + tasks/_index.md + run-state
⏸ GATE E │  Completion Sign-Off ───────► user confirms updates before closing
         │
✅ Done  └─► task marked done, linked docs updated
```

---

## Reference Files

| Phase | Read This First |
|-------|-----------------|
| All gates | `references/gates.md` — gate formats, question rules, resolution logic |
| Phase 1 | `references/context-loading.md` — which docs to read, in what order |
| Phase 2 | `references/implementation-rules.md` — AC execution, layer rules, non-go enforcement |
| Phase 3 | `references/doc-update-rules.md` — which files change, what fields update |

---

## GATE A — Locate & Validate

**Purpose:** Establish the exact spec folder and task file. Zero assumptions.

**Fires:** Always, on every invocation.

```
Required inputs (must be explicit — never inferred):
  1. spec_folder   — absolute or relative path to the ba-pitch-analyzer output dir
                     e.g. ".claude/specs/checkout-vnpay/"
  2. task_id       — TASK-NNN identifier
                     e.g. "TASK-003"

Validation steps:
  A1. Verify spec_folder exists on disk
      → If not: HARD STOP — print path, ask user to correct it
  A2. Verify spec_folder/tasks/<task_id>*.md exists (glob match)
      → If not: list files in tasks/ dir, ask user to pick
  A3. Verify spec_folder/run-state.md exists
      → If not: warn — limited traceability, ask user to confirm proceed
  A4. Read run-state.md:
      - Extract lens, feature, phases_completed, files_generated
      - Extract current gate answer arrays
      → If run-state missing required fields: list gaps, ask user to fill
  A5. Read the task file completely
      - Extract: id, type, status, priority, depends_on, package, estimated_hours
      - Extract: all linked_docs wikilinks
```

**GATE A Output (printed before asking questions):**
```
⏸ GATE A — Locate & Validate

Spec folder : [path]
Feature     : [feature slug from run-state]
Lens        : [lite | standard | cross-context]
Task file   : [tasks/TASK-NNN-slug.md]
Task type   : [FEAT | FIX | CHORE | MIGRATION | DOCS | SPIKE]
Status now  : [current status]
Depends on  : [list or "none"]
```

**Gate A questions** (ask only if unresolvable from files):
- Max 2 questions. Examples:
  - "run-state.md not found — should I proceed with limited traceability? (y/n)"
  - "Task status is already `done` — re-execute anyway? (y/n)"

Do NOT proceed to GATE B until user confirms.

---

## GATE B — Pre-Flight Check

**Purpose:** Verify all preconditions are met before touching any code.

**Fires:** Always, after GATE A confirm.

```
B1. Dependency check:
    - Read all tasks listed in task.depends_on
    - For each: read its frontmatter status field
    → If any dependency status ≠ done: HARD STOP
      Print: "BLOCKED: [TASK-NNN] depends on [TASK-XXX] (status: [X])"
      Ask: "Confirm dependency is actually done (status not updated yet)? (y/n)"
      → Only proceed if user explicitly confirms

B2. Blocker annotation check:
    - Scan task body for "⏳ BLOCKED" strings
    → If found: print each blocked item
      Ask: "Are all ⏳ BLOCKED items resolved? List resolved ones or type 'all'."

B3. SPIKE prerequisite check:
    - If task.type = SPIKE: skip B3 (SPIKE has no code deps)
    - If task references any contract with ⏳ TBD fields:
      → HARD STOP unless user confirms SPIKE for that API is done

B4. Environment check (ask, do not assume):
    - Print: "I need to run verification commands after implementation."
    - Ask: "What package manager command runs tests? (e.g. pnpm --filter [package] test)"
    - Ask: "Any env vars or setup needed before running?" (skip if user says none)

B5. Non-Go boundary confirmation:
    - Print the task's "## Non-Go" section verbatim
    - Ask: "Confirm these items are out of scope for this session? (y/n)"
```

**GATE B Output:**
```
⏸ GATE B — Pre-Flight Check

Dependencies  : [✅ all done | ⚠️ [TASK-XXX] unconfirmed]
Blockers      : [✅ none | ⚠️ [N] items — listed above]
Test command  : [command confirmed by user]
Non-Go scope  : [confirmed | pending]
```

Do NOT proceed to Phase 1 until user confirms all items.

---

## Phase 1 — Context Load

**Goal:** Load every document needed to implement the task correctly.
**Rule:** Do NOT infer content from memory. Read every linked doc from disk.

```
1. Read task file in full (already done in GATE A — re-read if > 200 lines ago)

2. For each wikilink in task.linked_docs and task body [[...]]:
   - Resolve path: spec_folder/[linked-doc-name].md
   - Read file
   - Extract relevant sections (do not load entire file into context if > 300 lines;
     load only sections referenced by the task)

3. Read layer-specific supporting docs:
   LITE:   read ux-behavior.md sections referenced by task
   STANDARD: read contracts/[repo].contract.md for each repo in task

4. Identify existing code:
   - Run: find . -path "[package_path]*" -name "*.ts" | head -20
   - If task.context references existing files: cat each referenced file

5. Assumption scan (Principle A — Think Before Coding):
   - For each AC, note any implementation decision the spec leaves open: naming conventions,
     error message format, validation order, default values, edge-case handling
   - Flag ACs where two interpretations are equally valid — both surface at GATE C
   - Do not resolve ambiguity silently; the cost of a wrong silent decision exceeds the
     cost of one extra question
```

**Context Load Summary (internal, not printed):**
- List of docs loaded
- List of existing code files read
- Unresolved wikilinks (if any → surface in GATE C)
- Assumptions identified (surface in GATE C "Explicit assumptions" section)

---

## GATE C — Scope Confirmation

**Purpose:** Confirm implementation boundaries before writing a single line of code.

**Fires:** Always, after Phase 1.

**GATE C Output (printed):**
```
⏸ GATE C — Scope Confirmation

Linked docs loaded:
  [list each doc + key excerpt that guides implementation]

Existing code referenced:
  [list files + relevant types/interfaces found]

My implementation plan:
  [numbered list of what I will create/modify, in order]
  1. [file path] — [what changes]
  2. [file path] — [what changes]
  ...

Explicit assumptions (Principle A — none kept silent):
  [assumption: "[decision made]" — based on [evidence in spec or codebase]]
  [or: "none — every decision traces unambiguously to the spec"]

Verifiable success criteria (Principle D — goal-driven):
  AC-1: [what success looks like as an observable outcome, not just the AC text]
        e.g. "POST /orders body:{amount:-1} → 422, {error:'amount must be positive'}"
        e.g. "createOrder(-1) throws DomainError('amount must be positive')"
  AC-2: [observable outcome]

Acceptance criteria I will verify:
  [list each AC checkbox from task]

Out of scope (Non-Go confirmed):
  [list from task ## Non-Go section]

Unresolved gaps (if any):
  [any wikilink that couldn't be resolved, or missing context]
```

**Gate C questions** (max 2, only for true gaps):
- "Wikilink [[contracts/X.contract.md]] not found — should I create a stub or skip contract verification?"
- "Package path for [package] unclear — is it [A] or [B]?"

Do NOT write any code until user confirms the plan.

---

## Phase 2 — Implementation

**Goal:** Implement exactly what the AC specifies. No more, no less.

```
Implementation rules:
  P2.1  Work AC by AC — implement one acceptance criterion at a time
  P2.2  After each file write: print the file path + a 1-line summary of what changed
  P2.3  Non-Go enforcement: if implementation starts touching a Non-Go item,
        STOP — print warning — ask user to confirm scope expansion before continuing
  P2.4  Layer ordering: never implement Layer N before Layer N-1 is written
        (verify deps are written in THIS session or already in codebase)
  P2.5  SPIKE tasks: produce a decision document, not code
        → file: spec_folder/spikes/SPIKE-[slug]-findings.md
        → format: see references/implementation-rules.md#SPIKE-output
  P2.6  Contract reference: every repository implementation MUST reference
        the contract file — do not redefine types inline

Karpathy discipline (Principles B + C — applied per AC):
  P2.7  MINIMUM CODE (Principle B): before writing each AC, state in 1 line:
        "Minimum code needed: [what, roughly how many lines]"
        If a simpler alternative exists, name it and implement the simpler one unless
        the contract or the AC explicitly requires the complex approach.
        Senior-engineer test: would a seasoned engineer look at this and say
        "this is overcomplicated"? If yes, simplify before moving to the next AC.
  P2.8  SURGICAL (Principle C): after each file change:
        - Note adjacent code NOT touched: "✋ Not touching [X] — outside this AC's scope"
        - Match the file's existing style even if you'd design it differently from scratch
        - If your change leaves imports / variables / functions unused → remove them now
        - If you notice unrelated dead code → mention it; capture via P3.7 as a discovery;
          do NOT delete it
```

**Progress markers during Phase 2:**
```
▶ P2 [1/N] Implementing: [AC text truncated to 60 chars]
  → Writing: [file path]
  ✓ Done: [file path] ([N] lines)

▶ P2 [2/N] Implementing: ...
```

---

## GATE D — Verification

**Purpose:** Run every verifiable AC command and confirm results before doc update.
Verification checks the specific observable outcomes defined at GATE C, not just
whether a command exits 0 (Principle D — goal-driven execution).

**Fires:** Always, after Phase 2.

```
D1. For each AC with a command (pnpm test, typecheck, curl, etc.):
    - Run the command using bash
    - Cross-check against the GATE C verifiable criterion for this AC:
      ✅ [command] — criterion met: [observable outcome]
      ❌ [command] — expected [X from GATE C criterion], got [Y]

D2. For AC items that are not command-verifiable (visual, manual):
    - Print each: "👁 Manual check required: [AC text]"
    - Ask user to confirm: "Please verify the above manually. Confirmed? (y/n)"

D3. If any ❌ failures:
    - Do NOT update docs
    - Ask: "Fix failing ACs before doc update? (y/n)"
    → If y: return to Phase 2 for targeted fix
    → If n: mark task status as 'in-progress' (not done), log failures in run-state
```

**GATE D Output:**
```
⏸ GATE D — Verification

AC Results:
  ✅ [command 1]
  ✅ [command 2]
  👁 [manual check item]
  ❌ [failing command] — [error]

Overall: [PASS | PARTIAL | FAIL]
```

Do NOT update any spec documents until GATE D = PASS or user explicitly accepts PARTIAL.

---

## Phase 3 — Doc Update

**Goal:** Update all spec documents to reflect task completion accurately.

> Read `references/doc-update-rules.md` before executing this phase.

```
P3.1  Update task file frontmatter:
      - status: done
      - completed_at: [ISO date]
      - TICK the AC checkboxes: every criterion GATE D verified flips `- [ ]` → `- [x]`
        in the task body (incl. 🔁 inverse / 📭 empty-state / 🔢 boundary sub-lists).
        Failing/skipped ACs stay unchecked. Bug-only re-runs re-tick what the fix
        re-satisfied. The checkbox list must never disagree with the Execution Log.
      - Add "## Execution Log" section at end of file:
        - executor: claude-task-executor v1.0
        - session_date: [date]
        - ac_results: [pass/fail per AC]
        - files_modified: [list]
        - notes: [any deviations from plan]

P3.2  Update tasks/_index.md:
      - Change status emoji for this task: ⬜/🔄 → ✅
      - If SPIKE: add link to findings doc in the row

P3.3  Update run-state.md:
      - Add task ID to phases_completed (or a task_execution_log array)
      - Increment files_generated count if new files created
      - Append gate answers: gate_exec_[task_id]_answers

P3.4  If task was blocking other tasks (i.e. this task ID appears in another
      task's depends_on):
      - Find all tasks that depend on this task
      - For each: if status = 'blocked' AND this was the ONLY blocker → update to 'ready'
      - Print: "Unblocked: [TASK-NNN], [TASK-NNN]"

P3.5  If task type = SPIKE:
      - Update api-feasibility.md: mark the relevant API-NN block as resolved
      - Update any contracts with ⏳ TBD fields that this SPIKE answered
      - Print changed contract fields

P3.6  Scope summary update (if scope-summary.md exists):
      - Update the task row: status → done, actual_hours = [estimated vs actual note]
      - If actual >> estimated: flag in scope-summary notes section

P3.7  Discovered tasks (Shape Up — capture, do NOT self-plan):
      If implementing this task surfaced work that isn't in the spec (a new edge case,
      a regression risk, a required-but-unwritten piece), APPEND it as a raw discovered
      line under the matching scope's "Discovered" section in the discovery ledger
      (discovery/ledger.md or the feature's *discovered-tasks*.md):
        - marker `[+]` for a Keep candidate, `~` for a likely Cut
        - one line, plain — do NOT create a TASK file, do NOT touch UC/domain-model/contracts
      The executor is the single writer for these raw `[+]` lines; reconciliation
      (assigning Keep/Cut, anchoring to a UC, generating the TASK, hammering appetite)
      is owned by `ba-pitch-analyzer --tasks-only --from-discovered [ledger]` at a round
      boundary — never by the executor. This keeps judge/planner/doer boundaries intact:
      the doer reports what it found; the planner decides what becomes a task.
```

---

## GATE E — Completion Sign-Off

**Purpose:** User reviews all doc changes before the session closes.

**Fires:** Always, after Phase 3.

**GATE E Output:**
```
⏸ GATE E — Completion Sign-Off

Task completed: [TASK-NNN] — [slug]
Files modified (code):
  [list with line counts]

Spec documents updated:
  ✅ tasks/[TASK-NNN]-[slug].md — status: done
  ✅ tasks/_index.md — row updated
  ✅ run-state.md — execution log appended
  [✅ api-feasibility.md — API-NN resolved]   (SPIKE only)
  [✅ contracts/X.contract.md — TBD fields resolved]  (SPIKE only)
  [✅ TASK-NNN, TASK-NNN unblocked]   (if applicable)

Deviations from plan (if any):
  [list or "none"]

Next suggested task (from tasks/_index.md priority order):
  → [TASK-NNN] — [title] (status: ready, priority: [N])
```

**Gate E questions:**
- "Any corrections to the execution log before I finalize? (y/n)"

Once user confirms → print `✅ [TASK-NNN] closed.`

---

## Invocation

```bash
# Standard — provide spec folder and task ID
/task-executor --spec .claude/specs/checkout-vnpay/ --task TASK-003

# Without flags — skill will ask for both at GATE A
/task-executor

# Skip GATE E sign-off (auto-confirm doc updates)
/task-executor --spec .claude/specs/checkout-vnpay/ --task TASK-003 --auto-close

# Re-execute a done task (e.g. after refactor)
/task-executor --spec .claude/specs/checkout-vnpay/ --task TASK-003 --force

# Execute next ready task automatically (picks lowest priority number with status=ready)
/task-executor --spec .claude/specs/checkout-vnpay/ --next

# SPIKE execution mode
/task-executor --spec .claude/specs/checkout-vnpay/ --task TASK-001 --spike
```

### Progress Markers
```
⏸ GATE A    Locate & Validate
⏸ GATE B    Pre-Flight Check
▶ Phase 1   Context Load
⏸ GATE C    Scope Confirmation
▶ Phase 2   Implementation     [N/M ACs]
⏸ GATE D    Verification
▶ Phase 3   Doc Update
⏸ GATE E    Completion Sign-Off
✅ Done      [TASK-NNN] closed → [N] files modified
```

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Spec folder path must be explicit | Prevents updating wrong project's docs |
| Task ID must be explicit | Prevents wrong task execution |
| Dependencies must be `done` before proceeding | Maintains layer ordering from ba-pitch-analyzer |
| Non-Go items stop implementation | Preserves task boundary integrity |
| Doc updates only after GATE D PASS | Prevents false `done` status in task board |
| No wikilink resolution from memory | All spec content read from disk |
| No silent assumption resolution | Every non-obvious decision surfaces at GATE C (Principle A) |
| Define verifiable criterion before coding each AC | Vague ACs produce vague implementations; observable outcomes don't (Principle D) |
| Write minimum code that satisfies the AC | Speculative abstractions + "nice to haves" are scope creep (Principle B) |
| Touch only files the AC requires; remove newly-unused symbols | Adjacent cleanup is a Non-Go unless the task explicitly includes it (Principle C) |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.3 | 2026-06-16 | Andrej Karpathy Code Guidelines embedded (from AGENTS.md). Phase 1 step 5: assumption scan surfaces every non-obvious decision before GATE C. GATE C output: two new sections — "Explicit assumptions" (Principle A, none silent) + "Verifiable success criteria" (Principle D, observable outcomes before coding). Phase 2: P2.7 minimum-code statement per AC (Principle B, senior-engineer test) + P2.8 surgical discipline — explicitly note adjacent code NOT touched, remove newly-unused symbols, capture dead code via P3.7 (Principle C). GATE D: cross-checks the GATE C verifiable criteria, not just command exit codes (Principle D). 4 new hard rules. |
| 1.2 | 2026-06-11 | P3.1 now ticks the AC checkboxes at doc-update time (`- [ ]` → `- [x]` for every GATE-D-verified criterion, incl. inverse/empty-state/boundary sub-lists; failing/skipped stay unchecked; bug-only re-runs re-tick what the fix re-satisfied). Closes the canvas-usability gap where all 51 boxes stayed unchecked on a shipped board because no skill owned the tick. Doer ticks; evaluator un-ticks on refutation (its v0.4). |
| 1.1 | 2026-06-10 | P3.7 discovered-task capture: executor appends raw `[+]`/`~` lines to the discovery ledger when build surfaces unplanned work, as the single writer for raw discovered lines. Reconciliation (Keep/Cut, UC anchoring, TASK generation, appetite hammering) stays owned by `ba-pitch-analyzer --tasks-only` — doer reports, planner decides. No gate-logic changes. |
| 1.0 | 2026-06-03 | Initial release. GATE A–E pipeline. Strict path validation. Dependency pre-flight. Scope confirmation. Doc update with execution log. SPIKE support. Unblock propagation. |
