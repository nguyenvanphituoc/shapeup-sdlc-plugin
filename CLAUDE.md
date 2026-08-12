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

## Keeping the docs and the plugin honest

This repo is both a product and its own blueprint, and the two drift apart silently — a doc
saying "11 workers" over a 10-member enum reads perfectly. Two standing rules:

- **Derive facts from artifacts, never from prose.** Enums come from
  `skills/tech-lead/schemas/domain.schema.json`, counts from the filesystem, and hook behavior
  from *executing the hook* against a fixture. A doc, a glossary and a screenshot can all agree
  with each other and all be wrong; reading any one of them just confirms the others.
- **Nothing in the shipped set may reference something the user did not receive.** No benchmark
  results, internal defect IDs (`HD-00x`), migration stage names, audit codenames, or paths into
  `docs/`, `tests/`, `tools/`, `evals/`. Keep the operative rationale, drop the evidence: a
  comment should explain *why* the code is shaped that way without citing an artifact the reader
  cannot open.

Run the **`harness-maintenance-audit`** skill (`.claude/skills/`) for both passes — before a
release, after adding or removing a skill/operation/hook/command, and after any cleanup or rename
commit, whose blast radius is routinely wider than its subject line claims. It fixes docs and
reports code defects separately, on purpose: a doc fix records reality, a code fix changes it.

Two traps it exists to catch, both of which have bitten this repo:

- A red check nobody has looked at. Run `npm test` and `npm run demo` *before* editing — a suite
  you have not run is an assumption, not a baseline. Never make a red check green by weakening it.
- A stale measured number. Trigger and acceptance rates belong to a run with a model and a date.
  If the dataset changed, say the measurement predates it — do not rescale the figure to match a
  count you just derived, which silently manufactures a measurement.