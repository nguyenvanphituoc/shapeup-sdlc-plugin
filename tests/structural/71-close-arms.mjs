// 71 — A RUN IS CLOSED THROUGH A DERIVED MAP OF ARMS, not a hand-typed pair. Sections: 115, 116, 117.
//
// THE DEFECT, as it stood when a run script held the call. Its close helper opened with
// `if (ret.status !== "aborted" && ret.status !== "shipped") return;` — a literal pair that referenced
// `TERMINAL_STATUSES` zero times, so it could not see that the run's return union carried more arms than
// two. `gate_h`, which AGENTS.md makes the DESIGNED ending for a run a circuit breaker stopped ("Budget
// trips route to GATE H — ship what's green"), recorded nothing on the ledger.
//
// THE MAP. `CLOSE_ARM_STATUS` (kernel/probe/resume.mjs) maps each arm a close command names to the status
// closing means for it, and `closeArm` performs the close. The arms a close is asked for are the ones
// `probe next` writes into its close commands (`probe resume --close-arm <arm>`), so this module DERIVES
// its arm list from that source rather than a literal array here: a test that hand-lists today's arms
// stays silently green the day a new arm is added to `probe next` with no map entry — the defect class
// this module exists to close, reopened inside its own guard.
//
// RETIRED with the run script, and why. The union the map was derived from (`RunReturn`, with its `paused`
// and `ok` arms) no longer exists: nothing returns across a launch boundary now, a gate is answered where
// it is reached, and a pause records no close because there is no relaunch to resume. The two non-terminal
// arms and the script call-site checks (117) retire with it; what 117 protected — that the caller hands the
// kernel an ARM and does not decide terminality itself — is checked below against `probe next`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Run the close-arm checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  const { CLOSE_ARM_STATUS, TERMINAL_STATUSES, closeArm } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const next = readFileSync(join(ROOT, "kernel/probe/next.mjs"), "utf8");

  // ===============================================================================================
  section("115. Every arm `probe next` closes a run with is mapped — derived, not listed here");
  // ===============================================================================================
  const arms = [...new Set([...next.matchAll(/closeCmd\("(\w+)"/g)].map((m) => m[1]))];
  if (arms.length >= 3) ok(`(a) read ${arms.length} close arm(s) off the state machine's own close commands: ${arms.join(", ")}`);
  else fail(`(a) read only ${JSON.stringify(arms)} off kernel/probe/next.mjs — the derivation is blind`);

  const unmapped = arms.filter((a) => !Object.hasOwn(CLOSE_ARM_STATUS, a));
  if (arms.length && unmapped.length === 0) ok(`(b) every arm (${arms.join(", ")}) is a key of CLOSE_ARM_STATUS — none is left to fall through as "undefined, and nobody noticed"`);
  else if (unmapped.length) fail(`(b) CLOSE_ARM_STATUS does not map: ${unmapped.join(", ")} — an arm the loop closes with that this kernel cannot close correctly`);

  // ===============================================================================================
  section("116. The map's own content — the breaker travels in the cause, never as a new status");
  // ===============================================================================================
  for (const [arm, wantStatus] of [["shipped", "shipped"], ["aborted", "aborted"], ["gate_h", "escalated"]]) {
    if (CLOSE_ARM_STATUS[arm] === wantStatus) ok(`(a) CLOSE_ARM_STATUS.${arm} === "${wantStatus}"`);
    else fail(`(a) CLOSE_ARM_STATUS.${arm} is ${JSON.stringify(CLOSE_ARM_STATUS[arm])}, expected "${wantStatus}"`);
  }

  // ANTI-GAMING GUARD: the cheap wrong fix is a new TERMINAL_STATUSES member instead of a map entry.
  if (Array.isArray(TERMINAL_STATUSES) && TERMINAL_STATUSES.length === 3 && !TERMINAL_STATUSES.includes("gate_h")) {
    ok(`(b) TERMINAL_STATUSES is still exactly [${TERMINAL_STATUSES.join(", ")}] — gate_h was mapped to escalated, not added as a member`);
  } else fail(`(b) TERMINAL_STATUSES has widened: ${JSON.stringify(TERMINAL_STATUSES)} — gate_h must close AS escalated, never become a status of its own`);

  // closeArm on an arm the map does not carry is refused outright, never silently skipped.
  const bogus = closeArm(ROOT, "no-such-slug-71", "definitely-not-a-real-arm", null);
  if (bogus.ok === false && bogus.terminal === undefined) ok("(c) closeArm refuses an arm that is not a key of CLOSE_ARM_STATUS at all");
  else fail(`(c) closeArm did not refuse an unmapped arm: ${JSON.stringify(bogus)}`);
  for (const gone of ["paused", "ok"]) {
    if (!Object.hasOwn(CLOSE_ARM_STATUS, gone)) ok(`(d) "${gone}" is not an arm: there is no launch boundary left for a non-terminal return to cross`);
    else fail(`(d) CLOSE_ARM_STATUS still carries the retired non-terminal arm "${gone}"`);
  }

  // The checker's own negative case, proven directly: the predicate from 115(b) applied to an arm list
  // carrying one synthetic entry no map has heard of must name exactly that arm.
  const synthetic = [...arms, "zzz_unmapped_synthetic"].filter((a) => !Object.hasOwn(CLOSE_ARM_STATUS, a));
  if (synthetic.length === 1 && synthetic[0] === "zzz_unmapped_synthetic") ok("(e) the same derivation, run over a list carrying one synthetic unmapped arm, names exactly that arm");
  else fail(`(e) the derivation did not flag a synthetic unmapped arm: ${JSON.stringify(synthetic)}`);

  // ===============================================================================================
  section("117. The state machine hands the kernel an ARM — it never decides terminality itself");
  // ===============================================================================================
  const direct = [...next.matchAll(/probe resume --slug \$\{slug\} --close\b(?!-arm)/g)].length;
  const armForm = [...next.matchAll(/--close-arm \$\{arm\}/g)].length;
  if (armForm >= 1 && direct === 0) ok("(a) every close a step carries is `probe resume --close-arm <arm>` — the arm, not a status `probe next` decided was terminal");
  else fail(`(a) probe next carries ${direct} direct \`--close <status>\` command(s) and ${armForm} arm-form one(s) — terminality must be the kernel's call`);
  if (!/ret\.status\s*!==\s*["']aborted["']/.test(next)) ok("(b) the hand-typed \"aborted\"/\"shipped\"-only guard is not reintroduced");
  else fail("(b) probe next carries a hand-typed two-status terminality guard");
}
