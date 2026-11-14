# Install

Three ways in, depending on whether you want the harness for yourself, for a repo, or for
a whole team. If you just want to try it, use **Plugin install** and stop there.

> **One-command scaffolding:** `npx shapeup-sdlc init` — pure Node, no bash, no jq, works on
> Windows (same layout as the shell installer below). The package is published, so this runs
> without a clone; from a clone the equivalent is `node bin/init.mjs -d <target> -y`.

- [Plugin install (Claude Code)](#plugin-install-claude-code)
- [The Playwright dependency](#the-playwright-dependency)
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
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin@<release-tag>
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
> harness and builds the feature by hand. Before any headless run, get the grant by
> either running the scaffolding installer —
>
> ```bash
> npx shapeup-sdlc init -d . -y
> ```
>
> — or copying the `permissions.allow` block out of `.claude/settings.local.example.json` into your
> own settings. Both cover the kernel's one entry point (`kernel/harness.mjs`); the installer additionally
> writes the double-quoted spelling of the prefix, which is the form the skills' own invocation
> lines use.

## The Playwright dependency

The plugin depends on the official **Playwright** plugin
(`playwright@claude-plugins-official`) — the QA and evaluation skills drive the running app
to verify `[ui]` acceptance criteria. On a normal `/plugin install`, Claude Code resolves
the dependency automatically (adding the `claude-plugins-official` marketplace if needed).

Those skills drive the browser through the Playwright **CLI** by default (it is far more
token-efficient than the MCP server).

**The browser is a lazy dependency.** A run whose spec contains no `[ui]` acceptance criterion
completes on a machine with no browser installed. The eval skill checks for the browser at the
moment it reaches the first `[ui]` criterion, and if it is missing, fails *that probe* with the
fix spelled out:

```bash
npx playwright install chromium
```

For MCP mode (sandboxed environments only), additionally
`claude plugin install playwright@claude-plugins-official`.

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

## Codex CLI (experimental)

```bash
npx shapeup-sdlc init --target codex -y
npx shapeup-sdlc init --target codex --check   # reports what is missing or stale
npx shapeup-sdlc init --target codex --dry-run # writes nothing
```

The runtime is copied to `~/.shapeup-sdlc/<version>/`, the two guard hooks are merged into
`~/.codex/hooks.json`, the workers become `~/.codex/agents/*.toml`, and the skills (with `ship` and `retro`
rewritten as skills) go under `~/.agents/skills/`. Your project receives only the harness block in `AGENTS.md`
and the ignore rules — no path of your machine is written into it. Pass `--home <dir>` to install somewhere else.

Codex loads hooks only from a trusted layer, and skips an unreviewed hook **without an error**, which leaves the
write fence off. Approve the hooks in Codex before a run, then confirm `.shapeup/decisions.jsonl` gains a row on
the first write. Pass flags to `$ship` on its first line (`$ship --no-qa <pitch>`); Codex documents no argument
syntax for skills.

### Unattended runs on Codex (not measured)

Claude Code's grant is two rules in the project's settings. Codex has no equivalent this plugin writes for you.
Two documented routes, neither run end to end yet:

- `codex exec --sandbox workspace-write` with approvals off. Nothing is opened up, but a sub-agent that needs a
  *new* approval fails back to its parent instead of waiting, so a run can stall on the first command outside the
  sandbox. Try this first.
- A command-prefix rule allowing `node <runtime>/kernel/harness.mjs`. That works, but Codex documents such a rule as
  running the command **outside the sandbox**, so it widens what the kernel can touch. Choose it knowingly.

The dispatch of a worker is not checked for a valid WorkOrder by a hook on Codex (no hook is wired at spawn): the
loop validates each order itself before dispatching, and a worker reports which skill it loaded with `attest`.

## Other model providers (not measured)

A run's roles take `--exec-model`, `--eval-model` and `--qa-model`. A model outside the Claude family must be ranked
by the floor (`deepseek-v4-pro`, the `gpt-5` family) or named with `--accept-unranked-models` at launch; a cheap tier
(`mini`, `nano`, `lite`, `small`, `flash`-style names you rank yourself) is refused whatever the family.

DeepSeek publishes an Anthropic-compatible endpoint (`https://api.deepseek.com/anthropic`) and an OpenAI Responses
endpoint, read from its public documentation on 2026-11-14 and not yet exercised by this plugin. Claude Code's own
documentation states that routing it to a non-Claude model is unsupported. Through that endpoint, a model argument
must start with `claude` (DeepSeek maps those names onto its own models), so pass Claude aliases to `Agent` and the
launch record, not DeepSeek ids; what the dispatch receipt then reports as the model that ran is unknown until
a run is observed. Two further caveats from the same page: a forced `tool_choice` fails while thinking is on, and
beta request fields may be rejected unless `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`. No gate or evaluator
schema-conformance rate has been measured on any DeepSeek model; treat the channel as a trial.

**Your code and pitch go to a third party.** DeepSeek's privacy policy states data is stored and processed in
mainland China and its API terms follow Chinese law; whether API data is used for training is not stated. That is a
decision for your organisation (and its legal team), not for this plugin.

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

The plugin prints nothing when it loads. Check that it is enabled (`claude plugin list`) and
that `hooks/hooks.json` is present in the installed copy; `claude --plugin-dir .` loads a working copy.
