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
//     node skills/tech-lead/scripts/compile-order.mjs --scope shapeup/<slug>/scopes/<id>.md \
//          --round N --attempt M [--cwd <dir>] [--test-cmd "<cmd>"]
//   Single task (no scope contracts — pre-v0.3.0 boards):
//     node skills/tech-lead/scripts/compile-order.mjs --task TASK-003 --slug <slug> [--worker task-executor]
//     node skills/tech-lead/scripts/compile-order.mjs --next --slug <slug>
//   Non-build operation (planner/judge/QA dispatches; flag surface → operation + whitelist):
//     node skills/tech-lead/scripts/compile-order.mjs --operation reconcile --slug <slug> [--round N]
//          [--worker ba-pitch-analyzer] [--payload '<json>']
//
// Output: .shapeup/<slug>/orders/<order-file>.json (schema-validated before write; a
// pretty-printed envelope, colocated so audits can read it). Prints the path on stdout.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate-envelope.mjs";
import { readTrials } from "./t0-verify.mjs";
import { isMain } from "./lib/is-main.mjs";
import { runArgs } from "./lib/argv.mjs";
// `specDir` is aliased: this module has a local `let specDir` holding the resolved, possibly
// --spec-overridden directory, and the import is the convention-derived default.
import {
  tasksDir, specDir as defaultSpecDir, roundLedger, trials, verdictsDir, ordersDir,
  relShared, globLocal, globShared, relKnowledgeBase,
} from "./lib/paths.mjs";
import { readContract, SCOPE_CONTRACT } from "./lib/contract-md.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER_SCHEMA = JSON.parse(readFileSync(resolve(HERE, "../schemas/work-order.schema.json"), "utf8"));

// --- tiny frontmatter reader (scalar keys + [a, b] inline lists) --------------------------
/**
 * Parse a task/spec Markdown frontmatter block into scalar keys and inline `[a, b]` lists.
 * @param {string} md - Full Markdown document text.
 * @returns {Object<string,(string|string[])>} A flat map of top-level frontmatter keys; a value
 *   written as `[x, y]` becomes a trimmed string[], every other value stays a string. Returns
 *   {} when the document has no leading `---`-delimited block.
 */
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

/**
 * Parse one TASK-NNN.md file into the task entry a WorkOrder carries.
 * @param {string} path - Absolute path to the task Markdown file.
 * @returns {{id:string, title:string, status:string, priority:number, depends_on:string[],
 *   use_case_refs:string[], body_path:string, acceptance_criteria:Array<string|{text:string,
 *   covers:string[]}>}} The task entry. Each acceptance criterion is the checkbox text
 *   byte-identical (so ingest can tick it back); a trailing `(covers: REQ-…)` clause yields
 *   {text, covers} instead of a plain string. `priority` defaults to 999 when unset.
 * @throws {Error} If `path` is not readable.
 */
export function parseTaskFile(path) {
  const body = readFileSync(path, "utf8");
  const fm = frontmatter(body);
  const acceptance_criteria = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*- \[[ x]\]\s+(.*)$/);
    if (!m) continue;
    const text = m[1].trim(); // byte-identical to the checkbox — ingest ticks by matching it back
    // Additive covers-closure anchor (spine v1.3): a trailing `(covers: REQ-3, REQ-7)` clause on
    // the AC line yields {text, covers}; a plain line stays a string (non-regression on legacy boards).
    const cov = text.match(/\(covers:\s*([^)]*)\)/i);
    const covers = cov ? cov[1].split(",").map((s) => s.trim()).filter((s) => /^REQ-\d+$/.test(s)) : [];
    acceptance_criteria.push(covers.length ? { text, covers } : text);
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

/**
 * Read every task entry on the LOCAL board for a slug, sorted by ascending priority.
 * @param {string} cwd - Working-directory root the `.shapeup/<slug>/tasks` path resolves against.
 * @param {string} slug - Feature slug naming the run.
 * @returns {Array<object>} The parsed task entries (see {@link parseTaskFile}); [] when the tasks
 *   directory does not exist.
 */
export function readBoard(cwd, slug) {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^TASK-[\w.-]+\.md$/i.test(f))
    .map((f) => parseTaskFile(join(dir, f)))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Extract a scope's advisor-answer rows from the committed round ledger's Decisions table.
 * @param {string} ledgerText - Full `round-ledger.md` text ("" / null → no decisions).
 * @param {string} [scopeId] - When given, keep only rows whose cells name this scope; omit to keep all.
 * @returns {Array<{id:string, answer:string}>} One entry per `ESC-N` row (id = the ESC id, answer =
 *   the row's last cell); [] when the Decisions section is absent or empty.
 */
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

/**
 * Resolve the write-contract (sandbox substrate) for an operation — one whitelist template per
 * operation, so mode/flag differences are enforced by the sandbox hook, not trusted to prose.
 * @param {string} operation - The order's operation (execute|analyze|generate-board|reconcile|
 *   retrofit-surface|coverage|map-scopes|remap|split-scope|wire|evaluate|hunt|recheck|orient|…).
 * @param {{slug?:string, specDir?:string, scope?:object}} [ctx] - slug (names LOCAL/SHARED roots),
 *   specDir (overrides the default spec path), scope (contract supplying allowed/shared substrates).
 * @returns {{allowed:string[], shared?:string[], frozen?:string[], append_only?:string[]}} The
 *   substrate contract: globs the worker may write (`allowed`), shared-write globs, read-only
 *   `frozen` globs, and `append_only` globs. An unknown operation returns a LOCAL-only default.
 */
export function substrateFor(operation, { slug, specDir, scope } = {}) {
  const local = globLocal(slug);
  const spec = specDir || globShared(slug, "spec");
  const scopesDir = globShared(slug, "scopes");
  // Working notes live in the LOCAL tier since ADR-0001: the committed `spec/` keeps only what the
  // evaluator grades against and a reviewer needs. `synthesis.md`, `assess-report.md`,
  // `feedback.md`, `api-feasibility.md` and `integration.md` are analysis, not contract.
  const working = `${local}/working`;
  const FROZEN_SPEC_CORE = [`${spec}/domain-model.md`, `${spec}/usecases/*.md#Steps`, `${spec}/contracts/**`, `${spec}/ux-behavior.md`];
  switch (operation) {
    case "execute": case "fix": case "spike":
      return {
        allowed: [...(scope?.allowed_file_substrate || []), `${local}/spikes/**`],
        shared: scope?.shared_substrate || [],
      };
    case "analyze":
      return { allowed: [`${spec}/**`, `${local}/**`], frozen: [] };

    case "reconcile":
      return {
        allowed: [`${local}/tasks/**`, `${spec}/scope-summary.md`, `${working}/**`],
        append_only: [`${spec}/usecases/*.md#Invariants`, `${spec}/usecases/*.md#Test Surface`],
        frozen: FROZEN_SPEC_CORE,
      };
    case "retrofit-surface":
      return { allowed: [], append_only: [`${spec}/usecases/*.md#Test Surface`], frozen: FROZEN_SPEC_CORE };

    case "map-scopes":
      return {
        allowed: [`${scopesDir}/*.md`, globShared(slug, "scope-board.md")],
        frozen: [...FROZEN_SPEC_CORE, `${local}/tasks/**`],
      };
    case "wire":
      // solution-architect writes the SHARED wiring map DIRECTLY (precedent: scope-architect
      // writes scopes/*.md). The spec core, the scopes, and the profile stay frozen.
      return {
        allowed: [globShared(slug, "wiring-map.md")],
        frozen: [...FROZEN_SPEC_CORE, `${scopesDir}/**`, globShared(slug, "project-profile.md")],
      };
    case "evaluate":
      return { allowed: [`${local}/evaluation/**`], frozen: [`${spec}/**`, `${local}/tasks/**`] };
    case "hunt":
      return { allowed: [`${local}/qa/**`], frozen: [`${spec}/**`, `${local}/tasks/**`] };
    case "orient":
      return { allowed: [`${local}/orient/**`], frozen: [`${spec}/**`] };
    default:
      return { allowed: [`${local}/**`] };
  }
}

// --- inspect(): the attempt loop's history ------------------------------------------------
//
// WHAT THIS REPLACED. The entire history mechanism used to be one read of one file:
//
//     const prev = join(cwd, ".shapeup", slug, "t0", "verdicts", `r${round}-a${attempt-1}.json`);
//     digestedErrors = JSON.parse(readFileSync(prev)).discovered_tasks || [];
//
// Three bounds followed, and each is a way the loop can repeat itself. It read ONE ATTEMPT BACK,
// not attempts 1…N−1 — so with the default `attempt_budget: 5`, attempt 4 could re-propose a change
// that already failed at attempt 1. It read ONLY WITHIN THE CURRENT ROUND — round 2 attempt 1 began
// blind to everything round 1 learned. And it carried ONLY AEGIS error triples: what was tried,
// whether it helped, and whether the tree was kept were not in the envelope because no field held
// them. Excluding the prior TRANSCRIPT is right and deliberate (zero-memory handoff). Excluding the
// structured TRIAL RECORD is the opposite thing, and the two were dropped together.
//
// TOKEN DISCIPLINE. `compactTrial` strips stdout/stderr and truncates the digest to three triples.
// Eight rows ≈ 600 tokens against an `attempt_budget` of 5 — cheaper than one re-proposed failed
// change.

/** How many trial rows an order carries. Matches `WorkOrderPayload.trial_history.maxItems`. */
export const TRIAL_HISTORY_MAX = 8;

/**
 * Reduce a trial ledger row to what a worker can act on.
 *
 * Drops the fields a worker cannot use — `artifact`, `sha256`, `at`, `tree_ref`, `baseline_trial`
 * — and truncates the digest. Keeps `schema_version` and `scope_id` so the row stays a valid
 * `TrialRow`: the registry defines each cross-boundary record ONCE, and a payload carrying a
 * near-TrialRow that needs its own definition would be exactly the ad-hoc field the registry
 * exists to prevent.
 *
 * @param {object} t - A row from `t0/trials.jsonl`.
 * @returns {{schema_version:number, trial:number, round:number, attempt:number, scope_id:string,
 *   score:object, status:string, delta:string, digest:Array<object>}} The compacted row.
 */
export function compactTrial(t) {
  return {
    schema_version: t.schema_version ?? 1,
    trial: t.trial, round: t.round, attempt: t.attempt, scope_id: t.scope_id,
    score: t.score, status: t.status, delta: t.delta ?? "",
    digest: (t.digest || []).slice(0, 3),
  };
}

/**
 * Select the trial rows an order should carry: this scope, this round or the one before it,
 * most recent {@link TRIAL_HISTORY_MAX} in write order.
 *
 * Crossing the round boundary is the point — a fix round that starts blind to the build round is
 * how the same failed change gets proposed twice.
 *
 * @param {Array<object>} trials - All rows read from `t0/trials.jsonl`.
 * @param {{scopeId?:string, round?:number}} sel - Scope id and current round to select against.
 * @returns {Array<object>} The compacted rows, oldest first; [] when nothing matches.
 */
export function selectTrialHistory(trials, { scopeId, round } = {}) {
  return (trials || [])
    .filter((t) => !scopeId || t.scope_id === scopeId)
    .filter((t) => !round || t.round === round || t.round === round - 1)
    .slice(-TRIAL_HISTORY_MAX)
    .map(compactTrial);
}

/**
 * The stagnation term of the inner circuit breaker (plan §2.6).
 *
 * `attempt_budget` counts attempts; it cannot see that the last two produced nothing. One term
 * joins it: `no_progress_k` consecutive non-`kept` trials ends the scope early and queues the
 * EXISTING GATE H proposal rather than blocking the round — composing with the three-level breaker
 * instead of adding a fourth. On a flailing scope this saves three of five attempts.
 *
 * @param {Array<object>} trials - This scope's trial rows, oldest first.
 * @param {number} [k=2] - Consecutive non-`kept` trials that trip the breaker.
 * @returns {{stagnant:boolean, streak:number, k:number}} The streak of trailing non-`kept` trials
 *   and whether it has reached `k`.
 */
export function stagnation(trials, k = 2) {
  let streak = 0;
  for (let i = (trials || []).length - 1; i >= 0; i--) {
    if (trials[i].status === "kept") break;
    streak++;
  }
  return { stagnant: streak >= k && k > 0, streak, k };
}

/**
 * Assemble a WorkOrder envelope. Pure given its inputs — the CLI wrapper does the disk reads.
 * @param {object} opts - The order inputs (destructured):
 * @param {string} opts.slug - Feature slug (names the order_id and substrate roots).
 * @param {string} opts.worker - Target worker skill (e.g. "task-executor").
 * @param {string} [opts.mode="orchestrated"] - Dispatch mode written onto the order.
 * @param {string} [opts.operation] - Operation the worker runs (drives the substrate template).
 * @param {number} [opts.round] - Round number (for the order_id suffix + attempt pairing).
 * @param {number} [opts.attempt] - Attempt number within the round.
 * @param {object} [opts.scope] - Scope contract, carried as payload.scope_contract + substrate source.
 * @param {Array<object>} [opts.tasks] - Task entries to include in the payload.
 * @param {Array<{id:string,answer:string}>} [opts.decisions] - This scope's advisor answers.
 * @param {Array<object>} [opts.digestedErrors] - Prior-attempt AEGIS triples (payload.digested_errors).
 * @param {Array<object>} [opts.trialHistory] - Compacted trial rows (payload.trial_history).
 * @param {string} [opts.testCmd] - Verify command, recorded under payload.verify.test_cmd.
 * @param {object} [opts.payloadExtra] - Extra payload fields merged last (spec_folder, feature, …).
 * @param {string} [opts.specDir] - Spec directory, threaded into the substrate template.
 * @param {object} [opts.interaction] - Interaction flags (e.g. {pause_gates}).
 * @returns {object} A WorkOrder: {schema_version, order_id ("<slug>/<suffix>"), worker, mode,
 *   operation?, interaction?, substrate (from {@link substrateFor}), payload{…}}. A coachable
 *   worker also gets payload.kb_rules_path. Not validated here — the CLI validates before writing.
 */
export function compileOrder({
  slug, worker, mode = "orchestrated", operation, round, attempt,
  scope, tasks, decisions, digestedErrors, trialHistory, testCmd, payloadExtra, specDir, interaction,
}) {
  // A build order's id carries its SCOPE. Without it, `r<round>-a<attempt>` is the same name for
  // every scope in a round, so scope 2's order file overwrites scope 1's the moment it is compiled
  // — measured on the kill/resume probe, where it made `orders/ minus results/` read EMPTY on a run
  // that was re-dispatching a completed phase. The contract row watching that property therefore
  // passed on the exact failure it exists to catch. `t0-verify.mjs`'s verdict artifacts have always
  // been self-identifying this way (`r<R>-a<A>-t<T>.json`, `wx`-created); orders now match, so
  // `orders/` is an audit trail of dispatches rather than a rolling buffer of the last one.
  //
  // The shape stays `<slug>/<suffix>`: every consumer splits on the FIRST "/" (ingest-result.mjs
  // reads [0] as the slug and [1] as the file stem), and a scope id is already filename-safe
  // because it is a scope contract's own basename.
  // `scope` arrives as the PARSED contract object (the CLI reads the .md and embeds it), so the id
  // comes from its own `scope_id` field; a caller that passes a path instead still works. The id is
  // lowercased and stripped to the character class `work-order.schema.json` allows after the "/" —
  // an order that cannot pass its own schema is refused before it is written, and a naming
  // improvement must not be able to cause that.
  const rawScopeId = scope && typeof scope === "object"
    ? scope.scope_id
    : (scope ? String(scope).split("/").pop().replace(/\.(md|json)$/, "") : null);
  const scopeId = String(rawScopeId || "").toLowerCase().replace(/[^a-z0-9.-]/g, "-").replace(/^[^a-z0-9]+/, "");
  const buildSuffix = round && attempt ? (scopeId ? `${scopeId}-r${round}-a${attempt}` : `r${round}-a${attempt}`) : null;
  const suffix = buildSuffix || (round ? `${operation}-r${round}` : operation);
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
      ...(trialHistory?.length ? { trial_history: trialHistory } : {}),
      ...(testCmd ? { verify: { test_cmd: testCmd, env: [] } } : {}),
      ...(payloadExtra || {}),
    },
  };
  const kbByWorker = { "task-executor": "task-executor", "ba-pitch-analyzer": "ba-pitch-analyzer", "qa-edge-hunter": "qa-edge-hunter" };
  if (kbByWorker[worker]) order.payload.kb_rules_path = relKnowledgeBase(kbByWorker[worker]);
  return order;
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "compile-order.mjs (--scope <contract.json> --round N --attempt M | --task TASK-NNN --slug <slug> " +
         "| --next --slug <slug> | --operation <op> --slug <slug>) [--worker <skill>] [--payload '<json>'] " +
         "[--spec <dir>] [--test-cmd \"<cmd>\"] [--cwd <dir>] [--pause-gates]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
  slug: { type: "str" },
  spec: { type: "path" },
  scope: { type: "path" },
  round: { type: "int", min: 1 },
  attempt: { type: "int", min: 1 },
  operation: { type: "str" },
  worker: { type: "str" },
  task: { type: "str" },
  next: { type: "flag" },
  payload: { type: "json" },
  "test-cmd": { type: "str" },
  "pause-gates": { type: "flag" },
};

const isMainModule = isMain(import.meta.url);
if (isMainModule) {
  const argv = runArgs(ARGV_SPEC);
  /**
   * Read a parsed flag's value, normalising "absent" to null (the shape the body below expects).
   * @param {string} name - Flag name without leading dashes.
   * @returns {*} The parsed value, or null when the flag was not given.
   */
  const flag = (name) => argv[name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
  /**
   * Test whether a boolean flag was given.
   * @param {string} name - Flag name without leading dashes.
   * @returns {boolean} True when `--<name>` appears in argv.
   */
  const has = (name) => !!flag(name);
  const cwd = resolve(flag("cwd") || process.cwd());

  let slug = flag("slug");
  let scope = null;
  let specDir = flag("spec") || null;
  const scopePath = flag("scope");
  if (scopePath) {
    // Markdown on disk, JSON on the wire (ADR-0001): the contract is parsed here and the resulting
    // OBJECT is embedded in payload.scope_contract, so the envelope and its schema are unchanged.
    const abs = resolve(cwd, scopePath);
    const found = readContract(abs, SCOPE_CONTRACT);
    if (!found) { console.error(`compile-order: no scope contract at ${abs} (.md or .json)`); process.exit(2); }
    scope = found.contract;
    // shapeup/<slug>/scopes/<id>.md → slug
    if (!slug) slug = basename(dirname(dirname(abs)));
  }
  if (!slug) { console.error("compile-order: --slug (or a --scope path it derives from) is required"); process.exit(2); }
  if (!specDir && existsSync(defaultSpecDir(cwd, slug))) {
    specDir = relShared(slug, "spec");
  }

  const round = flag("round");
  const attempt = flag("attempt");
  // Operation → owning worker (mirrors domain.schema.json $defs/Operation ownership). Lets a
  // non-build dispatch resolve its worker from the operation alone, without a redundant --worker.
  const OP_OWNER = {
    analyze: "ba-pitch-analyzer", reconcile: "ba-pitch-analyzer",
    "retrofit-surface": "ba-pitch-analyzer",
    "map-scopes": "scope-architect",
    wire: "solution-architect", evaluate: "spec-evaluator", orient: "orient",
    hunt: "qa-edge-hunter", translate: "translator",
    hammer: "scope-hammer", coach: "coach",
  };
  let operation = flag("operation") || (scopePath || flag("task") || has("next") ? "execute" : null);
  const worker = flag("worker")
    || (scopePath || flag("task") || has("next") ? "task-executor" : null)
    || (operation ? OP_OWNER[operation] : null);
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
  const ledgerPath = roundLedger(cwd, slug);
  const decisions = existsSync(ledgerPath)
    ? ledgerDecisions(readFileSync(ledgerPath, "utf8"), scope?.scope_id)
    : [];

  // inspect() — the attempt loop's history (see selectTrialHistory above).
  //
  // NON-REGRESSION (plan §7). With no `trials.jsonl` on disk this falls back to exactly today's
  // read — the previous attempt's verdict artifact, AEGIS triples only, byte-for-byte the same
  // order. Every new arm is skipped when its artifact is absent, per the ✦/✚ convention.
  let digestedErrors = [];
  let trialHistory = [];
  const trialsPath = trials(cwd, slug);
  const allTrials = readTrials(trialsPath);
  if (allTrials.length) {
    trialHistory = selectTrialHistory(allTrials, { scopeId: scope?.scope_id, round });
    const lastRed = [...trialHistory].reverse().find((t) => t.digest?.length);
    digestedErrors = lastRed?.digest ?? [];
  } else if (round && attempt && attempt > 1) {
    const dir = verdictsDir(cwd, slug);
    // Immutable addressing (v1.5) writes `r<R>-a<A>-t<T>.json`; the pre-v1.5 unsuffixed name is
    // still read so artifacts already on disk keep working.
    const suffixed = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => new RegExp(`^r${round}-a${attempt - 1}-t\\d+\\.json$`).test(f))
          .sort((a, b) => Number(b.match(/-t(\d+)\./)[1]) - Number(a.match(/-t(\d+)\./)[1])) // newest first
          .map((f) => join(dir, f))
      : [];
    const prev = [...suffixed, join(dir, `r${round}-a${attempt - 1}.json`)].find((p) => existsSync(p));
    if (prev) {
      try { digestedErrors = JSON.parse(readFileSync(prev, "utf8")).discovered_tasks || []; } catch { /* stale artifact → none */ }
    }
  }

  // `--payload` is coerced and rejected at the argv boundary now (type "json"), so a malformed
  // payload never reaches this point — the same discipline validate-envelope applies to an order.
  let payloadExtra = flag("payload") || {};
  if (specDir && !payloadExtra.spec_folder) payloadExtra.spec_folder = specDir;
  if (!payloadExtra.feature) payloadExtra.feature = slug;

  const order = compileOrder({
    slug, worker, operation, round, attempt, scope, tasks, decisions, digestedErrors, trialHistory,
    testCmd: flag("test-cmd"), payloadExtra, specDir,
    interaction: has("pause-gates") ? { pause_gates: true } : { pause_gates: false },
  });

  const { valid, errors } = validate(order, ORDER_SCHEMA);
  if (!valid) {
    console.error("compile-order: produced an order that fails its own schema — refusing to write:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  const outDir = ordersDir(cwd, slug);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${order.order_id.split("/")[1]}.json`);
  writeFileSync(outPath, JSON.stringify(order, null, 2) + "\n");
  console.log(outPath);

  // The stagnation breaker reports on stderr, never on stdout: stdout is the order path the
  // orchestrator consumes, and a breaker that corrupts the pipeline's own output would be worse
  // than the flailing it detects. It advises; the orchestrator queues the GATE H proposal.
  if (scope?.scope_id) {
    const k = Number(scope.no_progress_k ?? payloadExtra.no_progress_k ?? 2);
    const st = stagnation(allTrials.filter((t) => t.scope_id === scope.scope_id), k);
    if (st.stagnant) {
      console.error(JSON.stringify({
        breaker: "stagnation", scope_id: scope.scope_id, streak: st.streak, no_progress_k: st.k,
        action: "queue a GATE H proposal for this scope and move on — do NOT block the round",
        reason: `${st.streak} consecutive non-kept trials: the loop is not ratcheting on this scope.`,
      }));
    }
  }
}
