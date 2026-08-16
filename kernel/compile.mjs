#!/usr/bin/env node
// WorkOrder compiler (pure-skill architecture v1.0, plan P1).
//
// The orchestrator's pipeline sub-layer: assembles the structured input envelope a worker is
// dispatched with. Replaces tech-lead's hand-assembled `isolated_brief()` prose step and every
// worker's GATE A/B plumbing (path resolution, run-state parse, board glob-matching, dependency
// reads, mode detection). Deterministic, zero LLM tokens.
//
// A worker depends on its ORDER, never on filesystem topology — moving a directory again
// (the v3.2 lesson) touches this script, zero skills.
//
// Zero dependencies, zero network.
//
// Usage:
//   Scope attempt (isolated attempt loop):
//     node kernel/harness.mjs compile --scope shapeup/<slug>/scopes/<id>.md \
//          --round N --attempt M [--cwd <dir>] [--test-cmd "<cmd>"]
//   Single task (no scope contracts — pre-v0.3.0 boards):
//     node kernel/harness.mjs compile --task TASK-003 --slug <slug> [--worker task-executor]
//     node kernel/harness.mjs compile --next --slug <slug>
//   Non-build operation (planner/judge/QA dispatches; flag surface → operation + whitelist):
//     node kernel/harness.mjs compile --operation reconcile --slug <slug> [--round N]
//          [--worker ba-pitch-analyzer] [--payload '<json>']
//
// Output: .shapeup/<slug>/orders/<order-file>.json (schema-validated before write; a
// pretty-printed envelope, colocated so audits can read it). Prints the path on stdout.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./verify/envelope.mjs";
import { readTrials } from "./verify/t0.mjs";
import { runArgs } from "./lib/argv.mjs";
import { readRunId } from "./lib/paths.mjs";
// `specDir` is aliased: this module has a local `let specDir` holding the resolved, possibly
// --spec-overridden directory, and the import is the convention-derived default.
import {
  tasksDir, specDir as defaultSpecDir, roundLedger, trials, verdictsDir, ordersDir,
  relShared, globLocal, globShared, relKnowledgeBase, resultsDir, scopesDir,
} from "./lib/paths.mjs";
import { readContract, SCOPE_CONTRACT } from "./lib/contract.mjs";
import { writeActiveOrder } from "./probe/resume.mjs";
// The SAME matcher the sandbox hook enforces with. "Is this cited file inside this scope's
// substrate" has to mean exactly what the guard means, or a bug is addressed to a scope that is
// then denied the write that fixes it.
import { matchesAny } from "../hooks/sandbox-guard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER_SCHEMA = JSON.parse(readFileSync(resolve(HERE, "./../skills/tech-lead/schemas/work-order.schema.json"), "utf8"));

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
 * Operation → owning worker (mirrors `domain.schema.json#/$defs/Operation` ownership). Lets a
 * non-build dispatch resolve its worker from the operation alone, without a redundant `--worker`.
 *
 * Exported and at module scope so it is ONE table. Every value here must be a member of
 * `WorkerName`: an operation mapped to a name the enum does not carry compiles an order that fails
 * its own schema, and the dispatch is then denied by the order gate for a reason that names the
 * envelope rather than the typo. That parity is checked by the suite, which can only read a table
 * it can import.
 */
export const OP_OWNER = {
  analyze: "ba-pitch-analyzer", reconcile: "ba-pitch-analyzer",
  "retrofit-surface": "ba-pitch-analyzer", coverage: "ba-pitch-analyzer",
  "map-scopes": "scope-architect",
  wire: "solution-architect", evaluate: "spec-evaluator", orient: "orient",
  hunt: "qa-edge-hunter", translate: "translator",
  hammer: "scope-hammer", coach: "coach",
};

/**
 * Resolve the write-contract (sandbox substrate) for an operation — one whitelist template per
 * operation, so mode/flag differences are enforced by the sandbox hook reading the order's substrate, not trusted to prose.
 * @param {string} operation - The order's operation (execute|fix|spike|analyze|reconcile|
 *   retrofit-surface|coverage|map-scopes|wire|evaluate|orient|hunt|translate|hammer|coach).
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

    case "coverage":
      // The covers-closure input truth. Writes ONLY the derived registry: the REQ source it
      // extracts from is frozen alongside the spec core, because a planner that may edit the
      // requirements it is being measured against is not measuring anything.
      return { allowed: [globShared(slug, "requirements.md")], frozen: FROZEN_SPEC_CORE };

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
    case "translate":
      return { allowed: [globShared(slug, "shaping/*.md"), globShared(slug, "glossary.md")] };
    case "hammer":
      return { allowed: [globShared(slug, "REPORT.md"), `${local}/reports/**`] };
    case "coach":
      return { allowed: [relKnowledgeBase("*")] };
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
 * The stagnation term of the inner circuit breaker.
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

// --- the FAIL verdict's bugs, carried into the round that must fix them ----------------------
//
// WHY THE KERNEL OWNS THIS AND NOT THE ORCHESTRATOR (measured twice, two different ways).
//
// `WorkOrderPayload.bugs` is defined as "the EVAL report's bug entries for this task — touch
// nothing else", and AGENTS.md states the regression rule as "bugs + full Test Surface of touched
// UC". Nothing ever populated it. The orchestrator's first fix threaded the evaluator's findings
// from memory into the build leg's `payload`, and it could not work, for two independent reasons:
//
//   1. A BUILD ORDER TAKES NO PAYLOAD FROM THE CALLER. Build legs override the compile line
//      (`compile --scope … --round … --attempt …`) because an order is addressed by scope, round
//      and attempt; only the generic fallback line serialises `--payload`. So the payload object
//      the orchestrator built for a build leg was constructed, filtered, and dropped on the floor.
//   2. IT LIVED ONLY IN MEMORY. Round r's verdict is what round r+1 must act on, and a run killed
//      after EVAL and relaunched — the normal case here — starts round r+1 in a fresh process with
//      an empty variable. The verdict was on disk the whole time.
//
// Both vanish if the evidence is read where the order is written: the same read on a fresh round
// and a resumed one, no process boundary to survive, and no model in the path — an LLM courier
// transcribing a repro string is a repro string that no longer reproduces.
//
// The shape is also RICHER than the in-memory channel ever was: the ledgered verdict carries
// severity, file:line, repro, expected and actual per bug, where the structured return carried
// only `{id, criterion, evidence}`.

/**
 * The previous round's cited defects, if that round returned FAIL.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {number} [round] - The round being compiled; round 1 has no predecessor.
 * @returns {Array<object>} Bug entries, minus any the adversarial check overturned. Empty for a
 *   first round, a PASS, or an absent/unreadable result — a fix round with nothing to fix is a
 *   normal build round, never an error.
 */
export function verdictBugs(cwd, slug, round) {
  if (!round || round < 2) return [];
  const p = join(resultsDir(cwd, slug), `evaluate-r${round - 1}.json`);
  if (!existsSync(p)) return [];
  let v;
  try { v = JSON.parse(readFileSync(p, "utf8"))?.verdict; } catch { return []; }
  if (v?.overall !== "FAIL" || !Array.isArray(v.bugs)) return [];
  // A refuted acceptance criterion is one the judge withdrew. Re-dispatching it would send a
  // worker to "fix" behaviour that was found correct.
  const refuted = new Set(
    (Array.isArray(v.refuted) ? v.refuted : [])
      .flatMap((r) => [r?.id, r?.ac_id, r?.criterion, typeof r === "string" ? r : null])
      .filter(Boolean).map(String),
  );
  return v.bugs.filter((b) => !refuted.has(String(b?.id)) && !refuted.has(String(b?.criterion)));
}

/**
 * Every repo-relative file a bug is cited against.
 *
 * A LOCATOR NAMES MORE THAN ONE SITE, ROUTINELY. The judge writes what it found, and what it finds
 * is often the same defect at several lines, sometimes across files:
 * `"bin/todo.js:53, bin/todo.js:85"`, or `"lib/parse-index.js:5, :13, :21 (rendered by
 * bin/todo.js:66)"`. A parser that accepts only a lone `file:line` returns nothing for those, and
 * "nothing" routes the bug to every scope as unowned — the safe direction, but it throws away an
 * address the judge did supply. On the measured round-1 verdict that was two of five bugs.
 *
 * @param {object} bug - One bug entry.
 * @returns {string[]} Distinct paths, `:line` suffixes and `./` prefixes stripped, in first-seen
 *   order. Empty when the entry carries no locator this can read.
 */
export function bugLocations(bug) {
  const raw = String(bug?.location ?? bug?.file ?? "").trim();
  // A path-looking token: at least one dot-extension, and no whitespace. The extension is what
  // keeps prose out ("exit 1", "Node 20") without needing to know the project's layout.
  const out = [];
  for (const m of raw.matchAll(/(?:^|[\s(,[])([\w@][\w./-]*\.[A-Za-z][A-Za-z0-9]{0,5})(?::\d+)?/g)) {
    const p = m[1].replace(/^\.\//, "");
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Elect the ONE scope that should fix a defect cited against a given file.
 *
 * OWNERSHIP IS BY SUBSTRATE, because that is what the sandbox enforces: a scope is exactly the set
 * of files its worker may write, so a scope whose substrate excludes the cited line cannot fix it
 * however well it understands the bug.
 *
 * BUT A MATCH IS NOT AN ELECTION. An entry point is routinely SHARED — on the measured run
 * `bin/todo.js` sits in five scopes' substrate at once — so "address it to every scope that
 * matches" hands the same one-line fix to five workers building concurrently against one file.
 * That is a write race the harness sets up itself, and four of the five fixes are waste even when
 * it resolves. So: prefer a scope that owns the file EXCLUSIVELY (allowed, not shared), and among
 * equals take the lowest scope id — a rule that needs no coordination to agree with itself, since
 * each leg compiles its own order in its own process.
 *
 * @param {string} path - Repo-relative file the bug cites.
 * @param {Array<{scope_id:string, allowed:string[], shared:string[]}>} scopes - Every scope.
 * @returns {string|null} The elected scope id, or null when no scope may write that file.
 */
export function electOwner(path, scopes) {
  const can = (scopes || []).filter((s) => matchesAny(path, s.allowed));
  if (!can.length) return null;
  const exclusive = can.filter((s) => !matchesAny(path, s.shared || []));
  return (exclusive.length ? exclusive : can).map((s) => s.scope_id).sort()[0];
}

/**
 * Address each bug to the scope that must fix it.
 *
 * AN UNOWNED BUG GOES TO EVERYONE, MARKED. A cited defect matching no scope's substrate — or
 * carrying no locator this can read — has no owner, and dropping it silently is precisely how a
 * judged defect survives a fix round to reappear in the next verdict. Better one scope reads a bug
 * it turns out not to own than the run forgets a defect it already paid to find.
 *
 * @param {Array<object>} bugs - The previous verdict's bugs (see {@link verdictBugs}).
 * @param {string|undefined} scopeId - The scope being compiled for.
 * @param {Array<{scope_id:string, allowed:string[], shared:string[]}>} scopes - Every scope.
 * @returns {Array<object>} The subset this order should carry; unowned entries get `unowned: true`.
 */
export function bugsForScope(bugs, scopeId, scopes) {
  const out = [];
  for (const b of bugs || []) {
    if (b?.scope_id) {
      if (b.scope_id === scopeId) out.push(b);
      continue;
    }
    const owners = bugLocations(b).map((p) => electOwner(p, scopes)).filter(Boolean);
    if (owners.includes(scopeId)) out.push(b);
    else if (!owners.length) out.push({ ...b, unowned: true });
  }
  return out;
}

/**
 * Every scope's write substrate, for the election in {@link electOwner}.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {Array<{scope_id:string, allowed:string[], shared:string[]}>} One entry per readable
 *   contract; `[]` when the scopes directory is absent or unreadable.
 */
export function scopeSubstrates(cwd, slug) {
  const dir = scopesDir(cwd, slug);
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".json")); } catch { return []; }
  const out = [];
  for (const f of files) {
    const c = readContract(join(dir, f), SCOPE_CONTRACT)?.contract;
    if (!c?.scope_id || !Array.isArray(c.allowed_file_substrate)) continue;
    out.push({
      scope_id: c.scope_id,
      allowed: c.allowed_file_substrate,
      shared: Array.isArray(c.shared_substrate) ? c.shared_substrate : [],
    });
  }
  return out;
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
 * @param {Array<object>} [opts.bugs] - The previous round's cited defects (payload.bugs).
 * @param {string} [opts.testCmd] - Verify command, recorded under payload.verify.test_cmd.
 * @param {object} [opts.payloadExtra] - Extra payload fields merged last (spec_folder, feature, …).
 * @param {string} [opts.specDir] - Spec directory, threaded into the substrate template.
 * @param {object} [opts.interaction] - Interaction flags (e.g. {pause_gates}).
 * @param {string} [opts.runId] - The run key (`lib/run-id.mjs`); omitted when no receipt is readable.
 * @param {string} [opts.compiledAt] - ISO compile time; omitted rather than invented.
 * @returns {object} A WorkOrder: {schema_version, order_id ("<slug>/<suffix>"), run_id?,
 *   compiled_at?, worker, mode, operation?, interaction?, substrate (from {@link substrateFor}),
 *   payload{…}}. A coachable worker also gets payload.kb_rules_path. Not validated here — the CLI
 *   validates before writing.
 */
export function compileOrder({
  slug, worker, mode = "orchestrated", operation, round, attempt,
  scope, tasks, decisions, digestedErrors, trialHistory, bugs, testCmd, payloadExtra, specDir, interaction,
  runId, compiledAt,
}) {
  // A build order's id carries its SCOPE. Without it, `r<round>-a<attempt>` is the same name for
  // every scope in a round, so scope 2's order file overwrites scope 1's the moment it is compiled
  // — measured on the kill/resume probe, where it made `orders/ minus results/` read EMPTY on a run
  // that was re-dispatching a completed phase. The contract row watching that property therefore
  // passed on the exact failure it exists to catch. ``harness verify t0``'s verdict artifacts have always
  // been self-identifying this way (`r<R>-a<A>-t<T>.json`, `wx`-created); orders now match, so
  // `orders/` is an audit trail of dispatches rather than a rolling buffer of the last one.
  //
  // The shape stays `<slug>/<suffix>`: every consumer splits on the FIRST "/" (`harness reduce ingest`
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
    // THE TWO ANALYTIC FIELDS, and why they are on the ORDER rather than the result.
    //
    // `order_id` identifies a dispatch within a run and repeats across runs of the same slug, so
    // the dispatch record needed a run key to be groupable at all. It is stamped here because this
    // is the one place every lane passes through — the same reason the active-order pointer is
    // published here — so the workflow lane, `--tiny`, the prose round loop and a standalone
    // dispatch all carry it without four separate stamps to keep in step.
    //
    // The RESULT deliberately gets neither. It is written by the worker, and a field a worker has
    // to remember to copy is a field that goes missing under exactly the conditions you most want
    // the record: the run that went wrong. Results join to orders on `order_id`, which they already
    // echo and `validate-envelope` already checks — so the key reaches the result leg through a
    // join that is enforced, instead of through a worker's cooperation.
    ...(runId ? { run_id: runId } : {}),
    ...(compiledAt ? { compiled_at: compiledAt } : {}),
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
      // Before `payloadExtra`, so an explicit `--payload '{"bugs":…}'` still wins: an operator
      // hand-addressing a defect outranks the derivation.
      ...(bugs?.length ? { bugs } : {}),
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
  usage: "harness.mjs compile (--scope <contract.json> --round N --attempt M | --task TASK-NNN --slug <slug> " +
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

/**
 * Compile a WorkOrder for one dispatch and publish the substrate pointer that fences it.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const argv = runArgs(ARGV_SPEC, rawArgv);
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
  // NON-REGRESSION. With no `trials.jsonl` on disk this falls back to exactly the pre-ratchet
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

  // The fix round's inbound evidence. Derived here, from the ledgered verdict, for every lane —
  // the workflow, `--tiny`, the prose round loop and a standalone `/build` all compile through
  // this line, and none of them can pass a payload to a build order (see the banner above).
  const bugs = scope ? bugsForScope(verdictBugs(cwd, slug, round), scope.scope_id, scopeSubstrates(cwd, slug)) : [];

  const order = compileOrder({
    slug, worker, operation, round, attempt, scope, tasks, decisions, digestedErrors, trialHistory, bugs,
    testCmd: flag("test-cmd"), payloadExtra, specDir,
    interaction: has("pause-gates") ? { pause_gates: true } : { pause_gates: false },
    // Read off the receipt rather than passed in: a standalone `compile-order` invocation gets the
    // same key as one the workflow drove, and a dispatch in a workspace with no open run simply
    // carries no key instead of failing — the analytic field must never be able to block a build.
    runId: readRunId(cwd, slug),
    compiledAt: new Date().toISOString(),
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

  // POINT THE SANDBOX AT THIS ORDER, HERE, because this is the only place every lane passes
  // through.
  //
  // `hooks/sandbox-guard.mjs` enforces the order's own `substrate` block — allowed/shared,
  // append_only, frozen — and it finds the order through `.shapeup/active-order`. Until this
  // write existed the pointer had exactly one author, the workflow script, so the guard fenced
  // the workflow lane and DEFERRED everywhere else: `--tiny`, the prose round loop, and a
  // standalone `/build` all compiled an order carrying a write contract that nothing enforced.
  // A substrate that is only enforced on the lane that also happens to be the most supervised
  // one is the wrong way round.
  //
  // Compiling an order is the moment the write contract comes into existence, so it is the
  // correct moment to publish it. The workflow script still sets the pointer explicitly before
  // dispatch (it interleaves phases and must be exact about which order is live); this write
  // makes the SAME mechanism cover callers that never reach that code.
  //
  // Best-effort, on stderr, and never fatal: a compiled order that cannot publish its pointer is
  // still a valid order, and stdout belongs to the order path the caller consumes. The guard
  // fails open on a missing pointer by design, so the failure mode is "unfenced", which is
  // exactly what a warning is for.
  const ptr = writeActiveOrder(cwd, slug, outPath);
  if (!ptr.ok) console.error(`compile-order: warning — ${ptr.reason} (this order's substrate will not be enforced)`);

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
