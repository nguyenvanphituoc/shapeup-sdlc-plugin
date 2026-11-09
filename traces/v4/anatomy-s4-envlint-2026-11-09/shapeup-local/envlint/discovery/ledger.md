# Discovered ledger — envlint

## Orient (source: .shapeup/envlint/orient/discovered-seed.md, spike-parsing-rules-contract.md)

- [+] Parsing→Rules contract: `pairs` is an array of `{key, value, line}` (1-based) so findings can cite lines (spike finding 2)
- [+] Unterminated quote and `=`-less line are parse problems with a line number (spike finding 5)
- [+] Decide `#` inside quotes / trailing inline comments (spike finding 5)
- [+] Decide duplicate-key behaviour (spike finding 3)
- [+] Literal grammars for `int` / `bool` / `url` (shape only, no network) (spike findings 6, 7)
- [+] Empty value vs `required` semantics (spike finding 4)
- [+] Unknown `type` / malformed schema entry yields a defined error, never a throw (spike finding 8)
- [+] Env keys absent from the schema: ignored or flagged (unspecified)
- [+] Exit-code table (proposed 0 clean, 1 findings, 2 usage/IO/config error)
- [+] Zero-assignment file is reported explicitly; `required` still runs
- [+] Missing positional env file is a usage error, never a fallback to `./.env`
- [+] Stable, colorless output line format; whether parse problems alone fail the run
