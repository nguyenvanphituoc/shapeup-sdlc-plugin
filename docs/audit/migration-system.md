# Harness Migration System

> How an installed harness is **updated** and how its stateful project data is **migrated** across
> versions. Modeled directly on database migration tools (Flyway / Rails / Alembic) so every future
> version change is an ordered, idempotent, tracked step — not another bespoke one-off script.

## Why this exists

The original migration was a single hard-coded transform (flat KB → per-skill KB) in a one-off
script. That is *one migration at one version*. Version 0.4, 0.5, … will each need their own data
changes, and a pile of bespoke scripts has no ordering, no "what version is this project at?", and
no guard against running the same transform twice. Databases solved this decades ago; we copy the
model. (That one-off transform is now migration `0001`; the old `migrate-knowledge-base.sh` script
has been removed.)

## The model (mapped from DB migrations)

| Database concept | Harness realization |
|---|---|
| Migration file `V2__add_users.sql` | `scripts/migrations/NNNN__slug.sh` (4-digit id, kebab slug) |
| `schema_migrations` table | `docs/shapeup-sdlc/.harness-migrations` — committed ledger of applied ids |
| Current schema version | `docs/shapeup-sdlc/.harness-version` — last plugin version applied |
| `flyway migrate` / `rails db:migrate` | `scripts/migrate.sh` → `harness_run_migrations` (lib-migrate.sh) |
| Deploy app code, then migrate DB | **update code** (replace skill files) **then migrate data** (run pending migrations) |

### Two separate operations
- **Update code** — installed skill files are *stateless copies*; the updater always overwrites them
  to the source version. (Like shipping a new app binary.) Handled by `harness_replace_skills`.
- **Migrate data** — the project's *stateful* harness artifacts (knowledge-base layout, future
  metrics/ledger shapes, gitignore rules) are transformed by versioned migrations. (Like running DB
  migrations after the deploy.) Handled by `harness_run_migrations`.

`migrate.sh` does both; `--data-only` runs migrations alone; `--dry-run` lists pending without
applying.

### Invariants (the guarantees)
1. **Ordered.** Migrations apply in ascending id order (zero-padded ids sort lexically = numerically).
2. **Tracked.** Each applied migration is appended to the committed ledger: `id  applied_utc
   plugin_version  slug`. Committed on purpose — a teammate inherits applied-state on `git pull`,
   exactly like checking in a Rails `schema.rb`.
3. **Idempotent.** A migration whose id is already in the ledger is skipped. Re-running `migrate.sh`
   is always safe. Each `migration_up` is *also* written to be safe if run by hand (guards on
   existence).
4. **Forward-only.** No down/rollback by default (matches how DB deploys actually run). A migration
   may define `migration_down()` for future tooling, but the runner does not call it.
5. **Fail-closed.** A failing migration aborts *before* being recorded, so the fix-and-rerun path
   re-attempts only the failed one.

## Adding a migration (the recipe for 0002, 0003, …)

1. Create `scripts/migrations/0002__<slug>.sh`:
   ```bash
   MIGRATION_DESC="One line: what stateful change this makes"
   migration_up() {
     local target="$1"
     # idempotent transform of files under "$target" (guard every write)
   }
   ```
2. That's it — the runner discovers it by filename, orders it after 0001, applies it once, records it.
3. `node tests/structural.mjs` enforces the naming + that `migration_up` and `MIGRATION_DESC` exist
   and ids are unique. CI fails a malformed migration.

**Rules for writing one:**
- Operate only on `$target` (the consumer's project), never on the plugin repo.
- Be idempotent: check before you create/move/delete; never clobber user data (0001 retires the old
  KB to `*.migrated`, it does not `rm` it).
- Keep one logical change per migration (one schema concern), so the ledger reads as a history.
- Never renumber or edit an applied migration's behavior — add a new one (same as DB migrations).

## Files
- `scripts/lib/lib-migrate.sh` — the runner (discover → skip-applied → apply → record → stamp version).
- `scripts/migrations/0001__per-skill-knowledge-base.sh` — the first migration (the old KB transform).
- `scripts/migrate.sh` — entrypoint (update code + migrate data; `--data-only`, `--dry-run`).

## Platform
- macOS / Linux (bash). The harness scripts are bash-only by design; on Windows, run them under
  WSL or Git Bash. (PowerShell ports were removed to keep a single, well-tested code path.)
