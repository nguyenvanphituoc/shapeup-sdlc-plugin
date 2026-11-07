---
feature: envlint
---
# Discovery Ledger — envlint

## Discovered — envlint/parse-env-r1-a1 (2026-11-07)
+ TS-NOGO-01 (import grep) cannot run inside test/parse.test.mjs: reading the source needs node:fs, which the REQ-25 AC forbids in that file; it was verified by grep outside the suite

## Discovered — envlint/cli-r1-a1 (2026-11-07)
+ bin/envlint.mjs is not marked executable (chmod +x needed approval and was not run); `node bin/envlint.mjs` works, and an npm bin link sets the mode on install
