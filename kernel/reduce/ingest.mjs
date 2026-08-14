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

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../verify/envelope.mjs";
import { runArgs } from "../lib/argv.mjs";
import { tasksDir, localRoot } from "../lib/paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT_SCHEMA = JSON.parse(readFileSync(resolve(HERE, "../../skills/tech-lead/schemas/work-result.schema.json"), "utf8"));

/**
 * @returns {string} Today's date as an ISO `YYYY-MM-DD` string (UTC), for log/frontmatter stamps.
 */
const today = () => new Date().toISOString().slice(0, 10);

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
  usage: "harness.mjs reduce ingest <result.json> [--cwd <dir>]",
  _: { arity: 1, max: 1, name: "result.json" },
  cwd: { type: "path" },
};

/**
 * Apply one WorkResult to shared state — the single writer for the board and the ledgers.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const file = args._[0];
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
  const s = applyResult(result, { cwd });
  console.log(`✅ ingested ${result.order_id} — tasks: [${s.tasks_updated.join(", ")}] · ACs ticked: ${s.acs_ticked} · unblocked: [${s.unblocked.join(", ")}] · discoveries: ${s.discoveries_appended} · verdict lines: ${s.verdict_lines} · refuted un-ticked: ${s.refuted_unticked}`);
}
