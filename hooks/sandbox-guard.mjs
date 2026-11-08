#!/usr/bin/env node
// Sandbox guard — PreToolUse hook: writes outside the live order's substrate are refused.
//
// Blocks Edit/Write/MultiEdit calls that no LIVE ORDER's `substrate` block permits. Turns "a worker
// only writes what the run authorised" from prose into a precondition the model cannot talk past.
// It also refuses, at the write, a committed-tier file whose text names a run-trace path or a board id
// (`committedTierLeaks` below) — the tier-direction rule, asked where the writer can still rephrase.
//
// IT ENFORCES THE ORDER, NOT THE SCOPE CONTRACT. The loop stamps a write contract onto every order
// it writes — allowed, shared, append_only, frozen, own — and reading the order makes that contract
// and the one this hook enforces the same object, for every operation, with no per-operation code
// here. Resolving the scope contract instead would cover only the build, because only build orders
// carry a scope.
//
// IT READS EVERY LIVE ORDER, NOT A POINTER TO ONE. `.shapeup/active-order` names the run and nothing
// more; the loop sets it with `harness order open` and `harness order close` retires it. A single
// pointer cannot survive concurrency: with scopes building side by side the last order opened wins
// it, and a write from scope A would be judged against scope B's contract — a false block or a false
// permit depending on which way the race fell. So the candidate set is every order under `orders/`
// that is not yet ANSWERED, and a write is permitted when SOME live contract covers it.
//
// THE POINTER IS NOT A LIVENESS SIGNAL. It arms the fence — with no pointer every write is allowed —
// but liveness is "written, no result yet", read off the order set, so a run that ended and retired
// its pointer fences nothing and a leftover pointer is untidy rather than load-bearing.
//
// ANSWERED IS A COMPARISON, NOT A PRESENCE TEST. Order filenames for the run-level operations carry
// no round, so re-dispatching one inside the same run rewrites the order beside the PREVIOUS
// dispatch's result — and a presence test would read that as finished and run the new dispatch
// unfenced. An order counts as answered only when its result file is at least as new as the order's
// own `compiled_at`, the stamp the loop writes INTO the order, which a copy or a touch cannot
// perturb. An order carrying no stamp falls back to presence.
//
// A RUN-LEVEL ORDER RETIRES AT ITS PHASE BOUNDARY. A phase dispatch whose worker never returned — a
// killed evaluation, a QA leg that escalated without a result — would otherwise stay live for the rest
// of the run and fence everything its `frozen` list names. The next phase writing its own order is
// the signal: an order for a RUN-LEVEL operation stops being live once an order for a DIFFERENT
// operation has been written after it. Build legs are exempt: they run concurrently, finish out of
// order, and an abandoned one is resolved by `harness init run --force`. Two concurrent legs of the
// SAME operation never retire each other. An order carrying no operation or no `compiled_at` keeps
// fencing — an unreadable claim is not a retired one.
//
// "The writer's own contract" and "some live contract" are the same question because scope
// substrates are disjoint by construction: the loop reads the contracts for overlap before it
// releases scopes together. `frozen` is checked across all of them, so a path one scope froze stays
// frozen while another scope is in flight.
//
// Design (deliberately conservative):
//   • Fail-OPEN whenever there is nothing to enforce: no active-order pointer (not running inside
//     a harness dispatch), pointer names an order that doesn't exist or is unparsable, the order
//     declares no boundaries at all, or the tool call carries no resolvable file path. A guard
//     that breaks legitimate non-harness edits would just get disabled.
//   • Fail-CLOSED the moment an order IS live and the target is outside what it permits — deny,
//     naming the reason so the model can self-correct. `frozen` outranks everything, including
//     an `allowed` glob that would otherwise match; `append_only` permits Edit and denies Write,
//     because Write overwrites what the append was supposed to preserve.
//   • Run-trace carve-out — writes under the ACTIVE feature's LOCAL gitignored root
//     (`.shapeup/<slug>/`) are allowed unless a live order freezes them: that root is bookkeeping
//     the doer is REQUIRED to write. Deliberately narrow: only the active slug's root. The pointers
//     at the `.shapeup/` root — `active-order` (this guard's own) and `active-scope` (the run
//     pointer) — sit OUTSIDE the carve-out by construction, so a worker cannot widen its own
//     sandbox by rewriting the thing that defines it.
//   • Every denial is also appended to the metrics pathology log (telemetry, not just defense).
//
// Contract: PreToolUse stdin JSON { tool_name, tool_input:{file_path | edits[].file_path}, cwd }.
// Deny via { hookSpecificOutput: { hookEventName, permissionDecision:"deny", permissionDecisionReason } }.

import { readFileSync, existsSync, appendFileSync, mkdirSync, readdirSync, statSync, realpathSync, lstatSync, readlinkSync } from "node:fs";
import { resolve, join, relative, dirname, basename, sep } from "node:path";
import { isMain } from "../kernel/lib/argv.mjs";
import { LOCAL, SHARED, activeOrder, ordersDir, resultsDir, metricsShard, dispatchReceipts } from "../kernel/lib/paths.mjs";
import { runHook, readStdin, settle, projectRoot } from "./lib/decision.mjs";
import { SCANNED, tierLeaks } from "./lib/tier.mjs";

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

/**
 * Does `relPath` match any of `globs`? With `fold` set, both sides are compared case-folded — the
 * caller passes it when the filesystem underneath does not distinguish case, so that a glob
 * declared as `receipts/**` also covers the spelling `Receipts/**`, which on that filesystem is the
 * same directory.
 */
export function matchesAny(relPath, globs, fold = false) {
  const path = fold ? relPath.toLowerCase() : relPath;
  return (globs || []).some((g) => globToRegExp(fold ? g.toLowerCase() : g).test(path));
}

// --- the path a write actually lands on ---------------------------------------------------------
//
// A substrate glob is a SPELLING; what it protects is a FILE. Measured against a real compiled
// order: `.shapeup/<slug>/receipts/dispatch.jsonl` was denied as frozen, `Receipts/dispatch.jsonl`
// was permitted, and on this machine's case-insensitive filesystem the second spelling overwrote
// the first file. A symlink was the same hole from another side: `src/x -> ../.shapeup/<slug>/legs.jsonl`
// sits inside an allowed `src/**` and resolves `..` without following the link, so the write went
// through. No list of globs can close either — case, links, Unicode forms are all further spellings
// of one target — so the comparison is made on the resolved real path instead, and case-folded when
// the filesystem itself folds case. The globs stay exactly as the compiler wrote them.

/**
 * Resolve `abs` through the filesystem: symlinks in any existing ancestor are followed (a dangling
 * link is followed by reading it), and the part that does not exist yet is re-attached to the real
 * path of the deepest ancestor that does. A path nothing on disk can resolve is returned as given.
 *
 * @param {string} abs - Absolute path as the tool named it.
 * @param {number} [depth] - Recursion guard for link chains.
 * @returns {string} The path the write would actually reach.
 */
export function realPathOf(abs, depth = 0) {
  if (depth > 40) return abs;
  let cur = abs;
  const tail = [];
  for (let i = 0; i < 128; i++) {
    try { return join(realpathSync.native(cur), ...[...tail].reverse()); } catch { /* not yet resolvable as a whole */ }
    try {
      if (lstatSync(cur).isSymbolicLink()) {
        const target = resolve(dirname(cur), readlinkSync(cur));
        return realPathOf(join(target, ...[...tail].reverse()), depth + 1);
      }
    } catch { /* does not exist at all — climb */ }
    const parent = dirname(cur);
    if (parent === cur) return abs;
    tail.push(basename(cur));
    cur = parent;
  }
  return abs;
}

/**
 * Does the filesystem under `dir` fold case? Decided by asking it: the directory's own real path,
 * with every letter's case swapped, exists and resolves back to the same real path only where the
 * filesystem does not distinguish case. A path with no letters to swap answers "no".
 *
 * @param {string} dir - An existing directory (the project root).
 * @returns {boolean} True on a case-insensitive filesystem.
 */
export function fsFoldsCase(dir) {
  const swapped = dir.replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
  if (swapped === dir) return false;
  try { return existsSync(swapped) && realpathSync.native(swapped) === realpathSync.native(dir); } catch { return false; }
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

/**
 * The agent that took each live order's dispatch, from the receipts the dispatch hook wrote.
 *
 * WHO WRITES, not only where. An order's own paths — its WorkResult above all — are carved out of
 * the frozen run trace, and with two build legs live the carve-out answered for either of them: a
 * leg could write its sibling's result. The host names the sub-agent behind every tool call
 * (`agent_id`), and the dispatch receipt recorded the same id when that sub-agent invoked the
 * worker skill, so the skill's writes carry the id of the receipt that aimed it. Only a receipt
 * taken after the order was compiled counts, and the newest wins, so a re-dispatch of the same
 * order binds to the agent that took it this time.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - The run named by the pointer.
 * @param {object[]} orders - The live orders.
 * @returns {Map<string,string>} order_id → agent_id; an order with no attributable receipt is absent.
 */
export function dispatchAgents(cwd, slug, orders) {
  const out = new Map();
  let text = "";
  try { text = readFileSync(dispatchReceipts(cwd, slug), "utf8"); } catch { return out; }
  const compiled = new Map(orders.map((o) => [o.order_id, Date.parse(o.compiled_at ?? "")]));
  const newest = new Map();
  for (const line of text.split("\n")) {
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (!r?.order_id || !compiled.has(r.order_id) || typeof r.agent_id !== "string" || !r.agent_id) continue;
    const at = Date.parse(r.at ?? "");
    const c = compiled.get(r.order_id);
    if (Number.isNaN(at) || (!Number.isNaN(c) && at < c)) continue;
    const prev = newest.get(r.order_id);
    if (!prev || at >= prev.at) newest.set(r.order_id, { at, agent: r.agent_id });
  }
  for (const [id, v] of newest) out.set(id, v.agent);
  return out;
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

/** Committed-tier trees that hold instructions rather than references — outside the lint's walk. */
const NOT_A_SLUG = new Set(["knowledge-base"]);

/**
 * The (path, content) pairs one write tool call is about to commit to disk.
 *
 * THE THREE WRITE TOOLS SPELL CONTENT THREE WAYS, and a check that reads only `content` is blind to
 * the Edit that adds the same line — which is the form the measured recurrence took, since the file
 * already existed by then.
 *
 * @param {object} toolInput - The PreToolUse `tool_input` block.
 * @returns {Array<{path:string, content:string}>} Pairs with a usable path and string content.
 */
export function extractWrites(toolInput) {
  const out = [];
  const base = toolInput?.file_path;
  if (typeof toolInput?.content === "string" && base) out.push({ path: base, content: toolInput.content });
  if (typeof toolInput?.new_string === "string" && base) out.push({ path: base, content: toolInput.new_string });
  if (Array.isArray(toolInput?.edits)) {
    for (const e of toolInput.edits) {
      const p = e?.file_path || base;
      if (p && typeof e?.new_string === "string") out.push({ path: p, content: e.new_string });
    }
  }
  return out;
}

/**
 * Is this path inside the committed tier the lint walks — `shapeup/<slug>/…`, scanned form?
 *
 * @param {string} rel - Path relative to the project root, as the lint would name it.
 * @returns {boolean} True when a leak here is a leak the lint would red.
 */
export function inCommittedTier(rel) {
  if (!rel || rel.startsWith("..") || rel.startsWith(sep)) return false;
  const parts = rel.split(/[\\/]/);
  // `shapeup/<slug>/<file>` — the lint walks a slug's tree, so a file at the tier root belongs to
  // no run and is left alone, and `knowledge-base` is a sibling of the slugs, not one of them.
  if (parts[0] !== SHARED || parts.length < 3 || NOT_A_SLUG.has(parts[1])) return false;
  return SCANNED.test(rel);
}

/**
 * The committed tier's write boundary: the tier-direction leaks this call would commit.
 *
 * It is the tier-direction rule, asked at the write — the one
 * moment the writer still knows what it meant to say, because a worker carries no lesson across a
 * dispatch and the lint reds the same file a phase later. The predicate is the lint's own scanner
 * (`tierLeaks`), imported and never restated, so this cannot become narrower or wider than the rule.
 * `shapeup/knowledge-base/` is outside, exactly as it is outside the lint's walk. Fail-OPEN on
 * everything it cannot positively prove: no path, no content, a path outside `shapeup/<slug>/`, a
 * file form the lint does not scan.
 *
 * @param {object} toolInput - The PreToolUse `tool_input` block.
 * @param {string} cwd - The shell's working directory, against which a raw tool path resolves.
 * @param {string} root - The project root the committed tier lives under.
 * @returns {{rel:string, blocked:string[]}} The first in-tier path and one line per leak; `blocked`
 *   is empty when the write carries none.
 */
export function committedTierLeaks(toolInput, cwd, root) {
  const inTier = extractWrites(toolInput)
    .map((w) => ({ ...w, rel: relative(root, resolve(cwd, w.path)) }))
    .filter((w) => inCommittedTier(w.rel));
  const blocked = [];
  // THE TOKEN IS QUOTED BACK, which the lint's own message does not need to do — it reports against a
  // file on disk the reader can open at that line. Here the line does not exist yet, so naming the
  // exact string is the difference between a denial that is acted on and one that is retried verbatim.
  for (const w of inTier) for (const leak of tierLeaks(w.content)) blocked.push(`${w.rel}:${leak.line} — \`${leak.token}\` ${leak.detail}`);
  return { rel: inTier[0]?.rel ?? "", blocked };
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

  // THE COMMITTED TIER FIRST, and before every "no live order" exit below: the tier-direction rule
  // holds with no run in flight, and a write that is clean here falls through to the substrate fence.
  const tier = committedTierLeaks(p.tool_input, cwd, root);
  if (tier.blocked.length) {
    return {
      verdict: "deny", event: "PreToolUse", tool: p.tool_name, subject: tier.rel, cwd: root,
      rule: "tier-direction",
      reason: `${tier.blocked.length} tier-direction leak(s) refused at the write boundary: ${tier.blocked.join("; ")}`,
      payload: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            "Tier guard (TIER-DIRECTION) — this write would put a reference into the committed tier that " +
            "cannot survive the trip to another machine:\n" +
            `${tier.blocked.join("\n")}\n` +
            "Refused here, while the writer still knows what it meant to say. " +
            "Rephrase the line now: cite the committed artifact, the use case or the scope_id, or describe " +
            "the tier without naming a path.",
        },
      },
    };
  }

  const activeOrderPath = activeOrder(root);
  if (!existsSync(activeOrderPath)) defer("no active-order pointer — no tracked task running", "no-round");

  const active = readJSON(activeOrderPath);
  if (!active?.slug || !active?.order_path) defer("active-order pointer is unreadable or incomplete", "bad-pointer");

  // EVERY LIVE ORDER, not just the pointer's. The pointer names one order, and with scopes building
  // CONCURRENTLY the last order opened wins it — so a write from scope A would be judged against scope
  // B's contract, which is either a false block or a false permit depending on which way the race
  // fell. Scope substrates are disjoint by construction (the loop's planning read-back fails a spec
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
    // The one exception to "frozen outranks everything", and it is the loop's to grant, never
    // the worker's to request: the paths THIS order authors, named from its own identity. A build
    // leg's substrate freezes the whole run trace, so without this its own WorkResult — its
    // documented last step — would be denied along with every channel it must not touch.
    own: o.substrate.own || [],
  })).filter((c) => c.allowed.length || c.appendOnly.length || c.frozen.length);

  if (contracts.length === 0) defer("no live order declares write/append/frozen boundaries", "no-whitelist");
  const agents = dispatchAgents(root, active.slug, withSubstrate);

  const targetPaths = extractPaths(p.tool_input);
  if (targetPaths.length === 0) defer("no writable path in the tool input", "no-target");

  const metricsPath = metricsShard(root);
  const runTracePrefix = join(LOCAL, active.slug) + sep;
  const violations = [];
  const blockReasons = [];
  let frozenHits = 0;

  // Compare where the write lands, not how it was spelled (see `realPathOf`). The root is resolved
  // the same way so a checkout reached through a linked directory still yields a relative path.
  const realRoot = realPathOf(resolve(root));
  const fold = fsFoldsCase(realRoot);
  const under = (rel, prefix) => (fold ? rel.toLowerCase().startsWith(prefix.toLowerCase()) : rel.startsWith(prefix));

  for (const raw of targetPaths) {
    const abs = realPathOf(resolve(cwd, raw));
    const rel = relative(realRoot, abs);

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
    // `own` first, and only against the contract that declared it: another live order's exception
    // never licenses this write. A path no contract claims as its own falls through to the freeze.
    // And only from the dispatch that took that order. A write from a sub-agent is refused when every
    // live order claiming the path was taken by a different sub-agent; a write with no agent id (the
    // operator's own session) or an order with no attributable receipt keeps today's permit.
    const owners = contracts.filter((c) => matchesAny(rel, c.own, fold));
    if (owners.length) {
      const writer = typeof p.agent_id === "string" && p.agent_id ? p.agent_id : null;
      if (!writer || owners.some((c) => !agents.has(c.order_id) || agents.get(c.order_id) === writer)) continue;
      violations.push(rel);
      blockReasons.push(`${rel} belongs to ${owners.map((c) => c.order_id).join(", ")}, whose dispatch is another agent's`);
      continue;
    }

    const freezer = contracts.find((c) => matchesAny(rel, c.frozen, fold));
    if (freezer) {
      violations.push(rel);
      frozenHits++;
      blockReasons.push(`${rel} is frozen by ${freezer.order_id}`);
      continue;
    }

    if (under(rel, runTracePrefix)) continue;

    if (contracts.some((c) => matchesAny(rel, c.allowed, fold))) continue;      // inside a live contract

    if (contracts.some((c) => matchesAny(rel, c.appendOnly, fold))) {
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
  const committed = violations.filter((v) => (fold ? v.split(/[\\/]/)[0].toLowerCase() === SHARED.toLowerCase() : v.split(/[\\/]/)[0] === SHARED));
  const notOwn = blockReasons.every((r) => r.endsWith("whose dispatch is another agent's"));
  const hint = notOwn
    ? "Each leg writes only the paths of the order it was dispatched with. Return your own result, never a sibling's."
    : committed.length === violations.length
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
    rule: frozenHits === violations.length ? "frozen" : notOwn ? "not-own-dispatch" : "outside-substrate",
    reason: `${violations.length} write(s) rejected by substrate boundaries: ${blockReasons.join("; ")}`,
    payload: {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Sandbox guard (PA3) — ${notOwn ? "these paths belong to another live dispatch" : "no live order's substrate covers these writes"}:\n` +
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
