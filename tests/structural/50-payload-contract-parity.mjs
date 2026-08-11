// Structural module — payload registry ↔ worker input contract parity.
// Section: 50. Byte-identical body style to its siblings; the runner threads the shared ctx.
//
// What this module is for. `domain.schema.json`'s `x-payload-by-worker` registry says which
// WorkOrderPayload fields each worker may rely on, and its own description claims the list is
// "per its SKILL.md input contract". Two edges of that triangle were already enforced —
// §24 (05-tech-lead.mjs) checks registry ↔ schema, and §21 checks producer ↔ schema — but the
// edge the description actually asserts, registry ↔ the worker's own prose, was checked by
// nothing. So `trial_history` could be registered for task-executor, compiled into every build
// order by compile-order.mjs, and simultaneously invisible to the worker whose input table is
// headed "anything absent = unknown; never invent it". The worker was handed the ratchet's
// inspect() and never told to read it: the tree ratcheted mechanically while the REASONING did
// not, so a scope could re-propose a change its own trial rows already recorded as reverted.
//
// This closes the triangle. It converts that class of defect into a build failure rather than
// fixing the one instance — a field is not delivered until the worker is told it exists.

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Run the payload-contract parity checks.
 * @param {object} ctx - Shared structural-test context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when every check in section 50 has been recorded on ctx.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  // =============================================================================
  section("50. Every payload field a worker is handed is declared in its own input contract");
  // =============================================================================

  const domain = readJSON(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"));
  const registry = domain["x-payload-by-worker"];
  if (!registry) {
    fail("domain.schema.json has no x-payload-by-worker registry");
    return;
  }

  let workersChecked = 0;
  for (const [worker, fields] of Object.entries(registry)) {
    if (!Array.isArray(fields)) continue; // skips the `description` key
    const rel = `skills/${worker}/SKILL.md`;
    const p = join(ROOT, rel);
    if (!existsSync(p)) {
      // A registry entry naming a worker with no skill on disk is its own drift.
      fail(`x-payload-by-worker registers "${worker}" but ${rel} does not exist`);
      continue;
    }
    workersChecked++;
    const txt = read(p);
    // The house form is the qualified one — `payload.<field>` — used by every worker's input
    // contract. Requiring it (not the bare name) is deliberate: "feature" or "ledger" occurs in
    // ordinary prose in most of these files, so a bare-name check would pass on a field the
    // contract never actually declares.
    const undeclared = fields.filter((f) => !txt.includes(`payload.${f}`));
    if (undeclared.length) {
      fail(`${rel} never declares ${undeclared.map((f) => `payload.${f}`).join(", ")} — but compile-order may hand it over, and the worker's own contract says anything absent is unknown`);
    } else {
      ok(`${worker} declares all ${fields.length} of its registered payload fields`);
    }
  }

  if (workersChecked > 0) ok(`payload contract parity checked for ${workersChecked} workers`);
  else fail("x-payload-by-worker listed no workers — the parity check was vacuous");
}
