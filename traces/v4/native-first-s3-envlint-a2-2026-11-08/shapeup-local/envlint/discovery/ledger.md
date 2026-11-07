---
feature: envlint
---
# Discovery Ledger — envlint

## Discovered — envlint/hunt (2026-11-07)
~ [lens:①boundary] [QA-001] [UC-ParseEnvText] A file with CR-only (classic Mac) line endings is read as one line; every later assignment is swallowed into the first value
    repro: 1. printf 'A=1\rB=2\r' > cr.env
2. echo '{"A":{"type":"int"},"B":{"required":true}}' > s.json
3. node bin/envlint.mjs --schema s.json cr.env
=> exit 1, 'cr.env:1: A: expected int, got "1\rB=2"'; B is never parsed as its own pair, so a required B would be reported missing
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-EvaluateRules] type url accepts 'http:///x' (empty authority in the text), and bare 'a://b' / 'mailto://x'; WHATWG normalisation supplies a host the text never had
    repro: 1. echo '{"U":{"type":"url"}}' > su.json
2. printf 'U=http:///x\n' > u.env
3. node bin/envlint.mjs --schema su.json u.env
=> exit 0 (also exit 0 for U=a://b, U=mailto://x, U=http://[::1]). 'http://' alone is correctly rejected.
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-LintEnvFile] --help (and -h) is treated as an unknown option: exit 2 with node's parseArgs wording about placing '-- "--help"', not a help text
    repro: 1. node bin/envlint.mjs --help
=> exit 2, stderr "envlint: Unknown option '--help'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- \"--help\"'" followed by the usage line
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-004] [UC-ParseEnvText] Inline comment after an unquoted value is kept as part of the value, so 'PORT=8080 # http' fails an int check
    repro: 1. printf 'PORT=8080 # http\n' > c.env
2. echo '{"PORT":{"type":"int"}}' > s.json
3. node bin/envlint.mjs --schema s.json c.env
=> exit 1, 'c.env:1: PORT: expected int, got "8080 # http"'. Contract is silent on inline comments; common dotenv files use them.
    severity-hint: ux-degradation
    test-gap: exploratory-only
~ [lens:①boundary] [QA-005] [UC-EvaluateRules] Empty enum array yields the malformed message 'expected one of , got "1"'
    repro: 1. echo '{"A":{"enum":[]}}' > s.json
2. printf 'A=1\n' > ok.env
3. node bin/envlint.mjs --schema s.json ok.env
=> exit 1, 'ok.env:1: A: expected one of , got "1"'
    severity-hint: cosmetic
    test-gap: unit
~ [lens:①boundary] [QA-006] [UC-LintEnvFile] Raw control bytes from the env value (ANSI escapes, CR, NUL) are echoed unescaped into finding lines on stdout, so output can contain escape codes the contract says it never emits
    repro: 1. printf 'A=\033[31mred\n' > ansi.env
2. echo '{"A":{"type":"int"}}' > s.json
3. node bin/envlint.mjs --schema s.json ansi.env | cat -v
=> 'ansi.env:1: A: expected int, got "^[[31mred"' (the ESC byte is passed through)
    severity-hint: cosmetic
    test-gap: unit
