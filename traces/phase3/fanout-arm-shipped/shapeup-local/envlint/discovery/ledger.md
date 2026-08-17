---
feature: envlint
---
# Discovery Ledger — envlint

## Discovered — envlint/orient (2026-08-17)
+ [ORIENT] A naive url-type check that omits the http/https protocol gate (try{new URL(v)}catch{} alone) silently passes ftp:// and mailto:// values -- Test Surface needs a non-http(s)-scheme case, not just a malformed-string case.
+ [ORIENT] EXPECTED.md never states the combined form `export KEY="value"` -- worth an explicit fixture so parse order (strip export, trim, strip quotes) is unambiguous.
+ [ORIENT] Duplicate-key override interacting with a Rules check (e.g. a later PORT= assignment that itself fails validation) is unspecified by EXPECTED.md -- confirm Rules evaluates the winning value, not the first.
+ [ORIENT] An empty schema object {} against a non-empty env file is not in EXPECTED.md's E1-E5 list -- should exit 0 with 'ok: N keys checked'; worth an explicit fixture.
~ [ORIENT] --json findings array ordering (file order vs schema-key order) is not pinned by EXPECTED.md -- confirm with PO/BA before an implementation picks one.

## Discovered — envlint/hunt (2026-08-17)
~ [lens:①boundary] [QA-001] [UC-01] An unrecognized schema `type` value (e.g. "weirdtype") is silently treated as always-valid -- no error, no warning; repro: schema `{"X":{"type":"weirdtype"}}`, env `X=anything` -> exit 0, `ok: 1 keys checked` instead of flagging the unknown type.
    repro: 1. Write s-weird.json: {"X":{"type":"weirdtype"}}
2. Write e2.env: X=anything
3. Run: node bin/envlint.mjs --schema s-weird.json e2.env
4. Observe: exit 0, `ok: 1 keys checked` -- no indication the type was unrecognized
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-01] When a schema rule has both `type:"string"` and `enum`, `isValueValid`'s type-then-enum branch order returns on the `type==="string"` check before ever consulting `enum`, so the enum constraint is silently dropped; repro: schema `{"L":{"type":"string","enum":["debug","info"]}}`, env `L=warn` -> exit 0 (should be a finding, `warn` is not in the enum).
    repro: 1. Write s-typeenum.json: {"L":{"type":"string","enum":["debug","info"]}}
2. Write e5.env: L=warn
3. Run: node bin/envlint.mjs --schema s-typeenum.json e5.env
4. Observe: exit 0, `ok: 1 keys checked` -- enum constraint never applied (src/rules.mjs isValueValid: `type==='string'` returns true before the `rule.enum` check is reached)
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-01] A schema file that parses as valid JSON but isn't a `{key: Rule}` object (a bare array or a bare number) passes the E2 "valid JSON" gate and is handed straight to `Object.keys()`, producing nonsensical, non-error output; repro: schema file `["not","an","object"]` against any env file -> exit 0, `ok: 3 keys checked` (array indices treated as schema keys, no validation ever applied).
    repro: 1. Write s-array.json: ["not","an","object"]
2. Write e-port.env: PORT=8080
3. Run: node bin/envlint.mjs --schema s-array.json e-port.env
4. Observe: exit 0, `ok: 3 keys checked` -- schema shape is never validated beyond "is it JSON"; a bare number (e.g. schema file content `42`) similarly passes silently with `ok: 0 keys checked`
    severity-hint: ux-degradation
    test-gap: integration
~ [lens:①boundary] [QA-004] [UC-01] An unrecognized CLI flag (e.g. a typo like `--bogus` or `--Json`) is not rejected -- it falls into the positional-args bucket and, since it appears before the real env-file path, becomes `positionals[0]`, shadowing the intended env file; the tool then reports `Error: cannot read env file: --bogus` instead of any hint that the flag itself was the problem. An extra trailing positional argument (`envlint --schema s.json e.env extra-arg`) is likewise silently dropped with no warning.
    repro: 1. Write s-port.json: {"PORT":{"required":true,"type":"int"}}
2. Write e-port.env: PORT=8080
3. Run: node bin/envlint.mjs --schema s-port.json --bogus e-port.env
4. Observe: `Error: cannot read env file: --bogus`, exit 2 -- the real e-port.env is never read; the misleading error names the flag, not the actual mistake.
5. Separately: node bin/envlint.mjs --schema s-port.json e-port.env extra-arg -> exit 0, `extra-arg` silently ignored, no warning
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-005] [UC-01] `--schema` given twice on the command line silently keeps the last value with no warning that the first was discarded; repro: `envlint --schema s1.json --schema s2.json e.env` lints against s2.json only.
    repro: 1. Write s-port.json: {"PORT":{"required":true,"type":"int"}}
2. Write s-empty.json: {}
3. Write e-port.env: PORT=8080
4. Run: node bin/envlint.mjs --schema s-port.json --schema s-empty.json e-port.env
5. Observe: `ok: 0 keys checked` -- silently used s-empty.json, no warning that s-port.json was overridden
    severity-hint: cosmetic
    test-gap: unit
