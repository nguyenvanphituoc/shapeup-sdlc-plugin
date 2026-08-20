# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects

- The WorkOrder carries no field naming where the WorkResult goes, so each worker derives the path
  from prose while its own `substrate.allowed` names a directory that does not contain it. The
  workflow lane works around this by stating the path in the dispatch prompt and deriving the same
  one from the order; the port itself is unfixed.
- **Cost/wall-clock instrumentation is dead.** `harness report export` and `harness probe stats
  --economics` are both keyed off a per-agent-call journal the Workflow runtime is supposed to
  stamp. Measured live 2026-08-19, twice, in two independent worktrees: it is never written — the
  journal's own directory does not exist after a real run either time. Cost/wall-clock reporting has
  to be reconstructed from the dispatch-attestation ledger instead — real, mechanically timestamped,
  but coarser, with no per-phase cost split. Needs a Betting Table call: wire the runtime (or the
  orchestrator itself) to write the journal for real, or delete the reporting commands that assume
  it exists — a mechanism that looks like it works but doesn't is worse than no mechanism.

Cleared once already, 2026-08-14, to start the v2.0 work from a clean slate:

- ~~The installer writes a permission prefix that ends mid-argument, so it grants nothing and the
  pipeline stops at its first dispatch.~~ **FIXED 2026-08-14** — see below. The half of this entry
  claiming the call-site spelling is doomed was **wrong, and measurement is what showed it**; the
  correction is recorded because acting on the claim would have caused a needless rewrite of every
  call site in the plugin.

### Raw idea, not yet a pitch — QA lens fan-out

Not a defect: a real, measured opportunity, filed here per this file's own "raw ideas for the
Betting Table" charter rather than through a coach retro — no Ship-Gate ran; this came from a direct
real-execution experiment, 2026-08-19.

QA Edge Hunt's wall-clock variance (reproduced independently on two fixtures, ~160–670s per hunt)
is per-turn model latency noise, not a scheduling bug — QA has no lens-level dispatch today, so
there is nothing to schedule badly. A prototype fanning its 6 lenses out via `parallel()` measured a
real but modest ~18–31% win (n=2), at roughly 6x one hunt's own setup-phase token cost. If bet, it
needs a `lens` field on `qa-edge-hunter`'s WorkOrder payload, a lens-aware order-suffix
discriminator, and a merge step for the per-lens reports — none of which exist yet. Should ship
opt-in only: QA's findings are advisory by design, and the sample size here is thin.

### Raw idea, not yet a pitch — what a rebuilt trigger-eval layer must have

Not a defect: a correction plus two proven requirements, from a direct real-execution experiment,
2026-08-20. Filed here because the decision it needs — whether an activation-measurement layer comes
back at all after `9236559`/`fda81c4` removed it — is a Betting Table call, not a maintenance one.

`solution-architect` measures **TPR 1.0 / FPR 0 / precision 1.0** with its `description:`
byte-for-byte unchanged. The only variable was the probe's working directory: 0.333 in the plugin's
own repo, 1.0 in a workspace holding the artifacts the queries presuppose (11 cases, Sonnet, named
explicitly, concurrency 1, detection logic lifted verbatim from the deleted harness so scoring
matches the baseline).

**The claim this corrects** — GH#12 held that this skill's low score could not be the missing-
artifact confound because it had "0/6 deictic positives", and concluded a description rewrite was
the fix. Measured: **6/6 presuppose artifacts**, one literally deictic. The hand classification
counted only file-path referents like `TASK-007` and missed that "each use case" or "main.js" is
just as unsupplied. Acting on it would have tuned the prose until the skill activated where its
inputs do not exist — violating its own "profile absent ⇒ ESCALATE, do not invent an entry point"
rule, and spending the one clean result the baseline had to do it. Recorded for the same reason as
the permission-grant correction below: the wrong claim was the actionable-looking one.

Two requirements, now proven rather than hypothesised, for any successor layer:

1. Probes run against a workspace containing what the queries presuppose. Without it a correct
   refusal is scored as a description defect, and the metric is unstable besides — the same prose,
   model and dataset read 0.0 on 2026-07-26 and 0.167 on 2026-08-12.
2. The scorer records **what activated instead**, not just fired/not-fired. Every miss here
   activated *nothing*; no sibling ever stole a query. That silence is what distinguishes a
   sensible refusal from a real description defect, and the old harness could not see it.

### The permission grant — fixed, and one claim above corrected

Measured 2026-08-14 against Claude Code 2.1.232, every verdict decided by whether the target
script's marker file landed on disk rather than by what a model reported.

**There are two rule syntaxes.** `Bash(<prefix>:*)` is a prefix match at complete argument
boundaries, where a `*` is a literal asterisk. `Bash(<pattern> *)` is an anchored **glob**, where
`*` expands and crosses `/`. Only the first was ever tried, which is why the fix looked like a
trade between least privilege and quoted call sites. It is not one:

| rule | command | result |
|---|---|---|
| `Bash(node "<abs>.mjs":*)` — closing quote **inside** the rule | quoted | ALLOWED |
| `Bash(node "*/skills/<owner>/scripts/<n>.mjs" *)` | quoted abs path **+ args** | ALLOWED |
| same | quoted abs path, **zero args** | DENIED — hence two rules per script |
| `Bash(node "*/skills/<owner>/scripts/<n>.mjs")` | quoted, zero args | ALLOWED |

**The correction.** The claim that a call site carrying `${CLAUDE_PLUGIN_ROOT}` is denied under
every grant conflates two different things:

- A **skill's** `${CLAUDE_PLUGIN_ROOT}` **is** expanded, at skill-load time, before the model reads
  the prose. Verified with a throwaway single-skill plugin: a documented
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/hello.mjs"` reaches the model as an absolute quoted path. So
  the `${…}` refusal never fires on the plugin's real path, and the shipped call-site spelling is
  fine exactly as `14-invocation-paths.mjs` mandates it. No call site needed rewriting.
- A **rule's** `${CLAUDE_PLUGIN_ROOT}` is **not** expanded — rules live in the user's project
  settings, where the token means nothing. That, plus the mid-argument prefix, is the whole defect.

The `${…}` refusal is real (it blocks even `${HOME}`), but it only reaches a command a *user* types
by hand out of the docs — worth a README note, not an architecture change.

**Shipped.** `bin/lib/grant.mjs` enumerates entry points from the filesystem and emits two rules
each (20 → 40; a kernel would take it to 2). `mergePipelinePermissions` purges the dead v1.5–v1.8
rules on upgrade instead of accumulating them, and leaves unrelated user rules alone.
**Anyone who installed before this fix must re-run `npx shapeup-sdlc init`** — the old rules never
granted anything.

**The guard executes, as this register demanded.** `npm run test:grant`
(`tests/grant/executing-grant.mjs`) starts a real session per case and decides on the marker file:
8 cases covering a marketplace layout with and without arguments, a `--plugin-dir` checkout under an
arbitrary directory name, an install path containing a space, two negative controls that must be
DENIED, and pins for both halves of this defect. Tier-0 keeps only what is checkable offline and
says in its own banner that it is bookkeeping, not evidence.

**One claim this invalidates.** `harness run`'s provenance paragraph asserted a headless run
through a granted Bash prefix with zero denials. With no working grant that cannot have been what it
claims; the banner now says so rather than carrying it as evidence.

### ⚠ STILL OPEN — a third layer, above the grant: workspace trust

Correct rules are not sufficient. Measured 2026-08-14: in an **untrusted workspace** the CLI prints
`Ignoring 40 permissions.allow entries from .claude/settings.json: this workspace has not been
trusted` and discards the entire allow-list before any rule is consulted.

`.claude/settings.json` is precisely where `npx shapeup-sdlc init` writes, and **a fresh clone is
untrusted by definition** — so in CI, the case the grant exists for, the grant is dropped whole.
`-p` skips the trust *dialog*; it does not confer trust.

This is why the executing guard's other cases pass: they deliver rules via `--settings`, from
outside the project, which is not trust-gated. That route proves the rules are well-formed; it says
nothing about the configuration a user actually gets. `PIN project-scoped rules are ignored in an
untrusted workspace` now covers the difference, and it asserts DENIED — a fail-closed pin, so if the
platform ever relaxes this the guard turns red and tells us.

**Shipped mitigation, deliberately partial:** `bin/init.mjs` now detects the condition and prints
what to do about it. It **reports rather than repairs** — trusting a directory authorises executing
code from it, which is the user's decision, not one for a package running under `npx`.

**The open question for the Betting Table:** what a headless/CI install should do. Candidates: bake
`hasTrustDialogAccepted` into the CI image; ship the grant to *user* scope instead of project scope
(untested — user scope may not be trust-gated); or document `--settings` pointing outside the
project as the supported CI route. Until one is chosen, **Phase 7's headless probe cannot pass**,
and no plan should claim it can.

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
