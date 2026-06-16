---
type: ux-spec
feature: FEATURE_SLUG
entities: []
usecases: []
screens: []
tags: [ux]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behavior: FEATURE TITLE

## Screen Flow

```
[ScreenA]
    │
    ├─ [condition] ──► [ScreenB]
    │
    └─ [condition] ──► [ScreenC]
                           │
                   ┌───────┴───────┐
                   │               │
               success           failed
                   │               │
           [SuccessScreen]   [ErrorScreen]
```

---

## Screen: [ScreenName]

### States

| State | Trigger | UI Behavior | CTA |
|-------|---------|-------------|-----|
| `idle` | screen mount | form editable | enabled |
| `submitting` | user taps CTA | full loader | loading |
| `error` | API failure | error banner | enabled |
| `success` | API success | [redirect / toast] | — |

### Behavior Rules

- [RULE-01] ...
- [RULE-02] ...

### Error Catalog

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `NETWORK_TIMEOUT` | No response in 30s | "Can't connect, please retry" | [Retry] |
| `[CODE]` | [condition] | "[message in English]" | [action] |

---

<!-- Repeat "Screen: [Name]" section for each screen -->

---

## Platform Differences

| Behavior | Mobile | Web |
|---|---|---|
| [behavior] | [mobile treatment] | [web treatment] |
