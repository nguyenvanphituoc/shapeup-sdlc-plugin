# Spike — the Parsing / Rules data contract and parser edge semantics

**Area:** the seam between Parsing and Rules, plus the parser's quoting rules. Chosen because, in a greenfield repo with two deliberately independent pure modules, the only integration risk is the shape each side assumes about the other, and no code exists to settle it.

**Question:** can Parsing and Rules be built concurrently and share nothing but a data shape, and is that shape determinable from the pitch alone?

**Time-box:** 30 min, desk investigation of the pitch against Node built-ins. No runtime probe was executed; claims about `URL` behaviour and `node --test` discovery come from documentation and are marked UNVERIFIED.

**Status: RESOLVED to recommendations; residual decisions handed to the planner/PO.**

## Findings
1. **Disjointness holds.** Parsing needs only a string; Rules needs only data. Neither needs the other's code. Only `bin/envlint.mjs` imports both.
2. **The shared contract is the real risk and the pitch leaves it open.** Findings are reported "line by line", but Rules is "data in, findings out" over "parsed pairs". If `pairs` is a plain `{KEY: value}` object Rules cannot cite a line. Recommendation: `pairs` is an array of `{key, value, line}` (1-based, same numbering as parse problems) so findings can carry `line`. The spec must state this as a literal shape, or two parallel scopes will diverge.
3. **Duplicate keys** are unspecified. An array of pairs defers the choice (e.g. last wins for lookup); a plain object loses it.
4. **Required vs empty:** `KEY=` yields an empty string. Recommend: present-but-empty satisfies `required` but fails `int`/`bool`/`url`/`enum`. PO to confirm.
5. **Parser quoting (no reference dialect; the Boundaries rule out dotenv compatibility, so the parser may define its own minimal rules):** open items are `#` inside quotes (data), trailing `# comment` after an unquoted value, unterminated quote (a problem with a line number), whitespace around `=`, `export` prefix stripping, and escapes inside double quotes. Recommend the spec picks a minimal set and reports the rest as problems rather than guessing.
6. **`url` type:** `new URL(s)` accepts many strings such as `mailto:x` (UNVERIFIED, WHATWG behaviour). The spec must say which schemes count; shape-only, no network.
7. **`int`/`bool` literal sets** are unspecified. Recommend `int` = `/^-?\d+$/`, `bool` = `true|false` with a stated case rule.
8. **Schema validity:** "unreadable schema" covers an unreadable file and invalid JSON; a schema that parses but has an unknown `type` or wrong shape is a third case the pitch does not name. Recommend a distinct config-error exit, never a crash.

## Fallback
If the planner does not fix the pair shape, Rules should accept `{key,value,line}` records and tolerate an absent `line`.
