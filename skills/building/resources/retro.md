# After a ship — the retro

`terminal` with `status: shipped` has closed the run and frozen the report. Do not resolve the ship gate
again: a second row after the close is a second sign-off.

1. Print the sign-off as the kernel left it:

   ```
   ⏸ GATE L4 — Ship Sign-Off
   Feature   : <slug> — SHIPPED | BUILT & VERIFIED — deploy pending (PO)
   Rounds    : <rounds_used>
   Verdict   : <verdict> (dims: <dims_evaluated>; not evaluated: <the dimensions left out>)
   QA        : <qa_findings> findings | skipped | not-hunted
   Report    : shapeup/<slug>/REPORT.md
   ```

2. Ask once: "Anything to record before I close the run?"
3. On substantive feedback, dispatch a sub-agent to invoke `Skill(shapeup-sdlc-plugin:coach)` with it. The
   coach runs its own gate (COACH-1) and asks the PO which skill owns each rule; you never categorise
   feedback yourself, and a rule only ever adds a question or a check — it never decides a gate.
4. End with `✅ <slug> — <verdict>, <rounds> round(s)`.

A run that ended `escalated` or `aborted` skips the retro: report where and why, and stop.
