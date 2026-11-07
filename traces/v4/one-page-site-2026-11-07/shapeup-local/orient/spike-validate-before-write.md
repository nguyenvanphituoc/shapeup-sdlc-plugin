# Spike — failure contract and escaping (validate-before-write)

**Area:** the load/validate/escape path in `build.mjs` (greenfield, so no prior art; this is where all six pitch edge behaviours concentrate).
**Question:** can the pitch's failure contract (exit 1, exactly one stderr line, no `dist/index.html` written) and the escaping and determinism rules be met with `node:fs` and `JSON.parse` alone?
**Time-box:** 30 min, code reading only (execution of probes was not permitted in this session, so claims below are from Node's documented behavior, not a run).
**Status:** RESOLVED (reading only; confirm in the first test).

## Findings

1. `JSON.parse` throws `SyntaxError` on unparsable input and `fs.readFileSync` throws `ENOENT` on a missing file. Both are caught in one try/catch and reduced to a single `console.error(<one line>)` + `process.exit(1)`. Error messages from Node can contain newlines in some cases, so the line must be built from a fixed prefix plus `err.code` or a constant, not the raw message.
2. `JSON.parse` succeeds on valid but wrong-shaped input (`null`, `[]`, `"x"`, `{}`). Validation must check: object (not null/array), `name` a non-empty string. `projects` absent -> treat as `[]`; present but not an array -> exit 1. Pitch only mandates `name`; other fields' absence behaviour is unspecified (see seed).
3. "No file written" is satisfied by ordering alone: parse, validate and render the full string first; only then `mkdirSync(outDir,{recursive:true})` and `writeFileSync`. Rendering must not throw after the write begins. A stale `dist/index.html` from an earlier good run is not removed by this ordering; the pitch says "writes no dist/index.html", which a test should check against a fresh `OUT_DIR`.
4. Escaping needs `& < > " '` mapped, `&` first. It must be applied to text nodes and to attribute values (`href`, `mailto:`). A `url` such as `javascript:...` is not an escaping problem but is a link-safety gap; the pitch says no JavaScript in the page, so a scheme allowlist (http, https) is a decision to surface.
5. Determinism: iterate `projects` in array order, use no `Date`, no `Math.random`, no `Object.keys` ordering on user data, and a fixed `\n` line ending. `writeFileSync` with an explicit `'utf8'` string gives byte-identical output.
6. `$CONTENT_FILE` / `$OUT_DIR` are plain `process.env` reads with the defaults `content.json` and `dist`. Resolve relative to `process.cwd()`, which tests control through `spawnSync` `cwd`/`env`.

## Residual unknowns

- Behaviour for empty-string `name` (treated as missing here), missing `tagline`/`about`/`contact`, and non-http `url` schemes.
- Whether a failed build should clean up a stale previous `dist/index.html`.

**Fallback:** if any is contested, the board encodes the stricter reading (name non-empty string; others optional and omitted from the page when absent) and the evaluator grades against that.
