---
type: usecase
feature: one-page-site
id: UC-RejectInvalidContent
bounded_context: SiteBuild
actor: Freelancer
entities: [SiteContent]
repositories: [ContentSource]
domain_events_emitted: []
tags: [cli, validation]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: RejectInvalidContent

## Summary
The Freelancer runs `node build.mjs` on missing or invalid content and gets exit 1, one stderr line, and no page.

## Preconditions
- The content file is missing, unparsable, not a JSON object, or lacks a non-empty string `name`.

## Input

```typescript
interface RejectInvalidContentInput {
  env: { CONTENT_FILE?: string; OUT_DIR?: string };
  raw: string | null; // file text, or null when unreadable
}
```

## Steps

```
1. Try to read the content file; unreadable → E_CONTENT_MISSING
2. JSON.parse; throws, or root is not a plain object → E_CONTENT_INVALID
3. name absent, not a string, or blank → E_NAME_MISSING
4. Print exactly one line "build: <problem>" to stderr (no stack trace)
5. Exit 1 without creating the output dir or writing index.html
```

## Output

```typescript
interface RejectInvalidContentOutput { exitCode: 1; stderrLines: 1; written: false }
```

## System Flow

```
[CLI: node build.mjs]
  → [Use Case: Freelancer.buildSite()]
    → [ContentSource.load() → throws one-line error]
      → [stderr + exit 1; PageSink never called]
```

## Invariants

- [INV-01] A failed build writes no `index.html` and does not create the output directory.
- [INV-02] A failed build prints exactly one line on stderr and nothing that looks like a stack trace.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `E_CONTENT_MISSING` | content file does not exist or is unreadable | n/a (exit 1) | one stderr line naming the path |
| `E_CONTENT_INVALID` | not valid JSON, or root not a plain object | n/a (exit 1) | one stderr line naming the path |
| `E_NAME_MISSING` | `name` missing, non-string or blank | n/a (exit 1) | one stderr line naming `name` |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run each failing case into a fresh, non-existent `OUT_DIR` | `OUT_DIR/index.html` does not exist | D1: INV-01 |
| TS-INV-02 | process | Capture stderr of each failing case | Exactly one non-empty line; no `at ` stack frames | D1: INV-02 |
| TS-ERR-E_CONTENT_MISSING | process | `CONTENT_FILE` points to a non-existent file | exit 1, line names the path | D2 |
| TS-ERR-E_CONTENT_INVALID | process | Content file is `{not json` and, separately, `null` | exit 1, one line | D2 |
| TS-ERR-E_NAME_MISSING | process | Content `{"tagline":"x"}` and `{"name":""}` | exit 1, line mentions `name` | D2 |
| TS-REQ-name-missing | process | Omit `name` | exit 1, nothing written | D3 |

## Integration Points
- ← [[ux-behavior#Screen: BuildOutcome]] — the error state
