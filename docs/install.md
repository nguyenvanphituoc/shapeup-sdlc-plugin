# Install

Three ways in, depending on whether you want the harness for yourself, for a repo, or for
a whole team. If you just want to try it, use **Plugin install** and stop there.

> **One-command scaffolding:** `npx shapeup-sdlc init` — pure Node, no bash, no jq, works on
> Windows (same layout as the shell installer below). *Requires the package to be published
> to npm; until then, run it from a clone: `node bin/init.mjs -d <target> -y`.*

- [Plugin install (Claude Code)](#plugin-install-claude-code)
- [The browser dependency](#the-browser-dependency)
- [Install for the whole team](#install-for-the-whole-team)
- [Local scaffolding](#local-scaffolding)
- [Troubleshooting](#troubleshooting)

Upgrading an existing install is a separate document: [`upgrading.md`](upgrading.md).

## Plugin install (Claude Code)

In any Claude Code session:

```
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin
/plugin install shapeup-sdlc-plugin@nvptuoc-marketplace
```

This repository is **both the plugin and its marketplace**, so there is nothing else to
register.

Pin to a released version:

```
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin@v1.7.0
```

> **This path installs the plugin and nothing else — in particular, no permission grant.**
> Observed on a fresh project: `/plugin install` leaves `permissions.allow` empty, because it
> registers the plugin and knows nothing about what the plugin needs to run.
>
> Every load-bearing step of a run is a Node script that ships *with* the plugin and therefore lives
> outside your project, so executing it needs approval. **Interactively that is fine** — you approve
> once and forget it, which is why this is still the right way to try the harness.
>
> **Unattended, it is fatal.** There is nobody to approve, and the run cannot take its first step:
> the session stalls into approval denial after approval denial until the agent gives up on the
> harness and builds the feature by hand. Before any headless or `--unattended` run, get the grant by
> either running the scaffolding installer —
>
> ```bash
> npx shapeup-sdlc init -d . -y
> ```
>
> — or copying the `permissions.allow` block out of `.claude/settings.local.example.json` into your
> own settings. Both cover the same three script directories (`tech-lead`, `ba-pitch-analyzer`,
> `spec-evaluator`); the installer additionally writes the double-quoted spelling of each prefix,
> which is the form the skills' own invocation lines use.

## The browser dependency

**The plugin depends on no other plugin.** `.claude-plugin/plugin.json` declares no
dependencies, and nothing in a run resolves one. What `[ui]` grading needs is the **Playwright
CLI in the project under test** — the same `@playwright/test` a web project generally already
has — driven as a subprocess by the `ui` oracle. Nothing is installed into your Claude Code
session, and the harness itself stays dependency-free.

```bash
npm i -D @playwright/test && npx playwright install chromium
```

**It is a lazy dependency.** A run whose spec contains no `[ui]` criterion completes on a machine
with no browser at all — the check happens at the moment the first `[ui]` criterion is actually
graded, never at install time. When the CLI or the browser binary is missing, the oracle FAILs
*that probe* and names the command above. It never auto-installs (a grading run must not reach
the network), and it never silently skips: a `[ui]` criterion nobody could verify is a FAIL
reading "unverifiable: no browser", not a pass.

The oracle resolves the CLI from the project's own `node_modules/.bin/playwright` first, then
`npx --no-install playwright`, so a monorepo's hoisted install works without configuration.

> **If you want MCP mode**, note that `mcp` is a subcommand of that same CLI
> (`npx playwright mcp`) — it has not needed a separate Claude Code plugin since Playwright
> folded the server into the package. The `ui` oracle does not use it: an MCP session streams the
> whole accessibility tree into context every step, and the point of the oracle is a verdict that
> costs no model tokens and can be re-run byte-identically by the regression check.

## Install for the whole team

The [local scaffolding installer](#local-scaffolding) does this for you. To wire it by hand,
commit this to the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "nvptuoc-marketplace": {
      "source": { "source": "github", "repo": "nguyenvanphituoc/shapeup-sdlc-plugin" }
    }
  },
  "enabledPlugins": {
    "shapeup-sdlc-plugin@nvptuoc-marketplace": true
  }
}
```

## Local scaffolding

Instead of installing the plugin globally, you can scaffold the harness directly into a
target repository. This wires the plugin via `.claude/settings.json` (marketplace +
enable) and writes the headless pipeline permission grant.

Run **one** of the following from the root of your target project.

**Option A — remote (no clone needed):**

```bash
curl -fsSL "https://raw.githubusercontent.com/nguyenvanphituoc/shapeup-sdlc-plugin/main/scripts/install-harness.sh" | bash -s -- --directory . --yes
```

> **The `--yes` flag is required with `curl | bash`.** stdin is consumed by the pipe, so the
> interactive confirmation prompt receives no input and cancels. Omit `--yes` when running
> the script directly to get an explicit confirmation.

**Option B — local clone:**

```bash
/path/to/shapeup-sdlc-plugin/scripts/install-harness.sh --directory .
```

> The installer scripts are bash (macOS / Linux). On Windows, run them under WSL or Git Bash.

The installer configures:

- **Claude Code** — runs `claude plugin marketplace add --scope project` +
  `claude plugin install --scope project` to register the marketplace and enable the plugin
  in one shot (writing `.claude/settings.json`), then appends to / creates `CLAUDE.md`. Falls
  back to writing `settings.json` directly if the `claude` CLI is not on `PATH`.
- **Git boundaries & telemetry** — adds the `.shapeup/` + Tier C ignore rules to
  `.gitignore`, initializes the per-machine `.shapeup/metrics/` shard directory, and
  drops the Tier C example templates (`.claude/settings.local.example.json`,
  `.env.shapeup.example`).

## Troubleshooting

### A `[ui]` criterion FAILs with "the Playwright CLI is not available"

Not a plugin problem — the harness declares no plugin dependencies. The project under test has no
Playwright CLI the oracle can reach. Install it *in that project*:

```bash
npm i -D @playwright/test && npx playwright install chromium
```

The same verdict with "the browser binary is missing" means the CLI resolved but its browser was
never downloaded; the second half of that command is the fix. Both are graded as FAILs on purpose
— an unverifiable acceptance criterion is not a passing one.

### The remote installer exits immediately without doing anything

You piped it through `bash` without `--yes`. See the note under
[Local scaffolding](#local-scaffolding).

### The plugin does not appear to be loaded

The `SessionStart` hook prints a load confirmation. If you do not see it, check that the
plugin is enabled (`claude plugin list`) and that `hooks/hooks.json` is present in the
installed copy.
