# Phase 2 — remediation plan

## Goal

Close the defects `DIAGNOSIS-phase2.md` left open, in the order that lets each step be validated
before the next one is built. The through-line is D2: **nothing in the system attests which skill
produced an artifact**, so a run against a missing, disabled or wrong-version plugin reports phases
completing while none of the shipped craft was applied.

The deliverable is not "the fixes are written". It is criterion 1 of the phase's own acceptance line
— the baseline feature ships end-to-end on the native tool, interactive *and* headless, with both
traces archived.

## User review required

> [!IMPORTANT]
> Step 0 is a measurement, not a change. Its result decides whether Step 1 is buildable at all, so
> nothing else starts until it has run and its table is filled in below.

## Open questions

One, and it is the whole design's hinge — answered by Step 0, not by discussion:

**Do `PreToolUse` / `PostToolUse` hooks fire for tool calls made by a sub-agent?** Every dispatch in
this pipeline is a `Skill(...)` call made by a Workflow leg, never by the main session. If hooks do
not fire there, a receipt-based attestation cannot be written for exactly the dispatches that need
it, and an ingest that requires one would refuse every result in the run.

---

## Step 0 — measure the hook boundary (go/no-go)

No code. Load the working copy (`claude --plugin-dir .`), open a scratch run
(`harness init run --slug probe-hooks --intake-text "…"`), redirect the ledger
(`SHAPEUP_DECISIONS_PATH=<tmp>/decisions.jsonl`) so the live one stays clean, then have a **sub-agent**
make three `Skill(...) --order <path>` calls and read the ledger after each:

| # | Dispatch state | `PreToolUse` row? | `PostToolUse` row? | Can the row tell success from failure? |
|---|---|---|---|---|
| a | skill resolves, completes | | | |
| b | skill name unknown (`tool_use_error`) | | | |
| c | skill resolves, errors or is permission-denied | | | |

`PostToolUse` is not registered today (`hooks/hooks.json` has `SessionStart`, four `PreToolUse`
matchers and `Stop`), so probing it means adding a throwaway matcher that appends a row and nothing
else. `tests/structural/03-hooks.mjs:27` already lists `PostToolUse` among the valid event names, so
the manifest check accepts it.

**How the answer routes:**

- **`PostToolUse` fires in a sub-agent and (b)/(c) are distinguishable** — build Step 1 as written.
- **`PostToolUse` fires but (b)/(c) look like (a)** — the receipt must carry the outcome out of
  `tool_response`, not merely exist. Step 1 changes shape; the ingest check stays.
- **Neither fires for sub-agent calls** — **stop and re-plan.** Do not ship a receipt gate whose
  receipt can never be written. D2 stays open, recorded as open, and Step 2's canary becomes the
  only attestation available.

Record the filled table in this file before starting Step 1.

---

## Step 1 — make "the skill ran" a fact on disk (D2)

### Why not `PreToolUse` (the earlier draft of this plan)

`PreToolUse` fires *before* the tool runs, so it cannot separate "the Skill returned" from "the Skill
errored and the sub-agent improvised the craft itself" — which is the measured failure
(`DIAGNOSIS-phase2.md:62-87`). It appears to catch the observed instance only by coupling: the plugin
was not loaded, so `hooks/hooks.json` was not registered either, so no receipt. Once the plugin *is*
loaded — Step 4's whole point — a dispatch that errors still gets a `PreToolUse` receipt written
before it fails. The fix would expire exactly when the environment is repaired.
`DIAGNOSIS-phase2.md:151-153` says the same thing; this plan takes that branch.

### [NEW] `hooks/dispatch-receipt.mjs`

A `PostToolUse` hook, not an extension of `kernel/verify/envelope.mjs` — that file's hook mode is the
`PreToolUse` order gate and stays single-purpose, and a separate file can be executed against a
fixture the way `tests/structural/15-hook-receipts.mjs` executes every other hook.

- Parses `--order <path>` from the tool input with the same matcher
  (`kernel/verify/envelope.mjs:251-253`), and defers when there is none — a non-orchestrated Skill
  call is not this hook's business.
- Reads the order for `order_id` and `worker` (both required by `work-order.schema.json`) and the
  tool result for whether the dispatch actually completed.
- Writes `{order_id, worker_declared, skill_invoked, run_id, dispatch_ok, at}`.
- **Every write inside `try/catch`, and the hook never denies.** `hooks/lib/decision.mjs:45-47` is
  explicit that a receipt must never fail a tool call, and an unguarded `writeFileSync` in a hook body
  becomes `verdict:"error"` → exit 0 → the dispatch proceeds *without* a receipt, and the phase then
  dies at ingest instead.

### [MODIFY] `kernel/lib/paths.mjs`

Add `dispatchReceipts(cwd, slug)` → `.shapeup/<slug>/receipts/`. Not a sibling `orders/orient.json.receipt`:
`probe/resume.mjs:213`, `reduce/graph.mjs:117` and `report/export.mjs:102` all `readdirSync` the
orders directory, and today a stray file there is harmless only because all three happen to filter
`.json`. A receipt named `orient.receipt.json` would become a bogus `Order` node in the run graph.
Its own directory means no future reader has to know. (`receipt` is taken by the run receipt —
hence the distinct name.)

### [MODIFY] `hooks/hooks.json`

One `PostToolUse` entry, matcher `Skill|Agent`, timeout 10 — same shape as the existing four.

### [MODIFY] `kernel/reduce/ingest.mjs`

Refuse a result whose dispatch has no matching receipt — **scoped to orchestrated orders**:

- `--order` given, or an order file exists at the mirrored path of a positional result → resolve it.
- The order declares `mode: "orchestrated"` → require a receipt where `order_id` matches the result's,
  `skill_invoked === order.worker`, and `at >= order.compiled_at`. All three: a receipt that only has
  to *exist* is satisfied by a stale one from an earlier relaunch, and order paths like `orient.json`
  are stable across relaunches — the exact re-dispatch path `shapeup-run.js:425-434` describes.
- No order on disk, or `mode` is not orchestrated → skip the check. Standalone and fixture ingests
  keep working.
- `--no-receipt-check` as the escape. The receipt channel is best-effort by design; a load-bearing
  gate built on it needs a documented way through when the write fails for an environmental reason.

Note what this scoping buys: the three fixture ingests at `tests/structural/05-tech-lead.mjs:418,445,455`
write results into a temp tree with no `orders/`, so they stay green **without being weakened** — and
`:455-457`'s malformed-result assertion keeps failing for the schema reason it was written for,
rather than passing for a new one.

The earlier draft also made `--order` mandatory. Dropped: guard #16(g) already forbids a workflow
script aiming an ingest any other way, and the mandate would break the fixtures, the positional form
in `ARGV_SPEC.usage` (`kernel/reduce/ingest.mjs:285`), and the documented calls at
`docs/design/03-system-design.md:35` and `docs/design/workflow_architecture_design.md:192`.

### [MODIFY] `skills/tech-lead/workflows/shapeup-run.js`

Keep the prompt instruction, as belt-and-braces only — the receipt is the wall, this is not:

```diff
     `2. Dispatch the worker against that order:\n` +
     `     Skill(shapeup-sdlc-plugin:${skill}) --order <the path from step 1>\n` +
+    `   If the Skill dispatch fails or returns an error, STOP and report the error. Never work ` +
+    `around a failed dispatch by doing the craft yourself.\n` +
     `   ${extra}\n` +
```

### Guards (each verified by re-introducing the defect, then restoring the fix)

| Guard | Module | Catches |
|---|---|---|
| ingest refuses a receipt-less orchestrated order | `05-tech-lead.mjs` §22 | the D2 false green |
| ingest accepts one with a valid receipt | `05-tech-lead.mjs` §22 | a gate that refuses everything |
| a receipt whose `skill_invoked ≠ order.worker` is refused | `05-tech-lead.mjs` §22 | wrong-skill dispatch |
| a receipt older than `order.compiled_at` is refused | `05-tech-lead.mjs` §22 | a stale receipt across relaunch |
| the hook writes a receipt on a completed dispatch, none on a failed one | `03-hooks.mjs` | the hook itself |
| the hook leaves a decision row in all three payload states | `15-hook-receipts.mjs` | an inert hook |

---

## Step 2 — fail fast on an unresolvable worker roster (D2, cheap half)

The earlier draft checked `existsSync(<root>/skills/<name>/SKILL.md)` for eight hard-coded names.
Two problems, both fatal to its purpose:

- It answers *"are the files on disk"*, but D2's failure is *"can this session resolve
  `Skill(shapeup-sdlc-plugin:orient)`"*. In the session that produced D2 the files were sitting right
  there in the repo. It also passes green on the two states the diagnosis names — installed-but-disabled,
  and wrong-version-loaded: v1.6.3 has all eight `SKILL.md` files.
- Eight names hard-coded beside a ten-member enum (`domain.schema.json#/$defs/WorkerName`, which
  includes `translator` and `coach`) is the drift CLAUDE.md exists to prevent — a list that reads
  perfectly and is wrong.

### [NEW] `kernel/verify/skills.mjs`

- **Roster derived, never spelled**: read `WorkerName` from `domain.schema.json`, narrowed to the
  workers this run will actually dispatch via the operation→worker table `kernel/compile.mjs:461`
  already owns (export it so there is one table, not two).
- **Root derived from the module's own location** — `resolve(HERE, "../..")`, the precedent at
  `kernel/verify/envelope.mjs:31` — with `--plugin-root <dir>` for fixtures. Not
  `process.env.CLAUDE_PLUGIN_ROOT`: env is not reliably exported into a sub-agent's Bash shell, and
  the kernel that is executing is already inside the plugin root.
- **Prints the resolved root and the version it found** (`<root>/.claude-plugin/plugin.json`), so a
  wrong-version run is visible in the trace instead of silently green.
- Exits non-zero naming the missing worker(s).

### [MODIFY] `kernel/harness.mjs`

Add `skills: "./verify/skills.mjs"` to the `verify` routes table (`kernel/harness.mjs:49-52`).

### [MODIFY] `kernel/init/run.mjs`

Call it there, refusing with **exit 3** (`init run` refused to open). That is what GATE L0 actually
executes, it covers both lanes rather than only the workflow one, and it is genuinely before any
spend — the earlier draft's call site in `shapeup-run.js` runs through `cmd()`, which spawns a Sonnet
sub-agent first, and names a gate (`L0`) that script does not have (its gates start at L1a;
`shapeup-run.js:91` aborts under `"args"`).

Record the resolved plugin root and version in the run receipt while it is in hand, so every run's
trace says which copy of the plugin produced it.

**Say plainly what this check can and cannot do.** It proves *these files exist at this root at this
version*. It cannot prove the session will resolve that copy — only a live dispatch does that, which
is Step 1's mechanism used as a preflight. If Step 0 comes back green, add a canary: L0 dispatches one
trivial `Skill(...) --order` call and requires its receipt. Then Steps 1 and 2 are one mechanism
instead of two.

### Guards

| Guard | Module | Catches |
|---|---|---|
| `verify skills` is routed and runs | `13-argv-contract.mjs` / `14-invocation-paths.mjs` | an unrouted verb |
| exits non-zero against a fixture root with a worker removed | new checks in `03-hooks.mjs` or §22 | the check being inert |
| its roster matches `WorkerName`, not a literal list | `50-payload-contract-parity.mjs` | roster drift |

Fixture-based, with `--plugin-root <tmpdir>`. The earlier draft's "rename a skill folder by hand"
mutates the plugin under test and is not repeatable.

---

## Step 3 — the baseline feature (already in the repo)

The earlier draft proposed a new `examples/it-jobs-researcher` — a CLI researching Vietnamese IT jobs
and real estate. Dropped: it needs live network access, in a repo whose load-bearing rule is zero
network, and it would have shipped without the expected outcome the diagnosis asks for
(`DIAGNOSIS-phase2.md:160-163`), leaving Phase 7's G6 comparison with nothing to compare against.

**Use `examples/todo-cli`.** It already is the thing being asked for:

| File | Role |
|---|---|
| `idea.md` | the committed pitch — non-UI, explicitly one short round |
| `EXPECTED.md` | the expected outcome, as checkable assertions (doc tree + Test Surface, cited-evidence verdict, edge cases) |
| `todo.contract.json` + `reference/todo.js` | an oracle that grades the built result, with a reference impl that must PASS and a broken one that must FAIL |

It is also already the worked example in `docs/quickstart.md:4,31,139`, so the baseline and the
front-door tutorial stay the same artifact.

Two small tasks, since this promotes `EXPECTED.md` to the acceptance contract:

- `EXPECTED.md:7` cites `docs/audit/independent-audit-and-evolution-plan.md` and "Stage G".
  `docs/audit/` does not exist. Repoint or trim — an acceptance contract citing a dead path is the
  same defect class this phase is closing.
- State where the run executes. `.shapeup/` is gitignored repo-wide, but the *implementation* the
  workers write is not; run it in a scratch checkout, not in the plugin tree.

---

## Step 4 — stand up a real lane

This is an **environment** action, not a docs edit — blocker #2 of `DIAGNOSIS-phase2.md:129-131`.
Nothing in Steps 1–3 can be validated without it.

- Load the working copy (`claude --plugin-dir .`) or install 2.0.0 from the marketplace; confirm
  `Skill(shapeup-sdlc-plugin:orient)` resolves before spending a run on it.
- Drive it the way `SKILL.md` does: `harness init run` first (the receipt mints the `run_id`; without
  it every `setRunStatus` fails with exit 3), then the `Workflow` launch.

**No changes to `commands/build.md` or `commands/ship.md`.** The earlier draft proposed replacing
their launch block with `harness init run` + `Skill(…:tech-lead)`. Those files were already fixed
under D5 (guard #43): `build.md:22-27` carries the `Workflow({scriptPath…})` launch and `build.md:29`
already says "`harness init run` first, so the receipt exists". The proposed edit would delete the
Workflow launch from the shipped docs — undoing the v2 cutover in the one place a user reads it.

---

## Step 5 — run criterion 1 twice, keep both traces

Interactive (gates pause and are answered) **and** headless (`--unattended`, `preset:ci`). Archive
both `.shapeup/` trees. One lane is not the criterion — the earlier draft ran headless only and would
have left Phase 2 open while reading as complete.

---

## Step 6 — record the LOC descope

Criterion 3 (net-negative ≥1,500 LOC) is descoped, not met: the target was written against a Phase 2
that would also delete the scripts, and Phase 1 had already moved them; the phase-2 commit measures
−530. Write that down, with the reason, in `RESULT-v2.md`. "Considered resolved without code changes"
is not a record, and re-measuring across Phases 1–2 to reach the number would be manufacturing a
measurement to fit a bar.

---

## Verification plan

### Automated

`npm test` (→ `node tests/structural.mjs`; there is no `tests/structural/_run.mjs`), green, with the
new guards from Steps 1 and 2 included and each verified by re-introducing its defect. Plus
`claude plugin validate . --strict` and `npm run demo`, run *before* editing as well as after — a
suite that has not been run is an assumption, not a baseline.

### Manual

1. Step 0's table, filled in from executed probes.
2. A run on `examples/todo-cli` with a worker skill removed from a fixture plugin root → `init run`
   refuses with exit 3, naming the worker.
3. A run where a dispatch is made to fail (unknown skill, or the Skill call denied) → the leg produces
   no receipt and `reduce ingest` refuses the result, instead of the phase reading as complete. **This
   is the only test that closes D2**; everything else in Step 1 is machinery for it.
4. Criterion 1, both lanes, both `.shapeup/` trees archived, graded against
   `examples/todo-cli/EXPECTED.md`.

### Done when

Steps 0–6 complete, `npm test` green, and criterion 1 demonstrated in both lanes with the traces
kept. Criterion 2 is already met. Criterion 3 is recorded as descoped, not claimed.
