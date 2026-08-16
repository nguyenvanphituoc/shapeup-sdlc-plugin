---
type: gate-h-report
feature: todo-cli
order_id: todo-cli/hammer
run_id: todo-cli-20260815T171521Z-b135247d
worker: scope-hammer
breaker: outer
generated_at: 2026-08-16
---

# GATE H — Scope Hammer report: `todo-cli`

Trigger: outer circuit breaker (`round_budget` of 2 reached 0), per
`.shapeup/todo-cli/orders/hammer.json` (`payload.breaker: "outer"`).

## Sources consulted

- Order payload `trial_history` (12 entries, rounds 1–2, 6 scopes, all `kept`, 0 regressions).
- `shapeup/todo-cli/hill/*.yml` — hill phase per scope.
- `.shapeup/todo-cli/evaluation/EVAL-FEATURE-todo-cli.md`, `results/evaluate-r1.json`,
  `results/evaluate-r2.json`, `.verdicts-evaluate.jsonl`, `.verdicts-evaluate-r2.jsonl` — the
  **actual** spec-evaluator FAIL reports for both rounds.
- `.shapeup/todo-cli/discovery/ledger.md` — 4 discovered-task entries.
- `.shapeup/todo-cli/harness-run.md` — tech-lead's run log (contains a stale claim, see flag
  below).
- Direct read of `bin/todo.js`, `package.json`; independent repro of every EVAL-reported bug and
  an independent `npm test` / `node --test test/` run (51/51 pass via the project's actual
  script; the bare directory form still throws `MODULE_NOT_FOUND`, confirming the ledger note).
- No `qa-edge-hunter` hunt-report exists — the run never reached a PASS gate to trigger it, so QA
  findings are empty for this census.

### Flag — harness-run.md is stale

`.shapeup/todo-cli/harness-run.md`'s "Escalation" section claims spec-evaluator never ran in
either round ("no `EVAL-FEATURE-todo-cli.md` exists"). That is **not** true of the repo's current
state: `results/evaluate-r1.json` (`status: done`), `results/evaluate-r2.json`
(`status: partial`), and `.shapeup/todo-cli/evaluation/EVAL-FEATURE-todo-cli.md` all exist with
substantive, citation-backed FAIL verdicts (26 criteria probed against the live app each round,
T0 artifacts re-hashed from disk). This census uses that real data. Recommend tech-lead reconcile
the run log before formally closing the round.

---

## GATE H0 — Census

**Must-have (unresolved): 3** — all traced to the pitch's explicitly-named edge cases ("bad
index", "corrupted store file", "behave sanely at the edges"), all confined to two functions in
one file.

| # | Item | Location | Source | Confirmed independently |
|---|------|----------|--------|--------------------------|
| BUG-1 | `cmdDone` calls `repo.load()` before validating the index, so a simultaneous corrupted-store + missing-index case reports "store corrupted" instead of the spec's "missing index, no store access attempted" | `bin/todo.js:60-77` | EVAL r1 + r2 (FAIL, high confidence, reprobed) | yes — repro reproduced identically |
| BUG-2 | Same ordering bug in `cmdRm` | `bin/todo.js:92-109` | EVAL r1 + r2 (FAIL, high confidence, reprobed) | yes |
| BUG-3 | `cmdRm` prefixes the internal error code (`E_INVALID_INDEX - `, etc.) onto all three index-error messages, diverging from the Error Catalog's exact string (and from `cmdDone`, which renders correctly) | `bin/todo.js:106` | EVAL r1 + r2 (FAIL, covers 3 of 5 failing criteria) + discovery ledger (`remove-todo-r2-a1`) | yes |

**Nice-to-have (~): 5**

| # | Item | Location | Source |
|---|------|----------|--------|
| BUG-4 | `cmdAdd` appends `(E_MISSING_TEXT)` to the missing-text message; graded PASS today as a superset of the catalog string, but same code-leak pattern as BUG-3 | `bin/todo.js:12` | EVAL |
| SD-1 | Committed spec self-contradicts on Done/Removed message quoting (`ux-behavior.md` unquoted vs. UC docs quoted); build follows the quoted form consistently — a spec authoring defect, not a build bug | `shapeup/todo-cli/spec/ux-behavior.md` vs. UC docs | EVAL |
| SD-2 | Spec vs. build disagree on whether the corrupted-store message renders the literal `~/.todo.json` or the resolved absolute path; build always resolves the absolute path, consistently | `lib/todo-repository.js:50,54` | EVAL + discovery ledger (`complete-todo-r2-a1`) |
| — | `node --test test/` (bare directory form) throws `MODULE_NOT_FOUND` on Node v24.15.0 — pre-existing Node/npm-scripts interaction, not a todo-cli defect. The project's real `npm test` script uses a glob (`test/**/*.test.js`) and passes cleanly (independently reverified: 51/51 green) | tooling | discovery ledger (3 entries: `remove-todo-r1-a1`, `cli-integration-test-r1-a1`, `add-todo-r1-a1`) |
| — | `bin-scaffold.test.js` "list reaches its stub branch" — ledger flagged a conflict with `list.test.js` as of `remove-todo-r1-a1`; independently reverified now: this assertion currently **passes** in the full `npm test` run. Appears already resolved — recorded for audit trail only, not carried forward as an open item | `test/bin-scaffold.test.js` | discovery ledger (`remove-todo-r1-a1`) |

**Carry candidates:** all 6 scopes (`foundation`, `add-todo`, `list-todos`, `complete-todo`,
`remove-todo`, `cli-integration-test`) are hill-phase `DOWNHILL_EXECUTION` rather than formally
`FINISHED` — `round_budget` (2) hit 0 before a round could close the bookkeeping loop. This is a
process gap, not an unknowns gap: every scope is T0-green with 0 regressions in both rounds, and
two full spec-evaluator passes (round 1 and round 2, both real, both FAIL) converged on exactly
the 3 must-have bugs above. Breakdown: `foundation`, `add-todo`, `list-todos`,
`cli-integration-test` carry zero EVAL findings; `complete-todo` carries BUG-1; `remove-todo`
carries BUG-2 + BUG-3. No inner (attempt-budget) breaker proposals exist for this order — this is
purely the outer `round_budget` breaker.

---

## GATE H1 — Baseline Comparison

**Baseline:** no `shapeup/todo-cli/shaping/baseline.md` exists (no `shaping/` directory at all)
— degrading honestly to the pitch's problem statement as the implicit baseline, per
`.shapeup/todo-cli/intake.md`: *"Developers keep todos in their head and lose them."*
**Comparison below is approximate, not first-class.**

For each must-have item: with it left unfixed, is `todo-cli` still strictly better than "keeping
todos in your head" for the pitch's core problem?

- **BUG-1 / BUG-2** (wrong error-message precedence on the compound corrupted-store +
  missing-index case) — **YES**. In every observed case the CLI still exits 1, prints one clear,
  truthful line (the store genuinely is corrupted), and never crashes or leaves a stack trace.
  The pitch's actual bar — *"a CLI that crashes on a typo is worse than no CLI"* — is met; this
  is a spec-ordering nuance on a narrow compound edge case, not a sanity violation. **Safe to
  cut/carry.**
- **BUG-3** (rm error messages carry an extra machine-code prefix) — **YES**. The message is
  still one accurate stderr line with exit 1 (`Error: E_INVALID_INDEX - "abc" is not a valid
  index"` vs. spec's `Error: "abc" is not a valid index`) — arguably more diagnostic, not less
  safe. **Safe to cut/carry.**
- All 5 nice-to-have items never block H1 by construction — cut-list candidates.

**Ship-blocking (H1.2 = NO): none.** No must-have item leaves the product worse than the
baseline.

---

## GATE H2 — Cut List & Verdict

```
Baseline      : approximate — shaping/baseline.md absent, compared against the pitch's problem
                statement (intake.md)
Ship-blocking : none
Proposed cuts : 8 (3 cuttable must-have + 5 nice-to-have)
                - BUG-1  (cmdDone load/validate ordering)      — carry; narrow compound edge
                  case, doesn't crash or mislead the operator
                - BUG-2  (cmdRm load/validate ordering)        — carry; same reasoning
                - BUG-3  (cmdRm error-code prefix)              — carry; cosmetic wording
                  divergence, message stays accurate and safe
                - BUG-4  (cmdAdd error-code suffix)             — carry; already passes today as
                  a superset
                - SD-1   (spec self-contradiction on quoting)   — carry as a spec-fix task, not
                  a code bug
                - SD-2   (spec vs. build path rendering)        — carry as a spec-fix task
                - node --test test/ dir-form MODULE_NOT_FOUND   — carry; tooling quirk, npm test
                  itself unaffected
                - bin-scaffold.test.js stub-branch note         — no action; independently
                  reverified as already resolved; recorded for audit trail only
Carry-forward : BUG-1, BUG-2, BUG-3, BUG-4, SD-1, SD-2, node --test dir-form quirk (7 items to
                the discovery ledger as debt-free raw ideas for next cycle; the bin-scaffold note
                is excluded — already resolved, nothing to carry)
Verdict       : SHIP now
```

**Why SHIP now:** all 6 scopes are T0-green with 0 regressions across both rounds; two
independent spec-evaluator passes (round 1 and round 2, both genuinely executed, both FAIL)
converged on exactly 3 concrete, narrowly-scoped, non-crashing bugs, all confined to
`bin/todo.js`'s `cmdDone`/`cmdRm`; none fail the baseline comparison; no ship-blocking item
exists. `round_budget` is exhausted and the product already clears its own baseline — continuing
to build against a perfect reading of the spec (rather than the pitch's actual "behave sanely,
don't crash" bar) is exactly the perfectionism step 11 exists to cut off.

**PO confirmation:** this run's `gate_answers` preset is `ci` (`interaction.pause_gates: false`
on this order), which per `.shapeup/todo-cli/harness-run.md`'s own decisions-log convention
mechanically resolves `GATE H → accept-cut-list`. This report is the proposal backing that
resolution — scope-hammer does not itself finalize SHIP; that is tech-lead's authority at GATE
L4, using this report and the decisions log.

**Known gap to log in the ship report (not hidden):** BUG-1, BUG-2, BUG-3 are real,
independently-confirmed defects on documented edge cases the pitch calls out by name (bad index,
corrupted store). They do not block shipping per the baseline test above, but they should be
named explicitly in the ship report / next-cycle backlog rather than silently forgotten.
