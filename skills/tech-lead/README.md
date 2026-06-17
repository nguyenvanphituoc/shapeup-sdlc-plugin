# tech-lead

The orchestrator over the harness. Acts as the tech lead that runs a feature end-to-end
across three skills, makes round decisions, and reports to the PO at gates. It is **thin** —
it sequences and decides, it does not plan, build, or judge itself.

```
ba-pitch-analyzer (planner)  →  task-executor (generator)  →  spec-evaluator (judge)
        PLAN                         BUILD (loop all tasks)        EVALUATE (once / round)
                                          ▲                              │
                                          └──── bugs, round r+1 ◄────────┘  on FAIL
```

**Core rule:** the evaluator runs exactly once per build round, only after the task board
is 100% done — never per task. That single end-of-round QA pass is the long-running harness
V2 lesson, and enforcing its timing is the reason this skill exists.

## Resource map
```
tech-lead/
├── SKILL.md                       # entry — GATE L0–L4, the round loop, flags, hard rules
├── README.md                      # this file
└── references/
    ├── round-protocol.md          # ★ the loop: r=1 vs r>1, stop conditions, eval timing rule
    ├── delegation.md              # how each of the 3 sub-skills is invoked + handoff files
    └── ledger-schema.md           # harness-run.md — the round table / decisions / escalation
```

| Resource | Loaded at | Purpose |
|----------|-----------|---------|
| `SKILL.md` | always | L-gates, phase sequence, invocation, authority rules |
| `references/round-protocol.md` | BUILD/EVAL | the loop semantics + the "eval once at end" rule |
| `references/delegation.md` | each phase | exact sub-skill commands + which handoff files to read |
| `references/ledger-schema.md` | throughout | the run ledger that carries state across rounds/sessions |

## Install
```bash
cp -r tech-lead <repo>/.claude/skills/      # or ~/.claude/skills/
```
Requires the harness skills installed: `ba-pitch-analyzer`, `task-executor`,
`spec-evaluator`, plus `translator` (the GATE L0 language gate for non-English intake).
The EVAL phase uses spec-evaluator's feature-level pass
(`--feature <slug>`) — see the dependency note in `references/delegation.md`.

## Invoke
```bash
/tech-lead --pitch docs/shapeup-sdlc/checkout/shaping/shaping.md --spec docs/shapeup-sdlc/checkout/spec/ --lens standard
/tech-lead --pitch ... --spec ... --auto                 # sub-skills unattended; pause at L1/L3/L4
/tech-lead --pitch ... --spec ... --unattended --max-rounds 3   # headless / CI (Agent SDK)
/tech-lead --spec docs/shapeup-sdlc/checkout/spec/ --from build   # resume an existing run
/tech-lead --pitch ... --spec ... --no-eval              # skip eval for a trivial feature
```

## Gate map
| Gate | When | Decision |
|------|------|----------|
| L0 | intake | language gate (`/translator --check`, translate if non-English) + run config: spec folder, lens, dims, max_rounds, auto level |
| L1 | after PLAN | PO accepts the task board before any code |
| L2 | after BUILD round | board 100% done? → unlocks the single EVAL pass |
| L3 | after EVAL | PASS → ship; FAIL → bug-only round r+1; max_rounds → escalate |
| L4 | after SHIP | PO sign-off, close the ledger |

## Auto levels
- **interactive** (default): pause at every L-gate; sub-skills keep their own gates.
- **--auto**: sub-skills run unattended; tech lead still pauses at L1 / L3 / L4.
- **--unattended**: auto-confirm all L-gates; stop only on PASS, max_rounds, or hard error.
  This is the headless mode for an Agent SDK / CI driver.

## Version
0.1 — initial orchestrator. Round gates L0–L4. Single end-of-round evaluation. Bug-only
re-build rounds. Max-rounds escalation. Resume + --no-eval.
