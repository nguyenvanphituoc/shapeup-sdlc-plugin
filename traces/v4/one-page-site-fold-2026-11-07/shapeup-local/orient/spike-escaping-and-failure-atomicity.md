# Spike — escaping, validation, and no-write-on-failure

Riskiest area: edge behaviours. Findings from reading the pitch and JSON/Node semantics (no production code written):
- Escape `& < > " '` for text and the href attribute; escape `&` first. `<b>Rock & Roll</b>` must appear as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`.
- `JSON.parse` can succeed on `null`, arrays, or primitives: validate that the root is a plain object and `name` is a non-empty string, else exit 1.
- Failure must write nothing: validate and render fully in memory before mkdir/writeFile; tests must use a fresh `$OUT_DIR` so a stale file is not mistaken for a write.
- Error is one stderr line, exit code 1; catch errors, no stack traces.
- Byte-identical: no timestamps, stable ordering, fixed newline; write a single string.
- `url` missing/empty/whitespace -> plain text title. A `javascript:` url is unspecified (open question for L1b).
- `projects` absent vs `[]`: treat both as zero projects. `contact.email` absent: unspecified.

Verdict: low technical risk, achievable with plain Node.
