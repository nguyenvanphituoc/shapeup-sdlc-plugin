// The audit trail, executed: what every hook records, what the dispatch receipt attests, and what
// the safety hook refuses.
//
// A hook that fails open leaves exit 0 and nothing on stdout for an allow, a deny it did not reach
// and a hook that threw — so the one question this module asks of every enforcement point is whether
// the decision ledger can tell those three apart. The dispatch receipt is read the same way: the
// loop counts an attempt only against a row naming the agent the host says ran, so the rows are the
// product, not a by-product.
import { join } from "node:path";
import { scratch, put, fire, denied, slurp, existsSync } from "../lib/fixture.mjs";

const SLUG = "demo";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const s = scratch("ledger", { git: true });
  try {
    const root = s.dir;

    section("ledger — every enforcement point records a decision");
    const hooks = [
      ["safety-spine", "hooks/safety-spine.mjs"],
      ["sandbox-guard", "hooks/sandbox-guard.mjs"],
      ["dispatch-receipt", "hooks/dispatch-receipt.mjs"],
    ];
    for (const [name, script] of hooks) {
      let r = fire(ROOT, script, "NOT JSON {{{");
      const bad = r.rows.at(-1);
      check(r.status === 0 && bad?.verdict === "error" && bad.hook === name,
        `${name}: a malformed payload still exits 0 (fail-open) and is recorded as verdict "error"`);
      r = fire(ROOT, script, { tool_name: "Read", tool_input: { file_path: join(root, "a.md") }, cwd: root });
      const row = r.rows.at(-1);
      check(r.status === 0 && row?.verdict === "allow" && row.reason,
        `${name}: an out-of-scope payload is a REASONED allow, so "permitted" differs from "never ran"`);
    }

    section("ledger — safety-spine denies the unrecoverable and allows the ordinary");
    for (const [command, expected] of [
      ["rm -rf /", "deny"], ["git push --force origin main", "deny"], ["git reset --hard HEAD~3", "deny"],
      ["ls -la", "allow"], ["git status", "allow"], ["rm build/output.txt", "allow"],
    ]) {
      const r = fire(ROOT, "hooks/safety-spine.mjs", { tool_name: "Bash", tool_input: { command }, cwd: root });
      const verdict = denied(r) ? "deny" : "allow";
      check(verdict === expected && r.status === 0 && r.rows.at(-1)?.verdict === expected,
        `safety-spine ${expected}s \`${command}\` and records it${expected === "deny" ? ` (rule ${r.rows.at(-1)?.rule})` : ""}`);
    }
    const secret = fire(ROOT, "hooks/safety-spine.mjs", { tool_name: "Read", tool_input: { file_path: join(root, ".env") }, cwd: root });
    check(denied(secret), "safety-spine denies a read of a .env file");

    section("ledger — the dispatch receipt names the agent the host says ran");
    put(root, `.shapeup/${SLUG}/orders/orient.json`, {
      schema_version: 1, order_id: `${SLUG}/orient`, run_id: "demo-run", worker: "orient", mode: "orchestrated",
      operation: "orient", payload: {},
    });
    const receipts = join(root, `.shapeup/${SLUG}/receipts/dispatch.jsonl`);
    const rows = () => (existsSync(receipts) ? slurp(receipts).split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
    const prompt = `--order ".shapeup/${SLUG}/orders/orient.json"`;
    const dispatch = (toolInput, toolResponse, extra = {}) =>
      fire(ROOT, "hooks/dispatch-receipt.mjs", { tool_name: "Agent", tool_input: toolInput, tool_response: toolResponse, cwd: root, ...extra });

    let r = dispatch({ subagent_type: "shapeup-sdlc-plugin:orient", prompt }, {
      status: "completed", agentType: "shapeup-sdlc-plugin:orient", agentId: "a1",
      totalTokens: 1200, totalDurationMs: 4500, resolvedModel: "claude-sonnet-5-5",
    });
    let row = rows().at(-1);
    check(r.rows.at(-1)?.rule === "receipt-written" && row?.skill_invoked === "orient" && row.worker_declared === "orient" && row.dispatch_ok === true,
      "a foreground dispatch leaves a receipt naming the worker that ran");
    check(row?.usage?.tokens_total === 1200 && row.usage.duration_ms === 4500 && row.usage.model === "claude-sonnet-5-5",
      "the receipt carries the tokens, duration and model the host measured");
    check(row?.model_requested === null, "a call that carried no model is recorded as inherited (null), never guessed from what ran");
    r = dispatch({ subagent_type: "shapeup-sdlc-plugin:orient", prompt, model: "sonnet" }, {
      status: "completed", agentType: "shapeup-sdlc-plugin:orient", agentId: "a1b", totalTokens: 10, totalDurationMs: 20, resolvedModel: "claude-opus-5-5",
    });
    row = rows().at(-1);
    check(row?.model_requested === "sonnet" && row.usage.model === "claude-opus-5-5",
      "the model the call asked for is recorded beside the one the host says ran, so a difference is visible on the row");

    const before = rows().length;
    r = dispatch({ subagent_type: "shapeup-sdlc-plugin:task-executor", prompt, run_in_background: true },
      "Async agent launched successfully. agentId: a2");
    row = rows().at(-1);
    check(rows().length === before + 1 && row.skill_invoked === "task-executor" && row.dispatch_ok === true && row.usage.tokens_total === null,
      "a background launch is attested by the name the accepted call carried, with usage left null rather than invented");

    // The measured payload: no run_in_background on the call, and the host launched it asynchronously anyway.
    const asyncResult = { isAsync: true, status: "async_launched", agentId: "a3", resolvedModel: "claude-sonnet-5-5",
      description: "Build", prompt, outputFile: "/tmp/x.output", canReadOutputFile: true };
    r = dispatch({ subagent_type: "shapeup-sdlc-plugin:task-executor", model: "sonnet", prompt }, asyncResult);
    row = rows().at(-1);
    check(r.rows.at(-1)?.rule === "receipt-written" && row.skill_invoked === "task-executor" && row.dispatch_ok === true
      && row.usage.tokens_total === null && row.usage.model === "claude-sonnet-5-5" && row.model_requested === "sonnet",
      "a launch the host made asynchronous without being asked is attested, and the model the host resolved is recorded");
    const m = rows().length;
    r = dispatch({ subagent_type: "shapeup-sdlc-plugin:task-executor", prompt }, { isAsync: true, status: "async_launched" });
    check(rows().length === m && r.rows.at(-1)?.rule === "no-skill-named", "an async result that names no agent attests nothing");

    r = dispatch({ subagent_type: "general-purpose", prompt }, { status: "completed", agentType: "general-purpose" });
    row = rows().at(-1);
    check(row.skill_invoked === "general-purpose" && row.worker_declared === "orient",
      "a general-purpose agent that merely carried --order attests as itself, so the mismatch is visible");

    const n = rows().length;
    r = dispatch({ subagent_type: "shapeup-sdlc-plugin:orient", prompt: "no order threaded" }, { status: "completed", agentType: "shapeup-sdlc-plugin:orient" });
    check(rows().length === n && r.rows.at(-1)?.rule === "no-order", "a dispatch with no --order leaves no receipt");
    r = dispatch({ subagent_type: "x", prompt, run_in_background: true }, "launch failed, nothing started");
    check(rows().length === n && r.rows.at(-1)?.rule === "no-skill-named", "a failed launch names no agent, so nothing is attested");
  } finally { s.done(); }
}
