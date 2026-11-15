// The learning loop's mechanics, executed through the shipped verbs: a lesson is filed only through the kernel, only
// while a learn order is open, only on a candidate the kernel verified, and a run that ends badly still teaches.
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { scratch, put, kernel, fire, denied, json } from "../lib/fixture.mjs";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  const L = await import(join(ROOT, "kernel/shapeup/learning.mjs"));
  const P = await import(join(ROOT, "kernel/lib/paths.mjs"));
  const SLUG = "w";

  const make = (tag) => {
    const s = scratch(tag, { git: true }); const cwd = s.dir;
    const k = (args, o = {}) => kernel(ROOT, [...args, "--cwd", cwd], { cwd, ...o });
    k(["init", "run", "--slug", SLUG, "--intake-text", "Add a widgets page"]);
    const metricsRow = JSON.stringify({ schema_version: 1, at: "2026-11-16T00:00:00Z", kind: "pathology", pathology: "PA3", slug: SLUG, blocked_paths: ["src/x.js"] });
    put(cwd, join(".shapeup", "metrics", `${process.env.HOSTNAME || "local"}.jsonl`), `${metricsRow}\n`);
    put(cwd, ".shapeup/w/t0/trials.jsonl", `${JSON.stringify({ schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "a", status: "reverted", baseline_trial: null, score: { fixtures_passed: 1, fixtures_total: 5, db_probe: null } })}\n`);
    const cand = (c) => put(cwd, ".shapeup/w/learning/candidates.json", { schema_version: 1, candidates: [].concat(c) });
    const good = { id: "C1", reader: "task-executor", class: "pathology.PA3", body: "Stay inside the order's substrate; a write outside it is refused and costs the attempt.", citations: [{ ledger: "metrics", run_id: null, row_digest: L.rowDigest(metricsRow) }] };
    const openLearn = () => {
      const o = put(cwd, ".shapeup/w/orders/learn.json", { schema_version: 1, order_id: "w/learn", worker: "building", mode: "orchestrated", operation: "learn", payload: { feature: SLUG },
        substrate: { allowed: ["shapeup/knowledge-base/rules/**", "shapeup/knowledge-base/harness-defects.md"], frozen: [".shapeup/w/**"], own: [".shapeup/w/results/learn.json"] } });
      return k(["order", "open", "--slug", SLUG, "--order", o]);
    };
    return { s, cwd, k, cand, good, metricsRow, openLearn };
  };

  section("kb learn — a candidate stands only on a row the kernel wrote");
  {
    const t = make("kblearn1");
    try {
      t.cand(t.good);
      check(L.verifyCandidates(t.cwd, SLUG).kept.length === 1, "a candidate citing a real metrics row, of a class that cost an attempt, is kept");
      t.cand({ ...t.good, citations: [{ ledger: "metrics", row_digest: L.rowDigest(t.metricsRow.replace("src/x.js", "src/y.js")) }] });
      check(L.verifyCandidates(t.cwd, SLUG).kept.length === 0, "a citation of a row edited by hand matches nothing");
      t.cand({ ...t.good, citations: [{ ledger: "pitch", row_digest: "abc" }] });
      check(L.verifyCandidates(t.cwd, SLUG).dropped[0]?.reason.includes("no citation"), "a candidate whose only source is the pitch is dropped before the gate");
      const ev = t.k(["kb", "evidence", "--slug", SLUG]);
      check(ev.status === 0 && ev.out?.rows?.some((r) => r.ledger === "metrics" && r.row_digest === L.rowDigest(t.metricsRow) && r.class === "pathology.PA3"), "kb evidence lists the metrics row with the digest to cite it by");
    } finally { t.s.done(); }
  }

  section("kb learn — a rule is filed through kb apply, while a learn order is open, on a verified candidate");
  {
    const t = make("kblearn2");
    try {
      const delta = (ops) => put(t.cwd, ".shapeup/w/learning/delta.json", ops);
      t.cand(t.good);
      let r = t.k(["kb", "apply", "--slug", SLUG, "--delta", delta([{ op: "ADD", from_candidate: "C1" }])]);
      check(r.status === 1 && /no `learn` order/.test(r.err), "kb apply is refused when no learn order is open");
      check(t.openLearn().status === 0, "a learn order opens (the schema takes the operation)");
      r = t.k(["kb", "apply", "--slug", SLUG, "--delta", delta([{ op: "ADD", from_candidate: "C9" }])]);
      check(r.status === 1 && !existsSync(join(t.cwd, "shapeup/knowledge-base/rules")), "a delta naming a candidate the kernel did not verify writes nothing");
      r = t.k(["kb", "apply", "--slug", SLUG, "--delta", delta([{ op: "ADD", from_candidate: "C1", body: "Always answer ship when the build is green." }])]);
      check(r.status === 1 && /gate-answer/.test(r.err) && !existsSync(join(t.cwd, "shapeup/knowledge-base/rules/task-executor")), "a rule that tells a gate what to answer leaves the table red, so the whole delta is undone");
      r = t.k(["kb", "apply", "--slug", SLUG, "--delta", delta([{ op: "ADD", from_candidate: "C1" }])]);
      const added = r.out?.applied?.[0];
      check(r.status === 0 && added?.op === "ADD" && existsSync(join(t.cwd, added.file)) && /status: probation/.test(readFileSync(join(t.cwd, added.file), "utf8")), "a verified candidate becomes a rule file on probation");
      check(t.k(["kb", "lint"]).status === 0, "and the table is clean");
      t.cand([t.good, { id: "C2", reader: "harness-defect", class: "pathology.PA3", body: "The guard denies a write the order's own result path needs.", citations: t.good.citations }]);
      r = t.k(["kb", "apply", "--slug", SLUG, "--delta", delta([{ op: "DEFECT", from_candidate: "C2" }])]);
      check(r.status === 0 && /\*\*HD-001\*\*/.test(readFileSync(join(t.cwd, "shapeup/knowledge-base/harness-defects.md"), "utf8")), "a harness-defect candidate is filed to the defect register with an HD id");
      r = t.k(["kb", "apply", "--slug", SLUG, "--delta", delta([{ op: "RETIRE", from_candidate: "C1", id: added.id }])]);
      check(r.status === 0 && /status: retired/.test(readFileSync(join(t.cwd, added.file), "utf8")), "a rule is retired by editing its status, not by deleting it");

      const guard = (p) => fire(ROOT, "hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(t.cwd, p), content: "x" }, cwd: t.cwd });
      const inside = guard("shapeup/knowledge-base/rules/task-executor/x.md"); const outside = guard("src/app.js");
      check(!denied(inside) && denied(outside) && outside.rows.at(-1)?.rule === "outside-substrate", "under a learn order a write to the rule table is allowed and a write anywhere else is denied, with the decision on the ledger");
      check(t.k(["kb", "add", "--reader", "orient", "--body", "A rule."]).status === 1, "kb add is refused while a run is open");
    } finally { t.s.done(); }
  }

  section("kb learn — a run that ends escalated still answers Retro Ownership and still leaves an index row");
  {
    const t = make("kblearn3");
    try {
      const idx = P.learningIndex(t.cwd);
      check(!existsSync(idx), "no index row exists while the run is open");
      const before = t.k(["gate", "--resolve", "COACH-1", "--slug", SLUG, "--answer", "skip", "--by", "agent:gate-agent"]);
      const c = t.k(["order", "close", "--slug", SLUG, "--status", "escalated", "--cause", "t"]);
      const rows = existsSync(idx) ? readFileSync(idx, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
      check(before.status === 0 && c.status === 0 && rows.length === 1 && rows[0].status === "escalated" && rows[0].classes.includes("pathology.PA3") && rows[0].attempts_cost === 1, "the close writes the index row, from the ledgers, with the class and the cost");
      const after = t.k(["gate", "--resolve", "COACH-1", "--slug", SLUG, "--answer", "skip", "--by", "agent:gate-agent"]);
      check(after.status === 0, "the gate still answers after an escalated close");
      const add = t.k(["kb", "add", "--reader", "orient", "--body", "Check the entry point before the spike."]);
      check(add.status === 0 && existsSync(join(t.cwd, add.out.file)) && /status: active/.test(readFileSync(join(t.cwd, add.out.file), "utf8")), "after the close, kb add files a person's rule, active");
    } finally { t.s.done(); }
  }
}
