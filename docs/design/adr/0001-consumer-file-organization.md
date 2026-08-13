# ADR-0001 — Consumer-side file organization

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-02 |
| **Supersedes** | the two-root layout introduced in v0.3.0 (`docs/shapeup-sdlc/` + `.shapeup-sdlc/`) |
| **Affects** | every skill, hook and script that names a generated path; existing installs (migration `0006`) |

## Context

The harness generates ~90 distinct artifacts inside a user's repository across six lifecycles,
but the design documents describe only three tiers (A shared / B local / C per-member). The
conflated lifecycles are where the defects live:

- **The publish/visibility boundary was inferred, not stated.** `evals/README.md` says the eval
  layer is "repo-only, not shipped"; `package.json` `files: ["skills/"]` ships it anyway.
  `agents/` is declared and does not exist. `dist/antigravity/` is declared, gitignored, and has
  zero tracked files — so the npm tarball's contents depended on whether the publisher happened
  to have run `distribute.js` locally.
- **Structured run state and authored deliverables shared one tier.** `round-ledger.md` and
  `hill/*.yml` are committed and mutate mid-build, so a run leaves `docs/` dirty while it is
  still working. `metrics/<machine-id>.jsonl` is committed, keyed on `process.env.HOSTNAME`, and
  only grows.
- **The same filename meant two different trust levels.** `gate-answers.json` resolves from three
  paths; two are gitignored (a personal lane) and one is committed and auto-discovered with no
  flag (team policy). A committed set with `preset: ci` pre-approves GATE L4 ship sign-off for
  everyone who pulls.
- **Two roots were hard-coded in ~90 files, in two syntaxes.** 568 string literals plus 48 sites
  that build the path from `join()` segments — invisible to any find/replace.

The governing question was never answered explicitly: **what does a teammate get on `git pull`,
and what stays on the machine that ran the harness?**

## Decision

**Prose is the team's; structured data is the machine's.**

Markdown is shared. JSON, JSONL and parsed run state are local. The harness itself runs only on
the machine that invoked it — a teammate reads the design, they do not resume someone else's run.

### The two roots

| Root | Git | Holds |
|---|---|---|
| `shapeup/` | committed | the authored deliverable — business requirement, use cases, high-level and low-level design, and the frozen ship report |
| `.shapeup/` | gitignored | run state, envelopes, verification artifacts, evidence, machine policy |

Renamed from `docs/shapeup-sdlc/` and `.shapeup-sdlc/`. `docs/` is a namespace many projects
already publish through a static-site generator; the spec tree either gets published by accident
or breaks the build.

### `shapeup/` — the shared tier

```
shapeup/
├── <slug>/
│   ├── shaping/
│   │   ├── pitch.md            the bet the Betting Table approved
│   │   ├── shaping.md          problem · appetite · boundaries
│   │   ├── breadboard.md       the design sketch
│   │   ├── baseline.md         what customers live with today
│   │   └── glossary.md         domain terms
│   ├── spec/                   THE CONTRACT — the evaluator's grading truth
│   │   ├── _index.md
│   │   ├── domain-model.md
│   │   ├── usecases/UC-*.md
│   │   ├── contracts/*.md
│   │   ├── ux-behavior.md
│   │   ├── scope-summary.md
│   │   └── cross-context/*.md  (cross-context lens only)
│   ├── scopes/SC-*.md          was scopes/*.json
│   ├── wiring-map.md           was wiring-map.json
│   ├── project-profile.md      was project-profile.json
│   ├── requirements.md         REQ registry
│   └── REPORT.md               frozen at GATE L4 — see below
├── knowledge-base/
│   ├── task-executor.md · ba-pitch-analyzer.md · qa-edge-hunter.md
│   └── harness-defects.md
```

### `.shapeup/` — the local tier

```
.shapeup/
├── <slug>/
│   ├── receipt.json  intake.md  harness-run.md  run-snapshot.json
│   ├── tasks/TASK-*.md  _index.md          the board
│   ├── working/                            spec working notes
│   │   synthesis.md  assess-report.md  feedback.md
│   │   api-feasibility.md  integration.md  digest.md  run-summary.md
│   ├── round-ledger.md                     was shared; mid-run churn
│   ├── orders/*.json  results/*.json
│   ├── t0/verdicts/*.json  t0/trials.jsonl  seesaw/registry.json
│   ├── evaluation/  qa/  trace/  orient/  spikes/
│   └── discovery/ledger.md  escalates/*.json
├── active-scope  decisions.jsonl
├── gate-answers.json  safety-overrides.json
├── metrics/*.jsonl                         was shared
└── pitch-archive/
```

### Two exceptions to the markdown rule, named (a third was withdrawn)

A rule with unnamed exceptions is a rule nobody can apply. These three are the complete set:

1. **Contracts become markdown rather than moving tier.** `scopes/*.json`, `wiring-map.json` and
   `project-profile.json` are structured, but they are also *low-level design a reviewer should
   read*. They are converted, not hidden — see "Contract format" below.
2. **`knowledge-base/*.md` stays shared although it is policy.** Coaching rules describe how an
   agent should work *in this codebase*, which is a team property even when every run is
   individual. `gate-answers.json` and `safety-overrides.json` do not follow it: consent and
   safety envelope stay per-machine, so no committed file can widen another person's.
3. ~~**`.harness-version` / `.harness-migrations` stay committed although they are machine state.**~~
   **Withdrawn.** These were the Flyway-style record of which migrations *this repository* had had
   applied. The upgrade path's data-migration step has since been removed, and it was the only
   writer of either file, so the exception has no subject left. Two exceptions remain, not three;
   an existing project may still carry the files, and nothing reads them.

### Contract format — markdown in, JSON on the wire

`ProjectProfile` is four scalars. `ScopeContract` and `WiringMap` are scalars and string arrays
plus exactly one array-of-objects each (`affordance_manifest`, `entries`). Full YAML would cost a
dependency, and every script in this repo holds a zero-dependency rule.

So: **frontmatter for scalars and `[a, b]` lists, markdown tables for the arrays of objects.**
Both parsers already exist in the codebase — `trace-lint.parseRequirements` and
`compile-order.ledgerDecisions` both read markdown tables today.

```markdown
---
scope_id: SC-02
allowed_file_substrate: [src/cart/**]
e2e_verification_fixtures: [npm run e2e:cart]
db_probe: npm run db:check
---
## Why this slice
Cart creation is the riskiest flow — it touches pricing and inventory in one transaction.

## Affordances
| affordance  | selector      | proves |
|-------------|---------------|--------|
| Add to cart | [data-t=add]  | UC-01  |
| Cart badge  | [data-t=cnt]  | UC-02  |
```

**Markdown is the on-disk format; JSON remains the wire format.** `compile-order` parses the
markdown and embeds the resulting object in `payload.scope_contract`, so the envelope, its schema
and `validate-envelope` are unchanged. This boundary is stated in `domain.schema.json` because it
is the thing a future contributor will otherwise get wrong.

Consequence: a contract is now hand-editable, where it used to be machine-written and
schema-validated. `spec-lint` re-validates every parsed contract against `domain.schema.json`, so
a hand-edit that breaks the shape fails loudly instead of silently widening a sandbox.

### The ship report

`shapeup/<slug>/REPORT.md` is written once at GATE L4 and never mutated: verdict and refuted
criteria, QA findings by lens, T0 summary per scope, adjudicated decisions lifted from the local
round ledger, the GATE H cut list, rounds used.

This is how run evidence reaches a reviewer without any of the churn. The board, the EVAL report
and the QA report stay local *while they mutate*; their conclusions are frozen into one file when
the run ends.

### GATE L2 becomes advisory

`hooks/gate-l2.mjs` keeps reading the board from both independent sources and keeps naming the
unfinished tasks. It stops denying the dispatch; it emits a `systemMessage` instead.

`hooks/lib/decision.mjs` gains a `warn` verdict. Without it an advisory permit would be
byte-identical in `decisions.jsonl` to "board was green, permitted" — the exact
indistinguishability that file exists to eliminate. With it, `stats --hooks` can still answer
*how often did we evaluate a non-green board?*

## Consequences

### Accepted costs

- **Nothing mechanically prevents EVAL on a half-green board.** This reopens a defect measured in
  the island-escape run (EVAL proceeded with 16/20 task files still `status: ready`). The signal
  survives as a warning; the enforcement does not.
- **`README.md`'s headline claim changes.** "The agent cannot evaluate its own half-finished work"
  is no longer true. `validate-envelope` becomes the flagship example of an enforced gate — a
  malformed order structurally cannot reach a worker. `gate-zerowork` still blocks at `Stop`, and
  `sandbox-guard`, `safety-spine` and `gate-deadline` still deny.
- **`stats.mjs` becomes a personal tool.** With metrics local, "is the KB flywheel working across
  the team?" is no longer answerable from the repository.
- **Contracts are hand-editable.** Mitigated by the `spec-lint` re-validation above, not removed.

### Gains

- The publish boundary becomes a single directory and a test rather than a hand-maintained array.
- No hostname and no unbounded JSONL in git.
- `gate-answers.json` means exactly one thing, at exactly one trust level.
- A reviewer gets the design *and* the evidence, in markdown, with no run churn.
- Renaming a root, or making it configurable later, becomes a two-line change (see `paths.mjs`).

## Implementation

`skills/tech-lead/scripts/lib/paths.mjs` becomes the single source of truth for both roots and
every generated artifact path. This is the same remedy applied twice before in this repo —
`lib/is-main.mjs` replaced a fragile guard duplicated across 18 files, `lib/argv.mjs` replaced
hand-rolled flag parsing — and it is what turns a 90-file rename from *hope the grep was
complete* into *the test fails if it was not*.

`tests/structural/45-paths.mjs` asserts that no file constructs a harness path except through
`paths.mjs`, mirroring test #11a's guard against reintroducing the fragile main guard.

| Phase | Work | Shipped |
|---|---|---|
| 0 | GATE L2 advisory · `warn` verdict in `decision.mjs` · 8 prose sites | ✅ |
| 1 | `lib/paths.mjs` · test #45 (caught 7 sites a grep missed) | ✅ |
| 2 | Flip the two root constants · migration `0006` | ✅ |
| 3 | Contracts to markdown · `lib/contract-md.mjs` · test #46 · migration `0007` | ✅ |
| 4 | `spec/` working-note split · round-ledger and metrics to local · committed `gate-answers.json` removed · migration `0008` | ✅ |
| 5 | `skills/tech-lead/scripts/ship-report.mjs` at GATE L4 · test #47 | ✅ |
| 6 | Prose sweep — 325 root references + 66 contract-extension references across 89 files | ✅ |

Three migrations, applied in order: `0006` renames the roots, `0007` converts the contracts,
`0008` corrects the three mis-tiered artifacts. Each is independently skippable — the readers
accept both forms — so a project that stops halfway keeps working.

The suite grew from 789 to 823 checks. Two defects were found by the new tests rather than in
review: `renderTable` escaped `|` with no matching unescape (silently truncating any value
containing a pipe), and `readAllContracts` counted a `.md`/`.json` pair as two scopes.

## Alternatives rejected

**Nest the plugin under `plugin/`.** Would make the publish boundary a single folder, but rewrites
every path in the test suite and in `${CLAUDE_PLUGIN_ROOT}` references for a legibility gain that
subordinating the non-product directories achieves for free.

**Carve the three contract files out as "contract JSON".** Simpler, but leaves the shared tier
holding files a reviewer cannot read, which is the thing this ADR exists to fix.

**A minimal vendored YAML parser.** Cleanest authoring experience; breaks the zero-dependency rule
every script in this repo holds.

**Keep everything local.** Consistent, and it ends the knowledge-base flywheel and leaves a
reviewer with nothing but the diff.
