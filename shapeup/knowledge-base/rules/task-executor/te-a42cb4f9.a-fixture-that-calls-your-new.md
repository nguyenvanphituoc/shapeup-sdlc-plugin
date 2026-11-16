---
id: te-a42cb4f9
reader: task-executor
kind: guide
when: {}
status: active
aliases: ["KB-TE-001"]
---

A fixture that calls your new function directly proves the function is correct,
never that anything uses it. Drive the real entry point — the CLI, the command, the pipeline — in
at least one fixture per change. _(why: measured 2026-09-22 — a stage shipped a correct kernel
derivation that nothing called: the CLI was untouched and the caller still used the old logic.
Every fixture invoked the new function directly, so all of them passed while the defect the work
existed to close was still live. A green fixture over a dead path is the failure mode, not the
exception.)_
