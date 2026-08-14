// runHook — give `allow` a receipt.
//
// WHY THIS FILE EXISTS (reproduced by executing the shipped hooks, not theorized).
//
// Every enforcement tool's FAILURE signature was identical to its SUCCESS signature. Fed malformed
// input, every gate in this repo answered the same way:
//
//     $ echo 'NOT JSON AT ALL {{{' | node hooks/<gate>.mjs
//     gate-zerowork      exit=0   stdout_len=0
//     sandbox-guard      exit=0   stdout_len=0
//     safety-spine       exit=0   stdout_len=0
//     gate-intake        exit=0   stdout_len=0
//     verify envelope    exit=0   stdout_len=0
//
// exit 0 + silence = allow. But that is ALSO what "inspected the board and deferred" looks like,
// and what "no rule matched" looks like, and what a thrown exception looks like, and what an inert
// hook looks like — one whose entire body silently never ran. Four states, one signature. No test,
// orchestrator or auditor can tell them apart, which is how a whole enforcement layer can sit
// inert while every one of its checks reports success.
//
// FAIL-OPEN IS RETAINED, DELIBERATELY, and every hook here argues for it in its own header: a gate
// that breaks legitimate or standalone runs just gets disabled, and a disabled gate enforces
// nothing. The defect was never the direction. It is that `allow` carried NO EVIDENCE.
//
// THE PREDICATE IS ALREADY INVENTED IN THIS REPO. The structural suite calls its helper `spoke()`
// — did the script produce output? That is exactly the right question. It existed only in the test
// harness, applied to entry points. This promotes it to runtime and applies it to
// hooks, which closes the whole CLASS rather than one instance of it:
//
//     inspected-and-permitted · no-rule-matched · threw · never ran
//
// all four become distinguishable facts in the decisions ledger.
//
// TIER: LOCAL, and checkout-wide rather than per-slug — hooks fire outside any run, so there is
// frequently no `<slug>` to file under. Pure run-trace; the durable cross-machine record is the
// committed metrics shard, which `stats --hooks` aggregates into.
//
// THE PATH IS RESOLVED, NEVER SPELLED. It comes from `lib/paths.mjs` — the same resolver
// ``harness probe stats` --hooks` reads through. This file used to hardcode the pre-ADR-0001 root, so every
// hook wrote its receipts to `.shapeup-sdlc/` while the only reader looked in `.shapeup/`:
// `stats --hooks` reported zero hook activity on every project, which is indistinguishable from
// the inert-enforcement-layer failure this file exists to make visible. A telemetry channel with
// a hardcoded root is a telemetry channel with a silent disconnect in it.
//
// THE RECEIPT IS BEST-EFFORT BY DESIGN. An unwritable `decisions.jsonl` must never turn into a
// failed tool call: a receipt that can break a run would get the whole layer disabled, which is
// the exact outcome this file exists to prevent. Every write here is inside a try/catch.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { decisions } from "../../kernel/lib/paths.mjs";
import { resolveRunId } from "../../kernel/lib/paths.mjs";

/**
 * Where the receipts land.
 *
 * `SHAPEUP_DECISIONS_PATH` redirects the ledger. It exists because this project's OWN test suite
 * executes the real hooks, and without a redirect every `npm test` appended ~21 rows to the
 * developer's live `decisions.jsonl` — which would then be read back by `stats --hooks` as if
 * they were evaluations from a real run. A measurement instrument that its own test suite
 * contaminates is not an instrument.
 *
 * @param {string} [cwd] - Project root; defaults to the process cwd.
 * @returns {string} The ledger path — `SHAPEUP_DECISIONS_PATH` when set, else the LOCAL root's
 *   `decisions.jsonl`, resolved through `lib/paths.mjs`.
 */
export function decisionsPath(cwd) {
  return process.env.SHAPEUP_DECISIONS_PATH || decisions(cwd || process.cwd());
}

/**
 * Append one decision row. Never throws.
 * @param {object} row - The decision record (see {@link runHook} for the shape).
 * @param {string} [cwd] - Project root.
 * @returns {boolean} True when the row reached disk.
 */
export function record(row, cwd) {
  try {
    const path = decisionsPath(cwd);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(row) + "\n");
    return true;
  } catch { return false; }
}

/**
 * Read the raw hook payload from stdin. Hooks that need it before deciding can call this;
 * {@link runHook} does not read stdin itself, so a hook keeps control of its own parsing.
 * @returns {Promise<string>} The stdin text, or "" when stdin is closed or errors.
 */
export function readStdin() {
  return new Promise((res) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => res(d));
    process.stdin.on("error", () => res(""));
  });
}

/**
 * The sentinel `settle()` throws so a hook can leave from anywhere without a `process.exit` of
 * its own. `runHook` unwraps it back into an ordinary decision.
 */
export class HookDecision extends Error {
  /**
   * @param {object} decision - The decision record (see {@link runHook}).
   */
  constructor(decision) {
    super(decision.verdict);
    this.name = "HookDecision";
    this.decision = decision;
  }
}

/**
 * Settle the hook from anywhere in its body — the shape a `defer()` / `deny()` helper wraps.
 *
 * Hooks are written as a straight-line sequence of "is this even my business?" tests, each of
 * which used to call `process.exit(0)` directly. Throwing instead of exiting means every one of
 * those early outs still passes through the receipt.
 *
 * @param {object} decision - The decision record (see {@link runHook}).
 * @returns {never} Never returns — always throws {@link HookDecision}.
 */
export function settle(decision) {
  throw new HookDecision(decision);
}

/**
 * The single exit path for every hook.
 *
 * A hook's body becomes a function that RETURNS a decision instead of calling `process.exit`
 * itself. `runHook` records that decision and then exits — so there is exactly one place a hook
 * can leave, and no route out of one that skips the receipt.
 *
 * The decision shape:
 *   {
 *     verdict: "allow" | "warn" | "deny" | "block" | "error",
 *                                                      // "error" is still fail-open, now recorded;
 *                                                      // "warn" permits but says so — see below
 *     reason:  string,                                 // why, in one line
 *     rule?:   string,                                 // which rule fired, when one did
 *     event?:  string, tool?: string, subject?: string,// what was being judged
 *     payload?: object,                                // the JSON the host reads
 *     emit?:   boolean,                                // print `payload` even on an allow
 *     cwd?:    string,                                 // where to file the receipt
 *   }
 *
 * A body that returns nothing is recorded as `{verdict:"allow", reason:"no rule matched"}` — the
 * commonest case, and previously the one indistinguishable from never having run.
 *
 * @param {string} name - The hook's name, as it appears in `hooks.json`.
 * @param {function(): (object|Promise<object|undefined>|undefined)} fn - The hook body.
 * @returns {Promise<never>} Does not return — always exits 0, per the fail-open contract.
 */
export async function runHook(name, fn) {
  let d;
  try {
    d = (await fn()) ?? { verdict: "allow", reason: "no rule matched" };
  } catch (e) {
    if (e instanceof HookDecision) d = e.decision;
    // Still fail-open — but now the throw is a FACT on disk instead of the same silence as a
    // clean allow. This is the state that used to be completely unobservable.
    else d = { verdict: "error", reason: String(e?.message ?? e) };
  }
  record({
    at: new Date().toISOString(),
    hook: name,
    pid: process.pid,
    // WHICH RUN THIS DECISION BELONGS TO — resolved from the active-scope pointer, best-effort.
    //
    // The ledger is checkout-wide by design (a hook frequently fires with no `<slug>` to file
    // under), which is exactly why the row needs the key: without it, "the enforcement layer denied
    // 4 writes" cannot be attributed to a run, so a denial rate cannot be compared between runs and
    // an inert layer in ONE run is invisible inside a healthy checkout-wide total.
    //
    // `null` is a real answer, not a failure: a hook firing outside any run genuinely belongs to no
    // run, and recording that is what lets the export tier partition ambient decisions from run
    // ones. Resolution reads two small files and swallows every error — a receipt must never be
    // able to fail a tool call.
    run_id: (() => { try { return resolveRunId(d.cwd || process.cwd()); } catch { return null; } })(),
    event: d.event ?? null,
    tool: d.tool ?? null,
    subject: d.subject ?? null,
    verdict: d.verdict ?? "allow",
    reason: d.reason ?? null,
    rule: d.rule ?? null,
  }, d.cwd);
  // Deny/block/warn payloads are emitted by definition. `emit: true` covers the hooks whose whole
  // job is to SAY something on an allow — an injected context hint, for instance — so
  // a permitting hook can still write to stdout without pretending to be a denial.
  //
  // WHY `warn` IS ITS OWN VERDICT (ADR-0001). An advisory gate permits the call, so the obvious
  // encoding is `verdict: "allow"`. That would make "permitted because the rule was satisfied"
  // byte-identical to "permitted DESPITE the rule being broken" — the exact indistinguishability
  // this file exists to eliminate, reintroduced one level up. A gate that downgrades from deny to
  // advisory must stay countable, or `stats --hooks` silently loses the measurement.
  if (d.payload && (d.verdict === "deny" || d.verdict === "block" || d.verdict === "warn" || d.emit)) {
    process.stdout.write(JSON.stringify(d.payload));
  }
  process.exit(0);
}
