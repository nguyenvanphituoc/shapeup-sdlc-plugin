# Enhancements — deferred backlog

Tracked-but-not-yet-resolved improvements. Each item notes the problem, the options on
the table, and a recommendation. Resolve in a later pass; check items off as done.

## Packaging / dependencies

- [ ] **Reconcile the Playwright dependency with actual usage.**
  - **Problem:** `plugin.json` hard-depends on `playwright@claude-plugins-official` (the
    MCP-server plugin), but the skills drive the browser through the Playwright **CLI**
    (`npx playwright`, see `skills/spec-evaluator/references/probing.md:7` — *"not the MCP
    server"*). MCP mode is only an optional fallback (`browser_mode: cli | mcp | none`).
    The mismatch produces a hard `Dependency … is not installed` gate failure when the
    plugin is missing/disabled or when dev-loading via `claude --plugin-dir .`.
  - **Options:**
    - **A (recommended):** Drop the hard dependency from `plugin.json`; document
      `npx playwright install chromium` as a prerequisite (done in README); keep the MCP
      plugin as an *optional* enhancement for `browser_mode: mcp`.
    - **B:** Keep the dependency, rely on auto-resolution on real installs, document the
      enable/install troubleshooting (done in README).
    - **C:** Ship a `scripts/setup.sh` that adds the marketplace + installs/enables
      Playwright + installs the chromium binary. Plugins have no postinstall hook, so it
      stays a manual one-time step.
  - **Decision needed:** A vs B vs C. README currently documents B+CLI prereq as a stopgap.

- [ ] **Optional setup script.** If we keep any manual setup, add `scripts/setup.sh`
  (marketplace add → playwright install/enable → `npx playwright install chromium`) and
  reference it from README "Install".

## Developer experience

- [ ] **Dev-load smoke check.** A `make dev` / script target that runs
  `claude plugin validate . --strict`, the marketplace validate, and the JSON lint, then
  prints the `claude --plugin-dir .` hint — one command to confirm a working copy is
  loadable.

- [ ] **Document the `--plugin-dir` vs installed-cache distinction** in README "Develop":
  `--plugin-dir` loads at launch only (no in-session `/reload` equivalent for a path that
  wasn't configured at boot), and skills load at session start (relaunch after editing
  `description` triggers).

## Self-improvement / evolution

- [ ] **Make the harness self-improving** — measure every skill change against a committed
  baseline so it ships only if it provably improves (seesaw constraint). Wires
  `/skill-creator:skill-creator` as the measurement engine and adapts HarnessX/AEGIS as the
  evolution loop. Full phased plan: [`evolution-roadmap.md`](./evolution-roadmap.md).
  Builds tier-1/tier-2 of the eval design already named in
  `skills/tech-lead/references/ledger-schema.md:139` (only tier-3 `metrics.jsonl` exists today).

## Notes

- Add new items as `- [ ]` with Problem / Options / Decision-needed where a choice is open.
