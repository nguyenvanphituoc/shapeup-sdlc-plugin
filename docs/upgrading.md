# Upgrading an existing install

Updating an install is a **versioned migration**, modeled on database migration tools
(Flyway / Rails). `migrate.sh` first **updates code** — replacing the installed skills for
each detected CLI — then **migrates data** by applying any pending
`scripts/shapeup-sdlc/migrations/NNNN__*.sh` in order and recording each in a committed
`docs/shapeup-sdlc/.harness-migrations` ledger.

It is idempotent: applied migrations are skipped on re-run, so it is always safe to run
again, and every future version adds its own migration rather than another one-off script.
Design notes: [`audit/migration-system.md`](audit/migration-system.md).

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
`.shapeup-sdlc/knowledge-base.md` — which never reached teammates and was never read back. It
now files each rule **by skill** under committed `docs/shapeup-sdlc/knowledge-base/<skill>.md`,
read back by `task-executor` / `ba-pitch-analyzer` / `qa-edge-hunter` at the top of their next
run.

Old rules are preserved verbatim into `docs/shapeup-sdlc/knowledge-base/_INBOX.md` and are
**never auto-categorized**. Afterward, run `/coach` on `_INBOX.md` to assign each rule to a
skill — its GATE COACH-1 asks, it never assumes — then commit `docs/shapeup-sdlc/` so the team
inherits the knowledge base and the migration ledger on `git pull`.

### `0002` — file-organization addendum

Brings a pre-0.3.0 install up to date: shards a flat `docs/shapeup-sdlc/metrics.jsonl` into
`docs/shapeup-sdlc/metrics/<machine-id>.jsonl` (retiring the old file to
`metrics.jsonl.migrated`), adds the Tier C `.gitignore` rules, and drops the Tier C example
templates — the same three steps a fresh `install-harness.sh` run already does.

## Why the entrypoints live where they do

Source resolution, CLI selection, and skill replacement are factored into a shared
`scripts/shapeup-sdlc/lib/lib-harness.sh`; the migration runner lives in
`scripts/shapeup-sdlc/lib/lib-migrate.sh`.

The `install-harness.sh` / `migrate.sh` entrypoints stay at a stable `scripts/` path on
purpose — an update mechanism that broke its own bookmarked URL on every refactor would
defeat the point of having one.
