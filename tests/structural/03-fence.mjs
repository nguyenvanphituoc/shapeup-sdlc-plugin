// The write fence, executed: sandbox-guard against fixtures, and the order verb that arms it.
//
// What this proves is the failure mode that stays green everywhere else: a fence with no pointer fails
// open on every write, and every fixture that writes its own pointer still passes. So the pointer is
// set and retired here through the shipped verb, never written by hand, and each state is read from
// the ledger's own `rule` as well as the host's allow/deny, because "nothing is live" and "nothing is
// watching" are both an allow and only the rule tells them apart.
import { join } from "node:path";
import { scratch, put, fire, denied, kernel, json, existsSync } from "../lib/fixture.mjs";

const SLUG = "demo";
const GUARD = "hooks/sandbox-guard.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  section("fence — substrate, pointer lifecycle, tier rule, fail-open");
  const s = scratch("fence", { git: true });
  try {
    const root = s.dir;
    const order = (stem, substrate) => put(root, `.shapeup/${SLUG}/orders/${stem}.json`, {
      schema_version: 1, order_id: `${SLUG}/${stem}`, worker: "task-executor", mode: "orchestrated",
      operation: "execute", payload: {}, substrate,
    });
    const write = (path, content = "x", extra = {}) =>
      fire(ROOT, GUARD, { tool_name: "Write", tool_input: { file_path: join(root, path), content }, cwd: root, ...extra });
    const rule = (r) => r.rows.at(-1)?.rule;

    // No pointer: the fence is off, and says why.
    let r = write("src/a.js");
    check(!denied(r) && rule(r) === "no-round", `no pointer → allow, rule "${rule(r)}"`);

    // Arm it through the verb. A malformed order is refused, so a bad pointer cannot be written.
    const path = order("build-r1-a1", {
      allowed: ["src/**"], frozen: [`.shapeup/${SLUG}/**`, "src/frozen/**"],
      own: [`.shapeup/${SLUG}/results/build-r1-a1.json`],
    });
    const open = kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", path], { cwd: root });
    check(open.status === 0 && existsSync(join(root, ".shapeup/active-order")), "order open writes the pointer and reads it back");
    check(Math.abs(Date.now() - Date.parse(json(path).compiled_at)) < 10_000, "order open stamps the order with the real time");
    put(root, "invalid.json", { schema_version: 1, order_id: "demo/invalid", mode: "orchestrated", payload: {} });
    const before = json(join(root, ".shapeup/active-order")).order_path;
    const invalid = kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", join(root, "invalid.json")], { cwd: root });
    check(invalid.status === 1 && json(join(root, ".shapeup/active-order")).order_path === before,
      "order open refuses an order the dispatch gate would refuse, and arms nothing (an invalid order opened first could be neither edited nor withdrawn)");
    const nested = kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", path], { cwd: join(root, ".shapeup") });
    check(nested.status === 2, "order refuses to run from inside a run trace, where its records would land in a nested trace");
    put(root, "bad.json", "{ not json");
    const bad = kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", join(root, "bad.json")], { cwd: root });
    check(bad.status === 1, "order open refuses an order that is not JSON (exit 1)");

    r = write("src/a.js");
    check(!denied(r), "a write inside the substrate is allowed");
    r = write("lib/outside.js");
    check(denied(r) && rule(r) === "outside-substrate", `a write outside the substrate is denied, rule "${rule(r)}"`);
    r = write("src/frozen/x.js");
    check(denied(r), "a frozen path inside an allowed glob is still denied (frozen outranks allowed)");
    r = write(`.shapeup/${SLUG}/orders/other.json`);
    check(denied(r), "the run's own order directory is frozen to the worker");
    r = write(`.shapeup/${SLUG}/results/build-r1-a1.json`, "{}");
    check(!denied(r), "the order's own result path is writable even though the run trace is frozen");

    // A stamp typed by hand and wrong must not stall the run: open overwrites it, so the result is newer.
    const future = order("typed-by-hand", { allowed: ["other/**"], frozen: [`.shapeup/${SLUG}/**`] });
    put(root, `.shapeup/${SLUG}/orders/typed-by-hand.json`, { ...json(future), compiled_at: "2999-01-01T00:00:00Z" });
    kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", future], { cwd: root });
    put(root, `.shapeup/${SLUG}/results/typed-by-hand.json`, "{}");
    kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", path], { cwd: root });
    r = write("other/x.js");
    check(denied(r), "an answered order whose stamp was typed a thousand years ahead no longer permits writes (it would, if the stamp had been kept)");

    // A plan order freezes the run's results yet must be able to write its own: the loop answers it itself.
    const plan = order("plan-spec", { allowed: ["shapeup/demo/spec/**"], frozen: [`.shapeup/${SLUG}/results/**`, `.shapeup/${SLUG}/orders/**`], own: [`.shapeup/${SLUG}/results/plan-spec.json`] });
    kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", plan], { cwd: root });
    check(!denied(write(`.shapeup/${SLUG}/results/plan-spec.json`, "{}")), "a plan order writes its own result although the results directory is frozen");
    check(denied(write(`.shapeup/${SLUG}/results/plan-wire.json`, "{}")), "…and no other result");
    check(denied(write(`.shapeup/${SLUG}/orders/plan-scopes.json`, "{}")), "a live plan order freezes the next order until it is answered");
    put(root, `.shapeup/${SLUG}/results/plan-spec.json`, "{}");
    kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", path], { cwd: root });

    // The two ways the fence lifts, distinguished by rule.
    put(root, `.shapeup/${SLUG}/results/build-r1-a1.json`, "{}");
    r = write("lib/outside.js");
    check(!denied(r) && rule(r) === "no-order", `an answered order stops fencing, rule "${rule(r)}"`);

    // Close retires both pointers and records the ending.
    put(root, ".shapeup/active-scope", { slug: SLUG });
    const close = kernel(ROOT, ["order", "close", "--slug", SLUG, "--status", "shipped", "--cause", "verdict=pass rounds=1"], { cwd: root });
    const rec = existsSync(join(root, `.shapeup/${SLUG}/close.json`)) ? json(join(root, `.shapeup/${SLUG}/close.json`)) : null;
    check(close.status === 0 && rec?.status === "shipped" && rec.cause === "verdict=pass rounds=1" && rec.at,
      "order close records status, cause and time");
    check(!existsSync(join(root, ".shapeup/active-order")) && !existsSync(join(root, ".shapeup/active-scope")),
      "order close retires both pointers");
    check(kernel(ROOT, ["order", "close", "--slug", SLUG, "--status", "bogus"], { cwd: root }).status === 2,
      "an unknown ending is a usage error (exit 2)");

    // The tier rule holds with no run in flight.
    r = write("shapeup/demo/spec/a.md", "see TASK-004 for this");
    check(denied(r) && rule(r) === "tier-direction", "a committed file naming a board id is refused at the write");
    r = write("shapeup/demo/spec/b.md", "see .shapeup/demo/orders for this");
    check(denied(r) && rule(r) === "tier-direction", "a committed file naming the run tier is refused at the write");
    r = write("shapeup/demo/spec/c.md", "see the use case UC-Pay");
    check(!denied(r), "a committed file that cites a use case is allowed");
    r = write(".shapeup/demo/notes.md", "TASK-004 is fine here");
    check(!denied(r), "the run tier itself may name a board id");

    // Fail open on anything it cannot read.
    r = fire(ROOT, GUARD, "not json at all");
    check(r.status === 0 && !denied(r), "an unparseable payload is allowed (exit 0)");
    r = fire(ROOT, GUARD, { tool_name: "Bash", tool_input: { command: "ls" }, cwd: root });
    check(r.status === 0 && !denied(r), "a tool that is not a write is out of scope");
  } finally { s.done(); }
}
