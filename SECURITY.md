# Security

This plugin installs **eight hook entries (seven Node scripts + one `echo`)**, four of them in
a `PreToolUse` position where they can deny tool calls. That is the product — and it is also
exactly the kind of surface a careful reviewer should want spelled out before installing.
This page is that spelling-out.

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
   hook denies only when it can positively prove its condition (a non-green board, a matched
   destructive command, a path outside a declared substrate, an invalid order file).
4. **The model cannot widen its own safety envelope.** The escape hatch
   (`.shapeup-sdlc/safety-overrides.json`) is human-authored; `safety-spine` itself denies any
   write/move/delete touching that file, a malformed overrides file is treated as absent
   (override channel fails closed), and every exercised override is logged.
5. **Stop hooks never block.** The two Stop-position hooks are advisory: they emit at most a
   `systemMessage` and always exit 0.

If you find any of these to be false, that is a vulnerability — report it as claim #ⁿ.

## What each hook does

Wired in [`hooks/hooks.json`](hooks/hooks.json); every script is short enough to read in one
sitting, and reading them is the recommended review.

| Hook | Event (matcher) | Reads | Can deny | Never does |
|---|---|---|---|---|
| [`safety-spine.mjs`](hooks/safety-spine.mjs) | PreToolUse (`Bash\|Read\|Write\|Edit\|MultiEdit`) | The proposed command/path; `.shapeup-sdlc/safety-overrides.json` | Yes — provably destructive ops only: `rm -rf` on unrecoverable targets, `git push --force` / push to main, `git reset --hard`, `git clean -fdx`, `DROP TABLE`/`TRUNCATE`, reads of `.env`/keys/cloud credentials, and any write to its own overrides file | Never blocks an unmatched command; `--force-with-lease` stays allowed |
| [`gate-l2.mjs`](hooks/gate-l2.mjs) | PreToolUse (`Skill`) | The round's task board (`.shapeup-sdlc/<slug>/tasks/`) | Yes — the once-per-round EVAL dispatch while any task is unfinished | Never gates a single-task eval (`--task`); no board → defers |
| [`validate-envelope.mjs`](skills/tech-lead/scripts/validate-envelope.mjs) | PreToolUse (`Skill\|Agent`) | The `--order` file named in the dispatch; the JSON schemas | Yes — a worker dispatch whose order file is missing or schema-invalid | Never gates a dispatch that carries no `--order` (standalone skill use stays free) |
| [`sandbox-guard.mjs`](hooks/sandbox-guard.mjs) | PreToolUse (`Edit\|Write\|MultiEdit`) | The target path; the active scope contract | Yes — writes outside the active scope's substrate whitelist | No-op unless a scope is active; the active feature's own `.shapeup-sdlc/<slug>/` run-trace is always writable. Appends denials to the local pathology log |
| [`anti-rationalization.mjs`](hooks/anti-rationalization.mjs) | Stop | Board/T0 facts vs. the reply's completion claims | **No** — advisory `systemMessage` only | Never `decision:"block"`, never exit 2 |
| [`slop-cleaner.mjs`](hooks/slop-cleaner.mjs) | Stop | The session's git diff (local `git diff`, via `spawnSync`) | **No** — advisory `systemMessage` flagging TODO / `console.log` / commented-out leftovers | Same — never blocks |
| [`compact-snapshot.mjs`](hooks/compact-snapshot.mjs) | PreCompact | Run state | No — writes `.shapeup-sdlc/<slug>/run-snapshot.json` before compaction | Touches nothing outside `.shapeup-sdlc/` |
| [`session-rehydrate.mjs`](hooks/session-rehydrate.mjs) | SessionStart (`compact\|resume`) | The saved run snapshot | No — injects the "trust the files, not the summary" hint when a run is in flight | Silent when no run is in flight |

(The eighth `hooks.json` entry is a plain `echo` on SessionStart confirming the plugin loaded.)

## Data handling

- **Nothing leaves the machine.** Run state lives in the gitignored `.shapeup-sdlc/`; telemetry
  is a per-machine JSONL shard under `docs/shapeup-sdlc/metrics/` that travels only if you
  commit it. There is no phone-home of any kind.
- **The safety-spine actively blocks secret reads** (`.env`, `*.pem`, `*.key`, ssh/cloud
  credentials) rather than merely not making them.
- The installer (`scripts/install-harness.sh`) writes only into the target project
  (`.claude/`, `.agents/`, `.codex/`, `docs/shapeup-sdlc/`, `.gitignore`) and tells you what it
  is going to do first; the `curl | bash` form requires an explicit `--yes` for exactly that
  reason.

## Supported versions

Pre-1.0-ecosystem project, solo-maintained: fixes land on `main` and ship in the next tag.
Report against the latest release.
