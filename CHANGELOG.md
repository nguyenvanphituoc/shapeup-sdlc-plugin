# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-08-14 · the strip-down

**v1.x owned a runtime it was supposed to stand on, and most of its cleverness existed to survive
that decision.** `run-workflow.mjs` was a 400-line hand re-implementation of the native Dynamic
Workflow runtime; because the orchestrator ran as a script with no shell of its own, it executed
every command by asking a sub-agent to run it and report stdout back — and then defended against
that sub-agent being a model rather than a pipe: a balanced-brace JSON scavenger, a dead-courier
envelope, prompt engineering asking the courier not to append `; echo EXIT:$?`, and path guessing
for where a worker "probably" wrote its result. None of that class of bug exists in a script whose
every branch reads a schema-validated object.

*Stamped at release: `package.json`, `.claude-plugin/plugin.json` and the tag all read **2.0.0**.
Pin target for a rollback is **1.7.0-final**, the last release of the script-runtime line.*

**One entry point.** Twenty-one pipeline scripts across three skills became subcommands of
`kernel/harness.mjs` — `verify | reduce | gate | probe | init | report | compile` — with three
libraries beneath them. The point is the grant: a permission rule matches a command string, so N
entry points meant 2N rules regenerated on every add, rename or removal, and a rule that silently
matches nothing is indistinguishable from one that works until the first dispatch fails. The whole
grant is now two Bash lines plus the optional `Workflow` token, and `npm run test:grant` proves them
by execution — nine real CLI sessions, each decided by whether the target's side effect landed on
disk. 9/9: allowed under a marketplace layout with and without arguments, a `--plugin-dir` checkout
and an install path containing a space; denied for a script outside `kernel/`, an unrelated
destructive command, the superseded mid-argument prefix rule, a literal `${CLAUDE_PLUGIN_ROOT}` call
site, and a project-scoped grant in an untrusted workspace.

**The orchestrator runs on the native runtime and owns no I/O.** 911 lines became 682 while gaining
an opt-in refute wave, because the courier defenses were the bulk of them. Every step is either an
`agent()` returning a validated object or a kernel subcommand a sub-agent runs in its own shell and
reports back as typed fields. Nothing in the file parses a model's prose.

**Scopes fan out.** BUILD is `pipeline(scopes, check, build, confirm)` behind
`args.maxParallelScopes` (default 4). The fence had to change first: `sandbox-guard` followed one
`active-order` pointer, and with scopes building side by side the last compile wins that pointer, so
a write from scope A is judged against scope B's contract. It now reads every LIVE order — compiled,
no result on disk yet — which needs no shared mutable state at all. The third pipeline stage is not
about speed: the worker reports green, and the T0 verdict artifact has to be on disk before the
round believes it.

**Provenance is a query.** `.shapeup/<slug>/graph.jsonl` is the run's own facts as one append-only
edge list, with work lineage (Run, Order, Result, Verdict, Trial) and domain (Scope, UseCase,
Requirement, Seam) deliberately un-collapsed. It is derived from artifacts and never authored, so it
can be deleted and rebuilt, and a v1 tree backfills through the same code path that maintains a
current one. From a verdict node, one query reaches the objective, the plan, the source and the
bounded execution record — asserted, not asserted-about.

**Ten hooks became four, and the diet is stated honestly.** What remains is what nothing in the
runtime can substitute for: `gate-intake`, `harness verify envelope`, `sandbox-guard`,
`safety-spine`, plus `gate-zerowork`, the one blocking Stop hook. The six that went moved layer
rather than losing their work — the L2 signal into the gate block, the deadline into
`verify budget`'s round-boundary check, rehydration into `reduce graph --subgraph run`, the
leftovers scan into the ship report. README's enforcement table now says which guarantees are walls,
which are runtime and which are advisory, including the one real coverage change: a single build leg
that runs long is no longer interrupted mid-flight, only prevented from being followed by another
round.

**Breaking.** Re-run `npx shapeup-sdlc init` — the per-script grants an older install wrote are
removed and replaced. `node …/skills/<owner>/scripts/<name>.mjs` becomes
`node …/kernel/harness.mjs <verb> [<action>]`. The tech lead launches with the `Workflow` tool
rather than a Bash launcher; `--no-native-workflow` declines that grant and keeps the interactive
lane. `probe resume --set-active-scope` is gone with the shared pointer it wrote. The eight
tech-lead references are four. See [docs/upgrading.md](docs/upgrading.md).

---

## [1.8.0] — 2026-08-13 · the run key, and the records that were already there

**The harness has been writing a complete dataset since v1.0 and throwing it away.** Orders and
results are a dispatch's input and output; `run-workflow.mjs` journals every agent call with its
model, wall time and `cost_usd`; every hook appends a decision row; `t0-verify` appends a trial row
carrying a genuine parent edge. All JSON, all schema-registered, all in the LOCAL tier — and **none
of it joinable**. The nearest thing to a key was `order_id` (`<slug>/r<N>-a<M>`), which identifies a
dispatch *within* a run and is byte-identical across every run of the same slug. So the two
questions you would ask this data first — *compare this run to the last one*, and *what did this run
cost* — were both unanswerable from records that were entirely present. Those are exactly the two
rows `docs/design/05` lists as having no instrument.

*Stamped at release: `package.json`, `.claude-plugin/plugin.json` and the tag all read **1.8.0**.
Pin target for a rollback is the previous release, **1.7.0**.*

**The key is derived, not drawn.** `lib/run-id.mjs` mints `<slug>-<YYYYMMDDTHHMMSSZ>-<8 hex>` as a
pure function of three fields the receipt already holds (slug, `started_at`, `intake_sha256`).
`randomUUID()` would have been one line and would have cost the property this repo pays for
everywhere else: a random key exists only where it was first written, so any record that missed the
stamp is unjoinable forever. Derived means every writer holding the receipt computes the same id
without being handed it, and **a pre-1.8 receipt backfills to the id it would have been given** — so
history the harness never stamped is still keyable.

**Six writers stamp it; one deliberately does not.** `init-run` mints it into `receipt.json`;
`compile-order` stamps `run_id` + `compiled_at` onto the WorkOrder at the one point every lane
passes through; `t0-verify` stamps the verdict artifact and the trial row; `run-workflow` resolves
it once at launch and stamps every journal row; `hooks/lib/decision.mjs` resolves it best-effort
(and records `null` outside a run, which is the true answer); SHIP S.6 copies it into the harvest
row. **`WorkResult` gets no stamp** — it is worker-written, and a field a worker must remember to
copy goes missing under exactly the conditions you most want the record. Results reach the key
through `order_id`, a join `validate-envelope` already enforces.

**`export-run.mjs` freezes a run's records as ten fact tables** (JSONL) under
`.shapeup/exports/<run_id>/`, plus a manifest with row counts, a skipped-record count and the
economics block. The grain is the dispatch: one row per compiled order, joined to its result on
`order_id` and to its agent call through the `result_path` the workflow's dispatch prompt already
requires. Read-only over the trace, re-runnable, keyed by run id so a second run of a feature is a
second dataset rather than an overwrite. It exists because the LOCAL tier is *regenerable* — the
`TrialRow` contract says it plainly: a measurement left there "answers the question exactly once and
then deletes itself".

**`stats.mjs --economics` closes measurement-table row 4** — cost, wall clock, retries, and
turns-to-first-write in both agent calls and seconds — computed from records already on disk.
**Nothing is measured yet and the doc says so:** the instrument is unfed until a full pipeline run
produces a trace, and the launcher defect blocking one is still open in the register. An instrument
that exists is not a measurement, and this release does not claim otherwise.

**Two things it refuses to do**, both load-bearing rather than tidy:

- **It never fabricates a join.** The journal exists only on the workflow lane, so a `--tiny` or
  prose-lane dispatch has no cost row. Those rows carry `cost_usd: null` and `agent_join: null`,
  never `0`, and `--economics` reports attributed and unattributed cost separately. An absent value
  and a measured zero must not share a signature — the same defect `hooks/lib/decision.mjs` exists
  to close, one layer up. §54 pins it: making `sumOrNull` return `0` on an all-absent list turns the
  suite red.
- **It never crosses a machine boundary on its own.** The default destination is LOCAL and
  gitignored, because a SHARED one would put per-run structured data and a hostname back into git —
  precisely what ADR-0001 moved the metrics shards out to prevent. `--out <dir>` is a human
  decision. The export makes the evidence durable and portable; where it travels stays the
  operator's call.

**Run economics is not velocity, and the harvest row still rejects it.** `MetricsRow` gains `run_id`
and nothing else: its "Rejected fields" rule against `time_spent` stands, because a signal feed
carrying a duration becomes a velocity feed on the next person who reads it. Cost and wall clock are
*derived on demand* from the exported trace instead. Nothing in the read plane grades — every column
is an id, a count, a duration or a copied enum, and a computed "run quality" figure would be a
second judge behind `spec-evaluator`.

**§55 — every shipped source file must be text a line-oriented tool can read.** Found by the
pre-release audit, when its own sweep could not complete. `lib/run-id.mjs` was written with *literal
NUL bytes* in a template literal — the hash's field separator, typed as raw control characters
instead of `\u0000` escapes. Node parsed it, every test passed, the module was correct. But `file(1)`
reported `data`, and a NUL makes grep treat a file as binary, so `grep -rn` over the shipped tree
**skipped it in silence** — and the repo's non-delivered-content sweep runs on exactly that grep.
The unreadable file was hiding a real leak: a citation into a `docs/` path a user does not receive.
One unreadable file turns every grep-based guarantee about the tree into a claim about an unknown
subset, so the check is general rather than a fix for the instance. The escape produces the same
bytes at runtime; minted ids are byte-identical either way, verified against a fixed fixture.

⟐ **The check was first written to cover only the shipped roots, and so could not see itself.** The
same keystroke put a NUL in the test module's own comment and in the changelog entry describing the
defect; nothing caught either, because neither file ships — only `git` noticed, printing
`Bin 2484 -> 5746 bytes` in the commit stat. A guard scoped more narrowly than the mistake it guards
against is the shape of every defect above it, so §55 now covers the whole tree: `docs/` and
`tests/` do not ship, but a doc or a test no grep can read defeats an audit just as completely.

Structural suite **940 checks** (was 903), green in a fresh clone; `npm run demo` reproduces the SVG
byte-identically. All three new sections were negative-controlled: dropping the `compile-order`
stamp, turning an absent cost total into `0`, and planting a NUL in a shipped file each turn the
suite red. Floor in `docs/design/06` raised 880 → 930, on the record.

## Earlier releases

v1.x is the script-runtime line and is maintenance-only. Its full history — 1.0.0 through 1.8.0,
every measured defect and the mechanism that closed it — is on the **`v1.7.0-final`** tag:

```bash
git show v1.7.0-final:CHANGELOG.md
```

Kept here rather than deleted because the rationale in those entries is why several v2.0 mechanisms
exist at all; kept *there* rather than inline because a 100 KB changelog is one nobody opens.
