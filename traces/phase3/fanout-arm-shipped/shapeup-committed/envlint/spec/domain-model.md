---
type: domain-model
feature: envlint
bounded_context: env-linting
entities: []
value_objects: [EnvPair, ParseProblem, SchemaRule, Finding, LintReport]
domain_events: []
repositories: []
tags: [ddd, cli, functional-core]
depends_on: ["[[_index]]"]
status: ready
---

# Domain Model: envlint

## Bounded Context
`env-linting` context — owns the rules for turning a `.env` file's raw text plus a JSON schema
into a deterministic, machine- and human-readable report of what's wrong with it.

This context does NOT own: `.env` file writing, `${VAR}` interpolation, dotenv-compatible
loading into `process.env`, or any network access (all explicit pitch no-gos). It has no
persistence layer — there is nothing to save between runs.

**Why no aggregate root.** This is a stateless functional-core / imperative-shell CLI, not a
persisted-entity domain. There is no `EnvLint` aggregate that survives across invocations, no
identity, no state transitions to guard. The "domain logic" is two pure functions (Parsing,
Rules) composed by an imperative shell (the CLI) that does I/O. The value objects below are the
data shapes those functions pass between each other; there are no entities, no domain events, and
no repository interfaces because there is nothing to load or save — `node:fs` reads happen
directly in the CLI shell, which is I/O plumbing, not a repository abstraction over a store this
domain owns.

---

## The Two Pure Engines (functional core)

```
parseEnv(text: string) -> { pairs: EnvPair[], problems: ParseProblem[] }
                              │                    │
                              ▼                    │
evaluate(pairs, problems, schema: SchemaMap) -> Finding[]  ◄──────┘
```

- **Parsing** (`parseEnv`) — text in, `{pairs, problems}` out. Never imports Rules.
- **Rules** (`evaluate`) — `{pairs, problems}` + schema in, `Finding[]` out. Never imports Parsing.
- Both are pure: same input always produces the same output, no I/O, no thrown exceptions for
  malformed *content* (a malformed line is a `ParseProblem`/`Finding`, not a thrown error — only
  the imperative shell throws, for E1/E2/missing-flag tool errors).

---

## Value Objects

| Value Object | Fields | Invariants |
|---|---|---|
| `EnvPair` | `key: string`, `value: string`, `line: number` (1-based) | Produced only for lines that parse as `[export] KEY=VALUE` (with optional quoting). When the same `key` appears more than once, **all** occurrences are retained in parse order — "later wins" is a Rules-time invariant (INV-02), not a Parsing-time dedup, so Parsing never silently drops a pair. |
| `ParseProblem` | `line: number` (1-based), `text: string` (raw line, unmodified) | Produced for any non-blank, non-comment line that is not a valid `[export] KEY=VALUE` assignment. Comments (`#...`) and blank lines never produce a pair or a problem. |
| `SchemaRule` | `key: string`, `required?: boolean`, `type?: "string"\|"int"\|"bool"\|"url"`, `enum?: string[]` | `required` defaults to `false` when absent. `type` and `enum` are mutually informative, not mutually exclusive in the schema shape, but the pitch/EXPECTED.md only exercises one constraint kind per key — Rules validates whichever of `type`/`enum` is present. A schema key with neither `required`, `type`, nor `enum` is legal and vacuously satisfied by any value (including absence, since `required` defaults false). |
| `Finding` | `line: number` (0 when there is no source line — e.g. a required key missing entirely), `key: string`, `message: string` | One `Finding` per violated rule. A `ParseProblem` becomes exactly one `Finding` (E4 shape) when Rules composes its output; it is not double-reported. |
| `LintReport` | `ok: boolean`, `findings: Finding[]`, `checked: number` | `checked` = the count of schema keys evaluated (i.e. `Object.keys(schema).length`), independent of how many keys the env file actually defines. `ok` is `true` iff `findings.length === 0`. This is exactly the `--json` output shape from EXPECTED.md E5. |

---

## Domain Events

None. This is a synchronous, single-process CLI with no cross-context coordination and no
persistence — there is nothing for another context to react to.

---

## Repository Interfaces

None. `bin/envlint.mjs` (the imperative shell) reads the two input files directly via
`node:fs.readFileSync` — this is I/O plumbing owned by the CLI layer, not a domain repository
over a store this bounded context owns or that another bounded context needs abstracted access
to. Introducing a `Repository` interface here would model a persistence boundary that does not
exist (matches project-profile.md: "no server and no listener").

**Standard-lens contracts note.** Phase 2b (typed Request/Response/Error per repository) is
skipped for this feature: there are no repository interfaces, no internal service calls, and no
third-party API (explicit no-go: "No network access, ever"). The typed shapes that would live in
a contract instead live directly in each use case's `Input`/`Output`/`Error Cases` — see
[[usecases/UC-01]].

---

## Related
- [[ux-behavior]] — CLI output modes map to `LintReport` / exit-code states
- [[usecases/_index]] — the single use case that composes Parsing → Rules → output
