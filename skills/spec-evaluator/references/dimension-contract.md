# Dimension Contract

The injection interface. Every file in `dimensions/` must satisfy this contract so the
core can load and run it without modification. This is the *only* thing the core knows
about a dimension. Adding a new evaluation concern = writing one file that conforms here.

---

## Required frontmatter

```yaml
---
id: spec-conformance            # unique, kebab-case. Matches filename.
title: "Spec conformance"       # human label printed in verdicts
enabled: true                   # core loads it only if true (or named in --dimensions)
weight: 1.0                     # informational; thresholds are hard, not weighted averages
hard_threshold: all-pass        # see "Threshold vocabulary" below
applies_to:                     # scoping — omit a key to mean "all"
  lens: [lite, standard]        # which ba-pitch-analyzer lenses
  package: any                  # apps/api | apps/web | apps/mobile | packages/shared | any
  variant: any                  # shared | be | web | mobile | e2e | any
requires_browser: true          # does this dimension need the running app in a browser?
---
```

The core (GATE V0.5) validates these fields. A dimension missing `id`, `enabled`,
`hard_threshold`, or a malformed `criteria` block is **skipped with a warning** — never
run half-formed.

---

## Required body sections

### `## Criteria`
A list. Each criterion is the atomic unit the evaluator grades. Schema per criterion:

```yaml
- id: SC-1                      # unique within the dimension
  statement: "Every AC checkbox in the task passes by command or UI probe."
  probe: cmd | ui | data | static   # how Phase A collects evidence for it
  evidence_required: true       # if true, NO EVIDENCE → automatic FAIL
  pass_rule: >                  # the objective condition for PASS, evidence-based
    All "- [ ]" items verified PASS via their probe; zero failures.
  source: task | contract | scope-summary | code   # where the criterion is read from
```

`probe` values map directly to Phase A handlers:
- `cmd`    → run a shell command, capture output + exit code
- `ui`     → drive the running app (Playwright CLI by default)
- `data`   → query DB / inspect storage state
- `static` → read code/files (use sparingly; prefer probing the running app)

### `## Threshold`
State the hard threshold in prose + the vocabulary token. The core ANDs all active
dimensions; within a dimension, the threshold decides PASS/FAIL from its criteria.

### `## Bug template`
A fenced block the report uses for every FAIL this dimension produces. Must include at
least: `severity`, `criterion`, `location (file:line or endpoint)`, `repro`,
`expected`, `actual`. Keeps generator handoff uniform across dimensions.

---

## Threshold vocabulary

| Token | Meaning |
|-------|---------|
| `all-pass` | Every criterion must PASS. One FAIL → dimension FAILS. (Use for correctness.) |
| `no-critical` | FAILs allowed only below `critical` severity. Any `critical` → dimension FAILS. |
| `count<=N` | At most N FAILs of any severity tolerated. |
| `score>=N` | For genuinely graded/subjective dimensions: a 0–100 rubric score ≥ N. |

`spec-conformance` uses `all-pass` — correctness is not negotiable and leniency is the
enemy. A subjective dimension (e.g. `visual`) would use `score>=N` with a calibrated rubric.

---

## What the core promises a dimension

1. It reads `applies_to` and runs the dimension only on matching tasks.
2. It calls the right Phase A handler for each criterion's `probe`.
3. It enforces `evidence_required` (no evidence → FAIL) before applying `pass_rule`.
4. It applies the dimension's own `hard_threshold` independently, then ANDs across dimensions.
5. It renders FAILs using the dimension's own `## Bug template`.

A dimension author therefore writes *criteria + probes + threshold + bug shape* — never
touches the gate logic, the loop, or the report assembler.

---

## Minimal valid dimension (copy to start a new one)

```markdown
---
id: my-dimension
title: "My dimension"
enabled: false
weight: 1.0
hard_threshold: all-pass
applies_to: { variant: web }
requires_browser: true
---

## Criteria
- id: MD-1
  statement: "<the thing to verify>"
  probe: ui
  evidence_required: true
  pass_rule: "<objective, evidence-based PASS condition>"
  source: task

## Threshold
all-pass — every criterion must PASS.

## Bug template
```
severity: [critical|major|minor]
criterion: MD-1
location: <file:line | endpoint | screen>
repro: <steps>
expected: <from criterion>
actual: <observed evidence>
```
```
