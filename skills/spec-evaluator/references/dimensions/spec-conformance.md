---
id: spec-conformance
title: "Spec conformance"
enabled: true
weight: 1.0
hard_threshold: all-pass
applies_to:
  lens: [lite, standard]
  package: any
  variant: any
requires_browser: true
---

# Spec conformance

The one dimension the evaluator runs by default. Answers a single question with no
leniency: **does the built task do exactly what its spec and acceptance criteria say —
no less (missing/stubbed behavior) and no more (out-of-scope changes)?**

Correctness only. Not security, not performance, not aesthetics. Those are other
dimensions, off by default.

## Criteria

```yaml
- id: SC-AC
  statement: "Every '- [ ]' acceptance-criterion checkbox in the task verifies PASS."
  probe: cmd          # most are cmd; [ui]/[data] criteria use those probes per GATE V1.2 classification
  evidence_required: true
  pass_rule: >
    Each AC is run via its classified probe and PASSES. Zero failing AC.
    A stubbed/display-only implementation that satisfies the literal checkbox text but not
    its observable intent FAILS (probe the behavior, not the existence of code).
  source: task

- id: SC-DONE-WHEN
  statement: "Each 'Done when:' statement for this task (scope-summary) is satisfied."
  probe: ui
  evidence_required: true
  pass_rule: >
    Drive the running app to reproduce the user-visible outcome each Done-when describes.
    The outcome is observed, not inferred from code. Done-when statements are honored verbatim.
  source: scope-summary

- id: SC-REQ
  statement: "Request shape matches contracts/<repo>.contract.md #Request table."
  probe: cmd
  evidence_required: true
  pass_rule: "A real request built from the contract is accepted; every field/type/required flag matches."
  source: contract

- id: SC-RES
  statement: "Response mapping matches contracts/<repo>.contract.md #Response table."
  probe: cmd
  evidence_required: true
  pass_rule: "The actual response is compared field-by-field to the Response table; all map correctly."
  source: contract

- id: SC-ERR
  statement: "Every error code in contracts/<repo>.contract.md #Error Cases is handled."
  probe: cmd
  evidence_required: true
  pass_rule: "Each error case is triggered and the documented code/shape is returned; none unhandled."
  source: contract

- id: SC-NONGO
  statement: "The implementation respects the task '## Non-go' boundary."
  probe: static
  evidence_required: true
  pass_rule: >
    Inspect the diff / changed files. No file outside the task's package/scope is modified,
    and no Non-go item is touched. Any out-of-scope change FAILS with file:line.
  source: task

- id: SC-LAYER
  statement: "No upward layer leak — the task does not reach above its declared layer."
  probe: static
  evidence_required: false   # advisory unless a concrete violation is found
  pass_rule: >
    A Layer-N task does not implement or depend on un-built Layer N+1 code.
    Only FAILS if a concrete violation is observed; otherwise PASS.
  source: code
```

Criteria applicability by variant (the core uses `applies_to` for the dimension, then
common sense per task):
- `SC-REQ / SC-RES / SC-ERR` apply only when the task touches a repository / contract
  (typically `.be` and `.shared`). For a pure `.web` UI task with no contract, they are N/A
  and excluded — not auto-passed.
- `SC-DONE-WHEN` and `SC-AC` apply to every task.
- For `.e2e` tasks, `SC-AC` is satisfied by running the existing e2e suite green.

## Threshold

`all-pass` — every **applicable** criterion must PASS. One FAIL fails the dimension, and
since this is the only enabled dimension by default, one FAIL fails the task. There is no
partial credit and no halo effect: a beautiful, fast, working-90% build with one broken
AC is a FAIL. This bluntness is intentional — it is the antidote to lenient self-grading.

N/A criteria (e.g. contract criteria on a contractless UI task) are excluded from the
denominator; they are never counted as PASS to pad the result.

## Bug template

```
severity: [critical|major|minor]
  critical = a Done-when or AC central to the feature does not work
  major    = a secondary AC fails, or a contract field/error is mishandled
  minor    = a non-go breach or layer leak with no user-visible effect (still a FAIL)
criterion: [SC-AC | SC-DONE-WHEN | SC-REQ | SC-RES | SC-ERR | SC-NONGO | SC-LAYER]
location: <file:line | endpoint | screen+element>
repro: <exact steps or command that produced the evidence>
expected: <quoted from the AC / Done-when / contract table>
actual: <observed evidence: output excerpt, console error, or DB state>
fix_hint: <optional — the wiring point the generator should look at>
```

## Probing notes specific to this dimension
- Prefer driving the **running** app over reading code. The classic failure (from the
  harness blog) is code that looks correct but whose wiring is broken with no surface
  signal — only exercising it catches that.
- When an AC's literal text is satisfied but behavior is not (a button exists but does
  nothing), FAIL `SC-AC` and localize the dead wiring to file:line.
- For `SC-DONE-WHEN`, reproduce the PO's described outcome end to end; a "Done when" is a
  user-acceptance statement, so verify it as a user would.
