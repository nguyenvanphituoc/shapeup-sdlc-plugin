// Structural test module: what a run must NOT keep only in memory. Section: 92.
//
// THE DEFECT CLASS. The run script that used to drive a run held its census and its green set in
// variables, and a gate PAUSE was a `return`: the PO's answer started a FRESH LAUNCH, every accumulator
// began empty while the round loop fast-forwarded past the rounds that filled it, and the cut list the PO
// saw came back empty. The script could be reached only by reading its source, and this module read it:
// the census was re-derived from the run graph's own green_scopes_by_round, a scope that turned green left
// the cut list, the census de-duplicated, and a RESUMED scope was still asked whether its work reached the
// board.
//
// THE RULE those checks encoded — RE-DERIVE IT FROM DISK AT EVERY ASK — is now structural rather than
// remembered: `probe next` is read-only and stateless, so there is nowhere in memory for a census to live.
// The script is retired; each former check, ported or retired:
//
//   (a) the census is rebuilt from the graph at each launch   PORTED   the state-machine suite asks every
//       planted row TWICE over the same tree and fails on any row whose second answer differs ("asked twice");
//       the census inputs are derived from the leg ledger, the T0 verdicts and `probe attempts`, never carried.
//   (a') a now-green scope leaves the cut list; no inflation  PORTED   row "the stop step is an activity: it
//       names the resource, the three probe commands…" and "with no scope in proposal the stop step hands out
//       no attempts probe": proposals are derived each ask, so a scope that went green cannot still be one.
//   (b) a RESUMED scope is still asked whether its work was applied   PORTED   rows "a settled green round runs
//       its build gate once, late-ingesting an unapplied green result first" and "a green T0 with no WorkResult
//       envelope is red, not green (the scope is released again)".
//   (b') the confirm stage's order; a dead leg's result is still asked about   RETIRED  the stage was a closure
//       of the script; the same questions are the kernel's own, asked before any verdict on the scope.
import { pinnedBy } from "../lib/pinned-row.mjs";

/**
 * Run the relaunch-memory checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { section } = ctx;
  section("92. Orchestration state a relaunch must not lose");
  pinnedBy(ctx, ["asked twice over the same tree", "the stop step is an activity", "with no scope in proposal the stop step hands out no attempts probe"],
    "(a) the census's inputs are derived on every ask, so a scope that turned green cannot still be a cut-list candidate");
  pinnedBy(ctx, ["a settled green round runs its build gate once", "a green T0 with no WorkResult envelope is red"],
    "(b) a resumed scope is still asked whether its work reached the board before any verdict on it");
}
