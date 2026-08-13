# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects

### HD-009 — the pipeline permission grant matches nothing, and every check of it tested a proxy

**Filed:** 2026-08-12, from the first full-pipeline run through the shipped launcher
(`.plan-runs/wf-hd007-pipeline`, three legs). Not from L4 feedback — from a run that aborted at its
FIRST dispatch in a project that was trusted and carried the installer's grant.

`bin/init.mjs` writes `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)`. **That rule
grants nothing.** Bash prefix rules match on **complete argument boundaries**, and this prefix ends
in the middle of an argument (`.../scripts/`), so it matches no command at all. Measured in a
trusted scratch workspace, one command, three rules:

| rule in `permissions.allow` | command | result |
|---|---|---|
| `Bash(node <dir>/scripts/:*)` — prefix ends mid-argument | `node <dir>/scripts/hello.mjs` | **DENIED** |
| `Bash(node <dir>/scripts/hello.mjs:*)` — prefix is a whole argument | same | **ALLOWED** |
| `Bash(node:*)` — prefix is a whole token | same | **ALLOWED** |

**And the second half is worse, because it removes the obvious fix.** Every skill writes its call
sites in the QUOTED form — `node "${CLAUDE_PLUGIN_ROOT}/skills/…"` — which v1.5's leg-2 fix adopted
so an install path containing a space would not break the command. A quoted command matches
**neither** rule spelling:

| command | rule | result |
|---|---|---|
| `node "<dir>/scripts/hello.mjs"` | `Bash(node <dir>/scripts/hello.mjs:*)` | **DENIED** |
| `node "<dir>/scripts/hello.mjs"` | `Bash(node "<dir>/scripts/hello.mjs:*)` | **DENIED** |

So the documented call sites are ungrantable as written, and the two fixes pull against each other:
unquoting restores grantability and reintroduces the spaced-path break the quoting was adopted for.

**Why nothing caught it.** `tests/structural/14-invocation-paths.mjs` asserts the grant is a
**string prefix** of each documented command, and it is — that is exactly why the module is green.
String-prefix-ness is a *proxy* for "the CLI will honour this", and the proxy and the behaviour
diverge precisely here. This is the module's own banner turned on itself: a check that verifies the
shape of an invariant instead of executing it. The installer test (check 5) executes `init` and
asserts the rules land in `settings.json`; nothing ever asserted a granted command actually runs.

**What this explains, retroactively.** The "26 approval denials in a single session" that motivated
the grant — the grant never fixed them. HD-007's headless lane failure. A7's candidate arm
improvising the feature by hand. And why the benchmark's own harness scripts *did* run: its adapter
appends a broad `Bash(node:*)` rule (`harnesses/shapeup-sdlc/adapter.mjs`), which works — so the
bench has been measuring a permission configuration the plugin does not ship.

**The fix this defect is filed for** — a PO decision, because the options trade differently and one
of them is a security posture, not a bug fix:
1. **Enumerate whole-argument rules**, one per shipped script (`Bash(node <root>/skills/<owner>/scripts/<name>.mjs:*)`).
   Least privilege intact, grantable — but requires unquoting the call sites, which re-opens the
   spaced-install-path break, so it needs a documented install constraint or a path-quoting scheme
   the matcher accepts.
2. **Grant `Bash(node:*)`.** Known to work, and what the benchmark has been using all along. Broad:
   any node command in the project.
3. Keep the tool lane and grant the unscoped `"Workflow"` token (HD-007's correction) — which has
   its own unscopable-grant problem.

**Whichever is chosen, the regression guard must EXECUTE a granted command**, not compare strings.

---

### HD-006 — the WorkOrder does not say where the WorkResult goes

**Filed:** 2026-08-11, from a kill/resume probe of the orchestrated lane. Not from L4 feedback —
from two consecutive dispatches failing in the field.

A compiled WorkOrder carries `order_id`, `substrate` and `payload`, and **nothing that names the
result file**. Every worker SKILL.md documents the convention in prose
(`.shapeup/<slug>/results/<order-suffix>.json`), so each worker derives the path itself — while its
own order's `substrate.allowed` names a directory that does not contain that path (e.g. `orient`'s
allowed list is `.shapeup/<slug>/orient/**`).

**Measured, two consecutive ORIENT dispatches, same order, two different failures:**

| leg | what the worker did | what the run did |
|---|---|---|
| 1a | wrote `results/orient.json` correctly, reported a **directory** as `result_path` | aborted at ORIENT, `EISDIR` |
| 1b | wrote all four orient artifacts, **no result file at all** | aborted at ORIENT, `ENOENT` |

Both times the craft was done and the phase was thrown away. A convention carried in prose is a
guess the port is asking each worker to make independently.

**Worked around, not fixed** (`shapeup-run.js` / `shapeup-build-round.js`): the dispatch prompt now
states the exact path, and the pipeline derives the same one from the order rather than trusting the
report. That closes the failure for the workflow lane only.

**The fix this defect is filed for:** `result_path` becomes a field of the WorkOrder, written by
`compile-order.mjs`, declared in `domain.schema.json`, included in each operation's
`substrate.allowed`, and read by every worker instead of derived. It touches every worker's input
contract, which is why it is a bet rather than a patch.

---

### HD-007 — the only post-cutover lane cannot start headlessly, and nothing says so

**Filed:** 2026-08-12, from a headless benchmark run of the post-cutover lane. Not from L4
feedback — from six paid benchmark reps in which the lane never once executed.

The cutover (D1–D4) deletes the prose orchestrator and makes the `Workflow` lane the only lane for
scoped specs. **In a headless session that lane cannot start.** Every `Workflow` tool call is denied
with `Review dynamic workflow before running`, which requires an interactive confirmation a
`claude -p` run cannot give.

**Reproduced minimally, outside the benchmark, on a three-line workflow script:**

| `--permission-mode` | result |
|---|---|
| `acceptEdits` | **denied** — "requires interactive confirmation that isn't available in this session" |
| `bypassPermissions` | **launches**, returns `{"ok":true}` |

**The plugin documents this nowhere.** There is no `Workflow` permission string anywhere in the
repository; `npx shapeup-sdlc init` writes Bash allowances only; `docs/upgrading.md` names only
`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` as a headless requirement. A user who follows the documented
install and runs unattended gets a lane that silently does not start.

**What happens instead is worse than a crash.** Measured across three candidate reps: the agent
falls back to improvising. Once it hand-built the feature with no receipt at all (scored 14/14 by the
oracle, `harness_unreachable` by the run-evidence check); once it emulated the pipeline by hand
through `Skill`/`Agent`/`Bash` and reached gate L4 with a valid receipt — while `shapeup-run.js`
never ran. **A receipt therefore does not prove the lane ran.**

**The fix this defect is filed for:** `init` writes the permission the lane needs (or the ship
command detects that `Workflow` is unavailable and fails loudly at L0 instead of degrading), and
`docs/upgrading.md` states the requirement beside the print-wait ceiling. Failing closed matters more
than the documentation: a lane that cannot start should stop the run, not quietly hand the work to an
improvising agent.

⟐ **FIXED 2026-08-12 — and the diagnosis above is WRONG in its central claim. Read this before
citing it.**

**What is false: "no permission string exists."** Measured by probing the permission layer instead
of concluding from denials, in the benchmark's own configuration (untrusted temp workspace, explicit
`--settings`, `--permission-mode acceptEdits`):

| `permissions.allow` contains | `Workflow` call |
|---|---|
| `Bash(node:*)` only — **the benchmark's actual settings** | **denied** — "Review dynamic workflow before running" |
| bare token `"Workflow"` | **allowed** — zero denials, script runs |
| `Workflow(<path>)` or `Workflow(<script>)` — scoped | **denied** |

So the tool was never ungrantable. **The benchmark's settings file simply never carried the entry**,
because `npx shapeup-sdlc init` writes Bash prefixes only. The defect is real and it is an
**installer** defect: the plugin never granted the permission its own only-lane needs, and nothing
said so. Six paid reps went to a missing line in an allowlist.

**What survives, and is why the fix is not that one line.** The grant **cannot be scoped** — only
the bare token works, which permits *every* dynamic workflow script in the project, including one a
model writes at runtime. A harness whose thesis is "gates the agent cannot talk its way past" should
not ask users for blanket dynamic-code execution.

**The fix as shipped:** the lane launches through `skills/tech-lead/scripts/run-workflow.mjs` as a
background Bash call (`SKILL.md` Step 2, `commands/ship.md`), executing the same Workflow-format
script under the **path-scoped** prefix `init` already writes — so every existing install can start
it with no new grant. It fails closed (`{"ok":false}`, exit non-zero, and the error is written to
the run dir where a background caller looks). `docs/upgrading.md` documents the one-line `"Workflow"`
grant as the alternative for anyone who wants the native runtime's resume and isolation, with the
scope trade-off stated.

---

### HD-008 — `gate-zerowork`'s "work by other means" swallows the case the gate exists for

**Filed:** 2026-08-12, from the same run (A7 candidate rep 1).

AGENTS.md states the invariant: *"a session that dispatched the orchestrator and left no receipt is
blocked at `Stop` by `hooks/gate-zerowork.mjs`"*, and names what it prevents — *"the orchestrator
describing its own pipeline in future tense and stopping — measured at 29% acceptance with 10 escaped
defects while reading like a clean run."*

**Measured, candidate rep 1.** `Skill(tech-lead)` was dispatched. No receipt was written. The hook
**allowed** the Stop:

```
gate-zerowork Stop null allow | 37 work calls — the session did work by other means
```

The escape hatch is doing exactly the opposite of the invariant: an orchestrator dispatch that
produced no run is *precisely* the case, and doing 37 unrelated edits is what a degraded session
looks like, not an exemption from the check. The run ended reading like a clean one.

**The fix this defect is filed for:** once the orchestrator has been dispatched, work-by-other-means
stops being an acquittal — the absence of a receipt is the finding. The `dispatchedOrchestrator`
branch and the work-call branch need to be ordered, not OR-ed.

⟐ **FIXED 2026-08-12.** The `work-done` fail-open is deleted outright rather than reordered, because
**both halves of its stated rationale fail on inspection**: a user running the harness steps by hand
starts with `init-run.mjs`, which writes the receipt, so that session already defers one branch
earlier at `receipt-present`; and a "pre-receipt version of the plugin" cannot be the thing executing
this hook, since `init-run.mjs` ships in the same install. No replacement escape was added — an
escape that cannot fire is the row-that-cannot-fail this project keeps catching. What keeps it safe
is not a threshold but the loop guard: `stop_hook_active` defers unconditionally, so a session that
genuinely worked outside the harness costs one extra turn and then stops.

The block message now also tells such a session *why* its work calls are the reason rather than a
waiver. Pinned by `tests/structural/10-run-receipt.mjs` — the assertion that used to read "defers
when the session did real work by other means" is **inverted in place**, same fixture, and
mutation-verified: restoring the escape turns it red.

The same commit gives the gate the **Bash-launch dispatch arm** it needs post-HD-007, so the shipped
lane is watched (`tests/structural/17-gate-zerowork-workflow.mjs`, both polarities, also
mutation-verified). Without it the two fixes would have cancelled: the new launch is itself a Bash
call, so under the old fail-open three launches with no run would have cleared the gate.

---

**Where a closed defect goes.** Its fix is pinned by a regression guard, and that guard is the
durable record — a defect whose test fires on reversion cannot come back silently, which is more
than a paragraph in this file could ever promise. HD-001…HD-005, the family in which *the committed
contract format fails silent*, closed 2026-08-04/05: pinned by structural §46(f)(g)(h)(i) for the
parser and §23 for the two call sites §46 does not reach, every one mutation-verified in both
directions. Those guards are the whole write-up that still matters: what the family cost is
recoverable from the tests that now fail on reversion, and nothing else needs to survive for the
fix to hold.

This file stays short on purpose. It is a queue, not an archive.
