#!/usr/bin/env node
// WorkOrder compiler (pure-skill architecture v1.0, plan P1).
//
// The orchestrator's pipeline sub-layer: assembles the structured input envelope a worker is
// dispatched with. Replaces tech-lead's hand-assembled `isolated_brief()` prose step and every
// worker's GATE A/B plumbing (path resolution, run-state parse, board glob-matching, dependency
// reads, mode detection). Deterministic, zero LLM tokens (DD-7).
//
// A worker depends on its ORDER, never on filesystem topology — moving a directory again
// (the v3.2 lesson) touches this script, zero skills.
//
// Zero dependencies, zero network.
//
// Usage:
//   Scope attempt (isolated attempt loop):
//     node skills/tech-lead/scripts/compile-order.mjs --scope docs/shapeup-sdlc/<slug>/scopes/<id>.json \
//          --round N --attempt M [--cwd <dir>] [--test-cmd "<cmd>"]
//   Single task (no scope contracts — pre-v0.3.0 boards):
//     node skills/tech-lead/scripts/compile-order.mjs --task TASK-003 --slug <slug> [--worker task-executor]
//     node skills/tech-lead/scripts/compile-order.mjs --next --slug <slug>
//   Non-build operation (planner/judge/QA dispatches; flag surface → operation + whitelist):
//     node skills/tech-lead/scripts/compile-order.mjs --operation reconcile --slug <slug> [--round N]
//          [--worker ba-pitch-analyzer] [--payload '<json>']
//
// Output: .shapeup-sdlc/<slug>/orders/<order-file>.json (schema-validated before write; a
// pretty-printed envelope, colocated so audits can read it). Prints the path on stdout.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate-envelope.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER_SCHEMA = JSON.parse(readFileSync(resolve(HERE, "../schemas/work-order.schema.json"), "utf8"));

// --- tiny frontmatter reader (scalar keys + [a, b] inline lists) --------------------------
export function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const c = line.indexOf(":");
    if (c === -1 || /^\s/.test(line)) continue;
    const key = line.slice(0, c).trim();
    let val = line.slice(c + 1).trim().replace(/^["']|["']$/g, "");
    if (/^\[.*\]$/.test(val)) {
      meta[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else meta[key] = val;
  }
  return meta;
}

/** Parse one TASK-NNN.md file → the task entry a WorkOrder carries. */
export function parseTaskFile(path) {
  const body = readFileSync(path, "utf8");
  const fm = frontmatter(body);
  const acceptance_criteria = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*- \[[ x]\]\s+(.*)$/);
    if (m) acceptance_criteria.push(m[1].trim());
  }
  return {
    id: fm.id || basename(path).match(/TASK-[\w.-]+?(?=-|\.md)/)?.[0] || basename(path, ".md"),
    title: fm.title || "",
    status: fm.status || "unknown",
    priority: Number(fm.priority) || 999,
    depends_on: Array.isArray(fm.depends_on) ? fm.depends_on : [],
    use_case_refs: Array.isArray(fm.use_case_refs) ? fm.use_case_refs : [],
    body_path: path,
    acceptance_criteria,
  };
}

/** All task entries on the LOCAL board for a slug. */
export function readBoard(cwd, slug) {
  const dir = join(cwd, ".shapeup-sdlc", slug, "tasks");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^TASK-[\w.-]+\.md$/i.test(f))
    .map((f) => parseTaskFile(join(dir, f)))
    .sort((a, b) => a.priority - b.priority);
}

/** Extract this scope's Decisions rows from the committed round ledger (advisor answers). */
export function ledgerDecisions(ledgerText, scopeId) {
  const decisions = [];
  let inDecisions = false;
  for (const line of (ledgerText || "").split(/\r?\n/)) {
    if (/^#+\s*Decisions/i.test(line)) { inDecisions = true; continue; }
    if (inDecisions && /^#+\s/.test(line)) inDecisions = false;
    if (!inDecisions || !line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((s) => s.trim()).filter(Boolean);
    if (cells.length < 2 || /^[-: ]+$/.test(cells[0])) continue;
    const id = cells.find((c) => /^ESC-\d+/i.test(c));
    if (!id) continue;
    if (scopeId && !cells.some((c) => c === scopeId)) continue;
    decisions.push({ id, answer: cells[cells.length - 1] });
  }
  return decisions;
}

/** The §8.3 move: mode/flag differences ARE write-contract differences. One whitelist
 *  template per operation, enforced by the sandbox hook instead of trusted to prose. */
export function substrateFor(operation, { slug, specDir, scope } = {}) {
  const local = `.shapeup-sdlc/${slug}`;
  const spec = specDir || `docs/shapeup-sdlc/${slug}/spec`;
  const scopesDir = `docs/shapeup-sdlc/${slug}/scopes`;
  const FROZEN_SPEC_CORE = [`${spec}/domain-model.md`, `${spec}/usecases/*.md#Steps`, `${spec}/contracts/**`, `${spec}/ux-behavior.md`];
  switch (operation) {
    case "execute": case "fix": case "spike":
      return {
        allowed: [...(scope?.allowed_file_substrate || []), `${local}/spikes/**`],
        shared: scope?.shared_substrate || [],
      };
    case "analyze":
      return { allowed: [`${spec}/**`, `${local}/**`], frozen: [] };
    case "generate-board":
      return {
        allowed: [`${local}/tasks/**`, `${spec}/scope-summary.md`],
        frozen: [...FROZEN_SPEC_CORE, `${scopesDir}/**`],
      };
    case "reconcile":
      return {
        allowed: [`${local}/tasks/**`, `${spec}/scope-summary.md`, `${spec}/synthesis.md`],
        append_only: [`${spec}/usecases/*.md#Invariants`, `${spec}/usecases/*.md#Test Surface`],
        frozen: FROZEN_SPEC_CORE,
      };
    case "retrofit-surface":
      return { allowed: [], append_only: [`${spec}/usecases/*.md#Test Surface`], frozen: FROZEN_SPEC_CORE };
    case "map-scopes": case "remap": case "split-scope":
      return {
        allowed: [`${scopesDir}/*.json`, `docs/shapeup-sdlc/${slug}/scope-board.md`],
        frozen: [...FROZEN_SPEC_CORE, `${local}/tasks/**`],
      };
    case "evaluate":
      return { allowed: [`${local}/evaluation/**`], frozen: [`${spec}/**`, `${local}/tasks/**`] };
    case "hunt": case "recheck":
      return { allowed: [`${local}/qa/**`], frozen: [`${spec}/**`, `${local}/tasks/**`] };
    case "orient":
      return { allowed: [`${local}/orient/**`], frozen: [`${spec}/**`] };
    default:
      return { allowed: [`${local}/**`] };
  }
}

/** Assemble a WorkOrder. Pure given its inputs; the CLI wrapper does the disk reads. */
export function compileOrder({
  slug, worker, mode = "orchestrated", operation, round, attempt,
  scope, tasks, decisions, digestedErrors, testCmd, payloadExtra, specDir, interaction,
}) {
  const suffix = round && attempt ? `r${round}-a${attempt}` : round ? `${operation}-r${round}` : operation;
  const order = {
    schema_version: 1,
    order_id: `${slug}/${suffix}`,
    worker,
    mode,
    ...(operation ? { operation } : {}),
    ...(interaction ? { interaction } : {}),
    substrate: substrateFor(operation, { slug, specDir, scope }),
    payload: {
      ...(scope ? { scope_contract: scope } : {}),
      ...(tasks?.length ? { tasks } : {}),
      ...(decisions?.length ? { decisions } : {}),
      ...(digestedErrors?.length ? { digested_errors: digestedErrors } : {}),
      ...(testCmd ? { verify: { test_cmd: testCmd, env: [] } } : {}),
      ...(payloadExtra || {}),
    },
  };
  const kbByWorker = { "task-executor": "task-executor", "ba-pitch-analyzer": "ba-pitch-analyzer", "qa-edge-hunter": "qa-edge-hunter" };
  if (kbByWorker[worker]) order.payload.kb_rules_path = `docs/shapeup-sdlc/knowledge-base/${kbByWorker[worker]}.md`;
  return order;
}

// ---------------------------------------------------------------------------
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
  };
  const has = (name) => args.includes(`--${name}`);
  const cwd = resolve(flag("cwd") || process.cwd());

  let slug = flag("slug");
  let scope = null;
  let specDir = flag("spec") || null;
  const scopePath = flag("scope");
  if (scopePath) {
    const abs = resolve(cwd, scopePath);
    scope = JSON.parse(readFileSync(abs, "utf8"));
    // docs/shapeup-sdlc/<slug>/scopes/<id>.json → slug
    if (!slug) slug = basename(dirname(dirname(abs)));
  }
  if (!slug) { console.error("compile-order: --slug (or a --scope path it derives from) is required"); process.exit(2); }
  if (!specDir && existsSync(join(cwd, "docs", "shapeup-sdlc", slug, "spec"))) {
    specDir = `docs/shapeup-sdlc/${slug}/spec`;
  }

  const round = Number(flag("round")) || null;
  const attempt = Number(flag("attempt")) || null;
  const worker = flag("worker") || (scopePath || flag("task") || has("next") ? "task-executor" : null);
  let operation = flag("operation") || (scopePath || flag("task") || has("next") ? "execute" : null);
  if (!worker || !operation) { console.error("compile-order: could not resolve --worker/--operation"); process.exit(2); }

  // Task selection.
  let tasks;
  const board = readBoard(cwd, slug);
  if (flag("task")) {
    tasks = board.filter((t) => t.id === flag("task"));
    if (!tasks.length) { console.error(`compile-order: ${flag("task")} not found on the ${slug} board`); process.exit(2); }
  } else if (has("next")) {
    const doneIds = new Set(board.filter((t) => t.status === "done").map((t) => t.id));
    tasks = board.filter((t) => t.status === "ready" && t.depends_on.every((d) => doneIds.has(d))).slice(0, 1);
    if (!tasks.length) { console.error("compile-order: no ready task with satisfied dependencies"); process.exit(2); }
  } else if (scope) {
    // Scope attempt: the scope's own task list if the contract names one, else every
    // not-done task on the board (the attempt loop owns sequencing, not the worker).
    const named = new Set(scope.tasks || []);
    tasks = board.filter((t) => (named.size ? named.has(t.id) : t.status !== "done"));
  }

  // Ledger decisions for this scope.
  const ledgerPath = join(cwd, "docs", "shapeup-sdlc", slug, "round-ledger.md");
  const decisions = existsSync(ledgerPath)
    ? ledgerDecisions(readFileSync(ledgerPath, "utf8"), scope?.scope_id)
    : [];

  // Digested errors from the previous attempt's T0 artifact (AEGIS triples).
  let digestedErrors = [];
  if (round && attempt && attempt > 1) {
    const prev = join(cwd, ".shapeup-sdlc", slug, "t0", "verdicts", `r${round}-a${attempt - 1}.json`);
    if (existsSync(prev)) {
      try { digestedErrors = JSON.parse(readFileSync(prev, "utf8")).discovered_tasks || []; } catch { /* stale artifact → none */ }
    }
  }

  let payloadExtra = {};
  if (flag("payload")) {
    try { payloadExtra = JSON.parse(flag("payload")); } catch (e) { console.error(`compile-order: --payload is not valid JSON (${e.message})`); process.exit(2); }
  }
  if (specDir && !payloadExtra.spec_folder) payloadExtra.spec_folder = specDir;
  if (!payloadExtra.feature) payloadExtra.feature = slug;

  const order = compileOrder({
    slug, worker, operation, round, attempt, scope, tasks, decisions, digestedErrors,
    testCmd: flag("test-cmd"), payloadExtra, specDir,
    interaction: has("pause-gates") ? { pause_gates: true } : { pause_gates: false },
  });

  const { valid, errors } = validate(order, ORDER_SCHEMA);
  if (!valid) {
    console.error("compile-order: produced an order that fails its own schema — refusing to write:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  const outDir = join(cwd, ".shapeup-sdlc", slug, "orders");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${order.order_id.split("/")[1]}.json`);
  writeFileSync(outPath, JSON.stringify(order, null, 2) + "\n");
  console.log(outPath);
}
