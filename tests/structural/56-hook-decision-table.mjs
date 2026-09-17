// Structural test module: the hook decision table.
// Section: 90.
//
// THE DEFECT THIS MODULE EXISTS FOR. The enforcement layer was tested by hand-written assertions
// over an enumerated list of command strings, and mutation measurement put a number on what that
// buys: `hooks/sandbox-guard.mjs` — tested by DECISIONS over varied paths — killed 8 of 8 planted
// mutants. `hooks/safety-spine.mjs` — tested by a FIXED LIST of twelve command strings — killed 1
// of 4. Same directory, same author, same effort. The difference is method, and the surviving
// mutants all share one shape: they keep the twelve enumerated strings denied while widening the
// hole to an adjacent spelling. `git reset HEAD~3 --hard` and `cat .env.local` are each one token
// away from a case the suite already covers, and neither was covered.
//
// SO THE CASES BECOME DATA. `tests/fixtures/hook-decisions.json` holds one object per decision;
// adding a case is one row, not one more bespoke assertion, which is what makes covering a FAMILY
// affordable instead of aspirational.
//
// AND EVERY ROW PINS BOTH HALVES. A hook answers twice: once to the host (`permissionDecision`,
// which gates the tool call) and once to the ledger (`verdict` + `rule`, which is the record).
// Asserting only the first cannot see a guard that stopped being consulted; asserting only a deny
// cannot see an ALLOW that stopped being INSPECTED. `hooks/lib/decision.mjs` already separates
// `inspected-and-permitted` from `no-rule-matched` from `threw` from `never ran` — it has since
// v1.5, and exactly one check in the suite read it. An allow row here pins `rule`, so it asserts
// the hook LOOKED and CLEARED rather than merely having been silent. That is the whole upgrade,
// and it costs nothing: the record was already being written.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

/**
 * Fire one hook with a payload on stdin, in an isolated workspace with its own decision ledger.
 * @param {string} ROOT - Repo root.
 * @param {object} spec - The hook's `{argv, event}` entry from the table.
 * @param {object} payload - The full hook payload.
 * @param {Object<string,(string|object)>} [setup] - Files to materialise in the workspace before
 *   the hook fires, relative path -> contents (an object is written as JSON). This is what lets one
 *   table walk a defer ladder rung by rung: each rung needs one more piece of run state on disk.
 * @returns {{status:number, out:(object|null), row:(object|null)}} The host-facing JSON (null when
 *   the hook stayed silent) and the LAST decision row it recorded (null when it recorded none).
 */
function fire(ROOT, spec, payload, setup) {
  const ws = mkdtempSync(join(tmpdir(), "hdt-"));
  const ledger = join(ws, "decisions.jsonl");
  try {
    for (const [rel, body] of Object.entries(setup || {})) {
      const abs = join(ws, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body, null, 2));
    }
    const r = spawnSync(process.execPath, spec.argv.map((a) => (a.endsWith(".mjs") ? join(ROOT, a) : a)), {
      encoding: "utf8",
      input: JSON.stringify({ ...payload, cwd: ws }),
      env: { ...process.env, SHAPEUP_DECISIONS_PATH: ledger },
      timeout: 20_000,
    });
    let out = null;
    try { out = JSON.parse(r.stdout); } catch { /* silence is a permit */ }
    const rows = existsSync(ledger)
      ? readFileSync(ledger, "utf8").split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      : [];
    return { status: r.status, out, row: rows.length ? rows[rows.length - 1] : null };
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}

/**
 * Run the decision table.
 * @param {object} ctx - The shared structural-suite context.
 * @returns {Promise<void>}
 */
export async function run(ctx) {
  const { ok, fail, section, ROOT, readJSON } = ctx;
  section("90. Hook decision table — every row pins the host's answer AND the ledger's record");

  const table = readJSON(join(ROOT, "tests/fixtures/hook-decisions.json"));

  // (a) VACUITY GUARD. A data-driven suite whose data failed to load passes every assertion below
  // it by running none of them. The count is asserted before the loop, so an empty or unreadable
  // table is a failure rather than a silent all-clear.
  if (Array.isArray(table.rows) && table.rows.length >= 20) ok(`decision table loaded ${table.rows.length} rows (not vacuous)`);
  else { fail(`decision table has ${table.rows?.length ?? 0} rows — a table that failed to load would pass every case below by vacuity`); return; }

  for (const row of table.rows) {
    const spec = table.hooks[row.hook];
    if (!spec) { fail(`row ${row.id} names unknown hook "${row.hook}"`); continue; }

    const payload = {
      hook_event_name: spec.event,
      tool_name: row.tool,
      tool_input: row.input,
      ...(row.response ? { tool_response: row.response } : {}),
    };
    const { out, row: rec } = fire(ROOT, spec, payload, row.setup);

    // --- the host half: was the tool call gated the way the table says? ---
    const decision = out?.hookSpecificOutput?.permissionDecision ?? null;
    if (decision === row.expect.decision) {
      ok(`${row.id}: host told ${decision === null ? "nothing (permit)" : decision}`);
    } else {
      fail(`${row.id}: host expected ${row.expect.decision === null ? "silence" : row.expect.decision}, got ${decision === null ? "silence" : decision} — ${row.why}`);
    }

    // --- the ledger half: did the hook actually inspect this, and under which rule? ---
    // This is the half that separates "inspected and permitted" from "never ran". An allow whose
    // rule is absent is not a passing case; it is an enforcement point that has gone quiet.
    if (!rec) {
      fail(`${row.id}: NOTHING was recorded — an enforcement point that records nothing is indistinguishable from one that never fired`);
      continue;
    }
    if (rec.verdict === row.expect.verdict) ok(`${row.id}: ledger verdict "${rec.verdict}"`);
    else fail(`${row.id}: ledger verdict expected "${row.expect.verdict}", got "${rec.verdict}"`);

    if (rec.rule === row.expect.rule) ok(`${row.id}: ledger rule "${rec.rule}" — the decision names why`);
    else fail(`${row.id}: ledger rule expected "${row.expect.rule}", got "${rec.rule}" — the verdict is right but the reason is not, so the guard may be firing for the wrong cause`);
  }

  // (b) THE TABLE MUST COVER EVERY DENY CATEGORY THE SPINE CAN PRODUCE. A category with no row is
  // an enforcement rule with no case, and it is invisible precisely because nothing references it.
  const CATEGORIES = ["destructive-fs", "git-destructive", "sql-destructive", "secret-read", "self-protect"];
  const covered = new Set(table.rows.filter((r) => r.expect.verdict === "deny").map((r) => r.expect.rule));
  const missing = CATEGORIES.filter((c) => !covered.has(c));
  if (missing.length === 0) ok(`every safety-spine deny category has at least one row (${CATEGORIES.length}/${CATEGORIES.length})`);
  else fail(`deny categories with no row in the table: ${missing.join(", ")}`);

  // (c) AND EVERY DENY CATEGORY MUST HAVE MORE THAN ONE SPELLING. One row per category proves the
  // example; the surviving mutants all kept the example denied. A category tested at a single point
  // is the exact shape that measured 1-of-4.
  const perCat = {};
  for (const r of table.rows.filter((x) => x.expect.verdict === "deny")) perCat[r.expect.rule] = (perCat[r.expect.rule] || 0) + 1;
  const single = CATEGORIES.filter((c) => (perCat[c] || 0) === 1 && c !== "self-protect");
  if (single.length === 0) ok("every deny category (bar self-protect, which has one shape) is covered at more than one spelling");
  else fail(`covered at exactly one spelling, so an adjacent-spelling widening would go unseen: ${single.join(", ")}`);

  // (d) EVERY RUNG OF THE SANDBOX FENCE'S FAIL-OPEN LADDER NEEDS A ROW. The guard exits early at
  // seven distinct "not my business" rungs before it ever judges a path, and each one permits the
  // write. A rung with no row is an exit nothing exercises — and since every one of them returns
  // ALLOW, an exit that starts firing for the wrong reason moves no verdict and breaks no test.
  const RUNGS = ["no-round", "bad-pointer", "no-order", "no-substrate", "no-whitelist", "no-target", "in-substrate", "outside-substrate"];
  const rungRows = new Set(table.rows.filter((r) => r.hook === "sandbox-guard").map((r) => r.expect.rule));
  const gaps = RUNGS.filter((r) => !rungRows.has(r));
  if (gaps.length === 0) ok(`every rung of the substrate fence has a row (${RUNGS.length}/${RUNGS.length}, deny and all six fail-opens)`);
  else fail(`fail-open rungs with no row — each permits a write and nothing exercises it: ${gaps.join(", ")}`);
}
