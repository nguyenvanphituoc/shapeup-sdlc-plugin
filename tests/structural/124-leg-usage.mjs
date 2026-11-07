// Structural test module: what a leg cost, on the leg row and in the export.
// Section: 177.
//
// WHY THIS MODULE EXISTS.
//
// The export held a duration per leg and nothing about tokens or cost, so a run could say how long it
// took and never what it spent — and a leg a courier ran left no row at all. The leg row now has room
// for what the host reported to the dispatching session. The rule these checks pin is the one that is
// easy to break quietly: a figure the host did not give is NULL, never zero and never inferred, and
// the row says who supplied the figures it does carry.

import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "usage";

/**
 * Run the leg-usage checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("177. A leg's tokens and cost are what the host reported — null when it reported nothing");
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const sh = (verbs, args) => spawnSync("node", [KERNEL, ...verbs.split(" "), ...args], { encoding: "utf8" });
  const ws = mkdtempSync(join(tmpdir(), "struct-usage-"));
  try {
    if (sh("init run", ["--slug", SLUG, "--intake-text", "x", "--auto-level", "interactive", "--cwd", ws]).status !== 0) { fail("could not open the fixture run"); return; }
    const local = (...p) => join(ws, ".shapeup", SLUG, ...p);
    const runId = JSON.parse(readFileSync(local("receipt.json"), "utf8")).run_id;
    /** Plant an answered order, with the receipt a skill dispatch would have left. */
    const answered = (stem) => {
      const order = { schema_version: 1, order_id: `${SLUG}/${stem}`, run_id: runId, worker: "orient", mode: "standalone", operation: "orient", payload: {} };
      mkdirSync(local("orders"), { recursive: true }); mkdirSync(local("results"), { recursive: true });
      writeFileSync(local("orders", `${stem}.json`), JSON.stringify(order));
      writeFileSync(local("results", `${stem}.json`), JSON.stringify({ schema_version: 1, order_id: order.order_id, worker: "orient", status: "done" }));
      return local("orders", `${stem}.json`);
    };
    const rows = () => readFileSync(local("legs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

    const a = answered("with-usage");
    const r1 = sh("reduce ingest", ["--order", a, "--cwd", ws, "--tokens-total", "170869", "--tokens-in", "1200", "--cost-usd", "0.42", "--usage-source", "agent-tool-result"]);
    if (r1.status === 0) ok("ingest accepts the usage the dispatching session was told");
    else fail(`ingest refused usage flags: ${r1.stderr}${r1.stdout}`);
    const withUsage = rows().find((r) => r.order_id === `${SLUG}/with-usage`);
    if (withUsage?.tokens_total === 170869 && withUsage.tokens_in === 1200 && withUsage.cost_usd === 0.42 && withUsage.usage_source === "agent-tool-result") ok("the leg row carries the figures and who supplied them");
    else fail(`the leg row lost the usage: ${JSON.stringify(withUsage)}`);
    if (withUsage && withUsage.tokens_out === null) ok("a figure the host did not give (tokens_out) is null, not zero");
    else fail(`an unreported figure was not null: ${JSON.stringify(withUsage)}`);

    const b = answered("without-usage");
    sh("reduce ingest", ["--order", b, "--cwd", ws]);
    const without = rows().find((r) => r.order_id === `${SLUG}/without-usage`);
    if (without && ["tokens_in", "tokens_out", "tokens_total", "cost_usd", "usage_source"].every((k) => k in without && without[k] === null)) ok("an ingest with no usage records every cost field as null, so the column exists on every row");
    else fail(`a leg with no usage did not carry null fields: ${JSON.stringify(without)}`);

    const c = answered("negative");
    const bad = sh("reduce ingest", ["--order", c, "--cwd", ws, "--tokens-total", "-5"]);
    if (bad.status === 2) ok("a negative figure is refused at the argv, nothing written");
    else fail(`a negative token count exited ${bad.status}, not 2`);

    // The host measured the dispatch and the receipt hook recorded it on the row, so a session that was
    // told nothing still leaves the figure — and one that passes a figure keeps its own.
    const plantReceipt = (stem, usage) => {
      mkdirSync(local("receipts"), { recursive: true });
      appendFileSync(local("receipts", "dispatch.jsonl"), JSON.stringify({
        at: new Date().toISOString(), order_id: `${SLUG}/${stem}`, run_id: runId, worker_declared: "orient",
        skill_invoked: "orient", dispatch_ok: true, tool: "Agent", agent_id: "a1",
        agent_type: "shapeup-sdlc-plugin:orient", usage,
      }) + "\n");
    };
    const d = answered("host-usage");
    plantReceipt("host-usage", { tokens_total: 24497, duration_ms: 2430, model: "claude-opus-5-5" });
    sh("reduce ingest", ["--order", d, "--cwd", ws]);
    const fromHost = rows().find((r) => r.order_id === `${SLUG}/host-usage`);
    if (fromHost?.tokens_total === 24497 && fromHost.usage_source === "agent-hook" && fromHost.cost_usd === null) {
      ok("with no flags, the leg row carries the figure the host measured and names it as the agent hook's");
    } else fail(`the leg row did not take the receipt's usage: ${JSON.stringify(fromHost)}`);
    // A background launch has no figures yet: the receipt carries nulls, and the leg row stays null unless the
    // session passes the total from the completion notice.
    const bgo = answered("background");
    plantReceipt("background", { tokens_total: null, duration_ms: null, model: null });
    sh("reduce ingest", ["--order", bgo, "--cwd", ws]);
    const bgRow = rows().find((r) => r.order_id === `${SLUG}/background`);
    if (bgRow && bgRow.tokens_total === null && bgRow.usage_source === null) ok("a receipt with null usage leaves the leg row null — a figure is never inferred");
    else fail(`a null-usage receipt produced a figure: ${JSON.stringify(bgRow)}`);
    const bgf = answered("background-flag");
    plantReceipt("background-flag", { tokens_total: null, duration_ms: null, model: null });
    sh("reduce ingest", ["--order", bgf, "--cwd", ws, "--tokens-total", "61000", "--usage-source", "agent-tool-result"]);
    const bgfRow = rows().find((r) => r.order_id === `${SLUG}/background-flag`);
    if (bgfRow?.tokens_total === 61000 && bgfRow.usage_source === "agent-tool-result") ok("the completion notice's total is recorded when the receipt has none");
    else fail(`the passed total was lost behind a null receipt: ${JSON.stringify(bgfRow)}`);
    const e = answered("flag-wins");
    plantReceipt("flag-wins", { tokens_total: 24497, duration_ms: 2430, model: "claude-opus-5-5" });
    sh("reduce ingest", ["--order", e, "--cwd", ws, "--tokens-total", "900", "--usage-source", "operator"]);
    const flagged = rows().find((r) => r.order_id === `${SLUG}/flag-wins`);
    if (flagged?.tokens_total === 900 && flagged.usage_source === "operator") ok("a figure the session passes is kept over the receipt's");
    else fail(`a passed figure was overwritten by the receipt: ${JSON.stringify(flagged)}`);

  } finally {
    try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
