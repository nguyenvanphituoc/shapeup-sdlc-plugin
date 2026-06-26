---
description: Run the full Shape Up harness on a pitch, with human sign-off at gates
---
Use the **tech-lead** skill to run the full harness on $ARGUMENTS.

Default to **interactive** (`auto_level = interactive`): pause at every ⏸ gate and require PO
sign-off — especially the Ship gate (L4). The harness's safety depends on the human being in the
loop; do not skip gates by default.

Only run headless/auto if the user explicitly asks for it in their message:
- `--auto` → advance low-risk gates automatically, still pause at L4 (Ship sign-off).
- `--unattended` → fully headless, `max_rounds 3`. **Warn the user first** that no human will
  review the verdict before ship, and proceed only on explicit confirmation. Intended for CI, not
  day-to-day local runs.
