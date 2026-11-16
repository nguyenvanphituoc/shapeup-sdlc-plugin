// Probation, executed over synthetic chains of runs. The case that matters is the one where the failure class never
// happened: a check that passes when the thing it measures is absent promotes every rule for free, so that chain
// must NOT promote and must expire.
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { scratch, put, kernel } from "../lib/fixture.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const kb = await import(join(ROOT, "kernel/shapeup/kb.mjs"));
  const pr = await import(join(ROOT, "kernel/shapeup/probation.mjs"));
  const P = await import(join(ROOT, "kernel/lib/paths.mjs"));
  const CLASS = "pathology.PA3";
  const rule = { meta: { id: "te-11111111", targets: CLASS, status: "probation" } };
  const day = (n) => `2026-11-${String(n).padStart(2, "0")}T00:00:00Z`;
  const effect = (n, occurred = false) => Array.from({ length: n }, (_, i) => ({ run_id: `r${i}`, rule_id: rule.meta.id, targets: CLASS, loaded: true, occurred: occurred && i === n - 1, at: day(10 + i) }));
  const idx = (classes, n = 2) => Array.from({ length: n }, (_, i) => ({ run_id: `b${i}`, at: day(1 + i), classes }));

  section("kb probation — a chain in which the class never occurred promotes nothing, and expires");
  for (const n of [3, 5, 9]) check(pr.decide(rule, effect(n), idx([])).to === null, `${n} clean runs and no base rate: the rule waits, it is not promoted`);
  const none = pr.decide(rule, effect(pr.M_EXPIRE), idx([]));
  check(none.to === "expired" && /no base rate/.test(none.why), `after ${pr.M_EXPIRE} runs with no base rate the rule expires`);
  check(pr.decide(rule, effect(20), idx([], 1)).to !== "active", "a single earlier occurrence is not a base rate");

  section("kb probation — a base rate and a clean stretch promote; a recurrence retires");
  check(pr.decide(rule, effect(pr.N_PROMOTE - 1), idx([CLASS])).to === null, "with a base rate, fewer than the needed clean runs keep it waiting");
  const up = pr.decide(rule, effect(pr.N_PROMOTE), idx([CLASS]));
  check(up.to === "active" && /did not occur/.test(up.why), "a base rate and the needed clean runs promote it, and the reason says what was seen");
  const down = pr.decide(rule, effect(pr.N_PROMOTE, true), idx([CLASS]));
  check(down.to === "retired" && /happened again/.test(down.why), "the class coming back in a run that loaded the rule retires it");
  check(pr.decide({ meta: { id: "te-2", status: "probation" } }, [], []).to === null, "a rule that names no class never moves by itself");

  section("kb probation — the close records the effect, and review applies a change through the learn order only");
  const s = scratch("kbprob", { git: true }); const cwd = s.dir; const SLUG = "w";
  try {
    const k = (args) => kernel(ROOT, [...args, "--cwd", cwd], { cwd });
    put(cwd, "shapeup/knowledge-base/rules/task-executor/te-11111111.r.md", kb.renderRule({ id: "te-11111111", reader: "task-executor", kind: "guide", when: {}, targets: CLASS, status: "probation" }, "Stay inside the substrate."));
    const rev = kb.loadRules(cwd)[0].rev;
    k(["init", "run", "--slug", SLUG, "--intake-text", "x"]);
    const runId = JSON.parse(readFileSync(join(cwd, ".shapeup/w/receipt.json"), "utf8")).run_id;
    put(cwd, ".shapeup/w/orders/build-r1-a1.json", { schema_version: 1, order_id: "w/build-r1-a1", run_id: runId, worker: "task-executor", mode: "orchestrated", operation: "execute", payload: { kb_load_set: [rev] }, substrate: { allowed: ["src/**"], frozen: [], own: [] } });
    const rv = k(["kb", "review", "--slug", SLUG]);
    check(rv.status === 0 && rv.out.rules[0]?.id === "te-11111111" && rv.out.rules[0].to === null, "kb review reports a rule on probation, undecided");
    check(k(["kb", "review", "--slug", SLUG, "--apply"]).status === 1, "kb review --apply is refused when no learn order is open");
    k(["order", "close", "--slug", SLUG, "--status", "escalated", "--cause", "t"]);
    const rows = existsSync(P.kbEffect(cwd)) ? readFileSync(P.kbEffect(cwd), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
    check(rows.length === 1 && rows[0].rule_id === "te-11111111" && rows[0].targets === CLASS && rows[0].loaded === true && rows[0].occurred === false, "the close records one effect row for the rule the run loaded: its class, and whether the class occurred");
    check(!JSON.stringify(readFileSync(join(cwd, "shapeup/knowledge-base/rules/task-executor/te-11111111.r.md"), "utf8")).includes("run_id"), "no counter is written into the committed rule file");

    section("kb probation — review --apply under a learn order promotes, retires with a defect, and touches only status");
    const t = scratch("kbprob2", { git: true });
    try {
      const k2 = (args) => kernel(ROOT, [...args, "--cwd", t.dir], { cwd: t.dir });
      const wr = (id, targets) => put(t.dir, `shapeup/knowledge-base/rules/task-executor/${id}.r.md`, kb.renderRule({ id, reader: "task-executor", kind: "guide", when: {}, targets, status: "probation" }, `Rule ${id} body.`));
      wr("te-aaaaaaaa", CLASS); wr("te-bbbbbbbb", "t0.flat");
      k2(["init", "run", "--slug", SLUG, "--intake-text", "x"]);
      const eff = (id, tg, n, occ) => Array.from({ length: n }, (_, i) => JSON.stringify({ run_id: `r${i}`, rule_id: id, targets: tg, loaded: true, occurred: occ && i === 1, at: day(10 + i) })).join("\n");
      put(t.dir, ".shapeup/_kb/effect.jsonl", `${eff("te-aaaaaaaa", CLASS, 3, false)}\n${eff("te-bbbbbbbb", "t0.flat", 3, true)}\n`);
      put(t.dir, ".shapeup/_learning/index.jsonl", [...idx([CLASS]), ...idx(["t0.flat"])].map((r) => JSON.stringify({ ...r, run_id: r.run_id + r.classes[0] })).join("\n") + "\n");
      const o = put(t.dir, ".shapeup/w/orders/learn.json", { schema_version: 1, order_id: "w/learn", worker: "building", mode: "orchestrated", operation: "learn", payload: { feature: SLUG }, substrate: { allowed: ["shapeup/knowledge-base/rules/**", "shapeup/knowledge-base/harness-defects.md"], frozen: [], own: [] } });
      k2(["order", "open", "--slug", SLUG, "--order", o]);
      const a = k2(["kb", "review", "--slug", SLUG, "--apply"]);
      const text = (id) => readFileSync(join(t.dir, `shapeup/knowledge-base/rules/task-executor/${id}.r.md`), "utf8");
      check(a.status === 0 && a.out.applied.some((x) => x.op === "PROMOTE" && x.id === "te-aaaaaaaa") && /status: active/.test(text("te-aaaaaaaa")), "a rule with a base rate and clean runs is promoted by a change of its status");
      check(a.out.applied.some((x) => x.op === "RETIRE" && x.id === "te-bbbbbbbb" && x.defect === "HD-001") && /status: retired/.test(text("te-bbbbbbbb")), "a rule whose class came back is retired and filed to the defect register");
      check(/Rule te-aaaaaaaa body\./.test(text("te-aaaaaaaa")) && !/run_id/.test(text("te-aaaaaaaa")), "only the status changed; the body is the same and no counter entered the file");
    } finally { t.done(); }
  } finally { s.done(); }
}
