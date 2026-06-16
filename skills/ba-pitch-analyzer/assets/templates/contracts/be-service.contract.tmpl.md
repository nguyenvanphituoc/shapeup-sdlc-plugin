---
type: repository-contract
source_type: be-service
feature: "[feature-slug]"
repository: "[RepoName]"
service: "[internal service name]"
status: confirmed        # be-service contracts are verifiable from codebase
skill_version: "2.3"
---

# Repository Contract — [RepoName]

## Source Type: `be-service`
## Endpoint Base: `[apps/api or service URL base]`
## Auth: `[Bearer JWT (session) / API Key / Service-to-service mTLS]`

---

## Method: [methodName]

### HTTP Request

```
[POST/GET/PUT/PATCH/DELETE] [/api/v1/path/:param]
Content-Type: application/json
Authorization: Bearer [session JWT]
```

### Request Body

| Field | Type | Validation | Source | Notes |
|-------|------|-----------|--------|-------|
| [field1] | string | required, max 255 | UC-[Name].input.[field] | |
| [field2] | uuid | required | UC-[Name].input.[field] | FK to [Entity] |
| [field3] | number | min 0 | UC-[Name].input.[field] | VND — integer only, no float |

### Response `201 Created` / `200 OK`

| Field | Type | Invariant | Used By |
|-------|------|-----------|---------|
| id | uuid | non-null, server-generated | subsequent requests |
| [field1] | string | | UX: [state/display] |
| createdAt | ISO8601 | UTC | UX: timestamp display |

### Error Responses

| HTTP Status | Code | Meaning | UX Action |
|-------------|------|---------|-----------|
| 400 | VALIDATION_ERROR | Field-level validation failed | Show per-field inline errors |
| 401 | UNAUTHORIZED | Session expired or missing | Redirect to login |
| 403 | FORBIDDEN | Caller lacks [ROLE] permission | Show permission error |
| 404 | NOT_FOUND | Resource [Entity] not found | Show 404 state |
| 409 | CONFLICT | [Describe conflict condition] | Show conflict message |
| 413 | PAYLOAD_TOO_LARGE | Request body exceeds [N]kb | Show size error |
| 422 | BUSINESS_RULE_VIOLATION | [Describe invariant] | Show business error |
| 5xx | INTERNAL_ERROR | Server error | Generic error + retry |

---

## Method: [methodName2]

*(repeat block per method)*
