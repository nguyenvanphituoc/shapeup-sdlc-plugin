# Phase 7, probe 7 — the metrics audit

Re-measures every row of `docs/output/PLAN.md`'s §0 "Primary metrics (surface area)" table that
the plan's own probe 7 names explicitly, against the repository as it stands today — not against
the operator's informal pass, and not against a remembered number. Method throughout: a literal
command, its literal output, then the verdict. A miss is recorded as a miss (the plan's own words,
probe 7) — no target is redefined after the fact to make a number match it.

Measured against `plan/phase7-verification-gauntlet` at commit `ba30d26fb9f300ea458aa7ca4a5ac25344536188`
(`package.json`/`.claude-plugin/plugin.json` both `2.0.0`), 2026-08-19T17:12Z.

## Headline

| Metric | v1.7.0 | v2.0 target | v2.0 measured | Verdict |
|---|---|---|---|---|
| Executable script files | 24 (tech-lead `scripts/`+`lib/` only) | **~11** | **33** under `kernel/` alone (41 incl. `bin/`+`hooks/`) | **MISS** — ~3x over target |
| Permission strings written by `init` | 6 (3 owners × 2 spellings) | **1** | **3** by default (2 Bash rules + `Workflow`); **2** with `--no-native-workflow` | **MISS** on the literal count, real reduction in owners (3 → 1) |
| Runtimes owned | 1 (`run-workflow.mjs`) | **0** | **0** | **MATCH** |
| Hooks | 10 | **4 hard** | **5** files under `hooks/`; **4** `PreToolUse` hard-deny walls + **1** `Stop` hard-block wall (5 hard walls total) + 1 records-only | **MISS** on raw file count (5≠4, already-documented, non-drift); **hard-wall reading also reads 5, not 4** — see §4 |
| Comment density, shipped JS | 36% (3,649 / 10,056) | **~18%** | **41.0%** (5,882 / 14,361) | **MISS** — density rose, not fell |
| Shipped LOC (`package.json` `files`) | ~24,240 | **~17,000 (±10%)** | **28,257** (all types) / **27,800** (excl. npm's automatic README/LICENSE/package.json) | **MISS** — ~64-66% over target, outside the ±10% band |

Of the six metrics probe 7 names explicitly, **one matches** (runtimes owned) and **five miss**,
one of them (comment density) missing in the *wrong direction* — up, not down, against a plan whose
stated goal was to cut it. None of the misses are explained away below; each is recorded with its
derivation and its largest contributors so the finding is legible, not just a bare number.

---

## 1 · Executable script files

**Today (v1.7.0): 24.** `docs/output/BASELINE-v1.md`'s Inventory section: "tech-lead scripts: 17 +
lib 7" = 24 — it counted only the tech-lead skill's own `scripts/` + `scripts/lib/` tree, not
hooks, not `bin/`.

**v2.0's direct successor to that tree is `kernel/`** (the plan's own "1 entry + core modules"
framing). Count, verified directly (not trusting the operator's earlier informal pass):

```
$ find kernel -name "*.mjs" -o -name "*.js" | wc -l
33
```

Full list (33 executable script files under `kernel/`):

```
kernel/harness.mjs                  kernel/probe/leg.mjs               kernel/reduce/snapshot.mjs
kernel/gate.mjs                     kernel/probe/resume.mjs            kernel/reduce/verdict.mjs
kernel/compile.mjs                  kernel/probe/stats.mjs             kernel/report/export.mjs
kernel/init/fit.mjs                 kernel/probe/t0.mjs                kernel/report/facts.mjs
kernel/init/run.mjs                 kernel/reduce/board.mjs            kernel/verify/budget.mjs
kernel/lib/argv.mjs                 kernel/reduce/graph.mjs            kernel/verify/dispatch.mjs
kernel/lib/contract.mjs             kernel/reduce/hill.mjs             kernel/verify/envelope.mjs
kernel/lib/paths.mjs                kernel/reduce/ingest.mjs           kernel/verify/ratchet-tree.mjs
kernel/probe/concurrency.mjs        kernel/reduce/leftovers.mjs        kernel/verify/skills.mjs
kernel/probe/digest.mjs             kernel/reduce/ship.mjs             kernel/verify/spec.mjs
kernel/probe/eval.mjs                                                  kernel/verify/t0.mjs
```

By subdirectory (largest contributors first):

| Subdir | Files |
|---|---|
| `kernel/verify/` | 8 |
| `kernel/reduce/` | 8 |
| `kernel/probe/` | 7 |
| `kernel/` (top level: `harness.mjs`, `gate.mjs`, `compile.mjs`) | 3 |
| `kernel/lib/` | 3 |
| `kernel/report/` | 2 |
| `kernel/init/` | 2 |

**Separately, for completeness (v1's 24 excluded these too):**

```
$ find bin -name "*.mjs" -o -name "*.js" | wc -l
2   (bin/init.mjs, bin/lib/grant.mjs)

$ find hooks -name "*.mjs" -o -name "*.js" | wc -l
6   (hooks/dispatch-receipt.mjs, hooks/gate-intake.mjs, hooks/gate-zerowork.mjs,
     hooks/lib/decision.mjs, hooks/safety-spine.mjs, hooks/sandbox-guard.mjs)
```

`kernel` + `bin` + `hooks` combined: **41 executable script files**.

**Verdict: MISS.** 33 (kernel alone) against a "~11" target is not a rounding difference — it is
roughly 3x over. This confirms the operator's informal pre-run pass (33 kernel-only, 41 including
`bin`+`hooks`) exactly; that pass is no longer "unverified" as of this measurement. The largest
contributors are `kernel/verify/` and `kernel/reduce/` (8 each) and `kernel/probe/` (7) — three
subdirectories account for 23 of the 33 files. Whether this surface area is *justified* (each file
maps to one enforcement or projection concern) is a design judgment outside this audit's scope; the
count itself is not in question.

---

## 2 · Permission strings written by `init`

Read directly from `bin/lib/grant.mjs` and `bin/init.mjs` (not re-derived from a memory of what they
do). `pipelineRules()` returns exactly two `Bash` rules, unconditionally — one glob form (`Bash(node
"*/kernel/harness.mjs" *)`) and one bare form (`Bash(node "*/kernel/harness.mjs")`), because Claude
Code's glob matcher requires at least one trailing argument, so the bare invocation needs its own
rule (`grant.mjs`'s own header comment states this explicitly: "TWO rules, because the trailing `
*` requires at least one argument"). Separately, `mergePipelinePermissions()` adds the unscoped
`Workflow` permission string whenever `nativeWorkflow` is true, which `bin/init.mjs` defaults to
(`let ... nativeWorkflow = true`) unless the caller passes `--no-native-workflow`.

Confirmed against a real install, not just the source (`npx shapeup-sdlc init` equivalent — the
real installer run into a fresh git repo, `claude` off `PATH` to force the deterministic merge
path):

```
$ node bin/init.mjs init -d . -y
...
$ cat .claude/settings.json
{
  ...
  "permissions": {
    "allow": [
      "Bash(node \"*/kernel/harness.mjs\" *)",
      "Bash(node \"*/kernel/harness.mjs\")",
      "Workflow"
    ]
  }
}
```

Three distinct permission strings on a default install. With `--no-native-workflow`:

```
$ node bin/init.mjs init -d . -y --no-native-workflow
...
$ cat .claude/settings.json
  "permissions": { "allow": [
    "Bash(node \"*/kernel/harness.mjs\" *)",
    "Bash(node \"*/kernel/harness.mjs\")"
  ] }
```

Two. `tests/structural/22-consumer-install.mjs` (cited at `tests/README.md` §56) already asserts
this precisely and continuously — "the allow-list is exactly what `bin/lib/grant.mjs` emits ... over
at most two Bash rules naming one entry point" — matching what this run just reproduced live, so
this is corroboration of a check that already exists, not a new discovery.

**Verdict: MISS on the literal count.** The plan's target is "1"; a default install writes 3
permission strings, and even the narrowest configuration (`--no-native-workflow`) writes 2, never 1.
What *is* real and substantial: v1's 6 strings came from **3 separate owners** (three different
skills/scripts each granted independently) writing 2 spellings apiece; v2's 2-or-3 strings come from
**1 owner** (the single `kernel/harness.mjs` entry point) — the two Bash rules are two spellings of
the *same* grant, not two different grants, and the `Workflow` token is a new, separately-declared,
opt-out-able capability v1 never had. If "permission strings" is read as "how many distinct owners
need a grant," v2 is a genuine 3→1 reduction and the "~11 (1 entry point)" framing this shares with
row 1 is met. If it is read literally as "how many strings appear in `permissions.allow`," it is 2
or 3, not 1 — recorded as the miss it is, per this stage's own instruction not to redefine a metric
to make a target true after the fact.

---

## 3 · Runtimes owned

```
$ find . -name "run-workflow.mjs" -not -path "./node_modules/*"
(no output)

$ grep -rn "mechEnvelope\|parseMechJson" --include="*.mjs" --include="*.js" . | grep -v node_modules
(no output — zero hits in any executable file)

$ grep -rln "mechEnvelope\|parseMechJson" .
docs/output/shapeuprun.native.js   (historical prose file, not executable, references the pattern
                                     it replaced)
docs/output/PLAN.md                (this document you are reading, describing the deletion)
docs/output/REVIEW-2.md            (the review that recommended the deletion)
```

`run-workflow.mjs` and its courier-pattern helpers (`mech()`, `parseMechJson`, `mechEnvelope`,
`resultFor`/`baseOf`) are absent from every executable file in the repository. The three hits that
remain are historical/narrative documents describing the pattern that used to exist, not code that
runs it.

**Verdict: MATCH.** Target 0, measured 0.

---

## 4 · Hooks

```
$ ls hooks/*.mjs | wc -l
5
$ ls hooks/*.mjs
hooks/dispatch-receipt.mjs  hooks/gate-intake.mjs  hooks/gate-zerowork.mjs
hooks/safety-spine.mjs      hooks/sandbox-guard.mjs
```

Hooks = 5 files under `hooks/` (plus `hooks/lib/decision.mjs`, a shared library, not a registered
hook itself). Separately, walking `hooks.json`'s actual registrations and each hook's own verdict
branches (`grep verdict:` in each file):

| Registration | Event | Deny/block path? |
|---|---|---|
| `hooks/safety-spine.mjs` | `PreToolUse` | yes — `verdict: "deny"` |
| `hooks/gate-intake.mjs` | `PreToolUse` | yes — `verdict: "deny"` |
| `kernel/harness.mjs verify envelope` | `PreToolUse` | yes — `verdict: "deny"` (`kernel/verify/envelope.mjs`'s `deny()` helper, `permissionDecision: "deny"`) |
| `hooks/sandbox-guard.mjs` | `PreToolUse` | yes — `verdict: "deny"` |
| `hooks/gate-zerowork.mjs` | `Stop` | yes — `verdict: "block"` (narrow: only "dispatched, no receipt") |
| `hooks/dispatch-receipt.mjs` | `PostToolUse` | no — only `verdict: "allow"`/`"error"`, records-only |

This matches Phase 5's closure box exactly (`docs/output/PLAN.md`, already committed): "4 hard
`PreToolUse`/`Stop` walls ... (`safety-spine`, `sandbox-guard`, `gate-intake`, `verify envelope` +
`gate-zerowork` as the one blocking `Stop` hook)" — 4 `PreToolUse` denies plus 1 `Stop` block, 5 hard
walls in total, re-derived here from the code rather than trusted from the earlier prose. One of
those 5 (`verify envelope`) is implemented in `kernel/harness.mjs`, not as a file under `hooks/` at
all, which is why the `hooks/` file count (5) and the hard-wall count (5) arrive at the same number
by different arithmetic and neither is literally 4.

**Verdict: MISS**, on both readings, though not a new one. By raw file count, `hooks/` holds 5
`.mjs` files, not 4 — already documented as non-drift in Phase 5's own closure box (`dispatch-receipt`
arrived later, adds no deny path, so the check didn't regress). By "hard wall" count — the reading
probe 7's "4 hard" framing seems to intend — the true number is also 5, not 4: `verify envelope`'s
`PreToolUse` deny is real and load-bearing (it is the WorkOrder schema gate) and was already named
in Phase 5's own parenthetical, just not folded into its headline "4." Neither reading produces 4;
this is recorded plainly rather than picking whichever reading is closer.

---

## 5 · Comment density, shipped JS

v1's number (36% = 3,649 / 10,056) counted comment lines against total lines over the shipped JS
set. Reproduced identically over v2.0's shipped set, read from `package.json`'s `files` allowlist
(not the working tree — `npm pack --dry-run --json` is what actually determines what ships):

```
$ node bin/init.mjs  # (files allowlist, read from package.json directly)
".claude-plugin/", ".claude/settings.local.example.json", ".env.shapeup.example",
"AGENTS.md", "SECURITY.md", "bin/", "commands/", "hooks/", "kernel/", "oracles/", "skills/"

$ npm pack --dry-run --json | node -e '<count .mjs/.js files, comment lines vs total lines>'
shipped .mjs/.js files: 48
total lines: 14361
comment lines: 5882
blank lines: 884
code lines: 7595
comment density (comment/total): 41.0%
```

(A line is counted as a comment line if, after trimming, it is `//`-prefixed, or it opens or
continues a `/* ... */` block; blank lines and code lines are counted separately, consistent with
the total-lines-in-denominator method the v1 figure's phrasing implies.)

By shipped top-level directory:

| Dir | Files | Lines | Comment % |
|---|---|---|---|
| `kernel/` | 33 | 10,493 | 42.1% |
| `hooks/` | 6 | 1,400 | 40.8% |
| `skills/` (workflow script only — the rest of `skills/` is markdown, not counted here) | 1 | 1,369 | 40.0% |
| `oracles/` | 6 | 640 | 23.9% |
| `bin/` | 2 | 459 | 43.1% |

Highest-density individual files: `bin/lib/grant.mjs` 74% (108/145), `kernel/lib/paths.mjs` 71%
(349/491), `hooks/lib/decision.mjs` 68% (137/202), `kernel/verify/ratchet-tree.mjs` 67% (90/134),
`kernel/verify/t0.mjs` 55% (318/580) — the same shape v1's own callout named (`paths.mjs` 70%,
`t0-verify.mjs` 47% then; `paths.mjs` 71%, its successor `kernel/verify/t0.mjs` 55% now — both
still comment-heavy, `paths.mjs` essentially unchanged).

**Verdict: MISS, and in the wrong direction.** 41.0% today vs. 36% in v1.7.0 — comment density on
shipped JS *rose* by 5 points against a plan whose explicit target was to cut it to ~18% ("worth
~1,200 lines and the single largest recoverable block in the repo," per the plan's own Phase 1
text). No file in this measurement was trimmed for this stage — S3's job is measurement, not the
kernel-file-count or comment-diet reduction project the plan's own probe describes; that remains
future work if the operator chooses to act on this finding (see Guardrails: S3 must not widen into
fixing what it finds).

---

## 6 · Shipped LOC

The plan's secondary-metrics table: "Shipped total (`package.json` `files`) | ~24,240 | ~17,000 |
−30%". Measured over every file `npm pack --dry-run --json` reports (the real, reproducible
definition of "what `package.json`'s `files` produces" — includes npm's own automatic additions of
`README.md`, `LICENSE`, `package.json` alongside the explicit allowlist):

```
$ npm pack --dry-run --json | node -e '<sum line counts over every reported file>'
shipped files (npm pack): 136
shipped total lines: 28257

By extension:
  .mjs: 12992   .md: 10941   .json: 2920   .js: 1369   (none): 21   .example: 14

By top-level directory:
  skills: 14252   kernel: 10493   hooks: 1479   oracles: 640   bin: 459
  README.md: 389  commands: 235   SECURITY.md: 94   AGENTS.md: 80   package.json: 47
  .claude-plugin: 34   LICENSE: 21   .claude: 20   .env.shapeup.example: 14
```

Excluding the three files npm adds automatically that are not named in the `files` array itself
(`README.md` 389, `LICENSE` 21, `package.json` 47 = 457 lines) gives **27,800** — the difference
between the two readings (28,257 vs 27,800) is immaterial to the verdict.

Within `skills/` (14,252 lines, the largest single contributor), by skill:

```
tech-lead 5608   ba-pitch-analyzer 3748   spec-evaluator 1549   shapeup 1533
translator 360   qa-edge-hunter 343   orient 263   task-executor 208
coach 202   scope-hammer 186   solution-architect 136   scope-architect 116
```

`tech-lead` + `ba-pitch-analyzer` = 9,356 of 14,252 shipped skill lines (65.7%) — the same two
skills the plan's own Phase 6 framing already identified as the mass concentration ("two skills are
75% of all skill code" pre-consolidation; still the two largest today post-consolidation, at a
lower but still-dominant share).

**Verdict: MISS.** 28,257 (or 27,800 net of npm's automatic additions) against a ~17,000 (±10% =
15,300–18,700) target is roughly 64–66% over, well outside the tolerance band. `skills/` (14,252)
and `kernel/` (10,493) together account for 24,745 of the total — essentially all of the excess.

---

## 7 · The other primary-metrics rows (already closed elsewhere — cited, not re-measured)

Per this stage's own instructions, these three rows are addressed by already-closed phases; only the
orchestrator line count is spot-checked directly since it is a one-line command.

- **Orchestrator script.** Target "≤ 600, zero couriers." Spot-checked directly:
  ```
  $ wc -l skills/tech-lead/workflows/shapeup-run.js
  1369 skills/tech-lead/workflows/shapeup-run.js
  ```
  Matches Phase 6's closure box exactly, which already recorded this same figure ("the workflow
  script (`shapeup-run.js`, 1,369 lines, untouched by this phase)") and reasoned about the gap
  honestly there rather than re-litigating it here — 1,369 is more than double the "≤600" target,
  a standing miss Phase 6 already owned. "Zero couriers" holds (§3 above: no `mechEnvelope`/
  `parseMechJson` anywhere in executable code).
- **Skills requiring any change.** Target "2 of 12." `ls skills/ | wc -l` confirms 12 skills exist
  today, unchanged in count. Phase 6's own framing ("only 2 of 12 skills need work" —
  `tech-lead` and `ba-pitch-analyzer`) already established which two and why; not re-derived here.
- **Sub-agent dispatch.** Target "in-session, prompt-cache-warm" (from "cold `claude -p` per
  worker"). Phase 2's fixes-map entry ("BAD-5 cold sub-agents → Phase 2 → in-session sub-agents,
  prompt-cache-warm") already closed this; §3 above independently confirms the cold-dispatch
  courier pattern (`run-workflow.mjs`, `mech()`) is gone from the repo, which is the mechanism that
  made dispatch cold in v1.

---

## Summary

Six probe-7 metrics measured against the current repository: **1 match** (runtimes owned),
**5 misses** (executable script files, permission strings, hooks, comment density, shipped LOC).
None were redefined, smoothed, or explained away to read as closer to target than the measurement
shows — each carries its derivation command, its literal output, and its largest contributors above.
Whether and how to act on these misses (a kernel-file-count reduction, a comment-diet pass, closing
the permission-string gap further) is out of this stage's scope, per the plan's own guardrail
against widening a verification phase into a fix project; this document's job is the honest number,
not the fix.
