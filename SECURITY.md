# Security

This plugin installs **twelve hook entries (eleven Node scripts + one `echo`)**: six in a
`PreToolUse` position, of which **five can deny a tool call**, plus one `Stop`-position hook that
can block a session from ending. That is the product — and it is also exactly the kind of surface
a careful reviewer should want spelled out before installing. This page is that spelling-out.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/security/advisories/new)
for anything exploitable — especially anything that would let a run **escape a deny** (talk
past GATE L2, write outside a substrate, widen its own safety overrides) or exfiltrate data.
For non-sensitive hardening ideas, an ordinary issue is fine.

In scope: the hooks, the pipeline scripts (`compile-order` / `ingest-result` /
`validate-envelope` / `t0-verify`), the installer/migration shell scripts, and any prompt-
injection path through skill files. Please do not test against machines you don't own.

## The claims, stated so they can be falsified

1. **No hook or pipeline script makes a network request.** There is no `fetch`, no
   `node:http(s)`, no `node:net`, no shelling out to `curl`/`wget` anywhere in `hooks/` or
   `skills/*/scripts/`. Verify: `grep -rnE "fetch|node:http|node:net|curl|wget" hooks/ skills/*/scripts/`.
2. **No hook has dependencies.** Plain `.mjs`, Node standard library only, no `node_modules`,
   no install-time scripts. What you read is what runs.
3. **Every hook is fail-open by design.** Unparseable input, missing state files, or an
   unrecognized invocation shape → the hook defers and the normal permission flow proceeds. A
   hook denies only when it can positively prove its condition (a matched destructive command, a
   path the active order's substrate does not permit, an invalid order file, an empty intake, a
   spent wall-clock budget).
4. **The model cannot widen its own safety envelope.** The escape hatch
   (`.shapeup/safety-overrides.json`) is human-authored; `safety-spine` itself denies any
   write/move/delete touching that file, a malformed overrides file is treated as absent
   (override channel fails closed), and every exercised override is logged. The same principle
   covers `.shapeup/active-order`, the pointer `sandbox-guard` reads to decide what a worker may
   write: it sits outside the run-trace carve-out, so a worker cannot repoint its own sandbox.
5. **Exactly one hook can block, and only on a mechanical absence.** Two of the three
   `Stop`-position hooks (`anti-rationalization`, `slop-cleaner`) are advisory — at most a
   `systemMessage`, always exit 0. The third, `gate-zerowork`, **does** return
   `decision: "block"`, and only in one state: the session dispatched the orchestrator and left
   no run receipt on disk. It makes no judgement about quality — it reports that there is no work
   to judge. `stop_hook_active` caps it at one block per stop chain.
6. **Every hook decision is recorded.** `hooks/lib/decision.mjs` is the only exit path a hook
   has, so allow, deny, block and error each leave a row in `.shapeup/decisions.jsonl`. An
   inert hook and a permitting hook are therefore distinguishable — which matters, because
   "exit 0, no output" is what both used to look like.

If you find any of these to be false, that is a vulnerability — report it as claim #ⁿ.

## What each hook does

Wired in [`hooks/hooks.json`](hooks/hooks.json); every script is short enough to read in one
sitting, and reading them is the recommended review.

| Hook | Event (matcher) | Reads | Can deny | Never does |
|---|---|---|---|---|
| [`safety-spine.mjs`](hooks/safety-spine.mjs) | PreToolUse (`Bash\|Read\|Write\|Edit\|MultiEdit`) | The proposed command/path; `.shapeup/safety-overrides.json` | Yes — provably destructive ops only: `rm -rf` on unrecoverable targets, `git push --force` / push to main, `git reset --hard`, `git clean -fdx`, `DROP TABLE`/`TRUNCATE`, reads of `.env`/keys/cloud credentials, and any write to its own overrides file | Never blocks an unmatched command; `--force-with-lease` stays allowed |
| [`gate-intake.mjs`](hooks/gate-intake.mjs) | PreToolUse (`Skill`) | The `tech-lead` dispatch's own arguments | Yes — an orchestrator dispatch carrying no resolvable intake (no pitch, spec, resume or requirement text) | Fails open on `--order` and on any ambiguous arg shape |
| [`gate-deadline.mjs`](hooks/gate-deadline.mjs) | PreToolUse (`Skill`) | The run's opt-in `wall_clock_budget_s` and start time | Yes — a `task-executor` dispatch once the budget is spent, routing to the ship gate instead | Never denies `spec-evaluator`, `scope-hammer` or `qa-edge-hunter`; off entirely unless a budget is configured |
| [`harness verify envelope`](kernel/verify/envelope.mjs) | PreToolUse (`Skill\|Agent`) | The `--order` file named in the dispatch; the JSON schemas | Yes — a worker dispatch whose order file is missing or schema-invalid | Never gates a dispatch that carries no `--order` (standalone skill use stays free) |
| [`sandbox-guard.mjs`](hooks/sandbox-guard.mjs) | PreToolUse (`Edit\|Write\|MultiEdit`) | The target path; the active order's `substrate` block, via `.shapeup/active-order` | Yes — any write the order does not permit: outside `allowed`/`shared`, inside `frozen`, or a `Write` to an `append_only` path | No-op unless an order is live; the active feature's own `.shapeup/<slug>/` run-trace is always writable. Appends denials to the local pathology log |
| [`gate-l2.mjs`](hooks/gate-l2.mjs) | PreToolUse (`Skill`) | The round's task board (`.shapeup/<slug>/tasks/`) | **No** — advisory since ADR-0001. It detects a non-green board by two independent reads, names the unfinished tasks in a `systemMessage`, and permits the call | Never denies; records a `warn` row so "evaluated a partial board" stays countable |
| [`gate-zerowork.mjs`](hooks/gate-zerowork.mjs) | Stop | Run receipts on disk; the session transcript; the decision ledger | **Yes — the one blocking hook.** Returns `decision:"block"` when the session dispatched the orchestrator and produced no run receipt | Defers the moment any receipt exists; `stop_hook_active` caps it at one block per stop chain |
| [`anti-rationalization.mjs`](hooks/anti-rationalization.mjs) | Stop | Board/T0 facts vs. the reply's completion claims | **No** — advisory `systemMessage` only | Never `decision:"block"`, never exit 2 |
| [`slop-cleaner.mjs`](hooks/slop-cleaner.mjs) | Stop | The session's git diff (local `git diff`, via `spawnSync`) | **No** — advisory `systemMessage` flagging TODO / `console.log` / commented-out leftovers | Same — never blocks |
| [`compact-snapshot.mjs`](hooks/compact-snapshot.mjs) | PreCompact | Run state | No — writes `.shapeup/<slug>/run-snapshot.json` before compaction | Touches nothing outside `.shapeup/` |
| [`session-rehydrate.mjs`](hooks/session-rehydrate.mjs) | SessionStart (`startup\|compact\|resume\|clear`) | The saved run snapshot | No — injects the "trust the files, not the summary" hint when a run is in flight | Silent when no run is in flight |

(The twelfth `hooks.json` entry is a plain `echo` on SessionStart confirming the plugin loaded.)

## Data handling

- **Nothing leaves the machine.** Run state lives in the gitignored `.shapeup/`; telemetry
  is a per-machine JSONL shard under `.shapeup/metrics/`, inside that same gitignored root,
  so it travels only if you deliberately un-ignore and commit it. There is no phone-home of
  any kind.
- **The safety-spine actively blocks secret reads** (`.env`, `*.pem`, `*.key`, ssh/cloud
  credentials) rather than merely not making them.
- The installer (`scripts/install-harness.sh`) writes only into the target project
  (`.claude/`, `shapeup/`, `.gitignore`) and tells you what it
  is going to do first; the `curl | bash` form requires an explicit `--yes` for exactly that
  reason.

## Supported versions

Pre-1.0-ecosystem project, solo-maintained: fixes land on `main` and ship in the next tag.
Report against the latest release.
