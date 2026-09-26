# Security

This plugin installs **eight hook entries (seven Node scripts + one `echo`)**: five in a
`PreToolUse` position, **all five of which can deny a tool call**, one `PostToolUse` hook that has no
deny path at all, and one `Stop`-position hook that can block a session from ending. That is the
product — and it is also exactly the kind of surface a careful reviewer should want spelled out
before installing. This page is that spelling-out.

Count them yourself rather than taking the paragraph's word for it, because this paragraph has been
wrong before — it described a twelve-entry surface for the whole life of v2.0, after the hook diet cut
it to four walls and updated the table below without updating the sentence above it:

```bash
node -e "const h=require('./hooks/hooks.json').hooks;
  for (const [e,gs] of Object.entries(h)) for (const g of gs) for (const x of g.hooks)
    console.log(e, g.matcher||'*', x.command.match(/[^/ ]+\.mjs/)?.[0] ?? '(echo)')"
```

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/security/advisories/new)
for anything exploitable — especially anything that would let a run **escape a deny** (write
outside a substrate, dispatch on an uncompiled order, widen its own safety overrides) or
exfiltrate data.
For non-sensitive hardening ideas, an ordinary issue is fine.

In scope: the hooks, the kernel (`kernel/harness.mjs` and every subcommand beneath it), the
installer/migration shell scripts, and any prompt-injection path through skill files. Please do not
test against machines you don't own.

## The claims, stated so they can be falsified

1. **No hook or kernel subcommand makes a network request.** There is no `fetch`, no
   `node:http(s)`, no `node:net`, no shelling out to `curl`/`wget` anywhere in `hooks/` or
   `kernel/`. Verify: `grep -rnE "fetch|node:http|node:net|curl|wget" hooks/ kernel/`.
2. **No hook has dependencies.** Plain `.mjs`, Node standard library only, no `node_modules`,
   no install-time scripts. What you read is what runs.
3. **Every hook is fail-open by design.** Unparseable input, missing state files, or an
   unrecognized invocation shape → the hook defers and the normal permission flow proceeds. A
   hook denies only when it can positively prove its condition (a matched destructive command, a
   path no live order's substrate permits, an invalid order file, an empty intake).
4. **The model cannot widen its own safety envelope.** The escape hatch
   (`.shapeup/safety-overrides.json`) is human-authored; `safety-spine` itself denies any
   write/move/delete touching that file, a malformed overrides file is treated as absent
   (override channel fails closed), and every exercised override is logged. The same principle
   covers `.shapeup/active-order`, which `sandbox-guard` reads to find the run whose orders fence
   a worker's writes: it sits outside the run-trace carve-out, so a worker cannot repoint its own
   sandbox. The `last-run` breadcrumb a terminal close leaves beside it is read for one purpose — keying a decision row to the run that just ended, marked `run_closed` — and arms nothing: liveness is derived from the order set and the pointer, never from that file. Every hook resolves that pointer, the decision ledger and the substrate globs against
   the project root it finds above the tool call's working directory (a run pointer, the committed
   tier, or a git boundary) — a worker that `cd`s into a sub-folder is fenced exactly as one at the
   top, and its receipts land in the same ledger.
5. **Exactly one hook can block, and only on a mechanical absence.** `gate-zerowork` returns
   `decision: "block"` in one state: the session dispatched the orchestrator and left no run
   receipt on disk. It makes no judgement about quality — it reports that there is no work to
   judge. `stop_hook_active` caps it at one block per stop chain. Every other check that used to
   emit an advisory `systemMessage` at `Stop` now lands in the ship report instead, where it is a
   section a person can read afterwards rather than a line in a transcript.
6. **Every hook decision is recorded.** `hooks/lib/decision.mjs` is the only exit path a hook
   has, so allow, deny, block and error each leave a row in `.shapeup/decisions.jsonl`. An
   inert hook and a permitting hook are therefore distinguishable — which matters, because
   "exit 0, no output" is what both used to look like. A permitted Bash call's row names the
   programs the command runs, by basename (`hdc`, `curl | jq`) — never the arguments, which is
   where a secret, a token or a private path would be. A denied call's row keeps the first 200
   characters of the command, as it always has, because a denial must be reviewable.

If you find any of these to be false, that is a vulnerability — report it as claim #ⁿ.

## What each hook does

Wired in [`hooks/hooks.json`](hooks/hooks.json); every script is short enough to read in one
sitting, and reading them is the recommended review.

| Hook | Event (matcher) | Reads | Can deny | Never does |
|---|---|---|---|---|
| [`safety-spine.mjs`](hooks/safety-spine.mjs) | PreToolUse (`Bash\|Read\|Write\|Edit\|MultiEdit`) | The proposed command/path; `.shapeup/safety-overrides.json` | Yes — provably destructive ops only: `rm -rf` on unrecoverable targets, `git push --force` / push to main, `git reset --hard`, `git clean -fdx`, `DROP TABLE`/`TRUNCATE`, reads of `.env`/keys/cloud credentials, and any write to its own overrides file | Never blocks an unmatched command; `--force-with-lease` stays allowed |
| [`gate-intake.mjs`](hooks/gate-intake.mjs) | PreToolUse (`Skill`) | The `tech-lead` dispatch's own arguments | Yes — an orchestrator dispatch carrying no resolvable intake (no pitch, spec, resume or requirement text) | Fails open on `--order` and on any ambiguous arg shape |
| [`harness verify envelope`](kernel/verify/envelope.mjs) | PreToolUse (`Skill\|Agent`) | The `--order` file named in the dispatch; the JSON schemas | Yes — a worker dispatch whose order file is missing or schema-invalid | Never gates a dispatch that carries no `--order` (standalone skill use stays free) |
| [`sandbox-guard.mjs`](hooks/sandbox-guard.mjs) | PreToolUse (`Edit\|Write\|MultiEdit`) | The target path, resolved through the filesystem before it is compared — symlinks followed, the unborn tail re-attached to its real ancestor, case folded where the filesystem folds case — so a spelling variant of a frozen file is the frozen file; the `substrate` block of every LIVE order — compiled, with no result at least as new as the order's own `compiled_at`, and, for a run-level phase dispatch, not yet superseded by a later phase's order | Yes — any write no live order permits: inside any `frozen`, outside every `allowed`/`shared`, or a `Write` to an `append_only` path. `frozen` is checked FIRST, so it also outranks the run-trace carve-out | No-op unless an order is live, which a finished run no longer is: the pointer names the run, never a dispatch. The active feature's own `.shapeup/<slug>/` run trace is writable EXCEPT where a live order freezes a path inside it. Appends denials to the local pathology log |
| [`tier-guard.mjs`](hooks/tier-guard.mjs) | PreToolUse (`Edit\|Write\|MultiEdit`) | The target path; the text the call is about to write (`content`, `new_string`, or any edit in a `MultiEdit` batch) | Yes — a write into `shapeup/<slug>/` whose content names a `.shapeup/` path or a `TASK-NNN` board id: the same tier-direction rule spec-lint reds at GATE L1b, refused at the moment of writing, with the offending token quoted back | No-op outside `shapeup/<slug>/`, on file forms the lint does not scan, and on `shapeup/knowledge-base/` (instructions to a worker, not references). Reads nothing off disk and writes only its decision row; it never inspects a file it is not being asked to write |
| [`dispatch-receipt.mjs`](hooks/dispatch-receipt.mjs) | PostToolUse (`Skill\|Agent`) | The `--order` file named in the dispatch; the tool result's own report of which skill ran | **No — it has no deny path at all.** It records that the shipped skill ran, so `harness reduce ingest` can refuse a result no dispatch produced | Never writes an attestation for a result that does not name a resolved skill; never fails the call it observes (every write is inside `try`/`catch`) |
| [`gate-zerowork.mjs`](hooks/gate-zerowork.mjs) | Stop | Run receipts on disk; the session transcript; the decision ledger | **Yes — the one blocking hook.** Returns `decision:"block"` when the session dispatched the orchestrator and produced no run receipt | Defers the moment any receipt exists; `stop_hook_active` caps it at one block per stop chain |

(The remaining `hooks.json` entry is a plain `echo` on SessionStart confirming the plugin loaded.)

## Data handling

- **Nothing leaves the machine.** Run state lives in the gitignored `.shapeup/`; telemetry
  is a per-machine JSONL shard under `.shapeup/metrics/`, inside that same gitignored root,
  so it travels only if you deliberately un-ignore and commit it. There is no phone-home of
  any kind.
- **The safety-spine actively blocks secret reads** (`.env`, `*.pem`, `*.key`, ssh/cloud
  credentials) rather than merely not making them.
- **The script the run executes is a copy, and the copy is the shipped file.** Opening a run
  copies the plugin's own workflow scripts into the gitignored `.shapeup/workflows/`, because the
  Workflow tool loads a script only from a directory the session may already read and the plugin
  installs outside your project. They are copied byte for byte — never generated, templated or
  rewritten — so what you review in the plugin is what runs, and nothing else is added to your tree.
- The installer (`scripts/install-harness.sh`) writes only into the target project
  (`.claude/`, `shapeup/`, `.gitignore`) and tells you what it
  is going to do first; the `curl | bash` form requires an explicit `--yes` for exactly that
  reason.

## Supported versions

Pre-1.0-ecosystem project, solo-maintained: fixes land on `main` and ship in the next tag.
Report against the latest release.
