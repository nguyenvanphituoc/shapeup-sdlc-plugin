# spec-evaluator

The **judge** in a planner → generator → evaluator harness. Pairs with `task-executor`
(generator) and `ba-pitch-analyzer` (planner). Reads the same spec tree, exercises the
**running** app, returns a hard-threshold verdict + file:line bug list, and hands bugs back
to the generator. Skeptical by default; never marks a task `done`.

v0.1 evaluates one dimension only — **spec-conformance** (AC + Done-when + contract shapes +
non-go). Security / performance ship disabled, injectable later with zero core changes.

---

## Resource map

```
spec-evaluator/
├── SKILL.md                              # entry point — frontmatter, GATE V0–V3, flags, hard rules
├── README.md                             # this file
└── references/
    ├── dimension-contract.md             # ★ the injection interface every dimension implements
    ├── anti-leniency.md                  # skeptical posture — read before any verdict (GATE V2)
    ├── probing.md                        # Phase A — Playwright CLI + per-variant probe strategy
    ├── report-schema.md                  # Phase B — the EVAL-TASK-NNN.md handoff file
    └── dimensions/
        ├── _registry.md                  # which dimensions are active + how to add one
        ├── spec-conformance.md           # ✅ the only enabled dimension (correctness)
        ├── security.md                   # ⛔ disabled stub — worked example of the contract
        └── performance.md                # ⛔ disabled stub — worked example of the contract
```

| Resource | Loaded at | Purpose |
|----------|-----------|---------|
| `SKILL.md` | always | gate pipeline, invocation, authority rules |
| `references/dimension-contract.md` | GATE V0.5 | the interface; validates each dimension before running it |
| `references/dimensions/_registry.md` | GATE V0.5 | active set resolution (`--dimensions` overrides) |
| `references/dimensions/spec-conformance.md` | per task | the default correctness dimension |
| `references/dimensions/{security,performance}.md` | only if enabled | injectable stubs, off by default |
| `references/anti-leniency.md` | before GATE V2 | absence of evidence = FAIL; banned phrases |
| `references/probing.md` | Phase A | how to collect evidence (CLI > MCP, per variant) |
| `references/report-schema.md` | Phase B | the file the generator reads next |

★ = the load-bearing file for "spec now, more dimensions later."

---

## Install

```bash
# Project scope (shareable via version control) — recommended
cp -r spec-evaluator <repo>/.claude/skills/

# or user scope (all your projects)
cp -r spec-evaluator ~/.claude/skills/
```

Restart the session (or re-open the skills interface) so the new skill is discovered.

## Invoke

```bash
/spec-evaluator --spec docs/shapeup-sdlc/checkout-vnpay/spec/ --task TASK-007  # default: spec-conformance
/spec-evaluator --spec ... --task TASK-007.web                                # platform variant
/spec-evaluator --spec ... --task TASK-007.be --browser none                  # backend-only, no browser
/spec-evaluator --spec ... --task TASK-007 --dimensions spec-conformance,security   # inject a dimension
/spec-evaluator --spec ... --task TASK-007 --single-pass --auto               # one end pass, skip sign-off
```

## Pipeline position

```
ba-pitch-analyzer (planner) ─► task-executor (generator) ─► spec-evaluator (judge)
                                      ▲                                │
                                      └──── bug list (EVAL-TASK-NNN) ◄─┘  on FAIL
```
The evaluator writes `.shapeup-sdlc/<slug>/evaluation/EVAL-<task_id>.md` (LOCAL run-trace root) and sets `eval_verdict` on the task.
`task-executor` owns `status: done`. Judge and doer stay separate by design.

## Inject a new dimension (zero core edits)

1. Copy the "Minimal valid dimension" block from `references/dimension-contract.md` to
   `references/dimensions/<id>.md`; fill criteria, probes, threshold, bug template.
2. Set `enabled: true` in `references/dimensions/_registry.md` (or pass `--dimensions … ,<id>`).
3. Re-run. GATE V0.5 validates it against the contract and loads it; non-conforming files
   are skipped with a warning, never half-run.

`applies_to` scopes a dimension to a lens / package / platform variant, so a `visual`
dimension can run only on `.web` tasks and `security` only on `.be`/`.shared`.

---

## Version
0.1 — initial template. GATE V0–V3, skeptical-by-default, single enabled dimension,
pluggable dimension contract, Playwright CLI probing, file:line bug handoff.
