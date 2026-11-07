# Discovered seed — envlint

## Scope: parsing
Imagined:
- Parse KEY=value, comments, blank lines, `export KEY=value`
- Single/double-quoted values; unterminated quote reported as a problem
- Report 1-based line number for each unparseable line; empty input yields no pairs and no problems
- Fixture tests for parse alone

## Scope: rules
Imagined:
- `required` key missing produces a finding
- `type` string/int/bool/url checks (url is shape only via URL, no network)
- `enum` membership
- Findings carry key and line; fixture tests for rules alone

## Scope: cli
Imagined:
- Parse argv `--schema <file> <envfile>`; no implicit `.env` lookup; usage error on bad args
- Read both files; missing env file or unreadable/invalid-JSON schema gives a clear message and non-zero exit, no crash
- Print findings uncolored and deterministic; exit 0 when clean, non-zero on findings
- End-to-end tests driving the binary against temp fixtures
Discovered:
- `test/` is empty (repo root `test/`), so tests must create their own temp fixtures; `package.json:1` `node --test` is the runner.
- Entry point fixed at `bin/envlint.mjs` by `shapeup/envlint/project-profile.md:4`; `bin/` does not exist yet and must be created.
