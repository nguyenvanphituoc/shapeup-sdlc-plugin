# Evals for `harness-maintenance-audit`

The skill's whole claim is that it catches drift the test suite cannot see. So the fixture is built
to make that measurable: **five planted defects, of which `npm test` catches exactly one.**

If a future change to the skill only finds the one the suite already reports, it has added nothing.

## Rebuilding the fixture

Copy the repo to a scratch directory (exclude `.git`, `.plan-runs`, `node_modules`,
`.playwright-mcp`, `*.tgz`, and `.claude/skills` so the skill under test is not sitting inside its
own fixture). Keep `shapeup/` — it is committed content the structural suite reads, and excluding
it produces 14 spurious failures that mask the planted ones.

Verify the clean copy is green (1364 checks at time of writing), then plant:

| # | Defect | File | Visible to `npm test`? |
|---|---|---|---|
| D1 | Remove `"coverage"` from the `Operation` enum, leaving `skills/ba-pitch-analyzer/SKILL.md` still advertising it | `skills/tech-lead/schemas/domain.schema.json` | no |
| D2 | Change `Operation (15)` → `(18)` and add `generate-board, recheck, adjudicate` to the list | `docs/design/07-domain-erd.md` | no |
| D3 | Inject a benchmark citation into the header comment (`sdd-harness-bench`, `n=3`, `1800 s`, `29%`, a `docs/migration/` path) | `hooks/gate-deadline.mjs` | no |
| D4 | Add a `docs/migration/stage-a3-plan.md` citation and a `Stage A3` phase name | `skills/tech-lead/references/gates.md` | no |
| D5 | Bump `version` to `1.7.0`, leaving `.claude-plugin/plugin.json` at `1.6.3` | `package.json` | **yes** |

Commit them under a plausible cleanup subject — `chore: tidy operation vocabulary and refresh
notes`. The misleading commit message is part of the fixture: Pass 4 of the skill is about a
cleanup commit whose blast radius exceeds its subject line, and that is precisely what D1 is.

Confirm the planted state reports `1 structural failure` (the version drift) before running evals.

## Why these five

Each maps to a class the skill claims to cover, and each was a real finding in this repo:

- **D1** — an enum member removed by a cleanup commit that also removed unrelated members, leaving
  the owning skill publishing an input contract the schema will now deny.
- **D2** — a count and a membership list drifting together, which reads as internally consistent.
- **D3 / D4** — the two commonest leak shapes: a measurement result, and a path into a directory
  that does not ship.
- **D5** — the one mechanical check that already exists, included as a control. A run that reports
  only D5 has done nothing the suite did not already do.

## Grading

`evals.json` carries the answer key and the prompts; each run directory carries an
`eval_metadata.json` with the assertions. Beyond finding the five, the assertions check *method* —
whether the run derived the shipped set from the `files` allowlist, executed a verification command
rather than only reading, kept docs-fixes separate from code-defect reports, and refrained from
inventing measured numbers. Those are the parts that generalize past this fixture.
