#!/usr/bin/env node
// The learning loop, driven through the real kernel verbs and the real hooks in a real project directory — the
// loop's own moves are made by this script instead of a model, so the part a model cannot be asked to prove (that
// the records the kernel and the hooks write are the ones the loop's lesson-filing reads) is exercised at the path
// a consumer would have, with the plugin somewhere else.
//
// Two runs, one ending in `shipped` and one in `escalated`; each must leave: a rule chosen onto an order and onto its
// dispatch receipt, the guard's pathology row and a T0 trial the lesson cites, a Retro Ownership row answered by
// `agent:gate-agent` and not narrowed, a rule filed on probation and a defect in the register through `kb apply`, the
// table clean under lint, and a cross-run index row written by the close.
//
// Usage: node tools/verify-learning-loop.mjs [--project <dir>]   (default: a scratch directory)
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--project");
const proj = i > 0 ? resolve(process.argv[i + 1]) : mkdtempSync(join(tmpdir(), "learning-loop-"));
const kernel = join(ROOT, "kernel/harness.mjs");
let failures = 0;
const check = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++; };
const put = (rel, body) => { const p = join(proj, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2)); return p; };
const K = (args) => { const r = spawnSync("node", [kernel, ...args, "--cwd", proj], { cwd: proj, encoding: "utf8" }); let out = null; try { out = JSON.parse(r.stdout); } catch { /* not json */ } return { status: r.status, out, err: r.stderr, raw: r.stdout }; };
const hook = (script, payload) => { const r = spawnSync("node", [join(ROOT, script)], { cwd: proj, input: JSON.stringify(payload), encoding: "utf8" }); let out = null; try { out = JSON.parse(r.stdout); } catch { /* none */ } return { status: r.status, out }; };
const jl = (rel) => existsSync(join(proj, rel)) ? readFileSync(join(proj, rel), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const { rowDigest } = await import(join(ROOT, "kernel/shapeup/learning.mjs"));
const { metricsShard, learningIndex } = await import(join(ROOT, "kernel/lib/paths.mjs"));

mkdirSync(proj, { recursive: true });
if (!existsSync(join(proj, ".git"))) { spawnSync("git", ["init", "-q", "-b", "main"], { cwd: proj }); }
if (!existsSync(join(proj, "shapeup/knowledge-base/rules"))) cpSync(join(ROOT, "shapeup/knowledge-base/rules"), join(proj, "shapeup/knowledge-base/rules"), { recursive: true });
put("shapeup/pitch.md", "---\nappetite: small\nstatus: shaped\nbet: true\n---\n# hello\nA greeter.\n");

for (const ending of ["shipped", "escalated"]) {
  const slug = `learn-${ending}`;
  console.log(`\n▸ run ending ${ending}`);
  rmSync(join(proj, ".shapeup", slug), { recursive: true, force: true });
  rmSync(join(proj, "shapeup", slug), { recursive: true, force: true });
  const open = K(["init", "run", "--slug", slug, "--intake-file", "shapeup/pitch.md", "--no-qa", "--no-eval"]);
  check(open.status === 0, "init run opens the run");
  const runId = JSON.parse(readFileSync(join(proj, `.shapeup/${slug}/receipt.json`), "utf8")).run_id;

  // A build order: the kernel chooses the rules when it opens.
  const orderPath = put(`.shapeup/${slug}/orders/sc-a-r1-a1.json`, { schema_version: 1, order_id: `${slug}/sc-a-r1-a1`, run_id: runId, worker: "task-executor", mode: "orchestrated", operation: "execute",
    payload: { scope_contract: { scope_id: "sc-a" } }, substrate: { allowed: ["src/**"], frozen: [`.shapeup/${slug}/**`], own: [`.shapeup/${slug}/results/sc-a-r1-a1.json`] } });
  const o = K(["order", "open", "--slug", slug, "--order", orderPath]);
  const ord = JSON.parse(readFileSync(orderPath, "utf8"));
  check(o.status === 0 && ord.payload.kb_load_set?.length >= 2 && existsSync(join(proj, ord.payload.kb_rules_path)), `order open chose ${ord.payload.kb_load_set?.length} rule(s) and wrote ${ord.payload.kb_rules_path}`);
  // The retired guide is never loaded: two guides and the check, and from the second run on the rule the first run filed.
  check(ending === "shipped" ? ord.payload.kb_load_set?.length === 3 : ord.payload.kb_load_set?.length === 4, `the table loads two guides and the check${ending === "shipped" ? "" : ", and the rule the first run filed"} — the retired guide is not loaded`);

  // The dispatch receipt (the real hook) carries the set.
  const d = hook("hooks/dispatch-receipt.mjs", { tool_name: "Agent", tool_input: { subagent_type: "shapeup-sdlc-plugin:task-executor", prompt: `--order ".shapeup/${slug}/orders/sc-a-r1-a1.json"` },
    tool_response: { status: "completed", agentType: "shapeup-sdlc-plugin:task-executor", agentId: "a1", totalTokens: 100, totalDurationMs: 5, resolvedModel: "claude-sonnet-5-5" }, cwd: proj });
  const receipt = jl(`.shapeup/${slug}/receipts/dispatch.jsonl`).at(-1);
  check(JSON.stringify(receipt?.kb_load_set) === JSON.stringify(ord.payload.kb_load_set), "the dispatch receipt names the same rules the order was given");

  // The guard records a pathology when the worker writes outside its substrate.
  const w = hook("hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(proj, "lib/outside.js"), content: "x" }, cwd: proj });
  const metricsRow = jl(`.shapeup/metrics/${(process.env.HOSTNAME || "local")}.jsonl`).filter((r) => r.slug === slug).at(-1);
  check(w.out?.hookSpecificOutput?.permissionDecision === "deny" && metricsRow?.pathology === "PA3", "a write outside the substrate is denied and the guard records PA3");

  // T0: a regression, through the real verb.
  const contract = put(`shapeup/${slug}/scopes/sc-a.json`, { schema_version: 1, scope_id: "sc-a", allowed_file_substrate: ["src/**"], e2e_verification_fixtures: ["node -e \"process.exit(0)\"", "node -e \"process.exit(0)\""] });
  K(["verify", "t0", contract, "--round", "1", "--attempt", "1", "--out", join(proj, `.shapeup/${slug}`), "--no-ratchet"]);
  put(`shapeup/${slug}/scopes/sc-a.json`, { schema_version: 1, scope_id: "sc-a", allowed_file_substrate: ["src/**"], e2e_verification_fixtures: ["node -e \"process.exit(0)\"", "node -e \"process.exit(1)\""] });
  K(["verify", "t0", contract, "--round", "1", "--attempt", "2", "--out", join(proj, `.shapeup/${slug}`), "--no-ratchet"]);
  const trials = jl(`.shapeup/${slug}/t0/trials.jsonl`);
  check(trials.length === 2 && trials[1].status === "reverted", "the second attempt is worse and the ratchet reverts it");

  put(`.shapeup/${slug}/results/sc-a-r1-a1.json`, { schema_version: 1, order_id: `${slug}/sc-a-r1-a1`, worker: "task-executor", status: "done" });

  // Reflect: the evidence the kernel lists, the candidates cited from it.
  const ev = K(["kb", "evidence", "--slug", slug]);
  const pa3 = ev.out?.rows?.find((r) => r.class === "pathology.PA3"); const reg = ev.out?.rows?.find((r) => r.class === "t0.regressed");
  check(ev.status === 0 && pa3 && reg && ev.out.classes.includes("pathology.PA3") && ev.out.classes.includes("t0.regressed") && ev.out.attempts_cost === 1, "kb evidence lists the metrics row and the regressed trial, with the cost of the run");
  put(`.shapeup/${slug}/learning/candidates.json`, { schema_version: 1, run_id: runId, candidates: [
    { id: "C1", reader: "task-executor", class: "pathology.PA3", body: "A write outside the order's substrate is refused by the fence and costs the attempt; list the files a change needs before editing, and ask for the substrate to be widened rather than writing around it.", citations: [{ ledger: pa3.ledger, run_id: pa3.run_id, row_digest: pa3.row_digest }] },
    { id: "C2", reader: "harness-defect", class: "t0.regressed", body: "A second attempt that regresses is reverted with no word to the worker about which fixture it broke.", citations: [{ ledger: reg.ledger, run_id: reg.run_id, row_digest: reg.row_digest }] },
    { id: "C3", reader: "plan", class: "pathology.PA3", body: "From the pitch alone.", citations: [{ ledger: "pitch", row_digest: "deadbeef" }] },
  ] });
  const g = K(["gate", "--resolve", "COACH-1", "--slug", slug, "--answer", "file", "--by", "agent:gate-agent", "--note", "C1 to task-executor; C2 a mechanism defect"]);
  check(g.status === 0 && g.out?.decision === "file" && g.out.candidates.join() === "C1,C2" && g.out.dropped_candidates?.[0]?.id === "C3", "the gate files C1 and C2 and the kernel drops C3 (its only source is the pitch)");
  const gateRow = jl(`.shapeup/${slug}/gates.jsonl`).at(-1);
  check(gateRow?.gate === "COACH-1" && gateRow.source === "agent:gate-agent" && gateRow.decision === "file" && Array.isArray(gateRow.kb_load_set) === (existsSync(join(proj, ".shapeup", slug, "run-args.json")) && Boolean(JSON.parse(readFileSync(join(proj, ".shapeup", slug, "run-args.json"), "utf8")).kb)), "the Retro Ownership row is answered by agent:gate-agent, ledgered, and carries the loop's load set when the project has loop rules");

  // Learn: the order, then the kernel's writer.
  const learn = put(`.shapeup/${slug}/orders/learn.json`, { schema_version: 1, order_id: `${slug}/learn`, run_id: runId, worker: "building", mode: "orchestrated", operation: "learn", payload: { feature: slug },
    substrate: { allowed: ["shapeup/knowledge-base/rules/**", "shapeup/knowledge-base/harness-defects.md"], frozen: [`.shapeup/${slug}/**`], own: [`.shapeup/${slug}/results/learn.json`] } });
  check(K(["order", "open", "--slug", slug, "--order", learn]).status === 0, "the learn order opens");
  const fence = hook("hooks/sandbox-guard.mjs", { tool_name: "Write", tool_input: { file_path: join(proj, "src/app.js"), content: "x" }, cwd: proj });
  check(fence.out?.hookSpecificOutput?.permissionDecision === "deny", "while it is open, a write outside the rule table is denied");
  const delta = put(`.shapeup/${slug}/learning/delta.json`, [{ op: "ADD", from_candidate: "C1" }, { op: "DEFECT", from_candidate: "C2" }]);
  const a = K(["kb", "apply", "--slug", slug, "--delta", delta]);
  check(a.status === 0 && a.out?.applied?.length === 2 && (ending === "shipped" ? !a.out.applied[0].skipped : /already filed as probation/.test(a.out.applied[0].skipped)), `kb apply files the rule and the defect (${a.out?.applied?.map((x) => x.id).join(", ")})`);
  const added = a.out?.applied?.find((x) => x.op === "ADD");
  check(ending !== "shipped" || (added && /status: probation/.test(readFileSync(join(proj, added.file), "utf8")) && /targets: pathology.PA3/.test(readFileSync(join(proj, added.file), "utf8"))), ending === "shipped" ? "the new rule is on probation and names the class it targets" : "the same lesson filed in a second run is not filed twice");
  check(K(["kb", "lint"]).status === 0, "the table is clean under lint");
  const rv = K(["kb", "review", "--slug", slug]);
  const mine = rv.out?.rules?.find((r) => r.id === (added?.id ?? a.out?.applied?.find((x) => x.op === "ADD")?.id));
  check(rv.status === 0 && (ending === "shipped" ? mine?.to === null : mine?.to === "retired"), ending === "shipped"
    ? "kb review lists the new rule as waiting for a base rate"
    : "the rule the first run filed was loaded in this run and the class it targets happened again, so review retires it");
  put(`.shapeup/${slug}/results/learn.json`, { schema_version: 1, order_id: `${slug}/learn`, worker: "building", status: "done" });

  if (ending === "shipped") {
    put(`.shapeup/${slug}/reports/hammer-census.json`, { schema_version: 1, verdict: "ship-now", cut_list: [], ship_blocking: [], breaker: null, baseline: null });
    check(K(["gate", "--resolve", "L4", "--slug", slug, "--answer", "ship", "--by", "agent:gate-agent", "--round", "1"]).status === 0, "Ship Sign-off crosses on the census");
  }
  const idxBefore = jl(".shapeup/_learning/index.jsonl").length;
  const c = K(["order", "close", "--slug", slug, "--status", ending, "--cause", "verify-learning-loop"]);
  check(c.status === 0, `the run closes ${ending}`);
  const idx = jl(".shapeup/_learning/index.jsonl");
  check(idx.length === idxBefore + 1 && idx.at(-1).run_id === runId && idx.at(-1).status === ending && idx.at(-1).classes.includes("pathology.PA3"), "the close wrote the run's row of the cross-run index from the ledgers");
  const eff = jl(".shapeup/_kb/effect.jsonl");
  check(eff.every((r) => r.rule_id && r.targets), "the effect counters are written beside it (a rule that targets a class and was loaded)");
}
console.log(`\nproject: ${proj}`);
if (i < 0) rmSync(proj, { recursive: true, force: true });
if (failures) { console.error(`❌ verify:learning — ${failures} check(s) failed`); process.exit(1); }
console.log("✅ verify:learning — both endings reflected, filed through the kernel and left an index row");
