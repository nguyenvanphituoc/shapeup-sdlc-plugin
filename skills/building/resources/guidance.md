# The knowledge base — which file is read where

`shapeup/knowledge-base/<name>.md` holds the rules the team has filed. Guidance steers craft: **a rule may
add a question or a check to a gate block, never an answer, a skip, a reorder or a wider substrate.** A rule
that disagrees with the spec, a contract, a gate or a kernel check loses, and the conflict is told to the PO.

Files are named after the skill a rule was first filed under, and a consumer's existing files keep working.
New rules are written under the **activity** name. The loop reads, in order:

| Read at | Files | Why those names |
|---|---|---|
| L0, before the intake questions | `building.md`, then `tech-lead.md` | `tech-lead.md` is what the loop's guidance was filed as before it had its own name; it is read as `building` guidance |
| every `plan` step (its `guidance` field lists the ones that exist; the order's `payload.kb_rules_paths` names all four) | `plan.md`, `ba-pitch-analyzer.md`, `scope-architect.md`, `solution-architect.md` | the planning activity was three skills; each file's rules still apply to the substep that skill's craft became (analysis, scope contracts, wiring) |
| a dispatched worker's order | `task-executor.md`, `orient.md`, `qa-edge-hunter.md` — the worker reads its own, from `payload.kb_rules_path` | unchanged |

Never read: a file for `spec-evaluator` (the judge is not coachable — a coached judge is a second grader) or
for `scope-hammer` (the census's ownership claims come from the kernel's `probe owner`, not from guidance).

A rule filed against `ba-pitch-analyzer`, `scope-architect` or `solution-architect` is read by the plan
step and is rewritten under `plan` the next time the coach touches it; the old file is never deleted by the
loop.
