// The gate resolver, executed: each answer set against real gates, with the ledger read back.
//
// A gate pauses for the PO unless a pre-recorded answer set resolves it, and the set may choose
// among the answers a gate allows but never supply the evidence that makes one allowed. So the
// interesting cases are the refusals: `proceed` over a board with no tasks, `ship` with no census
// that cleared the run. Each is asserted against the same call the loop makes, and the source of
// every decision is read from the ledger rather than from what the command printed.
import { join } from "node:path";
import { rmSync } from "node:fs";
import { scratch, put, kernel, slurp, json, existsSync } from "../lib/fixture.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const s = scratch("gate", { git: true });
  try {
    const cwd = s.dir;
    const k = (args) => kernel(ROOT, [...args, "--cwd", cwd], { cwd });
    const gate = (id, preset, extra = []) => k(["gate", "--resolve", id, "--slug", "w", "--preset", preset, "--round", "1", ...extra]);
    const rows = () => slurp(join(cwd, ".shapeup/w/gates.jsonl")).split("\n").filter(Boolean).map((l) => JSON.parse(l));

    section("gate — a run opens with its L0 row, and presets answer or stop");
    const open = k(["init", "run", "--slug", "w", "--intake-text", "Add a widgets page", "--auto-level", "unattended"]);
    check(open.status === 0 && rows()[0]?.gate === "L0" && rows()[0].decision === "proceed", "opening a run ledgers GATE L0 as proceed");
    let r = gate("L1a", "ci");
    check(r.status === 0 && r.out?.decision === "proceed", "preset ci crosses L1a (exit 0)");
    check(rows().at(-1)?.source === "preset:ci", "the ledger names the answer set as the source of the decision");
    r = gate("L1a", "interactive");
    check(r.status === 4, "preset interactive stops L1a for the PO (exit 4)");
    r = gate("L1b", "guarded");
    check(r.status === 4, "preset guarded stops the judgment gate L1b for the PO");
    r = gate("L1a", "ci", ["--answer", "abort"]);
    check(r.status === 5 && rows().at(-1)?.source === "PO (live)", "a live answer of abort exits 5 and is ledgered with the source PO (live)");
    r = gate("L1a", "ci", ["--answer", "proceed", "--by", "agent:gate-agent", "--note", "map covers the pitch"]);
    check(r.status === 0 && rows().at(-1)?.source === "agent:gate-agent" && rows().at(-1)?.note === "map covers the pitch", "--by and --note put the agent's name and reason in the row instead of PO (live)");
    check(kernel(ROOT, ["gate", "--resolve", "L1a", "--slug", "w", "--preset", "ci"], { cwd: join(cwd, ".shapeup/w") }).status === 2, "a gate resolved from inside a run trace is refused rather than ledgered in a nested one");
    r = gate("NOPE", "ci");
    check(r.status === 2, "an unknown gate id is a usage error (exit 2)");

    section("gate — L2 will not proceed over a board with no tasks");
    r = gate("L2", "ci");
    check(r.status === 4 && r.out?.refused === "proceed", "100% of nothing: preset ci is narrowed from proceed to ask over an empty board");
    put(cwd, ".shapeup/w/tasks/TASK-001-parse.md", "---\nid: TASK-001\nstatus: done\n---\nbody\n");
    r = gate("L2", "ci");
    check(r.status === 0 && r.out?.decision === "proceed", "with one task on the board the same preset proceeds");

    section("gate — L4 will not ship without a census that cleared the run");
    r = gate("L4", "ci");
    check(r.status === 4 && r.out?.refused === "ship", "no census on disk: ship is refused whatever the answer set says");
    r = gate("L4", "ci", ["--answer", "ship"]);
    check(r.status === 4, "a live PO answer of ship is narrowed the same way: an answer chooses, it never supplies the evidence");
    r = gate("L4", "ci", ["--answer", "ship", "--by", "agent:gate-agent", "--note", "looks fine"]);
    check(r.status === 4 && r.out?.refused === "ship", "an agent's ship over a census that does not clear is narrowed exactly as a preset's is");
    const census = (verdict, ship_blocking = []) => put(cwd, ".shapeup/w/reports/hammer-census.json", {
      schema_version: 1, verdict, cut_list: [], ship_blocking, breaker: null, baseline: null,
    });
    census("cannot-ship", ["the core flow does not work"]);
    r = gate("L4", "ci");
    check(r.status === 4, "a census whose verdict is cannot-ship does not clear the run");
    census("ship-now");
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.decision === "ship" && rows().at(-1)?.source === "preset:ci", "a ship-now census lets the set answer ship, and the row says so");
    put(cwd, ".shapeup/w/reports/hammer-census.json", "{ not json");
    r = gate("L4", "ci");
    check(r.status === 4, "a census that cannot be read proves nothing and does not clear the run");

    section("gate — L4 will not ship over a QA hunt the run owed and never paid");
    census("ship-now");
    r = gate("L3", "ci", ["--verdict", "pass"]);
    r = gate("QA", "ci");
    check(r.out?.decision === "run", "after a passing round GATE QA is answered run");
    r = gate("L4", "ci");
    check(r.status === 4 && r.out?.refused === "ship" && /no hunt was dispatched/.test(r.out?.qa || ""), "QA answered run and no hunt on disk: ship is refused, with the reason");
    r = gate("QA", "ci", ["--answer", "skip"]);
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.decision === "ship", "an explicit, ledgered skip of GATE QA lets the same census ship");
    r = gate("QA", "ci");
    put(cwd, ".shapeup/w/orders/hunt.json", { payload: { app_url: "http://localhost:1" } });
    put(cwd, ".shapeup/w/results/hunt.json", { status: "done", discoveries: [] });
    r = gate("L4", "ci");
    check(r.status === 4 && /charters/.test(r.out?.qa || ""), "a done hunt with no charters line in its report does not pay the debt");
    put(cwd, ".shapeup/w/qa/hunt-report.md", "charters: 0/3\n");
    r = gate("L4", "ci");
    check(r.status === 4 && /0 charters/.test(r.out?.qa || ""), "a done hunt over a reachable app that ran 0 charters does not pay it");
    put(cwd, ".shapeup/w/qa/hunt-report.md", "charters: 2/3\n");
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.decision === "ship", "a hunt that ran a charter pays it");
    put(cwd, ".shapeup/w/qa/hunt-report.md", "charters: 0/3\n");
    put(cwd, ".shapeup/w/results/hunt.json", { status: "failed", discoveries: [] });
    r = gate("L4", "ci");
    check(r.status === 0, "a hunt that says failed is honest about not hunting, and is accepted");

    section("gate — L4 reads the model that ran off the dispatch receipts, against the launch record");
    const runId = json(join(cwd, ".shapeup/w/receipt.json")).run_id;
    const receipt = (worker, model, extra = {}) => JSON.stringify({
      order_id: `w/${worker}`, run_id: runId, worker_declared: worker, skill_invoked: worker, dispatch_ok: true, tool: "Agent",
      usage: { tokens_total: 1, duration_ms: 1, model }, model_requested: null, ...extra,
    });
    const receipts = (...rows) => put(cwd, ".shapeup/w/receipts/dispatch.jsonl", rows.join("\n") + "\n");
    check(json(join(cwd, ".shapeup/w/run-args.json")).models.exec === "sonnet", "the launch record of this run asked for sonnet");
    receipts(receipt("orient", "claude-opus-5-5"), receipt("task-executor", "claude-opus-5-5"), receipt("task-executor", "claude-opus-5-5"),
      receipt("task-executor", null), receipt("spec-evaluator", "claude-sonnet-5-5"));
    r = gate("L4", "ci");
    const row = rows().at(-1);
    check(r.status === 0 && r.out?.decision === "ship" && r.out?.models?.mismatch?.length === 1 && /exec: .*sonnet.*3 receipts name claude-opus-5-5/.test(r.out.models.mismatch[0]),
      "workers that ran on a model other than the record's still ship, and the result names the role, the model and the receipt count");
    check(r.out?.models?.unreported === 1 && r.out.models.ran.eval["claude-sonnet-5-5"] === 1,
      "a receipt with no model is counted as unreported and claims nothing; the role that matched is not a mismatch");
    check(row?.gate === "L4" && /model differs from the launch record/.test(row.note || "") && row.models?.mismatch?.length === 1,
      "the ledger row carries the difference in its note and as data, so a cost read later is read against the model that ran");
    put(cwd, ".shapeup/w/orders/build-r1.json", { order_id: "w/build-r1", run_id: runId, worker: "task-executor", mode: "orchestrated" });
    put(cwd, ".shapeup/w/orders/plan-spec.json", { order_id: "w/plan-spec", run_id: runId, worker: "building", mode: "standalone" });
    receipts(receipt("orient", "claude-sonnet-5-5"));
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.decision === "ship" && JSON.stringify(r.out?.models?.unattested) === '["w/build-r1"]'
      && /no dispatch receipt for 1 dispatched order/.test(rows().at(-1)?.note || "") && rows().at(-1)?.models?.unattested?.length === 1,
      "a dispatched order no receipt names is written into the ship row as unattested, advisory and not refused; a planning order is not a dispatch");
    receipts();
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.models?.unattested?.includes("w/build-r1"), "a run with no receipts at all reads as unattested, not as empty evidence");
    rmSync(join(cwd, ".shapeup/w/orders/build-r1.json"));
    rmSync(join(cwd, ".shapeup/w/orders/plan-spec.json"));
    receipts(receipt("task-executor", "claude-sonnet-5-5"), receipt("spec-evaluator", "claude-haiku-4-5"));
    r = gate("L4", "ci");
    check(r.status === 4 && r.out?.refused === "ship" && /eval ran on claude-haiku-4-5.*below the model floor/.test(r.out?.reason || ""),
      "a judge that ran below the floor refuses ship: the floor applies to what ran, not only to what was asked");
    receipts(receipt("task-executor", "claude-sonnet-5-5"), receipt("qa-edge-hunter", "claude-haiku-4-5"));
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.models?.mismatch?.length === 1 && /^qa:/.test(r.out.models.mismatch[0]),
      "a hunter below the floor is not refused (qa is never held to it) but the difference is still written down");
    receipts(receipt("task-executor", "claude-sonnet-5-5"), receipt("spec-evaluator", "claude-haiku-4-5", { run_id: "some-other-run" }));
    r = gate("L4", "ci");
    check(r.status === 0 && r.out?.models?.mismatch?.length === 0, "receipts of another run are ignored");

    section("gate — an answer file, and a gate it does not answer");
    const file = join(cwd, "answers.json");
    const made = k(["gate", "--init", "--preset", "ci", "--by", "tester", "--out", file]);
    check(made.status === 0 && existsSync(file), "gate --init writes an answer file naming who authorised it");
    const v = k(["gate", "--verify", "--file", file]);
    check(v.status === 0, "gate --verify accepts a file it wrote");
    r = k(["gate", "--resolve", "L1a", "--slug", "w", "--file", file]);
    check(r.status === 0 && rows().at(-1)?.source.includes("answers.json"), "a gate is resolved from the file, and the ledger names the file");
    put(cwd, "bad-answers.json", "{ \"version\": 1");
    r = k(["gate", "--resolve", "L1a", "--slug", "w", "--file", join(cwd, "bad-answers.json")]);
    check(r.status !== 0, "an answer file that does not parse never resolves a gate");
  } finally { s.done(); }
}
