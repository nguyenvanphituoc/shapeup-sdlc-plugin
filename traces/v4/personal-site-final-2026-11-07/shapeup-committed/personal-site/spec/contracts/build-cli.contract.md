---
type: contract
feature: personal-site
usecases: [UC-BuildSite]
tags: [cli, contract]
depends_on: ["[[domain-model]]"]
status: ready
---

# Contract — `node build.mjs`

## Request

| Channel | Name | Type | Required | Default |
|---|---|---|---|---|
| env | `CONTENT_FILE` | path | no | `content.json` |
| env | `OUT_DIR` | path | no | `dist` |
| file | content JSON | `SiteContent` (see [[domain-model#Aggregate: SiteContent (new)]]) | yes | — |
| field | `name` | string | **yes** | — |
| field | `tagline` | string | per pitch | — |
| field | `about` | string | per pitch | — |
| field | `projects` | `{title, summary, url?}[]` | per pitch | — |
| field | `contact.email` | string | per pitch | — |

## Response (success)

- exit code `0`
- `<OUT_DIR>/index.html` written: a single static HTML document, inline CSS, no script required.
- Two runs over the same input produce byte-identical files.

## Errors

| Code | Condition | Exit | stderr | Side effect |
|---|---|---|---|---|
| `CONTENT_MISSING` | content file does not exist | 1 | exactly one line naming the problem | no `index.html` written |
| `CONTENT_INVALID_JSON` | content file is not parsable JSON | 1 | exactly one line naming the problem | no `index.html` written |
| `NAME_MISSING` | required field `name` absent | 1 | exactly one line naming the problem | no `index.html` written |
