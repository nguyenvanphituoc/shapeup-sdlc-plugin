# Doc Update Rules — Phase 3

Defines exactly which files change and what fields update after task completion.
Read before Phase 3.

---

## Files That ALWAYS Update

### 1. Task file (`tasks/TASK-NNN-slug.md`)

**Frontmatter changes:**
```yaml
status: done                    # was: todo | in-progress | blocked
completed_at: "2026-06-03"      # ISO date
```

**AC checkboxes (tick at the moment of verification):**
For every acceptance criterion that GATE D verified (✅ in the AC Results), flip its
checkbox in the task body: `- [ ]` → `- [x]`. This covers `## Acceptance Criteria` plus
the 🔁 Inverse Conditions / 📭 Empty & Null States / 🔢 Boundary Values sub-lists.
- Tick ONLY boxes whose evidence was collected this session (GATE D output or the
  consolidated live-verify session this task participated in).
- A ⚠️ skipped/blocked or ❌ failing AC stays `- [ ]` — unchecked boxes on a `done`
  task are a visible red flag by design (see Partial Completion).
- Bug-only re-runs (r>1): re-tick the boxes the fix re-satisfied; leave the rest as-is.
The Execution Log records the evidence; the checkbox is the canonical at-a-glance state —
they must never disagree.

**Append at end of file:**
```markdown
---

## Execution Log

- **executor:** claude-task-executor v1.0
- **session_date:** [ISO date]
- **files_modified:**
  - `[file path]` — [1-line description of change]
  - `[file path]` — [1-line description of change]
- **ac_results:**
  - ✅ [AC text truncated to 80 chars]
  - ✅ [AC text]
  - ⚠️ [AC text] — skipped (⏳ BLOCKED pending [[TASK-NNN]])
- **deviations:** none | [description of any deviation from plan]
- **actual_hours:** [rough estimate based on session time]
```

### 2. `tasks/_index.md`

Update the task row:
- Status emoji: `⬜ ready` or `🔄 in-progress` → `✅ done`
- Do not change any other columns

```markdown
| [[TASK-003\|TASK-003]] | Order repository | api | ✅ done | 2 | TASK-001 | 3h |
```

### 3. `run-state.md`

Append to the gate answer arrays (do not overwrite existing content):

```yaml
task_execution_log:
  - task_id: TASK-003
    status: done
    executed_at: "2026-06-03T[time]"
    files_modified: [list]
    ac_pass_count: N
    ac_skip_count: N  # blocked items
    ac_fail_count: 0  # if partial
```

If `task_execution_log` key doesn't exist in run-state: add it.

---

## Files That CONDITIONALLY Update

### 4. Dependent tasks (if any task depends on this one)

**Condition:** Another TASK file has `depends_on:` containing this task's ID
AND that task's `status: blocked`

**Check:**
```bash
grep -rl "TASK-[NNN]" spec_folder/tasks/ | xargs grep -l "status: blocked"
```

**Update:** For each matching task, if this was its ONLY blocker:
- Change `status: blocked` → `status: ready`
- Note: do NOT change if task has other unresolved dependencies

### 5. `api-feasibility.md` (SPIKE tasks only)

**Condition:** task.type = SPIKE

**Update:** In the relevant API-NN block:
```yaml
status: resolved          # was: under-investigation | unverified
resolution_date: [date]
findings_ref: "[[spikes/SPIKE-[slug]-findings]]"
```

### 6. Contract files (SPIKE tasks only)

**Condition:** SPIKE findings confirmed a ⏳ TBD field

**For each resolved TBD:**
- Replace `⏳ TBD` with the confirmed value
- Add a comment: `# Confirmed by SPIKE: [[spikes/SPIKE-[slug]-findings]]`
- If field remains unconfirmed: change ⏳ TBD → ⚠️ UNCONFIRMED with reason

### 7. `scope-summary.md` (if file exists)

**Update the task row:**
```markdown
| TASK-003 | Order repository | ✅ done | 3h | ~3h | — |
```

Change status column to ✅ done.
If actual hours deviate > 50% from estimated: add a note row below:
```markdown
| | ⚠️ Note: took [Xh] vs estimated [Yh] — reason: [brief] | | | | |
```

---

## Files That NEVER Update in Phase 3

- `domain-model.md` — spec document, not updated by execution
- `ux-behavior.md` — spec document, not updated by execution
- `usecases/*.md` — spec documents, not updated by execution
- `synthesis.md` — updated only by ba-pitch-analyzer, not task-executor
- `_index.md` — updated only by ba-pitch-analyzer Phase 8

If the implementation reveals a spec error:
- Do NOT silently fix the spec
- Note it in the Execution Log: "Spec discrepancy found in [[domain-model#X]]: ..."
- Suggest user run ba-pitch-analyzer with `--tasks-only` to regenerate affected tasks

---

## Partial Completion Handling

If GATE D result = PARTIAL (user accepted some failures):

```yaml
status: in-progress        # NOT done — partial is not done
```

Execution Log:
```markdown
- **status:** partial — [N] ACs failing
- **failing_acs:**
  - ❌ [AC text] — [error excerpt]
```

tasks/_index.md: change to `🔄 in-progress` (not ✅ done)
