# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

Above the rule: the shipped harness doc. Below: guidance for developing this repo.

## What this repo is

A Claude Code plugin (`shapeup-sdlc`). AGENTS.md is a **shipped product artifact** —
`bin/init.mjs` splices its `<!-- HARNESS_START -->…<!-- HARNESS_END -->` block into
consumer projects. Editing it is a product change: speak in skills/commands/options,
never `.mjs` paths.

## Commands

- `npm test` — Tier-0 structural suite (`tests/structural/`); zero deps, no install step.
- `claude plugin validate . --strict` (and the same for `./.claude-plugin/marketplace.json`) — CI parity.
- `claude --plugin-dir .` — load the working copy without installing.
- `npm run demo` — regenerates `docs/assets/demo-gate.svg` by running the real gate hook; never hand-edit the SVG.

## Rules that prevent breakage

- Zero dependencies is load-bearing: executable code is plain Node ESM (`.mjs`),
  `node:` builtins only, no network calls anywhere.
- Hooks fail open, never closed, unless the bad state is positively proven
  (`hooks/gate-l2.mjs` is the reference implementation).
- A version bump touches both `package.json` and `.claude-plugin/plugin.json`;
  release CI fails on mismatch.
- A new worker skill takes 3 steps: `SKILL.md` → declare fields in
  `skills/tech-lead/schemas/domain.schema.json` → teach `compile-order.mjs` and
  `ingest-result.mjs`. Step 1 alone yields a skill the orchestrator can't dispatch.
- `tools/` is repo-only and never ships; what ships is the `files` allowlist in `package.json`.
- Commit subjects: `type(scope): lowercase declarative`.