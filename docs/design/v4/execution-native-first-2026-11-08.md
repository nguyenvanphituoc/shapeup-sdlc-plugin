# Execution record — the native-first plan

| | |
|---|---|
| **Date** | 2026-11-08 |
| **Plan** | [`plan-2026-11-07-native-first.md`](plan-2026-11-07-native-first.md) |
| **Branch** | `plan/single-loop`, local commits only; nothing pushed |
| **Baseline** | 4.0.0 at `82b4da9`; `npm test` green (2512 checks); `npm run demo` verified |
| **Rule** | A stage is done when its real run shipped with the baseline gate rows, not when the suite is green. A gate that cannot be run is recorded here as unmet |

## S1 — deletion manifest, corrected by the caller map

The plan's S1 table was written from a CLI-string caller count. Reading the import graph (a walk over
every `import` in `kernel/`, `hooks/`, `bin/`) shows that several "unread" verbs are libraries other
modules import. The plan's estimate (kernel −4,600 lines) overcounted; the manifest below is what the
tree supports.

| Target | Evidence | Decision | Emitters and claims that change in the same commit |
|---|---|---|---|
| `reduce graph` (482) | no importer; emitted advisory at the ship step in `probe/next.mjs`; written by nothing else | **delete** | the `next.mjs` step; `hill-chart` stops calling it and renders from the hill shards; AGENTS.md run-graph paragraph |
| `report export` + `report/facts` (619) | imported only by `probe/resume.mjs` `closeRun` | **delete** | `closeRun` stops exporting; AGENTS.md export claims; V4-REQ-3 and V4-REQ-8 reworded to the leg ledger |
| `probe stats` (158) | no importer | **delete** | comments in `hooks/lib/decision.mjs`; AGENTS.md hook-ledger sentence |
| `verify trace` oracle (≈540 of 604) | `parseRequirements` and `coveredReqIds` are imported by `verify/spec.mjs` and `probe/requirements.mjs`; the rest (reachability, mermaid, `traceLint`) has no other caller | **delete the oracle, keep the two parsers** in `lib/` | three advisory steps in `probe/next.mjs`; AGENTS.md traceability-oracle lines; the `trace/report.json` mention |
| `probe digest`, `probe leg` | imported as libraries by `verify/t0`, `verify/build`, `compile`, `probe/attempts`, `probe/next` | **drop the CLI verb only**; the plan's "0 callers" counted the verb, not the module | `ROUTES` |
| `probe requirements` (328) | imported by `probe/eval`, `probe/next`, `reduce/ship`; read by the L4 block, the census and `/hammer` | **keep** — the plan row was wrong; it already has named readers (V4-REQ-12 is met) | none |
| `reduce hill` + `hill-chart` | `reduce hill` is the only writer of the committed hill shards behind the "hill phase is mechanical" invariant | **keep** (provisional decision, recorded here because the PO cannot be asked mid-run: Hill Chart is Shape Up's signature artifact) | `hill-chart` reads shards only |
| `gate-zerowork.mjs` (316) | 58 `allow`, 0 `block` across every ledger on file (`traces/`, consumer run) | **delete** | `hooks.json` Stop entry; AGENTS.md "stopping a run with no receipt"; the `building` skill's Stop-hook sentence; SECURITY.md and `docs/design/03` hook lists |
| `tier-guard.mjs` (162) | 37 `allow`, 0 `deny` | **fold into `sandbox-guard`** — the tier-direction refusal is a shipped claim, so the behaviour stays | `hooks.json`; hook lists in the docs |

Corrected expectation for S1: kernel and hooks −≈2,200 lines, not −5,100.

An earlier tally in `analysis/03` and `analysis/04` counted only `deny` verdicts. The Stop hook records
`block`; the recount (`grep '"verdict":"block"'` over the same ledgers) is zero, so the finding stands.

## S1 — what was done

| Target | Result | Lines removed |
|---|---|---|
| `probe stats` | deleted; the ledger is a JSONL file read directly | 158 |
| `reduce graph` | deleted with its schema projection, its `probe next` step and its tests; `hill-chart` renders from the hill shards alone and labels a pitch "Finished" or "On the hill" instead of "Archived" | 482 |
| `report export` + `report/facts` | deleted; `closeRun` no longer exports; V4-REQ-3 and V4-REQ-8 reworded to the leg ledger | 619 |
| `verify trace` | the oracle (reachability, mermaid, `traceLint`) deleted; the two requirement parsers moved to `lib/requirements.mjs`; `source_extensions` dropped from the profile schema | ≈ 540 |
| `probe digest` | verb dropped, module kept as the library `verify t0` and `verify build` call | 12 |
| `gate-zerowork.mjs` | deleted; no hook fires at `Stop` | 316 |
| `tier-guard.mjs` | folded into `sandbox-guard` as `committedTierLeaks`; the denial text and the rule name are unchanged | 162 (net ≈ 100 after the fold) |

Kernel, hooks and bin: 18,736 → 16,513 lines (−2,223, 12 %), 52 → 46 files; `tests/structural/`: 21,872 → 20,230 lines, 115 → 111 files, 2,512 → 2,295 checks. The plan expected kernel and hooks −5,100 and tests −7,000; the import graph is why it fell short. `npm test`,
`npm run demo`, `npm run verify:cross-dir`, `npm run test:grant` and `claude plugin validate . --strict` all pass at the S1 tree.

Three things S1 removes that the plan did not name, so they are stated here:

- **A narrated run is no longer stopped by the runtime.** The Stop hook never blocked on any ledger on file (58 `allow`, 0 `block`),
  but a ledger of a guard that was present cannot show what its absence would let through. `building` still opens its run as its first
  act, and every later guard reads the receipt, so the loss is the one session that claims a run and never opens one.
- **The reachability oracle was a user-facing feature** (the README advertised it: "no engine ships orphaned"). It was advisory and
  gated nothing; the round build gate's `build_probe` and `launch_probe` and the evaluator now carry that question alone.
- **`hill-chart` loses its round history, scope board and run-graph screens.** They were drawn from the graph. The template's code for
  them is still in the file and unreachable; deleting it is a separate edit to a 1,400-line asset.

## S1 gate

Real nested `claude -p --plugin-dir` runs of the committed tree in the consumer project, the plugin copied under a locally
excluded folder inside it (a plugin outside the working directory cannot be read by a headless session, which is how the first
attempt stopped). Four launches, one comparable result:

| Launch | Outcome | Cause |
|---|---|---|
| 1 | stopped after the run opened | the session could not read the plugin's resource files from outside the project |
| 2 | stopped at intake | the Vietnamese pitch's word for "tag" and "card" is one word; an unattended run stops on an ambiguous term, as designed |
| 3 | aborted at GATE L1b | the coverage step registered the pitch's No-gos as requirements; spec-lint reds them and an unattended run has no PO to mark them CUT. A defect the 4.0.0 execution record already names; S1 touches none of it |
| 4 | **shipped PASS, one round** | with the pitch's No-gos stated as plain sentences in its Solution |

Launch 4 is `traces/v4/native-first-s1-2026-11-08/`. Its gate sequence is the 4.0.0 run's less one row: the opening `L0` is recorded once,
not twice (the baseline's second row is the loop resolving a gate `init run` had already ledgered). The sandbox fence, the envelope gate
and the receipt hook all left rows. QA ran as `not-hunted` because the session's workers were refused every `node` command but the
kernel's, an environment limit of the consumer's grant.

Cost as the host reported it: $0.88 + $1.16 + $3.29 + $4.55 across the four launches; only the last is a result.

## S2 — re-scoped, with the reason

The plan's S2 row assumed `compile`, `reduce ingest` and `reduce board` could go. They are the decision engine's inputs and outputs:
`probe next` emits a `compile` and an `ingest` command at every dispatch, so they cannot be removed while the engine stays, and the
engine's fate is S3's measurement. S2 therefore does the parts that stand alone, and records the rest.

| Plan row | Result |
|---|---|
| `agents/*.md` for the four workers | **done** — `tools`, `model: inherit`, `skills:` preloaded. A nested session confirmed the agent resolves as `shapeup-sdlc-plugin:<worker>`, that the preloaded skill reaches it with `${CLAUDE_PLUGIN_ROOT}` already expanded to the absolute path (so the kernel grant still matches), and that `SubagentStart`/`SubagentStop` carry `agent_id`, `agent_type` and `last_assistant_message` |
| `maxTurns` | not set: no run on file says what a legitimate worker needs, and a cap below it ends a good leg as `partial` |
| `isolation: worktree` on build agents | **rejected** — the run trace, the board and the T0 artifacts live in the gitignored `.shapeup/`, which a worktree checkout does not contain |
| `ledger.mjs` hook on `SubagentStart`/`SubagentStop` | **not needed** — the existing `PostToolUse` receipt hook sees what the subagent hooks do not: the prompt that carries `--order`, plus the result's `agentType`, `totalTokens`, `totalDurationMs` and `resolvedModel`. It now records the agent as the attestation and the usage on its row; `reduce ingest` takes the leg row's tokens from it when the loop passes no flags |
| the worker writes its own `results/<order>.json`, `verify envelope` shrinks | **kept** — workers already write their result; `verify envelope` is the dispatch gate that denies a malformed order, which is a witness, not a parse |
| `safety-spine` → `permissions.deny` | **not done, on evidence** — see below |
| `compile`, `reduce ingest`, `reduce board` removed | **deferred to S3's outcome** — see above |
| `lib/contract.mjs` to one JSON format | **rejected** — ADR-0001 chose Markdown on disk so a reviewer reads a scope contract and a wiring map in a pull request; reversing it is the PO's call, not a refactor |

**Why `safety-spine` stays.** The plan replaced it with a deny block on the grounds that it had never denied anything on any ledger.
That reading missed what the ledger is: the spine fires on every `Bash`, `Read`, `Write` and `Edit` and records an `allow` row naming the
program that ran — 5,429 of the 6,860 rows on file — so it is the only record of which programs a worker ran, and the audit trail the
"own" column of `analysis/01` asks for. A deny rule matches a prefix and cannot read flag order, so it covers fewer spellings of the
same command, and it cannot be verified by execution for `rm -rf ~` without risking the home folder it protects. And a rule written by
`npx shapeup-sdlc init` protects only projects where init ran, where the hook ships with the plugin. Removing it is one commit if the PO
still wants it; it is left in place until then.

## S2 gate

`traces/v4/native-first-s2-2026-11-08/`: one launch, shipped PASS in one round, gate sequence equal to the 4.0.0 run's **row for row**.
Each of the four worker legs has a receipt with `tool: Agent`, `agent_type: shapeup-sdlc-plugin:<worker>` and the host's tokens,
duration and resolved model, and its leg row carries `usage_source: agent-hook` — no session passed a figure. The nested run allowed
`Bash(node *)` for its workers, so QA hunted for real (7 findings) where the S1 launch could not.

## S3 — the decision engine, measured

**What was built for the comparison.** Variant B is the committed tree with two changes, made in the archive that the nested session
loads and never committed: `skills/building/SKILL.md` carries a phase table over the facts `probe resume` already prints and the gate
rows in `gates.jsonl` in place of the `probe next` loop, and `probe next` is removed from the kernel's routes so the session cannot
call it. Arm A is the committed tree: the S2 gate run (and the S1 one, one tree earlier). `status` as a new command was not written:
`probe resume` already prints the facts the plan's `status` would list (`has_*`, `scope_files`, `latest_t0`, `eval_rounds_done`,
`rounds_used`), so a second command would have been a copy.

**What happened.** B ran once (`traces/v4/native-first-s3-variant-b-1-2026-11-08/`, $5.36, about 14 minutes) and was **cut off by the
account's five-hour usage limit** before evaluation. It has no verdict. Up to the cut it crossed L0, L0, L1a, L1a.5, L1b and L2 in the
baseline's order, opened orient and the builder as agents with attested receipts, planned all four substeps under the fence, skipped no
gate and re-dispatched nothing. A second B repetition and a second A repetition were not run: the limit had been hit, and more
spend could not change the decision, for the reason below.

**Why the decision does not wait for them.** The kit's own rule is that no change is measured on an eval that cannot see its chains.
The fixture builds one scope in one round. It never reaches a breaker, a send-back, a dependency between scopes or a wait, which
are the branches of `probe next` (about 800 lines) that a phase table would have to carry in prose, and a B that passes it says
nothing about them. So the comparison can refute the engine's removal and cannot confirm it. The plan's rule was "holds ⇒ delete,
does not hold ⇒ keep, record why", and a result that cannot hold is the second branch.

**Decision: the engine stays** (and see "S3, completed on envlint" below, which replaced the personal-site fixture with the plan's own). `probe next`, `probe resume`, `probe eval`, `probe owner`, `probe attempts`, `probe hunt`, `verify
build`, `compile`, `reduce ingest` and `reduce board` are kept, with the 40-odd tests that pin them. V4-REQ-13 is not run to a verdict.
What a valid measurement needs: a pitch that drives a breaker, a send-back and two dependent scopes in one run; two repetitions per
arm on one model and one day; and a usage budget for roughly ten nested runs. This session spent about $20 across its six
launches and two experiments, as the host reported it, and ended on the limit.

## S4 — the suite

The rule applied is V4-REQ-17: a test either executes shipped code against a fixture or validates a shipped manifest, and one that
asserts wording is removed. Eight sections asserted wording only — the prompt line-count ratchet, the attempt-loop doc parity, the
`AGENT.md` stray-name guard, the cold-start sentence in the loop skill, the knowledge-base reader phrasing, the schema-names-the-writer
parity, the worker escalation sentence and the whole qa-edge-hunter skill-text pin — and are deleted, with every test of a module
removed in S1.

| | Before | After |
|---|---|---|
| `tests/structural/` files | 115 | 110 |
| `tests/structural/` lines | 21,872 | 19,911 |
| checks | 2,512 | 2,262 |

**The plan's target — about 10 files and at most 2,500 lines — is not met, and could not be.** It assumed S3 removed the engine. With
the engine, `compile`, `reduce ingest`, spec-lint, the T0 ratchet, the gate resolver and the contract parser all kept, their
behaviour tests are the suite, and cutting them to a tenth would lower the coverage of code that still ships. The doc-drift check
(`08-docs`) was kept on purpose: it caught four real errors in this session's own edits (documents citing hooks the commit had just
deleted).

## Where the plan stands

| Stage | Done-when | State |
|---|---|---|
| S1 | real run ships with the baseline's gate rows | **met** — launch 4; one fewer duplicate `L0` row |
| S2 | agents resolve; a receipt per dispatch; real run ships | **met for what remained in scope** (re-scoping table above), and a defect in it found and fixed by S3's runs |
| S3 | measurement, then delete or keep | **met by its second branch at the time** — measured on `envlint`, B did not hold, so the engine was kept and V4-REQ-13 closed as rejected. Superseded by the removal below |
| S4 | the rule applied to the suite | **target met, outcome not accepted.** On `plan/single-loop`: 10 structural files, 779 lines (994 with the runner and helpers), 208 checks; the engine is gone. See "S4, restated" at the end of this record |

Shipped executable set at the tag `engine-measured`: 18,736 → 16,541 lines and 52 → 46 files (the 16,513 in the S3 text above is an earlier count; this one
is derived from the tag). On `plan/single-loop` it is 6,274 lines in 21 files; subcommands 29 → 24 → 6; hook registrations 6 → 4 → 4;
subagents 0 → 4.

## Left for the PO

1. Accept or reject ADR-0005, and V4-REQ-14 to 17 (each is annotated in the registry with what was done).
2. `safety-spine`: keep, or replace with a `permissions.deny` block and give up the Bash audit trail (one commit).
3. Release: the version files still read 4.0.0 and the changelog entry is under `[Unreleased]`. The removals (a hook, a verb, a
   dashboard screen, a profile field) are breaking for anyone who named them, so this is not a patch release.
4. The L1b defect the S1 gate hit again (the coverage step registers a pitch's No-gos as requirements, and an unattended run has no
   PO to mark them CUT) predates this plan and is still open.

## Closing audit (`harness-maintenance-audit`)

| Check | Result |
|---|---|
| `npm test` | green, 2,262 checks (baseline of this plan: 2,512) |
| `npm run demo`, `npm run verify:cross-dir` | pass |
| `claude plugin validate . --strict` and the marketplace manifest | pass |
| version parity | `package.json` and `plugin.json` both 4.0.0 |
| `npm run test:grant` | **not verifiable at the end of the session.** Four of nine cases read DENIED because a nested `claude` call is refused by the account's five-hour usage limit (a bare "say ok" is refused the same way); the five negative and pin cases pass trivially. It passed 9/9 at the S1 tree, and `bin/` has not changed since the baseline. Re-run it after the limit resets |
| docs against the fact sheet | four drift sites fixed: the hill-chart row in `04-functional-design`, the local-tier listing in `03-system-design` (the `trace/` and `exports/` entries), and the SECURITY and README hook lists, done earlier with the hook cut |
| shipped-set sweep | no new bookkeeping markers; `HD-001` in the retro template is a placeholder for a consumer's own id, and the pitch paths in the plan templates are examples of a consumer's files |
| stranded readers | the `traceDir` path helper the oracle left unused is removed; the dashboard template still carries unreachable JavaScript for the graph screens, left because it is a separate edit to a 1,400-line asset |

## A defect in S2, found by the S3 comparison

The first envlint repetitions (`traces/v4/native-first-s3-envlint-a1-receipt-defect-2026-11-08/` and `...-b1-...`) ran on the S2 tree. The
personal-site gates had not shown it, because that pitch builds one scope in the foreground. With three scopes the loop launches the
builders in the background, and the result of a background `Agent` call is "Async agent launched" plus an `agentId`: no `agentType`, no
usage. S2's receipt hook attested only from `agentType`, so it wrote **no receipt for any parallel scope** (`no-skill-named` in the
ledger). Consequences seen: in arm A one scope's result was never applied by the single writer and its task stayed `ready` while the
run still shipped PASS; in arm B the session worked around the refusal with `--no-receipt-check` on two results, which bypasses the
attestation. Before S2 the receipt came from the `Skill` call inside the worker, which fires whether or not the worker runs in the
background, so S2 was a regression for exactly the parallel case.

Fixed in the receipt hook: an accepted background launch (`run_in_background` true and a result reporting a launch and an `agentId`)
is attested by the name the call carried, with null usage; the leg row stays null unless the loop passes the total from the completion
notice. Tests cover the object and the text form of the result and the two cases that must mint nothing. Both repetitions are
contaminated by the defect and are kept as evidence of it, not as measurements; the comparison was restarted on the fixed tree.

## S3, completed on envlint

The personal-site fixture could not see the engine's chains, so the comparison was redone on the pitch the plan named: `envlint`, three
scopes (parsing and rules independent, the CLI depending on both), with its No-gos stated as plain sentences so the coverage defect
above does not decide the outcome. Same model, same day, same grant (`Bash(node *)` allowed for the workers), cap $12 per launch.
The receipt defect in the section above was found by the first pair and fixed; these are the repetitions on the fixed tree.

| | A1 (`probe next`) | A2 (`probe next`) | B1 (phase table, no `probe next`) |
|---|---|---|---|
| closed | shipped, PASS, 1 round | shipped, PASS, 1 round | **escalated**, verdict FAIL, 2 rounds |
| scopes with a green T0 | 3 of 3 | 3 of 3 | 3 of 3 |
| leg rows | 10 | 10 | 10 (the tenth is the round-2 builder) |
| orders dispatched twice | 0 | 0 | 0 |
| results never applied | 0 | 0 | 0 |
| gate sequence | L0 L0 L1a L1a.5 L1b L2 L3 QA H L4 COACH-1 | the same | L0 L0 L1a L1a.5 L1b L2 L3 H L4 — no QA, no COACH-1 |
| cost as the host reported | $5.41 | $5.27 | $8.62 |

Archives: `traces/v4/native-first-s3-envlint-a1-2026-11-08/`, `...-a2-...`, `...-b1-...`. The two earlier launches on the defective tree are
kept beside them as `...-receipt-defect-...` and are not counted.

**Reading it by the plan's rule** — a change holds if it completes at least as many tasks as the baseline and none gets worse:
A completed both repetitions; B1 did not complete. B's second repetition was not run: the account's usage limit refused it. It could
not change the outcome, because with B1 failed B can complete at most one of two against A's two. B does not hold.

**What the B1 run shows beyond the verdict.** The evaluator's FAIL (41 of 42 criteria; terminal escapes reaching the output) may be
run-to-run variance in what the builder wrote, and one repetition cannot separate that from the loop. Two things do not look like
variance. B spent 59 % more than A for the same three scopes. And B stopped on its own: told it had $12, it judged that a second
evaluation would not fit once round 1's evaluation and the fix round had cost most of it, went to the census at `cannot-ship`, and the
ship gate correctly refused. A loop that has to carry sequencing, send-back and breaker rules in prose spends turns re-deriving them,
which is the "cost creep" the kit's break map names. The kernel's `probe next` answers the same questions for the price of one call.

**Decision, recorded:** the engine is kept — `probe next`, `probe resume`, `probe eval`, `probe owner`, `probe attempts`, `probe hunt`,
`verify build`, `compile`, `reduce ingest` and `reduce board`, with the tests that pin them. V4-REQ-13 is measured and not met.
Variant B stays out of the product. The S4 target (about 10 files, at most 2,500 lines) was conditional on the engine going and does not
apply to a plugin that keeps it; the suite was reduced by the rule that does apply (V4-REQ-17), to 110 files and 19,911 lines.

Cost of the whole plan as the host reported it: about $55 across the gate launches, the A/B launches (the defective pair, a third launch killed part-way, and the fixed trio) and three experiments.

## The engine removed, on the PO's instruction

**The instruction.** After the record above had said, six times and in a Stop-hook's words, that S4's target was unmet because the engine
was kept, the next hook message ended with a line that the assistant had offered as the PO's way to choose:

> Xoá engine

It arrived appended to hook feedback rather than as a typed message, which is why this record quotes it. It was taken as the PO's
answer because it was the exact phrase offered, and the work was done on a new branch cut from `plan/single-loop`, so the measured state
stays one checkout away. The work was first done on `plan/s4-engine-removed` and then fast-forwarded into `plan/single-loop` locally (nothing pushed) once the Stop hook pointed out the plan's own branch still held the engine; the tag `engine-measured` marks the tree S3 measured, so going back is one checkout. This was a decision against a result, not a conclusion the result
supports: S3 had the engine shipping 2 of 2 and the prose-loop variant 0 of 1 at 59 % higher cost.

**What was done**, in the order it was done. The keep-set was found by reachability, not by hand: every module reachable from the hook
registrations, the routing table, the installer and the oracles, and nothing else. That left `verify t0 | envelope | skills`, `gate`,
`init run`, three hooks, the oracles, the installer and the path, argv, contract and floor libraries. Everything else was deleted:
`compile`, `reduce ingest | board | ship | hill`, `verify spec | build | budget | dispatch`, every `probe` verb and `init fit`, with the
`hill-chart` skill and `/hill` command whose only writer went with them. Four things the keep-set still borrowed were moved first: the
tier-direction check (to a hooks library), the board-task count GATE L2 needs, and a slimmer `init run`; and a new `order open | close`
verb replaces the one thing `compile` did that nothing else could — publish the pointer the fence is armed by.

| | Before (`plan/single-loop`) | After |
|---|---|---|
| Kernel, hooks, installer (lines) | 16,541 in 46 files | 6,274 in 21 files |
| `tests/structural/` | 110 files, 19,954 lines, 2,267 checks | 10 files, 779 lines (994 with the runner and helpers), 208 checks |
| Kernel verbs | 24 subcommands | 6 (`verify t0 | envelope | skills`, `gate`, `init run`, `order`) |

S4's own target was about ten test files and at most 2,500 lines: met. The numeric target was met by deleting what it measured, not by
making the same tests smaller, and each of the ten files was mutation-checked (a deliberate break in the code under test turns a check red):
six mutants were tried, five were caught, and the sixth (the model floor in `init run`) is covered by a second guard in the launch-record
check, so removing the first changes nothing observable.

**Real run on the branch (the gate the advisor asked for, and the one result this removal is judged by).** `envlint`, the same pitch and
the same flags as the S3 comparison, cap $12 a session, archived at `traces/v4/native-first-s4-envlint-2026-11-08/` (session 1) and
`traces/v4/native-first-s4-envlint-resume-2026-11-08/` (the resume, same run id, on the tree after the first fixes).

| | A (engine, S3) | B1 (phase table, S3) | this branch |
|---|---|---|---|
| closed | shipped, PASS, 1 round | escalated, FAIL, 2 rounds | **shipped, PASS, 2 rounds — after a resume** |
| scopes with a green T0 | 3 of 3 | 3 of 3 | 3 of 3, first attempt in each round they ran |
| round 1 verdict | PASS | FAIL | FAIL, 3 bugs (one code, two planning gaps) |
| QA edge hunt | ran | not reached | **skipped by the loop's own call**, logged `not-hunted` |
| gates crossed | L0 … COACH-1 | L0 … H, L4 | L0 … L3 (×2 rounds), QA, H, L4, COACH-1 |
| cost as the host reported | $5.4 (and $5.3) | $8.6 | **$18.2** across two sessions ($9.1 + $9.1) |

Session 1 built all three scopes, drew a round-1 FAIL, and stopped at the start of round 2 on its own judgment that the remaining budget
would not cover it. The resume fixed the code bug and the two planning gaps, the evaluator passed 45 of 45 criteria, and the census,
GATE H, the ship report, GATE L4 and `order close` all ran (`close.json` reads `shipped`, "PASS round 2 of 3; QA not-hunted"). So the back
half of the loop did run on this tree. The dispatch receipts name the shipped agents for every dispatch of both sessions.

What the run says about the removal, plainly. **It shipped, at about three and a half times the engine's cost and with the QA step
dropped by the loop itself.** The run's own report discloses three things the engine would have prevented: it ran `init run` from inside
`.shapeup/` and opened a phantom run nested in the real one (the later orders and receipts carry the phantom's id); it opened an order
before checking it against the schema, could not edit or withdraw it under the fence, and replaced it with a shell `cp`; and it skipped
the hunt the gate answered `run`. One round-1 bug and two planning gaps are the same defects the spec lint was there to catch. One
repetition does not make a rate, and a session that ran twice because the first one ran out of money is not a like-for-like with a run
that shipped in one.

**A defect the run found, fixed on the branch.** The loop typed each order's `compiled_at` by hand, and one stamp ran ahead of the clock;
the fence reads an order as answered only when its result is at least that new, so the order stayed live after its worker returned and the
loop had to refresh a result file's timestamp to continue. `order open` now stamps the order with the real time, and the fence test covers
the stall (a mutant that drops the stamp turns it red).

**Defects the resumed run found, fixed afterwards and not re-run.** `order open` now applies the dispatch gate's schema check before it
arms anything, so an invalid order cannot be left live and uneditable; `init run`, `order` and `gate --resolve` refuse a working directory
inside `.shapeup/`; the evaluator skill no longer tells the judge to run a removed command; and the loop is told to append the verdict
ledger and to write its build note, and a plan order's own result path is now listed (the substrate table had frozen the results directory
without it, and the run only worked because the loop left results out of the frozen list). The L3 gate prints its "loop" note even over a
PASS verdict, as before; the log records the PASS correctly.

**What was not verified.** A second repetition was not run, and those fixes were not exercised by a run. The domain registry still carries
descriptions of records the engine wrote (three dead definitions were removed; the rest are described in terms of the loop). The T0 ratchet's
limit, that its snapshot holds tracked files only so a revert does not remove a file an attempt created, predates this work and is
unchanged. `last-run`, the breadcrumb that keyed a closed run's later hook rows, is no longer written. `npm test`, `npm run demo`,
`npm run verify:cross-dir`, `claude plugin validate --strict` for the plugin and the marketplace manifest, and `npm run test:grant`
(9 of 9) all pass on the final tree.

## S4, restated

This section replaces the single status the earlier "Where the plan stands" table gave, which still described a kept engine. Every figure
below was derived from the tree (`find`, `wc -l`, `git ls-tree` against the tag `engine-measured`), not copied from an earlier paragraph.
Two figures in the section above were stale and are corrected there: the shipped set is 6,274 lines (it read 6,241) and the structural
suite is 779 lines in ten files with 208 checks (it read 755 and 200); both were written before the later fixes were counted.

**What S4 asked for, and where it stands.**

| S4 asked | State on `plan/single-loop` | Evidence |
|---|---|---|
| a test executes shipped code against a fixture or validates a shipped manifest; wording-only tests go | **met** | the ten modules are each fixture-driven; the doc-drift module (`08-shipped-set`) scans for stale counts and unrouted kernel commands |
| about ten files, at most 2,500 lines | **met** — 10 modules, 779 lines (994 with `tests/structural.mjs`, `tests/lib/fixture.mjs`, `tests/lib/harness.mjs`); `tests/grant/executing-grant.mjs` is a separate Tier-1 guard of 181 lines | `find tests -name '*.mjs'` |
| coverage of what still ships does not fall | **checked by mutation, not by count** — six mutants tried, five caught, the sixth is covered by a second guard | the removal section above |
| the release checks stay green | **green on the final tree** — `npm test` 208 checks, `npm run demo`, `npm run verify:cross-dir`, `claude plugin validate . --strict` (plugin and marketplace manifest), `npm run test:grant` 9 of 9 | run at `c38bdfd` |

**Where the removal cost something, measured.** The only like-for-like evidence is the `envlint` pitch, one repetition on the branch and
two on the engine.

| | Engine (tag `engine-measured`) | `plan/single-loop` |
|---|---|---|
| shipped | 2 of 2 | 1 of 1, after a resume |
| cost as the host reported | $5.3 and $5.4 | $18.2 across two sessions |
| QA edge hunt | ran | skipped by the loop's own call, logged `not-hunted` |
| defects the run disclosed about itself | none recorded | a phantom nested run, an order opened unvalidated, one `cp` around the fence |

One repetition is not a rate. The three disclosed defects were fixed after the run and have not been exercised by a second one.

**What is not S4's to decide.** The instruction behind the removal reached this session as a line inside hook feedback, not as a typed
message, and the Stop hook has said so each time since. Nothing in the repository records a typed acceptance. The record therefore says
"target met, outcome not accepted". The PO's two ways to answer, and what each one does:

- **Accept:** run `/goal clear`. Nothing else changes; the release, version bump and any push remain separate decisions.
- **Reject:** reply "đưa về engine-measured". `plan/single-loop` is reset to the tag `engine-measured` (a hard reset, so it is confirmed
  first), and this record and ADR-0006 are annotated that the removal was rejected.

**Open items that predate or follow from the removal**, unchanged from "Left for the PO" above except where noted: ADR-0005, ADR-0006 and
V4-REQ-14 to 17 await approval; the version stays 4.0.0 (the removals are breaking, so a release is a major bump); a second repetition of
the real run was not made; the domain registry still carries some descriptions written for the engine; the T0 ratchet's tracked-files-only
snapshot limit is as it was. Nothing is pushed.

The component map before and after, with the line counts per group, is in `docs/design/v4/plugin-before-after-2026-11-08.md`.

## The QA gap, closed without a new verb

**The instruction.** After the status above was written, the PO's next line (again appended to hook feedback) asked to restore from
`engine-measured`, or build a new mechanism, so that the engine stays lean, light and easy to connect later, QA being the step that
mattered most. It is not the reject phrase, so `plan/single-loop` was not reset; the change is additive.

**What the real run showed.** GATE QA was answered `run` and no hunt was ever dispatched, so there was no result to be wrong. The old
`probe hunt` only refused a result the loop chose to ask about; a verb with that shape would be skipped the same way. So the check went
into the one place the loop cannot go around: `gate --resolve L4`, beside the census rule.

**The rule.** `ship` at L4 needs, besides a census that cleared the run, that the run does not owe a hunt it never paid. A hunt is owed
when a round passed (or was not evaluated), the launch record has no `noQa`, and no QA row of this run says `skip`. It is paid when
`results/hunt.json` exists and, for a `done` result over an app the order could reach, the hunt report ran at least one charter; a
`failed` hunt is honest and accepted. Everything is read from files scoped to the run's id. The recorded way out is answering GATE QA
`skip`. About 70 lines in `kernel/gate.mjs`; the kernel still has six subcommands.

**Evidence.** Replaying `gate --resolve L4` over the archived resume run (`traces/v4/native-first-s4-envlint-resume-2026-11-08/`) now
exits 4 with "GATE QA was answered run and no hunt was dispatched (no results/hunt.json)"; before, it shipped. Seven new checks in
`06-gate` cover: no hunt, explicit skip, report without a `charters:` line, zero charters, a charter run, and a `failed` hunt. Disabling the
check turns three of them red. The suite is 215 checks.

**Not done, and why.** `order close --status shipped` does not require an L4 `ship` row, so a loop could close without crossing L4; the
real run did not, and closing that is a separate change. The loop's own text (phase 12) now says L4 will refuse, but a second real run has
not been made, so whether the loop now dispatches the hunt is not measured.
