#!/usr/bin/env node
// WorkResult ingester (pure-skill architecture v1.0, plan P1).
//
// The other half of the orchestrator's pipeline sub-layer — and the mechanism that finally
// closes D6: workers no longer write shared state; they RETURN data (a WorkResult envelope)
// and this script performs every shared-state write, deterministically, in one place:
//
//   task_results[]      → tick AC boxes, flip task frontmatter status, append Execution Log,
//                         update tasks/_index.md row, propagate unblocks (old P3.1–P3.6)
//   discoveries[]       → append to .shapeup/<slug>/discovery/ledger.md (old P3.7 / QA H.3)
//   verdict.criteria[]  → append evaluation/.verdicts-<target>.jsonl (old evaluator B.0)
//   verdict.refuted[]   → un-tick refuted AC boxes + set eval_verdict frontmatter (old B.2/B.2b)
//
// Zero dependencies, zero network, schema-validated input (a malformed result never mutates
// the board). Single-writer becomes mechanically true, not aspirational.
//
// Usage:  node kernel/harness.mjs reduce ingest <result.json> [--cwd <dir>]
// Exit:   0 = ingested, 1 = result rejected (schema) or a write failed.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, statSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../verify/envelope.mjs";
import { runArgs } from "../lib/argv.mjs";
import { tasksDir, localRoot, dispatchReceipts } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT_SCHEMA = JSON.parse(readFileSync(resolve(HERE, "../../skills/tech-lead/schemas/work-result.schema.json"), "utf8"));

/**
 * @returns {string} Today's date as an ISO `YYYY-MM-DD` string (UTC), for log/frontmatter stamps.
 */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Hold an exclusive lock on one run's shared state for the duration of `fn`.
 *
 * WHY THIS EXISTS (measured, not theorized). Since scopes fan out, several legs call this reducer
 * AT THE SAME TIME, each with its own result. Most of what it writes is per-task and cannot
 * collide — but `tasks/_index.md`, the discovery ledger and the verdict record are one file each,
 * updated read-modify-write. Three concurrent ingests over three different tasks left all three
 * task files `done` and the BOARD showing two: the middle write read the index before the first
 * had written it and then overwrote it. A board that disagrees with its own task files is the
 * exact "parallel work corrupts shared state" failure the single-writer rule exists to prevent,
 * and the rule was true of the CODE and false of the PROCESS the moment there were two of them.
 *
 * `mkdir` is the primitive: it is atomic on POSIX and Windows alike, needs no dependency, and
 * leaves a directory a human can delete. A stale lock older than the timeout is broken rather than
 * waited on forever — a crashed reducer must not wedge every later one.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug; the lock is per run, never global.
 * @param {Function} fn - The critical section.
 * @returns {*} Whatever `fn` returns.
 */
function withLock(cwd, slug, fn) {
  const lock = join(localRoot(cwd, slug), ".ingest.lock");
  const owner = join(lock, "owner.json");
  const STALE_MS = 30_000, WAIT_MS = 20;
  const startedAt = Date.now();
  mkdirSync(dirname(lock), { recursive: true });

  /**
   * Is the process that took this lock still running?
   *
   * AGE ALONE CANNOT ANSWER IT, and that was the hole. `mkdir` stamps the lock's mtime once and the
   * critical section is synchronous, so a holder cannot refresh it while it works — which makes "has
   * been working for 31 seconds" and "died 31 seconds ago" the same observation. A waiter then broke
   * a live holder's lock and entered the section beside it, so the reducer that exists to serialise
   * shared-state writes had two writers inside it. Reproduced directly: a 45-second-old lock over a
   * working holder was broken and the second ingest wrote.
   *
   * `kill(pid, 0)` sends no signal and only asks whether the process exists. A lock with no readable
   * owner is treated as ABANDONED once it is also stale — that is the pre-existing behaviour, kept
   * for locks written before this file recorded an owner.
   *
   * @returns {boolean} True when a live process holds the lock.
   */
  const heldByLiveProcess = () => {
    try {
      const o = JSON.parse(readFileSync(owner, "utf8"));
      if (typeof o?.pid !== "number") return false;
      process.kill(o.pid, 0);      // throws ESRCH when the process is gone
      return true;
    } catch { return false; }
  };

  for (;;) {
    try {
      mkdirSync(lock);
      // Best-effort: the lock is already held by us, so failing to name the owner costs a later
      // waiter its liveness check, never correctness of this section.
      try { writeFileSync(owner, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); } catch { /* ignore */ }
      break;
    } catch { /* held — wait, or break an abandoned one */ }
    let heldFor = 0;
    try { heldFor = Date.now() - statSync(lock).mtimeMs; } catch { continue; }  // released mid-check
    // Break it only when it is BOTH stale AND ownerless-or-dead. A slow holder keeps its lock.
    if (heldFor > STALE_MS && !heldByLiveProcess()) {
      try { rmSync(lock, { recursive: true, force: true }); } catch { /* someone else broke it */ }
      continue;
    }
    if (Date.now() - startedAt > STALE_MS) {
      // Refusing is the safe direction: proceeding unlocked is how the lost update happened.
      throw new Error(`ingest could not take the ${slug} lock within ${STALE_MS} ms (${lock}) — another reducer is holding it`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, WAIT_MS);   // sleep, no busy spin
  }
  try { return fn(); } finally { try { rmSync(lock, { recursive: true, force: true }); } catch { /* already gone */ } }
}

/**
 * Locate a task file on the LOCAL board by id.
 * @param {string} cwd - Working-directory root.
 * @param {string} slug - Feature slug.
 * @param {string} taskId - Task id prefix to match (e.g. "TASK-001").
 * @returns {string|null} Absolute path of the first `<taskId>*.md` file, or null when the tasks
 *   directory or a matching file does not exist.
 */
export function findTaskFile(cwd, slug, taskId) {
  const dir = tasksDir(cwd, slug);
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.startsWith(taskId) && n.endsWith(".md"));
  return f ? join(dir, f) : null;
}

/**
 * Set a scalar frontmatter field in a task-file body, adding it when absent.
 * @param {string} body - Full task-file text.
 * @param {string} key - Frontmatter key to set.
 * @param {(string|number)} value - Value to write (stringified inline).
 * @returns {string} The body with `key: value` set; returned unchanged when the body has no
 *   frontmatter block.
 */
export function setFrontmatter(body, key, value) {
  const m = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return body;
  const re = new RegExp(`^${key}:.*$`, "m");
  const fm = re.test(m[1]) ? m[1].replace(re, `${key}: ${value}`) : `${m[1]}\n${key}: ${value}`;
  return body.replace(m[1], fm);
}

/**
 * Tick or un-tick the first acceptance-criterion checkbox whose text matches `ac`.
 * @param {string} body - Full task-file text.
 * @param {string} ac - Criterion text to match (case/space-insensitive substring, either direction).
 * @param {boolean} checked - true to write `[x]`, false to write `[ ]`.
 * @returns {{body:string, hit:boolean}} The updated body and whether a checkbox matched (only the
 *   first match is changed).
 */
export function setCheckbox(body, ac, checked) {
  const needle = ac.toLowerCase().replace(/\s+/g, " ").trim();
  const lines = body.split(/\r?\n/);
  let hit = false;
  const out = lines.map((line) => {
    const m = line.match(/^(\s*- \[)([ x])(\]\s+)(.*)$/);
    if (!m || hit) return line;
    const text = m[4].toLowerCase().replace(/\s+/g, " ").trim();
    if (text.includes(needle) || needle.includes(text)) {
      hit = true;
      return `${m[1]}${checked ? "x" : " "}${m[3]}${m[4]}`;
    }
    return line;
  });
  return { body: out.join("\n"), hit };
}

/**
 * Flip a task's row in `tasks/_index.md` to a done state.
 * @param {string} indexBody - Full board-index text.
 * @param {string} taskId - Task id whose row to update.
 * @param {boolean} done - When true, rewrite the row's status emoji/word to done; false is a no-op.
 * @returns {string} The board text with the matching row updated (unchanged when no row matches).
 */
export function updateBoardRow(indexBody, taskId, done) {
  return indexBody.split(/\r?\n/).map((line) => {
    if (!line.includes(taskId) || !line.includes("|")) return line;
    if (done) return line.replace(/⬜|🔄|⏳|🚫/g, "✅").replace(/\b(ready|in-progress|blocked)\b/gi, "done");
    return line;
  }).join("\n");
}

/**
 * Apply one validated WorkResult to the working tree — the single-writer step (D6): ticks AC
 * boxes, flips task status, appends the Execution Log, propagates unblocks, appends discoveries,
 * writes the verdict ledger + un-ticks refuted boxes.
 *   verdict{criteria[],refuted[]}).
 * @param {{cwd:string}} opts - cwd: working-directory root every LOCAL path resolves against.
 * @returns {{slug:string, tasks_updated:string[], acs_ticked:number, unblocked:string[],
 *   discoveries_appended:number, refuted_unticked:number, verdict_lines:number}} A summary of every write performed.
 * @throws {Error} If a task/board/ledger file it must write is not writable (fs error propagates).
 *   `evaluation/.verdicts-*.jsonl` under `.shapeup/<slug>/`.
 */
export function applyResult(result, { cwd }) {
  const slug = result.order_id.split("/")[0];
  return withLock(cwd, slug, () => applyResultLocked(result, { cwd, slug }));
}

/**
 * The reducer proper. Runs inside the run's ingest lock — see {@link withLock}.
 *
 * @param {object} result - A schema-valid WorkResult.
 * @param {object} ctx - `{cwd, slug}`.
 * @returns {object} The summary {@link applyResult} returns.
 */
function applyResultLocked(result, { cwd, slug }) {
  const local = localRoot(cwd, slug);
  const summary = { slug, tasks_updated: [], acs_ticked: 0, unblocked: [], discoveries_appended: 0, refuted_unticked: 0, verdict_lines: 0 };

  // 1. Task results → task files + board (old task-executor P3.1/P3.2/P3.6).
  const boardIndex = join(local, "tasks", "_index.md");
  for (const tr of result.task_results || []) {
    const path = findTaskFile(cwd, slug, tr.task_id);
    if (!path) continue;
    let body = readFileSync(path, "utf8");
    for (const acr of tr.ac_results || []) {
      if (acr.result === "pass") {
        const r = setCheckbox(body, acr.ac, true);
        body = r.body;
        if (r.hit) summary.acs_ticked++;
      }
    }
    if (tr.status === "done") {
      body = setFrontmatter(body, "status", "done");
      body = setFrontmatter(body, "completed_at", today());
    } else if (tr.status === "partial" || tr.status === "failed") {
      body = setFrontmatter(body, "status", "in-progress");
    }
    // Execution Log (append; the checkbox list must never disagree with it).
    const logLines = (tr.ac_results || []).map((a) => `- ${a.ac}: ${a.result}${a.evidence ? ` (${a.evidence})` : ""}`).join("\n");
    body += `\n\n## Execution Log — ${today()} (${result.order_id})\n- executor: ${result.worker || "task-executor"} via ingest-result\n- status: ${tr.status}\n${logLines}${tr.notes ? `\n- notes: ${tr.notes}` : ""}\n`;
    writeFileSync(path, body);
    summary.tasks_updated.push(tr.task_id);
    if (tr.status === "done" && existsSync(boardIndex)) {
      writeFileSync(boardIndex, updateBoardRow(readFileSync(boardIndex, "utf8"), tr.task_id, true));
    }
  }

  // 2. Unblock propagation (old P3.4): any blocked task whose dependencies are all done → ready.
  const tasksDir = join(local, "tasks");
  if (existsSync(tasksDir)) {
    const files = readdirSync(tasksDir).filter((f) => /^TASK-[\w.-]+\.md$/i.test(f));
    const statusOf = {};
    const parsed = files.map((f) => {
      const body = readFileSync(join(tasksDir, f), "utf8");
      const id = (body.match(/^id:\s*(TASK-[\w.-]+)/im) || [])[1] || f.replace(/\.md$/, "");
      const status = (body.match(/^status:\s*(\S+)/im) || [])[1] || "unknown";
      const deps = (body.match(/^depends_on:\s*\[([^\]]*)\]/im) || [, ""])[1]
        .split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      statusOf[id] = status;
      return { f, id, status, deps, body };
    });
    for (const t of parsed) {
      if (t.status === "blocked" && t.deps.length && t.deps.every((d) => statusOf[d] === "done")) {
        writeFileSync(join(tasksDir, t.f), setFrontmatter(t.body, "status", "ready"));
        summary.unblocked.push(t.id);
        if (existsSync(boardIndex)) {
          const idx = readFileSync(boardIndex, "utf8").split(/\r?\n/).map((line) =>
            line.includes(t.id) && line.includes("|")
              ? line.replace(/🚫|⏳/g, "⬜").replace(/\bblocked\b/gi, "ready")
              : line).join("\n");
          writeFileSync(boardIndex, idx);
        }
      }
    }
  }

  // 3. Discoveries → the ledger (old P3.7 / QA H.3). Single writer: this script.
  if (result.discoveries?.length) {
    const ledgerDir = join(local, "discovery");
    mkdirSync(ledgerDir, { recursive: true });
    const ledger = join(ledgerDir, "ledger.md");
    if (!existsSync(ledger)) writeFileSync(ledger, `---\nfeature: ${slug}\n---\n# Discovery Ledger — ${slug}\n`);
    const lines = result.discoveries.map((d) => {
      const tags = [d.lens ? `[lens:${d.lens}]` : "", d.severity_hint ? `severity-hint: ${d.severity_hint}` : "", d.test_gap ? `test-gap: ${d.test_gap}` : "", d.contradicts ? `contradicts: ${d.contradicts}` : "", d.traces_to?.length ? `traces_to: ${d.traces_to.join(", ")}` : ""].filter(Boolean);
      return `${d.marker} ${d.lens ? tags[0] + " " : ""}${d.line}${d.repro ? `\n    repro: ${d.repro}` : ""}${tags.slice(d.lens ? 1 : 0).map((t) => `\n    ${t}`).join("")}`;
    }).join("\n");
    appendFileSync(ledger, `\n## Discovered — ${result.order_id} (${today()})\n${lines}\n`);
    summary.discoveries_appended = result.discoveries.length;
  }

  // 4. Verdict bookkeeping (old evaluator B.0/B.2/B.2b) — judge returns data, ingest writes.
  if (result.verdict) {
    const evalDir = join(local, "evaluation");
    mkdirSync(evalDir, { recursive: true });
    if (result.verdict.criteria?.length) {
      const target = result.order_id.split("/")[1] || "run";
      const ledger = join(evalDir, `.verdicts-${target}.jsonl`);
      let run = 1;
      if (existsSync(ledger)) {
        const prior = readFileSync(ledger, "utf8").trim().split(/\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        run = prior.reduce((mx, r) => Math.max(mx, r.run || 0), 0) + 1;
      }
      const lines = result.verdict.criteria.map((c) => JSON.stringify({
        run, dimension: c.dimension || "spec-conformance", criterion: c.criterion,
        verdict: c.verdict, confidence: c.confidence, reprobed: !!c.reprobed,
        evidence: c.evidence || "", at: new Date().toISOString(),
      })).join("\n");
      appendFileSync(ledger, lines + "\n");
      summary.verdict_lines = result.verdict.criteria.length;
    }
    for (const ref of result.verdict.refuted || []) {
      const path = findTaskFile(cwd, slug, ref.task_id);
      if (!path) continue;
      let body = readFileSync(path, "utf8");
      const r = setCheckbox(body, ref.ac, false);
      if (r.hit) summary.refuted_unticked++;
      body = setFrontmatter(r.body, "eval_verdict", "fail");
      body = setFrontmatter(body, "eval_at", today());
      writeFileSync(path, body);
    }
  }



  return summary;
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs reduce ingest (<result.json> | --order <order.json>) [--cwd <dir>] [--no-receipt-check]",
  _: { arity: 0, max: 1, name: "result.json" },
  order: { type: "path" },
  cwd: { type: "path" },
  // The documented way through. The receipt channel is best-effort by design — a hook that could
  // fail a tool call would get the layer disabled — so a gate built on it needs an escape for the
  // environmental case, and one that appears in the run's own output rather than in folklore.
  "no-receipt-check": { type: "flag" },
};

/**
 * The result a given order is answered by.
 *
 * THE PAIRING IS A FACT OF THE ENVELOPE PORT, not a claim: `compile` writes `orders/<suffix>.json`
 * and every worker writes `results/<suffix>.json`. Deriving it here is what stops a dispatch from
 * being aimed by a worker's own report of where it put the work — measured once, when a worker that
 * had done its whole job reported a DIRECTORY as its result path, ingest read it, got EISDIR, and
 * the phase was thrown away. The caller naming the ORDER cannot make that mistake, because the
 * order is the thing it already holds.
 *
 * @param {string} orderPath - Path to the order this result answers.
 * @returns {string} The result path implied by that order.
 */
export function resultFor(orderPath) {
  const abs = resolve(orderPath);
  const dir = dirname(abs);
  if (basename(dir) !== "orders") {
    console.error(`  ✗ --order must name a file inside an orders/ directory (got ${abs})`);
    process.exit(2);
  }
  return join(dirname(dir), "results", basename(abs));
}

/**
 * The order a given result answers — the inverse of {@link resultFor}.
 *
 * Used only when a result was passed positionally, so an ingest aimed the documented old way is
 * still held to the same attestation as one aimed by `--order`.
 *
 * @param {string} resultPath - Path to the result.
 * @returns {string|null} The mirrored order path, or null when the result does not live in a
 *   `results/` directory (a fixture tree, typically — which is exactly when there is nothing to
 *   attest).
 */
export function orderFor(resultPath) {
  const abs = resolve(resultPath);
  const dir = dirname(abs);
  if (basename(dir) !== "results") return null;
  return join(dirname(dir), "orders", basename(abs));
}

/**
 * Did the SHIPPED skill actually run for this order?
 *
 * WHY AN INGEST ASKS THIS AT ALL. A dispatch that fails — plugin absent, disabled, or the wrong
 * version — returns `<tool_use_error>Unknown skill</tool_use_error>`, and the sub-agent then does
 * the craft itself from the prose in its own prompt. The artifacts land in exactly the right place,
 * so the order gate and the sandbox guard both pass, the phase post-condition passes, and the run
 * advances having applied none of the shipped craft. The receipt (`hooks/dispatch-receipt.mjs`) is
 * the only fact that separates the two, and this is the only place that fact is load-bearing.
 *
 * ALL THREE CONDITIONS, NOT MERELY EXISTENCE. A receipt that only has to EXIST is satisfied by a
 * stale one from an earlier relaunch — order paths like `orders/orient.json` are stable across
 * relaunches and the re-dispatch path reuses them verbatim — and a receipt from the wrong skill is
 * satisfied by any dispatch at all. So: same `order_id`, `skill_invoked` equal to the worker the
 * order DECLARES, and not older than the order it claims to answer.
 *
 * `compiled_at` is optional in the schema, so the staleness bound is applied only when the order
 * carries one; an order without it is checked on the first two conditions rather than waved through
 * on a timestamp nobody wrote.
 *
 * @param {object} order - The parsed WorkOrder.
 * @param {string} cwd - Project root.
 * @returns {{ok:boolean, reason?:string, receipt?:object, rows:number}} `ok` with the matching
 *   receipt, or the reason no row qualified plus how many rows were considered.
 */
export function attestation(order, cwd) {
  const slug = String(order.order_id).split("/")[0];
  const path = dispatchReceipts(cwd, slug);
  let rows = [];
  try {
    rows = readFileSync(path, "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return { ok: false, reason: `no dispatch receipts at ${path}`, rows: 0 }; }

  const mine = rows.filter((r) => r.order_id === order.order_id);
  if (!mine.length) return { ok: false, reason: `no receipt for ${order.order_id}`, rows: rows.length };

  const rightSkill = mine.filter((r) => r.skill_invoked === order.worker);
  if (!rightSkill.length) {
    const saw = [...new Set(mine.map((r) => r.skill_invoked))].join(", ");
    return { ok: false, rows: mine.length,
      reason: `${order.order_id} declares worker "${order.worker}" but every receipt names [${saw}] — the dispatch ran a different skill` };
  }
  const floor = order.compiled_at ? Date.parse(order.compiled_at) : null;
  const fresh = floor === null || Number.isNaN(floor)
    ? rightSkill
    : rightSkill.filter((r) => Date.parse(r.at) >= floor);
  if (!fresh.length) {
    return { ok: false, rows: rightSkill.length,
      reason: `every receipt for ${order.order_id} predates the order (compiled ${order.compiled_at}) — a stale attestation from an earlier dispatch` };
  }
  return { ok: true, receipt: fresh[fresh.length - 1], rows: fresh.length };
}

/**
 * Apply one WorkResult to shared state — the single writer for the board and the ledgers.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const file = args.order ? resultFor(args.order) : args._[0];
  if (!file) {
    console.error("  ✗ nothing to ingest: pass a result path, or --order <order.json> to derive it");
    process.exit(2);
  }
  const cwd = resolve(args.cwd || process.cwd());

  let result;
  try { result = JSON.parse(readFileSync(resolve(file), "utf8")); }
  catch (e) { console.error(`  ✗ result unreadable: ${e.message}`); process.exit(1); }

  const { valid, errors } = validate(result, RESULT_SCHEMA);
  if (!valid) {
    console.error("ingest-result: result rejected — a malformed result never mutates the board:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  // --- attestation gate -----------------------------------------------------------------------
  // SCOPED TO ORCHESTRATED ORDERS, deliberately. A result with no order beside it is a standalone
  // or fixture ingest — there was no dispatch to attest, so demanding a receipt would refuse work
  // that never made the claim. What it must NOT do is let the orchestrated case opt out by omitting
  // `--order`, which is why a positionally-named result is mirrored back to its order first.
  const orderPath = args.order ? resolve(args.order) : orderFor(file);
  let order = null;
  if (orderPath) { try { order = JSON.parse(readFileSync(orderPath, "utf8")); } catch { order = null; } }

  // --- identity gate --------------------------------------------------------------------------
  // A RESULT MUST CLAIM THE ORDER IT IS ANSWERING. `order_id` is the only join in the record set:
  // a WorkResult deliberately carries no `run_id` and reaches it through this field, so a result
  // that echoes the wrong id is not mislabelled, it is DETACHED — from its run, its round, and the
  // order whose receipt attests it.
  //
  // Measured on a two-round run: round 1's evaluate order was `todo-cli/evaluate-r1` and its result
  // came back claiming `todo-cli/evaluate`, an order that has never existed. Everything downstream
  // still looked right, because the FILE is named after the order — only the run graph disagreed,
  // and only because it keys nodes off the envelope rather than the filename. Round 2's ids matched,
  // so a single-round run cannot show this at all.
  //
  // The ORDER is authoritative: it is the compiled artifact, and the result is a reply to it. But
  // this refuses rather than rewriting, because silently normalising a worker's output is how the
  // drift becomes permanent and invisible — the same reason ingest refuses a malformed envelope
  // instead of repairing one.
  if (order && String(result.order_id) !== String(order.order_id)) {
    console.error(`ingest-result: result refused — it answers order "${order.order_id}" but claims`);
    console.error(`  order_id "${result.order_id}". A result reaches its run through this field and`);
    console.error(`  nothing else, so an id that names a different order (or none) detaches the record`);
    console.error(`  from the run that produced it. Correct the result's order_id to match its order.`);
    process.exit(1);
  }

  if (order?.mode === "orchestrated" && !args.noReceiptCheck) {
    const att = attestation(order, cwd);
    if (!att.ok) {
      console.error(`ingest-result: result refused — ${att.reason}.`);
      console.error(`  The order declares mode "orchestrated", so the dispatch must have left a receipt`);
      console.error(`  (${dispatchReceipts(cwd, String(order.order_id).split("/")[0])}). No receipt means the Skill`);
      console.error(`  dispatch never ran: the plugin may be absent, disabled, or a different version, and the`);
      console.error(`  artifacts on disk were produced by something other than the shipped skill.`);
      console.error(`  Re-dispatch the worker, or pass --no-receipt-check if the receipt failed for an`);
      console.error(`  environmental reason and you are accepting the result without that attestation.`);
      process.exit(1);
    }
    console.log(`  ✓ attested: ${att.receipt.order_id} ran ${att.receipt.skill_invoked} at ${att.receipt.at}`);
  }

  const s = applyResult(result, { cwd });
  console.log(`✅ ingested ${result.order_id} — tasks: [${s.tasks_updated.join(", ")}] · ACs ticked: ${s.acs_ticked} · unblocked: [${s.unblocked.join(", ")}] · discoveries: ${s.discoveries_appended} · verdict lines: ${s.verdict_lines} · refuted un-ticked: ${s.refuted_unticked}`);
}
