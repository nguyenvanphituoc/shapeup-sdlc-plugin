// The envelope check, executed in both of its modes: as the dispatch gate the host calls before an
// agent leaves, and as the command the loop runs over a result before it applies it.
//
// An order that does not match the schema never reaches a worker; a result that does not is sent back
// once. The gate fails open when no order is named (a standalone run stays free) and closed on one
// that is named and wrong, and that asymmetry is the thing worth pinning.
import { join } from "node:path";
import { scratch, put, kernel } from "../lib/fixture.mjs";

const ORDER = {
  schema_version: 1, order_id: "demo/orient", worker: "orient", mode: "orchestrated",
  operation: "orient", payload: { feature: "demo" },
};
const RESULT = { schema_version: 1, order_id: "demo/orient", worker: "orient", status: "done" };

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const ORDER_SCHEMA = join(ROOT, "kernel/schemas/work-order.schema.json");
  const RESULT_SCHEMA = join(ROOT, "kernel/schemas/work-result.schema.json");
  const s = scratch("envelope", { git: true });
  try {
    const cwd = s.dir;

    section("envelope — the order gate fires before a dispatch leaves");
    const gate = (toolInput) => kernel(ROOT, ["verify", "envelope"], {
      cwd, input: JSON.stringify({ tool_name: "Agent", tool_input: toolInput, cwd }),
      env: { SHAPEUP_DECISIONS_PATH: join(cwd, "decisions.jsonl") },
    });
    const denies = (r) => r.out?.hookSpecificOutput?.permissionDecision === "deny";
    const good = put(cwd, ".shapeup/demo/orders/orient.json", ORDER);
    check(!denies(gate({ prompt: `--order "${good}"` })) , "a schema-valid order is let through");
    const noWorker = put(cwd, ".shapeup/demo/orders/no-worker.json", { ...ORDER, worker: undefined });
    check(denies(gate({ prompt: `--order "${noWorker}"` })), "an order missing a required field denies the dispatch");
    const badMode = put(cwd, ".shapeup/demo/orders/bad-mode.json", { ...ORDER, mode: "freestyle" });
    check(denies(gate({ prompt: `--order "${badMode}"` })), "an order with a value outside the enum denies the dispatch");
    check(denies(gate({ prompt: `--order "${join(cwd, "nope.json")}"` })), "an order path that does not exist denies the dispatch");
    check(!denies(gate({ prompt: "a plain prompt with no order" })), "no --order named: a standalone dispatch stays free (fail-open)");
    check(denies(gate({ skill_args: `--order=${noWorker}` })) , "the order is found through the Skill form of the call as well");

    section("envelope — a result is checked before the loop applies it");
    const check_ = (file, schema) => kernel(ROOT, ["verify", "envelope", file, schema], { cwd });
    check(check_(put(cwd, "ok-result.json", RESULT), RESULT_SCHEMA).status === 0, "a valid result exits 0");
    check(check_(put(cwd, "bad-status.json", { ...RESULT, status: "finished" }), RESULT_SCHEMA).status === 1,
      "a status outside done/partial/escalated/failed exits 1 and names the path");
    check(check_(put(cwd, "no-id.json", { schema_version: 1, status: "done" }), RESULT_SCHEMA).status === 1, "a result with no order_id exits 1");
    check(check_(good, ORDER_SCHEMA).status === 0, "the same command validates an order against the order schema");
    check(check_(join(cwd, "absent.json"), RESULT_SCHEMA).status === 1, "a result that was never written exits 1");
  } finally { s.done(); }
}
