---
feature: envlint
---
# Discovery Ledger — envlint

## Discovered — envlint/hunt (2026-11-07)
~ [lens:①boundary] [QA-001] [UC-ParseEnvText] Inline trailing comments are kept in the value (A=1 # c fails int; B="a" # c reports unterminated quote)
    repro: 1. printf 'A=1 # c\n' > e.env; echo '{"A":{"type":"int"}}' > s.json
2. node bin/envlint.mjs --schema s.json e.env
3. exit 1: e.env:1: A: A must be int, got "1 # c"; with B="a" # c the line is reported 'unterminated quote'
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-ParseEnvText] CR-only line endings are not split; whole file becomes one value
    repro: 1. printf 'A=1\rB=abc\r' > e.env
2. node bin/envlint.mjs --schema s.json e.env (s.json: A int)
3. exit 1: A must be int, got "1\rB=abc" (B never parsed)
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-CheckEnvAgainstSchema] Unknown or prototype-named schema type is silently accepted (type float / toString / constructor never flag)
    repro: 1. echo '{"A":{"type":"float"},"B":{"type":"toString"}}' > s.json; printf 'A=zzz\nB=zzz\n' > e.env
2. node bin/envlint.mjs --schema s.json e.env
3. exit 0, no output; a typo in the schema disables the check with no warning. 'toString' resolves via TYPE_CHECKS prototype lookup (src/rules.mjs:~34)
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:④cross-UC] [QA-004] [UC-LintEnvFile] Control/ANSI bytes in an env value are echoed raw to stdout, so output can carry ANSI escapes
    repro: 1. printf 'A=abc\033[31mred\n' > e.env; s.json: A int
2. node bin/envlint.mjs --schema s.json e.env | od -c | head
3. stdout contains ESC [ 31 m from the input value
    severity-hint: boundary-breach
    test-gap: integration
    contradicts: UC-LintEnvFile TS-NOGO-02
~ [lens:④cross-UC] [QA-005] [UC-LintEnvFile] Duplicate keys: an earlier shadowed line is flagged even when the last value is valid
    repro: 1. printf 'A=abc\nA=1\n' > e.env; s.json: A int
2. node bin/envlint.mjs --schema s.json e.env
3. exit 1 flags line 1 although the effective (last) value is 1; reverse order (A=1 then A=abc) flags line 2. Contract silent on duplicates
    severity-hint: ux-degradation
    test-gap: integration
~ [lens:⑤no-go] [QA-006] [UC-LintEnvFile] Repeated --schema silently last-wins; bare '--' is treated as the env filename
    repro: 1. node bin/envlint.mjs --schema s3.json --schema s10.json e1.env -> exit 0, first schema ignored without notice
2. node bin/envlint.mjs --schema s10.json -- e1.env -> exit 2 usage (-- is taken as envfile, then e1.env is an extra arg)
    severity-hint: cosmetic
    test-gap: unit
