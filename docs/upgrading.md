# Upgrading an existing install

Updating an install **replaces code, and only code**: `migrate.sh` overwrites the installed skill
files for each detected CLI. Skill files are stateless, so this is a straight overwrite and
re-running it is free and always safe.

**Data migration has been removed.** Earlier versions carried a set of versioned migration scripts
that rewrote a project's own harness artifacts in place and recorded each in a committed ledger.
Every one of them existed to carry a project across a layout change that no supported version is
still on, so the machinery is gone rather than left running over nothing — a runner that reports
"nothing pending" on every invocation cannot be told apart from one that has quietly stopped
working. The consequence is stated here rather than left to be discovered: **an install old enough
to predate the current layout is not converted for you.** Run `install-harness.sh` against it
instead and treat it as a fresh install.

## Running it

**Option A — remote one-liner** (no clone needed; auto-detects installed CLIs):

```bash
curl -fsSL "https://raw.githubusercontent.com/nguyenvanphituoc/shapeup-sdlc-plugin/main/scripts/migrate.sh" | bash -s -- --directory . --yes
```

> As with the installer, the piped form consumes stdin, so pass `--yes`. Omit it when running
> from a clone to get the interactive CLI prompt.

**Option B — local clone:**

```bash
/path/to/shapeup-sdlc-plugin/scripts/migrate.sh --directory .    # replace installed skill files
```

## What the update does not do for you

Three things older installs used to get automatically. Each is now a manual check, and each is
worth making before your next run rather than at a gate.

### The knowledge base is per-skill and committed

`/coach` files each rule **by skill** under committed `shapeup/knowledge-base/<skill>.md`, read
back by `task-executor` / `ba-pitch-analyzer` / `qa-edge-hunter` at the top of their next run. If
you still carry a single flat `.shapeup/knowledge-base.md`, it is gitignored, reaches no teammate
and is read by nothing. Move its rules into `shapeup/knowledge-base/_INBOX.md` and run `/coach`
to assign each one — GATE COACH-1 asks which skill owns a rule, it never assumes — then commit
`shapeup/` so the team inherits it on `git pull`.

### Metrics are sharded per machine, and local

The metrics feed now lives at `.shapeup/metrics/<machine-id>.jsonl` — per-machine shards under
the gitignored LOCAL root (ADR-0001: a committed shard keyed on a hostname only grows and puts a
machine name in the repo). If you still carry a committed `shapeup/metrics.jsonl` or
`shapeup/metrics/`, stop tracking it; new rows land under `.shapeup/metrics/` and `harness probe stats`
reads them there.

### The contract parsers were repaired; find what they now reject

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

**Nothing rewrites these for you.** Two of the three are unrecoverable by machine, and the third is
a rewrite of a committed design document that a person should make and review. Worth checking at the
same time: if your gitignored `.claude/settings.local.json` still names `haiku` in the model matrix,
the shipped default has moved to `sonnet` — your machine's choice, but rarely the one you meant to
keep.

> Per-release upgrade notes are in [`CHANGELOG.md`](../CHANGELOG.md) under the release that shipped
> each change.

## Upgrading into the orchestrator cutover

**Nothing on your disk changes, and that is the finding, not an omission.** The
cutover changes how the tech-lead *runs* — the round loop moves from prose into
`skills/tech-lead/workflows/shapeup-run.js` — and touches no artifact you own. Boards, scope
contracts, ledgers, receipts and `shapeup/` all keep their formats. What follows is what changes
for the person running it.

### Does this affect you?

Only if you run specs that have **committed `scopes/*.md`**. That lane is now code.

`--tiny` runs and any spec without scope contracts keep the prose loop in
`skills/tech-lead/references/round-protocol.md`, unchanged and non-regression — `SKILL.md` routes
them there explicitly. If you have not adopted scope contracts, nothing about your runs changes.

### Two things you must have for headless runs

**1. The pipeline grant, which is what starts the lane at all.**

```bash
npx shapeup-sdlc init      # writes Bash(node "*/skills/<owner>/scripts/<name>.mjs" *) — two per script
```

**If you installed before v1.9, re-run `init`.** Every release up to and including v1.8 wrote
`Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)`, and that rule **granted nothing**:
Bash permission rules match at complete argument boundaries, and that prefix ends in the middle of a
path argument. The pipeline aborted at its first dispatch on every install that ever had it. Re-running
`init` removes the dead rules and writes working ones; your own unrelated rules are left alone.

Two rules per script, because the trailing ` *` form requires at least one argument and a bare
`node "<path>"` needs the argument-less form. The leading `*` spans the install root — a marketplace
install lives in a version-stamped cache directory, a `--plugin-dir` checkout lives wherever you
cloned it — which is also what keeps the grant working across a plugin upgrade instead of silently
expiring.

The scoped lane launches through `kernel/run.mjs`, which is one of the
granted entry points.

**Do not launch the lane with the `Workflow` tool.** That call is denied by default in a headless
session ("Review dynamic workflow before running"). This is observed, not theoretical: left to
that path, pre-fix sessions never executed `shapeup-run.js` at all — each quietly
improvised the feature by hand instead, once reaching GATE L4 with a valid receipt while the
pipeline had never started. **A receipt does not prove the lane ran** — the run's first act writes
one, so a receipt attests that a session started, never that the pipeline executed. If your own
scripts launch the harness, launch
`harness run` as a background Bash call and read `<run-dir>/result.json`.

<details>
<summary>If you would rather use the <code>Workflow</code> tool anyway — the trade-off, verified</summary>

Adding the bare token `"Workflow"` to `permissions.allow` **does** unblock the tool headlessly
(verified in a headless configuration: untrusted temp workspace, explicit `--settings`,
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

Know what else the pin takes with it: this release also carries the attempt-ratchet work, which is
unrelated to the orchestrator, and six of its files ship — `skills/orient/SKILL.md`,
`skills/qa-edge-hunter/SKILL.md`, `skills/task-executor/SKILL.md`,
`skills/tech-lead/references/delegation.md`, `skills/tech-lead/references/round-protocol.md`,
`kernel/reduce/ship.mjs`. Pinning to work around an orchestrator problem reverts
those too, silently. If that trade is the wrong one, open an issue rather than pinning — the
rollback is deliberately coarse and we would rather fix forward.

## Why the entrypoints live where they do

Source resolution, CLI selection, and skill replacement are factored into a shared
`scripts/shapeup-sdlc/lib/lib-harness.sh`, which both entry points source.

The `install-harness.sh` / `migrate.sh` entrypoints stay at a stable `scripts/` path on
purpose — an update mechanism that broke its own bookmarked URL on every refactor would
defeat the point of having one.
