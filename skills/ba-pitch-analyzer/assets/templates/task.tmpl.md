---
type: task
feature: FEATURE_SLUG
id: TASK-NNN
title: "[imperative verb phrase — e.g. Create Order aggregate schema]"
package: packages/shared | apps/api | apps/web
status: ready
priority: N
depends_on: []
unlocks: []
use_case_refs: []
entities: []
repositories: []
linked_docs: []
estimated_hours: N
tags: []
---

# TASK-NNN: [Title]

## Context
[2-3 sentences. Wikilink to the source spec, not re-describe it.]
Reference: [[domain-model#Section]] / [[usecases/UC-Name#Steps]]
Style reference: `[path/to/existing/similar/file.ts]`

## Acceptance Criteria

### ✅ Baseline (always required)
- [ ] [File X is created at path Y]
- [ ] `pnpm --filter [package] typecheck` exits 0
- [ ] `pnpm --filter [package] test [file]` passes
- [ ] [Exported type Z is available from package index]

### 🔁 Inverse Conditions
<!-- _trigger: layer=ui + keyword=show/hide/display/visible/render -->
<!-- Include ONLY if this task has conditional rendering logic. Remove section if not applicable. -->
- [ ] [Element X does NOT appear when condition C1 is false]
- [ ] [Element X does NOT appear before prerequisite state S is reached]

### 📭 Empty & Null States
<!-- _trigger: layer=repository/api + keyword=fetch/load/list, OR ui task references data prop -->
<!-- Include ONLY if this task fetches data or renders data-driven UI. Remove section if not applicable. -->
- [ ] Loading: [Skeleton/spinner renders while fetch is pending]
- [ ] Empty result: [EmptyState component renders when API returns `[]`]
- [ ] Null guard: [No crash or render error when `[field]` is `null` or `undefined`]

### 🔢 Boundary Values
<!-- _trigger: any numeric value, file size, limit, max, min mentioned in description -->
<!-- Include ONLY if this task enforces a limit or validates a range. Remove section if not applicable. -->
- [ ] At min value ([N]): [expected behavior]
- [ ] At max value ([N]): [expected behavior — e.g. reject with error code E_XXX]
- [ ] At zero/empty string: [expected behavior]

### 🧪 BDD Scenarios
<!-- _trigger: task.type=FEAT + user-facing action OR cross-layer boundary (UI→API, API→DB) -->
<!-- 1–3 scenarios max: happy path required, key rejection optional. Remove for CHORE/DOCS/MIGRATION/SPIKE. -->

**Scenario: [describe the happy-path action]**
Given [precondition — who/what is in what state]
When  [actor performs specific action]
Then  [expected observable outcome]

**Scenario: [describe a key guard or rejection]**
Given [precondition that leads to rejection]
When  [action is attempted]
Then  [error response or system rejection]

### 🔗 Integration Flow
<!-- _trigger: task crosses ≥1 service boundary (UI→API, API→DB, service→external) -->
<!-- Name layers explicitly. Remove for tasks isolated to a single layer (domain types, pure domain logic). -->

**[Source layer] → [Target layer/service]**
Given [upstream caller/actor is in [state]]
When  [action triggers at [layer — e.g. POST /api/resource or Repository.save()]]
Then  [downstream side effect — DB row created, event published]
And   [caller receives — HTTP status + response body shape]

## Implementation Notes
<!-- Optional — only include non-obvious decisions -->
<!-- Remove this section if empty -->

## Non-Go (not in this task)
- [What explicitly comes later — with task reference if known]
- [Another thing that's out of scope]
