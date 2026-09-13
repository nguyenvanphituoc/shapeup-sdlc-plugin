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

`/retro --research <stack>` runs the **research** operation: for a project with nothing on disk
yet, it drafts the same kind of guidelines from the platform's official documentation only —
build, launch, test, package manager, lint, in that order of leverage — each rule cited with url,
version and fetch date; on a project that has been scanned, it cross-checks every scan rule
against the documentation and reports each as confirmed, contradicted or unknown. The stack is
required and never guessed. Research is a source, not a verification: nothing it reads runs, and
the tech lead still pins every suggested command at GATE L0 before the kernel executes it. A
later `--scan`, once the first feature has created a toolchain, retires the research rules it
confirms with disk evidence.

Two rules the skill enforces and this command must not soften: GATE COACH-1 **asks** the PO
which skill owns each rule — it never assumes; and feedback whose root cause is the mechanism
itself (a gate, hook, or contract defect) is categorized `harness-defect` and filed to the
defect register as a raw idea for the Betting Table, never as worker steering. A third holds
for every category: guidance never decides a gate — a rule may add a question or a check to a
gate block, never an answer.
