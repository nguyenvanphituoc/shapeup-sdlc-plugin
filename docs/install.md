# Install

Three ways in, depending on whether you want the harness for yourself, for a repo, or for
a whole team. If you just want to try it, use **Plugin install** and stop there.

- [Plugin install (Claude Code)](#plugin-install-claude-code)
- [The Playwright dependency](#the-playwright-dependency)
- [Install for the whole team](#install-for-the-whole-team)
- [Local scaffolding (Claude Code / Antigravity / Codex)](#local-scaffolding)
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
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin@v1.3.0
```

## The Playwright dependency

The plugin depends on the official **Playwright** plugin
(`playwright@claude-plugins-official`) — the QA and evaluation skills drive the running app
to verify `[ui]` acceptance criteria. On a normal `/plugin install`, Claude Code resolves
the dependency automatically (adding the `claude-plugins-official` marketplace if needed).

Those skills drive the browser through the Playwright **CLI** by default (it is far more
token-efficient than the MCP server), so a browser binary must be present:

```bash
npx playwright install chromium
```

> **Note.** Today this is an *install-time* prerequisite even for runs that never evaluate a
> `[ui]` criterion. Making it lazy is tracked as a known rough edge — see the
> [contribution guide](../CONTRIBUTING.md).

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
target repository. For Claude Code this wires the plugin via `.claude/settings.json`
(marketplace + enable). For Antigravity and Codex it copies the skill files into the
project, which enables **local skill evolution and per-project tuning**.

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
- **Antigravity** — copies skills to `.agents/skills/`, subagent configs to
  `.agents/subagents/`, and creates `.agents/AGENTS.md`.
- **Codex** — copies skills to `.codex/skills/` and creates `.codex/AGENTS.md`.
- **Git boundaries & telemetry** — adds the `.shapeup-sdlc/` + Tier C ignore rules to
  `.gitignore`, initializes the per-machine `docs/shapeup-sdlc/metrics/` shard directory, and
  drops the Tier C example templates (`.claude/settings.local.example.json`,
  `.env.shapeup.example`).

## Troubleshooting

### `Dependency "playwright@claude-plugins-official" is not installed`

The Playwright plugin is missing *or installed-but-disabled*. Install and/or enable it, then
reload:

```bash
claude plugin install playwright@claude-plugins-official   # if missing
claude plugin enable  playwright@claude-plugins-official   # if disabled
```

In a session, `/reload-plugins` picks up the change.

Note that the dependency gate is also checked when loading a working copy with
`claude --plugin-dir .`, so enable Playwright before dev-loading this plugin.

### The remote installer exits immediately without doing anything

You piped it through `bash` without `--yes`. See the note under
[Local scaffolding](#local-scaffolding).

### The plugin does not appear to be loaded

The `SessionStart` hook prints a load confirmation. If you do not see it, check that the
plugin is enabled (`claude plugin list`) and that `hooks/hooks.json` is present in the
installed copy.
