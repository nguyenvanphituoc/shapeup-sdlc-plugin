# Hill signal — envlint (raw facts, per area)

| Area | Open unknowns | Proven / known | Signal |
|------|---------------|----------------|--------|
| Cross-scope contract (`pairs` shape, finding shape, schema format) | (1) `pairs` shape — map vs ordered `{key,value,line}` list; (2) duplicate keys; (3) schema file format — JSON Schema vs bespoke map; (4) finding item shape | Parse and Rules must not import each other (`intake.md:31-32`); line numbers are required in output (`intake.md:12`) | 4 unknowns, all spec decisions; **highest integration risk** — if Parse and Rules guess differently both go green and the CLI breaks |
| Parsing (`src/parse.mjs`) | inline `#` after unquoted value; double-quote escapes; unterminated quote; whitespace around `=`; key charset; CRLF | file name fixed by profile; pure, fixture-testable; no dependency | 6 grammar unknowns, low integration risk |
| Rules (`src/rules.mjs`) | `bool` spellings; `int` details (`+`, leading zeros); url option choice; empty value vs `required`; unknown `type` handling | **spike resolved**: builtins false-accept for `int` and `url`; workable predicates identified (anchored regex; `canParse` + non-empty host / `://`) | approach proven by spike; residual unknowns are example-table decisions |
| CLI (`bin/envlint.mjs` + `package.json`) | exit-code scheme (findings vs usage vs IO); output format + stdout/stderr; "no assignments" semantics; meaning of "unreadable schema"; `package.json` ownership/rename | argument shape fixed (`intake.md:16`); `node --test` discovery skips dot-dirs and runs every `.mjs` under `test/` (probed) | 5 unknowns, spec decisions; depends on cross-scope contract |
| Invariants (no write / no interpolation / no network / no color) | none | stated in `intake.md:40-41` | no unknowns |
