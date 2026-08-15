# Evidence — does the orchestrator actually spawn on the native Workflow runtime?

Collected 2026-08-14/15 by executing the artifact, not by reading it. Every claim below cites a
transcript on disk. Where something is unproven it is listed as unproven rather than omitted.

## What was under test

| | |
|---|---|
| Artifact | `skills/tech-lead/workflows/shapeup-run.js` |
| sha256 | `5065a4620fd27bed100bb9097935c94051c7c8acbcaf129871079232cf100d25` |
| Branch / HEAD | `v2` / `09f4a80` (working tree dirty — the meta fix is uncommitted) |
| Node | v24.15.0 |
| Transcripts | `~/.claude/projects/-Volumes-…-proj-harness-plugin/…/subagents/workflows/wf_*` |

## 0 — The refusal, before the fix

The first launch never reached the script body. The runtime rejected the file outright:

```
Invalid workflow script: meta must be a pure literal: non-literal node type in meta: BinaryExpression
```

`meta.description` was three string literals joined with `+`. This is the whole reason the evidence
below could not have been collected at any earlier point in the branch's life.

## Run A — the shipped script loads and returns a RunReturn (0 agents)

`Workflow({scriptPath: shapeup-run.js, args: {autoLevel:"bogus-level", models:{exec:"haiku",
eval:"haiku"}, budgets:{}}})`

```json
{"status":"aborted","aborted_at":"args",
 "reason":"missing args.slug; missing args.pluginRoot; args.autoLevel=\"bogus-level\" must be interactive|auto|unattended; args.budgets must carry maxRounds and attemptBudget; args.models.exec is below the model floor (sonnet or above); args.models.eval is below the model floor (sonnet or above)"}
```

`agent_count: 0`, `duration: 11ms`. **No transcript directory was created for this run** — which is
itself the evidence that zero sub-agents were spawned; the two runs that did spawn agents each have
a directory with one `agent-*.jsonl` per leg.

Proves: the file parses, the body executes, `validateArgs` runs, and the `aborted` member of the
`RunReturn` union is returned intact — including the model floor rejecting a below-floor tier.

## Run B — native worker legs dispatch (6 agents)

Run `wf_c7d3b656-cba`. A purpose-built smoke script whose `cmd()` and `query()` helpers are copied
verbatim from `shapeup-run.js`. Every leg: `agentType: "workflow-subagent"`, `spawnDepth: 1`,
`model: "sonnet"` — matching the `{model: "sonnet", effort: "low"}` the helpers pass.

### B.1 — the load-bearing probe: a non-zero exit crosses the boundary

Agent `a3a546df9ed8153fa`, complete chain:

```
[user 21:15:03]  Run exactly this command and nothing else:
                   node "…/kernel/harness.mjs" bogus-verb
                 Report its exit code as exit_code, ok=true if and only if exit_code is 0…

[assistant]      TOOL_USE Bash
                 node "…/kernel/harness.mjs" bogus-verb; echo "EXIT:$?"

[user]           TOOL_RESULT
                 {"error":"unknown_verb","verb":"bogus-verb",
                  "expected":"verify | reduce | probe | init | report | gate | compile"}
                 usage: harness.mjs <verb> [<action>] [flags]
                 …
                 EXIT:2

[assistant]      TOOL_USE StructuredOutput
                 {"exit_code": 2, "ok": false,
                  "detail": "Command exited with code 2, printing an unknown_verb error JSON…"}
```

A real shell, the real kernel, a real exit code, returned through the runtime's schema enforcement
rather than through stdout parsing. This is precisely the job the deleted courier layer existed to
do, and it is now done by the runtime for free.

### B.2 — every leg

| # | agent | kernel verb | shell | returned |
|---|---|---|---|---|
| 1 | `a7d24a05` | `--help` | `EXIT:0` | `{ok:true, exit_code:0}` |
| 2 | `a3a546df` | `bogus-verb` | `EXIT:2` | `{ok:false, exit_code:2}` |
| 3 | `a9d4b8d1` | `probe resume --slug native-smoke-fixture` | — | the `RESUME` doc, verbatim |
| 4 | `af4c1b26` | `--help` (fan-out leg) | `EXIT:0` | `{ok:true, exit_code:0}` |
| 5 | `a60a8e5d` | `--help` (fan-out leg) | `EXIT:0` | `{ok:true, exit_code:0}` |
| 6 | `a037c788` | `--help` (fan-out leg) | `EXIT:0` | `{ok:true, exit_code:0}` |

Leg 3's returned document is field-for-field identical to what `node kernel/harness.mjs probe resume`
prints when run directly in a terminal.

Totals: 6/6 agents done, 0 errors, 0 skipped, 172,302 sub-agent tokens, 14 tool uses, 440.8 s.

### B.3 — concurrency, measured rather than assumed

The three fan-out legs, from transcript timestamps:

```
af4c1b269cd350aa9   21:19:59.087 -> 21:22:09.593   (130.5s)
a60a8e5d955fe2ad5   21:19:59.285 -> 21:20:05.806   (  6.5s)
a037c788da2755353   21:20:57.071 -> 21:22:07.446   ( 70.4s)

overlap  af4c1b vs a60a8e :  6.5s
overlap  af4c1b vs a037c7 : 70.4s
overlap  a60a8e vs a037c7 : none

MAX SIMULTANEOUS: 2 of 3 dispatched
```

**Parallel dispatch is proven** — two legs started 198 ms apart and ran concurrently. **A 3-wide
fan-out is not proven**: the third leg began only after the second finished. The smoke probe that
reported this as "3 legs concurrently" asserted `greens === 3`; it counted completions and never
measured overlap. The label was wrong, the underlying legs were real.

## Run C — the *shipped* script spawns its own workers (2 agents)

Run `wf_ed6766a1-05a`. Run A proved loadability but spawned nothing, so this run exercises
`shapeup-run.js`'s own dispatch. Fixture: `.shapeup/evidence-probe/orient/` populated with the four
files `hasOrientArtifacts()` requires, so the run fast-forwards past ORIENT; `answers: "interactive"`,
whose preset answers every gate `ask`, so GATE L1a pauses instead of proceeding into paid work.

Leg 1 — the shipped `query()` helper (prompt is verbatim `shapeup-run.js:323-331`):

```
PROMPT      Run exactly this command and nothing else:
              node "…/kernel/harness.mjs" probe resume --slug evidence-probe
            It prints one JSON document on stdout. Return that document's fields as the
            schema names them, verbatim — do not add, rename, summarise or infer any value.
TOOL_USE    Bash → node "…/kernel/harness.mjs" probe resume --slug evidence-probe
RETURNED    {… "has_orient_artifacts": true, "next_phase": "analyze" …}
```

The script then logged the fast-forward and skipped ORIENT — its resume branch, working off artifacts
on disk.

Leg 2 — the shipped `crossGate()` → `cmd()` path:

```
TOOL_USE    Bash → node "…/kernel/harness.mjs" gate --resolve L1a --slug evidence-probe --preset interactive
TOOL_RESULT {"gate":"L1a","status":"ask","source":"preset:interactive","decision":"ask",
             "reason":"GATE L1a is answered \"ask\" — stop and put the block to the PO.","ok":false}
            EXIT:4
RETURNED    {"exit_code":4,"ok":false,"detail":"Command ran; exited with code 4 (non-zero), so ok=false."}
```

Final return — the `paused` member of the union, with the block rendered:

```json
{"status":"paused","paused_at":"L1a",
 "block":"⏸ GATE L1a — Orient Review\nspiked_area: \"~\"\nspike_result: \"~\"\nriskiest_unknowns: []",
 "valid_decisions":["proceed","ask","abort"],
 "context":{"spiked_area":"~","spike_result":"~","riskiest_unknowns":[]}}
```

2/2 agents done, 0 errors, 57,940 tokens, 5 tool uses, 118.3 s.

Proves, for the shipped file specifically: it spawns real sub-agents through its own helpers;
`answersFlag("interactive")` resolves to `--preset interactive`; a gate is decided by the kernel's
exit code (4 → pause) and not by a model's reading; and the correct union member comes back rendered.

Incidental: leg 2's first Bash call failed with a transient classifier timeout, and the sub-agent
retried and completed. A transient tool failure inside a leg is survivable.

## What this does NOT prove

- **No worker skill has ever been dispatched.** Every leg above runs the kernel. `orient`,
  `ba-pitch-analyzer`, `solution-architect`, `scope-architect`, `task-executor`, `spec-evaluator`,
  `qa-edge-hunter` and `scope-hammer` have not been exercised through `worker()` on the native
  runtime. The envelope port (compile → Skill → ingest) is unproven end-to-end.
- **No full run.** Nothing has gone ORIENT → ship. Run C stops at the first gate by construction.
- **No unattended lane.** G2's "a real `--unattended` run completes with zero prompts" is still
  unproven; only the grant half is (`npm run test:grant`, 9/9).
- **No cost or wall-clock comparison against v1.** G6 still has no baseline run to compare to. The
  token and duration figures here describe these probes, and nothing else.
- **3-wide fan-out.** See B.3 — two concurrent legs observed, not three.

## Reproducing

Runs A and C launch the shipped file directly and cost two cheap sonnet legs at most:

```
Workflow({scriptPath: "<pluginRoot>/skills/tech-lead/workflows/shapeup-run.js",
          args: {slug:"evidence-probe", autoLevel:"interactive", answers:"interactive",
                 models:{exec:"sonnet", eval:"sonnet"},
                 budgets:{maxRounds:1, attemptBudget:1}, pluginRoot:"<pluginRoot>"}})
```

with `.shapeup/evidence-probe/orient/{code-surface,discovered-seed,hill-signal}.md` and one
`spike-*.md` present. Expect `{status:"paused", paused_at:"L1a"}`. The fixture is gitignored state
and was removed after collection.

The two static guards that keep the Run-A failure mode from returning are `tests/structural/16-workflows.mjs`
check (f) and `tests/structural/14-invocation-paths.mjs`; both were verified by re-introducing the
original defect and confirming the suite goes red.
