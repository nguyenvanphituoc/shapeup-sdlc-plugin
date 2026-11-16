// The check registry, executed: a rule of kind `check` names a closed check; the kernel runs it with T0 over the
// scope's fixtures, a finding is an instruction to the worker, and a check that finds nothing adds nothing — to the
// rules a worker reads, to the verdict, or to any gate.
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { scratch, put, kernel, json, existsSync } from "../lib/fixture.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const kb = await import(join(ROOT, "kernel/shapeup/kb.mjs"));
  const reg = await import(join(ROOT, "kernel/shapeup/checks.mjs"));
  const NAME = "fixture-negation-has-twin";

  section("kb checks — the first check reads a fixture in both directions");
  const bad = "! test -f missing.txt";
  const good = "test -f seed.txt && ! test -f missing.txt";
  check(reg.runChecks([{ id: "te-1", check: NAME, params: {} }], { fixtures: [bad] }).length === 1, "a fixture whose pass condition is 'this command fails', with no run of it in the normal form, is reported");
  check(reg.runChecks([{ id: "te-1", check: NAME, params: {} }], { fixtures: [good, "node --test"] }).length === 0, "the same probe run once normally and once negated is not reported, and a plain fixture is not either");
  const f = reg.runChecks([{ id: "te-1", check: NAME, params: {} }], { fixtures: [bad] })[0];
  check(/both directions/.test(f.message) && f.rule === "te-1", "the finding is worded as an instruction the worker can follow, and names its rule");
  check(reg.runChecks([{ id: "te-1", check: "no-such-check", params: {} }], { fixtures: [bad] }).length === 0, "a check the registry does not hold runs nothing");

  section("kb checks — lint refuses a check it does not hold, and the compiled file is unchanged when a check is silent");
  const s = scratch("kbchk", { git: true }); const cwd = s.dir;
  try {
    const R = "shapeup/knowledge-base/rules/task-executor";
    put(cwd, `${R}/te-aaaaaaaa.g.md`, kb.renderRule({ id: "te-aaaaaaaa", reader: "task-executor", kind: "guide", when: {}, status: "active" }, "A guide."));
    const withCheck = () => put(cwd, `${R}/te-bbbbbbbb.c.md`, kb.renderRule({ id: "te-bbbbbbbb", reader: "task-executor", kind: "check", check: NAME, when: {}, status: "active" }, "Why the check exists."));
    const before = kb.selectRules({ cwd, reader: "task-executor", facts: { operation: ["execute"] } });
    withCheck();
    const after = kb.selectRules({ cwd, reader: "task-executor", facts: { operation: ["execute"] } });
    check(before.text === after.text && after.checks.length === 1 && after.load_set.length === before.load_set.length + 1, "adding a check adds nothing to the compiled text, and the check is in the load set the receipt records");
    put(cwd, `${R}/te-cccccccc.x.md`, kb.renderRule({ id: "te-cccccccc", reader: "task-executor", kind: "check", check: "made-up", when: {}, status: "active" }, "Nope."));
    check(kb.lintRules(cwd).some((p) => p.rule === "check-name" && p.file.includes("te-cccccccc")), "a rule naming a check outside the registry makes lint red");
    put(cwd, `${R}/te-cccccccc.x.md`, kb.renderRule({ id: "te-cccccccc", reader: "task-executor", kind: "check", check: NAME, params: { depth: 3 }, when: {}, status: "active" }, "Params with no home."));
    check(kb.lintRules(cwd).some((p) => p.rule === "check-params"), "a parameter the check does not take makes lint red");
  } finally { s.done(); }

  section("kb checks — verify t0 reports a finding beside the verdict and never moves it");
  {
    const t = scratch("kbchk2", { git: true });
    try {
      put(t.dir, "src/seed.txt", "x\n"); put(t.dir, ".gitignore", ".shapeup/\n");
      put(t.dir, "shapeup/knowledge-base/rules/task-executor/te-bbbbbbbb.c.md", kb.renderRule({ id: "te-bbbbbbbb", reader: "task-executor", kind: "check", check: NAME, when: {}, status: "active" }, "Why."));
      for (const a of [["add", "-A"], ["commit", "-q", "-m", "s"]]) spawnSync("git", a, { cwd: t.dir });
      const run1 = (fixtures, n) => {
        const contract = put(t.dir, "scopes/demo.json", { schema_version: 1, scope_id: "demo", allowed_file_substrate: ["src/**"], e2e_verification_fixtures: fixtures });
        const r = kernel(ROOT, ["verify", "t0", contract, "--round", "1", "--attempt", String(n), "--cwd", t.dir, "--out", join(t.dir, ".shapeup/demo"), "--no-ratchet"], { cwd: t.dir });
        return { ...r, art: r.out?.path ? json(resolve(t.dir, r.out.path)) : null };
      };
      const flagged = run1(["! test -f nope.txt"], 1);
      check(flagged.out?.rule_checks?.[0]?.check === NAME && flagged.art?.rule_checks?.length === 1, "a negated-only fixture is reported in the printed answer and in the artifact");
      check(flagged.out?.overall === "green" && flagged.status === 0, "and the verdict is exactly what the fixture earned — the check did not move it");
      const clean = run1(["test -f src/seed.txt && ! test -f nope.txt"], 2);
      check(clean.out?.rule_checks === undefined && !("rule_checks" in clean.art), "a fixture that is right leaves no finding anywhere");
    } finally { t.done(); }
  }

  section("kb checks — this repository's guide became the check");
  const own = kb.loadRules(ROOT).filter((r) => r.readers.includes("task-executor"));
  check(own.some((r) => r.meta.kind === "check" && r.meta.check === NAME && r.meta.status === "active") && own.some((r) => r.meta.aliases?.includes("KB-TE-002") && r.meta.status === "retired"), "the active guide that asked for the same thing is retired, and the check is active");
}
