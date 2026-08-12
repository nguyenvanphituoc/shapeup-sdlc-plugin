# Upgrading an existing install

Updating an install is a **versioned migration**, modeled on database migration tools
(Flyway / Rails). `migrate.sh` first **updates code** — replacing the installed skills for
each detected CLI — then **migrates data** by applying any pending
`scripts/shapeup-sdlc/migrations/NNNN__*.sh` in order and recording each in a committed
`shapeup/.harness-migrations` ledger.

It is idempotent: applied migrations are skipped on re-run, so it is always safe to run
again, and every future version adds its own migration rather than another one-off script.

## Running it

**Option A — remote one-liner** (no clone needed; auto-detects installed CLIs):

```bash
curl -fsSL "https://raw.githubusercontent.com/nguyenvanphituoc/shapeup-sdlc-plugin/main/scripts/migrate.sh" | bash -s -- --directory . --yes
```

> As with the installer, the piped form consumes stdin, so pass `--yes`. Omit it when running
> from a clone to get the interactive CLI prompt.

**Option B — local clone:**

```bash
/path/to/shapeup-sdlc-plugin/scripts/migrate.sh --directory .             # update code + migrate data
/path/to/shapeup-sdlc-plugin/scripts/migrate.sh --directory . --dry-run   # list pending migrations
```

## The migrations

### `0001` — knowledge base becomes team-shared

As of plugin 0.2.5 / tech-lead 0.12, `/coach` no longer writes one flat, gitignored
`.shapeup/knowledge-base.md` — which never reached teammates and was never read back. It
now files each rule **by skill** under committed `shapeup/knowledge-base/<skill>.md`,
read back by `task-executor` / `ba-pitch-analyzer` / `qa-edge-hunter` at the top of their next
run.

Old rules are preserved verbatim into `shapeup/knowledge-base/_INBOX.md` and are
**never auto-categorized**. Afterward, run `/coach` on `_INBOX.md` to assign each rule to a
skill — its GATE COACH-1 asks, it never assumes — then commit `shapeup/` so the team
inherits the knowledge base and the migration ledger on `git pull`.

### `0002` — file-organization addendum

Brings a pre-0.3.0 install up to date: shards a flat `shapeup/metrics.jsonl` into
`shapeup/metrics/<machine-id>.jsonl` (retiring the old file to
`metrics.jsonl.migrated`), adds the Tier C `.gitignore` rules, and drops the Tier C example
templates — the same three steps a fresh `install-harness.sh` run already does.

### `0009` — the contract parsers were repaired; find what they now reject

v1.6.0 fixes five defects in one family — *the committed contract format fails silent* — plus a
schema tightening. Every one is a change to a **reader**, so the code arrives with the upgrade and
the knowledge of which of *your* files those readers now treat differently does not. In two cases
the change is from green to red, and you should meet that here rather than at a gate:

- **a committed contract the parser could not see** used to read as one that declared *nothing*, so
  every rule over it passed — `trace-lint` printing a green `0/0 engines reach` for a wiring map
  holding six correct rows. It is RED from v1.6.0.
- **list members split on their own commas** (HD-002) — already split in any contract written
  through the old round trip. The data is gone and cannot be restored by guessing, so candidates are
  named for a human to read.
- **a stored `FAIL` with no `file:line` locator** is rejected before ingest from v1.6.0; that round
  must be re-evaluated rather than resumed.

**It writes nothing.** Two of the three are unrecoverable by machine and the third is a rewrite of a
committed design document that a person should make and review — the same call `0008` made about a
teammate's committed analysis. It also notes, once, if your gitignored
`.claude/settings.local.json` still names `haiku` in the model matrix; the shipped default moved to
`sonnet`, and your machine's choice is not the upgrade's business.

> Migrations `0003`–`0008` are documented in [`CHANGELOG.md`](../CHANGELOG.md) under the release
> that shipped each one.

## Upgrading into the orchestrator cutover

**There is no migration script for this one, and that is the finding, not an omission.** The
cutover changes how the tech-lead *runs* — the round loop moves from prose into
`skills/tech-lead/workflows/shapeup-run.js` — and touches no artifact on your disk. Boards, scope
contracts, ledgers, receipts and `shapeup/` all keep their formats. `migrate.sh` will report
nothing pending, correctly. What follows is what changes for the person running it.

### Does this affect you?

Only if you run specs that have **committed `scopes/*.md`**. That lane is now code.

`--tiny` runs and any spec without scope contracts keep the prose loop in
`skills/tech-lead/references/round-protocol.md`, unchanged and non-regression — `SKILL.md` routes
them there explicitly. If you have not adopted scope contracts, nothing about your runs changes.

### Two things you must have for headless runs

**1. The pipeline grant, which is what starts the lane at all.**

```bash
npx shapeup-sdlc init      # writes Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)
```

The scoped lane launches through `skills/tech-lead/scripts/run-workflow.mjs`, so the prefix rule
`init` already writes covers it — if you ran `init` at any point, you have this and nothing changes.

**Do not launch the lane with the `Workflow` tool.** That call is denied by default in a headless
session ("Review dynamic workflow before running"). This is measured, not theoretical: across six
benchmark runs of the pre-fix build, `shapeup-run.js` executed **zero** times — each session quietly
improvised the feature by hand instead, once reaching GATE L4 with a valid receipt while the
pipeline had never started. **A receipt does not prove the lane ran** (`HD-007`;
`docs/migration/hd007-control-plane-probe.md`). If your own scripts launch the harness, launch
`run-workflow.mjs` as a background Bash call and read `<run-dir>/result.json`.

<details>
<summary>If you would rather use the <code>Workflow</code> tool anyway — the trade-off, measured</summary>

Adding the bare token `"Workflow"` to `permissions.allow` **does** unblock the tool headlessly
(verified in the benchmark's own configuration: untrusted temp workspace, explicit `--settings`,
`--permission-mode acceptEdits` — zero denials with the entry, denied without it). If you prefer
the native runtime's resume-from-runId and worktree isolation, that one line is all it takes.

What you accept by adding it: **the grant cannot be narrowed.** `Workflow(<path>)` and
`Workflow(<script-name>)` are both still denied — only the unscoped token works — so the entry
permits *every* dynamic workflow script in that project, including one written at runtime. The
plugin does not add it for you for that reason. The Bash launcher needs no new grant and is scoped
by path to the plugin's own `scripts/` directory.

</details>

**2. The background-wait ceiling.**

```bash
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
```

Required for any `--unattended` or CI invocation. Without it `claude -p` cuts the wait at 600 s and
**exits 0**: a truncated run that reports as a clean one. Nothing downstream can tell that apart
from success, which is why this is a hard requirement and not a tuning knob. Interactive runs are
unaffected.

### What a gate pause looks like now

Gates no longer block inside a turn — the run **returns** at one. You will see the gate block, and
the run ends with `paused`. Answer it, then relaunch the *same* command with the *same* arguments:
the fast-forward re-derives position from disk and re-dispatches nothing already finished. The same
mechanism means a session killed mid-run resumes where it died instead of starting over.

If you script around the harness, that is the behavioural change to account for: a paused run is a
normal, zero-exit outcome that expects a relaunch, not a failure to retry differently.

### Rolling back

**Pin `1.6.3`.** Per decision D2 there are no dual paths — the prose orchestrator was deleted for
the scoped lane rather than kept as a fallback, so downgrading the package is the only way back.

Know what else the pin takes with it: this release also carries the day-2 ratchet work, which is
unrelated to the orchestrator, and six of its files ship — `skills/orient/SKILL.md`,
`skills/qa-edge-hunter/SKILL.md`, `skills/task-executor/SKILL.md`,
`skills/tech-lead/references/delegation.md`, `skills/tech-lead/references/round-protocol.md`,
`skills/tech-lead/scripts/ship-report.mjs`. Pinning to work around an orchestrator problem reverts
those too, silently. If that trade is the wrong one, open an issue rather than pinning — the
rollback is deliberately coarse and we would rather fix forward.

## Why the entrypoints live where they do

Source resolution, CLI selection, and skill replacement are factored into a shared
`scripts/shapeup-sdlc/lib/lib-harness.sh`; the migration runner lives in
`scripts/shapeup-sdlc/lib/lib-migrate.sh`.

The `install-harness.sh` / `migrate.sh` entrypoints stay at a stable `scripts/` path on
purpose — an update mechanism that broke its own bookmarked URL on every refactor would
defeat the point of having one.
