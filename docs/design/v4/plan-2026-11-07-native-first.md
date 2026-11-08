# Plan — native-first: minimal scripts, minimal tests, the host's harness for the rest

| | |
|---|---|
| **Date** | 2026-11-07 |
| **From** | [`analysis/03`](analysis/03-what-the-kernel-is-for.md), [`analysis/04`](analysis/04-native-harness.md); requirements V4-REQ-1, 6, 7, 10, 12–17 |
| **Baseline** | 4.0.0 at `63478f6`: 52 kernel/hook/bin modules, 18,736 lines; 115 test files, 21,872 lines; 5 hooks |
| **Gate on every stage** | A real run on the consumer project ships through `building` with the same gate rows as the 4.0.0 trace (`traces/v4/personal-site-final-2026-11-07/`), and `npm test`, `claude plugin validate . --strict` and `npm run verify:cross-dir` pass. The stage is not done on a green suite alone |
| **Rule** | One stage per commit series; nothing in a later stage starts until the previous stage's run shipped. Stage 3 is a measurement and may end in "keep" |

## Target shape

```
agents/      orient.md  task-executor.md  spec-evaluator.md  qa-edge-hunter.md
skills/      building/  shapeup/  (hill-chart only if the PO keeps the dashboard)
hooks/       hooks.json  fence.mjs  ledger.mjs
bin/         shapeup.mjs   (t0 · gate · fence · init)   init.mjs (installer: grant + permissions.deny)
tests/       ≈10 files, each executing a shipped script or validating a shipped manifest
```

## Stages

### S1 — remove what nothing reads (no behaviour the loop depends on changes)

| Do | Done when |
|---|---|
| Delete `probe digest`, `reduce graph`, `reduce hill`, `report export` + `report/facts`, `probe stats`, `probe leg`, `verify trace`, `probe requirements`, and their `ROUTES` entries; delete `gate-zerowork.mjs` and `tier-guard.mjs`, folding the tier-direction token check (`.shapeup/` path, `TASK-NNN`) into `sandbox-guard` | `node kernel/harness.mjs --help` lists no removed verb; `hooks.json` has 4 entries; the folded check denies a committed-tier write carrying a `TASK-001` token in a fixture |
| `hill-chart`: PO decides keep or drop. Keep ⇒ it reads `shapeup/<slug>/hill/*.yml` and `.shapeup/<slug>/legs.jsonl` directly, no reducer. Drop ⇒ delete the skill and the `/hill` command | the skill has no `harness` call, or does not exist |
| Delete every test file whose subject was removed; strip prose-parity assertions from the mixed files (`05-tech-lead` goes whole) | `npm test` green; `tests/structural/` under 60 files |
| AGENTS.md: remove the run-graph, export, matrix and hill-reducer paragraphs; the symbol legend loses nothing (no symbol was theirs) | `harness-maintenance-audit` clean |
| **Gate**: real run ships | gate rows identical to the baseline trace; `sandbox-guard` still writes its rows |

Expected: kernel −≈4,600 lines, hooks −≈480, tests −≈7,000.

### S2 — the host's mechanisms replace ours

| Do | Done when |
|---|---|
| `agents/*.md` for the four workers: `tools` (evaluator and QA: no `Edit`/`Write` except their own result path — enforced by the fence, since the agent tool list is coarse), `model` from the launch record, `skills: [<worker>]`, `maxTurns` from `attempt_budget`; build agents `isolation: worktree` | `claude plugin validate --strict` passes; a dispatch by agent name leaves a `SubagentStop` event with that `agent_type` |
| `ledger.mjs` (under `hooks/`) on `SubagentStart` + `SubagentStop`: one JSONL row per dispatch (`agent_type`, `agent_id`, order id from the prompt, start, stop, sha256 of `last_assistant_message`). Replaces `dispatch-receipt` and the leg row | the row exists after a real dispatch; `verify dispatch` is deleted |
| The worker writes `results/<order>.json` itself as its last act; the loop reads it. `verify envelope` becomes a 40-line check inside the loop's `ingest` step or goes | a result with a status outside the four is refused once with the reason, as today |
| `safety-spine` → `permissions.deny` block written by `bin/init.mjs` beside the two Bash rules: `Bash(rm -rf:*)`, `Bash(git push --force:*)`, `Bash(git reset --hard:*)`, `Bash(git clean -fd:*)`, `Read(./.env)`, `Read(//**/.env.*)`, `Read(**/*.pem)`; `tests/grant` executes the host against it | the host denies each in a nested `claude -p` session; the hook file is gone |
| `compile.mjs` → the loop writes the order from a template in `skills/building/resources/`; the derived fields (bugs from the verdict, T0 list, dimensions) are read by the loop from the files `compile` read | an order the loop wrote validates against `work-order.schema.json`, kept as documentation of the shape |
| `reduce ingest` → the loop edits the board file; `reduce board` deleted; the board is one Markdown table the loop owns | a round ships with a board the loop wrote |
| `lib/contract.mjs`: scope contracts become JSON on disk (one format) | no Markdown ⇄ JSON code remains |
| **Gate**: real run ships | same gate rows; a `ledger.mjs` row per dispatch; one fence deny provoked on purpose lands in the ledger |

Expected: kernel −≈6,000 lines (compile, ingest, board, contract, envelope, verify skills/dispatch, init fit/verify budget), hooks −≈530.

### S3 — the decision engine, measured (V4-REQ-13)

| Do | Done when |
|---|---|
| Write `bin/shapeup.mjs status --slug`: lists receipt, orders with/without results, gate rows, board rows, T0 verdicts — facts only, no `step` | ≤ 150 lines; output is the same facts `probe next` reads |
| Move the phase table from `probe next` into `building/SKILL.md` (it already exists in AGENTS.md's Phase 3 table); the loop decides the step from `status` | the skill names, for each phase, what must exist to leave it |
| **Measurement**: the `envlint` pitch, one model, one date, 2 reps each side (`probe next` vs `status` + skill), held to the kit's rule: at least as many scopes green, no gate skipped, no phase re-dispatched over its artifact, no attempt spent that the attestation denies | a comparison file under `traces/v4/` with both sides' gate rows and leg rows |
| Holds ⇒ delete `probe next`, `probe resume`, `probe eval`, `probe owner`, `probe attempts`, `probe hunt`, `verify build` (its probes run from the skill), their 42+ tests. Does not hold ⇒ keep the engine, record why, close V4-REQ-13 as rejected | the registry row carries the decision and the trace path |

Expected if it holds: kernel −≈4,000 lines; what remains is `t0` (714), `gate` (555), `fence` (≈300), `init` (≈300), `lib/paths` trimmed (≈200) — about 2,000 lines.

### S4 — the test suite, rewritten to the rule (V4-REQ-17)

| File | Executes |
|---|---|
| `manifests` | `plugin.json`, `marketplace.json`, `package.json` versions agree; `claude plugin validate --strict` |
| `agents-and-skills` | every `agents/*.md` and `SKILL.md` frontmatter parses; agent `skills:` names exist |
| `fence` | the hook against fixtures: outside-substrate deny, inside allow, no-live-order allow, tier token deny, unparseable input allow (fail-open) |
| `ledger` | the hook on a synthetic `SubagentStart`/`SubagentStop` pair writes one row |
| `t0` | green, red, better-but-red ratchet, sha256 cited; env fingerprint |
| `gate` | `ci`, `guarded`, `interactive` and `abort` presets; the source lands in `gates.jsonl` |
| `grant` | the host, nested, honours the two Bash rules and the deny block (today's `tests/grant`) |
| `cross-dir` | today's `verify:cross-dir` |
| `shipped-set-hygiene` | no `docs/`, `tests/`, `tools/`, `HD-` or trace path in the shipped files |
| `init` | the launch record and the model floor |

Target ≤ 2,500 lines. The runner keeps its temp-ledger isolation.

**Executed 2026-11-08 on the PO's instruction, on the branch that removes the engine.** S3's measurement did not hold the removal (see its record), and the PO chose it anyway; the S4 target above was then met as written. The amendment that once stood here, which said the 2,500-line figure did not apply to a plugin that keeps its engine, was written by the assistant rather than the PO and is withdrawn because its premise is gone. [ADR-0006](../adr/0006-engine-removed.md) records the decision.

## Risks

| Risk | Where it bites | Check |
|---|---|---|
| Text result, no schema | S2 | the fence allows exactly one result path per live order; the loop refuses a malformed file once |
| Deny rules are prefix matches | S2 | `tests/grant` tries a compound command; the loss is recorded, not hidden |
| `isolation: worktree` and a shared-path scope | S2 | the scope cut still names one owner per entry point; a merge conflict stops the round with a bug |
| The loop advancing on its own account | S3 | the measurement's third criterion; a single failure keeps the engine |
| Plugin agents ignore frontmatter `hooks` | S2 | the ledger is a session-level hook; verified by the S2 gate run |

## Not in this plan

Publishing 4.0.0 (the PO kept the tag local); the Vietnamese-pitch language gate (unchanged);
`shapeup` (Phase 1) and its resources (unchanged); the knowledge base and retro (unchanged — they
have no kernel dependency beyond `gate`).
