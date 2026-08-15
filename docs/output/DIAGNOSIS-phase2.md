# Phase 2 — diagnosis, and the way to close it

Every finding below was produced by executing the pipeline, not by reading it. Phase 2 has been
"complete" in the git history since `4bd9592`; it has never once run.

## Verdict against the plan's own acceptance line

> **Done when:** the baseline feature ships end-to-end on the native tool, interactive and headless
> (`--unattended` with `preset:ci`); repo contains zero `claude -p` spawns; diff is net-negative
> ≥1,500 LOC.

| # | Criterion | Status | Measured |
|---|---|---|---|
| 1 | Ships end-to-end, interactive **and** headless | **NOT MET** | Furthest reached: aborted at ANALYZE. No run has ever passed phase 2 of 9. |
| 2 | Zero `claude -p` spawns | **MET** | Only `tests/grant/executing-grant.mjs`, which spawns real CLI sessions on purpose. |
| 3 | Diff net-negative ≥1,500 LOC | **NOT MET** | Phase-2 commit is **−530** (711 added, 1,241 deleted). |

## Root cause

Phase 2 swapped the substrate — hand-rolled runtime out, native `Workflow` in — and deleted the
courier layer. What it did not do is re-validate the **contracts on either side of the new
boundary**. Every defect below is one instance of a single architectural failure:

> The control script and the kernel each kept their own idea of a shared contract, and nothing ever
> executed the pair together. A static suite of 900+ checks confirmed both halves in isolation.

That is why the count of green checks kept rising while the pipeline could not take its first step.

## The defects

### D0 · The orchestrator could not load — CRITICAL, fixed

`meta.description` was three literals joined with `+`. The runtime parses `meta` statically and
refuses the file whole: `meta must be a pure literal: non-literal node type in meta:
BinaryExpression`. Inherited verbatim from the review's draft, which has the same concatenation — so
neither file was ever runnable. Guard: **#16 (f)**.

### D1 · Four of seven operations could not compile a WorkOrder — CRITICAL, fixed

`probe resume` answers `null` for context it does not know yet; `WorkOrderPayload` types those
fields `string` and marks every one **optional**. The contract already models unknown as an *absent
key*; the script forwarded the `null`.

```
OPERATION    BEFORE   AFTER
orient       FAIL     OK     ✗ $.payload.stack:   expected string, got null
analyze      FAIL     OK     ✗ $.payload.lens:    expected string, got null
evaluate     FAIL     OK     ✗ $.payload.run_cmd: expected string, got null
hunt         FAIL     OK     ✗ $.payload.app_url: expected string, got null
wire         OK       OK
map-scopes   OK       OK
hammer       OK       OK
```

ORIENT is the first dispatch of every fresh run, so **no fresh run could ever start**. The three
operations carrying no nullable field always compiled, which made a total failure look intermittent.

Fixed by omitting null/undefined keys before compiling (`compact()`). Widening the schema would have
been the wrong direction — it would make `"stack": null` a valid order and push the null downstream
into every worker's prompt. Guard: **#16 (h)**.

### D2 · A failed Skill dispatch is indistinguishable from a successful one — CRITICAL, **open**

The most serious finding, and the only one still open. Measured live:

```
Skill(shapeup-sdlc-plugin:orient)  ->  <tool_use_error>Unknown skill</tool_use_error>
Skill(orient)                      ->  <tool_use_error>Unknown skill</tool_use_error>
```

The worker skill never ran. The sub-agent then **did the craft itself** from the `extra` prose in
its prompt, and everything downstream accepted it:

- all four orient artifacts written to `.shapeup/<slug>/orient/`
- `results/orient.json` written and ingested
- leg returned `{ok: true, artifact_written: true}` with a genuine-looking spike result
- `requirePhase("ORIENT", "orient")` **passed** — the artifacts are on disk
- the run advanced to ANALYZE

Both walls fired correctly and neither could help: `harness verify envelope` validates the *order*,
`sandbox-guard` validates *where writes land* — and improvised writes landed in exactly the right
place. Nothing in the system attests **which skill produced an artifact**.

This is worse than a failure; it is a **false green**. It defeats "measured, not claimed" at the
root, because the measurement is "is the artifact on disk", and that cannot distinguish
skill-produced from improvised. A run against a missing, disabled, or wrong-version plugin will
report phases completing while none of the shipped craft is applied.

### D3 · An ingest aimed by a claimed path — HIGH, fixed

`resultFor()` was deleted with the courier layer, and the ingest call moved from script code into
the prompt: `reduce ingest <the result path the worker wrote>`. That is exactly the defect test #16
check (e) exists to forbid, relocated into prose one layer below the regex that guards it. The repo
had already measured its cost: a worker that had done its whole job reported a directory, ingest got
EISDIR, and the phase was discarded.

Fixed by teaching the kernel the pairing it already owns — `reduce ingest --order <order.json>`
derives `orders/X.json → results/X.json` itself. The caller names the order, which is the thing it
already holds and cannot get wrong. Guard: **#16 (g)**.

### D4 · A status write that failed on every run — MEDIUM, fixed

`setRunStatus("analyzing")` against `RUN_STATUSES = orienting | mapping | building | evaluating |
shipped | escalated`. Rejected with exit 2 on every run since the cutover; the string "analyzing"
appears nowhere in the kernel. Advisory, so nothing stopped — the ledger simply under-reported the
phase, and the only trace was a line in a warnings array nobody read. Fixed to `"mapping"`, the
coarse value covering ANALYZE→MAP SCOPES. Guard: **#16 (i)**, which reads the enum from the module
that defines it.

### D5 · Two shipped commands documented a launch that cannot work — HIGH, fixed

`commands/build.md` and `commands/ship.md` both said `node "…/harness.mjs" run "…/shapeup-run.js"
--args-file … --run-dir …`. The kernel has no `run` verb; the documented front door to a whole
feature build exits 2 on `unknown_verb`. Test #43 already asserted "the verb named is one the
routing table actually routes" — it was scanning `skills/` and not `commands/`. Guard: **#43**,
census widened.

## What is now proven, and what is still blocked

Proven by execution after the fixes: the script loads; it spawns real sub-agents through its own
helpers; it fast-forwards past completed phases from artifacts on disk; gates resolve by the
kernel's exit code (4 → `paused`); ORIENT compiles a schema-valid order in a live leg; the
post-condition correctly aborts a phase that produced no artifact.

Still blocking criterion 1, in the order they must be cleared:

1. **D2 has no fix yet.** Until a dispatch can be shown to have run the skill, an "end-to-end ship"
   proves nothing — a green run is consistent with zero worker craft having been applied.
2. **No environment has the v2 plugin loaded.** Installed copies are v1.6.3 and v1.7.0, all three
   `✘ disabled`. `Skill(shapeup-sdlc-plugin:<worker>)` cannot resolve from this session at all.
3. **`harness init run` must precede the launch.** SKILL.md does this; a bare `Workflow(...)` does
   not, and without the receipt every `setRunStatus` fails with exit 3.
4. **There is no baseline feature.** Phase 0 called for an archived baseline run; what exists is a
   structural baseline (line counts, inventories), so criterion 1 has nothing to ship and nothing to
   compare against.

## The way to close it

**Step 1 — fail fast instead of failing silently (D2, cheap half).**
Add `harness verify skills` and call it at GATE L0, before any spend: resolve every worker skill the
run will dispatch, and refuse the run with a named exit if one is missing. This converts the exact
failure observed — plugin absent, disabled, or the wrong version — from "a run that reports success
having done nothing" into "a run that will not start, and says why".

**Step 2 — make "a skill ran" a fact on disk (D2, the real fix).**
The `Skill|Agent` PreToolUse hook already fires with the order path in hand, and the hooks already
write receipts (`hooks/lib/decision.mjs`). Have that hook record a dispatch receipt keyed by
`order_id`, and have `reduce ingest` refuse a result whose order carries no matching receipt. That
puts the attestation on a wall — hooks work under every permission mode — rather than in a prompt,
which is the repo's own stated doctrine for anything load-bearing. Pair it with an explicit
instruction in `worker()` that a Skill error is reported, never worked around; and if the
distinction between "dispatch attempted" and "skill completed" needs to be tight, record the
completion from `PostToolUse` rather than the attempt from `PreToolUse`.

**Step 3 — stand up a real lane.**
Enable the v2 plugin (`claude --plugin-dir .` for the working copy, or install 2.0.0 from the
marketplace), then drive a run the way SKILL.md does: `harness init run` first, then the `Workflow`
launch.

**Step 4 — build the baseline feature fixture.**
Pick one of `examples/` as the standing feature, with a committed pitch and an expected outcome.
Criterion 1 needs something concrete to ship, and Phase 7's G6 needs something to compare.

**Step 5 — run criterion 1 twice, and keep both traces.**
Interactive (gates pause and are answered) and headless (`--unattended`, `preset:ci`). Archive both
`.shapeup/` trees. Only then is Phase 2 done.

**Step 6 — settle criterion 3 honestly.**
The −1,500 LOC target was written against a Phase-2 that would also delete the scripts; Phase 1 had
already moved them. Either re-measure it across Phases 1–2 together, or record it as descoped with
the reason. Do not restate the −530 as though it met the bar.

## Guards added this pass

Each was verified the only way a check can be — by re-introducing the original defect and confirming
the suite goes red, then restoring the fix.

| Guard | Catches |
|---|---|
| #16 (f) | a workflow script whose `meta` is not a pure literal — the file the runtime will refuse |
| #16 (g) | an ingest aimed by anything other than `--order` |
| #16 (h) | a payload forwarded to `compile` without stripping nulls |
| #16 (i) | a run status the kernel's enum does not accept |
| #43 | a kernel verb cited anywhere in `commands/` that the routing table does not route |

Suite: 918 checks, green.
