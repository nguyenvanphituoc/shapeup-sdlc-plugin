# Constraints check — what in the repo bites the single-loop plan

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Baseline** | 3.18.4 at `0081c38`; `npm test` green |
| **Checked** | ADR-0001, ADR-0002, ADR-0003; `CLAUDE.md` and `AGENTS.md` rules; the 7 hooks and their tests; the structural suite; CI and release workflows; `SECURITY.md`; `docs/upgrading.md`; the frozen `scripts/` |
| **Against** | `plan-2026-11-07-single-loop.md`, `proposal-2026-11-07-activity-layout.md`, `review-2026-11-07-single-loop.md` |
| **Method** | read, grep and count, plus one executed fixture (C4). Anything not marked *measured* is a reading of the code |

## 1. Verdict

No ADR forbids the plan, and no hook is keyed to anything it changes except two. But four of the
plan's own claims are contradicted by constraints already in the repo, a fifth (the hook reader the
plan deletes and then relies on) contradicts itself, and two process rules (an ADR and a major
version) were left out. None is fatal. Each changes the plan, and the first
changes its central design choice.

| # | Finding | Severity | Plan section it corrects |
|---|---|---|---|
| C1 | The loop-as-prose reverses a deliberate, recorded decision, enforced by a test | **changes the design** | plan §4, §5.1, §5.2 |
| C2 | `gate-zerowork` cannot shrink the way the plan says: its predicate is "orchestrator dispatched AND no receipt" | **plan is wrong** | proposal §4.2, plan A4 |
| C3 | `run-args.json` is read by the ship report as a false-green guard, and the model floor lives only in the script | **plan drops two guards** | plan A5, review §5-A |
| C4 | Folding planning removes the substrate fence on planning writes. *Measured* | **plan claims "invariants unchanged"** | plan §4, §5.6 |
| C5 | No ADR, no major version, no release activity | process gap | plan §3 |
| C6 | The installer deletes a user-owned permission token | surgery violation | plan §5.6 |
| C7 | The test suite is the most precise spec of what the script guarantees, and the plan treats it as deadweight | risk | plan A7, §5.8 |
| C8 | The plan deletes the hook-ledger reader (`probe stats --hooks`) in A6, then uses it as the "done when" for A4 | **plan contradicts itself** | plan A4, A6, §8 |

## 2. What bites, with evidence

### C1 — the ratchet records that prose orchestration was tried and replaced

`tests/structural/08-docs.mjs` section 25 holds `LINE_RATCHETS = { "tech-lead/SKILL.md": 155 }`.
Its comment is the record: the ratchet went 450, 460, 480 and then was **lowered to 155 at the
orchestrator cutover**, with the reason inlined so the number cannot be separated from it — the
orchestration logic moved out of prose into `shapeup-run.js`, and "new orchestration logic going back
into SKILL.md prose" is the regression the ratchet exists to catch. `commands/build.md` repeats it:
a session that rebuilds the round by hand "is the prose lane the cutover replaced". The comment also
cites a measured cost of unwritten procedure (82 to 120 turns before the first write; relayed from
the comment, not re-measured here).

The plan's loop is exactly that prose, written as `building/SKILL.md` plus nine resources, with
steps 0 to 8 (plan §5.2) as instructions. Three things follow:

- The test fails by construction: the ratcheted path will not exist (`fail("ratcheted file missing")`).
  The repo's own rule says never make a red check green by weakening it, so the 155 must move to the
  new path unchanged and the new file must fit it.
- The script is not only a courier network. By its post-conditions and its "sent back once" branches
  it holds the fixes of releases 3.15 to 3.18: a planning leg with no result is dispatched again once;
  a pass that leaves a named dimension ungraded is sent back; a verdict anchoring no criterion is sent
  back; a hunt that ran no charter is sent back; a QA leg nothing applied is named at the close.
  Each is code today and would become an instruction the model may skip.
- `AGENTS.md` says "Invariants live in the runtime, not this file". A prose loop moves a dozen of
  them out of the runtime.

### C2 — `gate-zerowork` needs its dispatch detector

`gate-zerowork.mjs` blocks Stop when `dispatchedOrchestrator(events)` is true and no receipt
exists. The plan removed "the orchestrator-dispatch detection". Without it the predicate is vacuous:
a session that never opened a run has not done "zero work", it has done nothing it was asked to.
What actually changes is the key: keep the leading `/ship` arm (already anchored to the start of the
message) and the `Skill` arm, rename `tech-lead` to `building`, and drop only the `Workflow` and
Bash-launch arms. Test `17-gate-zerowork-workflow` pins the three spellings. The hook is the one
blocking hook `SECURITY.md` item 5 promises, so it stays near 200 lines, not 60.

### C3 — two guards live in what the plan deletes

- `kernel/reduce/ship.mjs` (`evalWasSkipped`) reads `run-args.json` and refuses to freeze a PASS
  report for a run launched with no evaluation, matching the record to the receipt's run id. `init
  run-args` is the sole writer. Deleting it deletes that false-green guard. `probe concurrency` also
  reads it, but that one goes with the module.
- The model floor (`belowFloor`, a denylist of cheap tiers refused for exec and eval) exists only in
  the script, the domain schema, and tests `16-workflows`, `26-model-floor`, plus two region helpers.
  The loop has no equivalent. Whether the floor survives is a product decision, not a code detail.

### C4 — planning writes lose their fence

`hooks/sandbox-guard.mjs` enforces each order's substrate (`allowed`, `append_only`, `frozen`) for
**every** operation; its header says the older design left `analyze`, `wire`, `evaluate` and others
unfenced and the compiler's `frozen` surfaces had no enforcer. Planning today runs under orders, so
the spec tree, the board and the staged pitch have write contracts. Once the loop writes them with no
live order, the operator's own session (no agent id) meets no contract at all. `tier-guard` still
checks committed-file content for run-trace paths and board ids, and nothing else. The loop's own
writes are otherwise not blocked: the sibling-result rule exempts a write with no agent id.
*Measured, 2026-11-07:* a scratch project with a run receipt and no live order, and a `Write` into
`shapeup/demo/spec/domain-model.md` piped into the hook. Verdict `allow`, rule `no-round`, reason
"no active-order pointer — no tracked task running", exit 0. That is the state the plan puts every
planning write in. The fence does fire on these paths today: the nine archived ledgers hold 7
denials on committed-tier writes (the project profile three times, a use-case file twice, a scope
contract, the knowledge base), each a write made while some order was live.

### C5 — governance the plan skipped

- ADR-0002 states the repo's rule: once a plan ships, the decision goes to an ADR and the working
  record is retired (the `docs(plans)` commit `89b74cf` did exactly that). This folder is the working
  record. The plan reverses the decision `docs/design/03-system-design.md` section 3.5 records ("one
  workflow launch, not a turn-by-turn drive"), so it needs ADR-0004 with `Supersedes` naming it.
- The plan removes skills, commands, a hook and the `/tech-lead` entry point that the shipped
  `AGENTS.md` block splices into consumer projects. That is a breaking change: major version, both
  `package.json` and `.claude-plugin/plugin.json`, a `CHANGELOG.md` entry. `release.yml` fails a tag
  that matches only one. CI also runs `claude plugin validate . --strict` on the new skill's frontmatter.
- Docs the drift check ties to the filesystem: `README.md` ("13 skills, 11 slash commands"),
  `docs/design/03-system-design.md` ("17 operations", "10 worker skills"), `docs/design/README.md`,
  `docs/design/07-domain-erd.md` (generated from the schema), and the four-way agreement between
  `hooks/hooks.json`, `README.md`, the design doc and `SECURITY.md`. `AGENTS.md` carries eight lines on
  the workflow, relaunch and staging that become false.

### C6 — the `Workflow` grant is not the plugin's to delete

`bin/lib/grant.mjs` removes the token when `nativeWorkflow` is false. It is unscoped and a project may
rely on it for its own workflow scripts. Plan §5.6 says the installer removes it "the way superseded
rules are", which purges only the plugin's own old per-script rules. Surgery says: stop adding it,
say so in `docs/upgrading.md`, delete nothing.

### C8 — the hook reader is deleted, then relied on

ADR-0001 adds a `warn` verdict to `hooks/lib/decision.mjs` for one reason: so that `probe stats
--hooks` can still answer how often evaluation ran over a non-green board. That reader is cited by the
design doc (`docs/design/03-system-design.md`, the run-key section), by `tech-lead/references/gates.md`,
by the decision module's own comments, and by `AGENTS.md` for finding stray ledgers. The plan's A4
"done when" and its §8 both say `probe stats --hooks lists 5`, while A6 deletes the module that
answers it. Keep the `--hooks` reader (it is about 100 lines of the 477), or move it beside the
decision module, before A6 runs.

### C7 — the tests are the spec

55 structural files name `tech-lead`, `Workflow` or `shapeup-run`; 37 read the script's source. They
pin one-sign-off, gate H inside the run, the single writer being asked, an unanswered order named,
relaunch reopening a closed run, phase legs sent back once. Plan A7 says "remove the tests of deleted
modules", which understates it: these tests assert behaviour that must survive, written against a
file that will not.

## 3. What does not bite

| Constraint | Why it holds |
|---|---|
| ADR-0001 (two tiers, gate answers local, L2 advisory, knowledge base shared) | The plan moves no file or tier. A committed `gate-answers.json` with preset `ci` resolves the same way. One qualification: ADR-0001's `warn` verdict is only useful while its reader exists, which is C8. |
| ADR-0003 (concurrent legs share one tree, fence per write) | N `task-executor` sub-agents in one session is the same model; the plan changes who spawns them. Its stated limit, unfenced Bash, is unchanged. |
| Hooks keyed on tool names | `sandbox-guard`, `tier-guard`, `safety-spine`, `dispatch-receipt` and `verify envelope` fire on `Edit`, `Write`, `Bash`, `Skill` and `Agent`; none names a skill except the two in C2 and `gate-intake`. |
| Frozen `scripts/` | `FROZEN.md` freezes paths, not behaviour. `harness_replace_skills_for_cli` only configures the marketplace plugin, so deleting skills leaves no stale skill directory in a consumer repo. |
| Knowledge-base compatibility | Still just a name map, as the plan says. |
| Headless ceiling | The documented `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` kill at 600 s is a property of the background launch. A foreground loop does not have it. |

## 4. What this changes in the plan

| Plan item | Change |
|---|---|
| New A0b | Write ADR-0004 (supersedes design doc section 3.5); name the working-record files to retire once it ships |
| A1 and §5.2 | The loop's *transport* goes; its *state machine* stays in the kernel. Add a verb that returns the next step, its exact command and any gate block, from the artifact predicates already in `probe resume`. The loop skill then fits the 155-line ratchet at its new path and the "sent back once" rules stay code |
| A4 | Re-key `gate-zerowork`, do not gut it; its "done when" cannot cite `probe stats --hooks` until C8 is settled |
| A5 | Keep a launch record written by `init run` (the ship report's no-evaluation guard reads it; `verify budget` does not, it reads the receipt); decide the model floor with the PO; do not delete `Workflow` from user settings |
| A2 | Keep a fence for planning writes: either a fence-only `plan` order or an explicit accepted loss (C4 is measured, so this is a decision, not a hypothesis) |
| A6 | Keep the `--hooks` reader of `probe stats` (C8) |
| New A9 | Release 4.0.0: both version files, changelog, `AGENTS.md` and four docs, `claude plugin validate . --strict`, and the release-candidate check `CLAUDE.md` requires for a change to `hooks/`: `npm run verify:cross-dir`, then one real nested `claude -p --plugin-dir <repo> --permission-mode acceptEdits` session that must leave a row in `decisions.jsonl`. A missing row means enforcement failed open |
| A7 | Treat the 37 script-reading tests as the acceptance list for the new loop |
| Applied | The plan, proposal, review and before/after page were amended on 2026-11-07 to match this table; each carries an "Amended" box naming what changed. The four defaults in §6 were then confirmed by the PO |
| Numbers | Subcommand count: recounted from the kernel's route table, 32 becomes 29 (verbs removed: `reduce snapshot`, `reduce verdict`, `probe concurrency`, `init run-args`; added: `probe next`). The earlier 26 was an arithmetic slip, since its own table summed to 27; hook scripts go from 6 to 5 (the earlier "7 to 5" counted the shared decision library on one side only), and `hooks.json` entries from 8 to 6; the 3,600-line kernel and hook saving becomes about 3,200; `gate-zerowork` stays near 200 lines, not 60; the ~7,000 total becomes about 6,500, as arithmetic on the old estimate (not re-measured) |

## 5. Two things to take from this

- **The loop is not foreign to the repo.** `AGENTS.md` already documents driving Build by hand
  (compile, dispatch, ingest, verify) as the fallback when workspace trust or the permission classifier
  stops a run, and `--tiny` keeps a prose lane. What conflicts with the plan is narrower: the 155-line
  ratchet's rule against orchestration logic in prose, and the post-conditions the script encodes.
- **A thin skill over a kernel `next` verb settles that conflict and buys something new.** The header
  of `kernel/probe/resume.mjs` records that the costliest property of keeping logic inside the
  Workflow script was that it could not be tested: it shipped unverified and re-dispatched a finished
  phase. As a kernel verb the state machine is testable, and the 37 tests that read the script's source
  can aim at a module instead.

## 6. Decisions for the PO

All four defaults were **confirmed by the PO on 2026-11-07.**

| # | Question | Decision |
|---|---|---|
| 1 | Is the loop a prose skill, or a thin skill over a kernel `next` verb? | thin skill over `next` (`probe next`) |
| 2 | Does the model floor survive, and where? | yes, in the kernel, read at `init run` |
| 3 | Planning writes: fence-only order, or accept the loss? | fence-only order |
| 4 | Ship as 4.0.0 with ADR-0004 first? | yes |
