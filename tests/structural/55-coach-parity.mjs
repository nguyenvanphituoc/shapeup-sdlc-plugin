// 55 (sections 56–56c) — the knowledge base coaches the workflow, and never a gate.
//
// Three edges kept in lock-step, each of which has drifted silently before in this repo:
//
//   (a) the kernel's `COACHABLE` set (the only place `payload.kb_rules_path` is handed over), the
//       schema's `x-payload-by-worker` registry, and the coach skill's category table all name the
//       same workers — a worker the coach files rules for but the kernel never hands the path to
//       is a write-only knowledge base, the defect the coach exists to prevent;
//   (b) every coachable worker's SKILL.md reads the file (not merely declares the field), the
//       tech lead reads its own file at GATE L0, and the two never-coachable roles stay out;
//   (c) `scan` is an operation the schema knows and the kernel sandboxes to the knowledge base,
//       and the gate-inert invariant is written where the coach and the tech lead will read it;
//   (d) a `scan` dispatch travels the whole envelope port in a sample project: `compile` issues
//       the WorkOrder, the sandbox hook fences the coach to the knowledge base while the order is
//       live, a dummy worker answers with a WorkResult, and `ingest` refuses it until a receipt
//       attests the shipped skill ran — then the finished dispatch fences nothing.
//
// (d) exists because (c) passed green while `compile --operation scan` exited 2: `substrateFor`
// and the enum were both right, and the one table between them (`OP_OWNER`) had no row. A check
// that calls the library skips the CLI's worker resolution; only the dispatch path runs it.
//
// The invariant itself — guidance never decides a gate — cannot be executed here, since it is a
// rule about what a filed rule may say. What can be pinned is that every place that reads the
// knowledge base states it, so a future edit that drops the sentence is a build failure.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Run the coach/knowledge-base parity checks.
 * @param {object} ctx - Shared structural-test context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when every check in section 55 has been recorded on ctx.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  // =============================================================================
  section("56. Coachable set — kernel, schema registry and the coach's categories agree");
  // =============================================================================

  const compile = await import(pathToFileURL(join(ROOT, "kernel/compile.mjs")).href);
  const COACHABLE = compile.COACHABLE;
  if (!(COACHABLE instanceof Set) || COACHABLE.size === 0) {
    fail("kernel/compile.mjs exports no COACHABLE set");
    return;
  }

  const domain = readJSON(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"));
  const registry = domain["x-payload-by-worker"] || {};
  const registered = new Set(
    Object.entries(registry)
      .filter(([, fields]) => Array.isArray(fields) && fields.includes("kb_rules_path"))
      .map(([worker]) => worker),
  );
  const kernelOnly = [...COACHABLE].filter((w) => !registered.has(w));
  const registryOnly = [...registered].filter((w) => !COACHABLE.has(w));
  if (kernelOnly.length === 0 && registryOnly.length === 0) {
    ok(`COACHABLE ↔ x-payload-by-worker[kb_rules_path] agree on ${COACHABLE.size} workers`);
  } else {
    if (kernelOnly.length) fail(`kernel hands kb_rules_path to ${kernelOnly.join(", ")} but the registry does not list it`);
    if (registryOnly.length) fail(`registry lists kb_rules_path for ${registryOnly.join(", ")} but the kernel never hands it over`);
  }

  const coach = read(join(ROOT, "skills/coach/SKILL.md"));
  // The category table: one row per reader, keyed by the file each one reads.
  for (const w of [...COACHABLE, "tech-lead"]) {
    if (coach.includes(`\`shapeup/knowledge-base/${w}.md\``)) ok(`coach categories include ${w}`);
    else fail(`skills/coach/SKILL.md has no category row for ${w} (shapeup/knowledge-base/${w}.md)`);
  }
  for (const never of ["spec-evaluator", "scope-hammer"]) {
    if (COACHABLE.has(never)) fail(`${never} must never be coachable (single judge / mechanical census) but is in COACHABLE`);
    else if (registered.has(never)) fail(`${never} must never be coachable but the registry hands it kb_rules_path`);
    else if (coach.includes(`\`${never}\` is never a category`)) ok(`${never} is stated never-coachable in the coach's hard rules`);
    else fail(`skills/coach/SKILL.md does not state "\`${never}\` is never a category"`);
  }

  // =============================================================================
  section("56b. Every reader reads — the file is loaded, not merely declared");
  // =============================================================================

  for (const w of COACHABLE) {
    const rel = `skills/${w}/SKILL.md`;
    const p = join(ROOT, rel);
    if (!existsSync(p)) { fail(`${rel} missing for coachable worker ${w}`); continue; }
    const txt = read(p);
    // §50 already pins the declaration; this pins the read — the prose must tell the worker to
    // read the path, and must say what the file is not (steering, never spec / never a gate).
    const reads = /kb_rules_path[^\n]*\n?[^\n]*\b(read|Read)\b/.test(txt) || /\b(read|Read)\b[^\n]*kb_rules_path/.test(txt);
    const bounded = /steering, never spec/i.test(txt) || /never a reason to skip/i.test(txt);
    if (reads && bounded) ok(`${w} reads its knowledge-base file and bounds it as steering`);
    else fail(`${rel}: ${reads ? "" : "never tells the worker to read payload.kb_rules_path; "}${bounded ? "" : "does not bound the file as steering, never spec"}`);
  }

  const gates = read(join(ROOT, "skills/tech-lead/references/gates.md"));
  if (gates.includes("shapeup/knowledge-base/tech-lead.md")) ok("tech-lead reads knowledge-base/tech-lead.md at GATE L0");
  else fail("skills/tech-lead/references/gates.md never reads shapeup/knowledge-base/tech-lead.md");
  if (/Nothing in that file answers a gate/.test(gates)) ok("GATE L0 states that the tech-lead file answers no gate");
  else fail("gates.md L0.10 does not state that the knowledge base answers no gate");

  // =============================================================================
  section("56c. `scan` is an operation, sandboxed to the knowledge base; the invariant is written");
  // =============================================================================

  const ops = domain.$defs?.Operation?.enum || [];
  if (ops.includes("scan") && ops.includes("coach")) ok("Operation enum carries both coach and scan");
  else fail(`Operation enum lacks scan (has: ${ops.join(", ")})`);

  const kb = compile.substrateFor("scan", { slug: "x", specDir: "shapeup/x/spec" });
  const kbCoach = compile.substrateFor("coach", { slug: "x", specDir: "shapeup/x/spec" });
  if (JSON.stringify(kb) === JSON.stringify(kbCoach) && (kb.allowed || []).every((g) => g.includes("knowledge-base")))
    ok("substrateFor(scan) equals substrateFor(coach): the knowledge base only");
  else fail(`substrateFor(scan) = ${JSON.stringify(kb)} — expected the coach's knowledge-base-only substrate`);

  if (/Guidance never decides a gate/.test(coach) && /## Operation: scan/.test(coach)) ok("coach states the gate-inert invariant and documents the scan operation");
  else fail("skills/coach/SKILL.md must state 'Guidance never decides a gate' and carry '## Operation: scan'");
  if (/project-scan @/.test(coach)) ok("scanned rules carry project-scan provenance");
  else fail("skills/coach/SKILL.md never names the project-scan @ <sha> provenance");

  const agents = read(join(ROOT, "AGENTS.md"));
  if (/Guidance never decides a gate/.test(agents)) ok("AGENTS.md carries the invariant");
  else fail("AGENTS.md does not state 'Guidance never decides a gate'");

  // =============================================================================
  section("56d. A scan dispatch travels the envelope port: order in, hook-fenced, result out, attested");
  // =============================================================================
  //
  // A sample project with nothing but a run receipt and the committed tier's root, and a dummy
  // worker that does exactly what the coach's contract says: writes a knowledge-base file and
  // answers its order with a WorkResult carrying only the fields `x-result-by-worker` grants it.

  const SLUG = "demo";
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  const ws = mkdtempSync(join(tmpdir(), "coach-scan-"));
  const w = (rel, body) => {
    const p = join(ws, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
    return p;
  };
  // Decision rows land per-cwd here (the runner otherwise pools them), so the hook's own ledger
  // is part of what the fixture can inspect — the same opt-out the hook-receipt module takes.
  const env = { ...process.env };
  delete env.SHAPEUP_DECISIONS_PATH;
  const harness = (...argv) => spawnSync(process.execPath, [KERNEL, ...argv, "--cwd", ws], { encoding: "utf8", env });
  const askGuard = (rel) => {
    const payload = JSON.stringify({ tool_name: "Write", cwd: ws, tool_input: { file_path: join(ws, rel), content: "x" } });
    const r = spawnSync(process.execPath, [GUARD], { encoding: "utf8", input: payload, env });
    return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), exit: r.status, out: r.stdout + r.stderr };
  };

  try {
    spawnSync("git", ["init", "-q"], { cwd: ws });
    w(`.shapeup/${SLUG}/receipt.json`, { schema_version: 1, slug: SLUG, started_at: "2026-09-13T09:00:00.000Z", intake_sha256: "deadbeef" });
    mkdirSync(join(ws, "shapeup", SLUG), { recursive: true });

    // --- 1. ORDER IN: the CLI must resolve a worker for `scan` on its own ----------------------
    const c = harness("compile", "--operation", "scan", "--slug", SLUG, "--payload", "{}");
    const orderPath = c.status === 0 ? c.stdout.trim() : null;
    let order = null;
    try { order = orderPath ? JSON.parse(readFileSync(orderPath, "utf8")) : null; } catch { order = null; }
    if (order) ok(`compile --operation scan resolves a worker and writes ${orderPath.replace(ws + "/", "")}`);
    else { fail(`compile --operation scan produced no order (exit ${c.status}): ${(c.stderr || c.stdout).trim()}`); return; }

    if (order.worker === "coach" && order.operation === "scan") ok("the scan order is addressed to the coach, operation scan");
    else fail(`scan order names worker=${order.worker} operation=${order.operation}`);
    if (order.mode === "orchestrated" && order.compiled_at) ok("the scan order is orchestrated and dated — ingest will demand a receipt for it");
    else fail(`scan order mode=${order.mode} compiled_at=${order.compiled_at} — the attestation gate would not apply`);
    if ((order.substrate?.allowed || []).length && order.substrate.allowed.every((g) => g.includes("knowledge-base")))
      ok("the order's substrate is the knowledge base only");
    else fail(`scan order substrate = ${JSON.stringify(order.substrate)}`);
    if (!("kb_rules_path" in (order.payload || {}))) ok("the coach is the KB's writer, not a reader: no kb_rules_path in its own payload");
    else fail("compile handed the coach a kb_rules_path — the coach is not in COACHABLE and must not be");

    // --- 2. THE FENCE, while the dispatch is live ----------------------------------------------
    w(".shapeup/active-order", { slug: SLUG, order_path: `.shapeup/${SLUG}/orders/scan.json` });
    const kbWrite = askGuard("shapeup/knowledge-base/tech-lead.md");
    if (!kbWrite.denied && kbWrite.exit === 0) ok("live scan order: a write to shapeup/knowledge-base/tech-lead.md is permitted");
    else fail(`live scan order: the knowledge-base write was denied or errored (exit ${kbWrite.exit})\n${kbWrite.out}`);
    const defectWrite = askGuard("shapeup/knowledge-base/harness-defects.md");
    if (!defectWrite.denied && defectWrite.exit === 0) ok("live scan order: the defect register is inside the substrate");
    else fail(`live scan order: the defect-register write was denied (exit ${defectWrite.exit})`);
    const profileWrite = askGuard(`shapeup/${SLUG}/project-profile.md`);
    if (profileWrite.denied) ok("live scan order: the coach cannot write project-profile.md — Suggested run config stays a proposal (hook-enforced, not prose)");
    else fail("live scan order: the sandbox guard permitted the coach to write project-profile.md — the one-writer rule for the profile is prose only");
    const gateWrite = askGuard(".shapeup/gate-answers.json");
    if (gateWrite.denied) ok("live scan order: the coach cannot write the gate answer set — guidance never decides a gate, mechanically");
    else fail("live scan order: the sandbox guard permitted the coach to write .shapeup/gate-answers.json");

    // --- 3. RESULT OUT, from a dummy worker honouring x-result-by-worker[coach] ----------------
    w("shapeup/knowledge-base/tech-lead.md",
      "# Knowledge Base — tech-lead\n\n## Workflow guidance\n\n## Suggested run config\n- `archetype: cli` — package.json:5 `bin`  ·  from project-scan @ 0000000\n");
    const resultPath = w(`.shapeup/${SLUG}/results/scan.json`, {
      schema_version: 1, order_id: order.order_id, worker: "coach", status: "done",
      files_touched: [{ path: "shapeup/knowledge-base/tech-lead.md", change: "created" }],
      artifacts: ["shapeup/knowledge-base/tech-lead.md"],
      assumptions: ["archetype: cli — proposed from package.json:5, to be confirmed at GATE L0"],
      deviations: [],
    });

    // (a) No receipt: the dispatch is not attested, and an orchestrated order is refused.
    const i1 = harness("reduce", "ingest", resultPath);
    if (i1.status !== 0 && /no dispatch receipts|no receipt for/.test(i1.stderr)) ok("ingest refuses the scan result while no dispatch receipt attests it");
    else fail(`ingest accepted an unattested orchestrated scan result (exit ${i1.status})\n${i1.stdout}${i1.stderr}`);

    // (b) A receipt naming a different skill: the sub-agent improvised, the result is refused.
    const receipts = join(ws, ".shapeup", SLUG, "receipts", "dispatch.jsonl");
    mkdirSync(dirname(receipts), { recursive: true });
    const stamp = () => new Date(Date.now() + 1000).toISOString();
    appendFileSync(receipts, JSON.stringify({ at: stamp(), order_id: order.order_id, run_id: order.run_id ?? null,
      worker_declared: "coach", skill_invoked: "task-executor", dispatch_ok: true, tool: "Skill" }) + "\n");
    const i2 = harness("reduce", "ingest", resultPath);
    if (i2.status !== 0 && /different skill/.test(i2.stderr)) ok("ingest refuses the scan result when the receipt names a skill other than the coach");
    else fail(`ingest accepted a scan result attested by the wrong skill (exit ${i2.status})\n${i2.stdout}${i2.stderr}`);

    // (c) The shipped coach ran: attested, ingested, leg closed.
    appendFileSync(receipts, JSON.stringify({ at: stamp(), order_id: order.order_id, run_id: order.run_id ?? null,
      worker_declared: "coach", skill_invoked: "coach", dispatch_ok: true, tool: "Skill" }) + "\n");
    const i3 = harness("reduce", "ingest", resultPath);
    if (i3.status === 0 && /attested: demo\/scan ran coach/.test(i3.stdout) && /ingested demo\/scan/.test(i3.stdout))
      ok("ingest attests the scan result against the coach's receipt and applies it");
    else fail(`ingest refused an attested scan result (exit ${i3.status})\n${i3.stdout}${i3.stderr}`);
    if (!existsSync(join(ws, ".shapeup", SLUG, ".ingest.lock"))) ok("the ingest lock is released after the scan result");
    else fail("the ingest lock is still on disk after ingesting the scan result");

    // --- 4. A finished dispatch fences nothing --------------------------------------------------
    const after = askGuard(`shapeup/${SLUG}/project-profile.md`);
    if (!after.denied) ok("with the scan result on disk the order is answered: the same profile write is no longer fenced by it");
    else fail("the scan order still fences writes after its result landed — a finished dispatch must fence nothing");

  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
