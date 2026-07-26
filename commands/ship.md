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

- `--tiny` → the small-change lane: orient (light) → single-task board → build → T0 → done.
  Skips wiring, scope contracts, EVAL, and QA; only gates L0 and L4 pause. The tech-lead's L0
  fit-check applies (≤ ~2 files, no new domain concept/dependency/flow) — if the change isn't
  tiny, it will say so and recommend the full lane.

Additional flags, pass through to `tech-lead` only when the user names them:
- `--rounds N` → override the outer circuit breaker (build+eval cycles, default 3).
- `--attempts N` → override the inner circuit breaker (per-scope T0 attempts, default 5;
  no-op on specs without scope contracts).
- `--orch-model / --exec-model / --eval-model / --qa-model <name>` → override GATE L0.8's
  resolved model matrix for this run only (highest precedence over `.claude/settings.local.json`
  / `.claude/settings.json` / skill defaults).
