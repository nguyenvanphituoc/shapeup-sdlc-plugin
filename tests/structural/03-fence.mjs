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
