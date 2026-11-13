// The core, driven by a second workflow: a toy profile with its own root names, ref namespace, gates,
// evidence rule, contract layout and fixtures runs the receipt, the hook runtime, the gate resolver and
// the T0 ratchet end to end. Everything it imports is under kernel/core/ — if the core needed one more
// Shape Up fact to do this, the run below would fail, and the fact would belong in the profile.
//
// Still Shape Up's own, because they carry its rules rather than a mechanism: what its receipt holds and the
// refusals before a run opens (roster, floor, launch record), and the committed-tier check of the guard hook.
import { join } from "node:path";
import { readFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { scratch, put, json, slurp } from "../lib/fixture.mjs";
import { TRACE, GATES, narrowToy, CONTRACT_SPEC } from "../lib/toy-profile.mjs";
import { resolveGate } from "../../kernel/core/gate.mjs";
import { appendLedger } from "../../kernel/core/ledger.mjs";
import { validate } from "../../kernel/core/envelope.mjs";
import { parseContract } from "../../kernel/core/contract.mjs";
import { floorProblems } from "../../kernel/core/floor.mjs";
import { judgeWrites } from "../../kernel/core/fence.mjs";
import { openOrder, closeRun } from "../../kernel/core/order.mjs";
import { writeRun } from "../../kernel/core/run.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const s = scratch("core", { git: true });
  const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { cwd: s.dir, encoding: "utf8", ...o });
  try {
    const cwd = s.dir;

    section("core — the second workflow's imports are all under kernel/core/");
    for (const f of ["tests/structural/13-core-profile.mjs", "tests/lib/toy-profile.mjs", "tests/lib/toy-t0.mjs", "tests/lib/toy-hook.mjs"]) {
      const bad = [...readFileSync(join(ROOT, f), "utf8").matchAll(/from\s+"([^"]*kernel\/[^"]*)"/g)].map((m) => m[1]).filter((p) => !/kernel\/core\//.test(p));
      check(bad.length === 0, `${f} imports nothing from the kernel outside kernel/core/${bad.length ? ": " + bad.join(", ") : ""}`);
    }

    section("core — a run key and a trace under the toy's own roots");
    const startedAt = "2026-11-13T09:00:00Z";
    mkdirSync(join(cwd, "toy"), { recursive: true });
    const receipt = TRACE.receipt(cwd, "feat");
    check(receipt.includes(".toy-local") && !receipt.includes("shapeup"), "the receipt lands under the toy's local root, not another workflow's");
    const opened = writeRun(TRACE, cwd, "feat", { receipt: { slug: "feat", started_at: startedAt, intake_sha256: "ab" }, launch: { slug: "feat" }, intake: "toy intake", startedAt, dirs: ["orders"] });
    check(opened.receiptPath === receipt && existsSync(receipt) && json(TRACE.runArgsPath(cwd, "feat")).slug === "feat" && json(TRACE.activeScope(cwd)).slug === "feat" && slurp(join(cwd, ".toy-local/feat/intake.md")) === "toy intake\n", "opening a run writes the intake, the receipt, the launch record and the run pointer under the toy's root");
    const runId = TRACE.readRunId(cwd, "feat");
    check(TRACE.RUN_ID_PATTERN.test(runId ?? ""), `the run key is minted from the receipt (${runId})`);
    check(TRACE.insideRunTrace(join(cwd, ".toy-local", "feat")) && !TRACE.insideRunTrace(join(cwd, ".shapeup")), "the run-trace test follows the toy's local root");

    section("core — a hook decision lands in the toy's ledger, keyed to the run");
    const h = spawnSync("node", [join(ROOT, "tests/lib/toy-hook.mjs")], { cwd, encoding: "utf8", env: { ...process.env, TOY_DECISIONS_PATH: "" } });
    const ledger = join(cwd, ".toy-local/decisions.jsonl");
    const row = existsSync(ledger) ? JSON.parse(slurp(ledger).trim().split("\n").at(-1)) : null;
    check(h.status === 0 && row?.verdict === "deny" && row?.run_id === runId, "the hook runtime records the decision with the run it belongs to, in the toy's own ledger");
    check(!existsSync(join(cwd, ".shapeup")), "nothing was written under another workflow's root");

    section("core — a gate resolves from the toy's table, narrowed by the toy's rule");
    check(resolveGate(GATES, "open", "go", "t", null).status === "ok", "an answer in the table crosses");
    check(resolveGate(GATES, "open", "ship", "t", null).status === "error", "an answer the gate does not take is an error");
    check(resolveGate(GATES, "nope", "go", "t", null).status === "error", "an unknown gate is an error");
    const ctx2 = { cwd, slug: "feat" };
    const refused = narrowToy(resolveGate(GATES, "close", "ship", "t", null), ctx2);
    check(refused.status === "ask" && refused.refused === "ship", "the toy's evidence rule refuses a ship nothing supports");
    put(cwd, ".toy-local/feat/evidence.txt", "x");
    check(narrowToy(resolveGate(GATES, "close", "ship", "t", null), ctx2).status === "ok", "with the evidence on disk the same answer crosses");
    check(appendLedger(join(cwd, ".toy-local/feat/gates.jsonl"), { gate: "close", decision: "ship" }) && slurp(join(cwd, ".toy-local/feat/gates.jsonl")).includes("ship"), "the crossing is appended to the gate ledger");

    const dr = TRACE.dispatchReceipts(cwd, "feat");
    check(appendLedger(dr, { run_id: runId, order_id: "feat/o1", skill_invoked: "toy-worker", usage: { model: "toy-1" } }) && dr.includes(".toy-local") && JSON.parse(slurp(dr).trim()).skill_invoked === "toy-worker", "a dispatch receipt is appended under the toy's own run trace, one row per dispatch");

    section("core — the T0 ratchet keeps a strictly better attempt and rolls a worse one back");
    put(cwd, "src/a.txt", "seed\n");
    put(cwd, ".gitignore", ".toy-local/\n");
    sh("git", ["add", "-A"]); sh("git", ["commit", "-q", "-m", "seed"]);
    const attempt = (n, fixtures, edit) => {
      put(cwd, "src/a.txt", edit);
      const contract = put(cwd, "toy/feat/scopes/s1.json", { id: "s1", writes: ["src/**"], fixtures });
      const r = spawnSync("node", [join(ROOT, "tests/lib/toy-t0.mjs"), contract, "--round", "1", "--attempt", String(n), "--cwd", cwd], { cwd, encoding: "utf8" });
      let out = null; try { out = JSON.parse(r.stdout); } catch { /* not JSON */ }
      return { status: r.status, out, err: r.stderr };
    };
    const one = attempt(1, ["true", "false"], "v1\n");
    check(one.out?.status === "kept" && one.out?.tree_ref === "refs/toy/s1/kept", `the first attempt is kept under the toy's own ref namespace (${one.out?.tree_ref})`);
    const two = attempt(2, ["false", "false"], "worse\n");
    check(two.out?.status === "reverted" && slurp(join(cwd, "src/a.txt")) === "v1\n", "a worse attempt is reverted and its files restored to the last kept tree");
    const three = attempt(3, ["true", "true"], "v3\n");
    check(three.out?.status === "kept" && three.status === 0, "a strictly better attempt is kept");
    const trials = slurp(join(cwd, ".toy-local/feat/t0/trials.jsonl")).trim().split("\n").map((l) => JSON.parse(l));
    check(trials.length === 3 && trials.every((t) => t.run_id === runId), "three trial rows, each carrying the run key");
    check(sh("git", ["rev-parse", "--verify", "--quiet", "refs/toy/s1/kept"]).status === 0 && sh("git", ["rev-parse", "--verify", "--quiet", "refs/shapeup/s1/kept"]).status !== 0, "the shadow ref is in the toy's namespace and nothing in the other one");

    section("core — the fence is armed, judges a write by the live contract, and is retired when the run closes");
    const orderPath = put(cwd, ".toy-local/feat/orders/o1.json", { order_id: "feat/o1", substrate: { allowed: ["src/**"], frozen: ["src/frozen/**"] } });
    const armed = openOrder(TRACE, cwd, "feat", orderPath, { validate: (o) => ({ valid: !!o.order_id, errors: [] }) });
    check(armed.ok && existsSync(TRACE.activeOrder(cwd)) && json(orderPath).compiled_at, "opening an order arms the pointer under the toy's root and stamps the order");
    check(!openOrder(TRACE, cwd, "feat", put(cwd, "bad.json", {}), { validate: (o) => ({ valid: !!o.order_id, errors: ["no id"] }) }).ok, "an order its validator refuses is not armed");
    const contracts = [{ order_id: "feat/o1", allowed: ["src/**"], appendOnly: [], frozen: ["src/frozen/**"], own: [] }];
    const judge = (rel) => judgeWrites({ paths: [join(cwd, rel)], realRoot: realpathSync(cwd), contracts, agents: new Map(), tool: "Write", writer: null, tracePrefix: ".toy-local/feat/" });
    check(judge("src/ok.txt").violations.length === 0, "a write inside the live substrate is permitted");
    check(judge("lib/out.txt").violations.length === 1, "a write outside it is a violation");
    check(judge("src/frozen/x.txt").frozenHits === 1, "a frozen path inside an allowed glob is still refused");
    const closed = closeRun(TRACE, cwd, "feat", "aborted", "toy ended");
    check(closed.status === "aborted" && !existsSync(TRACE.activeOrder(cwd)) && !existsSync(TRACE.activeScope(cwd)) && json(join(cwd, ".toy-local/feat/close.json")).cause === "toy ended", "closing the run retires both pointers and records the ending");

    section("core — the contract parser, validator and floor take their data as arguments");
    check(parseContract("---\nid: s9\nwrites: [a, b]\n---\nprose\n", CONTRACT_SPEC).writes?.length === 2, "the contract parser reads frontmatter under a caller-supplied layout");
    const schema = { type: "object", required: ["id"], properties: { id: { type: "string" } } };
    check(validate({ id: "x" }, schema, cwd).valid && !validate({}, schema, cwd).valid, "the validator checks against a schema in a directory the caller names");
    const fl = { patterns: [/tiny/i], roles: ["do"], label: "the toy floor" };
    check(floorProblems({ do: "tiny-1" }, fl).length === 1 && floorProblems({ do: "big" }, fl).length === 0, "the model floor applies the caller's denylist to the caller's roles");
  } finally { s.done(); }
}
