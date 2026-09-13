---
description: File ship-gate feedback into the team-shared, per-skill knowledge base
---
Use the **coach** skill on $ARGUMENTS.

Turns raw PO/TL feedback (usually from the L4 Ship gate) into per-skill guideline files under
committed `shapeup/knowledge-base/<skill>.md`, which the coachable skills read back at
the top of their next run, and which the tech lead reads at GATE L0 for workflow guidance.

`/retro --scan` runs the coach's **scan** operation instead: it reads the project on disk (build
and toolchain files, CI config, CLAUDE.md, README) and drafts the same kind of guidelines from
it, before the first feature or after the toolchain changes. Optional, and never on the scan's
own authority — every drafted rule goes through GATE COACH-1 like feedback.

Two rules the skill enforces and this command must not soften: GATE COACH-1 **asks** the PO
which skill owns each rule — it never assumes; and feedback whose root cause is the mechanism
itself (a gate, hook, or contract defect) is categorized `harness-defect` and filed to the
defect register as a raw idea for the Betting Table, never as worker steering. A third holds
for every category: guidance never decides a gate — a rule may add a question or a check to a
gate block, never an answer.
