---
id: te-f2e0c6a6
reader: task-executor
kind: guide
when: {}
status: retired
aliases: ["KB-TE-002"]
---

A check whose pass condition is *"this command fails"* also passes when the
command is **missing**. Assert both directions in one command:
`<probe> <normal> && <mutate> && ! <probe> <mutated> && echo BOTH_DIRECTIONS`. Lead a
suite-level mutation with a green suite, so it cannot score over one that was already broken.
_(why: measured 2026-09-22 — four falsifier checks scored green against fixtures that did not
exist yet; `node <missing-file>` exits non-zero and `!` inverts that into a pass. Each one
reported success having measured nothing.)_
