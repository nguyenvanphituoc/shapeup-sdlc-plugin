# Ratchet & Receipt — Day 1 / Day 2 Implementation Plan

> Scoped against *Graph Engineering: The Karpathy Loop, Improved 1000× by Itself* (§VI.A–B,
> Appendix Table VI) and the rung diagnostic *"The ratchet has no pawl"* (artifact
> `05fa89b4`). Companion to, and deliberately **ahead of**, the six-phase roadmap in
> *Mapping shapeup-sdlc onto a Graph-Engineering Architecture* (31 Jul 2026).
>
> **Scope discipline.** This plan does exactly two things, both mechanically checkable:
> 1. **Fit the pawl** — the build loop gets a scalar, a history, and a revert, so it can be
>    asked whether attempt N+1 is better than attempt N.
> 2. **Give `allow` a receipt** — every enforcement tool records a positive decision, so an
>    inert gate stops being indistinguishable from a permissive one.
>
> It deliberately does **not** build a graph store, parallelise dispatch, or add entity
> resolution. Those are §5 non-goals with reasons.
>
> **Governing rule (inherited).** If a script can't check it, it's decoration. Every artifact
> below is either a checkable oracle or a durable record an oracle reads.
>
> **Exit criteria are measurements, not structures.** The paper does not award a rung for
> having the parts at the named positions — this harness already has those. It awards a rung
> for a measured outcome. Both exits below are numbers produced by scripts, from runs the
> harness already performs, at zero model tokens.

---

## 0. Why this, and why before the roadmap

The graph-engineering paper's five planes: control (`tech-lead`), execution (workers + hooks),
artifact (files), evaluation (`spec-evaluator` + `t0-verify`) are all present. Only the graph
plane is absent. The ontology — the expensive part — already exists as
`skills/tech-lead/schemas/domain.schema.json` (38 `$defs`, an `x-erd` block declaring 30 typed
relationships with cardinality and named join keys), hook-validated in both directions.

Two facts block everything downstream, and neither is fixed by adding a plane:

| # | Fact | Verified at |
|---|---|---|
| 1 | **No comparison exists.** `better` appears nowhere in the codebase except one comment in `fit-check.mjs`. `computeVerdict` returns four booleans; N fixture outcomes collapse through a single AND. | `t0-verify.mjs:98–111` |
| 2 | **History is one attempt deep, and self-destructing.** The only prior-attempt data reaching a worker is one file's error digest; the verdict artifact is written with a bare `writeFileSync` under a protocol that retries the same attempt number. | `compile-order.mjs:333`, `t0-verify.mjs:144–152` |

Fact 2 is invariant **I4** ("every superseded object remains addressable") — the one the
roadmap paper itself names as most clearly violated. Only two files in the entire codebase use
`appendFileSync` today.

**Consequence for sequencing.** The roadmap's Phase 0 is *"compute 𝒫, q, h, m over three past
boards"* — but `.shapeup-sdlc/` is gitignored and the verdict artifacts overwrite each other,
so those measurements cannot be taken from data the system retains. Phase 0 has an undeclared
prerequisite, and this plan is it. The same work also lands most of Phase 2 (§7).

---

## 1. The tier decision

One question decides where every new file lives:

> If I `rm -rf .shapeup-sdlc/` and a teammate clones fresh, must this file still exist and
> still mean the same thing? **Yes → SHARED** (`docs/shapeup-sdlc/`). **No → LOCAL**
> (`.shapeup-sdlc/`, gitignored).

| New artifact | Tier | Location | Rationale |
|---|---|---|---|
| **Trial ledger** — one row per T0 run: score, status, parent | **LOCAL** | `.shapeup-sdlc/<slug>/t0/trials.jsonl` | Per-run trace; regenerable in principle from the verdict artifacts beside it; references machine-local attempt ordinals |
| **Verdict artifacts** (existing, re-addressed) | **LOCAL** | `.shapeup-sdlc/<slug>/t0/verdicts/r<R>-a<A>-t<T>.json` | Unchanged tier; only the address changes |
| **Decision receipts** — one row per hook evaluation | **LOCAL** | `.shapeup-sdlc/decisions.jsonl` | Checkout-wide, not per-slug: hooks fire outside any run. Pure run-trace |
| **Ratchet + hook metrics** (aggregates) | **SHARED** | `docs/shapeup-sdlc/metrics/<machine-id>.jsonl` | Existing committed harvest, extended with new row fields. This is the only durable, cross-machine record and the seed of any future graph plane |
| **Kept-tree snapshots** | **LOCAL (git)** | `refs/shapeup/<scope_id>/kept` | Shadow refs; never commits on the user's branch |

The aggregates being SHARED is load-bearing: the exit criteria of both rungs are measurements
that only become meaningful across runs and across machines.

---

## 2. Day 1 — fit the pawl

Exit criterion: **measured quality improvement.** Not "harness vs. no harness" (already
answered) — *the loop versus its own first attempt.*

The paper's template is
`ratchet_loop(inspect, propose, apply, evaluate, keep, revert, better, baseline)`. Six of the
eight positions are filled and filled well. `better` and the `Trial` history are absent, and
they are the two that make it a ratchet rather than a budgeted retry loop.

### 2.1 `score()` and `better()` — the comparison

**File:** `skills/tech-lead/scripts/t0-verify.mjs` · **~25 LOC** · new exports.

`computeVerdict` keeps its signature and return shape (callers depend on `overall`). Two new
exports sit beside it.

```js
/**
 * The comparable T0 outcome. A vector, not a float — the three arms are not fungible.
 * @returns {{regressions:number, fixtures_passed:number, fixtures_total:number,
 *   db_probe:(0|1|null)}}
 */
export function score({ fixtures, dbProbe, seesaw }) {
  return {
    regressions:     seesaw.ran ? seesaw.failing.length : 0,
    fixtures_passed: fixtures.results.filter((r) => r.pass).length,
    fixtures_total:  fixtures.results.length,
    db_probe:        dbProbe === null ? null : (dbProbe.pass ? 1 : 0),
  };
}

/**
 * The pawl. Lexicographic, strict.
 * @returns {boolean|null} true = strictly better · false = not better · null = incomparable
 */
export function better(next, current) {
  if (current === null) return true;                                // baseline
  if (next.fixtures_total !== current.fixtures_total) return null;  // contract changed
  if (next.regressions !== current.regressions) return next.regressions < current.regressions;
  if (next.fixtures_passed !== current.fixtures_passed)
    return next.fixtures_passed > current.fixtures_passed;
  if (next.db_probe !== current.db_probe) return (next.db_probe ?? 0) > (current.db_probe ?? 0);
  return false;
}
```

Three decisions worth defending at review:

| Decision | Why |
|---|---|
| **Strict `>`; a tie is not better** | A tie that counts as an improvement makes a sawtooth look like a ratchet. Strictness is what the measurement in §2.7 detects. |
| **Regressions dominate** | Breaking a previously-finished scope is never an improvement, whatever the new scope's fixtures did. This is what lets the seesaw branch collapse into the general rule (§2.4). |
| **`null` when `fixtures_total` differs** | A scope split or remap changes the denominator; comparing across it is a category error. The ratchet treats incomparable as a baseline reset, not a false verdict. |

The per-fixture data this reduces over is **already persisted** — the artifact carries
`fixtures: [{cmd, exit, pass}]` (`t0-verify.mjs:207`). No new measurement is taken; a number
that already exists on disk is finally counted.

### 2.2 Immutable addressing — invariant I4

**File:** `t0-verify.mjs:144–152` · **~15 LOC**.

Do **not** add an `existsSync` guard. That is check-then-write: still racy, and still a policy
expressed in code rather than a property of the store. Use exclusive create and let the
filesystem enforce it.

```js
export function writeArtifact(outDir, round, attempt, verdictBody) {
  const dir = join(outDir, "t0", "verdicts");
  mkdirSync(dir, { recursive: true });
  for (let trial = nextTrialNo(dir, round, attempt); ; trial++) {
    const path = join(dir, `r${round}-a${attempt}-t${trial}.json`);
    const body = { schema_version: 2, round, attempt, trial,
                   at: new Date().toISOString(), ...verdictBody };
    const text = JSON.stringify(body, null, 2);
    try {
      writeFileSync(path, text, { flag: "wx" });   // EEXIST, never clobber
      return { path, sha256: sha256(text), trial };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
}
```

`wx` makes overwriting *impossible* rather than merely discouraged — the same class of move as
`lib/is-main.mjs`: replace a fragile comparison with one that cannot silently be wrong. The
retry-same-attempt case that previously destroyed the red verdict now writes `…-t8.json`
beside `…-t7.json`.

The evaluator's citation contract is unaffected: it re-hashes whatever path it is handed, and
`T0Citation` carries `path` + `sha256`, not a filename pattern.

> **Hard coupling.** `compile-order.mjs:333` reads the old `r${round}-a${attempt - 1}.json`
> name. This change and §2.5 ship in **one commit**, or the history read goes silently empty —
> which is the failure mode this whole plan exists to make impossible.

### 2.3 The trial ledger — `history`

**File:** `t0-verify.mjs` · **~30 LOC** · append-only, `appendFileSync`.

One row per T0 run, at `.shapeup-sdlc/<slug>/t0/trials.jsonl`:

```json
{"schema_version":1,"trial":7,"round":2,"attempt":3,"scope_id":"SC-02",
 "at":"2026-08-01T12:34:56.789Z",
 "artifact":"t0/verdicts/r2-a3-t7.json","sha256":"…",
 "score":{"regressions":0,"fixtures_passed":4,"fixtures_total":5,"db_probe":1},
 "status":"kept","baseline_trial":5,"delta":"+2 fixtures",
 "tree_ref":"refs/shapeup/SC-02/kept",
 "digest":[{"file":"src/order.ts","line":88,"core_message":"…","kind":"type"}]}
```

**Writer rule.** `t0-verify` writes this, not `ingest-result`. The single-writer invariant
governs *worker-derived* shared state — board, ledger, verdict — because a worker's claims must
pass through one applier. A trial row is a **mechanical fact produced by running commands**, in
the same class as the verdict artifact `t0-verify` already owns. Recording it anywhere else
would require a round-trip through an envelope that carries no worker claim.

**`baseline_trial` is the parent link.** That single field is the experiment DAG: lineage,
`PARENT_OF`, and a genuine `SUPERSEDES` edge — delivered without a graph store.

### 2.4 `keep` / `revert` — one rule replaces two branches

**Files:** `t0-verify.mjs`, new `skills/tech-lead/scripts/lib/ratchet-tree.mjs`,
`skills/tech-lead/SKILL.md` (step (e), per the diagnostic at :295–301) · **~55 LOC**.

Today the protocol branches red two ways: a seesaw regression gets `git stash push -u`; a red
on the scope's own fixtures gets "loop to the next attempt" and **no revert at all** — so
attempt N+1's fresh, zero-memory subagent starts from code it did not write and cannot see the
history of. The paper's `revert(commit)` is the more common branch and it is the absent one.

Under a ratchet there is exactly one rule:

| `better(next, current)` | Action | `status` |
|---|---|---|
| `true` | keep tree · `current = next` · snapshot | `kept` |
| `false` | restore last kept snapshot | `reverted` |
| `null` | keep tree · reset baseline | `rebased` |
| spawn error / timeout (`r.error` set) | restore last kept snapshot | `crash` |

**The consequence that matters:** an attempt that moves 2/5 → 4/5 fixtures is **red but
better**, and is therefore `kept`. The ratchet retains *improvements*, not just greens. That is
precisely what makes attempt N+1 build on attempt N instead of restarting from unexplained
code, and it is unreachable without §2.1's scalar.

The seesaw case needs no special branch: a regression raises `score.regressions`, `better()`
returns `false`, and the existing stash-and-restore fires through the general path. **This is a
simplification of the protocol, not an addition to it.**

New helper, two operations, **no commits on the user's branch**:

```js
// skills/tech-lead/scripts/lib/ratchet-tree.mjs  (~40 LOC)
export function snapshot(scopeId, cwd);  // git stash create → git update-ref refs/shapeup/<scope>/kept
export function restore(scopeId, cwd);   // git restore --source=<ref> --worktree -- .
```

Shadow refs keep the harness's existing convention that it never writes commits to the branch
under test.

### 2.5 `inspect()` — widen the WorkOrder's history

**Files:** `compile-order.mjs:330–337`, `skills/tech-lead/schemas/domain.schema.json` ·
**~30 LOC**.

Today's entire history mechanism reads **one attempt back**, **only within the current round**,
and carries **only AEGIS error triples**. With the default `attempt_budget: 5`, attempt 4 may
re-propose a change that already failed at attempt 1; round 2 attempt 1 begins blind to
everything round 1 learned.

```js
const trials = readTrials(join(cwd, ".shapeup-sdlc", slug, "t0", "trials.jsonl"))
  .filter((t) => t.scope_id === scopeId)
  .filter((t) => t.round === round || t.round === round - 1)   // crosses the round boundary
  .slice(-8);                                                   // token-bounded
payload.trial_history  = trials.map(compactTrial);   // {trial,round,attempt,score,status,delta,digest:top3}
payload.digested_errors = lastRed(trials)?.digest ?? [];        // unchanged field, back-compat
```

**Schema work** (`domain.schema.json`):
- new `$defs.TrialRow`
- `WorkOrderPayload.trial_history: {type:"array", items:{$ref:"#/$defs/TrialRow"}, maxItems: 8}`
- two `x-erd` relationships: `T0Artifact --trial--> TrialRow [1:1]`,
  `TrialRow --baseline_trial--> TrialRow [N:0..1]`

Once in the schema, `validate-envelope` enforces it at the `PreToolUse` hook like everything
else — the history becomes a typed contract, not a convention.

**Token discipline.** `compactTrial` strips `stdout`/`stderr` and truncates the digest to three
triples. Eight rows ≈ 600 tokens, against an `attempt_budget` of 5 — cheaper than one
re-proposed failed change.

### 2.6 Stopping rule

**Files:** `compile-order.mjs`, `skills/tech-lead/SKILL.md` · **~10 LOC**.

`attempt_budget` stays. One term joins the inner breaker: **stagnation** — `no_progress_k`
(default 2) consecutive non-`kept` trials ends the scope early and queues the existing GATE H
proposal rather than blocking the round. This is the paper's "exhaustion criteria", it
composes with the existing three-level circuit breaker, and on a flailing scope it saves three
of five attempts.

### 2.7 The exit measurement

**File:** `skills/tech-lead/scripts/stats.mjs` · `--ratchet` mode · **~25 LOC**.

Reads `trials.jsonl` (local) for the current run and the harvested rows (shared) across runs:

| Metric | Definition |
|---|---|
| `improvement_rate` | trials with `status:"kept"` ÷ trials after the first |
| `monotone_rate` | scopes whose score never decreased ÷ scopes with ≥ 2 trials |
| `sawtooth_count` | trials with `status:"reverted"` following a `kept` |
| `mean_trials_to_green` | — |

**Day 1 passes when**, over scopes with ≥ 2 trials, `improvement_rate` is measurable and
`monotone_rate` is reported. A monotone series is a ratchet working; a flat or sawtooth series
says the loop is a retry loop and that §2.5 is load-bearing rather than tidy.

This number has a property nothing in the project's record has: every prior measurement was
*harness versus bare agent*. This one is *the loop versus its own first attempt*, and it cannot
be won by a one-sentence control, because a one-sentence control has no second attempt.

Extend the SHIP S.6 harvest row (`references/gates.md:333`) so these land in the committed
metrics shard and accumulate across the team.

---

## 3. Day 2 — the three legs

Exit criterion: **the tool reduces a known error class.** The paper asks three things of every
tool — typed schema, permissions, result confirmation — plus one thing of the decision to build
it (that it addresses a *measured* failure).

Leg 1 is the strongest thing in the codebase at the envelope boundary and stops dead at
`process.argv`. Legs 2 and 3 are structurally open.

### 3.1 Leg 1 — type the argv boundary

**File:** new `skills/tech-lead/scripts/lib/argv.mjs` (~45 LOC) + adoption in 15 entry points
(~3 LOC each).

`t0-verify.mjs:160–173` does `out.round = Number(argv[++i])` with no validation, then
`args.round ?? 1` — which does not catch `NaN`. Passing a flag without a value writes a verdict
to `rNaN-a1.json` and **exits 0**; the orchestrator then looks for `r1-a1.json`, finds nothing,
and the evaluator's mandatory citation cannot resolve.

Declarative spec, mirroring `validate-envelope`'s contract (reject before anything runs, exit 2,
machine-readable reason on stderr):

```js
const SPEC = {
  _:           { arity: 1, name: "scope-contract.json" },
  round:       { type: "int", min: 1, required: true },
  attempt:     { type: "int", min: 1, required: true },
  cwd:         { type: "path" },
  out:         { type: "path" },
  "no-seesaw": { type: "flag" },
};
const args = parseArgs(SPEC, process.argv.slice(2));
```

Failure output: `{"error":"invalid_flag","flag":"--round","got":"--attempt","expected":"int ≥ 1"}`,
exit 2. Applied to all 15 skill-local entry points.

### 3.2 Leg 2 — make the grant match the prose

`npx shapeup-sdlc init` writes three prefix rules of the form
`Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)`. Per the diagnostic's census of
what the skills actually instruct: 2 call sites carry the literal expanded form, 13 carry
`node skills/<owner>/scripts/…`, and **18 carry the bare `node scripts/…` form** — which
resolves to nothing from the project cwd and matches no rule. The bare form is the hot path
(`compile-order` ×8, `ingest-result` ×5, `t0-verify` ×3 — once per attempt).

The gap is bridged by a prose note (`SKILL.md:218–221`) asking the model to perform a string
substitution. That is a prompt-carried invariant sitting directly underneath the mechanism
built to forbid prompt-carried invariants — and its failure mode is already measured at 26
approval denials in one session.

**Work:** (a) rewrite the 31 call sites in `SKILL.md` / `references/` to the literal
`node "${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/…"` form; (b) **delete the path note** — it
exists only to explain the bare form; (c) add the test in §4 so the convention cannot rot back.

### 3.3 Leg 3 — give `allow` a receipt

**File:** new `hooks/lib/decision.mjs` (~35 LOC) + adoption in 10 hooks and
`validate-envelope.mjs` (~2 LOC each).

Every enforcement tool's failure signature is identical to its success signature: fed malformed
input, every gate returns `exit=0, stdout_len=0` — which is also what "inspected and permitted"
looks like, what "no rule matched" looks like, and what an inert script looks like. That
indistinguishability is why 26 enforcement points sat inert behind 610 green checks.

**Fail-open is retained.** `gate-l2.mjs` argues for it correctly in its own header: a gate that
breaks legitimate or standalone runs just gets disabled. The defect is not the direction — it
is that `allow` carries no evidence.

```js
export async function runHook(name, fn) {
  let d;
  try {
    d = (await fn()) ?? { verdict: "allow", reason: "no rule matched" };
  } catch (e) {
    d = { verdict: "error", reason: String(e?.message ?? e) };   // still fail-open, now recorded
  }
  appendFileSync(decisionsPath(), JSON.stringify({
    at: new Date().toISOString(), hook: name, pid: process.pid,
    event: d.event, tool: d.tool, subject: d.subject,
    verdict: d.verdict, reason: d.reason, rule: d.rule,
  }) + "\n");
  if (d.verdict === "deny") process.stdout.write(JSON.stringify(d.payload));
  process.exit(0);
}
```

Every hook's body becomes a function returning a decision; `runHook` is the only exit path.

This is the `spoke()` predicate from `tests/structural/11-is-main.mjs` — *did the script
produce output?* — promoted from the test harness to runtime and applied to hooks. It makes
four states distinguishable that are today all silence:

```
inspected-and-permitted · no-rule-matched · threw · never ran
```

F-16's whole **class** closes rather than its instance.

Two things fall out at no extra cost:

- **`gate-zerowork` gains a second condition** at `Stop`: the orchestrator was dispatched but
  `decisions.jsonl` holds zero rows for this pid ⇒ the enforcement layer was inert. The
  detector for "the gates didn't run" stops depending on the gates running.
- **`stats.mjs --hooks`** reports evaluations / denials / errors per hook per run.

### 3.4 The exit measurement

`stats --hooks` is the Day-2 instrument. Of the eight tools built against a measured failure,
three are scored *Reduces*, two *Partial/Unfired*, two *No effect*, and one *Unfired* — and
several of those scores are unobtainable today because "never had to fire" and "never ran"
produce the same evidence. `compact-snapshot` (0 `PreCompact` events observed across 1.2M
tokens) and `gate-zerowork` ("never had to fire after the fix") become **separable facts**.

**Day 2 passes when** each of the eight measured-provenance tools has a fire count and a
denial count from real runs, and at least one previously-unscoreable tool moves off
`Unfired`/`No effect` on evidence rather than assertion.

---

## 4. Build order and change ledger

Order is forced by dependency: argv first (`t0-verify`'s parser is rewritten anyway), history
before `inspect()`, receipts before the hook measurement.

| # | Change | Files | ≈LOC | Serves |
|---|---|---|---|---|
| 1 | `lib/argv.mjs` + adopt | new + 15 entry points | 45 + 45 | D2 leg 1 |
| 2 | `score()` / `better()` | `t0-verify.mjs` | 25 | D1 metric |
| 3 | `wx` addressing + trial ordinal | `t0-verify.mjs` | 15 | I4 |
| 4 | `trials.jsonl` + `lib/ratchet-tree.mjs` + keep/revert | `t0-verify.mjs`, new, `SKILL.md` | 55 | D1 history + revert |
| 5 | `trial_history` in the order + schema | `compile-order.mjs`, `domain.schema.json` | 30 | D1 `inspect()` |
| 6 | stagnation breaker | `compile-order.mjs`, `SKILL.md` | 10 | D1 stopping rule |
| 7 | `hooks/lib/decision.mjs` + adopt | new + 11 | 35 + 22 | D2 leg 3 |
| 8 | literal invocation paths | 31 sites in `SKILL.md` / `references/` | 35 | D2 leg 2 |
| 9 | `stats --ratchet` / `--hooks` + harvest row | `stats.mjs`, `references/gates.md` | 40 | both exits |

**Total ≈ 230 LOC of implementation across 9 changes. Zero model tokens — nothing here puts a
model in the path.**

Changes **3 and 5 are hard-coupled** and ship in one commit (§2.2).

---

## 5. Test plan

Three new structural test files. Each executes the failing path rather than asserting about
source text — the standard `11-is-main.mjs` set.

| File | Asserts |
|---|---|
| `tests/structural/13-argv-contract.mjs` | For each of the 15 entry points: `--round` with no value, and `--round abc`, both exit 2 with non-empty stderr. No entry point writes an artifact on a rejected parse. |
| `tests/structural/14-invocation-paths.mjs` | Every `node .*scripts/.*\.mjs` occurrence in `skills/*/SKILL.md` and `references/*.md` is in the literal `"${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/…"` form. Fails on any bare or half-qualified path. |
| `tests/structural/15-hook-receipts.mjs` | For each of the 10 hooks + `validate-envelope`: (a) a valid payload, (b) malformed JSON, (c) a deny-triggering payload. A decision row exists in **all three**, and (b) records `verdict:"error"`. |

Extensions to existing suites:

- `04-oracles.mjs` — `better()` truth table incl. both `null` cases; `writeArtifact` called twice
  with identical `(round, attempt)` produces **two files**.
- `05-tech-lead.mjs` — `compile-order` with a 12-row `trials.jsonl` emits exactly 8, ordered,
  digest-truncated; with the file absent, falls back to today's output byte-for-byte.
- `08-docs.mjs` — the `N+ checks` floor in `docs/design/06-appendix.md` moves with the suite.

`docs/design/03-system-design.md` must gain entries for `lib/argv.mjs`, `lib/ratchet-tree.mjs`
and `hooks/lib/decision.mjs`, or `08-docs.mjs:125` fails the build.

---

## 6. Non-goals

| Not doing | Why |
|---|---|
| **A graph store / graph plane** | The paper's own §VIII.C: do not introduce a graph because the system has agents. Exactly one workload here has a graph-shaped need — `session-rehydrate`, which fires 3/3 and recovers 0/3 because it hands a *pointer* where a context builder should hand *state*. Build the store when that is built, not before. |
| **Parallel dispatch (roadmap Phase 3)** | The roadmap's own Amdahl table caps it at 3.3× with six human gates at 30 min, and its §4.1 predicts 𝒫 ≈ the number of vertical slices. Human gates are this product's thesis. Scope it to `--unattended` or cancel it. |
| **Entity resolution (roadmap Phase 5)** | The paper explicitly warns the commit DAG and the knowledge graph should not be collapsed. This system needs the **work-lineage** half. Canonical ids and alias sets over `entities: [Order, LineItem, Payment]` import the catastrophic-false-merge risk to answer queries nobody has asked. |
| **Any change to gate semantics or the envelope port** | Both are working. This plan adds a field to the order and an exit path to the hooks; it moves no boundary. |
| **Making `spec-evaluator` coachable, or touching the single-judge rule** | Out of scope and architecturally forbidden. |

---

## 7. Non-regression and what this incidentally lands

**Non-regression** follows the existing ✦/✚ convention — every new arm is skipped when its
artifact is absent:

- `trials.jsonl` missing ⇒ `compile-order` falls back to today's single-file read.
- `refs/shapeup/<scope>/kept` missing ⇒ no restore is attempted; behaviour is today's.
- `decisions.jsonl` unwritable ⇒ hooks still exit 0; the receipt is best-effort by design, since
  a receipt that can break a run would get the whole layer disabled.
- Old `r<R>-a<A>.json` artifacts on disk remain readable; `nextTrialNo` treats an unsuffixed
  file as `t0`.

**Incidental roadmap coverage.** `trials.jsonl` with `baseline_trial` is the versioned,
append-only artifact plane that roadmap **Phase 2** asks for (its largest single scored jump,
+11.4, because it repairs two invariants at once), and `decisions.jsonl` is the bounded
execution record its R5 dimension scores at half. Both arrive as a side effect of climbing
rungs 1 and 2 — at roughly a tenth of the quoted two weeks.

It also un-blocks **Phase 0**: `trials.jsonl` gives `q` (round failure rate) and the criterion
count `m` directly; `decisions.jsonl` timestamps give `h` (gate latency). Only `𝒫` still needs
the longest-path pass over `depends_on`.

---

## 8. Decisions needed before implementation

| # | Question | Recommendation |
|---|---|---|
| 1 | Does `better()` treat a **red-but-improved** attempt as `kept` (§2.4)? | **Yes.** This is the whole ratchet. Flagged because it visibly changes build behaviour: failing code now stays on the branch by design rather than by omission. |
| 2 | `no_progress_k` default | **2.** Tunable per run in the L0.8 matrix alongside `attempt_budget`. |
| 3 | Do the ratchet/hook aggregates go into the **committed** metrics shard? | **Yes** (§1). Both exit criteria are cross-run measurements; a local-only record cannot satisfy either. |
| 4 | Re-baseline the roadmap's GRS before funding Phase 1+? | **Yes.** Its audit covers 9 skills and a pre-envelope-port architecture; several scored deficits are already closed (`SUPERSEDES` exists as `ScopeContract.superseded_by[]`; `AgentRun` exists as `init-run`'s receipt). 49.8 scores a version that no longer ships. |

---

## 9. Provenance of the claims in this plan

| Claim | Source |
|---|---|
| `computeVerdict` returns booleans only; `better` absent from the codebase | verified in-repo — `t0-verify.mjs:98–111`; `grep` across `skills/` + `hooks/` |
| History reads exactly one prior attempt | verified in-repo — `compile-order.mjs:333` |
| `writeArtifact` clobbers; `parseArgs` accepts `NaN` | verified in-repo — `t0-verify.mjs:144–152`, `:160–173` |
| Only 2 files use `appendFileSync` | verified in-repo |
| 38 `$defs` / 30 `x-erd` relationships | verified in-repo — `domain.schema.json` |
| `.shapeup-sdlc/` gitignored as Tier-B rebuildable | verified in-repo — `.gitignore` |
| SKILL.md line refs (:218–221, :295–301), the 31-call-site census, the 26 denials, reproduced hook silence, per-tool Day-2 scores | rung diagnostic `05fa89b4`, reproduced against shipped scripts |
| 𝒫/f/q/m derivations, GRS, six-phase roadmap | *Mapping shapeup-sdlc onto a Graph-Engineering Architecture*, 31 Jul 2026 |
| Exit criteria, `ratchet_loop`, tool contract, five planes, traceability test | *Graph Engineering: The Karpathy Loop, Improved 1000× by Itself*, §II.D, §VI.A–B, §VI.G, Appendix Table VI |
