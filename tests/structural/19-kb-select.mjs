// The selector, executed through the shipped verb: `order open` chooses the rules an order loads, stays inside
// a budget, writes down what it chose, and is deterministic — and a project with no rule table is untouched.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { scratch, put, kernel, json, existsSync } from "../lib/fixture.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const kb = await import(join(ROOT, "kernel/shapeup/kb.mjs"));
  const rec = await import(join(ROOT, "hooks/dispatch-receipt.mjs"));
  const rule = (id, reader, body, over = {}) => kb.renderRule({ id, reader, kind: "guide", when: {}, status: "active", ...over }, body);
  const SLUG = "w";

  section("kb select — order open chooses by the order's own keys, and says what it chose");
  const s = scratch("kbsel", { git: true });
  try {
    const cwd = s.dir;
    const R = "shapeup/knowledge-base/rules/task-executor";
    put(cwd, `${R}/te-aaaaaaaa.general.md`, rule("te-aaaaaaaa", "task-executor", "General rule for every build order."));
    put(cwd, `${R}/te-bbbbbbbb.fix.md`, rule("te-bbbbbbbb", "task-executor", "Only when fixing a failed attempt.", { when: { operation: ["fix"] } }));
    put(cwd, `${R}/te-cccccccc.retired.md`, rule("te-cccccccc", "task-executor", "A rule that was retired.", { status: "retired" }));
    put(cwd, `${R}/te-dddddddd.prob.md`, rule("te-dddddddd", "task-executor", "A probationary rule.", { status: "probation" }));
    const order = (stem, operation) => put(cwd, `.shapeup/${SLUG}/orders/${stem}.json`, {
      schema_version: 1, order_id: `${SLUG}/${stem}`, worker: "task-executor", mode: "orchestrated", operation, payload: {},
      substrate: { allowed: ["src/**"], frozen: [`.shapeup/${SLUG}/**`], own: [`.shapeup/${SLUG}/results/${stem}.json`] },
    });
    const open = (p) => kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", p, "--cwd", cwd], { cwd });
    const compiled = (p) => readFileSync(join(cwd, json(p).payload.kb_rules_path), "utf8");

    const e1 = order("build-r1-a1", "execute");
    check(open(e1).status === 0, "an order opens with the selector in front of it");
    const t1 = compiled(e1); const set1 = json(e1).payload.kb_load_set;
    check(/te-aaaaaaaa/.test(t1) && /te-dddddddd/.test(t1), "an unconditioned rule and a probationary one are loaded");
    check(!/te-bbbbbbbb/.test(t1), "a rule conditioned on operation fix does not enter an execute order");
    check(!/te-cccccccc/.test(t1), "a retired rule never enters an order");
    check(Array.isArray(set1) && set1.length === 2, "the order carries the revisions it was given as kb_load_set");

    const e1b = order("build-r1-a1", "execute");
    open(e1b);
    check(json(e1b).payload.kb_rules_path === json(e1).payload.kb_rules_path && compiled(e1b) === t1 && JSON.stringify(json(e1b).payload.kb_load_set) === JSON.stringify(set1),
      "the same order opened twice gives the same set and the same compiled file, byte for byte");

    const e2 = order("build-r1-a2", "fix");
    open(e2);
    check(/te-bbbbbbbb/.test(compiled(e2)) && json(e2).payload.kb_load_set.length === 3, "the same rules and a fix order load the fix rule too");

    const row = rec.receiptRow(json(e2), "task-executor", { tool_name: "Agent", tool_response: { status: "completed" }, tool_input: {} });
    check(JSON.stringify(row.kb_load_set) === JSON.stringify(json(e2).payload.kb_load_set), "the dispatch receipt row carries the order's kb_load_set");

    section("kb select — the budget is never exceeded, over a synthetic store of 200 rules");
    const big = scratch("kbbig");
    try {
      for (let i = 0; i < 200; i++) {
        const id = `te-${String(i).padStart(8, "0")}`;
        const when = i % 3 === 0 ? { operation: ["fix"] } : i % 3 === 1 ? { operation: ["execute"] } : {};
        put(big.dir, `shapeup/knowledge-base/rules/task-executor/${id}.r.md`, rule(id, "task-executor", `Rule ${i}: ${"detail ".repeat(20 + (i % 40))}`, { when }));
      }
      for (const budget of [300, 1500]) {
        const c = kb.selectRules({ cwd: big.dir, reader: "task-executor", facts: { operation: ["execute"] }, budget });
        const used = c.entries.reduce((n, e) => n + Math.ceil(e.line.length / 4), 0);
        check(used <= budget && c.over_budget.length > 0, `budget ${budget}: the loaded rules fit (${used} tokens) and what did not fit is named, not dropped silently (${c.over_budget.length} over)`);
        check(c.text.includes("over_budget") && c.text.startsWith("<!-- load_set:"), `budget ${budget}: the compiled file names its load set and what it left out`);
      }
      const a = kb.selectRules({ cwd: big.dir, reader: "task-executor", facts: { operation: ["execute"] } });
      const b = kb.selectRules({ cwd: big.dir, reader: "task-executor", facts: { operation: ["execute"] } });
      check(a.text === b.text, "two selections over the same store are the same text");
    } finally { big.done(); }

    section("kb select — the loop's own rules are compiled once, when the run opens");
    const run1 = scratch("kbrun", { git: true });
    try {
      put(run1.dir, "shapeup/knowledge-base/rules/building/bu-11111111.g.md", rule("bu-11111111", "building", "Ask what a gate would otherwise skip.", { when: { gate: ["L4"] } }));
      const r = kernel(ROOT, ["init", "run", "--slug", "w", "--intake-text", "Add a widgets page", "--auto-level", "unattended", "--cwd", run1.dir], { cwd: run1.dir });
      const launch = json(join(run1.dir, ".shapeup/w/run-args.json"));
      check(r.status === 0 && launch.kb?.load_set?.length === 1 && existsSync(join(run1.dir, launch.kb.path)) && /## L4/.test(readFileSync(join(run1.dir, launch.kb.path), "utf8")), "init run compiles the loop's rules by gate into the launch record");
      const g = kernel(ROOT, ["gate", "--resolve", "L1a", "--slug", "w", "--answer", "proceed", "--by", "agent:gate-agent", "--cwd", run1.dir], { cwd: run1.dir });
      const last = readFileSync(join(run1.dir, ".shapeup/w/gates.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).at(-1);
      check(g.status === 0 && JSON.stringify(last.kb_load_set) === JSON.stringify(launch.kb.load_set), "a gate's ledger row carries the loop's load set");
    } finally { run1.done(); }
  } finally { s.done(); }

  section("kb select — a project with no rule table is untouched");
  const plain = scratch("kbplain", { git: true });
  try {
    put(plain.dir, "shapeup/knowledge-base/task-executor.md", "- **KB-TE-001** — A legacy rule.\n");
    const p = put(plain.dir, `.shapeup/${SLUG}/orders/b.json`, { schema_version: 1, order_id: `${SLUG}/b`, worker: "task-executor", mode: "orchestrated", operation: "execute", payload: { kb_rules_path: "shapeup/knowledge-base/task-executor.md" }, substrate: { allowed: ["src/**"], frozen: [], own: [] } });
    const r = kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", p, "--cwd", plain.dir], { cwd: plain.dir });
    const o = json(p);
    check(r.status === 0 && o.payload.kb_rules_path === "shapeup/knowledge-base/task-executor.md" && !("kb_load_set" in o.payload), "no rules/<reader>/ folder: the order keeps its legacy path and gains no load set");
    check(/legacy file is read as before/.test(r.err), "and one line says the legacy file is being read");
  } finally { plain.done(); }
}
