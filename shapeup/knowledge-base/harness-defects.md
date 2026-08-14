# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects

*None open.* Cleared 2026-08-14 to start the v2.0 work from a clean slate.

Two defects were open at the moment of clearing and are **not** closed by their removal from this
file — they are carried in the v2.0 plan as staged work, and each will be re-filed here only if a
run reproduces it after its stage lands:

- The installer writes a permission prefix that ends mid-argument, so it grants nothing and the
  pipeline stops at its first dispatch. The regression guard asserted string-prefix-ness — a proxy
  for "the CLI honours this" — which is why the suite stayed green. **And the grant shape is not
  the whole defect:** a Bash command carrying `${…}` is refused before any rule is consulted, so
  the call-site spelling `tests/structural/14-invocation-paths.mjs` mandates — literal
  `node "${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/…"`, no bare, no half-qualified — is denied
  under *every* grant, including `Bash(node:*)`. Any fix has to resolve the root before the command
  is issued, not template it. Whatever shape is chosen, **its guard must execute a granted command,
  not compare strings.**
- The WorkOrder carries no field naming where the WorkResult goes, so each worker derives the path
  from prose while its own `substrate.allowed` names a directory that does not contain it. The
  workflow lane works around this by stating the path in the dispatch prompt and deriving the same
  one from the order; the port itself is unfixed.

---

**Where a closed defect goes.** Its fix is pinned by a regression guard, and that guard is the
durable record — a defect whose test fires on reversion cannot come back silently, which is more
than a paragraph in this file could ever promise. The guards standing today cover the committed
contract format failing silent (structural §46(f)(g)(h)(i) for the parser, §23 for the two call
sites §46 does not reach) and `gate-zerowork`'s work-by-other-means fail-open (the assertion that
used to license it is inverted in place in `tests/structural/10-run-receipt.mjs`, with the
Bash-launch dispatch arm the deletion depends on pinned in `17-gate-zerowork-workflow.mjs`) — every
one mutation-verified in both directions. Those guards are the whole write-up that still matters:
what a closed defect cost is recoverable from the tests that now fail on reversion, and nothing
else needs to survive for the fix to hold.

This file stays short on purpose. It is a queue, not an archive.
