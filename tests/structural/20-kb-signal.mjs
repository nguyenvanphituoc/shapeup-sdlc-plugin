// The signal vocabulary, executed: an order's signals come from records the kernel or a hook wrote, a rule
// conditioned on one loads only where it holds, and every value of the vocabulary has a place that emits it.
import { join } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { scratch, put, kernel, json } from "../lib/fixture.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const kb = await import(join(ROOT, "kernel/shapeup/kb.mjs"));
  const sig = await import(join(ROOT, "kernel/shapeup/signals.mjs"));
  const rule = (id, body, when) => kb.renderRule({ id, reader: "task-executor", kind: "guide", when, status: "active" }, body);
  const SLUG = "w";

  section("kb signal — a fix order after a T0 regression loads the rule written for it, and an execute order does not");
  const s = scratch("kbsig", { git: true });
  try {
    const cwd = s.dir;
    const R = "shapeup/knowledge-base/rules/task-executor";
    put(cwd, `${R}/te-aaaaaaaa.reg.md`, rule("te-aaaaaaaa", "After a regression, restore before editing.", { signal: ["t0.regressed"] }));
    put(cwd, `${R}/te-bbbbbbbb.any.md`, rule("te-bbbbbbbb", "A rule with no conditions.", {}));
    const trial = (n, status, passed, base) => ({ schema_version: 1, trial: n, round: 1, attempt: n, scope_id: "sc-a", status, baseline_trial: base, score: { fixtures_passed: passed, fixtures_total: 5, db_probe: null } });
    put(cwd, `.shapeup/${SLUG}/t0/trials.jsonl`, [trial(1, "kept", 4, null), trial(2, "reverted", 2, 1)].map((r) => JSON.stringify(r)).join("\n") + "\n");
    const mk = (id, operation) => put(cwd, `.shapeup/${SLUG}/orders/${id}.json`, {
      schema_version: 1, order_id: `${SLUG}/${id}`, worker: "task-executor", mode: "orchestrated", operation,
      payload: { scope_contract: "shapeup/w/scopes/sc-a.md" }, substrate: { allowed: ["src/**"], frozen: [], own: [] },
    });
    const open = (p) => kernel(ROOT, ["order", "open", "--slug", SLUG, "--order", p, "--cwd", cwd], { cwd });
    const text = (p) => readFileSync(join(cwd, json(p).payload.kb_rules_path), "utf8");
    const fix = mk("r2-a1", "fix"); open(fix);
    check(/te-aaaaaaaa/.test(text(fix)), "a fix order after a regressed trial loads the rule conditioned on t0.regressed");
    const ex = mk("r1-a1", "execute"); open(ex);
    check(!/te-aaaaaaaa/.test(text(ex)) && /te-bbbbbbbb/.test(text(ex)), "the same rule does not load in an execute order of round 1");
    put(cwd, `.shapeup/${SLUG}/t0/trials.jsonl`, [trial(1, "kept", 4, null), trial(2, "reverted", 4, 1)].map((r) => JSON.stringify(r)).join("\n") + "\n");
    check(sig.signalsFor(cwd, SLUG, json(mk("r1-a3", "fix"))).includes("t0.flat") && sig.signalsFor(cwd, SLUG, json(mk("r1-a3", "fix"))).includes("attempt.ge2"), "a reverted trial that tied its baseline is t0.flat, and attempt 3 carries attempt.ge2");
    put(cwd, `.shapeup/${SLUG}/results/evaluate-r1.json`, { verdict: { overall: "FAIL", criteria: [{ criterion: "x", dimension: "security", verdict: "FAIL" }, { criterion: "y", verdict: "FAIL" }, { criterion: "z", verdict: "PASS" }] } });
    const s2 = sig.signalsFor(cwd, SLUG, json(mk("r2-a1", "fix")));
    check(s2.includes("round.ge2") && s2.includes("eval.fail.security") && s2.includes("eval.fail.spec-conformance") && !s2.includes("eval.fail.performance"), "a failed criterion of the previous verdict is eval.fail.<its dimension>, defaulting to spec-conformance");
    put(cwd, `.shapeup/${SLUG}/results/hunt.json`, { discoveries: [{ lens: "②concurrency" }, { lens: "residue" }] });
    check(sig.signalsFor(cwd, SLUG, json(mk("r1-a1", "fix"))).filter((x) => x.startsWith("qa.lens.")).join() === "qa.lens.concurrency,qa.lens.residue", "hunt findings tagged with a lens give qa.lens.<lens>");
  } finally { s.done(); }

  section("kb signal — the vocabulary has no value without an emitter, and lint refuses one it does not hold");
  const schema = JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8")).$defs.KbSignal;
  const emitter = (v) => schema["x-emitted-by"][v] ?? schema["x-emitted-by"][`${v.split(".").slice(0, -1).join(".")}.*`];
  const token = (v) => (v.startsWith("eval.fail.") ? "eval.fail." : v.startsWith("qa.lens.") ? "qa.lens." : v.startsWith("pathology.") ? "pathology" : v.split(".").pop());
  for (const v of schema.enum) {
    const f = emitter(v);
    check(f && existsSync(join(ROOT, f)) && readFileSync(join(ROOT, f), "utf8").includes(token(v)), `signal ${v} is emitted by ${f ?? "nothing"}`);
  }
  check(!/["']PA3["']/.test(readFileSync(join(ROOT, "hooks/sandbox-guard.mjs"), "utf8").replace(/\?\? "PA3"/, "")), "the guard takes PA3 from the vocabulary, not a literal of its own");
  const bad = scratch("kbsigbad");
  try {
    put(bad.dir, "shapeup/knowledge-base/rules/task-executor/te-11111111.x.md", rule("te-11111111", "Body.", { signal: ["made.up"] }));
    check(kb.lintRules(bad.dir).some((p) => p.rule === "when-value"), "a signal outside the vocabulary makes lint red");
  } finally { bad.done(); }
}
