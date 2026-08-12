# HD-007 / HD-008 fix — what shipped, and the two claims that died on the way

**Date:** 2026-08-12 · **Follows:** `hd007-control-plane-probe.md` · **Branch:** `feat/workflow-orchestrator`
**Instruments at the end:** `npm test` **1370 checks** green (from 1363) · `contract-check.mjs`
**23 PASS / 0 RED — GATE MET** · bench `npm test` exit 0.

This was scoped as four steps before a paid A7 re-run: ship the launch surface, close HD-008, make
the benchmark able to see the lane, then two cheap proofs. Steps 1–3 shipped and are green. **Step 4
refuted two things this plan rested on, one of them its own premise**, and the second refutation is
a defect larger than the one being fixed. Read §4 before relying on any of §1.

---

## 1 — The launch surface ships (step 1)

`tools/control-plane/cp-run.mjs` (prototype, `tools/` is not in the npm `files` set) is now
`skills/tech-lead/scripts/run-workflow.mjs`, which ships. The directory is the point, not the
filing: `init`'s grant is a prefix rule over `skills/<owner>/scripts/`, so the launcher needed no
new permission string — *as designed*; §4.2 is why that reasoning does not survive.

| change | file |
|---|---|
| launcher, with a typed argv boundary (exit 2 before any spawn or mkdir) | `skills/tech-lead/scripts/run-workflow.mjs` |
| Step 2 launches by background Bash, not the `Workflow` tool | `skills/tech-lead/SKILL.md` (135 lines, ratchet ceiling 155) |
| same launch, both commands | `commands/ship.md`, `commands/build.md` |
| the headless requirements, both of them | `docs/upgrading.md`, `CHANGELOG.md` |
| probes become fixtures | `tests/fixtures/workflow-run/` |

Two contracts it had to join on arrival, both enforced by existing suites rather than by review:
`ARGV_SPEC` + `runArgs` (`13-argv-contract.mjs` executes every entry point with malformed flags and
asserts exit 2 with nothing written), and `isMain` (`11-is-main.mjs`). Verified:

```
$ node skills/tech-lead/scripts/run-workflow.mjs --max-concurrency
{"error":"missing_value","flag":"--max-concurrency","expected":"int in [1, 32]"}   exit 2
```

**`16-workflows.mjs` had to move with the launch, and nearly reported the opposite.** Its
reachability check knew one spelling, `scriptPath:` — against the new SKILL.md it printed *"launches
no workflow script at all — the Workflow dispatch surface is gone"*, i.e. a deletion, at the moment
the launcher moved. It now recognises both spellings and still fails in both directions.

## 2 — HD-008 closed (step 2)

The `work_calls > 2` fail-open is **deleted**, not reordered. Both halves of its stated rationale
fail on inspection: a user running the harness by hand starts with `init-run.mjs`, which writes the
receipt, so that session already deferred one branch earlier; and a "pre-receipt plugin" cannot be
the thing executing this hook, since `init-run.mjs` ships in the same install. No replacement escape
was added — an escape that cannot fire is the row-that-cannot-fail this branch keeps catching. The
loop guard (`stop_hook_active`) is what keeps it safe: one nudge, never a hang.

The gate also gained the **Bash-launch dispatch arm**. Without it the two fixes would have
cancelled: the new launch is itself a Bash call, so under the old fail-open three launches with no
run would have cleared the gate.

**Mutation-verified, both arms** — the repo's discipline for a check that must be real rather than
present:

| mutation | result |
|---|---|
| restore the `work_calls > 2` escape | `10-run-receipt.mjs` **RED** ×2 — "HD-008's escape is back" |
| delete the Bash arm from `launchedShapeupWorkflow` | `17-gate-zerowork-workflow.mjs` **RED** ×2 |
| both reverted | 1370 green |

`10-run-receipt.mjs`'s assertion is **inverted in place** — same fixture, opposite expectation — so
the record shows what the gate used to believe.

## 3 — The benchmark can now see the lane (step 3)

Two defects in `sdd-harness-bench`, both of which made A7 unreadable:

**3.1 — An unscored rep was priced at zero.** `oneSession`'s catch returned `{kind, error}` and
discarded the session, so control rep 3 — which burned the full 2700 s cap — recorded
`wall_clock_s: 0, cost_usd: 0`, and the arm totals understated the control on both axes while
looking complete. The elapsed clock is now measured by the runner and the cost recovered from the
transcript's own result segments, with `cost_source` naming the provenance. Never 0; `null` when
genuinely unrecoverable.

**3.2 — "The harness ran" could not be told from "the harness was imitated", and the first fix
did not fix it.** `requireEvidence` demanded a receipt, which is the first thing an imitation
produces. I added `requirePipelineEvidence` (the order/result envelopes) on the reasoning that an
agent doing the work by hand leaves none — **then checked it against the six archived A7
workspaces, where it did not catch rep 2**: that workspace holds one order and one result, because
the agent emulating the pipeline ran `compile-order.mjs` and `ingest-result.mjs` itself. Kept as
necessary-and-known-insufficient rather than deleted or oversold.

What discriminates is an artifact only the mechanism under test can leave — the launcher's own run
record. Replayed against the real workspaces:

| arm | rep | recorded then | lane evidence | verdict now |
|---|---|---|---|---|
| candidate | 1 | `harness_unreachable` | absent | `harness_unreachable` |
| candidate | 2 | **ok, scored** | absent | **`lane_under_test_never_executed`** |
| candidate | 3 | **ok, scored** | absent | **`lane_under_test_never_executed`** |
| control | 1–3 | ok / ok / timed_out | n/a | unchanged |

It records on every row and **gates only under `BENCH_REQUIRE_LANE=1`**, so asymmetry between arms
stays an explicit run-time decision. Note this is a replay against archived workspaces, not a live
re-run.

---

## 4 — Step 4, where the plan's own premises died

### 4.1 — HD-007's diagnosis is false: the `Workflow` tool **is** grantable

HD-007 said no permission string could grant the tool. Probed instead of inferred, in the
benchmark's own configuration (untrusted temp workspace, explicit `--settings`, `acceptEdits`):

| `permissions.allow` | `Workflow` call |
|---|---|
| `Bash(node:*)` only — **the benchmark's actual settings** | denied — "Review dynamic workflow before running" |
| bare token `"Workflow"` | **allowed**, zero denials, script runs |
| `Workflow(<path>)` / `Workflow(<script>)` | denied |

The tool was never ungrantable. **The benchmark's settings file never carried the entry**, because
`init` writes Bash prefixes only. Six paid reps went to a missing line in an allowlist. HD-007 is an
**installer** defect, and its one-line fix existed the whole time.

What survives: the grant **cannot be narrowed** — only the bare token works, which permits every
dynamic workflow script in the project, including one written at runtime. That is a real reason to
prefer a path-scoped Bash prefix, and it is now the justification in `SKILL.md`, `upgrading.md`,
`CHANGELOG.md` and the launcher's own banner, replacing the false one.

**F2 from the probe is also answered:** an untrusted workspace ignores `permissions.allow` **in
full**, and the CLI says so by name ("this workspace has not been trusted"). Folder trust was the
suspected variable; it is now the confirmed one.

### 4.2 — HD-009: the pipeline grant matches nothing, and the launcher inherits the defect

The full pipeline ran three times through `run-workflow.mjs` and **aborted at its first dispatch
every time**, in a project that was trusted and carried the installer's grant:

```
{"status":"aborted","aborted_at":"probe",
 "reason":"shapeup-run: resume-state could not be parsed (exit 1): This command requires approval"}
```

Three legs, three different hypotheses, two of them mine and wrong:

| leg | hypothesis | outcome |
|---|---|---|
| 1 | worker sessions inherit nothing | correct, but not the cause |
| 2 | pass the prefixes via `--allowedTools` | **wrong** — that flag takes bare tool names; rule specifiers are ignored. Reverted rather than shipped |
| 3 | the rig omitted the quoted spelling `init` writes | true of the rig, **still denied** |

Reduced to a minimal test in a clean trusted workspace, one command, three rules — §HD-009 in
`shapeup/knowledge-base/harness-defects.md` carries the tables. The finding:

- **A Bash prefix rule matches on whole-argument boundaries.** `Bash(node <dir>/scripts/:*)` ends
  mid-argument and matches **nothing**. `Bash(node <dir>/scripts/hello.mjs:*)` and `Bash(node:*)`
  both work.
- **A quoted command matches no rule at all**, in either spelling — and the skills standardised on
  the quoted form so spaced install paths would not break.

So `init`'s pipeline grant has never granted anything, and `14-invocation-paths.mjs` is green
because it asserts the grant is a **string prefix** of each command — a proxy for "the CLI honours
this" that diverges from the behaviour exactly here. The benchmark's harness scripts ran only
because its adapter appends a broad `Bash(node:*)`, so **the bench has been measuring a permission
configuration the plugin does not ship**.

**This blocks the lane shipped in §1**, whose own call site is quoted. HD-009 is filed rather than
fixed: the options trade a security posture against a spaced-path break, the guard has to *execute*
a granted command rather than compare strings, and that is a PO decision, not an executor's.

---

## 5 — What is NOT proven, stated plainly

- **The full pipeline has still never completed through this launcher.** Three legs, all aborted at
  dispatch 1 on HD-009. The claim "the loader can carry a run to a verdict" remains unbought; only
  "the loader starts the script and dispatches workers" is (P1/P3, and leg 1's own journal line —
  a real worker, `sonnet`, $0.50, 145 s, schema-valid).
- **The A7 re-run is not merely unpaid, it is not yet runnable.** HD-009 has to close first, or the
  candidate arm measures denials again.
- **§3's evidence rule is validated by replay**, against archived workspaces, not by a live run.
- **HD-009 is filed, not fixed**, and every option changes what users are asked to grant.
- The bench changes are uncommitted in a separate repository.

## 6 — Step 5, staged and deliberately not run

The A7 re-run is the PO's spend. It is written out here so that firing it is a decision rather than
a reconstruction — every flag below is derived from the runner and adapter as they now stand, not
remembered.

**Precondition, and it is hard: `HD-009` must close first.** Until it does, the candidate arm
measures permission denials again — exactly what the last six reps measured. The check that says so
takes one command in a trusted scratch project carrying the installer's grant, and it must *execute*
a granted command rather than compare strings:

```sh
claude -p 'Run exactly this command, change nothing, report its stdout verbatim, and append no
suffix: node "<PLUGIN_ROOT>/skills/tech-lead/scripts/resume-state.mjs" --slug <slug>' \
  --model sonnet --output-format json --permission-mode acceptEdits \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
      console.log((j.permission_denials||[]).length?"STILL BLOCKED":"HD-009 CLOSED")})'
```

**Then the two arms.** Uniform in everything except the build under test, which is what the arm
label and `BENCH_SHAPEUP_DIR` pin. `BENCH_REQUIRE_LANE=1` is the §3 gate: on the workflow-lane arm
it refuses to score a rep in which the lane never executed — the failure that made the last run
unreadable. The prose-lane arm has no launcher and must NOT set it.

```sh
cd ~/workspace/sdd-harness-bench

# candidate — the workflow lane. BENCH_SHAPEUP_DIR points at a checkout of the post-fix build.
BENCH_ARM=candidate BENCH_REQUIRE_LANE=1 \
BENCH_SHAPEUP_DIR=<checkout of the candidate commit> \
BENCH_ALLOW_MODEL=claude-sonnet-5 BENCH_MODEL=claude-sonnet-5 \
  node runner/run.mjs --harness shapeup-sdlc --feature f2-budgets --reps 3 --phase solo

# control — the prose lane, same feature, same reps, same model, no lane gate.
BENCH_ARM=control \
BENCH_SHAPEUP_DIR=<checkout of the control commit> \
BENCH_ALLOW_MODEL=claude-sonnet-5 BENCH_MODEL=claude-sonnet-5 \
  node runner/run.mjs --harness shapeup-sdlc --feature f2-budgets --reps 3 --phase solo

node runner/aggregate.mjs
```

Both arms run under `acceptEdits` — the bench's own uniform mode. **No `bypassPermissions`
anywhere**, which §7.7 of `stage3-evidence.md` once said was required and which §4.1 above retires.

**Recording, per R12:** `A7: PASS|FAIL` plus `arm-candidate:` / `arm-control:` lines naming each run
log by path and pinning its build by commit. Expect roughly the last run's spend, **$30–40**.

**Three things to check in the results before reading the score at all**, each one a way the last
run misled: no row carries `lane_under_test_never_executed`; no unscored row shows
`wall_clock_s: 0` (it should now carry the elapsed clock and a `cost_source`); and the arm totals
are compared **per scored rep**, never as sums.

## 7 — Files

Plugin: `skills/tech-lead/scripts/run-workflow.mjs` (new) · `skills/tech-lead/SKILL.md` ·
`hooks/gate-zerowork.mjs` · `commands/{ship,build}.md` · `docs/upgrading.md` · `CHANGELOG.md` ·
`tests/structural/{10-run-receipt,16-workflows,17-gate-zerowork-workflow}.mjs` ·
`tests/fixtures/workflow-run/` · `shapeup/knowledge-base/harness-defects.md` (HD-009 filed, HD-007
corrected, HD-008 closed).
Bench (`../sdd-harness-bench`, uncommitted): `runner/run.mjs` · `harnesses/shapeup-sdlc/adapter.mjs`.
Rig: `.plan-runs/wf-hd007-pipeline/` (forked from the A3 probe; `seed-project.sh` corrected).
