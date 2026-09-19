#!/usr/bin/env node
// Sandbox guard — PreToolUse hook (the PA3 countermeasure: writes outside the order's substrate).
//
// Blocks Edit/Write/MultiEdit calls that no LIVE ORDER's `substrate` block permits. Turns "a worker
// only writes what the run authorised" from prose into a precondition the model cannot talk past.
//
// IT ENFORCES THE ORDER, NOT THE SCOPE CONTRACT, and that is the whole design. ``harness compile``
// already stamps a write contract onto every order from `substrateFor(operation)` — allowed,
// shared, append_only, frozen. Resolving the scope contract instead covered exactly one operation,
// the build, because only build orders carry a scope; every other dispatch (`analyze`, `wire`,
// `evaluate`, `hunt`, `coach` …) ran unfenced, and the `frozen`/`append_only` surfaces the
// compiler emits had no enforcer at all. Reading the order makes the contract the compiler writes
// and the contract the hook enforces the same object, for every operation, with no per-operation
// code here.
//
// IT READS EVERY LIVE ORDER, NOT A POINTER TO ONE. `.shapeup/active-order` names the run and
// nothing more — `harness compile` publishes it as it writes each order, which is what fences the
// lanes that never reach the workflow (`--tiny`, the prose round loop, a standalone `/build`).
// A single pointer cannot survive concurrency: with scopes building side by side the last compile
// wins the pointer, and a write from scope A would be judged against scope B's contract — a false
// block or a false permit depending on which way the race fell. So the candidate set is every
// order under `orders/` that is not yet ANSWERED, and a write is permitted when SOME live contract
// covers it.
//
// THE POINTER IS NOT A LIVENESS SIGNAL, and it used to be one: the order it names was counted live
// unconditionally, "so the single-order lane behaves as it did before concurrency existed". The arm
// bought nothing — an order that is genuinely in flight has no result yet and is already live by
// the rule below — and it cost the checkout permanently. The pointer has one writer and no eraser,
// so the LAST dispatch of a FINISHED run stayed live for good and fenced everything to that one
// substrate: after a ship, an ordinary edit anywhere in the repo was denied, and the next feature
// could not write even its own run trace, because the carve-out below is keyed to the slug the
// stale pointer names. The documented fail-open state ("no pointer — not inside a dispatch") became
// unreachable after the first run, and the only way out was to delete a file nothing documents.
// The arm is gone; `reduce ship` and ``harness init run --force`` retire the pointer as well, so a
// leftover one is untidy rather than load-bearing.
//
// ANSWERED IS A COMPARISON, NOT A PRESENCE TEST, and the difference is a hole the removal above
// would otherwise open. Order filenames for the run-level operations carry no round (`hammer.json`,
// `wire.json`, `analyze.json`), so re-dispatching one inside the same run rewrites the order beside
// the PREVIOUS dispatch's result — and a presence test reads that as finished and runs the new
// dispatch unfenced. An order counts as answered only when its result file is at least as new as
// the order's own `compiled_at`, the stamp the compiler writes INTO the order, which a copy or a
// touch cannot perturb. An order carrying no stamp falls back to presence, which is all it ever had.
//
// A RUN-LEVEL ORDER RETIRES AT ITS PHASE BOUNDARY, which is the other half of that same question.
// Liveness is "compiled, no result yet", so a PHASE dispatch whose worker never returned — a killed
// evaluation, a QA leg that escalated without a result, a failed scope mapping — would stay live for
// the rest of the run, and everything its `frozen` list names (the board, the spec tree) would be
// fenced from then on. The board is the one that bites: the next round's doer cannot tick its own
// acceptance criteria, and the run wedges with no dispatch actually in flight. The orchestrator has
// long since moved on by the time that matters, and the move itself is the signal: the next phase
// compiles its own order. So an order for a RUN-LEVEL operation stops being live once an order for a
// DIFFERENT operation has been compiled after it — the window the committed tier already has, a
// phase boundary rather than the middle of somebody else's dispatch. Build legs are exempt: they run
// concurrently, finish out of order, and an abandoned one is resolved by ``harness init run --force``
// rather than by a sibling's compile stamp. Two concurrent legs of the SAME operation never retire
// each other, for that same reason. An order carrying no operation or no `compiled_at` keeps
// fencing — an unreadable claim is not a retired one.
//
// That is the same question as "the writer's own contract" because scope substrates are disjoint by
// construction — `harness verify spec`'s DISJOINT rule fails a spec where two scopes claim the same
// path, and it runs at GATE L1b before any build starts. `frozen` is checked across all of them, so
// a path one scope froze stays frozen while another scope is in flight.
//
// Design (deliberately conservative, mirrors the GATE L2 block):
//   • Fail-OPEN whenever there is nothing to enforce: no active-order pointer (not running inside
//     a harness dispatch), pointer names an order that doesn't exist or is unparsable, the order
//     declares no boundaries at all, or the tool call carries no resolvable file path. A guard
//     that breaks legitimate non-harness edits would just get disabled.
//   • Fail-CLOSED the moment an order IS live and the target is outside what it permits — deny,
//     naming the reason so the model can self-correct. `frozen` outranks everything, including
//     an `allowed` glob that would otherwise match; `append_only` permits Edit and denies Write,
//     because Write overwrites what the append was supposed to preserve.
//   • Run-trace carve-out — writes under the ACTIVE feature's LOCAL gitignored root
//     (`.shapeup/<slug>/`) are always allowed: that root is harness bookkeeping the doer
//     is REQUIRED to write (task-executor P3 status/AC ticks + tasks/_index.md, run-state,
//     execution logs, the P3.7 discovery ledger). Substrate globs whitelist product code and
//     never list the run-trace, so without the carve-out a scoped round leaves its own task files
//     stale. Deliberately narrow: only the active slug's root. The pointers at the `.shapeup/`
//     root — `active-order` (this guard's own) and `active-scope` (the run pointer) — sit OUTSIDE
//     the carve-out by construction, so a worker cannot widen its own sandbox by rewriting the
//     thing that defines it.
//   • Every denial is also appended to the metrics pathology log (telemetry, not just defense).
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{file_path | edits[].file_path}, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, existsSync, appendFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative, dirname, sep } from "node:path";
import { isMain } from "../kernel/lib/argv.mjs";
import { LOCAL, SHARED, activeOrder, ordersDir, resultsDir, metricsShard } from "../kernel/lib/paths.mjs";
import { runHook, readStdin, settle, projectRoot } from "./lib/decision.mjs";

// --- tiny glob matcher: supports *, **, ? — enough for substrate globs, zero dependencies ---
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(relPath, globs) {
  return (globs || []).some((g) => globToRegExp(g).test(relPath));
}

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/**
 * Has this order been answered — i.e. has a result for THIS dispatch landed?
 *
 * Filesystem-only, because that is the one signal that survives a killed session. See the banner's
 * "ANSWERED IS A COMPARISON" note for why a same-named result file is not on its own an answer.
 *
 * @param {string} resultPath - Where this order's result would be.
 * @param {object} order - The parsed order, for its `compiled_at` stamp.
 * @returns {boolean} True when the result belongs to this dispatch rather than an earlier one.
 */
function answered(resultPath, order) {
  let mtimeMs;
  try { mtimeMs = statSync(resultPath).mtimeMs; } catch { return false; }
  const compiledAt = Date.parse(order?.compiled_at ?? "");
  if (Number.isNaN(compiledAt)) return true;    // no stamp to compare against — presence is the answer
  // WHOLE SECONDS, because that is all some filesystems keep of an mtime — HFS+ among them, which
  // this plugin's own development volume uses. The stamp carries milliseconds; compared raw against
  // a truncated mtime, a result written in the same second as its compile reads as OLDER than the
  // order and the order stays live. Flooring the stamp costs a one-second window the other way — a
  // re-dispatch inside the same second as the previous result reads as answered — which no real
  // dispatch is fast enough to hit.
  return mtimeMs >= Math.floor(compiledAt / 1000) * 1000;
}

/**
 * Operations whose order is a BUILD leg — one scope, one attempt, dispatched alongside its siblings.
 *
 * Everything else the compiler emits is a RUN-LEVEL phase dispatch, and only those retire at a phase
 * boundary (see the banner). The distinction is by operation rather than by "does it carry a scope",
 * because the single-task lane compiles an `execute` order with no scope contract on it and that leg
 * is still a build.
 */
const BUILD_OPERATIONS = new Set(["execute", "fix", "spike"]);

/**
 * Has the run moved past this order's phase — i.e. did a LATER order for a different operation get
 * compiled while this one was still unanswered?
 *
 * Conservative in both directions it cannot read: an order with no `operation`, a build leg, or an
 * order with no parseable `compiled_at` keeps fencing.
 *
 * @param {object} order - The parsed, unanswered order.
 * @param {Array<{operation:(string|undefined), at:number}>} stamps - Every compiled order's
 *   operation and parsed `compiled_at`, unparseable stamps excluded.
 * @returns {boolean} True when this order's phase is over and it should stop being enforced.
 */
function pastItsPhase(order, stamps) {
  const op = order?.operation;
  if (!op || BUILD_OPERATIONS.has(op)) return false;
  const at = Date.parse(order?.compiled_at ?? "");
  if (Number.isNaN(at)) return false;
  return stamps.some((s) => s.at > at && s.operation !== op);
}

/**
 * Every order for this run that has been compiled, not yet answered, and whose phase is still open.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - The run named by the pointer.
 * @returns {object[]} Parsed orders; unreadable files are skipped, never treated as permissive.
 */
function liveOrders(cwd, slug) {
  const dir = ordersDir(cwd, slug);
  if (!existsSync(dir)) return [];
  const rDir = resultsDir(cwd, slug);
  const unanswered = [];
  const stamps = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const order = readJSON(join(dir, f));
    if (!order) continue;
    const at = Date.parse(order.compiled_at ?? "");
    if (!Number.isNaN(at)) stamps.push({ operation: order.operation, at });
    if (!answered(join(rDir, f), order)) unanswered.push(order);
  }
  return unanswered.filter((o) => !pastItsPhase(o, stamps));
}

function extractPaths(toolInput) {
  const paths = [];
  if (toolInput?.file_path) paths.push(toolInput.file_path);
  if (Array.isArray(toolInput?.edits)) {
    for (const e of toolInput.edits) if (e?.file_path) paths.push(e.file_path);
  }
  return paths;
}

export function logPathology(metricsPath, event) {
  try {
    mkdirSync(dirname(metricsPath), { recursive: true });
    appendFileSync(metricsPath, JSON.stringify(event) + "\n");
  } catch { /* telemetry is best-effort; never block on a logging failure */ }
}

async function main() {
  await runHook("sandbox-guard", async () => {
  const raw = await readStdin();
  let p;
  /** Fail-open, with the reason on the record (hooks/lib/decision.mjs). */
  const defer = (reason, rule) => settle({
    verdict: "allow", event: "PreToolUse", tool: p?.tool_name ?? null, cwd: p?.cwd, reason, rule,
  });
  try { p = JSON.parse(raw || "{}"); }
  catch (e) { settle({ verdict: "error", event: "PreToolUse", reason: `unparseable payload: ${e.message}` }); }

  if (!["Edit", "Write", "MultiEdit"].includes(p.tool_name)) {
    defer(`${p.tool_name ?? "no tool_name"} is not a write tool — out of scope`);
  }

  // WHERE THE SHELL IS versus WHERE THE PROJECT IS. `p.cwd` follows the worker's shell — a leg that
  // `cd`s into a sub-folder fires this hook from there — and the pointer, the order set and the
  // substrate globs all live at the project root. Read from the sub-folder, the pointer was simply
  // absent and this guard deferred at `no-round` on every write from that shell: a substrate fence
  // that switches off whenever the worker changes directory. Raw tool paths still resolve against
  // the shell's own cwd, because that is what a relative path in the tool input means.
  const cwd = p.cwd || process.cwd();
  const root = projectRoot(cwd);
  const activeOrderPath = activeOrder(root);
  if (!existsSync(activeOrderPath)) defer("no active-order pointer — no tracked task running", "no-round");

  const active = readJSON(activeOrderPath);
  if (!active?.slug || !active?.order_path) defer("active-order pointer is unreadable or incomplete", "bad-pointer");

  // EVERY LIVE ORDER, not just the pointer's. The pointer names one order, and with scopes building
  // CONCURRENTLY the last compile wins it — so a write from scope A would be judged against scope
  // B's contract, which is either a false block or a false permit depending on which way the race
  // fell. Scope substrates are disjoint by construction (spec-lint's DISJOINT rule fails a spec
  // where they are not), so "is this write inside SOME live contract" and "is it inside the
  // writer's own contract" are the same question — and only the first can be asked without a
  // shared mutable pointer.
  //
  // Live = compiled and not yet answered. An order whose result is on disk has finished; leaving it
  // in the candidate set would keep a finished scope's substrate open for the rest of the run — and
  // leaving the POINTER's own order in unconditionally kept a finished RUN's substrate open forever.
  const orders = liveOrders(root, active.slug);
  if (orders.length === 0) defer(`no live order for ${active.slug}`, "no-order");

  const withSubstrate = orders.filter((o) => o.substrate);
  if (withSubstrate.length === 0) defer("no live order declares a substrate block", "no-substrate");

  const contracts = withSubstrate.map((o) => ({
    order_id: o.order_id,
    allowed: [...(o.substrate.allowed || []), ...(o.substrate.shared || [])],
    appendOnly: o.substrate.append_only || [],
    frozen: o.substrate.frozen || [],
  })).filter((c) => c.allowed.length || c.appendOnly.length || c.frozen.length);

  if (contracts.length === 0) defer("no live order declares write/append/frozen boundaries", "no-whitelist");

  const targetPaths = extractPaths(p.tool_input);
  if (targetPaths.length === 0) defer("no writable path in the tool input", "no-target");

  const metricsPath = metricsShard(root);
  const runTracePrefix = join(LOCAL, active.slug) + sep;
  const violations = [];
  const blockReasons = [];
  let frozenHits = 0;

  for (const raw of targetPaths) {
    const abs = resolve(cwd, raw);
    const rel = relative(root, abs);

    // Frozen takes absolute precedence, and it is checked across EVERY live contract: a path one
    // scope froze stays frozen while another scope is in flight, which is the whole point of
    // declaring it.
    //
    // IT IS CHECKED BEFORE THE RUN-TRACE CARVE-OUT, and that order is load-bearing. The carve-out
    // below exists so the doer can keep its own bookkeeping current; it was never a licence to
    // overwrite a file a live contract declared read-only. Checked after it, every `frozen` glob
    // naming a path inside the run trace was inert — the board an evaluation froze, the staged pitch
    // a planner is graded against — so the compiler emitted a declaration with no enforcer, which is
    // the exact state this hook exists to end. A path a live contract freezes is a violation
    // wherever it lives.
    const freezer = contracts.find((c) => matchesAny(rel, c.frozen));
    if (freezer) {
      violations.push(rel);
      frozenHits++;
      blockReasons.push(`${rel} is frozen by ${freezer.order_id}`);
      continue;
    }

    if (rel.startsWith(runTracePrefix)) continue;

    if (contracts.some((c) => matchesAny(rel, c.allowed))) continue;      // inside a live contract

    if (contracts.some((c) => matchesAny(rel, c.appendOnly))) {
      if (p.tool_name === "Write") {
        violations.push(rel);
        blockReasons.push(`${rel} is append-only (Write overwrites, use Edit)`);
      }
      continue;
    }

    violations.push(rel);
    blockReasons.push(`${rel} is outside every live order's allowed scopes`);
  }

  // Inside the substrate — the "inspected and permitted" row. Previously byte-identical to
  // "this hook never ran", which is how 26 enforcement points sat inert behind 610 green checks.
  if (violations.length === 0) {
    defer(`${targetPaths.length} path(s) inside a live order's substrate (${contracts.length} live) — permitted`, "in-substrate");
  }

  // THE REMEDY DIFFERS BY TIER, and naming the wrong one costs a session real time. A product-code
  // path outside every substrate is a scope-cut question, and widening the order is the honest fix.
  // A path under the COMMITTED tier is not: no build scope may own the run's own governance and
  // spec artifacts, so widening a substrate to reach one is the wrong move in a plausible-looking
  // direction. Those files belong to the orchestrator, whose write window is a phase boundary —
  // no dispatch in flight — and never the middle of somebody else's dispatch.
  const committed = violations.filter((v) => v.split(/[\\/]/)[0] === SHARED);
  const hint = committed.length === violations.length
    ? `${SHARED}/ is committed tier: these belong to the orchestrator, not to a worker substrate. `
      + "Write them at a phase boundary, with no dispatch in flight — do not widen an order to reach one."
    : "If this write legitimately crosses scopes, the order's substrate needs to be expanded (e.g. via ba --remap).";

  logPathology(metricsPath, {
    schema_version: 1,
    at: new Date().toISOString(),
    kind: "pathology",
    pathology: "PA3",
    order: active.order_path,
    slug: active.slug,
    blocked_paths: violations,
  });

  return {
    verdict: "deny", event: "PreToolUse", tool: p.tool_name, subject: active.order_path, cwd: root,
    // THE LEDGER NAMES THE CAUSE, not just the verdict. A write refused because a live contract
    // FROZE the path and a write refused because no contract covers it are different facts with
    // different remedies, and a single rule string cannot tell the reader which one happened —
    // which is how a frozen declaration can stop being enforced without a single row moving.
    rule: frozenHits === violations.length ? "frozen" : "outside-substrate",
    reason: `${violations.length} write(s) rejected by substrate boundaries: ${blockReasons.join("; ")}`,
    payload: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Sandbox guard (PA3) — no live order's substrate covers these writes:\n` +
          `${blockReasons.join("\n")}\n` +
          hint,
      },
    },
  };
  });
}

if (isMain(import.meta.url)) {
  main();
}
