# Discovery ledger — envlint

## Orient (from results/orient.json, orient/discovered-seed.md)

- D-O1 Each parsed pair must carry its 1-based source line (contract C1) so findings print line by line.
- D-O2 `int` must be a strict decimal-integer pattern: `Number()` accepts `1.0`, `0x10`, ` 7`, `1e3`, `""`.
- D-O3 `url` must not be `URL.canParse` alone: it accepts `localhost:3000`, `javascript:`, `mailto:`, `file:`; require http(s) scheme + host; no network.
- D-O4 CLI must validate its own arguments: missing `--schema` / no positional throws `ERR_INVALID_ARG_TYPE` with a stack trace today.
- D-O5 Read errors (ENOENT, EISDIR, EACCES) and schema SyntaxError → one-line message + exit code distinct from "findings".
- D-O6 `package.json` is named `site` with no `bin` field; exactly one scope should own it.
- D-O7 `node --test` exits green with 0 tests: the build gate proves nothing until each scope lands its own `test/*.test.mjs`.
- D-O8 Data contracts C1–C3 (pairs, schema format, findings/exit codes) belong in the spec, not in a shared `src/` module.

## Round 2 (task-executor)
- [+] D-R2-1 (cli-r2-a1) src/rules.mjs:66/69 still embeds raw values in C3 finding messages; the CLI now escapes at render, but any other consumer of checkPairs would get raw control bytes (rules scope owns it).
