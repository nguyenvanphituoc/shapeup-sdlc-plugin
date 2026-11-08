# Hill signal — envlint (raw facts, per area)

## Cross-cutting: data contracts C1–C3 — most open unknowns
- C1 `pairs` shape: array vs map; line number per pair; duplicate-key semantics. ⏳ TBD
- C2 schema file format: undefined by the pitch ("a small JSON schema"). ⏳ TBD
- C3 finding shape + output line format + ordering + stream + exit-code values. ⏳ TBD
- No code unknown here: all three are spec decisions, but all three scopes depend on them.

## Parsing
- Open: inline `#` after unquoted value; escapes in double quotes; multiline / unterminated quotes;
  CRLF and BOM (affect line numbers); `KEY=` empty value; `export FOO` without `=`; invalid key chars.
- Approach risk: low — pure function, well-known format, nothing unproven in the platform.

## Rules
- Open: schema format (C2); `bool` accepted literals unstated; `enum` case sensitivity and its
  interaction with `type`; whether env keys absent from the schema are flagged; `007` as `int`.
- Probe evidence (Node v24.15.0, throwaway script, deleted):

```
url "https://a.b"            canParse=true  protocol=https:
url "http://localhost:3000"  true  http:
url "localhost:3000"         true  localhost:     <- accepted as a URL
url "postgres://u:p@h/db"    true  postgres:
url "mailto:x@y"             true  mailto:
url "foo"                    false
url "javascript:alert(1)"    true  javascript:
url "http://"                false
url "file:///etc"            true  file:
url "https://exa mple.com"   false
int  value   /^-?\d+$/   Number.isInteger(Number(v))
     "42"     true        true
     "-1"     true        true
     "1.0"    false       true
     "0x10"   false       true
     " 7"     false       true
     "1e3"    false       true
     "007"    true        true
     ""       false       true
```
- Approach risk: low once acceptance sets are decided; the predicates are a few lines each.

## CLI
- Spike RESOLVED: fixture-driven `spawnSync` testing works with builtins only (6/6) —
  approach proven, toward the crest.
- Open: exit-code values (pitch says only "non-zero"); output format (C3); behaviour for an env file
  with no assignments; `package.json` has no `bin` field and is named `site` (`package.json:1`).
- Known trap: missing positional crashes with `ERR_INVALID_ARG_TYPE` unless validated explicitly.

## Build gate
- `node --test` is green with 0 tests today — a green round gate is no evidence until tests exist.
