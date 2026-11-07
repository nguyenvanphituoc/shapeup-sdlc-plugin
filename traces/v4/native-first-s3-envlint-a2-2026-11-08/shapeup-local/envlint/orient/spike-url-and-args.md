# Spike — `url` type validation and argument handling

Area: the `url` rule (the one type whose "shape" is ambiguous) plus CLI arg parsing (the pitch's hard constraint that env file and schema are explicit args).
Question: can `new URL()` alone decide "is a url" without network, and does `node:util` parseArgs give usable errors for bad usage?
Time-box: 15 min, throwaway probe on Node v24.15.0 (nothing written to src).
Status: RESOLVED (with a rule constraint).

## Findings (probe output)
- `new URL("http://a.b")` ok; `"https://x.com/p?q=1"` ok; `"not a url"` throws; `"http://"` throws; `"a b://x"` throws.
- **`new URL("foo:bar")` succeeds (protocol `foo:`) and `new URL("localhost:3000")` succeeds (protocol `localhost:`).** URL-constructor success is therefore NOT a valid url check. The rule must also require an explicit `scheme://` and a non-empty host. Whether non-http schemes (postgres://, redis://) count is a spec decision; env files commonly hold them. Recommended: any `scheme://host` with non-empty host.
- `util.parseArgs({options:{schema:{type:"string"}}, allowPositionals:true})` yields `values.schema` and `positionals[]`. Unknown flag throws `ERR_PARSE_ARGS_UNKNOWN_OPTION`; `--schema` with no value throws `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`. Both must be caught and mapped to a usage error, not a stack trace. A missing `--schema` or missing positional is not an error to parseArgs and needs an explicit check.

## Residual unknowns
Exit-code scheme and output format are spec decisions, not spikeable. Fallback: ba fixes them in the spec (suggest 0 clean / 1 findings / 2 usage-or-IO error).
