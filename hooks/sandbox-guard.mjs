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
 * Every order for this run that has been compiled and not yet answered.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - The run named by the pointer.
 * @returns {object[]} Parsed orders; unreadable files are skipped, never treated as permissive.
 */
function liveOrders(cwd, slug) {
  const dir = ordersDir(cwd, slug);
  if (!existsSync(dir)) return [];
  const rDir = resultsDir(cwd, slug);
  const live = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const order = readJSON(join(dir, f));
    if (!order) continue;
    if (!answered(join(rDir, f), order)) live.push(order);
  }
  return live;
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

  for (const raw of targetPaths) {
    const abs = resolve(cwd, raw);
    const rel = relative(root, abs);
    if (rel.startsWith(runTracePrefix)) continue;

    // Frozen takes absolute precedence, and it is checked across EVERY live contract: a path one
    // scope froze stays frozen while another scope is in flight, which is the whole point of
    // declaring it.
    const freezer = contracts.find((c) => matchesAny(rel, c.frozen));
    if (freezer) {
      violations.push(rel);
      blockReasons.push(`${rel} is frozen by ${freezer.order_id}`);
      continue;
    }

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
    rule: "outside-substrate",
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
