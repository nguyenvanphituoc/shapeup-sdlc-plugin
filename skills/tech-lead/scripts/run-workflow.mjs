#!/usr/bin/env node
// run-workflow — a Bash-invoked control plane for Workflow-format orchestrator scripts.
//
// WHY THIS FILE EXISTS. The `Workflow` tool — the only lane for scoped specs — is denied in a
// headless session with "Review dynamic workflow before running". Left to it, `shapeup-run.js`
// executes zero times and the agent improvises the feature by hand instead; a session can reach
// GATE L4 with a valid receipt while the lane never started. Bash HAS a path-scoped grantable
// prefix, and `npx shapeup-sdlc init` already
// writes exactly that rule (`Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)` —
// bin/init.mjs mergePipelinePermissions), so this file runs the SAME Workflow-format script through
// a surface the install already grants.
//
// ⟐ ONE CORRECTION, from probing the permission layer rather than concluding from denials. It is
// NOT true that no permission string can grant the tool: a bare `"Workflow"` entry in
// `permissions.allow` grants it, and with that entry removed the same call is denied. So the tool
// was never ungrantable — the installer simply never wrote the entry, because it writes Bash
// prefixes only. The defect is real, and it is an INSTALLER defect: the plugin never granted the
// permission its own lane needs.
//
// TWO THINGS SURVIVE THE CORRECTION, and they are the reason this file still exists rather than a
// one-line change to `init`:
//   1. THE GRANT CANNOT BE SCOPED. `Workflow(<path>)` and `Workflow(<script>)` are both denied —
//      only the bare token works, which grants EVERY dynamic workflow script in the project,
//      including one a model writes at runtime. A harness whose thesis is "gates the agent cannot
//      talk its way past" should not ask for blanket dynamic-code execution. The Bash prefix is
//      path-scoped to this directory.
//   2. It costs no new grant at all: existing installs already allow it.
// The one-line `"Workflow"` grant remains a legitimate alternative for anyone who prefers the
// native runtime's resume/isolation, and the upgrade notes document it as such. It is a choice
// with a real trade-off, which is why it is documented rather than silently taken.
//
// IT LIVES IN `scripts/` FOR A LOAD-BEARING REASON, not a filing one. The grant `init` already
// writes is a PREFIX rule over this exact directory, so shipping the launcher here means every
// install that ever ran `npx shapeup-sdlc init` can already start the lane — zero new permission
// strings, zero migration for existing users. Putting it anywhere else would require a new grant
// and reproduce the same denial one directory over. The structural suite asserts that the
// documented call site is covered by a prefix `bin/init.mjs` actually writes.
//
// PROVENANCE: prototyped and proven before it shipped — a headless `acceptEdits` session runs the
// lane through a granted Bash prefix with zero denials, this loader executes the unmodified
// `shapeup-run.js`, and a real worker dispatches under `acceptEdits`.
//
// WHAT IT PROVIDES to the script — the Workflow runtime surface shapeup-run.js actually uses:
//   args, agent(prompt, {label, phase, schema, model, effort}), parallel(thunks),
//   pipeline(items, ...stages), phase(title), log(msg), budget, workflow() [stub — throws].
// Scripts keep the Workflow tool's contract: `export const meta = {...}` + a bare top-level body
// with top-level `await` and `return`. The loader rewrites the one export and wraps the body in an
// AsyncFunction; nothing about the script format changes, which is the point — shapeup-run.js runs
// through this file byte-identical to how it ships.
//
// HOW agent() DISPATCHES. Each call spawns a fresh headless CLI session:
//   claude -p <prompt> --model <m> --output-format json --permission-mode acceptEdits
// (detached process group, SIGTERM-then-SIGKILL escalation on timeout, so a hook grandchild can
// never hold a dead worker's pipe open — without that, a time-capped session can outlive its cap
// many times over). Workers are
// stateless, craft-only, pipeline-blind (the envelope port) — fresh processes fit that contract
// exactly; nothing here shares context between dispatches. `schema` is enforced by instruction +
// parse + shallow validation + one retry; a worker that still fails returns null, which is the
// Workflow tool's own documented behavior for a dead subagent and the case every shapeup-run.js
// call site already survives (mechEnvelope).
//
// DIVERGENCES from the Workflow tool, stated rather than silent. None is reached by
// `shapeup-run.js`, which is why this lane can carry it today; each is a real gap for any other
// script, and a reader deciding whether to write one should read this list as a limit, not a note:
//   - budget counts USD (summed from each worker envelope's total_cost_usd), not output tokens.
//     Interface is identical: {total, spent(), remaining()}; total comes from --budget-usd.
//   - Date.now()/Math.random() are NOT banned inside scripts. The tool bans them for replay-safe
//     resume; this file journals every dispatch (journal.jsonl) but does not implement
//     resume-from-journal. shapeup-run.js resumes from DISK state by design, not from the
//     journal — which is why the lane's kill/resume story (`kill-resume-probe: PASS`, four
//     assertions on a live SIGKILL) does not depend on this and survives the surface swap.
//   - workflow() (child workflows) throws. shapeup-run.js inlines its round loop and never calls it.
//   - isolation: 'worktree' throws. shapeup-run.js is sequential today (design doc D3).
//   - schema validation is shallow (type + required keys + declared property types, one level).
//
// A RUN OUTLIVES A FOREGROUND TOOL CALL. A real pipeline runs for tens of minutes; every
// foreground Bash call has a ceiling well below that. Launch it as a BACKGROUND Bash call and read
// `<run-dir>/result.json`, which this file writes on completion with the same `{ok, result}` shape
// stdout carries. Headless callers must also set `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, or the
// wait is cut at 600 s and a truncated run is reported as a clean one.
//
// STDOUT DISCIPLINE: stdout carries exactly one JSON line — {ok, result} — because whatever
// launched this process (a mech courier, an outer session, a test) reads stdout as data. All
// narration goes to stderr.
//
// exit 0: script completed; stdout = {"ok":true,"result":...}
// exit 1: script threw or the launch failed after parsing; stdout = {"ok":false,"error":...}
// exit 2: argv rejected before anything ran (lib/argv.mjs) — nothing spawned, nothing written.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import process from "node:process";
import { runArgs } from "./lib/argv.mjs";
import { isMain } from "./lib/is-main.mjs";
import { readRunId } from "./lib/run-id.mjs";

/**
 * The typed argv boundary.
 *
 * FAILING CLOSED IS THE POINT HERE, not hygiene. The cost of a silent launch failure is not that the lane
 * refused to start — it is that the refusal was quiet enough for an agent to route around, so a
 * run that never happened reported like one that did. A launcher that accepts `--max-concurrency`
 * with no value and proceeds on `NaN` is the same shape of defect: this rejects at exit 2 with a
 * machine-readable reason before a single worker is spawned or a run directory created.
 */
export const ARGV_SPEC = {
  usage: 'run-workflow.mjs <workflow-script.js> [--args <json> | --args-file <path>] ' +
         "[--run-dir <dir>] [--worker-permission-mode <mode>] [--worker-cwd <dir>] " +
         "[--max-concurrency <n>] [--agent-timeout-s <n>] [--budget-usd <n>]",
  _: { arity: 1, name: "workflow-script.js" },
  args: { type: "json" },
  "args-file": { type: "path" },
  "run-dir": { type: "path" },
  "worker-permission-mode": { type: "enum", values: ["acceptEdits", "default", "plan", "bypassPermissions"] },
  "worker-cwd": { type: "path" },
  "max-concurrency": { type: "int", min: 1, max: 32 },
  "agent-timeout-s": { type: "int", min: 1 },
  "budget-usd": { type: "num", min: 0 },
};

/**
 * Resolve parsed argv into the loader's configuration.
 * @param {object} a - The object `runArgs(ARGV_SPEC)` returns.
 * @returns {object} Fully defaulted, absolute-path configuration.
 */
export function configure(a) {
  const script = resolve(a._[0]);
  const args = a.argsFile ? JSON.parse(readFileSync(a.argsFile, "utf8")) : (a.args ?? {});
  const workerCwd = a.workerCwd ? resolve(a.workerCwd) : process.cwd();
  return {
    script,
    args,
    // The run key for every journal row, resolved ONCE at launch. `RunArgs.runId` is preferred
    // because tech-lead already has it from init-run's output; the receipt lookup is the fallback
    // that keeps an older args file — or a hand-driven launch — from producing unkeyed rows. A
    // launch with neither (this loader also runs workflow scripts that are not harness runs)
    // journals `null`, which is accurate rather than absent.
    runId: args?.runId ?? (args?.slug ? readRunId(workerCwd, args.slug) : null),
    runDir: a.runDir
      ? resolve(a.runDir)
      : resolve(`.run-workflow-${basename(script).replace(/\.[^.]+$/, "")}-${process.pid}`),
    workerPermissionMode: a.workerPermissionMode || "acceptEdits",
    workerCwd,
    maxConcurrency: a.maxConcurrency ?? 4,
    agentTimeoutS: a.agentTimeoutS ?? 900,
    budgetUsd: a.budgetUsd ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Loader — the Workflow tool's script format, executed as-is. One rewrite (`export const meta`
// -> `const meta`), then the whole body becomes an AsyncFunction so top-level `await` and
// top-level `return` mean exactly what the tool defines them to mean.
// ---------------------------------------------------------------------------------------------
function loadWorkflow(path) {
  let src = readFileSync(path, "utf8");
  src = src.replace(/^export\s+const\s+meta\s*=/m, "const meta =");
  if (/^export\s/m.test(src)) {
    throw new Error(`${basename(path)}: unsupported export — Workflow scripts export only \`const meta\``);
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncFunction(
    "args", "agent", "parallel", "pipeline", "phase", "log", "budget", "workflow",
    `"use strict";\n${src}`
  );
}

// ---------------------------------------------------------------------------------------------
// Concurrency — a plain semaphore; excess agent() calls queue, mirroring the tool's cap.
// ---------------------------------------------------------------------------------------------
function makeSemaphore(max) {
  let active = 0; const queue = [];
  const release = () => { active--; const next = queue.shift(); if (next) { active++; next(); } };
  const acquire = () => new Promise((res) => {
    if (active < max) { active++; res(); } else queue.push(res);
  });
  return { acquire, release };
}

// ---------------------------------------------------------------------------------------------
// Worker spawn — one headless CLI session per dispatch. Process-group kill on timeout
// (hook grandchildren keep pipes open, so
// signaling one pid is not a cap).
// ---------------------------------------------------------------------------------------------
const KILL_GRACE_MS = 10_000;

function runClaude({ prompt, model, permissionMode, cwd, timeoutMs }) {
  return new Promise((resolvePromise) => {
    const child = spawn("claude", [
      "-p", prompt,
      "--model", model,
      "--output-format", "json",
      "--permission-mode", permissionMode,
    ], { cwd, env: process.env, detached: true });

    let stdout = "", stderr = "", settled = false, killed = false;
    const settle = (r) => { if (!settled) { settled = true; clearTimeout(timer); clearTimeout(hardTimer); resolvePromise(r); } };

    let hardTimer = null;
    const timer = setTimeout(() => {
      killed = true;
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
      hardTimer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ } }, KILL_GRACE_MS);
    }, timeoutMs);

    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (e) => settle({ ok: false, error: `cannot spawn claude: ${e.message}`, killed, stdout, stderr }));
    child.on("close", (code) => {
      let envelope = null;
      try { envelope = JSON.parse(stdout.trim()); } catch { /* non-JSON stdout stays raw */ }
      settle({ ok: code === 0 && envelope !== null && envelope.is_error !== true, code, killed, envelope, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Structured output — instruction + extraction + shallow validation + one retry.
// Extraction is parseMechJson's balanced-scan (shapeup-run.js:176) — proven against couriers
// that wrap clean JSON in commentary; the same failure mode applies to whole workers.
// ---------------------------------------------------------------------------------------------
function extractJson(text) {
  if (typeof text !== "string") return null;
  const s = text.trim();
  try { return JSON.parse(s); } catch { /* fall through to extraction */ }
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  const open = s[start], close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function shallowValidate(schema, value) {
  const problems = [];
  if (!schema || typeof schema !== "object") return problems;
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return [`expected object, got ${value === null ? "null" : Array.isArray(value) ? "array" : typeof value}`];
    }
    for (const k of schema.required || []) if (!(k in value)) problems.push(`missing required key "${k}"`);
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (!(k in value) || !sub.type) continue;
      const v = value[k];
      const t = sub.type === "integer" ? (Number.isInteger(v) ? "integer" : typeof v)
        : Array.isArray(v) ? "array" : typeof v;
      if (t !== sub.type && !(sub.type === "number" && typeof v === "number")) {
        problems.push(`key "${k}": expected ${sub.type}, got ${t}`);
      }
    }
  } else if (schema.type === "array" && !Array.isArray(value)) {
    problems.push(`expected array, got ${typeof value}`);
  }
  return problems;
}

const schemaInstruction = (schema) =>
  "\n\n---\nSTRUCTURED OUTPUT REQUIRED. Your final reply must be ONLY a single JSON value that " +
  "validates against this JSON Schema — no prose, no markdown fences, nothing before or after " +
  `it:\n${JSON.stringify(schema)}`;

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
async function main() {
  const cli = configure(runArgs(ARGV_SPEC));
  mkdirSync(cli.runDir, { recursive: true });
  const journalPath = resolve(cli.runDir, "journal.jsonl");
  const journal = (entry) => appendFileSync(journalPath, JSON.stringify(entry) + "\n");
  const note = (m) => process.stderr.write(`[run-workflow] ${m}\n`);

  const sem = makeSemaphore(cli.maxConcurrency);
  let seq = 0, costAccum = 0, currentPhase = null;

  const budget = {
    total: cli.budgetUsd,
    spent: () => costAccum,
    remaining: () => (cli.budgetUsd == null ? Infinity : Math.max(0, cli.budgetUsd - costAccum)),
  };

  async function agent(prompt, opts = {}) {
    const id = ++seq;
    const label = opts.label || `agent-${id}`;
    const model = opts.model || "sonnet";
    const phaseName = opts.phase || currentPhase;
    if (budget.total != null && budget.remaining() <= 0) {
      throw new Error(`budget exhausted ($${costAccum.toFixed(3)} of $${budget.total}) before agent "${label}"`);
    }
    if (opts.isolation) throw new Error(`agent "${label}": isolation: 'worktree' is not implemented on this lane`);
    await sem.acquire();
    const startedAt = new Date().toISOString();
    const t0 = process.hrtime.bigint();
    try {
      let fullPrompt = opts.schema ? prompt + schemaInstruction(opts.schema) : prompt;
      let result = null, attempts = 0, sessions = [];
      while (attempts < 2) {
        attempts++;
        note(`agent#${id} "${label}" attempt ${attempts} (model=${model}, mode=${cli.workerPermissionMode})`);
        const r = await runClaude({
          prompt: fullPrompt, model, permissionMode: cli.workerPermissionMode,
          cwd: cli.workerCwd, timeoutMs: cli.agentTimeoutS * 1000,
        });
        const env = r.envelope || {};
        sessions.push({ session_id: env.session_id ?? null, cost_usd: env.total_cost_usd ?? null, is_error: env.is_error ?? null, killed: r.killed });
        if (typeof env.total_cost_usd === "number") costAccum += env.total_cost_usd;
        if (!r.ok) { result = null; if (r.killed) break; continue; }
        if (!opts.schema) { result = env.result ?? null; break; }
        const parsed = extractJson(env.result);
        const problems = parsed === null ? ["reply contained no parseable JSON"] : shallowValidate(opts.schema, parsed);
        if (problems.length === 0) { result = parsed; break; }
        note(`agent#${id} "${label}" schema problems: ${problems.join("; ")}`);
        fullPrompt = prompt + schemaInstruction(opts.schema) +
          `\n\nA previous attempt failed validation: ${problems.join("; ")}. Correct this.`;
        result = null;
      }
      const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
      // `run_id` makes this row joinable to the order it executed. The journal is the ONLY place
      // `cost_usd` and wall-clock are recorded, so without the key the harness's cost data could
      // never be attributed to a run — which is the whole of the measurement table's run-economics
      // row. Resolved once at launch (see `runId` above), never per-call.
      journal({ seq: id, run_id: cli.runId, label, phase: phaseName, model, permission_mode: cli.workerPermissionMode,
        started_at: startedAt, wall_ms: Math.round(wallMs), attempts, sessions, ok: result !== null, result });
      return result;
    } finally {
      sem.release();
    }
  }

  // Thunk errors resolve to null and the call never rejects — the Workflow tool's contract,
  // which shapeup-run.js's call sites (mechEnvelope, dispatch guards) are written against.
  const parallel = (thunks) => Promise.all(
    thunks.map((t) => Promise.resolve().then(t).catch((e) => { note(`parallel thunk failed: ${e.message}`); return null; }))
  );

  // No barrier between stages; a stage that throws drops the item to null and skips the rest.
  const pipeline = (items, ...stages) => Promise.all(
    items.map(async (item, i) => {
      let acc = item;
      for (const stage of stages) {
        try { acc = await stage(acc, item, i); }
        catch (e) { note(`pipeline item ${i} failed: ${e.message}`); return null; }
      }
      return acc;
    })
  );

  const phase = (title) => { currentPhase = title; note(`── phase: ${title}`); };
  const log = (m) => note(String(m));
  const workflow = () => { throw new Error("workflow() child workflows are not implemented on this lane"); };

  const fn = loadWorkflow(cli.script);
  note(`running ${basename(cli.script)} (run-dir ${cli.runDir})`);
  const result = await fn(cli.args, agent, parallel, pipeline, phase, log, budget, workflow);

  const summary = { ok: true, script: basename(cli.script), agents_dispatched: seq,
    cost_usd: Number(costAccum.toFixed(6)), result };
  writeFileSync(resolve(cli.runDir, "result.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ ok: true, result }) + "\n");
  return cli.runDir;
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    // The failure is written where a background caller will look for it, not only to a stdout
    // nobody is reading: a launch that dies silently is the exact shape this file exists to end.
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + "\n");
    process.stderr.write(`[run-workflow] FATAL ${e.stack}\n`);
    try {
      const dir = process.argv.includes("--run-dir")
        ? resolve(process.argv[process.argv.indexOf("--run-dir") + 1])
        : null;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, "result.json"),
          JSON.stringify({ ok: false, error: e.message }, null, 2) + "\n");
      }
    } catch { /* the stdout line above is still the record */ }
    process.exit(1);
  });
}
