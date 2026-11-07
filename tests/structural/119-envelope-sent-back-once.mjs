// A PHASE THAT WROTE ITS ARTIFACTS AND NO WORKRESULT IS SENT BACK ONCE.
//
// The orient leg did its craft and skipped its last step — no WorkResult, no leg row — on three runs of
// one consumer, across releases. The phase stood on its artifacts and the close named the order
// unanswered, which is honest and still leaves the run's own record of the phase empty. The worker is
// dispatched again, once, told its artifacts stand; only a second miss is named at the close.
//
// This module used to execute the retired run script's own `requireLeg` over a scripted ledger. That
// function is gone with the script; the rule is a branch of `probe next`, and its four cases are rows of
// the state-machine suite. The module keeps one job: to prove those rows exist under the names this file
// cites, so the property cannot lose its pin by a rename.
import { pinnedBy } from "../lib/pinned-row.mjs";

/**
 * Run the send-back checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { section } = ctx;
  section("173. A phase whose leg returned no WorkResult is dispatched again once, then named");
  pinnedBy(ctx, ["orient artifacts with a receipt and no WorkResult send the envelope back once"], "(a) a leg with a receipt and no WorkResult is dispatched again once, told its artifacts stand");
  pinnedBy(ctx, ["an orient envelope already sent back once is not sent back again", "an unanswered order is named at every close"], "(b) a second miss is not sent back again — it is named unanswered at the close");
  pinnedBy(ctx, ["orient artifacts with no receipt and no WorkResult are not sent back"], "(d) an order with no receipt is not sent back — the worker never ran, and that is a different failure");
}
