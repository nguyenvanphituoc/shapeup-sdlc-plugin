// t0 — Shape Up's T0 witness: the scope contract layout, where its fixtures and substrate sit, where a
// scope's verdict lands, and the ratchet names, handed to the T0 mechanism in `../core/t0.mjs`.
//
// Usage:  node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" verify t0 <scope-contract.md> --round N --attempt M [--cwd <dir>] [--out <dir>] [--no-ratchet]
import * as core from "../core/t0.mjs";
import { SCOPE_CONTRACT } from "../shapeup/contracts.mjs";
import { snapshot, restore, keptRef } from "../shapeup/ratchet.mjs";
import { runIdFromRoot, localRoot, projectProfile } from "../shapeup/paths.mjs";

/**
 * The feature slug a scope contract belongs to, from its path.
 *
 * Scope contracts live at `shapeup/<slug>/scopes/<id>.md`, so the slug is the segment two levels
 * above the file. Derived rather than flagged because every caller already names the contract, and
 * a second way to say the same thing is a second thing to get wrong.
 *
 * @param {string} contractPath - Path to the scope contract, absolute or relative.
 * @returns {string} The slug, or "" when the path does not have the expected shape — in which case
 *   the caller's `--out` is the only sensible answer and its absence is a usage error.
 */
function slugFromContractPath(contractPath) {
  const parts = String(contractPath).split(/[/\\]/);
  const i = parts.lastIndexOf("scopes");
  return i > 0 ? parts[i - 1] : "";
}


const PROFILE = {
  spec: SCOPE_CONTRACT,
  slugFromPath: slugFromContractPath,
  // WHERE THE VERDICT LANDS: the run trace (local tier), never beside the committed scope contract. The
  // tier split moved scope contracts to the committed tier, so a default derived from the contract's own
  // location silently followed them — verdicts and trial rows were written where the only reader (the
  // probe that asks which scopes are green) never looked, and a real green was invisible. `--out` still wins.
  outRoot: localRoot,
  profilePath: projectProfile,
  unit: (c) => ({ id: c.scope_id, fixtures: c.e2e_verification_fixtures, dbProbe: c.db_probe, substrate: c.allowed_file_substrate }),
  runIdFromRoot,
  ratchet: { snapshot, restore, keptRef },
};

export const ARGV_SPEC = core.ARGV_SPEC;
/** Run the T0 evidence layer for one attempt and write the verdict artifact the judge cites. */
export const cli = (rawArgv) => core.cli(rawArgv, PROFILE);
