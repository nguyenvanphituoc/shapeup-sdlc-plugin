# ShapeUp SDLC Harness — Design Document

A Claude Code plugin that turns a raw product idea into shipped, mechanically verified code —
by re-implementing Shape Up's roles, gates, and artifacts as scripts and schemas an agent
cannot talk past, rather than conventions it is asked to remember.

| | |
|---|---|
| **Plugin** | `shapeup-sdlc-plugin` |
| **Version** | see `package.json` — Pure-Skill Architecture, driven by the `building` loop |
| **Runtime** | Claude Code |
| **Author** | Liberty Nguyen |

## Contents

1. [Objective & Product Value](01-objective-and-product-value.md) — why this exists, what problem it removes
2. [High-Level Design](02-high-level-design.md) — the three-phase Shape Up loop
3. [System Design](03-system-design.md) — envelope port, hooks, storage roots, distribution
4. [Functional Design](04-functional-design.md) — the 6 skills, the build round, the circuit breaker, the gates
5. [Verification & Quality Strategy](05-verification-and-quality-strategy.md) — how the harness proves itself
6. [Appendix — File Layout & Invariants](06-appendix.md)
7. [Domain ERD](07-domain-erd.md) — the entity-relationship map generated from `kernel/schemas/domain.schema.json`

## Decision records

Architectural decisions that change a contract are recorded in [`adr/`](adr/):

- [ADR-0001 — Consumer-side file organization](adr/0001-consumer-file-organization.md) — what a
  teammate gets on `git pull` vs what stays on the machine that ran the harness; the `shapeup/` +
  `.shapeup/` roots, contracts as markdown, and GATE L2 becoming advisory
- [ADR-0002 — Plugin repository organization](adr/0002-plugin-repo-organization.md) — the plugin's
  own tree, arranged by lifecycle (ships / installs / builds / proves / explains); the corrected
  publish boundary, the frozen `scripts/` URL contract, and the retired `anti-lying-kit`

- [ADR-0003 — Build-leg isolation](adr/0003-build-leg-isolation.md) — concurrent legs share one working
  tree and are fenced per write
- [ADR-0004 — One loop in the session, in place of one workflow launch](adr/0004-single-loop.md) — the run
  is driven by the `building` skill over the kernel's `probe next` (the engine since removed, see ADR-0006); supersedes the "one workflow launch"
  decision in [03 §3.5](03-system-design.md)
- [ADR-0005 — Native first](adr/0005-native-first.md) — workers are plugin agents, and what the second cut
  removed, kept and refused; supersedes decision 3 of ADR-0004
- [ADR-0006 — The decision engine removed](adr/0006-engine-removed.md) — the compiler, single writer, state machine, spec lint, build gate and report generators go; the runtime keeps five mechanisms. The PO's decision against a measured result

> Compiled from a full-repository walkthrough of this plugin. A rendered, styled
> version of this document is also published as a Claude Artifact for viewing outside the repo.
