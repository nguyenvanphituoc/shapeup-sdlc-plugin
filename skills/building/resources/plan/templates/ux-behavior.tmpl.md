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

## Screen: [ScreenName] ([P#] — omit without a breadboard)

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

<!-- Repeat "Screen: [Name]" section for each screen — one per breadboard Place with UI affordances -->

---

## Platform Differences

| Behavior | Mobile | Web |
|---|---|---|
| [behavior] | [mobile treatment] | [web treatment] |

---

## Deferred Places

<!-- Breadboard Places with UI affordances this shape will not build. Each needs the PO's yes at GATE L1b. Omit the section when there are none. -->

| Place | Reason |
|---|---|
| [P#] [Place name] | [why this shape does not build it] |
