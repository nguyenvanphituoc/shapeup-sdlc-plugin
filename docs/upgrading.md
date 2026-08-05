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

## Why the entrypoints live where they do

Source resolution, CLI selection, and skill replacement are factored into a shared
`scripts/shapeup-sdlc/lib/lib-harness.sh`; the migration runner lives in
`scripts/shapeup-sdlc/lib/lib-migrate.sh`.

The `install-harness.sh` / `migrate.sh` entrypoints stay at a stable `scripts/` path on
purpose — an update mechanism that broke its own bookmarked URL on every refactor would
defeat the point of having one.
