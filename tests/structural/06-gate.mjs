// The gate resolver, executed: each answer set against real gates, with the ledger read back.
//
// A gate pauses for the PO unless a pre-recorded answer set resolves it, and the set may choose
// among the answers a gate allows but never supply the evidence that makes one allowed. So the
// interesting cases are the refusals: `proceed` over a board with no tasks, `ship` with no census
// that cleared the run. Each is asserted against the same call the loop makes, and the source of
// every decision is read from the ledger rather than from what the command printed.
import { join } from "node:path";
import { scratch, put, kernel, slurp, existsSync } from "../lib/fixture.mjs";

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
