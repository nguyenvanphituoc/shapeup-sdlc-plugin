---
description: File ship-gate feedback into the team-shared, per-skill knowledge base
---
Use the **coach** skill on $ARGUMENTS.

Turns raw PO/TL feedback (usually from the L4 Ship gate) into per-skill guideline files under
committed `docs/shapeup-sdlc/knowledge-base/<skill>.md`, which the coachable skills read back at
the top of their next run.

Two rules the skill enforces and this command must not soften: GATE COACH-1 **asks** the PO
which skill owns each rule — it never assumes; and feedback whose root cause is the mechanism
itself (a gate, hook, or contract defect) is categorized `harness-defect` and filed to the
defect register as a raw idea for the Betting Table, never as worker steering.
