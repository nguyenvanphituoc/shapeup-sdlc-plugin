# Code surface — envlint

## Repo state at orient time

This is a greenfield feature: **no production code exists yet.** The repository contains only
pitch/spec artifacts and scaffolding:

- `idea.md`, `EXPECTED.md` — raw idea and the acceptance contract (frozen, read-only for this run).
- `shapeup/envlint/project-profile.md` — declares `archetype: web-service` (nearest structural fit
  for a CLI in the profile schema) and `entry_point: bin/envlint.mjs`.
- `package.json` — declares `"bin": { "envlint": "./bin/envlint.mjs" }`, `"type": "module"`,
  `"scripts": { "test": "node --test" }`. No dependencies declared (zero-dep constraint implied).
- `shapeup/envlint/spec/` — the frozen substrate path named in the order does not yet contain a
  spec tree; only `shapeup/envlint/project-profile.md` exists one level up. No `spec/` directory,
  no use-case docs, no scope contracts exist yet. This confirms orient runs *before* BA/scoping,
  per the harness's `ba-pitch-analyzer` (needs orient's recon first) sequencing.
- No `bin/`, `src/`, `lib/`, or `test/` directories exist. `node --test` currently has nothing to
  run.

## Composition root (per project-profile.md)

`bin/envlint.mjs` does not exist yet, but its role is already specified: argv dispatcher +
composition root. It parses `--schema <path>`, an optional `--json` flag, and one positional
`<envfile>`, then routes to two independent pure engines and prints/exits.

## The three pieces named by the pitch (none built yet)

1. **Parsing engine** — `.env` text → `{pairs, problems}`. Pure, no imports from Rules.
2. **Rules engine** — parsed pairs + JSON schema → findings. Pure, no imports from Parsing.
3. **CLI** — the only piece that imports both; owns argv, file I/O, printing, exit codes.

Because Parsing and Rules are specified to share no file and no import, they are the two
independently-buildable scopes the pitch calls out; the CLI is the integration point and
necessarily depends on both, so it cannot be built (or fully tested end-to-end) before both
exist.

## External surface touched

- `node:fs` (readFileSync) — for env file and schema file.
- `node:url` (`new URL()`) — for the `url` type check only, per EXPECTED.md's explicit rule.
- No network, no third-party deps (matches the pitch's "No network access, ever" no-go).

## Risk-relevant observations

- `new URL()` trims leading/trailing ASCII whitespace per the WHATWG URL spec and accepts
  scheme-relative-looking strings like `http:/x.com` (single slash) as valid `http:` URLs. This
  is a real correctness subtlety for the `url` type check — see spike.
- Quote-stripping (`KEY="value"` vs `KEY="value` with no closing quote) is a plain first/last
  character match, not full shell-style tokenizing — verified via spike, no library needed.
- `int`/`bool` type checks are simple anchored regexes with documented edge behavior (`01` valid,
  `1.5`/`1e3`/empty invalid for int; case-insensitive `true|false|1|0` for bool).
