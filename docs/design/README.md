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

The working record of the v4 change (what was asked, measured and decided) is in [`v4/`](v4/README.md); it is retired when v4 ships.
