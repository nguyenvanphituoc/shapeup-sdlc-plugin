# The non-delivered-content sweep

What may not appear in files a user receives, how to find it, and how to rewrite a hit without
destroying the reasoning it carries.

## Contents

- [Scope: what "shipped" means](#scope-what-shipped-means)
- [The marker taxonomy](#the-marker-taxonomy)
- [The sweep](#the-sweep)
- [Rewriting a hit](#rewriting-a-hit)
- [Judgment calls](#judgment-calls)
- [Tests that pin internal vocabulary](#tests-that-pin-internal-vocabulary)

## Scope: what "shipped" means

**There are two delivery channels and they are not the same size.** Getting this wrong in either
direction wastes a whole pass.

| Channel | How users get it | What they receive | Governed by |
|---|---|---|---|
| npm tarball | `npx shapeup-sdlc init` | the allowlist only | `files` in `package.json` |
| Claude Code plugin | `/plugin marketplace add …` | **the whole git tree** | nothing — `marketplace.json` sets `"source": "."`, so it is a clone |

Verify both rather than assuming:

```bash
npm pack --dry-run 2>&1 | grep -c "npm notice"          # tarball file count
node -e "console.log(require('./.claude-plugin/marketplace.json').plugins[0].source)"
git ls-files | wc -l                                     # what a plugin install delivers
```

The npm allowlist roots are `bin/`, `skills/` (minus `skills/**/evals/**`), `hooks/`, `commands/`,
`oracles/`, `.claude-plugin/`, `AGENTS.md`, `.env.shapeup.example`,
`.claude/settings.local.example.json` and `SECURITY.md`. Re-derive rather than trusting that list.

**`README.md` and `LICENSE` ship even though neither appears in `files[]`** — npm always includes
them, along with `package.json` and any `CHANGELOG`. Reading the allowlist alone will tell you the
README is repo-only; `npm pack --dry-run` will tell you it is the single largest published file.
Trust the pack, not the allowlist. This matters because the README is usually the densest
concentration of benchmark citations in the repo, and every relative link into `docs/`, `tools/`
or `evals/` that resolves on GitHub 404s on the npm package page.

That is a positioning call rather than a hygiene defect, so raise it, do not act on it: the
evidence in the README is doing deliberate credibility work for the product. The cheap fix, if the
user wants a clean npm surface, is a short npm-facing README rather than gutting the GitHub one.

**Do not delete repo-only documentation as a cleanliness measure.** That the tree is public is a
recorded decision, not an oversight — `docs/design/adr/0002-plugin-repo-organization.md` states it
plainly: the repo/publish split is *a legibility boundary, not an access-control one; nothing here
is secret*. The repo is public on GitHub, so removing files would not un-publish them anyway. If
the premise has changed, that is an ADR to revisit with the user, not something a cleanliness pass
reverses on its own initiative.

(`docs/internal/` was the standing example here until it was retired outright — the working record
was folded into the design record, and ADR-0002 now carries that outcome. The rule is unchanged;
only the example is gone. Deleting it was a decision taken with the user, which is exactly the bar
this paragraph sets.)

## Severity: where a leak actually hurts

Rank hits by what the reference does, not by which directory it sits in.

1. **Runtime-loaded prose — the worst case.** `skills/*/SKILL.md` and
   `skills/tech-lead/references/*.md` are read *by the model, during a run*. A dangling
   `docs/migration/...` pointer here hands the orchestrator a path that does not exist in an
   installed plugin — it is a broken instruction, not just an odd comment. Fix these first.
2. **Shipped code comments** — `hooks/*.mjs`, `skills/**/scripts/*.mjs`. Read by a human
   maintaining an installed copy. A citation they cannot open is noise and mild embarrassment.
3. **Repo-only files** — `docs/`, `tests/`, `tools/`, `evals/`, `CHANGELOG.md`, `README.md`'s
   contributor half. Not a leak at all. Leave them alone; this is where the evidence *belongs*.

That last row is why the sweep is not destructive: stripping a benchmark citation from a hook
comment does not lose the benchmark, because the write-up still lives under `docs/`.

## The marker taxonomy

Six categories, roughly by how often they show up.

**1. Measurement results.** Acceptance rates, token counts, dollar figures, turn counts, wall-clock
numbers, sample sizes, model names attached to a run, named benchmark suites, DNF/timeout records.
Anything of the shape "measured at 29%", "n=5", "$4.57–$10.36", "82–120 turns", "1800s cap".

**2. Internal defect identifiers.** `HD-001`-style IDs referring to *this project's* development
defects, audit finding codes (`F1`, `F-16`), and pathology labels used only in internal write-ups.

**3. Migration and phase names.** `Stage A2`, `Stage A3`, `Stage B`, `Stage C1`, "the cutover",
"the migration's own probe", named plan phases, `A7`-style run identifiers.

**4. Audit and initiative codenames.** `absorb-audit`, `island-escape`, and any label that means
something only to someone who read the internal document that coined it.

**5. Paths into non-shipping directories.** `docs/migration/...`, `docs/design/...`,
`docs/internal/...`, `tests/structural/...`, `tools/...`, `evals/...`. A user following such a
citation gets a 404 — the file is not in their copy. This includes `docs/upgrading.md`, which
sounds user-facing but does not ship in the package.

**6. Dangling references to deleted things.** A shipped file citing a script, skill or operation
that no longer exists. Not internal bookkeeping exactly, but the same class of harm: it sends the
reader somewhere that is not there.

## The sweep

```bash
grep -rniE "benchmark|HD-0[0-9]+|F-16|stage [a-z][0-9]?\b|stage-[a-z][0-9]|of the audit|docs/(migration|internal|design|workflow|upgrading)|tests/structural|tools/|evals/|\bn=[0-9]|DNF|island-escape|absorb-audit|[0-9]+% acceptance" \
  --include="*.md" --include="*.mjs" --include="*.js" --include="*.json" \
  skills commands hooks oracles bin AGENTS.md SECURITY.md 2>/dev/null \
  | grep -v "/evals/"
```

The trailing `grep -v "/evals/"` matters: `skills/**/evals/**` is excluded by the allowlist, so hits
there are not violations and will otherwise drown the signal.

**Two lessons are baked into that pattern, both learned by missing things.**

*`-i` is load-bearing.* A case-sensitive sweep missed `// ⟐ MOVED AHEAD OF WIRE AT STAGE A3.` in a
shipped workflow script — the pattern said `Stage`, the comment shouted `STAGE`. Emphatic all-caps
is exactly how these comments get written, so the register the marker most often appears in was the
one register the grep could not see.

*`stage [a-z]`, never `stage [A-C]`.* Narrowing the character class to the phases someone happened
to remember missed `(Stage G of the audit)` in **all six** `oracles/*.mjs` headers plus
`spec-evaluator/references/probing.md`, `verdict-ledger.mjs` (`audit Stage D1`) and `gate-l2.mjs`
(`audit Stage E1`) — a whole vocabulary, invisible because the class stopped at C. When a marker is
a *naming convention*, match the convention's shape, not the instances you can recall. `of the
audit` is in the pattern for the same reason: it catches the phrasing regardless of the letter.

Two deliberate omissions, both learned by running this against real content:

- **No `\$[0-9]` pattern.** It flags the token/cost estimate tables in
  `skills/ba-pitch-analyzer/assets/templates/` — which are product guidance for the user's own
  runs, not our spend. Dollar figures that *are* leaks (per-session cost from a benchmark row) come
  attached to one of the other markers, so nothing is missed. Scan for `$` separately by eye if you
  want certainty.
- **`\bn=[0-9]`, not `n=[0-9]`.** Without the word boundary it matches `stdout_len=0` in
  `hooks/lib/decision.mjs` and similar, producing pure noise.

A grep that cries wolf gets skimmed, which is the same as not running it. If you widen these
patterns, re-check the hit list for noise before trusting it.

Get a per-file count first to prioritize — the distribution is usually long-tailed, with a handful
of files holding most of the hits:

```bash
<the grep above> | cut -d: -f1 | sort | uniq -c | sort -rn
```

Then sweep for dangling references separately, since they need a different judgment:

```bash
# Named .mjs/.js files that no longer exist
grep -rhoP "[a-zA-Z0-9._-]+\.(?:mjs|js)(?![a-zA-Z0-9])" \
  --include="*.md" --include="*.mjs" skills hooks commands oracles bin \
  | sort -u | while read f; do
      [ -z "$(find . -name "$f" -not -path './.git/*' -print -quit)" ] && echo "MISSING: $f"
    done
```

**Three corrections are load-bearing in that pattern; the earlier `[a-z0-9-]+\.(mjs|js)` reported 38
missing files of which 36 did not exist as claims at all.** The trailing `(?![a-zA-Z0-9])` stops
`.js` from matching inside **`.json`**, which was the bulk of it — every `analyze.json`,
`receipt.json` and `settings.json` in the tree was reported as a missing `.js`. `_` and `.` belong
in the character class or `_shared.mjs` reads as a missing `shared.mjs` and `mathx.test.mjs` as a
missing `test.mjs`, both of which exist. A sweep whose output is mostly noise is one nobody reads to
the end, which is the same as not running it.

Expect two survivors that are *not* defects: `file.js` in a stack-frame example
(`aegis-digest.mjs`) and `workflow-script.js` in a usage string (`run-workflow.mjs`). Both are
illustrative placeholders. Confirm by reading the line before reporting either.

## Rewriting a hit

The failure mode to avoid is deleting the comment. These comments exist because a guard's shape is
non-obvious, and a maintainer who does not know why it fails closed will eventually "simplify" it.

Keep the claim, drop the citation:

| Before | After |
|---|---|
| `measured across six benchmark runs the lane executed zero times` | `left to it, the lane executes zero times and the agent improvises instead` |
| `29% acceptance, 10 escaped defects, five times out of five` | `it reads like a clean run and leaves every defect in the deliverable` |
| `see docs/migration/stage-a2-evidence.md §7.3` | *(drop — or restate the finding inline in one clause)* |
| `HD-002's other half` | `the other half of the comma defect` |
| `tests/structural/13-argv-contract.mjs asserts this` | `the structural suite asserts this` |
| `killed at the 1800 s cap and published as a DNF` | `killed at an external time cap, having produced nothing scoreable` |

The rewrite is better prose for the shipped audience, not a lossy compression of it. "Measured at
29%" tells a user nothing they can act on; "reads like a clean run and leaves the defects in"
tells them what to watch for.

Two habits that keep the result honest:

- **Preserve the epistemic status.** If the original said "measured, not theorized", the rewrite
  should still signal that this was observed rather than imagined — "reproduced, not theorized",
  "observed repeatedly". Losing that turns a finding into an opinion.
- **Generalize rather than delete a specific.** `F3 (Sonnet 5) was killed at 1800 s` becomes
  `a run killed at an external time cap` — same mechanism, no unavailable referent.

## Judgment calls

Some hits are legitimate. The test is whether the reader can act on it with only what they
received.

**Keep:**

- **ID formats offered as templates.** `- **HD-001** — <symptom>` inside a template for the
  consumer's own harness-defect register is product vocabulary — the user files their own
  `HD-NNN` entries. It is a format example, not a reference to our bookkeeping.
- **`ADR-0001`-style decision records** cited as a *name* rather than a path. The consumer inherits
  the concepts (the two storage roots, contracts as markdown); "since ADR-0001" reads as a version
  marker. Citing `docs/design/adr/0001-....md` as a path does not — the file is not in their copy.
- **The plugin's own name in installer strings.** `npx shapeup-sdlc init` is an instruction.
- **Ordinary words that collide with markers.** "coverage" as a noun, "audit" as a verb,
  `--split` as a flag. The reliable repeat offender is the **task-type enum**
  `CHORE/DOCS/MIGRATION/SPIKE` in `skills/ba-pitch-analyzer/scripts/spec-lint.mjs` and
  `assets/templates/task.tmpl.md` — a product concept a user's own tasks carry, which the
  `docs/migration` pattern hits under `-i`. Expect it every run; it is never a violation.

**Strip:**

- Anything a user cannot open, verify, or act on.
- Any number whose provenance is a run they did not make.
- Any name that requires having read an internal document.

When genuinely unsure, ask: *if a user read this line, would they go looking for something they do
not have?* If yes, strip it.

## Tests that pin internal vocabulary

A test asserting that a shipped, user-facing string contains an internal ID is a defect in the
test, and it will block the sweep:

```javascript
if (/HD-008/.test(block.reason)) ok("...")   // pins internal bookkeeping into a user-visible message
```

Re-point it at the substance the message must carry, and leave a comment saying why:

```javascript
// Asserts the SUBSTANCE, never an internal defect id: the shipped message must name the work
// calls and say they are the reason rather than a waiver. Pinning a tracker id here would put
// this project's own bookkeeping into a string a user reads.
if (/work calls/i.test(block.reason) && /not a reason to waive/i.test(block.reason)) ok("...")
```

This is strictly stronger than the original — it checks the message is *useful*, not that it
contains a particular token. Distinguish this from weakening a test to make it pass: the question
is whether the new assertion would still catch the regression the old one was written for.
