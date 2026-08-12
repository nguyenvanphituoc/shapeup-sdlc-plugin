---
name: harness-maintenance-audit
description: >
  Audit this plugin repo for two kinds of rot: documentation that no longer matches the shipped
  plugin, and internal bookkeeping that has leaked into files users receive. Derives every fact
  from the artifact itself — enums from the schema, counts from the filesystem, hook behavior by
  executing the hook — then fixes the docs and reports code defects separately. Use this whenever
  maintaining this repository: before a release or version bump, after removing/renaming/adding a
  skill, operation, hook or command, after any commit that touches `skills/`, `hooks/`,
  `commands/`, `schemas/` or `docs/`, and whenever the user asks to "check the docs are current",
  "audit for drift", "make sure the plugin is clean", "does the documentation match", "is anything
  out of date", or wants a consistency/parity check between code and documentation. Also use it
  proactively before committing a refactor that deletes or renames anything, because the blast
  radius of a cleanup commit is routinely wider than its message claims.
---

# Harness maintenance audit

## What rots, and why it rots silently

This repo has an unusual shape that produces two specific failure modes.

**It is a product and its own blueprint.** `docs/` describes a plugin that `skills/`, `hooks/`,
`commands/` and `oracles/` actually implement. Both are prose-heavy, both are edited by hand, and
nothing mechanically ties a sentence in `docs/design/03-system-design.md` to the enum it describes.
So the docs drift, and they drift *plausibly* — a doc that says "11 workers" over a 10-member enum
reads perfectly.

**Not everything in the repo is product.** Development artifacts — benchmark numbers, internal
defect IDs, migration stage names, audit codenames, paths under `docs/`, `tests/`, `tools/`,
`evals/` — belong in the repo but not in what a user reads as the product. They leak easily,
because the person writing a code comment is holding all that context and it feels like useful
rationale at the time.

The leak that matters most is not in a code comment. `skills/*/SKILL.md` and
`skills/tech-lead/references/*.md` are **loaded by the model at runtime**, so a dangling
`docs/migration/...` pointer there is a broken instruction handed to the orchestrator mid-run —
the file does not exist in an installed plugin. `references/forbidden-content.md` ranks the
severity tiers and, importantly, defines what "shipped" means: there are **two delivery channels**,
and the `files` allowlist governs only one of them.

Both are invisible to the test suite and to code review, because in both cases the wrong text is
*locally coherent*. The only way to catch them is to derive the truth from artifacts and compare.

## The one rule that makes this work

**Never confirm a fact by reading prose. Derive it from the thing itself.**

A doc that says GATE L2 denies, a glossary that calls it "the deny hook", and a README whose
screenshot shows a denial will all agree with each other and all be wrong. Reading any of them
confirms the others. Executing the hook settles it in one command.

Applies across the board: enums come from the JSON, counts from the filesystem, hook decisions from
running the hook against a fixture, the shipped file set from the allowlist. If you find yourself
about to write "the docs say X, so X" — stop and derive X.

## Pass 0 — establish whether the ground is already red

Run this before changing anything:

```bash
npm test 2>&1 | tail -5
npm run demo 2>&1 | tail -5
claude plugin validate . --strict 2>&1 | tail -3
```

A suite you have not run is not a baseline, it is an assumption. Existing failures are findings in
their own right and they are often the most valuable thing in the audit — a red check nobody has
looked at has usually been red since a specific commit, and it is pointing at the defect you were
about to go looking for. Record the counts so you can prove at the end that you did not break
anything.

If `npm run demo` fails, read the failure rather than re-running it. That recorder drives a real
hook and refuses to render an asset that misrepresents it, so its failure *is* a behavior-changed
report.

## Pass 1 — derive ground truth

Establish the numbers and inventories before opening a single doc. `references/ground-truth.md`
carries the full command catalogue — the enums, the counts, the hook inventory, the operation
ownership map, the trigger-eval totals, how to execute a hook against a fixture. Read it and work
through it; the output of that pass is the fact sheet everything else is compared against.

Two that deserve naming here because everything else depends on them:

```bash
# Both delivery channels — the npm allowlist, and the plugin source (a clone of the whole tree).
node -e "console.log(require('./package.json').files.join('\n'))"
node -e "console.log('plugin source:', require('./.claude-plugin/marketplace.json').plugins[0].source)"

# Version parity: a bump must touch both, and release CI fails on mismatch.
node -e "const a=require('./package.json'),b=require('./.claude-plugin/plugin.json');
console.log(a.version, b.version, a.version===b.version?'OK':'MISMATCH')"
```

## Pass 2 — compare the docs against the fact sheet

Walk `docs/` plus `README.md` and `AGENTS.md`. For each countable or checkable claim, compare it
against Pass 1. The recurring drift sites, in rough order of how often they are wrong:

- **Counts** — "the N skills", "N workers", "N operations", "Five PreToolUse hooks" above a table
  of six, structural check totals, trigger-eval case counts.
- **Enum membership** — a worker, operation, or hook named in prose that the schema no longer
  carries, or vice versa.
- **Behavioral claims** — "denies" vs "warns", what a hook reads, what it fences. These need
  Pass 1's execution evidence, never a reading.
- **Paths** — cited files that moved or were deleted. The structural suite checks some of these but
  only for a few documents.
- **Versions** — a pinned example version in install docs, the version in the design index.
- **Absent components** — something the plugin now does that no doc mentions at all. This is the
  hardest to see, because there is no wrong sentence to notice; work from the Pass 1 inventory
  toward the docs, not the other way round.

**Two shipped prose files deserve separate attention**, because they are product rather than
documentation *about* the product, and a wrong sentence in either reaches the user directly:

- **`AGENTS.md`** — spliced into consumer projects by `bin/init.mjs`. It must speak in skills,
  commands and options, never in `.mjs` paths.
- **`SECURITY.md`** — the page a reviewer reads to decide whether to trust the hook surface. Audit
  its hook table against `hooks.json` *both ways*, and treat its numbered claims as assertions to
  falsify, because that is what they invite. This file has drifted the furthest in practice: it
  went on stating "Stop hooks never block" long after `gate-zerowork` began returning
  `decision: "block"`, and it silently missed three hooks that were added after it was written.
  An undocumented hook in the README is untidy; a wrong deny claim in the security page is a wrong
  answer to a security question.

## Pass 3 — the non-delivered-content sweep

Restrict to the shipped set from Pass 1 and sweep for development bookkeeping. The marker taxonomy,
the greps, and the judgment calls about what counts as delivered live in
`references/forbidden-content.md`.

The distinction that matters when rewriting a hit: **keep the operative rationale, drop the
evidence.** A comment explaining *why* a guard fails closed is load-bearing for whoever maintains
it next. The benchmark row, the model name, the dollar figure and the defect ID that convinced the
author are internal bookkeeping — they name artifacts the reader does not have and cannot check.
Rewrite so the reasoning survives without the citation:

> `// Measured on sdd-harness-bench F2 (Haiku 4.5, n=5): 29% acceptance, 10 escaped defects.`

becomes

> `// A run that narrates its pipeline and stops reads like a clean success and leaves every`
> `// defect in the deliverable.`

The claim is the same and now the reader can evaluate it. Do not simply delete the comment — the
reasoning is why the code looks the way it does.

## Pass 4 — read the recent commits for blast radius

```bash
git log --oneline -15
git show --stat <suspicious-sha>
```

Look for cleanup, refactor, decommission and rename commits, and check what they *actually*
touched against what the subject claims. A commit titled "decommission X" that removes six enum
members is the highest-yield finding available in this repo, and it is invisible from the working
tree alone — the removal is coherent, it just took unrelated things with it.

For anything that looks collateral, check whether it had a downstream reader that is now stranded:

```bash
git log --oneline -S'"<removed-thing>"' -- <file>   # when it arrived, and when it left
grep -rn "<removed-thing>" skills/ hooks/ commands/  # who still references it
```

A removed operation whose skill still advertises it in its input contract is worse than either a
clean removal or no removal: the published contract is now unsatisfiable, and the schema will deny
an order the skill invited.

## What to fix, and what to only report

**Fix the docs.** Bringing documentation in line with observed behavior is safe, reversible, and
what the audit is for.

**Report code defects; do not quietly fix them.** When code and docs disagree, decide which one is
wrong — and if it is the code, that is a decision for the user, not a side effect of a doc pass.
Present it with the evidence and a recommendation. The distinction is not bureaucratic: a doc fix
records reality, a code fix changes it.

**Never make a red check green by weakening it.** If a test fails, the honest moves are to fix the
code or to establish that the test encodes a stale expectation. Rewriting an assertion so it passes
converts an open question into a false answer, which is the exact failure this repo exists to
prevent. When a test does turn out to be stale, re-point it at the *substance* rather than deleting
it — and say so in a comment, so the next reader knows it was a decision.

**The reverse trap is just as easy: turning a green check red by editing a default.** Removing a
developer's absolute path from a config default looks like pure hygiene, but an *empty* path is not
inert — `join("", ".git")` is `.git`, which exists in the current checkout, so the check silently
began resolving a cross-repo citation against the wrong repository and reported a perfectly good
citation as broken. Whenever you touch a default or an env fallback, exercise **every** state it
can now take (unset, set correctly, set wrongly) and confirm each lands in the branch you intended.
A skip and a failure must stay distinguishable — "I cannot verify this here" is a different fact
from "this is wrong," and collapsing them is the same error this whole skill is about.

## Honesty about numbers

Do not restate a measured number you did not measure. Trigger rates, acceptance rates and
benchmark results are properties of a run with a model and a date attached. If the dataset under a
measurement has changed, the correct edit is to say so — "measured against the previous dataset
revision, awaiting re-measurement" — not to scale the figure to the new denominator. Adjusting a
measured number to match a count you just derived silently manufactures a measurement.

This applies to dataset sizes too: report the dataset as it is now *and* flag that the stored
result predates it, rather than quietly reconciling the two.

## Report format

Lead with the mismatches, most consequential first. For each one:

```
**<short claim of what is wrong>** — <where it appears>
<Why it drifted: the specific commit, refactor, or design change that moved the code and
left the prose. "Unknown" is an acceptable answer; a guess dressed as a cause is not.>
```

Then, separately:

- **Cleanliness sweep** — count of references stripped, across how many shipped files, by category.
- **Defects found but not fixed** — each with symptom, mechanism, evidence, and a recommendation.
- **Verification** — the Pass 0 commands re-run, with before/after counts.

Prefer naming the cause over listing the symptom. "The commit that removed advisor-protocol also
removed five unrelated operations" is one finding that explains a dozen mismatches; reporting the
dozen separately buries it.

## Closing verification

Re-run everything from Pass 0 and state the deltas plainly. If a check was red before and is red
now, say that it is unchanged rather than letting a passing summary imply otherwise. Then confirm
the sweep with the same grep that found the hits, so "clean" is a demonstrated result rather than a
claim.
