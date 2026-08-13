# ADR-0002 — Plugin repository organization

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-02 |
| **Complements** | [ADR-0001](0001-consumer-file-organization.md), which organizes the *consumer's* workspace. This one organizes the *plugin's own* repository. |
| **Affects** | the publish boundary, `scripts/` (frozen), the retired `anti-lying-kit` |

## Context

The repository held four product shapes in one flat namespace — a Claude Code plugin, an npm
package, a second marketplace plugin, and compiled Cursor/Antigravity output — with nothing in the
tree distinguishing product from build tooling from proof. Three consequences:

**The publish boundary was wrong in three independent ways.** `package.json` `files[]` declared
`agents/`, which does not exist. It declared `dist/antigravity/`, which is gitignored with zero
tracked files — so the tarball's contents depended on whether the publisher happened to have run
`distribute.js` locally. And `files: ["skills/"]` shipped 13 trigger-eval datasets that
`evals/README.md` explicitly calls "repo-only, not shipped".

**`scripts/` was simultaneously a frozen public API and a dev scratch space.** `docs/upgrading.md`
publishes `curl .../main/scripts/migrate.sh | bash`, and line 58 promises those entry points stay
at a stable path. Beside them sat `distribute.js` and `record-demo.mjs`, pure maintainer tooling.
Anyone tidying "the scripts folder" would break every upgrade command ever published, with no
error and no deprecation channel.

**The oracles were product filed as tooling.** `docs/quickstart.md` tells users to run
`process-oracle.mjs`, and a scope contract's `e2e_verification_fixtures` are shell commands
`t0-verify` executes — so a user's fixture legitimately invokes one. They lived under `scripts/`
and were **not in `files[]`**, meaning the quickstart referenced a file no install contained.

## Decision

**Every top-level directory answers one question: when does this run?**

| Lifecycle | Directories | Constraint |
|---|---|---|
| **Ships** | `skills/` `hooks/` `commands/` `oracles/` `.claude-plugin/` `AGENTS.md` | loaded via `${CLAUDE_PLUGIN_ROOT}` |
| **Installs** | `bin/` `scripts/` | **frozen — published `curl` URLs** |
| **Builds** | `tools/` | maintainer-only; `dist/` is its output, gitignored |
| **Proves** | `tests/` `evals/` `examples/` | CI; never ships |
| **Explains** | `docs/` | humans |

### The moves

- **`oracles/` promoted to the repo root and added to `files[]`.** They are the probing grammar a
  user's fixtures call. Was `scripts/shapeup-sdlc/oracles/`.
- **`tools/`** takes `distribute.js`, `trigger-eval.mjs` and `demo/` out of `scripts/`, leaving
  `scripts/` holding only the frozen URL contract.
- **`scripts/FROZEN.md`** states the guarantee in the directory it protects, not only in
  `docs/upgrading.md` where the person doing the tidying will not look.
- **The working record is separated from the design record.** Research notes, staging plans and
  launch drafts were split away from `docs/design/`, which stays public — this project's pitch is
  "measured, not theorized", so the design record is product value. That separation has since been
  resolved by retiring the working record entirely: once a plan has shipped, what is worth keeping
  is the decision, and the decision belongs in an ADR. `docs/design/` is now the whole explanation
  layer, and this file is where that outcome lives.
- **`files[]` corrected**: `agents/` and `dist/antigravity/` dropped, `oracles/` added,
  `!skills/**/evals/**` added. The tarball went from 135 files with 13 unwanted eval datasets and
  two dangling entries to 135 files with zero of either.
- **`anti-lying-kit` retired.** It was a second marketplace plugin that vendored three enforcement
  hooks with no code sharing and no sync check — superseded by the main hooks. Removed from
  `marketplace.json` and deleted; git history retains it.

### The plugin stays at the repo root

A `plugin/` subdirectory would make the publish boundary one folder, which is tempting. Rejected:
it rewrites every path in the suite and in `${CLAUDE_PLUGIN_ROOT}` conventions for a legibility
gain that subordinating the *non*-product directories achieves for free. For a single-product
repo, plugin-at-root is idiomatic.

### `dist/` is output, not product

The Claude Code plugin is the product; Cursor, Antigravity and Codex were export targets generated
on demand by a maintainer-only distribute script. No documentation offered them via npm, so removing
`dist/antigravity/` from `files[]` resolved the gitignored-but-published contradiction and broke
nothing. Those export channels have since been removed outright — Claude Code is the only target the
hooks enforce — and the distribute script went with them.

## Consequences

- The tarball is now derivable from the tree rather than from the publisher's local state.
- A contributor can tell product from tooling from proof by reading `ls`.
- The check count fell from 826 to 802 — test #30 covered the retired plugin and went with it.
- The lifecycle split is a *legibility* boundary, not an access-control one — everything in the
  tree is published to anyone who clones, and nothing here is secret.

## Follow-up not taken

`bin/init.mjs` describes itself as "a faithful Node port of `scripts/install-harness.sh`". Two
implementations of one contract kept in sync by hand is the same defect class this ADR addresses,
but converging them is a refactor rather than a reorganization, and belongs in its own change.
