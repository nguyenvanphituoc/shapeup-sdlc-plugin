# 05 — Verification & Quality Strategy

[← Back to index](README.md)

## How the harness proves itself

The plugin holds itself to the same standard it imposes on the code it generates: a claim of
correctness isn't accepted without a mechanical check behind it.

| Tier | What it proves | Cost |
|---|---|---|
| **0 — Structural**<br/>`tests/structural.mjs` | The plugin is well-formed and its own gates actually discriminate: every schema parses, every skill has a valid frontmatter contract, the GATE L2 hook denies on a partial board and allows on a green one, the planted-bug fixture fails a buggy build and passes the correct one. 450+ checks (the suite asserts its own documented floor, so this number may only grow), split by ownership domain into `tests/structural/*.mjs` behind a thin `structural.mjs` runner that threads one shared context (`tests/lib/`). | Zero LLM calls, zero network — runs in CI on every push. |
| **1 — Trigger evals**<br/>`evals/trigger-evals.json` | The right skill actually fires for a given request, with cross-skill hard negatives — 103 cases across 9 skills. | Requires the plugin installed and a measured `--measure` run; an honesty invariant forbids a fabricated baseline number. |
| **2 — Functional fixtures**<br/>`examples/eval-planted-bug/` | A with-skill vs without-skill delta — e.g. a FizzBuzz build with a deliberately planted bug, dressed to look done (green self-suite, every AC box ticked), that a properly skeptical judge must still FAIL. | Deterministic half in CI today; the full transcript-graded half needs live Claude auth. |

The oracle registry behind Tier 0 (`scripts/shapeup-sdlc/oracles/`) is itself proven to
discriminate, not just to run: each of the `test`, `snapshot`, and `http` oracles is checked
against both a correct fixture and a negative control (`examples/lib-mathx`,
`examples/refactor-greet`, `examples/http-ping`) — a grader that rubber-stamps everything would
fail its own test.

---
[← Functional Design](04-functional-design.md) · [Back to index](README.md) · [Next: Appendix →](06-appendix.md)
