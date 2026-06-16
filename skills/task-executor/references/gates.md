# Gate Definitions — Task Executor

Rules for all ⏸ GATE prompts in the task-executor skill.

---

## Universal Gate Rules

1. **Every gate prints a summary first** — never ask questions without context.
2. **Max 2 questions per gate** — if more ambiguity exists, pick the 2 most critical.
3. **Never assume an answer** — if uncertain, surface as question.
4. **HARD STOP conditions** are non-negotiable — do not proceed until explicitly resolved.
5. **Gate answers are logged** — each answer is appended to run-state.md before moving on.

---

## GATE A — Locate & Validate

**HARD STOP conditions:**
- `spec_folder` not found on disk → must correct before proceeding
- `tasks/` directory not found in spec_folder → must correct before proceeding

**Soft conditions (ask, then proceed on y):**
- run-state.md missing → proceed with limited traceability
- task status already = done → confirm re-execution

**Resolution logic:**
- If task_id not provided: list all tasks in tasks/ dir with their status
- If multiple matches (e.g. TASK-003-a.md and TASK-003-b.md): list them, ask which

**run-state.md reading:**
Always extract and print: `lens`, `feature`, `phases_completed`, `output_path`
If run-state fields missing: note which fields are absent. Do not invent values.

---

## GATE B — Pre-Flight Check

**HARD STOP conditions:**
- Any dependency task has status ≠ done AND user does not confirm it's actually done
- Task body contains ⏳ BLOCKED and user does not confirm all blockers resolved

**Soft conditions (ask, then proceed on y):**
- Test command unknown → ask before proceeding (required for GATE D)
- Env vars unknown → ask (can be "none")

**Dependency resolution:**
For each depends_on entry:
1. Read the task file
2. Extract `status:` from frontmatter
3. Print: `[TASK-NNN] status: [X]`
If status file unreadable: treat as unconfirmed, ask user

**Non-Go confirmation:**
Print the exact Non-Go section text from the task file.
Do not paraphrase. User must read it directly.

---

## GATE C — Scope Confirmation

**HARD STOP conditions:**
- User rejects the implementation plan → return to Phase 1, reload with corrections

**Soft conditions (ask, then proceed on y):**
- Unresolved wikilink → ask how to handle (stub / skip / find alternative)
- Package path ambiguous → ask for correct path

**Plan format:**
Numbered list. Each item: `[action] [file path] — [1-line reason]`
Examples:
- `CREATE packages/shared/src/domain/order.ts — Order aggregate per [[domain-model#Aggregate-Order]]`
- `MODIFY packages/shared/src/index.ts — export Order type`

**What counts as needing a question:**
- Wikilink file not found on disk
- Two equally valid interpretations of an AC
- Conflicting instructions between task body and linked doc

**What does NOT need a question:**
- Standard patterns (e.g. Drizzle schema follows existing file style)
- Things explicitly stated in the task file
- Naming conventions from existing codebase

---

## GATE D — Verification

**HARD STOP conditions:**
- Any ❌ failing command AND user chooses NOT to fix → do not update docs to `done`
  Instead: set status to `in-progress`, log failures, stop

**Command extraction rules:**
Extract runnable commands from AC lines that contain:
- `pnpm`, `npm`, `yarn`, `npx`
- `curl`, `http`, `GET`, `POST`
- Any bash command in backticks

Non-command AC items (descriptive, visual, behavioral):
- Print as 👁 Manual check — user must confirm

**Failure handling:**
On ❌: print first 10 lines of stderr/stdout.
Ask: "Fix this now (return to Phase 2) or mark partial and continue?"
Only mark `done` if user confirms all failures are acceptable.

---

## GATE E — Completion Sign-Off

**HARD STOP conditions:**
None — this gate is confirmatory only.

**User corrections at Gate E:**
If user says corrections needed:
- For execution log edits: update the ## Execution Log section in task file
- For doc update errors: re-run the specific P3.X step
- Do NOT re-run Phase 2 from Gate E — that requires going back to Gate C

**Next task suggestion logic:**
1. Read tasks/_index.md
2. Filter: status = 'ready' (not blocked, not done)
3. Sort by priority ascending
4. Pick lowest priority number
5. Check: all depends_on for that task are done
6. Print first match as suggestion

If no ready tasks remain: print "All tasks complete 🎉"

---

## run-state.md Logging Format

Append after each gate confirmation:

```yaml
gate_exec_[task_id]:
  gate_a:
    spec_folder: "[confirmed path]"
    task_file: "[confirmed filename]"
    confirmed_at: "[ISO datetime]"
  gate_b:
    dependencies_confirmed: [list or []]
    blockers_resolved: [list or []]
    test_command: "[command]"
    non_go_confirmed: true
  gate_c:
    plan_confirmed: true
    unresolved_gaps: [list or []]
  gate_d:
    ac_results:
      - command: "[cmd]"
        result: "pass | fail"
    manual_confirms: [list]
    overall: "pass | partial | fail"
  gate_e:
    corrections: "[none | description]"
    closed_at: "[ISO datetime]"
```
