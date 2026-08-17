# Code surface — envlint

## Current state: greenfield

No `lib/`, `bin/`, or `test/` directories exist yet. `package.json` declares
`bin: { envlint: "./bin/envlint.mjs" }` and `scripts.test: "node --test test/"`, but neither
`bin/envlint.mjs` nor any `test/` file is present on disk. This is a from-scratch build.

## Composition root (per project-profile.md)

- **entry_point**: `bin/envlint.mjs` — the argv dispatcher. Per the pitch, it must:
  - parse `--schema <schema.json>`, optional `--json`, and a positional `<envfile>`
  - read both files, handling missing/unreadable → exit 2
  - call into a parsing module and a rules module
  - print findings (human or `--json`) and set the exit code

## Import graph (to be created)

```
bin/envlint.mjs
  ├── lib/parse.* (or parse.mjs)   -- pure: text in, {pairs, problems} out
  └── lib/rules.* (or rules.mjs)   -- pure: {pairs, schema} in, findings out
```

Parsing and Rules share no file and do not import each other (pitch constraint, verified by
inspection once they exist — nothing to violate yet since neither exists).

## Existing repo scaffolding

- `package.json` — type: module, bin entry, test script already wired to `node --test test/`.
- `shapeup/envlint/project-profile.md` — committed, names `bin/envlint.mjs` as entry_point/composition root.
- `EXPECTED.md` — committed acceptance contract (interface, schema format, edge cases E1-E5, type
  rules, parsing rules, verification command). This is the spec surface the eventual board/tasks
  must trace to.
- No existing `.env`-parsing or CLI-arg-handling code anywhere in the repo to reuse or conflict with.

## Reachability

Since `bin/envlint.mjs` does not exist, there is currently zero reachability from the declared
entry_point — this is expected for a pre-build orient pass on a greenfield feature, not a defect.
