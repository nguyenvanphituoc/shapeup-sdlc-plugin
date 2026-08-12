# Evals — Tier-2 functional apparatus (repo-only, dev/CI)

Repo-only, never shipped to installs. What lives here now is the **functional** half of the
verification story and nothing else:

- **`fixtures/`** — the spine fixtures the planted-bug examples grade against.
- **`oracles/`** — `lint-rows.mjs` and `verdict-rows.mjs`, the row renderers those fixtures use.

Both are driven from `examples/eval-planted-bug-2/`. See
[`docs/design/05-verification-and-quality-strategy.md`](../docs/design/05-verification-and-quality-strategy.md)
for how this tier sits against the structural suite.

## What used to be here, and what its removal cost

Two measurement layers were removed deliberately. Recording that here rather than letting the
directory quietly shrink, because the gap is the kind a reader should meet on purpose:

- **Tier 1 — activation.** Per-skill `trigger-evals.json` datasets plus `tools/trigger-eval.mjs`,
  which drove headless probes and measured whether a skill's `description` actually made the model
  reach for it. Its last run recorded **FPR 0.0 across 67 cross-skill negatives** on
  `claude-haiku-4-5-20251001`. Nothing measures that now — a description can drift into stealing a
  sibling's queries and no check will notice.
- **Tier 3 — craft and efficacy.** The Day-1 rubrics and reference drafts, `tools/skill-loop.mjs`,
  and the Day-2 failure-class register. These asked whether skill output *improves under revision*
  and whether each tool *reduces the error class it was built for*.

Removed with them: the schemas, both baselines, the run records, and structural §16 and §48 — the
checks that made the honesty invariant mechanical. That invariant still holds as a rule (**no
number may be written from anything but a run that produced it**), but it is now upheld by review
rather than by CI, which is a weaker guarantee and is stated as such.

The structural suite (Tier 0) and this directory's functional fixtures are what remain. Both prove
*mechanism* — that a gate denies, that an oracle discriminates. Neither proves *craft*.
