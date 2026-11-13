// The write fence, executed: sandbox-guard against fixtures, and the order verb that arms it.
//
// What this proves is the failure mode that stays green everywhere else: a fence with no pointer fails
// open on every write, and every fixture that writes its own pointer still passes. So the pointer is
// set and retired here through the shipped verb, never written by hand, and each state is read from
// the ledger's own `rule` as well as the host's allow/deny, because "nothing is live" and "nothing is
// watching" are both an allow and only the rule tells them apart.
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { scratch, put, fire, denied, kernel, json, slurp, existsSync } from "../lib/fixture.mjs";

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
    check(denied(write(`.shapeup/${SLUG}/decision-log.md`, "## 1")), "a live plan order fences the decision log too: its substrate does not name it, so a gate is never put while an order is open");
    put(root, `.shapeup/${SLUG}/results/plan-spec.json`, "{}");
    kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", path], { cwd: root });

    // The decision log is the gate agent's to write between dispatches. A live order fences it like any
    // other run-trace file, so a gate must never be put while an order is open; once the result lands it is writable.
    check(denied(write(`.shapeup/${SLUG}/decision-log.md`, "## 1")), "the decision log is fenced while a build order is live");

    // The two ways the fence lifts, distinguished by rule.
    put(root, `.shapeup/${SLUG}/results/build-r1-a1.json`, "{}");
    r = write("lib/outside.js");
    check(!denied(r) && rule(r) === "no-order", `an answered order stops fencing, rule "${rule(r)}"`);
    check(!denied(write(`.shapeup/${SLUG}/decision-log.md`, "## 1")), "…and the decision log is writable once the order is answered");

    // Close retires both pointers and records the ending — and a shipped ending rests on a sign-off.
    put(root, ".shapeup/active-scope", { slug: SLUG });
    const closeShipped = () => kernel(ROOT, ["order", "close", "--slug", SLUG, "--status", "shipped", "--cause", "verdict=pass rounds=1"], { cwd: root });
    const closeFile = join(root, `.shapeup/${SLUG}/close.json`);
    let close = closeShipped();
    check(close.status === 1 && !existsSync(closeFile) && existsSync(join(root, ".shapeup/active-scope")) && /Ship Sign-off/.test(close.err),
      "a shipped close with no Ship Sign-off row is refused (exit 1): nothing is recorded and the pointers stay");
    const l4 = (run_id, extra = {}) => JSON.stringify({ at: "2026-11-08T00:00:00Z", run_id, gate: "L4", status: "ok", decision: "ship", source: "preset:ci", ...extra });
    const gates = `.shapeup/${SLUG}/gates.jsonl`;
    put(root, gates, l4("demo-run", { status: "ask", decision: "ask" }) + "\n");
    check(closeShipped().status === 1, "an L4 row that stopped for the PO is not a sign-off");
    const thisRun = "demo-20260101T000000Z-deadbeef", earlierRun = "demo-20250101T000000Z-00000000";
    put(root, `.shapeup/${SLUG}/receipt.json`, { run_id: thisRun });
    put(root, gates, l4(earlierRun) + "\n");
    check(closeShipped().status === 1 && !existsSync(closeFile), "a ship row of an earlier run of the same feature does not close this one");
    put(root, gates, l4(earlierRun) + "\n" + l4(thisRun) + "\n");
    close = closeShipped();
    const rec = existsSync(closeFile) ? json(closeFile) : null;
    check(close.status === 0 && rec?.status === "shipped" && rec.cause === "verdict=pass rounds=1" && rec.at && rec.signed_off_at === "2026-11-08T00:00:00Z" && rec.signed_off_by === "preset:ci",
      "order close records status, cause, time and the sign-off the shipped ending rests on");
    check(!existsSync(join(root, ".shapeup/active-order")) && !existsSync(join(root, ".shapeup/active-scope")),
      "order close retires both pointers");
    const crumb = existsSync(join(root, ".shapeup/last-run")) ? json(join(root, ".shapeup/last-run")) : null;
    check(crumb?.slug === SLUG && crumb.run_id === thisRun && crumb.closed_status === "shipped",
      "order close leaves the last-run breadcrumb, naming the run it ended");
    const after = fire(ROOT, GUARD, { tool_name: "Write", tool_input: { file_path: join(root, "src/after.js"), content: "x" }, cwd: root });
    check(after.rows.at(-1)?.run_id === thisRun && after.rows.at(-1)?.run_closed === true,
      "a decision taken after the close still keys to the run, and says the run is over");
    put(root, gates, "");
    check(kernel(ROOT, ["order", "close", "--slug", SLUG, "--status", "escalated", "--cause", "budget"], { cwd: root }).status === 0 && json(closeFile).status === "escalated",
      "an escalated close needs no sign-off: an honest ending is never refused");
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

  // The hook's `cwd` follows the shell, so the project has to be found from wherever the shell sits.
  // Each case is its own project with a run open and an order live, and one write outside the order,
  // fired from `rel`. The ledger is NOT redirected here: where the row lands is what is being read.
  section("fence — the project is found from wherever the shell sits");
  const RUN = "demo-20260101T000000Z-deadbeef";
  const from = (rel, { git = true, open = true, prepare = () => {} } = {}) => {
    const p = scratch("fence-root", { git });
    try {
      const root = p.dir, shell = join(root, rel);
      mkdirSync(shell, { recursive: true });
      if (open) {
        put(root, `.shapeup/${SLUG}/receipt.json`, { run_id: RUN, slug: SLUG });
        put(root, ".shapeup/active-scope", { slug: SLUG, run_id: RUN });
        const path = put(root, `.shapeup/${SLUG}/orders/build.json`, {
          schema_version: 1, order_id: `${SLUG}/build`, worker: "task-executor", mode: "orchestrated", operation: "execute", payload: {},
          substrate: { allowed: ["src/**"], frozen: [`.shapeup/${SLUG}/**`], own: [`.shapeup/${SLUG}/results/build.json`] },
        });
        kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", path], { cwd: root });
      }
      prepare(shell);
      const r = fire(ROOT, GUARD, { tool_name: "Write", tool_input: { file_path: join(root, "lib/outside.js"), content: "x" }, cwd: shell },
        { env: { SHAPEUP_DECISIONS_PATH: "" } });
      const last = (file) => (existsSync(file) ? JSON.parse(slurp(file).trim().split("\n").at(-1)) : null);
      const inner = join(shell, ".shapeup/decisions.jsonl"), outer = join(root, ".shapeup/decisions.jsonl");
      return { denied: denied(r), text: r.out?.hookSpecificOutput?.permissionDecisionReason ?? "", inner: last(inner), outer: last(outer) };
    } finally { p.done(); }
  };
  const ownTier = (shell) => mkdirSync(join(shell, "shapeup/knowledge-base"), { recursive: true });

  let w = from("packages/app");
  check(w.denied && w.outer?.rule === "outside-substrate" && !w.inner, "a shell in a plain sub-folder is fenced like one at the top, and its row is filed with the run");
  w = from("vendor/plugin-copy", { prepare: ownTier });
  check(w.denied && w.outer?.rule === "outside-substrate", `a nested folder with its own committed tier does not switch the fence off: the write is denied, rule "${w.outer?.rule ?? w.inner?.rule}"`);
  check(w.outer?.run_id === RUN && !w.inner, "…and its row is in the project's ledger with the run's id, with no ledger started under the nested folder");
  check(/^Write fence/.test(w.text) && /PO's decision/.test(w.text) && !/remap|\(PA\d\)/.test(w.text), "the refusal names the write fence and the remedy, and no command of a retired skill");
  w = from("vendor/other-repo", { prepare: (shell) => { ownTier(shell); spawnSync("git", ["init", "-q"], { cwd: shell }); } });
  check(!w.denied && w.inner?.rule === "no-round", "a nested git repository stays its own project: the fence fails open rather than reach across a repository boundary");
  w = from("vendor/nested-run", { prepare: (shell) => { ownTier(shell); put(shell, ".shapeup/active-scope", { slug: "inner" }); } });
  check(!w.denied && w.inner?.rule === "no-round", "a nested folder with a run of its own still files under itself: the nearest live run wins");
  w = from("vendor/plugin-copy", { prepare: ownTier, open: false });
  check(!w.denied && w.inner?.rule === "no-round" && !w.outer, "with no run open, a nested folder with its own committed tier files under itself, as before");
  w = from("vendor/plugin-copy", { prepare: ownTier, git: false });
  check(!w.denied && w.inner?.rule === "no-round", "a run pointer in a folder that is no project (no committed tier, no repository) captures nothing beneath it");
}
