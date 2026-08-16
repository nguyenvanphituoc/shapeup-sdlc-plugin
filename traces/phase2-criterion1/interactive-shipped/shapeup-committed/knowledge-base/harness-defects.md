# Harness defects — Betting Table raw ideas

Mechanism defects found while running the harness. Per AGENTS.md these are **raw ideas for the
Betting Table**, never worker steering: nothing here is a rule a skill should read, and no entry
belongs in a per-skill `knowledge-base/<skill>.md`. A defect is filed here so the PO can bet on
fixing it — the run that found it works around it and says so.

---

## HD-004 — `crossGate` branches on a model's prose, so QA never runs and L3 `stop` is inert

**Found:** 2026-08-16, run `todo-cli-20260816T084725Z-ddb6d292`, at GATE H.
**Severity:** silently disables an entire documented phase, in every lane, with no error anywhere.

### What happens

```js
async function crossGate(gateId, phaseName, validDecisions, ctx) {
  const g = await cmd(`gate --resolve ${gateId} …`, phaseName, `gate:${gateId}`);
  if (g.exit_code === 4) return { stop: paused(...) };
  if (g.exit_code === 5) return { stop: aborted(...) };
  return { decision: g.detail || "proceed" };     // ← g.detail is model-written free text
}
```

`cmd()` dispatches a sub-agent and asks it for *"one line of detail"*. What comes back is a
sentence — `"Command exited 0; gate QA resolved decision=run from .shapeup/todo-cli/
gate-answers.json."` — while the comment above the gate section asserts *"The resolved decision
string travels in `detail`."* Both cannot be true, so every token comparison downstream fails:

```js
const qaRan = !args.noQa && qaG.decision === "run";        // sentence === "run" → false, always
if (g3.decision === "stop" || round >= maxRounds) { … }    // sentence === "stop" → false, always
```

### Consequences observed

- **QA never dispatched.** The PO answered `run`; the kernel resolved `run`, exit 0; `qaRan` was
  false; the hunt was skipped with no log line, no warning, no artifact. Caught only because
  `scope-hammer` reports its own inputs honestly — *"no `hunt-report.md` exists on disk anywhere …
  H0.2 is empty by construction"* — rather than treating `qa_findings: 0` as a clean bill of health.
- **A PO cannot stop the loop early.** On a FAIL, answering `stop` at L3 is ignored; only
  `round >= maxRounds` ends it.

It violates the file's own header: *"CONTROL … owns NO I/O … **Nothing in this file reads a model's
prose.**"* `crossGate` is the one place that does, and every gate decision lands there.

### Fixes (not applied)

1. Add a `decision` field to `cmd()`'s `CMD` schema that the sub-agent must fill verbatim from the
   kernel's output, and read that instead of `detail`.
2. Better — stop routing a machine value through an agent at all. `harness gate --resolve` already
   emits JSON with a `decision` key; this is exactly the deterministic step the CONTROL plane is
   not supposed to delegate to a model.
3. Throw when `decision` is not in `validDecisions`. Any of the three turns a silent skip into a
   first-run error.

### Second, independent block on the same phase — QA is unreachable for non-UI deliverables

Even fixed, QA could not have run. The payload is `{feature, spec_folder, app_url: rs.app_url,
round}`, `rs.app_url` is `null` for a CLI, and the order schema demands a string:

```
✗ $.payload.app_url: expected string, got null
```

State this loudly next to the intake, which opens: *"so we can exercise the harness end-to-end on a
non-UI deliverable (no browser, no Playwright)."* The first genuinely non-UI run found that QA had
never been exercised without a URL. Make `app_url` nullable and add a non-UI fixture.

### Two smaller siblings found alongside

- **A paused L3 costs a whole extra round.** The fast-forward derives the round from
  `eval_rounds_done` but never reads the previous round's *verdict*, so relaunching after a PASS at
  L3 rebuilt and re-evaluated an already-green board. It passed again, but it consumed round 2 of 2
  and left no outer budget had anything gone wrong.
- **A `hammer` order can never be ingested.** `scope-hammer`'s substrate allows only
  `shapeup/<slug>/REPORT.md` and `.shapeup/<slug>/reports/**`, so it cannot write
  `results/hammer.json` — yet the envelope port's rule is "every dispatch is WorkOrder in /
  WorkResult out". The order therefore stays in `orders/` forever, and `pending_orders` is
  permanently non-empty, which is exactly the signal the relaunch protocol asks the orchestrator to
  check before continuing. Same shape for `evaluate.json`, whose result is written as
  `evaluate-r<N>.json` and so never matches its order name.

### How this run worked around it

PO chose to run QA properly rather than ship without it. The hunt order was compiled by hand
(`--operation hunt`, `app_url` omitted), dispatched to `qa-edge-hunter`, ingested (10 findings), and
the `scope-hammer` census re-run against the real output before GATE H was answered. Four findings
were then promoted and fixed in round 3.

---

## HD-003 — `coerce()` unquotes without unescaping, so T0 fails correct builds

**Found:** 2026-08-16, run `todo-cli-20260816T084725Z-ddb6d292`, at GATE L2 (round 1).
**Severity:** the highest of the three. T0 is the mechanical evidence the whole "never
self-reported" invariant rests on, and this makes it report red against a correct implementation.

### What happened

`scope-cli-core` burned 4 of 5 attempts and was queued for the hammer with
`fixtures_passed: 1/7` on every trial. The implementation was **correct the whole time**. Driven
by hand, every command produced exactly the specified stdout and exit code; extracted properly and
run in a shell, all 7 fixtures passed.

### Cause

`kernel/lib/contract.mjs`'s `coerce()` ends with:

```js
const v = trimmed.replace(/^["']|["']$/g, "");
```

It strips one leading and one trailing quote and performs **no unescaping**. A fixture written to
disk as a quoted scalar with escaped inner quotes therefore comes back with the backslashes still
in it, and is handed to `bash` as a syntax error:

```
on disk   : "bash -c 'export TODO_STORE=\"$T/s.json\"; …'"
coerce()  :  bash -c 'export TODO_STORE=\"$T/s.json\"; …'      ← literal backslashes → exit 2
JSON.parse:  bash -c 'export TODO_STORE="$T/s.json"; …'        ← what bash needs
```

The round-trip is broken inside the library itself — `coerce(uncoerce(x)) !== x` for any value
containing a quote; `uncoerce` adds no quoting and `coerce` then eats the value's own last
character.

### Why the failure was so misleading

- **1 of 7 fixtures "passed" — accidentally.** Fixture #1 only asserts non-zero exits and the
  absence of a traceback, so it survives a corrupted `$TODO_STORE` and reports green. A weak
  fixture masked the fact that the harness had broken all of them.
- **The scope that had no business passing first, passed first.** `scope-integration-test`
  (build_order 6, depends on everything) went green while `scope-cli-core` (build_order 1) failed,
  purely because its fixture — `python3 -m unittest discover …` — contains only single quotes and
  so was untouched by the defect. That inversion is the smell worth teaching: it is what sent this
  investigation to the fixtures rather than to the code.
- **The build looked flaky, not blocked.** Attempts 2 and 3 were scored `reverted` for "no
  progress" against a score that could not move, and the stagnation term then ended the scope
  early. A defect in the reader is indistinguishable, from the outside, from a builder that cannot
  make progress.

### Candidate fixes (not applied)

1. Parse a quoted scalar with `JSON.parse` when it is valid JSON, falling back to the current
   strip. Fixes read and makes the round-trip testable.
2. Have `uncoerce` and `coerce` agree on one escaping convention and add a property test asserting
   `coerce(uncoerce(x)) === x` over values containing quotes, backslashes and newlines.
3. Stop putting shell one-liners in a quoted scalar — give `e2e_verification_fixtures` a block form
   (fenced or indented) where no escaping is needed at all. Removes the class rather than the bug.

Whichever is chosen, a fixture containing a double quote belongs in the test corpus — the current
suite has none, which is why a defect this central shipped.

### How this run worked around it

PO reviewed at GATE L2. The 7 fixtures were re-emitted with their inner quotes unescaped (the form
`coerce()` reads correctly), generated mechanically from the `JSON.parse` ground truth rather than
retyped, verified in the scratchpad, then installed and re-verified in place. `harness verify t0`
was then re-run and produced **green, 7/7, `kept`, delta +6 fixtures** — from its own evidence, so
the "hill phase is mechanical, never self-reported" invariant is intact. The working tree was
backed up first, because a red T0 verdict restores the last kept snapshot.

---

## HD-002 — GATE L1b's lint passes scope contracts that `compile` categorically refuses

**Found:** 2026-08-16, run `todo-cli-20260816T084725Z-ddb6d292`, at BUILD (first dispatch attempt).
**Severity:** the highest-value gate in the Building phase can sign off a plan that cannot build.

### What happened

`harness verify spec --slug todo-cli` returned `{"scopes":2,"tasks":7,"red":0,"warn":0,"findings":[]}`.
On that basis the PO accepted the board at GATE L1b. BUILD then dispatched **nothing at all** —
both scopes failed at step 1:

```
compile-order: produced an order that fails its own schema — refusing to write:
  ✗ $.payload.scope_contract.affordance_manifest[0..6].required_states: expected array, got string
```

Both scopes returned `green: false, attempts_used: 0, breaker: "none"`. Not one `task-executor`
ran; the per-scope attempt budget of 5 was never touched.

### Two distinct defects, and the second is the one to bet on

**(a) `scope-architect` emitted an unparseable Affordances table.** `contract.mjs`'s `coerce()`
makes a list only from a bracketed value — the rule its own docstring states, applied identically
to frontmatter and table cells. The contract was written with bare prose:

```
| cli:todo-add | cli-command | success, error |      → "success, error"   (string)  ✗
| cli:todo-add | cli-command | [success, error] |    → ["success","error"] (array)  ✓
```

Notably the *same skill* got it right in the frontmatter — `allowed_file_substrate` parses as a
proper array — so this is an inconsistency inside one writer, not ignorance of the convention. A
fix belongs in `scope-architect`'s template/examples for the Affordances table.

**(b) The gate lint and the compiler validate against different things.** This is the real bet.
`verify spec` is what a PO's L1b sign-off rests on, and it reported zero findings for contracts
that `compile` rejects outright on every row. Whatever `verify spec` checks, it does not include
"would this contract survive `compile`'s schema validation" — the one property that decides
whether the plan can execute at all. The cheapest correct fix is for `verify spec` to dry-run the
same order compilation per scope and surface a failure as **red**, so an uncompilable contract
can never reach a gate green.

Until (b) is fixed, (a) is only the instance that happened to be found. Any other malformed cell
in any contract fails the same way, at the same place, after the PO has already signed off.

### How this run worked around it

PO chose the out-of-band fix at the GATE-H-return decision point: nine `required_states` cells
(7 in `scope-cli-core`, 2 in `scope-integration-test`) wrapped in brackets by the tech lead
through the hooked `Edit` tool — a pure syntax change with no authored content, chosen over
re-dispatching `map-scopes` because re-running the slicing skill risked producing a different cut
than the one already accepted at L1b. Verified by compiling both scopes successfully before
resuming. The two probe orders were deleted afterwards so the relaunch saw a clean order state.

### Related, and worth reading with HD-001

The blocked worker also reported `scopes/scope-cli-core.md is frozen by todo-cli/wire`. `wire` had
already completed *and* been ingested — this is HD-001's stale-`active-order`-pointer bet biting a
second time, in a different phase. Two independent workarounds in one run traced to that one line.

### A reporting inaccuracy, filed but not fixed

The run returned `{"status":"gate_h","breaker":"inner"}` while both scope records said
`breaker: "none"` with `attempts_used: 0`. "Inner breaker tripped" and "no attempt was ever made"
are different events with different correct responses — the first says the work is harder than
budgeted and should go to a hammer census; the second says the harness is broken and a census
would ship nothing while implying the scopes were tried and found wanting. `shapeup-run.js` should
distinguish a scope that exhausted its attempts from one that never compiled.

---

## HD-001 — `append_only` substrate globs are structurally unsatisfiable

**Found:** 2026-08-16, run `todo-cli-20260816T084725Z-ddb6d292`, at GATE L1a.5.
**Severity:** blocks an entire operation class. `reconcile` and `retrofit-surface` cannot write
anything, on any project, ever.

### What happens

`kernel/compile.mjs` `substrateFor()` emits `append_only` globs carrying a markdown section
anchor:

```js
case "reconcile":
  return {
    allowed: [`${local}/tasks/**`, `${spec}/scope-summary.md`, `${working}/**`],
    append_only: [`${spec}/usecases/*.md#Invariants`, `${spec}/usecases/*.md#Test Surface`],
    frozen: FROZEN_SPEC_CORE,
  };
case "retrofit-surface":
  return { allowed: [], append_only: [`${spec}/usecases/*.md#Test Surface`], frozen: FROZEN_SPEC_CORE };
```

`hooks/sandbox-guard.mjs` matches those globs against the Edit tool's real `file_path`, which
never carries a `#fragment`. `globToRegExp()` has no case for `#`, so it falls through to the
literal branch and the anchor becomes part of an `^…$`-anchored pattern:

```
glob:    shapeup/todo-cli/spec/usecases/*.md#Invariants
regex:   /^shapeup\/todo-cli\/spec\/usecases\/[^/]*\.md#Invariants$/
path:    shapeup/todo-cli/spec/usecases/UC-AddTodo.md
matches: false          ← same glob without "#Invariants": true
```

The path then falls past `allowed` and past `appendOnly` to the final branch and is denied with
`"outside every live order's allowed scopes"` — a message that describes a scope error, not the
unsatisfiable-pattern bug that actually occurred, which is what makes this expensive to diagnose.

### Why it stayed invisible

`tests/structural/03-hooks.mjs`'s passing `append_only` fixture uses a **bare file path with no
`#section` suffix**. The test therefore exercises a shape the compiler never emits. The hook is
green and the compiler is green; only their composition is broken.

### Candidate fixes (for the Betting Table to choose between — not applied)

1. Strip the fragment at match time — `globToRegExp(g.split("#")[0])` in `matchesAny`. Smallest
   diff, but it silently discards the section information rather than enforcing it.
2. Stop emitting anchors in `compile.mjs` and express append-only at file granularity. Honest
   about what the guard can actually enforce (Edit vs Write), at the cost of the declared intent
   that a reconcile touches only two sections.
3. Enforce the anchor for real: have the guard diff the Edit's `old_string`/`new_string` against
   the named section. Strongest guarantee, materially more work.

A fix should also add a test fixture whose glob carries an anchor, or the same gap reopens.

### Related: the active-order pointer never retires

Surfaced while working around the above. `hooks/sandbox-guard.mjs`'s `liveOrders()` puts the
pointer order into the live set unconditionally:

```js
const paths = new Set(existsSync(pointerOrder) ? [pointerOrder] : []);
```

Every other order is filtered by `!done.has(f)`, but the pointer order is exempt. `.shapeup/
active-order` is written only by `compile` and cleared by nothing — `reduce ingest` does not
retire it. So a finished, ingested order keeps its substrate enforced over the whole project
until some later `compile` happens to overwrite the pointer. On this run that meant an order that
had a result on disk *and* had been successfully ingested was still fencing every write in the
repo. Probably one line (`if (!done.has(basename(pointerOrder)))`), but it is a separate bet.

### How this run worked around it

GATE L1a.5's PO chose "apply out-of-band + file the defect". The `ba-pitch-analyzer` dispatch
escalated correctly — it refused to `sed` around the guard and refused to widen its own
substrate, and preserved the full drafted `[INV-05]` and `TS-INV-05` text in `deviations[]`. The
result was ingested (attested: `todo-cli/reconcile ran ba-pitch-analyzer`), the stale pointer was
moved aside, and the tech lead transcribed ba's drafted text verbatim into
`spec/usecases/UC-AddTodo.md`. Authorship is ba's; the mechanical write is the tech lead's. See
`.shapeup/todo-cli/harness-run.md` → "Test Surface gap closed at GATE L1a.5".
