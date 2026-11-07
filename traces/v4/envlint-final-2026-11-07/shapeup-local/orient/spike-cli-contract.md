# Spike — parser/rules/CLI contract (riskiest area)

Area: the seams where the CLI composes the two pure modules, and the contracts between them that the pitch leaves unspecified.
Question: can Parsing and Rules be built in parallel and verified alone when the pairs shape, finding shape, schema shape and exit codes are not fixed?
Time-box: 20 min, read-only. No code written. Two shell probes (`node --test` with no tests, `new URL` leniency) were not approved by the sandbox, so those points are unverified.

Status: SPIKE-UNRESOLVED on details, resolvable at planning by pinning contracts.

Findings
- Parser and rules share only the `pairs` data shape. Rules must report line by line, so pairs must carry the line number; an object map would lose it. Recommend an array of `{key, value, line}`, fixed in the spec before parallel build.
- The finding shape (`{key, line, rule, message}`) and the schema shape are the real cross-scope contract; if not fixed up front the CLI scope integrates late.
- Exit codes to pin: 0 clean, 1 findings, 2 usage/IO error (missing file, unreadable or invalid-JSON schema). An empty or no-assignment file must not crash.
- Parser needs explicit rules for duplicate keys, `export` prefix, inline `#` after quoted values, and unterminated quotes.
- `url` type: shape-only check. `new URL()` accepts arbitrary schemes (e.g. `foo:bar`), so require an explicit scheme check; not probed here.
- `node --test` with no test files: behaviour not probed; ensure tests exist before the build gate.

Fallback: ba pins the three contracts (pairs, findings, schema) in the shared section of the spec before scopes are mapped.
