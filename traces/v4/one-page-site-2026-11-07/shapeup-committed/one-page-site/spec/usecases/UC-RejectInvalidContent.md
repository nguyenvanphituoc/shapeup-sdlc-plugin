---
type: usecase
feature: one-page-site
id: UC-RejectInvalidContent
bounded_context: SiteBuild
actor: Freelancer
entities: [SiteContent]
repositories: [ContentSource]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: RejectInvalidContent

## Summary
When the content file is missing, unparsable or lacks `name`, the build fails with exit 1 and one stderr line, and writes nothing.

## Preconditions
- `node build.mjs` has been started.

## Input

```typescript
interface RejectInvalidContentInput {
  env: { CONTENT_FILE?: string; OUT_DIR?: string };
  contentFile: "absent" | "unparsable" | "wrong-shape" | "no-name";
}
```

## Steps

```
1. Read the content file; on read failure fail with CONTENT_MISSING
2. JSON.parse it; on failure fail with CONTENT_INVALID_JSON
3. Check it is a non-null, non-array object and projects (if present) is an array; else CONTENT_BAD_SHAPE
4. Check name is a non-empty string; else NAME_MISSING
5. On any failure print one stderr line (fixed prefix + message) and exit 1 before creating the output dir or file
```

## Output

```typescript
interface RejectInvalidContentOutput {
  exitCode: 1;
  stderr: string; // exactly one line
  outputFile: null; // nothing written
}
```

## System Flow

```
[CLI: node build.mjs]
  → [Use Case: Freelancer.rejectInvalidContent()]
    → [ContentSource.load() throws BuildFailure]
      → [stderr one line, exit 1]  (PageSink.write never called)
```

## Invariants

- [INV-01] On any failure, no `index.html` is created in the output dir.
- [INV-02] The stderr output is exactly one line, never a stack trace or raw error message.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `CONTENT_MISSING` | content file absent or unreadable | n/a | exit 1, one stderr line |
| `CONTENT_INVALID_JSON` | content file not parsable | n/a | exit 1, one stderr line |
| `CONTENT_BAD_SHAPE` | JSON is null, an array, a scalar, or `projects` is not an array | n/a | exit 1, one stderr line |
| `NAME_MISSING` | `name` absent, empty or not a string | n/a | exit 1, one stderr line |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run each failing case with a fresh `OUT_DIR` | Output file does not exist | D1: INV-01 |
| TS-INV-02 | process | Run each failing case and capture stderr | Exactly one line, no stack trace | D1: INV-02 |
| TS-ERR-CONTENT_MISSING | process | Point `CONTENT_FILE` at a nonexistent path | exit 1, one stderr line naming the problem | D2 |
| TS-ERR-CONTENT_INVALID_JSON | process | Content file containing `{not json` | exit 1, one stderr line | D2 |
| TS-ERR-CONTENT_BAD_SHAPE | process | Content file `null`, `[]`, or `{"name":"x","projects":"y"}` | exit 1, one stderr line | D2 |
| TS-ERR-NAME_MISSING | process | Valid JSON with `name` omitted or `""` | exit 1, one stderr line naming `name` | D2 + D3 (dedup) |

## Integration Points
- ← [[ux-behavior#Screen: BuildOutcome]] — the failure state
