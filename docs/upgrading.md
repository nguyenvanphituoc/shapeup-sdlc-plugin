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

## Upgrading to 4.0

This release (4.0.0) removes the scripted decision engine. The loop that drives a run still lives in the `building`
skill, but it now reads the run's files and follows its own phase table instead of asking the kernel what
comes next, and it writes and applies orders itself. Nothing in your project's committed tree changes;
what changes is the command surface and what the runtime still checks.

**Removed kernel commands** — any script, CI step or note of yours that names one will fail:
`compile`, `reduce ingest`, `reduce board`, `reduce ship`, `reduce hill`, `verify spec`, `verify build`,
`verify budget`, `verify dispatch`, `probe resume | next | eval | owner | attempts | hunt | leg | requirements | t0 | digest`,
and `init fit`. **Kept:** `verify t0 | envelope | skills`, `gate`, `init run`. **Added:** `order open | close`, which arms and retires the
write fence.

**Removed with them:** the `hill-chart` skill and the `/hill` command (their only writer was the removed hill
reducer); the wall-clock breaker and `--wall-clock-budget`; `--dimensions` and `--breadboard` on `init run`
(the dimension set goes in each evaluate order, the breadboard is copied to the run's trace by the loop);
`--lens` (carried in each plan order); and `--adversarial-verify`. The local `harness-run.md` ledger is no longer
written; the run's ending is `close.json`.

**What the runtime no longer checks** is stated in `AGENTS.md`: spec lint at the board review, single-writer
ingest with its send-back-once refusals, the attested-attempt census, the round build gate, and the ship-report
generator are now the loop's discipline. The write fence, the dispatch receipts, the T0 witness, the gate
resolver and the envelope check are unchanged in what they refuse.

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

### The knowledge base is per-reader and committed

`/retro` files each rule **by reader** under committed `shapeup/knowledge-base/<reader>.md`, read
back by `task-executor` / `qa-edge-hunter` / `orient` at the top of their next run, and by the loop's plan step (`plan.md`, plus the `ba-pitch-analyzer.md`, `scope-architect.md` and `solution-architect.md` files you already have). If
you still carry a single flat `.shapeup/knowledge-base.md`, it is gitignored, reaches no teammate
and is read by nothing. Move its rules into `shapeup/knowledge-base/_INBOX.md` and run `/retro`
to assign each one — the Retro Ownership gate asks which skill owns a rule, it never assumes — then commit
`shapeup/` so the team inherits it on `git pull`.

### Three skills are gone; their commands are not

`scope-hammer`, `coach` and `translator` were folded into the `building` loop: the stop census, the retro and the
language gate are now steps and sub-commands of `/ship`. `/hammer` and `/retro` (with `--scan` and
`--research <stack>`) keep their names. A `shapeup/knowledge-base/scope-hammer.md`, `coach.md` or
`translator.md` is read by nothing — re-file its rules with `/retro` under one of the five categories.

### Metrics are sharded per machine, and local

The metrics feed now lives at `.shapeup/metrics/<machine-id>.jsonl` — per-machine shards under
the gitignored LOCAL root (a committed shard keyed on a hostname only grows and puts a
machine name in the repo). If you still carry a committed `shapeup/metrics.jsonl` or
`shapeup/metrics/`, stop tracking it; new rows land under `.shapeup/metrics/`.

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

## Older changes that are still in force

- **The `tech-lead` skill is gone.** A `Skill(...)` or command naming it resolves to nothing: use `/ship` (or the
  `building` skill). Rules filed in `shapeup/knowledge-base/tech-lead.md` are still read, as `building` guidance.
- **`/ship --tiny` is not served.** `init run` refuses `--tiny` and `--lane` as unknown flags (exit 2). Run the full
  loop and size it with the pitch's appetite instead: `~1 week` gives a two-round budget, and a small shape yields one scope.
- **The `Workflow` permission is not needed.** The installer neither adds nor removes it; `npx shapeup-sdlc init
  --no-native-workflow` is accepted and does nothing. The whole grant is two Bash rules:
  `Bash(node "*/kernel/harness.mjs" *)` and `Bash(node "*/kernel/harness.mjs")`. Two, because the trailing ` *` form needs at
  least one argument; the leading `*` spans the install root, so the grant survives a plugin upgrade.
- **A gate is answered where it is reached.** The loop prints the gate block, asks the PO one question and records the
  answer with the source `PO (live)`; to resume a killed run, run `/ship` again.
- **The model floor is enforced when a run opens.** `init run` refuses an `exec` or `eval` model below sonnet with
  exit 2, naming the role (`qa` is not checked, and `eval` is not under `--no-eval`). A model left unnamed is
  `$SHAPEUP_EXEC_MODEL` / `$SHAPEUP_EVAL_MODEL` / `$SHAPEUP_QA_MODEL`, else `sonnet`.

## Why the entrypoints live where they do

Source resolution, CLI selection, and skill replacement are factored into a shared
`scripts/shapeup-sdlc/lib/lib-harness.sh`, which both entry points source.

The `install-harness.sh` / `migrate.sh` entrypoints stay at a stable `scripts/` path on
purpose — an update mechanism that broke its own bookmarked URL on every refactor would
defeat the point of having one.
