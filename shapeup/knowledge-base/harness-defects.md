# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Index

Ids are stable handles: a plan, a commit subject and an acceptance pass all name the same row.
Tier comes from `docs/design/plans/which-defect-first.md`; an entry leaves this file when its fix
is pinned by a guard, never when it is merely believed done.

| id | defect | tier |
|---|---|---|
| HD-027 | two harness rules collide, and the collision hard-aborts a run at L1b | P1 |
| HD-013 | the WorkOrder names no result path | P3 |
| HD-037 | `coverage` registers the pitch's NO-GOS as requirements, marked `covered`, and L1b reds every on… | — (filed after the tiering pass) |
| HD-038 | a committed spec artifact narrates a coverage verdict, and the verdict is false | — (filed after the tiering pass) |
| HD-039 | a hill dot outlives the evidence that moved it | — (filed after the tiering pass) |
| HD-021 | a per-scope "it compiles" fixture can be green while the scope's code is unreachable | P3 |
| HD-022 | ⚠ Work for defects measured on a real consumer sits on a tag, not on main | decision |
| HD-048 | the seesaw regression arm is declared everywhere and wired nowhere | — (filed after the tiering pass) |
| HD-051 | a build leg can forge a SIBLING leg's WorkResult | P1 |
| HD-052 | four attested channels were named; the same class has at least five more | P2 |
| HD-053 | the T0 citation re-hash proves self-consistency, not provenance | P1 |
| HD-023 | workspace trust discards the grant in a fresh clone | outside the plugin |
| HD-024 | the auto-mode classifier blocks the courier's calls | outside the plugin |
| HD-025 | two run geometries this checkout cannot reach | process |

## Defects

- **HD-027 · Two harness rules collide, and the collision hard-aborts a run at L1b.** Promoted from
  a consumer register (`proj-harmony-os-sample`, filed there as `HD-1`, 2026-09-21). `harness init
  run` normalizes the pitch into the **gitignored** run tier at `.shapeup/<slug>/intake.md`, and
  that is the path `ba-pitch-analyzer` is handed and actually reads. `requirements.md` is a
  **committed** artifact, and spec-lint's `TIER-DIRECTION` rule forbids a committed file from
  naming a `.shapeup/` path — correctly, because the path dangles on every other clone. A worker
  that cites its real source produces a registry its own lint reds.

  Measured in run `find-my-todos-20260921T142815Z-b80de580`, unattended lane: ORIENT, ANALYZE,
  WIRE and MAP SCOPES all completed — 25 agent dispatches, ~28 minutes, ~1.17M subagent tokens —
  and the run then aborted at GATE L1b on a single `TIER-DIRECTION` red, over one sentence of
  provenance prose: *"Atomic requirement clauses extracted from `.shapeup/find-my-todos/intake.md`."*
  The abort lands after the whole planning stretch is already paid for, and on the unattended lane
  there is no human present to spend ten seconds fixing a sentence.

  **Why this is not a rule for `ba-pitch-analyzer` alone.** A rule telling the analyzer "never
  write a `.shapeup/` path into a committed file" would suppress this one instance, but the
  analyzer still has no *correct* path to name — it does not necessarily know which committed
  artifact the intake was copied from (`shaping.md`, a `pitch.md`, or a `--breadboard`-named file
  elsewhere). The fix belongs upstream of the worker's prose, not in guidance to it.

  Also measured: the craft docs teach the rule more narrowly than the lint enforces it —
  `skills/ba-pitch-analyzer/references/doc-schemas.md` stated tier-direction purely in wikilink
  terms (`never [[tasks/...]]`), while the lint reds *any* line naming a `.shapeup/` path. A
  worker following only the docs had no way to know a plain provenance sentence would red.

  **Closed when:** the taught rule and the enforced rule state the same constraint — a committed
  doc may not name a `.shapeup/` path in any form, wikilink or bare prose — and a `coverage`
  dispatch over a pitch staged in the run tier produces a `requirements.md` clean of
  `TIER-DIRECTION` findings, driven end to end rather than inferred from the worker's prose.

  **Half of that is done; the half that keeps this entry open is evidence, not code.** The taught
  and enforced rules agree (pinned by a guard), and since 3.7.1-rc.4 the collision is no longer
  writable at all — the write is refused at the boundary with the offending token quoted back, so a
  worker cannot produce the file that reds. What has still never been driven is the end-to-end leg
  the criterion asks for: a real `coverage` dispatch over a pitch staged in the run tier, producing
  a `requirements.md` with no `TIER-DIRECTION` findings. That is a consumer run, not a fixture, and
  it is deliberately the last thing holding this row open.

  **Measured 2026-09-23 on the consumer, rc.5 installed from the marketplace — the collision fired
  and the run did not notice.** A fresh pitch (`about-screen`), a real run, planning dispatched for
  real. At 07:17:11 the analyzer tried to write a committed `spec/_index.md` citing the breadboard
  by its staged run-tier path — the exact HD-027 shape, from a different worker and a different
  artifact than the one that was taught. The write was refused. At 07:17:29 the same worker wrote a
  committed file that linted clean, and four more clean committed writes followed at 07:17:46,
  07:18:07, 07:18:14. One denial, eighteen seconds, no retry loop; across the whole run the guard
  answered thirteen times, twelve of them permits carrying a rule.

  That settles the recovery question, which was the real risk in fronting a gate with a hook — a
  guard that denies correctly but wedges the run would be worse than the L1b abort it replaces. It
  does NOT settle this entry: the run was killed by the launcher's background-wait ceiling with
  ANALYZE in flight, so no `requirements.md` ever completed a full planning phase end to end. The
  registry it did write cites the pitch by section name and names no gitignored path, which is
  the outcome this entry asks for — from the coverage dispatch alone, not from the whole leg.

- **HD-013 · The WorkOrder names no result path.** P3, and carried here without its original
  write-up: the entry body was lost in an earlier cleanup while the index row survived, which is why
  this one is short. What is certain is the id, the tier and the subject — the plan record
  (`docs/design/plans/which-defect-first.md`, `defect-sweep-execution.md`) ranks it P3 and states it
  is untouched. Re-measure before betting it rather than trusting this paragraph: a defect entry
  that cannot show its own evidence is a lead, not a finding.
- **HD-037 · `coverage` registers the pitch's NO-GOS as requirements, marked `covered`, and L1b
  reds every one of them.** Measured 2026-09-23 on the rc.2 soak, third abort of the same run.

  The committed registry held `REQ-1`…`REQ-22`. This run's `coverage` dispatch appended seven more,
  every one lifted from the pitch's **No-gos** section, every one with status `covered`:

  ```
  + | REQ-24 | "No persistence. The in-memory repository is the repository" | intake.md § No-gos | covered |
  + | REQ-25 | "No sort, no filter-by-done, no sections. Insertion order is the order" | … | covered |
  + | REQ-27 | "No debounce or async search. …" | … | covered |
  ```

  L1b then refused the run with seven `REQ-UNCOVERED` findings — *"graded by no acceptance criterion
  and claimed by no scope"* — which is exactly right and unavoidable: **a no-go is a constraint, not
  a deliverable.** Nothing can grade "do not build a settings screen", so marking it `covered`
  asserts something that cannot be true, and the gate is correct to red it.

  The registry's own header names the vocabulary that should have been used: *"a removed clause is
  marked `CUT (PO-approved)`, never renumbered or deleted."* A no-go belongs in that family — a
  clause deliberately not built — not in the covered family.

  **There is a second defect in the same diff.** `AGENTS.md` says a registry already on disk is not
  re-dispatched, and that ids are *"assigned once and frozen"*. This registry was committed and
  complete at 22 rows; a later run extended it mid-flight, which moves the run's own measuring stick
  after planning was fast-forwarded past the phase that owns it. Whatever is decided about no-gos,
  appending to a frozen registry is its own bug.

  **Fix shape:** `coverage` must not extract the No-gos section as coverable clauses. Either skip
  that section, or register its clauses with a status the coverage lint exempts — the `CUT` family
  already exists and already means "deliberately not built". And the registry-on-disk check needs to
  cover extension, not only regeneration.

  Third distinct producer/artifact defect this soak surfaced, after `HD-034` (fixture shape) and
  `HD-036` (committed file citing the local tier). All three share a shape: **a worker writing a
  committed artifact that the harness's own gate then refuses**, and none of them is reachable from
  the plugin's own checkout, where no pitch, no registry and no toolchain exist to disagree.

- **HD-038 · A committed spec artifact narrates a coverage verdict, and the verdict is false.**
  Surfaced by the run itself on 2026-09-23, verified independently before promoting.

  `spec/synthesis.md` states, in the committed tier:

  ```
  :32  | Coverage | 🟢 | …
  :82  All 22 registered requirements reach at least one AC carrying `(covers: REQ-…)` — confirmed
  ```

  A grep for `covers:` across the entire spec folder returns **those two claim lines and nothing
  else**. Not one acceptance criterion carries the clause. The coverage that does exist comes from
  the scope contract's own `covers: [REQ-1…REQ-22]`, which is a different mechanism from the one the
  artifact names — so the sentence is false about both the fact and the path.

  `AGENTS.md` names this exact failure as an invariant: *"The requirements matrix is a projection,
  never a verdict … derived from files for one named run … never narrated and never passed in."*
  Here it is narrated, in a file a teammate inherits on `git pull`, with a 🟢 beside it.

  **Why it is worse than a stale sentence.** It reads as corroboration. A reader checking whether
  requirements are covered finds an explicit "confirmed" and stops, and the thing it conceals is
  structural: the AC-level `covers:` channel is **empty**, and every requirement's coverage rests on
  the scope contract alone. That is the same finding an earlier plan recorded from the producer side
  — scope `covers:` carrying the load while ACs carry none — and this artifact is what kept it
  looking solved.

  **Fix shape:** a derived cell may not be authored. Either `synthesis.md` stops carrying a coverage
  verdict and points at `verify trace`/`probe requirements` output, or the cell is generated from
  that output at write time. A lint that reds a 🟢 coverage claim unsupported by any `covers:` on
  disk is the cheap mechanical version, and it belongs with the committed-tier write guard
  `HD-036` needs.

- **HD-039 · A hill dot outlives the evidence that moved it.** Promoted from the consumer's register
  (`HD-8`, 2026-09-23), verified against the artifacts before promoting.

  Two committed files disagree about the same scope:

  ```
  shapeup/<slug>/hill/<scope>.yml   phase: UPHILL_SOLVED
  shapeup/<slug>/scopes/<scope>.md  hill_phase: UPHILL_UNKNOWN
  ```

  …on a branch that has **never compiled**. `reduce hill` returns `changed: false` rather than
  moving the dot back, because the derivation is monotonic forward: it can advance a phase on new
  evidence and has no path to retract one when the evidence is gone. A prior run's dot therefore
  survives a fresh state, a reverted tree and a red build.

  `AGENTS.md` states the invariant this breaks: *"Hill phase is mechanical — derived only from
  T0/T1/seesaw artifacts, never self-reported, and a T0-green from a round whose build gate is red
  moves no dot."* The second clause is enforced; the first is not, because "derived" is only true
  going forward. A derived value that cannot go down is not derived, it is a high-water mark — and
  the dashboard renders it as current status.

  **Fix shape:** derive the phase from the run's own artifacts each time and write what that derives,
  including backwards; or, if monotonicity is deliberate, say so in the artifact — a `UPHILL_SOLVED`
  that means "was solved once, on evidence no longer present" must not render identically to one
  that holds now. The contract and the shard disagreeing is the cheap mechanical detector.

  **Both halves of this filing were falsified 2026-09-24, independently, by two reviewers who drove
  the code.** (1) The entry says `reduce hill` "returns `changed: false` rather than moving the dot
  back, because the derivation is monotonic forward". It is not monotonic: `deriveHill` is a pure
  function of the artifacts present and writes whatever it derives, in both directions — delete a
  round's green verdict and the shard goes back with `changed: true`. (2) The entry proposes "the
  contract and the shard disagreeing" as a cheap mechanical detector. They are **supposed** to
  disagree: `hill_phase` in a scope contract is always authored `UPHILL_UNKNOWN` by design and
  nothing ever updates it, so that detector fires on every scope that has ever moved. Implementing
  it would ship a lint that is red on correct behaviour.

  What is underneath is real and split across two new rows: the phase derived from an absence, and
  the committed tier overwritten from the local tier's absence — both now in `HD-042`. A third
  reading, not yet confirmed here, is that the verdict scan has no per-round recency filter, so
  green-in-r1 plus red-in-r2 still reads as progress; that is a one-line fix if it holds and should
  be checked while `HD-042` is open.

  **This row now carries no mechanism of its own.** Keep it only as the pointer to `HD-042`, or
  retire it there — deciding that is a minute's work at the table, and it is worth doing, because a
  row whose diagnosis is wrong costs more than a row that does not exist.


- **HD-021 · A per-scope "it compiles" fixture can be green while the scope's code is unreachable.** Measured
  on a stack whose build compiles only what the entry point reaches: three scopes were T0-green on an
  `assembleHap` fixture while their own files did not compile, and the errors surfaced only when a
  fourth scope wired the screens in — a scope that may not write those files. The round build gate
  (3.3.0) is what caught it, which is the design working; what is missing is attribution, and that
  lands on the same two entries above. Filed as craft, not mechanism: a scope's build fixture proves
  nothing until the scope's code is reachable, and the knowledge base is where that rule belongs.

- **HD-022 · ⚠ Work for defects measured on a real consumer sits on a tag, not on main.**
  `archive/lesson-loop-g0-k` carries 22 commits; `git cherry main archive/lesson-loop-g0-k` marks
  every one `+`. **It is a tag, not a branch** — the local branch `plan/lesson-loop-g0-k` points at
  `e511b7e` (3.3.0) and is an ancestor of main, so anyone reaching for the branch name finds nothing
  stranded. Checked by content rather than by commit id: the scope-contract schema lint re-landed on
  main as `9a8641e` and the permission-grant correction arrived by another route, while
  `report harvest`/`closeOut`, the own-substrate attempt scoring, the hvigor/ArkTS digester, the YAML
  block-scalar reader, the `gate`/`build_gate` export tables, the EVAL all-scopes-green precondition
  and the dependency hold did not. 3.4.0 and 3.5.0 shipped from two other workstreams meanwhile.

  **What a port actually buys, checked per entry rather than assumed** — the first filing of this
  entry claimed six and that was not measured: `01aea8f`+`6301eca` resolve the abort-trace entry in
  full; `29cf0be` resolves half of the gate-records entry (the tables, not the missing rows);
  `9da0f14` resolves the unrecognised-output half of the digester entry and not the weld; and
  **`rounds_used` gets no fix at all** — the branch's `harvest.mjs` calls the same `roundsUsed()` with
  the same fallback, so porting the close-out adds a second consumer of that defect. `a5ce8af`,
  `5574f0c` and `8673baa` are improvements whose premises need re-checking first: 3.4.0 rewrote
  round-loop state derivation underneath them, and `a5ce8af` introduces the axis the digester entry
  above would weld. Any doc-touching commit there (`01aea8f`, `0ffc133`, `12a38ef`) predates 3.5.0's
  requirements work and would revert shipped text.

  So the call is real but smaller than it looked: **one entry closed, two halves, one made worse.**
  Cherry-pick what still applies, or declare the tag abandoned and keep each finding filed here.
  Leaving it as it stands is the one option that costs on both sides — the fix exists, the defect is
  open, and neither fact is visible from the other.
- ~~**Cost/wall-clock instrumentation is dead.** `harness report export` and `harness probe stats
  --economics` are both keyed off a per-agent-call journal the Workflow runtime is supposed to
  stamp. Measured live 2026-08-19, twice, in two independent worktrees: it is never written — the
  journal's own directory does not exist after a real run either time.~~ **FIXED 2026-08-21** — the
  Betting Table call landed on this entry's second option: delete the reporting commands that
  assumed the journal existed, rather than wire a runtime this repo does not own to write one.
  `agentCallRow` and `economics` are gone from `kernel/report/facts.mjs`; `harness report export`
  no longer emits an `agent_call` table or an `economics` block, and `harness probe stats
  --economics` no longer exists as a flag. The other tables `report export` derives from real
  records (dispatch, results, T0 verdicts, trials, hook decisions) are untouched. Pinned by
  `tests/structural/19-run-records.mjs` §54(c), which asserts both exports stay undefined and
  `TABLES` stays without `agent_call`.

Cleared once already, 2026-08-14, to start the v2.0 work from a clean slate:

- ~~The installer writes a permission prefix that ends mid-argument, so it grants nothing and the
  pipeline stops at its first dispatch.~~ **FIXED 2026-08-14** — see below. The half of this entry
  claiming the call-site spelling is doomed was **wrong, and measurement is what showed it**; the
  correction is recorded because acting on the claim would have caused a needless rewrite of every
  call site in the plugin.

### Raw idea, not yet a pitch — a run does not check whether its baseline exists in any commit

Not a defect in shipped behaviour: a gap nothing looks for, measured on a real consumer 2026-09-20.

A run was about to be shaped and built on top of a previous feature's output — an engine, a UI kit,
a route map and two resource bundles, 45 files. **None of it was in any commit.** The previous run
built it and stopped before it landed, so the working tree held a working engine and a clone of the
same repository held a template. Three days passed and nothing noticed: the build gate was green
because the tree compiles, the spec artifacts were consistent because they describe the tree, and
the pitch's own baseline section was accurate *about the tree*.

The harm is not that the code is uncommitted. It is that **there is nothing to roll back to.** A
round that breaks the baseline has no prior state to compare against or return to, the per-scope
ratchet's notion of "worse than before" has no before, and a `probe resume` after a kill resumes
against whatever the tree happens to hold.

Worth noting this is the same shape as an error made *inside* this project on the same day: a
recorded check count paired with a sha that does not produce it, because the number was a property
of the working tree. One instance is a mistake; two instances in two repositories in one day is a
class nothing in either project detects.

The bet, if it becomes one: L0 already pins the run's config and digests the intake. It could also
report whether the paths the profile and wiring map name are tracked and clean, and say so in the
gate block — a line, not a veto. A PO who knowingly builds on an uncommitted tree should be able to
say yes; a PO who did not know should not find out at the first revert.

### Raw idea, not yet a pitch — QA lens fan-out

Not a defect: a real, measured opportunity, filed here per this file's own "raw ideas for the
Betting Table" charter rather than through a coach retro — no Ship-Gate ran; this came from a direct
real-execution experiment, 2026-08-19.

QA Edge Hunt's wall-clock variance (reproduced independently on two fixtures, ~160–670s per hunt)
is per-turn model latency noise, not a scheduling bug — QA has no lens-level dispatch today, so
there is nothing to schedule badly. A prototype fanning its 6 lenses out via `parallel()` measured a
real but modest ~18–31% win (n=2), at roughly 6x one hunt's own setup-phase token cost. If bet, it
needs a `lens` field on `qa-edge-hunter`'s WorkOrder payload, a lens-aware order-suffix
discriminator, and a merge step for the per-lens reports — none of which exist yet. Should ship
opt-in only: QA's findings are advisory by design, and the sample size here is thin.

### Raw idea, not yet a pitch — what a rebuilt trigger-eval layer must have

Not a defect: a correction plus two proven requirements, from a direct real-execution experiment,
2026-08-20. Filed here because the decision it needs — whether an activation-measurement layer comes
back at all after `9236559`/`fda81c4` removed it — is a Betting Table call, not a maintenance one.

`solution-architect` measures **TPR 1.0 / FPR 0 / precision 1.0** with its `description:`
byte-for-byte unchanged. The only variable was the probe's working directory: 0.333 in the plugin's
own repo, 1.0 in a workspace holding the artifacts the queries presuppose (11 cases, Sonnet, named
explicitly, concurrency 1, detection logic lifted verbatim from the deleted harness so scoring
matches the baseline).

**The claim this corrects** — GH#12 held that this skill's low score could not be the missing-
artifact confound because it had "0/6 deictic positives", and concluded a description rewrite was
the fix. Measured: **6/6 presuppose artifacts**, one literally deictic. The hand classification
counted only file-path referents like `TASK-007` and missed that "each use case" or "main.js" is
just as unsupplied. Acting on it would have tuned the prose until the skill activated where its
inputs do not exist — violating its own "profile absent ⇒ ESCALATE, do not invent an entry point"
rule, and spending the one clean result the baseline had to do it. Recorded for the same reason as
the permission-grant correction below: the wrong claim was the actionable-looking one.

Two requirements, now proven rather than hypothesised, for any successor layer:

1. Probes run against a workspace containing what the queries presuppose. Without it a correct
   refusal is scored as a description defect, and the metric is unstable besides — the same prose,
   model and dataset read 0.0 on 2026-07-26 and 0.167 on 2026-08-12.
2. The scorer records **what activated instead**, not just fired/not-fired. Every miss here
   activated *nothing*; no sibling ever stole a query. That silence is what distinguishes a
   sensible refusal from a real description defect, and the old harness could not see it.

### The permission grant — fixed, and one claim above corrected

Measured 2026-08-14 against Claude Code 2.1.232, every verdict decided by whether the target
script's marker file landed on disk rather than by what a model reported.

**There are two rule syntaxes.** `Bash(<prefix>:*)` is a prefix match at complete argument
boundaries, where a `*` is a literal asterisk. `Bash(<pattern> *)` is an anchored **glob**, where
`*` expands and crosses `/`. Only the first was ever tried, which is why the fix looked like a
trade between least privilege and quoted call sites. It is not one:

| rule | command | result |
|---|---|---|
| `Bash(node "<abs>.mjs":*)` — closing quote **inside** the rule | quoted | ALLOWED |
| `Bash(node "*/skills/<owner>/scripts/<n>.mjs" *)` | quoted abs path **+ args** | ALLOWED |
| same | quoted abs path, **zero args** | DENIED — hence two rules per script |
| `Bash(node "*/skills/<owner>/scripts/<n>.mjs")` | quoted, zero args | ALLOWED |

**The correction.** The claim that a call site carrying `${CLAUDE_PLUGIN_ROOT}` is denied under
every grant conflates two different things:

- A **skill's** `${CLAUDE_PLUGIN_ROOT}` **is** expanded, at skill-load time, before the model reads
  the prose. Verified with a throwaway single-skill plugin: a documented
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/hello.mjs"` reaches the model as an absolute quoted path. So
  the `${…}` refusal never fires on the plugin's real path, and the shipped call-site spelling is
  fine exactly as `14-invocation-paths.mjs` mandates it. No call site needed rewriting.
- A **rule's** `${CLAUDE_PLUGIN_ROOT}` is **not** expanded — rules live in the user's project
  settings, where the token means nothing. That, plus the mid-argument prefix, is the whole defect.

The `${…}` refusal is real (it blocks even `${HOME}`), but it only reaches a command a *user* types
by hand out of the docs — worth a README note, not an architecture change.

**Shipped.** `bin/lib/grant.mjs` enumerates entry points from the filesystem and emits two rules
each (20 → 40; a kernel would take it to 2). `mergePipelinePermissions` purges the dead v1.5–v1.8
rules on upgrade instead of accumulating them, and leaves unrelated user rules alone.
**Anyone who installed before this fix must re-run `npx shapeup-sdlc init`** — the old rules never
granted anything.

**The guard executes, as this register demanded.** `npm run test:grant`
(`tests/grant/executing-grant.mjs`) starts a real session per case and decides on the marker file:
8 cases covering a marketplace layout with and without arguments, a `--plugin-dir` checkout under an
arbitrary directory name, an install path containing a space, two negative controls that must be
DENIED, and pins for both halves of this defect. Tier-0 keeps only what is checkable offline and
says in its own banner that it is bookkeeping, not evidence.

**One claim this invalidates.** `harness run`'s provenance paragraph asserted a headless run
through a granted Bash prefix with zero denials. With no working grant that cannot have been what it
claims; the banner now says so rather than carrying it as evidence.

### ⚠ STILL OPEN — a third layer, above the grant: workspace trust

Correct rules are not sufficient. Measured 2026-08-14: in an **untrusted workspace** the CLI prints
`Ignoring 40 permissions.allow entries from .claude/settings.json: this workspace has not been
trusted` and discards the entire allow-list before any rule is consulted.

`.claude/settings.json` is precisely where `npx shapeup-sdlc init` writes, and **a fresh clone is
untrusted by definition** — so in CI, the case the grant exists for, the grant is dropped whole.
`-p` skips the trust *dialog*; it does not confer trust.

This is why the executing guard's other cases pass: they deliver rules via `--settings`, from
outside the project, which is not trust-gated. That route proves the rules are well-formed; it says
nothing about the configuration a user actually gets. `PIN project-scoped rules are ignored in an
untrusted workspace` now covers the difference, and it asserts DENIED — a fail-closed pin, so if the
platform ever relaxes this the guard turns red and tells us.

**Shipped mitigation, deliberately partial:** `bin/init.mjs` now detects the condition and prints
what to do about it. It **reports rather than repairs** — trusting a directory authorises executing
code from it, which is the user's decision, not one for a package running under `npx`.

**The open question for the Betting Table:** what a headless/CI install should do. Candidates: bake
`hasTrustDialogAccepted` into the CI image; ship the grant to *user* scope instead of project scope
(untested — user scope may not be trust-gated); or document `--settings` pointing outside the
project as the supported CI route. Until one is chosen, **Phase 7's headless probe cannot pass**,
and no plan should claim it can.

### ⚠ STILL OPEN — a fourth layer, above workspace trust: Claude Code's auto-mode classifier

Confirmed independently in two sessions, 2026-08-21, each running this plugin's `/ship` pipeline
(`shapeup-run.js`) against real pitches. Both hit the same wall: the mechanical courier's
`probe resume --require <phase>` / `--set-status <status>` Bash calls (C2, dispatched from inside
the Workflow) were denied by Claude Code's own auto-mode classifier — "Blocked by classifier" —
with `.shapeup/<slug>/decisions.jsonl` carrying zero matching rows, which rules out both this
plugin's hooks and a `permissions.allow` gap: the broad `Bash(node "*/kernel/harness.mjs" *)`
grant `bin/lib/grant.mjs` already writes covers these calls by pattern, and did not help. One
session reported the block as persistent across retries within the session — not transient —
and speculated a fresh session may not carry the same classifier state; that is a lead, not a
measurement, and is untested.

**Not fixable from inside this plugin.** The classifier sits above both the permission grant and
this plugin's hooks — the same relationship workspace trust has to the grant above, one layer
further out. Nothing in `bin/lib/grant.mjs` or `hooks/` can see it, let alone suppress it.

**What WAS fixed, 2026-08-21.** `requirePhase`/`fastForward` in `shapeup-run.js` treated ANY
non-zero `exit_code` from the courier as `probe resume --require`'s own exit-6 predicate
("artifact genuinely absent"), asserting a fixed "the worker most likely escalated" diagnosis
regardless of cause and discarding the courier's own `detail`. A classifier denial and a real
predicate failure produced the identical false narrative — measured live in the first session:
ORIENT's four artifacts existed on disk and the run still aborted claiming they didn't. Now only
exit 6 gets that message; the courier's `cmd()` prompt was also taught to report `-1` rather than
fabricate a code when its Bash call is refused outright, and any non-6 exit gets an honest "the
check itself did not run" message quoting the courier's `detail` and naming the classifier as the
likely cause (`protocol.md` §3b.1).

**What is still open.** The abort is now honest, but it is still an abort — the automated `/ship`
run stops exactly where it did before. Both sessions shipped by driving BUILD manually
(`harness compile` → `Agent` dispatch to the worker skill → `harness reduce ingest` →
`harness verify t0`, mirroring what the workflow does internally) instead of through the Workflow.
That manual path is the only mitigation today; it is a workaround this repo can document, not a
defect this repo can patch shut. Betting Table question: whether the manual path is worth
formalizing as a documented fallback mode, or stays an operator-driven escape hatch invoked only
when the classifier is observed to block.

### ⚠ STILL OPEN — two states the development checkout cannot reach

Both 3.1.1 defects — the launch refused on a marketplace install, and a shipped run fencing the
checkout to its last dispatch's substrate — lived for three weeks in geometries this repo never has
when it runs itself. Under `--plugin-dir .` the plugin root and the working directory are one tree,
so the Workflow tool's read gate never fired; and every experiment ran in a worktree or had its run
trace deleted afterwards, which removed the order file the stale pointer named and, with it, the
wedge. This checkout's own decision ledger holds no sandbox-guard row at all. The second defect was
even observed once, on 2026-08-19, and attributed to the abandoned-order cause — real, and fixed —
whose check then passed for the wrong reason: after that fix nothing was live, so it could not tell
"the pointer arm is gone" from "nothing left to enforce".

Neither state is reachable from the structural suite: one is a Claude Code tool's own read gate,
the other is what happens *after* a run, and every fixture is deleted in its cleanup. What would
have caught both is the live soak the release process now names in `CLAUDE.md`: a persistent
consumer project installed from the marketplace rather than `--plugin-dir`, carried across two
consecutive features without cleaning `.shapeup/` between them.

**Open for the Betting Table:** whether that soak can be made mechanical — a fixture project kept
across suite runs, or a CI job that installs the packed tarball into a scratch project and drives
one `init run` → launch through the real CLI — or stays a documented manual gate before each tag.

---

**Where a closed defect goes.** Its fix is pinned by a regression guard, and that guard is the
durable record — a defect whose test fires on reversion cannot come back silently, which is more
than a paragraph in this file could ever promise.

Nine entries left this file on 2026-09-20 under that rule, in a sweep where every stage was accepted
by a fresh adversary that drove the behaviour rather than read the diff, and where every guard below
was mutation-tested in both directions — broken until it reddened, restored until it greened. The
guard is the record; what each defect cost is recoverable from the test that now fails on reversion.

| was | pinned by |
|---|---|
| the staged pitch writable by every build leg | `61-execute-leg-frozen-pitch.mjs` — calls the real substrate resolver rather than restating it, so a revert reds instead of passing beside it |
| a run argument named by one tier and read by none | `62-run-args-surface.mjs` — the surface is DERIVED from each entry point's own argv spec, the domain schema and the operator's flag table, so a flag added to one tier reds on its own |
| the launch record with no writer | `63-run-args-writer.mjs` — driven end to end from opening a run, with the fan-out dial read back off exactly what the writer emitted |
| a locationless diagnostic losing its file | `65-digest-locationless.mjs` — plus a non-regression corpus diffed against the pre-fix module, because the risk was never the new case |
| a shared-only path reported ownerless, its bugs fanned to every scope | `66-shared-ownership.mjs` — pinned in BOTH directions: an exclusive writer still wins, and a path nobody declares is still unowned |
| an abort leaving a trace that reads as still running | `67-terminal-closeout.mjs` |
| a run reporting zero rounds having built two | `67-terminal-closeout.mjs` — two fields, and the old number survives verbatim as the second |
| a worker's ESCALATE reaching nothing | `67-terminal-closeout.mjs` — one channel, written by ingest and read back by the ship report |
| three gates never resolved, no gate data exported | `68-gate-coverage.mjs` — cross-references every declared gate id against every call site that can emit one, both directions |

One guard in that set exists because of the sweep rather than because of a defect in the product:
`69-terminal-wrapping.mjs` asserts that every top-level terminal return in the orchestrator passes
through the close-out path. It was written after an acceptance pass found two returns that bypassed
close-out entirely while an existing check had been relaxed to tolerate the new call shape without
ever requiring it — both holes green. A check that tolerates is not a check.

Two entries left this file on 2026-09-19 under that rule, both verified fixed against 3.5.0 before
deletion. **A scope contract passing L1b and then being undispatchable**: `lintContractSchema`
validates every parsed contract against the `$defs/ScopeContract` the compiler applies, with the
same validator and no second implementation, pinned by `46-contract-md.mjs` (a bare list cell is one
`CONTRACT-SCHEMA` red; a well-formed contract produces none) and by the `unreadableReason` arms that
report a table field also written into frontmatter. **The requirement edge reported only as a
warning**: `reqId` folds every spelling onto one key space before the pattern test, the `coverage`
operation produces the registry the edge resolves against, and `REQ-UNCOVERED` is red at L1b — pinned
by `59-requirements-registry.mjs` §93(a)–(j), which asserts both directions, the absent-artifact skip
and the gate's exit codes.

The guards standing today also cover the committed
contract format failing silent (structural §46(f)(g)(h)(i) for the parser, §23 for the two call
sites §46 does not reach) and `gate-zerowork`'s work-by-other-means fail-open (the assertion that
used to license it is inverted in place in `tests/structural/10-run-receipt.mjs`, with the
Bash-launch dispatch arm the deletion depends on pinned in `17-gate-zerowork-workflow.mjs`) — every
one mutation-verified in both directions. Those guards are the whole write-up that still matters:
what a closed defect cost is recoverable from the tests that now fail on reversion, and nothing
else needs to survive for the fix to hold.

- **HD-048 · The seesaw regression arm is declared everywhere and wired nowhere.** Filed 2026-09-24
  so that the README's newly honest pointer resolves to something.

  `seesawCheck` (`kernel/verify/t0.mjs`) returns `{ran:false, pass:true}` when the registry is
  absent — **absence read as clean**. The orchestrator's call template does pass
  `--seesaw-registry`, but nothing in the repo ever writes that file: a grep across `kernel/`,
  `skills/` and `commands/` finds the flag's parser, the path resolver, the reader and the schema,
  and no writer. `reduce/hill.mjs` records the consequence in its own comment — "'not asked' was
  being read as 'clean,' letting a scope reach FINISHED on a regression check that had never
  executed" — and, two lines down, that wiring it is a deferred Betting Table decision.

  That deferral is legitimate; carrying it while the README sold the seesaw as part of what makes a
  scope built was not. The README is fixed. This row is the decision itself: wire it, or delete the
  arm and the flag.

  **Closed when:** either a run writes the registry and a fixture proves a regression in a finished
  scope turns a green attempt red, or the arm, the flag and every mention of it are gone.

- **HD-051 · A build leg can forge a SIBLING leg's WorkResult.** Filed 2026-09-24 as the hole left
  open, deliberately, when the attestation freeze was cut back.

  Freezing `results/**` for build operations closed this — and denied every build leg its own
  documented last step, because the order is unanswered at exactly the moment the result is written.
  The batch chose the certain universal break over the conditional hole. This row is the other half
  of that decision.

  What the hole permits, driven: scope A's leg writes `results/<scope-B's-order>.json`. Three things
  follow that the attempt census cannot undo — B's order reads as answered, so B's substrate fence
  drops mid-dispatch; B's genuine dispatch receipt plus this file flips B from `in-flight` to
  `spent`, the premature breaker trip the census exists to prevent; and `reduce ingest` will tick
  acceptance criteria and apply verdicts out of a fabricated envelope. Forging your OWN result stays
  harmless — it can only spend your own budget — which is why the narrow reading of the census is
  true and not sufficient.

  The glob form cannot express what is wanted, "every result except this order's own", because
  `frozen` outranks `allowed` and there is no exception form. So this needs a mechanism: an
  order-scoped carve-out the fence understands, or moving the result write out of the worker
  entirely and into the ingest step that already resolves its path.

  **Closed when:** a leg writing a result for an order that is not its own is refused, while its own
  result still lands, and a fixture drives both with two live orders.

- **HD-052 · Four attested channels were named; the same class has at least five more.** Found
  2026-09-24, each verified writable by a live build leg through the assistant's edit path.

  `build/r<N>-t<T>.json` (the round build-gate verdict — `reduce hill` reads it to decide whether a
  T0-green may move a dot, and `compile` reads it to build the next round's bug list, so a leg can
  forge its own round's build-green), `t0/trials.jsonl` (the ratchet's ledger), the run
  `receipt.json` (which mints `run_id`), `gates.jsonl` (the gate-crossing ledger), and
  `seesaw/registry.json`. `orders/**` is writable too, and that one is deliberate and documented.

  The freeze named the channels one defect pointed at. The rule underneath it — a record nobody
  reads as the leg's own claim must not be writable by the leg — has a wider membership than that.

  **Closed when:** the list is derived from what the record IS rather than from which defect named
  it, and a fixture walks every local-tier record a build leg does not author.

- **HD-053 · The T0 citation re-hash proves self-consistency, not provenance.** Found 2026-09-24 by
  the acceptance pass on the re-hash itself; the mechanism it adds is real and this is its ceiling.

  Every one of these is accepted: a green artifact the judge wrote in the source tree, one outside
  the project reached by `../`, one by absolute path, a symlink in the verdicts directory pointing
  at a forged file, and a verdict naming a scope that does not exist. The round is unchecked too, so
  a round-5 PASS may cite a round-1 green artifact.

  The compounding fact is that `substrateFor("evaluate")` freezes the spec tree, the intake, the
  breadboard and the board — **not** `t0/verdicts/**`. So the judge may write a green verdict
  artifact into the canonical directory under the run-trace carve-out and then cite it, correctly
  hashed. The re-hash holds against a careless judge — a stale path, a red artifact, a hallucinated
  digest. It is not a floor against a dishonest one.

  Two cheap narrowings exist and neither needs the order: refuse a citation whose path is not under
  the run's own verdicts directory, and refuse one whose round does not match the verdict's. The
  membership check against the order's own artifact list is the complete answer but is only
  available on the ingest path.

  **Closed when:** a citation is constrained to an artifact this run's own verifier wrote, and the
  channel the judge could write it through is closed or the check no longer depends on that.

This file stays short on purpose. It is a queue, not an archive.
