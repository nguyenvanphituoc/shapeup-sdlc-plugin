// 71 — HD-026, defect-plan-3.7 Stage 1: `RunReturn` closes the run through a derived map, not a
// hand-typed pair. Sections: 115, 116, 117.
//
// THE DEFECT. `closeIfTerminal` (skills/tech-lead/workflows/shapeup-run.js:989) opened with
// `if (ret.status !== "aborted" && ret.status !== "shipped") return;` — a literal pair that
// referenced `TERMINAL_STATUSES` (kernel/probe/resume.mjs) zero times, so it could not see that the
// schema's RunReturn union carries FIVE arms, not two: `shipped`, `paused`, `aborted`, `gate_h`,
// `ok` (`$defs/RunReturn.properties.status.enum`, kernel/schemas/domain.schema.json). Two of them
// recorded nothing on the ledger — `gate_h`, which AGENTS.md makes the DESIGNED ending for a run a
// circuit breaker stopped ("Budget trips route to GATE H — ship what's green"), and `escalated`,
// which the kernel itself already calls terminal (TERMINAL_STATUSES) but which no RunReturn arm
// ever names directly.
//
// THE FIX. `RUN_RETURN_CLOSE` (kernel/probe/resume.mjs) maps every arm to what closing means for
// it — a terminal status, or `null` for an arm the plan explicitly marks non-terminal (`paused`
// resumes on relaunch; `ok` is one inner round finishing, not the run) — and `closeArm` performs
// the close when the map says to. `closeIfTerminal` now hands the kernel the arm itself
// (`probe resume --close-arm <ret.status>`) instead of deciding terminality locally.
//
// WHY THIS MODULE DERIVES ITS ARM LIST FROM THE SCHEMA, NEVER FROM A LITERAL ARRAY HERE. A test
// that hand-lists the five current arms would pass today and stay silently green the day a sixth
// arm is added to the schema with no corresponding kernel-map entry — the exact defect class this
// stage exists to close, reopened one layer up, inside its own guard. Section 115 re-reads
// `domain.schema.json` on every run and checks EVERY arm it finds there, so an arm nobody has
// mapped yet is a fact this check discovers, not a fact it would have to be told to look for.
//
// WHY THE ORCHESTRATOR'S OWN CALL SITE GETS A SEPARATE, SOURCE-LEVEL CHECK (117). Nothing in the
// contract's acceptance table can execute `shapeup-run.js` — it is a Workflow body with no exports,
// runnable only by the native runtime (58-relaunch-memory.mjs's own banner has the full argument) —
// so every fixture drives `kernel/probe/resume.mjs` directly. That proves the KERNEL derivation is
// correct; it proves nothing about whether the orchestrator's own call site still uses it. 69's own
// banner records exactly this shape of gap once already: a mechanism fixed correctly while the one
// call site that was supposed to invoke it drifted back to the literal it replaced.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  const { RUN_RETURN_CLOSE, TERMINAL_STATUSES, closeArm } = await import(join(ROOT, "kernel/probe/resume.mjs"));

  // ===============================================================================================
  section("115. Every RunReturn arm the SCHEMA carries today is mapped — derived, not listed here");
  // ===============================================================================================
  const schema = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
  const arms = schema?.$defs?.RunReturn?.properties?.status?.enum;

  if (Array.isArray(arms) && arms.length >= 4) {
    ok(`(a) read ${arms.length} RunReturn arm(s) off the live schema: ${arms.join(", ")}`);
  } else {
    fail(`(a) could not read a plausible RunReturn.status.enum off kernel/schemas/domain.schema.json — got ${JSON.stringify(arms)}`);
  }

  const unmapped = (arms || []).filter((a) => !Object.hasOwn(RUN_RETURN_CLOSE, a));
  if ((arms || []).length && unmapped.length === 0) {
    ok(`(b) every schema arm (${(arms || []).join(", ")}) is a key of RUN_RETURN_CLOSE — none is left to fall through as "undefined, and nobody noticed"`);
  } else if (unmapped.length) {
    fail(`(b) RUN_RETURN_CLOSE does not map: ${unmapped.join(", ")} — a RunReturn arm this kernel cannot close correctly`);
  }

  // The schema's own enum must still carry `ok` as a fifth, non-terminal arm — the operator
  // correction this contract pins (the plan's own draft text claimed only four arms existed).
  if ((arms || []).includes("ok") && (arms || []).length === 5) {
    ok("(c) the schema's RunReturn union still carries exactly 5 arms, including \"ok\" — the operator correction this stage was briefed against");
  } else {
    fail(`(c) RunReturn.status.enum no longer reads as the 5-arm union this stage was briefed against: ${JSON.stringify(arms)}`);
  }

  // ===============================================================================================
  section("116. The map's own content — operator decision 1, and the two non-terminal arms");
  // ===============================================================================================
  const pins = [
    ["shipped", "shipped"],
    ["aborted", "aborted"],
    // Operator decision 1 (defect-plan-3.7's execution contract): the breaker that tripped travels
    // in close_cause, never as a new status.
    ["gate_h", "escalated"],
  ];
  for (const [arm, wantStatus] of pins) {
    if (RUN_RETURN_CLOSE[arm] === wantStatus) {
      ok(`(a) RUN_RETURN_CLOSE.${arm} === "${wantStatus}"`);
    } else {
      fail(`(a) RUN_RETURN_CLOSE.${arm} is ${JSON.stringify(RUN_RETURN_CLOSE[arm])}, expected "${wantStatus}"`);
    }
  }
  for (const arm of ["paused", "ok"]) {
    if (Object.hasOwn(RUN_RETURN_CLOSE, arm) && !RUN_RETURN_CLOSE[arm]) {
      ok(`(b) RUN_RETURN_CLOSE.${arm} is present and falsy — explicitly non-terminal, not an omission`);
    } else {
      fail(`(b) RUN_RETURN_CLOSE.${arm} is ${JSON.stringify(RUN_RETURN_CLOSE[arm])} — expected a present, falsy (non-terminal) entry`);
    }
  }

  // ANTI-GAMING GUARD — operator decision 1's other half: the cheap wrong fix to HD-026 is a new
  // TERMINAL_STATUSES member instead of a map entry. It must not have widened.
  if (Array.isArray(TERMINAL_STATUSES) && TERMINAL_STATUSES.length === 3 && !TERMINAL_STATUSES.includes("gate_h")) {
    ok(`(c) TERMINAL_STATUSES is still exactly [${TERMINAL_STATUSES.join(", ")}] — gate_h was mapped to escalated, not added as a member`);
  } else {
    fail(`(c) TERMINAL_STATUSES has widened: ${JSON.stringify(TERMINAL_STATUSES)} — gate_h must close AS escalated, never become a status of its own`);
  }

  // closeArm on an arm the map does not carry at all (never an omission this checker should read as
  // "fine") is refused outright — distinct from the falsy-but-present non-terminal case above.
  const bogus = closeArm(ROOT, "no-such-slug-71", "definitely-not-a-real-arm", null);
  if (bogus.ok === false && bogus.terminal === undefined) {
    ok("(d) closeArm refuses an arm that is not a key of RUN_RETURN_CLOSE at all, rather than silently treating it as non-terminal");
  } else {
    fail(`(d) closeArm did not refuse an unmapped arm: ${JSON.stringify(bogus)}`);
  }

  // THE CHECKER'S OWN NEGATIVE CASE, proven directly rather than assumed: the exact predicate
  // section 115(b) runs, applied to a schema arm list carrying one synthetic entry no map on this
  // page has ever heard of. The real schema file is never touched — this is what the acceptance
  // contract's own live mutation (editing kernel/schemas/domain.schema.json and re-running the
  // whole suite) exercises for real; this proves the predicate itself is capable of catching it.
  const syntheticArms = [...(arms || []), "zzz_unmapped_synthetic"];
  const syntheticUnmapped = syntheticArms.filter((a) => !Object.hasOwn(RUN_RETURN_CLOSE, a));
  if (syntheticUnmapped.length === 1 && syntheticUnmapped[0] === "zzz_unmapped_synthetic") {
    ok("(e) the same derivation, run against a schema enum carrying one synthetic unmapped arm, names exactly that arm — the mutation this stage's acceptance drives for real would turn (b) above red");
  } else {
    fail(`(e) the derivation did not flag a synthetic unmapped arm: ${JSON.stringify(syntheticUnmapped)}`);
  }

  // ===============================================================================================
  section("117. The orchestrator's own call site delegates to the kernel — source-level, since shapeup-run.js cannot be executed here");
  // ===============================================================================================
  const runJs = read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"));

  // The fixed shape: closeIfTerminal calls --close-arm, handing the kernel the RunReturn arm itself.
  if (/--close-arm\s+\$\{ret\.status\}/.test(runJs)) {
    ok("(a) closeIfTerminal calls \"probe resume --close-arm ${ret.status}\" — the arm, not a status this file decided was terminal");
  } else {
    fail("(a) closeIfTerminal no longer calls --close-arm with ret.status — the orchestrator may have drifted back to deciding terminality locally");
  }

  // The regression this section exists to catch: the literal two-status guard HD-026 measured,
  // reintroduced anywhere in the file (not just at its original line — a careless merge could
  // resurrect it as a new early return rather than exactly where it used to live).
  const oldGuardRe = /ret\.status\s*!==\s*["']aborted["']\s*&&\s*ret\.status\s*!==\s*["']shipped["']/;
  if (!oldGuardRe.test(runJs)) {
    ok("(b) the old hand-typed \"aborted\"/\"shipped\"-only guard is gone from shapeup-run.js entirely");
  } else {
    fail("(b) shapeup-run.js still carries the old \"ret.status !== aborted && ret.status !== shipped\" guard HD-026 was filed against");
  }

  // closeIfTerminal must still run unconditionally for every top-level RunReturn (paused included)
  // — it is the KERNEL that now decides non-terminality, not an early return in this file, which is
  // what makes `paused` an explicit, driven row (Stage 1's acceptance) rather than an omission this
  // file encodes a second time.
  const fnMatch = runJs.match(/async function closeIfTerminal\(ret\) \{([\s\S]*?)\n\}\n/);
  if (fnMatch && !/^\s*if \(ret\.status/.test(fnMatch[1].trimStart())) {
    ok("(c) closeIfTerminal's body no longer opens on a local ret.status terminality check — every arm reaches the kernel call");
  } else {
    fail(`(c) closeIfTerminal appears to still gate on ret.status locally before calling the kernel: ${fnMatch ? fnMatch[1].slice(0, 120) : "function not found"}`);
  }
}
