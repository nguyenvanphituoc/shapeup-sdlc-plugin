# QA Hunt wall-clock variance — diagnosis and a fan-out prototype

**Method.** `docs/output/PLAN.md`'s Phase 3 update box records QA Edge Hunt's wall-clock spanning
620s/276s/208s/195s across four runs of one identical pitch, never diagnosed. This finds out what
actually drives that, by running the real harness — `/shapeup-sdlc-plugin:shape` →
Betting Table → `/shapeup-sdlc-plugin:ship --unattended`, every model sonnet — against
`examples/todo-cli/`, in a dedicated detached worktree at the `v2` tip (`b84978e`), the same
precedent `.plan-runs/phase3-5-certification-gap/ledger/S9-live-run/` used. Every number below is
measured from real dispatch-receipt timestamps (hook-written, `PostToolUse`) or from a real
transcript, never estimated.

## The run

`/shapeup-sdlc-plugin:ship todo-cli --unattended --orch-model sonnet --exec-model sonnet
--eval-model sonnet --qa-model sonnet` ran end-to-end in one launch (no pause hit) and returned
**shipped, verdict PASS, round 1**. 6 scopes, all T0 `kept` on first attempt. QA ran for real: 7
charters, 1 finding (`QA-001`, concurrency lens — concurrent `todo add` invocations race on the
store's unlocked read-modify-write and silently drop items, each call still reporting success).
EVAL separately caught one cosmetic bug. GATE H census: nothing ship-blocking.

Two setup obstacles worth naming because they're the kind of friction a real run — not a read of
the code — surfaces: the shipped headless lane correctly *refuses* to self-grant its own kernel
Bash permission ("stop and say so… do not silently hand-build the feature instead" — the tech-lead
skill's own protocol), so a one-time `node bin/init.mjs -d . -y -o` plus marking the worktree
trusted in `~/.claude.json` (exactly what the installer's own warning names as "what a CI image
should bake in") was needed before any headless launch could proceed. And even after that,
`--permission-mode acceptEdits` alone left almost every worker's own Bash call (`npm test`, driving
the CLI, etc.) un-approvable with nobody present to approve it — not a defect, just the real cost of
a fully unattended lane, resolved here by running the whole experiment in an isolated, disposable
worktree under `bypassPermissions` rather than the user's own environment.

## Diagnosis: where QA's variance actually comes from

**QA is dispatched today as ONE sub-agent turn.** Reading `skills/tech-lead/workflows/shapeup-run.js`
confirms it: the QA phase is a single `worker({skill: "qa-edge-hunter", operation: "hunt", ...})`
call. There is no lens-level scheduling in the shipped pipeline at all — `pipeline()`/`parallel()`,
the primitives BUILD's scope fan-out uses, are not touched by QA. So "do the lenses run sequentially
or concurrently" has a flat answer: sequentially, inside one continuous turn, because that is the
whole design — there is no scheduler to be inefficient about.

**Historical trace analysis says charter count and probe depth do not explain the spread.** This
repo's own `traces/` (git-tracked, not gitignored) holds four earlier live runs with real
`receipts/dispatch.jsonl` — one `todo-cli` run (2026-08-16) and three `envlint` runs (2026-08-17,
the D3 fan-out arms). Pulling QA's real dispatch-to-next-dispatch span (the same convention
`probe concurrency` uses for BUILD legs) and pairing it with each hunt's own charter/finding count:

| Trace | charters (live/nominal) | findings | QA span |
|---|---|---|---|
| todo-cli/interactive-shipped | 13/13 | 10 | 668s |
| envlint/fanout-arm-shipped | 4 live/6 (2 reasoned inapplicable, never run) | 5 | 628s |
| envlint/seq-arm-shipped | 11/11 | 4 | 283s |
| envlint/seq-arm-controlled | 6/6, all live | 3 | 216s |
| todo-cli/this-run (round 1) | 7/7 | 1 | 159s |
| todo-cli/standalone (below) | ~13-charter-equivalent | 3 | 373s |

These numbers are close to but not identical to PLAN.md's cited 620/276/208/195s — plausibly a
slightly different measurement convention — but they independently reproduce the same magnitude
and the same ~3x spread, on two different fixtures, on two different dates. The load-bearing
observation: **`envlint/fanout-arm-shipped` (628s) did the LEAST work of any sample** — it reasoned
2 of 6 nominal charters inapplicable without running a single live probe on them, tried only 2-4
input variants per charter, and produced an 83-line report. `envlint/seq-arm-controlled` (216s —
under a third of that time) ran every charter live, tried more input variants per charter, and wrote
a 139-line report with a full Preflight + Charter Map section the slower run skipped. Less
observable work took over 3x longer. Charter count and thoroughness do not predict the spread.

**A standalone hunt with full transcript visibility shows why.** The full pipeline run above hides
QA inside one opaque `Workflow` tool call from the top level — no way to see inside it. So a second
hunt was dispatched directly (`harness compile --operation hunt --round 2` → `Skill(qa-edge-hunter)`
→ skip ingest, a clean re-run against the same already-built+PASS'd app), as a **top-level**
`claude -p --output-format stream-json --verbose` session — full per-tool-call timestamps. 3
findings, 372.9s total. Every `tool_use` paired with its own `tool_result` by id, summed across the
whole transcript:

- **Tool execution time: 6.7s (1.8%)**
- **Inter-tool model latency (a result to the next tool call): 366.2s (98.2%)**

Concretely: the GATE Q0 preflight command is `node bin/todo.js add "buy milk"` — milliseconds to
run — yet the gap to the next tool call was ~60s. **The wall-clock is almost entirely the model's
own inter-turn latency, not the substance of the work.**

**Stated plainly: this is not a scheduling/architecture bug in the current design.** There is no
lens-level scheduling today to be inefficient about — QA is one turn, dominated by ordinary
per-turn model latency, which varies run to run for reasons outside this repo's control. That is a
negative result and it is the honest one.

**But that does not make fan-out pointless — it is why fan-out should help anyway.** Today's design
SUMS however many turns' worth of (noisy) latency the hunt takes, sequentially, inside one dispatch.
Splitting into N independent parallel dispatches turns that SUM into a MAX. Even fully-irreducible
per-turn noise benefits from this whenever the per-unit costs are of comparable magnitude, which the
159-668s range above confirms they are. This was tested for real, not assumed.

## The fan-out prototype

`experiments/qa-lens-fanout.js` (run-worktree only, **not committed, not shipped** — this is a
research prototype, not a production change) is a standalone workflow script that fans the 6 fixed
lenses out as 6 parallel `qa-edge-hunter` dispatches via `parallel()` — the same primitive BUILD's
scope fan-out uses — against the already-built, already-PASS'd `todo-cli` app, so no BUILD/EVAL
re-run was needed per sample.

**Design, and its real limitation.** Each dispatch is restricted to one lens by its *prompt*
(`extra` instruction: "restrict Phase Q1 to lens X only"), because `qa-edge-hunter`'s WorkOrder
payload has no lens field to restrict it by contract — adding one would be a real skill/kernel
change, out of scope for a prototype. Each dispatch also writes its report to a distinct path
(`.shapeup/todo-cli/qa/hunt-report-lens-<id>.md`) rather than the skill's hard-coded default,
because 6 concurrent writers to the same file would race and silently drop 5 of 6 reports — this,
too, is a prompt-level workaround around a contract the skill was not designed to share. **A real
shipped version of this needs an actual lens-scoped payload field and order-suffix discriminator in
`compile.mjs`, not a prompt override.** This prototype proves the mechanism works; it does not
itself belong on the default path.

One load-time correction along the way: the native Workflow runtime requires `export const meta`
to be the literal first statement in the script (stricter than `shapeup-run.js`'s own layout
suggested) — moved above the `args` normalization line, then loaded clean.

### Invariants — checked, not assumed

- **No verdict, no score.** Every one of the 12 WorkResults across both fan-out runs (6 lenses ×
  2 samples) was inspected: `{artifacts, assumptions, deviations, discoveries, order_id,
  schema_version, status, worker}` — no `verdict`/`score`/`pass`/`overall` field anywhere.
- **EVAL untouched, single judge intact.** `EVAL-FEATURE-todo-cli.md`'s mtime predates every QA
  dispatch in both fan-out runs; nothing newer exists in `evaluation/`. No lens dispatch reads or
  writes it.
- **Ledger correctly serialized under real concurrent writers.** 6 simultaneous `reduce ingest`
  calls (confirmed dispatched within a 3.66s window via real `dispatch.jsonl` timestamps, distinct
  `agent_id`s) wrote through `ingest.mjs`'s existing per-slug lock (`.ingest.lock`, mkdir-based,
  stale-owner detection) with zero corruption: only the 3 lenses that actually found something wrote
  a `## Discovered` section; the 3 with zero findings correctly wrote nothing (`ingest.mjs`'s own
  `if (result.discoveries?.length)` guard) — no partial writes, no interleaved sections.

**Single judge, EVAL-once-per-round, and QA-no-verdict all hold**, verified against the real
artifacts the fan-out produced, not asserted from reading the design.

### Measured before/after

Both fan-out samples' overall span measured from real dispatch-receipt timestamps (first lens
dispatched) to real result-file writes (last lens's `results/hunt-r9NN.json` landing) — live files
in a live worktree, not a copied trace, so mtimes are trustworthy here (unlike `traces/`, which
RESULT-v2.md already flags as unsafe to time by mtime).

| Run | per-lens durations | parallel span | sum of the same 6 legs |
|---|---|---|---|
| fan-out run 1 | 137–313s (state-interruption slowest both times) | **313.2s** | 1065.5s |
| fan-out run 2 | 80–224s | **224.8s** | 781.2s |

Framed against the sum of the SAME six real dispatches — the cleanest apples-to-apples number,
since it's literally the same legs' own measured durations — parallelizing cut wall-clock **3.40x**
and **3.47x**. That comparison is technically real but the basis is inflated: it compares against a
strawman (6x redundant setup) that today's actual single-dispatch design never pays, since one turn
shares context across lenses instead of re-reading the spec 6 times.

The fair comparison is against the **real single-dispatch baseline distribution** above (n=6,
159-668s, mean 387.8s, median 328s):

| | n | mean | median | min | max |
|---|---|---|---|---|---|
| Before (single dispatch) | 6 | 387.8s | 328.0s | 159s | 668s |
| After (6-lens fan-out) | 2 | 269.0s | 269.0s | 224.8s | 313.2s |

**A real, consistent, but modest win: ~31% below the before-mean, ~18% below the before-median,
n=2.** Both fan-out samples land inside the before-distribution's range rather than dramatically
undercutting it, and both are bottlenecked by the SAME one-outlier-dominates dynamic a sequential
run has — `state-interruption` was the slowest of the 6 legs in *both* fan-out runs (313s and 223s
respectively), so parallelizing turns "sum of noise" into "max of noise," which helps, but a single
slow leg still caps the whole parallel run exactly as one slow turn caps a sequential one.

**Cost, not just speed.** AGENTS.md's own framing — "concurrency is a cost question before it is a
speed one" — applies directly here: 6 parallel dispatches each pay their own ~90-150s of Q0
preflight/spec-reading setup independently, work a single dispatch pays once. Fan-out run 1 used
418,319 total subagent tokens across 138 tool calls for one hunt; the equivalent single-dispatch
figure was not captured here, but the setup-cost multiplication alone (measured at ~24% of one
single-dispatch hunt's own wall-clock, in the transcript breakdown above) means the token/dollar
cost of a fanned-out hunt is real and higher, not just its latency.

## Defects found and fixed along the way

Both watched red first (defect reproduced, new test fails for the reason it should), then green,
per this repo's own standing method. `npm test` was green before touching anything (1193 checks) and
is green after (1195 checks).

**1. `rounds_used: 0` in every ship report, on every run, always.** `shapeup/todo-cli/REPORT.md`
printed "Rounds used | 0" beside its own `results/evaluate-r1.json` — a real one-round run. Root
cause: `harness-run.md`'s `rounds_used` frontmatter is written once at GATE L0.1 and never updated
as rounds complete; `shapeup-run.js`'s own `RunReturn` carries the real count but never reaches
`reduce ship`. This directly contradicts `kernel/reduce/ship.mjs`'s own stated discipline ("EVERY
NUMBER HERE IS DERIVED, NEVER PASSED IN… nothing in it is a claim the orchestrator makes about its
own run") — `rounds: run.rounds_used` was exactly that claim. Fixed by deriving `rounds_used` from
the highest `evaluate-r<N>.json` result on disk (the same artifact `probe resume`'s
`eval_rounds_done` already trusts), falling back to the frontmatter only when no EVAL round ever
ran (`--tiny` lane). `kernel/reduce/ship.mjs`, `tests/structural/47-ship-report.mjs`.

**2. `bin/init.mjs` crashes when its own repo is the install target.** Dogfooding — or a
`--plugin-dir` worktree running `npx shapeup-sdlc init` against itself, exactly this experiment's
own setup — hits `cpSync(src, dst)` with `src === dst` on two template files, throwing uncaught
`ERR_FS_CP_EINVAL`. The permission grant (the part that matters for a headless run) had already
succeeded one step earlier, so the failure looked worse than it was — but it was still a crash.
Fixed by skipping the copy when source and destination are the same file, comparing real paths
(`realpathSync`) rather than raw strings, since a symlinked temp root (macOS `/tmp` →
`/private/tmp`, `/var/folders`) can reach the same file through two different-looking paths.
`bin/init.mjs`, `tests/structural/22-consumer-install.mjs`.

## Related context (not this experiment's finding)

The sibling experiment (Experiment A, same pitch, independent worktree, establishing the G2/G6
baseline) found and fixed a more serious, related defect: EVAL's dispatch trusts a sub-agent's own
self-reported `{ok, overall}` schema return rather than the real `WorkResult` on disk, so a FAIL
could in principle be read as PASS with no way to tell — fixed there with a new `probe eval`
verification step. QA's own control-plane schema (`QA_REPORT: {ok, findings_count}`) has the same
shape of self-report, but the consequence is smaller: QA has no verdict to corrupt, so the risk is
limited to `findings_count` (feeding GATE H's census) diverging from what actually landed in
`discoveries[]`. Not investigated further here — it is Experiment A's finding and fix to report,
this is noted only because the same pattern showed up in the phase this report is about.

## Recommendation: adopt, with more engineering and more data — not yet on the default path

The diagnosis is solid: QA's wall-clock is dominated by per-turn model latency, not by an
architectural inefficiency in the current single-dispatch design, and reproduces the same ~3x spread
across two different fixtures and five real historical samples. The fan-out mechanism is
**measurably real** (two live before/after samples, both faster than the before-mean, invariants
independently verified against real artifacts) but the win is **modest** (~18-31%, n=2) and **not
free** (roughly 6x the setup-phase token cost of a single dispatch, and still capped by whichever
single lens draws a slow turn).

Concretely:
- **Do not** wire the prompt-override version (distinct-path-via-`extra`) into `shapeup-run.js`'s
  default QA phase — it works, but it is a workaround around a contract the skill was not designed
  to share, not a real fix.
- **If pursued**, the real version needs: a `lens` field in `qa-edge-hunter`'s WorkOrder payload
  (schema + skill change, Q1 restricted by contract instead of prompt), a lens-aware order-suffix
  discriminator in `compile.mjs` (mirroring the scope-id discriminator BUILD already has), and a
  real merge step for the 6 reports into the one canonical `qa/hunt-report.md` GATE H's census
  reads — none of that exists yet.
- **Before shipping it as the default**, get more than n=2 samples — the two measured here still sit
  inside the before-distribution's natural range, so a confident "always faster" claim would be
  exactly the kind of measurement this repo's own house style refuses to manufacture.
- Given the cost multiplier and QA's own designed role ("a level-up, not a gate" — findings are
  advisory, never blocking), a defensible middle path is an **opt-in** flag
  (`--qa-lens-fanout`, off by default) for runs where QA's wall-clock is specifically the
  bottleneck someone is paying to fix, rather than a default-on change to every run's cost profile.
