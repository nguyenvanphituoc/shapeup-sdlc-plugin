---
type: contract
feature: one-page-site
repository: ContentSource
tags: [contract]
depends_on: ["[[domain-model]]"]
status: draft
---

# Contract: content file (`content.json`)

## Request (the file)

```typescript
interface ContentFile {
  name: string;            // required, non-empty
  tagline?: string;
  about?: string;          // one paragraph, plain text (no Markdown)
  projects?: Array<{ title: string; summary?: string; url?: string }>;
  contact?: { email?: string };
}
```

## Response (the build)

```typescript
type BuildResult =
  | { exitCode: 0; file: "<OutDir>/index.html" }
  | { exitCode: 1; stderr: string /* exactly one line */; file: null /* nothing written */ };
```

## Errors

| Code | Condition | stderr line |
|---|---|---|
| `E_CONTENT_MISSING` | content file does not exist / cannot be read | `build: cannot read <path>` |
| `E_CONTENT_INVALID` | not parsable JSON, or root is not a plain object | `build: <path> is not valid JSON` / `... must be a JSON object` |
| `E_NAME_MISSING` | `name` absent, not a string, or blank | `build: content is missing required field "name"` |
