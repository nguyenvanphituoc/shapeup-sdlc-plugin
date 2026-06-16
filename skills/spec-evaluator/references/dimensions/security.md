---
id: security
title: "Security"
enabled: false          # ⛔ STUB — not run until flipped true or named in --dimensions
weight: 1.0
hard_threshold: no-critical
applies_to:
  variant: [be, shared]   # backend + shared contracts; not graded on .web/.mobile tasks
  package: any
requires_browser: false
---

# Security (stub)

Not run in v0.1. Shipped as a worked example of the dimension contract so turning it on
later is a one-line registry change, no core edits.

> The user explicitly scoped v0.1 to spec + AC correctness only. This file exists to prove
> the injection path, not to be enabled now. Flip `enabled: true` (or pass
> `--dimensions spec-conformance,security`) when security becomes in scope.

## Criteria  (TODO — fill before enabling)

```yaml
- id: SEC-AUTHZ
  statement: "Every endpoint touched by the task enforces the authorization rule from the spec."
  probe: cmd
  evidence_required: true
  pass_rule: "TODO: unauthenticated/forbidden requests are rejected with the documented code."
  source: contract

- id: SEC-INPUT
  statement: "Inputs are validated against the contract; malformed input is rejected, not crashed on."
  probe: cmd
  evidence_required: true
  pass_rule: "TODO: fuzz the documented fields; no 500 / unhandled exception leaks."
  source: contract

- id: SEC-SECRETS
  statement: "No secrets/keys committed in the task's changed files."
  probe: static
  evidence_required: true
  pass_rule: "TODO: scan the diff for secret patterns; zero hits."
  source: code
```

## Threshold
`no-critical` — minor/major findings are reported but do not fail the build; any
`critical` finding fails the dimension. (Contrast with spec-conformance's `all-pass`:
correctness is binary, security is risk-tiered.)

## Bug template
```
severity: [critical|major|minor]
criterion: [SEC-AUTHZ | SEC-INPUT | SEC-SECRETS]
location: <file:line | endpoint>
repro: <request / scan that surfaced it>
expected: <secure behavior per spec>
actual: <observed weakness>
```
