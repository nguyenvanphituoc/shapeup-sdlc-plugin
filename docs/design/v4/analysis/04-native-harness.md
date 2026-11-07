# 04 — Which of the kernel's jobs does Claude Code's own harness do today, and what is left to ship?

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Baseline** | 4.0.0 at `63478f6` (branch `plan/single-loop`) |
| **Status** | draft — the native features were read from the official docs on 2026-11-07 (see Sources; two items are marked UNVERIFIED there); the kernel's caller map and the test classification are derived from the tree |
| **Origin** | The maintainer's direction after `03`: a minimal test suite, minimal run scripts, and the host's built-in harness used in place of our own wherever it exists — the "rent the core" line of `01`, taken literally. |

## Question

For each job the kernel and the hooks do, does Claude Code provide the same mechanism natively, and
if so what is the residue the plugin must still ship?

## Evidence

### What the host provides (official docs, 2026-11-07)

| Need the kernel serves today | Native mechanism | Limit that matters here |
|---|---|---|
| Deny a write at the tool call (`sandbox-guard`, `tier-guard`) | `PreToolUse` hook returning `permissionDecision: deny` with a reason; `permissions.deny` rules `Edit(<gitignore pattern>)` (also cover `Write`, `NotebookEdit` and the Bash file commands the host recognizes) | Rules are static; a per-order substrate still needs a hook. Neither covers a script that writes files itself — the same hole the hook has today |
| Block destructive shell and secret reads (`safety-spine`, 333 lines) | `permissions.deny`: `Bash(rm -rf:*)`, `Bash(git push --force:*)`, `Bash(git reset --hard:*)`, `Read(./.env)`, `Read(//**/.env*)`; deny applies to subagents too, and a hook allow cannot override it | Prefix match only; a destructive command in the middle of a pipeline is missed. The hook has **0 denies on any ledger**, so nothing measured is lost |
| A receipt that a worker ran (`dispatch-receipt`, 198 lines) | `SubagentStart` / `SubagentStop` hooks carry `agent_id`, `agent_type` and `last_assistant_message`; tool events inside a subagent carry `agent_id` | Plugin subagents ignore `hooks` in their own frontmatter; session-level hooks see them. Transcripts are *not* a documented audit log, so the plugin keeps its own one-line ledger |
| A worker with a fixed tool set and model (`compile` substrate templates, `WorkerName` enum) | `agents/*.md` frontmatter: `tools`, `disallowedTools`, `model`, `maxTurns`, `skills` (preloaded), `isolation: worktree`, `autoCompactWindow` | No structured output: the result is text. No per-subagent `permissions` block; `permissionMode` is ignored for plugin agents |
| A schema-checked result (`verify envelope`, `WorkResult`) | None for subagents. `--json-schema` exists only for the top-level `claude -p` | The worker writes its result file itself and the loop reads it; validation is the loop's, or a 40-line check |
| Pause for the PO (`gate`, 555 lines) | `AskUserQuestion` (multiple choice; `askUserQuestionTimeout`) | Removed under `--permission-prompts none`, denied in `dontAsk`; headless keeps the answer-set file |
| Budgets (`round_budget`, `wall_clock_budget_s`, `attempt_budget`) | `claude -p --max-budget-usd`, `--max-turns`; `maxTurns` per subagent | Per-run and per-dispatch, not per-scope; the scope attempt count stays with the loop |
| Concurrent scopes without silent overwrite (substrate disjointness lint, `--parallel-scopes`) | `isolation: worktree` on a subagent, `WorktreeCreate`/`WorktreeRemove` hooks | A conflict surfaces at merge instead of being prevented; shared-path scopes still serialize |
| Resume after a kill (`probe resume`, `init run --force`) | `--resume`, `--continue`, `--fork-session` restore the conversation | Not the artifacts; the artifact-on-disk resume point (V4-REQ-7) stays ours and is small |
| Undo a bad attempt (`git stash` protocol in the round) | Checkpoints and `/rewind` | File-tool edits only; Bash and most subagent edits are not captured |
| Run state the user can see (`reduce board`, `hill`, `graph`) | `TaskCreate`/`TaskList` tools (cross-session persistence UNVERIFIED) | A board the loop writes as one Markdown file needs no reducer |
| Skill with its own context (`plan` fence) | `context: fork` + `agent:` on a skill | Not a conversation fork; fine for a planning substep that reads files |

### Who calls each kernel subcommand (tree at `63478f6`)

Runtime callers counted over `skills/`, `commands/`, `hooks/`, `bin/`, `kernel/` (excluding the
module itself) and `AGENTS.md`; test callers over `tests/`. Script: a 20-line walk over `ROUTES`.

| Subcommand | Runtime callers | Test files | Reading |
|---|---|---|---|
| `probe digest` | **0** | 3 | dead — V4-REQ-6 removes it |
| `verify budget`, `init fit` | 1 (from `init run`) | 5, 2 | fold into `init run` or drop with it |
| `report export`, `probe leg`, `probe stats` | 2, 2, 4 (export + facts, each other) | 5, 4, 3 | projection; no skill reads them |
| `reduce graph`, `reduce hill` | 5 (hill-chart skill, paths, next) | 10, 4 | projection; one optional reader |
| `verify trace`, `probe requirements` | 4, 8 | 6, 6 | advisory oracle + matrix; AGENTS.md calls both "never a verdict" |
| `probe next` | 17 | **42** | the decision engine; the tests pin its routing |
| `gate`, `init run`, `compile`, `reduce ingest`, `verify t0` | 58, 25, 29, 16, 11 | 55, 55, 51, 21, 19 | the spine |

### What the test suite pins

`tests/structural/`: 115 files, 21,872 lines, 2,503 checks. Classified by what each file does
(`grep` for doc paths vs. for `spawnSync`/`import` of shipped code):

| Class | Files | Lines | Example |
|---|---|---|---|
| Executes or imports shipped code only | 62 | 9,199 | `80-citation-rehash`, `24-parallel-isolation` |
| Reads prose *and* executes code | 47 | 12,425 | `05-tech-lead` (1,324 lines, for a skill deleted in 4.0.0), `10-run-receipt`, `122-probe-next` |
| Reads prose only | 6 | 363 | `118-one-line-kernel-commands`, `64-shipped-set-hygiene` |

`export` is named in all 115 files (the runner's context), `next` in 59, `spec` in 50, `contract`
in 52. Deleting a module deletes its tests; the doc-parity assertions inside the mixed files are
what `harness-maintenance-audit` already does by hand.

## Finding

Everything the kernel does that is **not** a witness has a native counterpart or needs none, and
the witness part is small. The host now provides the deny-at-the-call hook, static path and command
deny rules, subagent definitions with tool and model limits, subagent start/stop events with the
agent's name and last message, worktree isolation per subagent, run budgets in dollars and turns, a
pause-for-the-user tool, checkpoints, and session resume. What it does not provide is exactly the
class-A list of `03`: a fixture run whose hashes a judge must re-hash, a per-order write fence, a
gate whose answer comes from a file with a recorded source, and a one-line ledger the plugin owns
because the host's transcript is not a documented audit log.

The shipped set that follows is four subagents, one loop skill, two hooks, one script with three
subcommands, and a settings block the installer writes. Everything else in the kernel is either a
projection nobody reads (`03`, class C), a format converter for a format we chose
(`lib/contract.mjs`), or the decision engine whose necessity is unmeasured (V4-REQ-13). The test
suite shrinks with it: a test may execute a shipped script against a fixture or validate a shipped
manifest; prose parity leaves CI and stays in the maintenance audit.

| Today | After | Native replacement |
|---|---|---|
| 5 hook scripts, 1,509 lines, 6 registrations | `fence.mjs` (PreToolUse Edit/Write: live-order substrate + tier-direction tokens), `ledger.mjs` (SubagentStart/Stop: one JSONL row per dispatch) | `safety-spine` → `permissions.deny`; `gate-zerowork` dropped (0 blocks on record); `dispatch-receipt` → `SubagentStop` |
| `kernel/`, 52 modules, 18.7 k lines, 31 subcommands | `bin/shapeup.mjs`: `t0`, `gate`, `fence` (+ `init` if the launch record stays) ≤ 1,500 lines | orders and results are files the loop and the worker write; board is one Markdown file the loop writes; no compile, ingest, board, graph, hill, export, digest, stats, trace, requirements, contract, spec-lint reducers |
| `WorkerName` enum + `compile` substrate templates | `agents/{orient,task-executor,spec-evaluator,qa-edge-hunter}.md` with `tools`, `model`, `skills`, `maxTurns`; build agents `isolation: worktree` | the agent definition *is* the roster; `verify skills` goes |
| `probe next` + `probe resume`, 2,017 lines | the phase table in `building/SKILL.md` + a `status` listing of what exists and what is open (≤ 150 lines) — **only if V4-REQ-13 holds** | none; this is procedure, and the kit puts procedure in the skill |
| 115 test files, 21.9 k lines | ≈ 10 files: manifests + `plugin validate --strict`, fence deny/allow by execution, ledger row by execution, `t0` green/red/hash, `gate` four presets, grant executes, cross-dir, agents and skills frontmatter, shipped-set hygiene | `harness-maintenance-audit` for prose parity, before a release |

What this costs, named so the PO decides with it in view:

- **A destructive command inside a pipeline is no longer caught.** The hook's regexes read the
  whole command; a deny rule reads its prefix. The ledger says the hook never fired, so the loss is
  unmeasured, not zero.
- **A result is text until the worker writes the file.** No schema stands between the subagent and
  the loop; the `t0` hash and the fence still do, which is where the trust was anyway.
- **Concurrency is reconciled, not prevented.** Worktrees turn a silent overwrite into a merge
  conflict; the disjointness lint that refused the board goes.
- **The decision engine's removal is a bet until measured.** Stage 3 below is the with/without; the
  stages before it do not depend on its outcome.

## Candidate requirements

- `V4-REQ-14`: The shipped executable set is at most one script with at most four subcommands
  (`t0`, `gate`, `fence`, `init`) and two hooks; a module outside that list is removed, not added.
- `V4-REQ-15`: Every worker is a plugin subagent definition with `tools`, `model` and `skills`
  declared; the loop dispatches by agent name and reads the result file the worker wrote.
- `V4-REQ-16`: Destructive-command and secret-read protection is a `permissions.deny` block the
  installer writes, not a hook; the block is verified by executing the host against it, not by
  string comparison.
- `V4-REQ-17`: A structural test either executes a shipped script against a fixture or validates a
  shipped manifest; a test that asserts on prose is removed, and prose parity is the maintenance
  audit's job.

## What would change this answer

- The host adding structured output for subagents: the result file goes, and the loop reads the
  Agent tool's return.
- Per-subagent `permissions` landing: the fence hook goes for build agents, leaving the tier-direction
  token check.
- A real run under Stage 2 that ships with fewer gate rows, a missing receipt, or a write outside a
  substrate that the old hooks would have refused — any one keeps that hook.
- The Stage 3 with/without failing the "holds" rule: `probe next` stays, as code, with its 42 tests.

## Sources

Official Claude Code docs, read 2026-11-07 through a summarizing fetch of the `.md` pages at
`code.claude.com/docs/en/`: `hooks`, `permissions`, `settings-reference`, `sub-agents`, `skills`,
`sessions`, `headless`, `tools-reference`, `agent-teams`, `worktrees`, `checkpointing`. Two items
the fetch truncated are marked UNVERIFIED above (the full `SubagentStop` input schema; cross-session
persistence of the single-session Task tools). [`03`](03-what-the-kernel-is-for.md) for the class
model; [`02`](02-single-agent-loop.md) for the kit's procedure-in-skills rule.
