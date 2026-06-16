---
type: repository-contract
source_type: third-party-api
feature: "[feature-slug]"
repository: "[RepoName]"
service: "[ServiceName]"
feasibility_ref: "API-[NN]"
spike_task: "[[TASK-NNN-spike-[api]]]"
status: speculative      # → confirmed after SPIKE done
skill_version: "2.3"
---

# Repository Contract — [RepoName]

## Source Type: `third-party-api`
## Service: [ServiceName] ([REST API / SDK])
## Feasibility: ⏳ UNVERIFIED → see [[api-feasibility#API-NN]] + [[TASK-NNN-spike-[api]]]

---

> ⚠️ **SPECULATIVE CONTRACT**
> Fields marked `⏳ TBD` are derived from pitch assumptions and community references.
> All `⏳ TBD` entries MUST be confirmed and replaced during [[TASK-NNN-spike-[api]]].
> Implementation tasks depending on this repository are **blocked** until no `⏳ TBD` remains.

---

## Method: [methodName]

### Request

| Field | Type | Required | Source | Notes |
|-------|------|----------|--------|-------|
| [field1] | string | ✓ | UC-[Name].input.[field] | ⏳ TBD — field name unverified |
| [field2] | string | ✓ | env.[ENV_VAR_NAME] | ⏳ TBD — confirm param name |
| [field3] | string? | — | session.[claim] | ⏳ TBD — may not be required |

### Response (Success)

| Field | Type | Invariant | Used By | Notes |
|-------|------|-----------|---------|-------|
| [field1] | string | ⏳ TBD | [method2].request.[field] | ⏳ TBD — confirm field name |
| [field2] | enum | ⏳ TBD | UX: [badge/state name] | ⏳ TBD — confirm possible values |

### Error Cases

| Code | HTTP/SDK Error | Retryable | UX Action | Notes |
|------|---------------|-----------|-----------|-------|
| UNAUTHORIZED | 401 / AuthError | false | Show: "API key invalid" | ⏳ TBD — confirm error shape |
| QUOTA_EXCEEDED | 429 / RateLimitError | true | Queue + retry | ⏳ TBD — confirm retry-after header |
| INVALID_INPUT | 400 / ValidationError | false | Show field error | ⏳ TBD — confirm error body |
| UNKNOWN | 5xx / NetworkError | true | Generic error + retry | |

---

## Method: [methodName2]

*(repeat block per method)*

---

## Post-SPIKE Update Log

| Field | Old Value | Confirmed Value | Source URL | Updated By | Date |
|-------|-----------|----------------|------------|------------|------|
| | | | | | |
