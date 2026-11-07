---
type: contract
feature: one-page-site
tags: [contract]
status: draft
---

# Contract: content file and CLI

## Request (content file)

```typescript
interface ContentFile {
  name: string;            // required, non-empty
  tagline?: string;
  about?: string;          // plain text, one paragraph
  projects?: { title: string; summary?: string; url?: string }[];
  contact?: { email: string };
}
```

## Response
Success: exit 0, `<OutDir>/index.html` written, UTF-8, `\n` line endings.

## Error
Exit 1, exactly one stderr line, nothing written. Codes: `CONTENT_MISSING`, `CONTENT_INVALID_JSON`, `CONTENT_BAD_SHAPE`, `NAME_MISSING` (see [[ux-behavior]]).

## Pending
⏳ TBD — verify in the first test: behaviour for empty-string `name` (treated as missing) and non-http url schemes (rendered as plain text).
