# Plan — the scope contracts

**Slice by flow, never by directory — and write it as a contract a hook can enforce.** Groups a feature's
tasks into independent, vertically-sliced **scopes** and writes each as a committed contract,
`shapeup/<slug>/scopes/<scope-id>.md`, that the rest of the harness enforces mechanically: the sandbox
hook denies writes outside a substrate, the T0 verifier runs the fixtures, the evaluator asserts only
against the affordance manifest. This substep is the sole writer of scope contracts and of `scope-board.md`
(`scope-summary.md` belongs to the spec substep).

Inputs: the board's tasks with their touched files — the slicing INPUT only. Each carries `use_case_refs`;
those use-case ids are what you write into the contract, never a task id. Also: `ux-behavior.md` for the
affordance manifests, the use cases for flows, the breadboard when present (every U# the spec places is one
manifest entry's `source`; record which scopes deliver each V# slice in `scope-board.md`), and the guidance
files (slicing habits for this codebase, config files that must have exactly one owner, fixtures that have
proved vacuous — steering, never spec: a guideline cannot widen a substrate or stand in for the lint;
conflict → the spec and the lint win, told to the PO).

## Process

```
0 READ     the guidance, if any exists.
1 SLICE    build an import/business-flow graph over the tasks' touched files (a grep heuristic is fine; an
           AST is an optimisation). One scope = one call chain: the UI screen + the API route + the use
           case + the repository it drives. A scope aligned 1:1 with a top-level directory (all-frontend,
           all-backend) FAILS — that is layer-thinking.
2 CLASSIFY topology_type: LAYER_CAKE (thin balanced UI + backend) | ICEBERG (complexity on one side) |
           CHOWDER (true strays with no shared flow — the one deliberate exception).
3 CONTRACT per scope, write scopes/<scope-id>.md — MARKDOWN: frontmatter for scalars and [a, b] lists, a
           `## Affordances` table for the affordance manifest, a short `## Why this slice` paragraph. A
           reviewer must be able to read the substrate in a PR; regeneration preserves prose under
           headings you do not own.
4 READ BACK the contracts together, once, and say what you found: PA1 (a scope aligned 1:1 with a top-level
           directory), PA2 (> ~15 files, a warning), DISJOINT (a file in two scopes' substrate without both
           declaring it shared — the write fence enforces substrates, so an overlap here is a collision there),
           SCOPE-ANCHOR (empty or unresolvable use_cases), SCOPE-DEPS (depends_on naming a scope that is not
           here). Fix reds by re-slicing, not by silencing. A task id in a committed contract is refused by the
           write fence itself.
5 BOARD    regenerate scope-board.md — a VIEW of the contracts, nothing more:
             | scope_id | topology | use_cases | depends_on | files | lint |
           Every column restates a field the contract already declares, so the board can be thrown away and
           rebuilt. Do NOT add a `wave` column: waves are Kahn levels of `depends_on`, derived at dispatch;
           a hand-written copy of a derived value drifts, which is why `unlocks` stopped being authored.
           The BUILD ORDER lives in each contract's `depends_on`; the board only shows it.
```

## The contract's fields

| Field | Rule |
|---|---|
| `scope_id`, `topology_type` | the stable join key is the scope id |
| `use_cases[]` | the use-case ids this scope implements — **the ONLY link you write to the work: never task ids.** The contract is committed and the board is not, so a task id here dangles on every other clone (TIER-DIRECTION reds it). The scope's tasks are re-derived from the board's own `use_case_refs` |
| `covers[]` | optional REQ-ids from `requirements.md` this scope answers for. Write the registry's own key — `REQ-12`, not the pitch's `R12`: both resolve, but one spelling in the committed contract is one thing to read |
| `depends_on[]` | scope ids this scope builds AFTER — the build ORDER. Declare it whenever one scope consumes another's output, or the two race: nothing infers it, and an undeclared edge releases both into the same wave |
| `allowed_file_substrate[]` | exact globs; the sandbox hook's write whitelist. Wrong here = a legitimate escalation later |
| `shared_substrate[]` | files ≥ 2 scopes both touch. Declaring one costs concurrency: they build one at a time |
| `affordance_manifest` | from the `ux-behavior.md` state tables: every interactive element as `{test_id, role}` + `required_states` [idle, loading, success, error, empty] + `source`, the U# the ux row cites |
| `e2e_verification_fixtures[]` | the command(s) / spec file(s) that drive this scope end to end (the T0 layer). Too speculative to fixture → mark TBD and flag it, never invent a fixture for unbuilt behavior. **Every fixture MUST EXIT 0 when the scope is correct** — T0 scores any non-zero exit as a failure, so a bare error-path invocation can never pass; put expected non-zero exits inside a test file that itself exits 0, and name that file. Write them as a FRONTMATTER key holding bare commands |
| `hill_phase` | `"UPHILL_UNKNOWN"`, ALWAYS; phase is derived from T0/T1 facts later, never authored |

**`affordance_manifest` lives in the TABLE and NOWHERE ELSE.** Do not also write it in the frontmatter:
nothing reads it there, so the copy is discarded — and a run has been lost to exactly that (the frontmatter
said `required_states: [idle]`, the table cell said a bare `idle`, the table won, the value was a string
where an array was required, and four scopes were never dispatched with every check green). A contract
declaring no affordances writes `affordance_manifest: []` in frontmatter and no table.

**A list inside a table cell is written `[a, b]`, brackets and all** — `[idle]`, never `idle`. A bare word in
that cell is a string, and `required_states` is an array.

A `TASK-` id anywhere in a contract or the board — a column, a cell, a sentence of prose — is TIER-DIRECTION
red. The board is committed; task ids are not.

**Folding in a discovered item:** it joins the nearest scope only if the flow matches (extend that substrate
minimally); otherwise propose a NEW scope — never silently widen an existing one. **Re-slicing a stuck
scope:** re-run step 1 on just that scope's task and file set → N new contracts; mark the old one
`superseded_by: [ids]` — never delete (the branch and the T0 history stay attributable).

## Reasons not to cut a corner

| Excuse | Reality |
|---|---|
| "The discovered item obviously fits scope A" | Run the flow match. "Obviously" is how substrates silently widen. |
| "One scope per directory is cleaner" | That is PA1 — a layer, not a flow. A scope must ship something a user can do. |
| "I'll widen the substrate so the doer stops escalating" | A wide substrate is no substrate. Split, or add a `shared_substrate` entry, deliberately. |
| "This scope looks downhill, I'll set the phase" | `hill_phase` is `UPHILL_UNKNOWN` at write, always. Facts move dots, not authors. |
| "The old contract is superseded, delete it" | Supersede, never delete. History must stay attributable. |
| "Both scopes implement that use case, the tasks will sort themselves out" | They will not — both get every task of that use case and three of four writes get denied. Give each scope its own use cases, or tell the PO. |
| "I'll list the task ids so the contract says what it builds" | The board is gitignored and renumbers per machine; the contract is committed. Cite the use cases. |
| "Fixtures can come later" | A fixture at contract time or an explicit TBD flag — silence is how T0 goes blind. |

Verify before `close`: every scope crosses layers or is declared CHOWDER (PA1 = 0 red); every scope names ≥ 1
`use_cases` that resolves on disk and no contract carries a task id; every scope that consumes another's
output declares it in `depends_on`; substrates are disjoint except declared `shared_substrate`; every
interactive element in a scope's screens appears in exactly one manifest; every U# the spec places is some
manifest entry's `source`; every scope has fixtures or an explicit TBD flag; every `hill_phase` written is
`UPHILL_UNKNOWN`; superseded contracts are kept.
