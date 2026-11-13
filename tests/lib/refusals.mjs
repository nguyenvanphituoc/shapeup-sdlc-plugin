// Every refusal and denial the gate, the fence and the envelope check can emit, produced by running the
// shipped commands against a scratch project. The returned map is what the golden file holds: a stage
// that moves code may not change a string the gate agent reads.
import { join } from "node:path";
import { scratch, put, fire, kernel } from "./fixture.mjs";

const ORDER = { schema_version: 1, order_id: "demo/orient", worker: "orient", mode: "orchestrated", operation: "orient", payload: { feature: "demo" } };

export function captureRefusals(ROOT) {
  const out = {};
  const s = scratch("golden", { git: true });
  try {
    const cwd = s.dir;
    const norm = (v) => JSON.stringify(v ?? null).split("/private" + cwd).join("<DIR>").split(cwd).join("<DIR>").split(cwd.replace(/^\/private/, "")).join("<DIR>")
      .replace(/w-\d{8}T\d{6}Z-[0-9a-f]+/g, "<RUN>").replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<TS>").replace(/"(run_id|digest|sha256|compiled_at)":"[^"]*"/g, '"$1":"<X>"');
    const rec = (name, r) => { out[name] = { status: r.status, out: JSON.parse(norm(r.out)), err: norm(r.err).slice(1, -1) }; };
    const k = (args, o = {}) => kernel(ROOT, [...args, "--cwd", cwd], { cwd, ...o });
    const gate = (id, extra = []) => k(["gate", "--resolve", id, "--slug", "w", "--round", "1", ...extra]);

    k(["init", "run", "--slug", "w", "--intake-text", "Add a widgets page", "--auto-level", "unattended"]);
    rec("gate/no-answer", gate("L1a"));
    rec("gate/ask", gate("L1a", ["--answer", "ask"]));
    rec("gate/unknown-gate", gate("NOPE", ["--answer", "proceed"]));
    rec("gate/abort", gate("L1a", ["--answer", "abort"]));
    rec("gate/L2-empty-board", gate("L2", ["--answer", "proceed", "--by", "agent:gate-agent"]));
    rec("gate/L4-no-census", gate("L4", ["--answer", "ship", "--by", "agent:gate-agent"]));
    put(cwd, ".shapeup/w/reports/hammer-census.json", { schema_version: 1, verdict: "cannot-ship", cut_list: [], ship_blocking: ["x"], breaker: null, baseline: null });
    rec("gate/L4-cannot-ship", gate("L4", ["--answer", "ship", "--by", "agent:gate-agent"]));
    rec("gate/L3-bad-answer", gate("L3", ["--answer", "ship", "--by", "agent:gate-agent"]));
    rec("gate/nested-trace", kernel(ROOT, ["gate", "--resolve", "L1a", "--slug", "w", "--answer", "proceed"], { cwd: join(cwd, ".shapeup/w") }));

    // fence
    const order = put(cwd, ".shapeup/w/orders/b1.json", {
      schema_version: 1, order_id: "w/b1", worker: "task-executor", mode: "orchestrated", operation: "execute", payload: {},
      substrate: { allowed: ["src/**"], frozen: [".shapeup/w/**", "src/frozen/**"], own: [".shapeup/w/results/b1.json"] },
    });
    rec("order/open", k(["order", "open", "--slug", "w", "--order", order]));
    put(cwd, "invalid.json", { schema_version: 1, order_id: "w/invalid", mode: "orchestrated", payload: {} });
    rec("order/open-invalid", k(["order", "open", "--slug", "w", "--order", join(cwd, "invalid.json")]));
    const write = (path, content = "x") => fire(ROOT, "hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(cwd, path), content }, cwd });
    const hook = (name, r) => { out[name] = { status: r.status, out: JSON.parse(norm(r.out)), err: norm(r.err).slice(1, -1), rule: r.rows.at(-1)?.rule ?? null }; };
    hook("fence/outside-substrate", write("lib/outside.js"));
    hook("fence/frozen", write("src/frozen/x.js"));
    hook("fence/order-dir", write(".shapeup/w/orders/other.json"));
    hook("fence/allowed", write("src/a.js"));
    rec("order/close-shipped-unsigned", k(["order", "close", "--slug", "w", "--status", "shipped"]));
    k(["order", "close", "--slug", "w", "--status", "aborted", "--cause", "golden"]);
    hook("fence/tier-run-trace-path", write("shapeup/demo/spec/a.md", "see .shapeup/w/board.md"));
    hook("fence/tier-board-id", write("shapeup/demo/spec/b.md", "see TASK-004 for this"));

    // envelope
    const env = (toolInput) => kernel(ROOT, ["verify", "envelope"], { cwd, input: JSON.stringify({ tool_name: "Agent", tool_input: toolInput, cwd }), env: { SHAPEUP_DECISIONS_PATH: join(cwd, "decisions.jsonl") } });
    const noWorker = put(cwd, ".shapeup/demo/orders/no-worker.json", { ...ORDER, worker: undefined });
    const badMode = put(cwd, ".shapeup/demo/orders/bad-mode.json", { ...ORDER, mode: "freestyle" });
    const retired = put(cwd, ".shapeup/demo/orders/spike.json", { ...ORDER, operation: "spike" });
    rec("envelope/missing-field", env({ prompt: `--order "${noWorker}"` }));
    rec("envelope/bad-enum", env({ prompt: `--order "${badMode}"` }));
    rec("envelope/retired-operation", env({ prompt: `--order "${retired}"` }));
    rec("envelope/absent-order", env({ prompt: `--order "${join(cwd, "nope.json")}"` }));
    const rs = join(ROOT, "kernel/schemas/work-result.schema.json");
    rec("envelope/result-bad-status", kernel(ROOT, ["verify", "envelope", put(cwd, "bad.json", { schema_version: 1, order_id: "x", worker: "orient", status: "finished" }), rs], { cwd }));
    rec("envelope/result-absent", kernel(ROOT, ["verify", "envelope", join(cwd, "absent.json"), rs], { cwd }));
  } finally { s.done(); }
  return out;
}
