---
description: Set up this project for the harness when the plugin is already installed — the kernel grant, the harness block, the ignore rules
argument-hint: "[--dry-run | --check] [-d <dir>]"
allowed-tools: Bash(node "*/bin/init-plugin.mjs" *)
---
Set up the current project for the Shape Up harness by running the installer that ships with this plugin.
Run exactly this one command, from the project's root, with nothing added or rewritten:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/init-plugin.mjs" -d . -y $ARGUMENTS
```

It writes what an installed plugin still lacks in a project, and nothing else:

- the kernel permission grant (two Bash rules) merged into `.claude/settings.json`, keeping every rule already there;
- the harness block in `AGENTS.md`, beside the project's own text, and the `@AGENTS.md` import in `CLAUDE.md`;
- the ignore rules for the run trace, the metrics folder, and the two example settings templates.

It does **not** register the plugin again at project scope: the plugin is already installed, and a second copy
would sit beside the first. A team that wants the plugin to arrive with the repository runs
`npx shapeup-sdlc init` instead, which registers it as well.

`--dry-run` prints the plan and writes nothing; `--check` reports whether the project is set up and writes nothing.

Afterwards, report to the user what the installer printed — every file it changed, and any warning word for word,
above all the one about an untrusted workspace, which means the grant will be ignored until the workspace is
trusted. Then tell them to start a new session in this project before `/shapeup-sdlc-plugin:ship`: the session
reads the `@AGENTS.md` import only when it starts. Do not edit any of the files yourself, and do not trust the
workspace on their behalf.
