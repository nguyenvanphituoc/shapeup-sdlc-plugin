// A HUNT THAT DROVE NOTHING READ AS A HUNT THAT FOUND NOTHING.
//
// The run records QA as `run` whenever it dispatched the hunt. A hunter that could not reach the app
// still returns, with a report opening `charters: 0/0`, and the ship report said "QA: run" with no
// findings — a clean app, to anyone reading it, when nobody had driven the app at all. The report's
// own charter count now decides: zero charters run is `not-hunted`, whatever the run passed in.
import { join } from "node:path";

/**
 * Run the not-hunted checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { qaStatus, buildReport } = await import(join(ROOT, "kernel/reduce/ship.mjs"));

  section("163. A dispatched hunt that ran no charter is reported as not hunted, never as run");

  const empty = "# Hunt Report — demo (round 1)\ncharters: 0/0 · session units spent: 0\nHunt not executed.\n";
  const real = "# Hunt Report — demo (round 1)\ncharters: 4/5 · session units spent: 6\n";
  const got = [qaStatus("run", empty), qaStatus("run", real), qaStatus("skipped", empty), qaStatus(undefined, null), qaStatus(undefined, real)];
  if (JSON.stringify(got) === JSON.stringify(["not-hunted", "run", "skipped", "skipped", "run"])) {
    ok("zero charters is not-hunted; a real hunt is run; a skip and no report stay skipped");
  } else fail(`qaStatus returned ${JSON.stringify(got)}`);

  if (qaStatus("run", "charters: 10/12") === "run") ok("a count that starts with 0 only by digit (10/12) is not read as zero");
  else fail("charters: 10/12 was read as not hunted");

  const base = { slug: "demo", at: "2026-09-27", verdict: "PASS", rounds: 1, board: { done: 1, total: 1, unfinished: [] }, t0: [], artifacts: 0, ratchet: null };
  const md = buildReport({ ...base, qa: qaStatus("run", empty) });
  if (/^qa: not-hunted$/m.test(md) && /\| QA \| not-hunted \|/.test(md)) ok("the report's front matter and table both say not-hunted");
  else fail("the report does not carry not-hunted");
}
