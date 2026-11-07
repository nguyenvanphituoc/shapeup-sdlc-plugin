---
type: synthesis
feature: personal-site
lens: lite
---

# Synthesis — personal-site

## Traceability (derived counts)
- 21 registry requirements; every one is named by at least one board AC `covers:` clause.
- 1 use case (UC-BuildPage), 7 invariants, 3 error codes, 13 Test Surface rows (all `process` oracle).
- 3 tasks, 8h, critical path TASK-001 → TASK-002 → TASK-003. Appetite is "one build round"; no overflow computed (appetite not in weeks).

## Planner decisions taken unattended (no PO present — flagged for review at L4)
1. Only `name` is required; other absent fields render empty (pitch names only `name` as required).
2. `$CONTENT_FILE` / `$OUT_DIR` resolve against the working directory; the output dir is created on success only.
3. A project `url` with a scheme other than `http:`/`https:`/relative renders as plain text (derived from "no JavaScript in the page").
4. No sample `content.json` is shipped — the pitch does not ask for one.

## Risk register
| Risk | Mitigation |
|---|---|
| Vacuous `node --test` over zero tests | build_probe names `test/build.test.mjs` |
| Partial output on error path | validate before any mkdir/write (TASK-001) |
