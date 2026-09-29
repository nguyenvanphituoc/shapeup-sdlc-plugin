// A LEG WRITES ITS OWN RESULT, NEVER A LIVE SIBLING'S.
//
// A build order freezes the whole run trace and carves out the paths it authors, its WorkResult
// first. With two build legs live, each carve-out answered for either leg, because the guard saw a
// path and nothing else: driven with two live orders, a leg's write of its sibling's result landed.
// The host names the sub-agent behind every tool call, and the dispatch receipt recorded the same
// id when that sub-agent invoked the worker skill — measured: a skill's writes carry the id of the
// sub-agent that invoked it, and two parallel sub-agents carry different ids. So an order's own
// paths are now writable only by the agent that took its dispatch. A write with no agent id (the
// operator's own session) and an order with no attributable receipt keep the permit they had.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the own-dispatch checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { substrateFor } = await import(join(ROOT, "kernel/compile.mjs"));
  const guard = join(ROOT, "hooks/sandbox-guard.mjs");

  section("171. A leg writes its own order's result, and a live sibling's is refused");

  const d = mkdtempSync(join(tmpdir(), "own-dispatch-"));
  const compiledAt = new Date(Date.now() - 60_000).toISOString();
  const order = (stem, scopeId) => {
    const scope = { scope_id: scopeId, allowed_file_substrate: [`src/${scopeId}/**`], shared_substrate: [] };
    const o = { schema_version: 1, order_id: `demo/${stem}`, run_id: "demo-run", compiled_at: compiledAt, worker: "task-executor",
      mode: "orchestrated", operation: "execute", substrate: substrateFor("execute", { slug: "demo", scope, ownStem: stem }), payload: { feature: "demo" } };
    const p = join(d, ".shapeup/demo/orders", `${stem}.json`);
    mkdirSync(join(d, ".shapeup/demo/orders"), { recursive: true });
    writeFileSync(p, JSON.stringify(o));
    return p;
  };
  const receipts = (rows) => {
    mkdirSync(join(d, ".shapeup/demo/receipts"), { recursive: true });
    writeFileSync(join(d, ".shapeup/demo/receipts/dispatch.jsonl"), rows.map((r) => JSON.stringify({
      at: new Date().toISOString(), run_id: "demo-run", worker_declared: "task-executor", skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill", ...r,
    })).join("\n") + "\n");
  };
  const ask = (rel, agentId) => {
    const payload = { tool_name: "Write", cwd: d, tool_input: { file_path: join(d, rel), content: "{}" }, ...(agentId ? { agent_id: agentId, agent_type: "workflow-subagent" } : {}) };
    const r = spawnSync(process.execPath, [guard], { encoding: "utf8", input: JSON.stringify(payload) });
    return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), out: r.stdout || "" };
  };
  try {
    const a = order("cart-r1-a1", "cart");
    order("pay-r1-a1", "pay");
    writeFileSync(join(d, ".shapeup/active-order"), JSON.stringify({ slug: "demo", order_path: a }));
    receipts([{ order_id: "demo/cart-r1-a1", agent_id: "agent-cart" }, { order_id: "demo/pay-r1-a1", agent_id: "agent-pay" }]);

    const forged = ask(".shapeup/demo/results/pay-r1-a1.json", "agent-cart");
    if (forged.denied && /another agent's/.test(forged.out)) ok("a leg's write of a live sibling's result is refused, naming whose it is");
    else fail(`the cart leg wrote the pay leg's result: ${forged.out || "(allowed)"}`);

    if (!ask(".shapeup/demo/results/cart-r1-a1.json", "agent-cart").denied) ok("the same leg's own result still lands while the sibling is live");
    else fail("a leg was refused its own result");

    if (!ask(".shapeup/demo/results/pay-r1-a1.json", "agent-pay").denied) ok("the sibling's result lands from the sibling");
    else fail("the pay leg was refused its own result");

    if (!ask(".shapeup/demo/results/pay-r1-a1.json", null).denied) ok("a write with no agent id — the operator's own session — keeps its permit");
    else fail("the operator's own session was refused a result write");

    // A re-dispatch of the same order binds to the agent that took it this time.
    receipts([{ order_id: "demo/cart-r1-a1", agent_id: "agent-cart" }, { order_id: "demo/pay-r1-a1", agent_id: "agent-pay" },
      { order_id: "demo/pay-r1-a1", agent_id: "agent-pay-2" }]);
    if (ask(".shapeup/demo/results/pay-r1-a1.json", "agent-pay").denied && !ask(".shapeup/demo/results/pay-r1-a1.json", "agent-pay-2").denied) {
      ok("a re-dispatched order binds to its newest receipt's agent");
    } else fail("a re-dispatch still answers to the agent that took the first dispatch");

    // No attributable receipt — the dispatch hook never fired, or fired before this compile: no new refusal.
    receipts([{ order_id: "demo/cart-r1-a1", agent_id: "agent-cart" }]);
    if (!ask(".shapeup/demo/results/pay-r1-a1.json", "agent-cart").denied) ok("an order with no receipt keeps the permit it had — the guard fails open, never closed");
    else fail("the guard refused a write it cannot attribute");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
