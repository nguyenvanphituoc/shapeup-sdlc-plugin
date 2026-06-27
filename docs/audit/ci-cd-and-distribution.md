# CI/CD, Fresh Login & Migration

> Companion to `independent-audit-and-evolution-plan.md`. Documents the publish/deploy pipeline,
> the headless **fresh-login** (auth) flow needed for behavioral evals, and the **migration/update**
> path for existing installs. Reflects the repo as of 2026-06-26.

---

## 1. Pipeline overview

```
 PR / push to main ──► CI (ci.yml)
                         ├─ validate        : claude plugin validate --strict (plugin + marketplace)
                         ├─ json-lint       : every *.json parses
                         ├─ structural-tests: node tests/structural.mjs   ← Tier 0 (107 checks)
                         │                     incl. each oracle's reference impl + negative control
                         │                     (#6, #8–#11) and the install-safety guard (#12, F9)
                         └─ eval-gate        : honest placeholder          ← Stage C target

 git tag vX.Y.Z ──────► Release (release.yml)
                         ├─ validate --strict
                         ├─ assert tag == plugin.json version
                         ├─ npm run distribute   (Cursor .mdc + Antigravity + VSIX)
                         └─ gh release with VSIX + cursor-rules.zip + antigravity-subagents.zip
```

Two CI jobs (`validate`, `json-lint`) plus the two new ones. The plugin is distributed **as its own
marketplace** — there is no npm publish; consumers add the GitHub repo as a Claude Code marketplace.

### What needs auth, and what doesn't
- `validate`, `json-lint`, `structural-tests`, `distribute`, the release packaging — **no auth.**
  `claude plugin validate` is a static manifest check; it does not call the model.
- **Behavioral evals (Tier 1/2, Stage C)** — **require auth** because they invoke `claude -p …`.
  This is the only part of the pipeline that needs a "fresh login."

---

## 2. Fresh login (headless auth for eval runs)

The eval-gate placeholder exits 0 today. When Stage C lands, the eval job must authenticate the
Claude Code CLI non-interactively. Two supported mechanisms:

### Option A — API key (simplest for CI)
```yaml
  evals:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}   # repo/org secret, never echoed
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm install -g @anthropic-ai/claude-code
      - run: claude --version                  # smoke: CLI present
      - run: |
          # eval runner invokes `claude -p` with the SESSION model id (see Stage C1 in the plan).
          # Skills must be loaded from the working copy so REAL skill activation is measured:
          claude --plugin-dir . -p "smoke: list installed skills" >/dev/null
      # - run: make eval            # ← once skills/<name>/evals/ + baselines exist
```

### Option B — OAuth token (for Claude subscription / Max accounts)
Generate once locally with `claude setup-token`, store the result as the `CLAUDE_CODE_OAUTH_TOKEN`
secret, and set it in `env:` instead of `ANTHROPIC_API_KEY`. Use this when the team bills evals to a
Claude subscription rather than the API.

### Hard rules for the auth step
- Secrets come **only** from `secrets.*`; never commit a key, never `echo "$ANTHROPIC_API_KEY"`.
- The eval job must be **opt-in** (its own job, `workflow_dispatch` or a label-gated trigger) so
  routine PRs don't burn tokens. Manifest/structural CI stays auth-free and runs on every push.
- Pin a model id explicitly in the eval runner (the prior measurement bug was the default model
  silently never self-invoking — see roadmap Phase 1 gotchas). Use the session model id.
- Treat eval runs as **non-deterministic**: average ≥3 runs/query (per the plan), and commit the
  baseline + regression report the seesaw gate reads — CI itself never calls Claude for the *gate*
  decision (it reads committed artifacts), only the *measurement* job does.

---

## 3. Distribution targets (from `scripts/distribute.js`)
`npm run distribute` compiles the single-source `skills/` + `commands/` into:
- **Claude Code** — installed directly from this repo-as-marketplace (no compile needed).
- **Cursor** — `dist/cursor-rules/*.mdc` (one per skill/command) + a packaged `.vsix` extension.
- **Antigravity** — `dist/antigravity/subagents/*.{json,md}` + a `subagents.json` index.
- **Codex** — skills copied verbatim by the installer (no compile step).

The release workflow packages the VSIX + two zips as GitHub Release assets; the installer's remote
path downloads `antigravity-subagents.zip` from the latest release.

---

## 4. Install (fresh) & migration (update)

Both flows share `scripts/lib/lib-harness.{sh,ps1}` so local-clone and `curl | bash` behave
identically, and both target all three CLIs (Claude / Antigravity / Codex).

### Fresh install
```bash
# In a Claude Code session (recommended):
/plugin marketplace add nguyenvanphituoc/shapeup-sdlc-plugin
/plugin install shapeup-sdlc-plugin@nvptuoc-marketplace

# Or local scaffolding for a whole team / multi-CLI repo:
bash scripts/install-harness.sh -d <project> -y
```
The installer: clones `AGENTS.md` (or replaces the `<!-- HARNESS_START -->` block), wires each CLI
to it (`@AGENTS.md` import for Claude; auto-discovery for Antigravity/Codex), installs/enables the
marketplace plugin via the `claude` CLI (falling back to writing `settings.json`), and seeds
`.gitignore` + `docs/shapeup-sdlc/metrics.jsonl`.

### Migration / update — versioned (see `migration-system.md`)
```bash
bash scripts/migrate.sh -d <project> -y        # update code + migrate data
bash scripts/migrate.sh -d <project> --dry-run  # list pending migrations only
```
Modeled on database migration tools. It (1) **updates code** — re-installs current skills for the
chosen CLIs — then (2) **migrates data** — applies every pending `scripts/migrations/NNNN__*.sh` in
id order, recording each in the committed `docs/shapeup-sdlc/.harness-migrations` ledger and stamping
`docs/shapeup-sdlc/.harness-version`. Idempotent: applied migrations are skipped on re-run. The
pre-0.12 flat-KB transform is now migration `0001` (non-destructive — old file retired to
`*.migrated`).

**Gaps worth closing:**
- ~~No version stamp~~ — **closed:** `.harness-version` + the `.harness-migrations` ledger now answer
  "what version / which migrations is this project at?".
- **Script integration test** — `tests/structural.mjs` now lints migration well-formedness, but a
  bats test that dry-runs a real migration into a temp dir would harden the update path further.

> Platform: bash only (macOS / Linux); Windows via WSL or Git Bash. PowerShell scripts were removed.
