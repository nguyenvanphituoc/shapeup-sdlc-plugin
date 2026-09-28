#!/usr/bin/env node
// probe hunt — "did the QA hunt hunt anything?"
//
// CONTRACT. A bounded, read-only query over the hunt's WorkResult, its order and its report.
// Prints `{ok, status, qa, charters_run, findings, reason}` on stdout; exits 0 when the hunt's
// result is one the run may accept, 1 when it is not, and 2 on a bad argv. Writes nothing.
//
// WHY THIS EXISTS. A hunter that reached the app, swept the fault log and then drafted no charter
// still returned `done`, and a `done` with no findings reads as an app with nothing wrong. The hunt
// report's charter count says what actually happened. A `done` hunt over an app its order could
// reach, with no charter run, is refused here and on ingest, and the run sends the hunter back once
// — the same shape as a verdict that grades nothing by name.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { resultsDir, ordersDir, qaDir } from "../lib/paths.mjs";

/**
 * The number of charters a hunt report says it ran.
 *
 * @param {(string|null)} text - The hunt report's text.
 * @returns {(number|null)} The run count from its `charters: <run>/<approved>` line, or null when
 *   there is no report or no such line.
 */
export function chartersRun(text) {
  const m = String(text ?? "").match(/^charters:\s*(\d+)/m);
  return m ? Number(m[1]) : null;
}

/**
 * Whether a hunt result may be accepted as it stands.
 *
 * Held to it only when the result says `done` and the order gave the hunter a way into the app
 * (`launch_cmd` or `app_url`): a hunt that returns `failed` says it could not hunt, which is honest,
 * and a hunt with no way in cannot be asked to drive anything.
 *
 * @param {object} result - The hunt WorkResult.
 * @param {object} payload - The hunt order's payload.
 * @param {(string|null)} report - The hunt report's text, or null.
 * @returns {(string|null)} A reason phrased for the hunter, or null.
 */
export function huntProblem(result, payload, report) {
  if (result?.status !== "done") return null;
  if (!payload?.launch_cmd && !payload?.app_url) return null;
  const n = chartersRun(report);
  if (n === null) return "the hunt returned done with no hunt report carrying a `charters:` line";
  if (n > 0) return null;
  return "the hunt returned done over an app its order could reach, having run 0 charters — " +
    "draft at least one charter where the EVAL left territory uncovered and hunt it, or return failed saying why the app could not be driven";
}

/**
 * Read a JSON file, or null.
 * @param {string} p - Path.
 * @returns {(object|null)} The parsed document, or null when absent or unreadable.
 */
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

/**
 * What the hunt on disk amounts to.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{ok:boolean, status:(string|null), qa:string, charters_run:(number|null), findings:number, reason:(string|null)}}
 *   `qa` is `run` (charters ran), `not-hunted` (the hunt returned, no charter ran), or `missing`.
 */
export function huntOutcome(cwd, slug) {
  const result = readJson(join(resultsDir(cwd, slug), "hunt.json"));
  if (!result) return { ok: false, status: null, qa: "missing", charters_run: null, findings: 0, reason: "no hunt result on disk" };
  const payload = readJson(join(ordersDir(cwd, slug), "hunt.json"))?.payload || {};
  const reportPath = join(qaDir(cwd, slug), "hunt-report.md");
  const report = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
  const n = chartersRun(report);
  const reason = huntProblem(result, payload, report);
  return {
    ok: !reason,
    status: typeof result.status === "string" ? result.status : null,
    qa: n ? "run" : "not-hunted",
    charters_run: n,
    findings: Array.isArray(result.discoveries) ? result.discoveries.length : 0,
    reason,
  };
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe hunt --slug <slug> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
};

/**
 * Report what the hunt on disk amounts to.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when the hunt result may be accepted, 1 when it may not.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const out = huntOutcome(resolve(args.cwd || process.cwd()), args.slug);
  console.log(JSON.stringify(out));
  process.exit(out.ok ? 0 : 1);
}
