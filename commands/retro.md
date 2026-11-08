---
description: File ship-gate feedback into the team-shared, per-reader knowledge base
---
Use the **building** skill's `retro` sub-command on $ARGUMENTS.

Turns raw PO/TL feedback (usually from the Ship Sign-off gate) into per-reader guideline files under
committed `shapeup/knowledge-base/<reader>.md` — readers are `task-executor`, `orient`,
`qa-edge-hunter`, the `plan` activity and the loop itself (`building`, read at the Intake & Config gate, where it may
also suggest Intake & Config values the loop confirms before pinning).

`/retro --scan` runs the retro's **scan** instead: it reads the project on disk (build
and toolchain files, CI config, CLAUDE.md, README) and drafts the same kind of guidelines from
it, before the first feature or after the toolchain changes. Optional, and never on the scan's
own authority — every drafted rule goes through the Retro Ownership gate like feedback.

`/retro --research <stack>` runs the **research**: for a project with nothing on disk
yet, it drafts the same kind of guidelines from the platform's official documentation only —
build, launch, test, package manager, lint, in that order of leverage — each rule cited with url,
version and fetch date; on a project that has been scanned, it cross-checks every scan rule
against the documentation and reports each as confirmed, contradicted or unknown. The stack is
required and never guessed. Research is a source, not a verification: nothing it reads runs, and
the loop still pins every suggested command at the Intake & Config gate before the kernel executes it. A
later `--scan`, once the first feature has created a toolchain, retires the research rules it
confirms with disk evidence.

Two rules the retro enforces and this command must not soften: the Retro Ownership gate **asks** the PO
which reader owns each rule — it never assumes; and feedback whose root cause is the mechanism
itself (a gate, hook, or contract defect) is categorized `harness-defect` and filed to the
defect register as a raw idea for the Betting Table, never as worker steering. A third holds
for every category: guidance never decides a gate — a rule may add a question or a check to a
gate block, never an answer.
