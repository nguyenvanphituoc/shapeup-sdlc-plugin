---
feature: envlint
---
# Discovery Ledger — envlint

## Discovered — envlint/hunt (2026-11-07)
~ [lens:①boundary] [QA-001] [UC-ParseEnvText] Inline comment `A=5 # c` is parsed as value "5 # c" (int rule then fails)
    repro: 1. printf 'A=5 # c\n' > e; echo '{"A":{"type":"int"}}' > s.json
2. node bin/envlint.mjs --schema s.json e
3. observe: e:1: A: expected int, got "5 # c"
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-ParseEnvText] `A="x"y` reports "unterminated quote" though the quote is terminated
    repro: 1. printf 'A="x"y\n' > e
2. node bin/envlint.mjs --schema s.json e
3. observe: e:1: unterminated quote
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:⑤no-go] [QA-003] [UC-LintEnvFile] `--` and `-` are not accepted; env file named with leading dash or stdin cannot be linted
    repro: 1. node bin/envlint.mjs --schema s.json -- e1
2. observe usage line on stderr, exit 2
3. echo A=1 | node bin/envlint.mjs --schema s.json -  -> same usage line
    severity-hint: cosmetic
    test-gap: unit
