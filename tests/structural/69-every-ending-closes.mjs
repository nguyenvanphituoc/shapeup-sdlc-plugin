// 69 — EVERY ENDING RECORDS A CLOSE. Section 112.
//
// THE HOLE THIS CLOSED. A run script's two top-level terminal returns — a fast-forward derivation coming
// back empty and a red spec-lint before BUILD — constructed a return value directly, never through the
// helper that closed the run. Both are ordinary outcomes AGENTS.md documents, both were green across 1804
// checks, and both meant the close never ran: the ledger stayed open, `closed_at`/`close_cause` stayed `~`,
// and the ledger was byte-identical to a live run. A source-level guard then scanned the script,
// by line-anchored patterns and mutation tests, for any terminal return that was not wrapped.
//
// RETIRED WITH THE SCRIPT, and why it is safe to. The helper, the return union and the file the scan read
// are gone; a source scan over a file that does not exist protects nothing. The PROPERTY it protected —
// no ending is left without a recorded close — is checked where it now lives, and executed rather than
// pattern-matched:
//   (1) every terminal step `probe next` returns, over every planted row of the state-machine suite that
//       reaches one, carries a `probe resume --close-arm <arm>` command (the check sits in that suite's
//       row loop, so a new terminal path is covered the day it gets a row);
//   (2) the arm map those commands name is total over the arms `probe next` uses (section 71, 115), and
//       a close writes status, cause and `closed_at` together (section 67).
// Both are cited below by their names, so a rename or a deletion fails this module.
import { pinnedBy } from "../lib/pinned-row.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Run the every-ending-closes checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("112. Every terminal ending carries a close — executed over `probe next`, not read out of a script");
  pinnedBy(ctx, ["every terminal step among the", "L4 hold on the main path aborts; on a breaker it escalates", "cannot-ship on the main path aborts at H before the gate is shown"],
    "every terminal step carries a close command, and the L4 and census endings close as aborted or escalated by path");
  const sources = ["tests/structural/71-close-arms.mjs", "tests/structural/67-terminal-closeout.mjs"]
    .filter((f) => !readFileSync(join(ROOT, f), "utf8").length);
  if (!sources.length) ok("the arm map and the close's own facts each have their own module (sections 71, 67)");
  else fail(`empty close modules: ${sources.join(", ")}`);
}
