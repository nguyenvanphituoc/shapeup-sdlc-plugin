# ShapeUp SDLC Harness — Design Document

A Claude Code plugin that turns a raw product idea into shipped, mechanically verified code —
by re-implementing Shape Up's roles, gates, and artifacts as scripts and schemas an agent
cannot talk past, rather than conventions it is asked to remember.

| | |
|---|---|
| **Plugin** | `shapeup-sdlc-plugin` |
| **Version** | 1.0.0 — Pure-Skill Architecture |
| **Runtime** | Claude Code (+ Cursor, Antigravity, Codex via compiled `dist/`) |
| **Author** | Liberty Nguyen |

## Contents

1. [Objective & Product Value](01-objective-and-product-value.md) — why this exists, what problem it removes
2. [High-Level Design](02-high-level-design.md) — the three-phase Shape Up loop
3. [System Design](03-system-design.md) — envelope port, hooks, storage roots, distribution
4. [Functional Design](04-functional-design.md) — the 13 skills, the build round, the circuit breaker, the gates
5. [Verification & Quality Strategy](05-verification-and-quality-strategy.md) — how the harness proves itself
6. [Appendix — File Layout & Invariants](06-appendix.md)
7. [Domain ERD](07-domain-erd.md) — the entity-relationship map generated from `skills/tech-lead/schemas/domain.schema.json`

## Decision records

Architectural decisions that change a contract are recorded in [`adr/`](adr/):

- [ADR-0001 — Consumer-side file organization](adr/0001-consumer-file-organization.md) — what a
  teammate gets on `git pull` vs what stays on the machine that ran the harness; the `shapeup/` +
  `.shapeup/` roots, contracts as markdown, and GATE L2 becoming advisory
- [ADR-0002 — Plugin repository organization](adr/0002-plugin-repo-organization.md) — the plugin's
  own tree, arranged by lifecycle (ships / installs / builds / proves / explains); the corrected
  publish boundary, the frozen `scripts/` URL contract, and the retired `anti-lying-kit`

> Compiled from a full-repository walkthrough of this plugin at v1.0.0. A rendered, styled
> version of this document is also published as a Claude Artifact for viewing outside the repo.
