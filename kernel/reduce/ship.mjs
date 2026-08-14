#!/usr/bin/env node
// SHIP REPORT — freeze one reviewable markdown report at GATE L4 (ADR-0001).
//
// WHY THIS EXISTS.
//
// Everything a reviewer wants from a run is in the LOCAL tier and therefore gitignored: the
// verdict and its refuted criteria, the QA findings, the T0 artifacts, the adjudicated decisions,
// the cut list. A pull request showed the spec and the code and NONE of the evidence that the one
// matched the other. The obvious fix — commit those artifacts — is the wrong one: they mutate
// throughout a run, so the deliverable tier would churn on every attempt and every round.
//
// So the split is by TIME rather than by artifact. They stay local while they change; their
// conclusions are frozen ONCE, when the run ends, into `shapeup/<slug>/REPORT.md`.
//
// EVERY NUMBER HERE IS DERIVED, NEVER PASSED IN. The report reduces over files the harness already
// wrote — the trial ledger, the verdict artifacts, the board, the discovery ledger, the round
// ledger. Nothing in it is a claim the orchestrator makes about its own run, which is the whole
// discipline this harness exists to enforce; a ship report that accepted a summary as input would
// be the "agent reports done" pathology wearing a deliverable's clothes.
//
// Zero dependencies, zero network.
//
// Usage:
//   node ship-report.mjs --slug <slug> [--cwd <dir>] [--verdict PASS|FAIL|not-evaluated]
//                        [--qa run|skipped] [--stdout]
//
// Exit: 0 written (path on stdout), 2 usage error.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import {
  report as reportPath, tasksDir, verdictsDir, trials, evaluationDir, qaDir,
  roundLedger, discoveryLedger, receipt as receiptPath, harnessRun, relShared,
} from "../lib/paths.mjs";
import { readTrials } from "../verify/t0.mjs";
import { ratchetReport } from "../probe/stats.mjs";

/** @returns {string} Today as `YYYY-MM-DD` (UTC). */
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Read a file, tolerating absence — every section of this report is optional, because a run can
 * legitimately end at GATE H with no QA pass or no evaluation.
 * @param {string} p - Path.
 * @returns {(string|null)} Contents, or null.
 */
function readIf(p) {
  try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
}

/**
 * Parse a Markdown frontmatter block into a flat scalar map.
 * @param {string} text - Document text.
 * @returns {Object<string,string>} Top-level `key: value` pairs.
 */
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || "");
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return fm;
}

/**
 * Board census, from task frontmatter — the same two-source discipline `gate-l2` uses, reduced to
 * the authoritative one.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{total:number, done:number, unfinished:string[]}} Counts and the ids still open.
 */
export function boardCensus(cwd, slug) {
  const dir = tasksDir(cwd, slug);
  const out = { total: 0, done: 0, unfinished: [] };
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/^TASK-[\w.-]+\.md$/i.test(f)) continue;
    const body = readIf(join(dir, f)) || "";
    const fm = frontmatter(body);
    const id = fm.id || f.replace(/\.md$/, "");
    out.total++;
    if (fm.status === "done") out.done++;
    else out.unfinished.push(id);
  }
  out.unfinished.sort();
  return out;
}

/**
 * Per-scope T0 outcome, reduced from the trial ledger.
 *
 * The LAST trial per scope whose tree survived (`kept`/`rebased`) is the one describing the code
 * that actually shipped — a `reverted` trial's tree was thrown away, so reporting its score would
 * describe work nobody can see.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {Array<{scope_id:string, score:object, status:string, delta:string, trials:number}>}
 *   One row per scope, ordered by scope id.
 */
export function t0Summary(cwd, slug) {
  const rows = readTrials(trials(cwd, slug));
  const byScope = new Map();
  for (const t of rows) {
    if (!t.scope_id) continue;
    const e = byScope.get(t.scope_id) || { scope_id: t.scope_id, trials: 0, last: null };
    e.trials++;
    if (t.status === "kept" || t.status === "rebased") e.last = t;
    byScope.set(t.scope_id, e);
  }
  return [...byScope.values()]
    .map((e) => ({
      scope_id: e.scope_id,
      trials: e.trials,
      score: e.last?.score ?? null,
      status: e.last?.status ?? "no surviving trial",
      delta: e.last?.delta ?? "",
    }))
    .sort((a, b) => a.scope_id.localeCompare(b.scope_id));
}

/**
 * Count the immutable verdict artifacts on disk — the evidence the evaluator had to cite.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {number} How many artifacts exist.
 */
export function verdictArtifactCount(cwd, slug) {
  const dir = verdictsDir(cwd, slug);
  if (!existsSync(dir)) return 0;
  try { return readdirSync(dir).filter((f) => f.endsWith(".json")).length; } catch { return 0; }
}

/**
 * Lift a named section out of a markdown document.
 * @param {(string|null)} md - Document text.
 * @param {RegExp} heading - Matches the heading line that opens the section.
 * @returns {(string|null)} The section body, trimmed, or null when absent/empty.
 */
export function section(md, heading) {
  if (!md) return null;
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return null;
  const level = (lines[start].match(/^#+/) || ["#"])[0].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) break;
    out.push(lines[i]);
  }
  const body = out.join("\n").trim();
  return body || null;
}

/**
 * Assemble the report. Pure given its inputs, so the structural tests can assert its shape
 * without a filesystem.
 * @param {object} facts - Derived facts (slug, verdict, board, t0, decisions, findings, …).
 * @returns {string} The markdown document.
 */
export function buildReport(facts) {
  const {
    slug, at, verdict, qa, rounds, board, t0, artifacts, ratchet,
    evalCriteria, evalBugs, qaFindings, decisions, discovered, intakeSha,
  } = facts;

  const L = [];
  L.push("---", "type: ship-report", `feature: ${slug}`, `date: ${at}`,
    `verdict: ${verdict}`, `rounds_used: ${rounds ?? "~"}`, `qa: ${qa}`,
    `intake_sha256: ${intakeSha ?? "~"}`, "---", "");
  L.push(`# ${slug} — ship report`, "");
  L.push("Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial",
    "ledger, the verdict artifacts, the board — never from a summary of the run.", "");

  L.push("## Outcome", "");
  L.push("| | |", "|---|---|");
  L.push(`| Verdict | **${verdict}** |`);
  L.push(`| Rounds used | ${rounds ?? "—"} |`);
  L.push(`| Board | ${board.done}/${board.total} tasks done |`);
  L.push(`| T0 artifacts | ${artifacts} |`);
  L.push(`| QA | ${qa} |`);
  L.push("");

  if (board.unfinished.length) {
    L.push(`> **${board.unfinished.length} task(s) did not finish:** ${board.unfinished.join(", ")}.`,
      "> The verdict above grades what was built, not what was planned.", "");
  }

  if (t0.length) {
    L.push("## Verification (T0)", "");
    L.push("The surviving trial per scope — the one describing code that is actually on the branch.", "");
    L.push("| scope | fixtures | regressions | trials | last status | delta |", "|---|---|---|---|---|---|");
    for (const s of t0) {
      const f = s.score ? `${s.score.fixtures_passed}/${s.score.fixtures_total}` : "—";
      const r = s.score ? String(s.score.regressions) : "—";
      L.push(`| ${s.scope_id} | ${f} | ${r} | ${s.trials} | ${s.status} | ${s.delta || "—"} |`);
    }
    L.push("");
  }

  // The ratchet aggregate is derived, ~10 scalars that do not grow with the run, which is why it
  // can live in the committed tier while `metrics/` correctly stays gitignored (ADR-0001: a
  // committed shard keyed on $HOSTNAME only grows). Without this the instrument existed and was
  // never read — the trial ledger it reduces is harvested at SHIP or lost with the local tier.
  if (ratchet && ratchet.trials > 0) {
    L.push("## Ratchet", "");
    L.push("Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or",
      "sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.", "");
    L.push("| | |", "|---|---|");
    L.push(`| Trials | ${ratchet.trials} across ${ratchet.scopes} scope(s), ${ratchet.scopes_multi_trial} with more than one attempt |`);
    L.push(`| Improvement rate | ${ratchet.improvement_rate} — kept ÷ trials after the first |`);
    L.push(`| Monotone rate | ${ratchet.monotone_rate} — multi-trial scopes whose score never decreased |`);
    L.push(`| Sawtooth count | ${ratchet.sawtooth_count} — a revert immediately after a keep |`);
    L.push(`| Mean trials to green | ${ratchet.mean_trials_to_green ?? "— (no scope reached green)"} |`);
    const hist = Object.entries(ratchet.status_histogram).map(([k, v]) => `${k} ${v}`).join(", ");
    L.push(`| Statuses | ${hist || "—"} |`);
    L.push("");
    // A zero improvement_rate means one of two opposite things, and the number alone cannot say
    // which: the loop tried again and failed to improve, or nothing ever needed a second attempt.
    // Measured on the first two real runs — every scope went green on attempt 1 — so the reading a
    // reviewer meets by default is the degenerate one. `stats --ratchet` says so on the terminal;
    // the committed report has to say it too, or a 0 here is read as "the ratchet did not work".
    if (ratchet.scopes_multi_trial === 0) {
      L.push("> No scope needed a second attempt, so the rates above are vacuous rather than bad:",
        "> the ratchet was never asked to climb. The Day-1 question — does the loop measurably",
        "> improve across attempts — needs a run where at least one scope retries.", "");
    }
  }

  if (evalCriteria) L.push("## Evaluation", "", evalCriteria, "");
  if (evalBugs) L.push("### Refuted criteria and bugs", "", evalBugs, "");
  if (qaFindings) L.push("## QA findings", "", qaFindings, "");
  if (decisions) L.push("## Decisions adjudicated during the run", "", decisions, "");
  if (discovered) L.push("## Discovered, not built", "", discovered, "");

  L.push("---", "",
    "*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the",
    "gitignored local tier (ADR-0001). This report",
    "is the frozen conclusion of it.*", "");
  return L.join("\n");
}

/**
 * Gather every fact from disk and render the report.
 * @param {{cwd:string, slug:string, verdict?:string, qa?:string}} opts - Inputs.
 * @returns {{markdown:string, path:string, facts:object}} The document, its destination, the facts.
 */
export function generate({ cwd, slug, verdict, qa }) {
  const run = frontmatter(readIf(harnessRun(cwd, slug)) || "");
  const receipt = (() => { try { return JSON.parse(readIf(receiptPath(cwd, slug)) || "{}"); } catch { return {}; } })();

  const evalReport = readIf(join(evaluationDir(cwd, slug), `EVAL-FEATURE-${slug}.md`));
  const huntReport = readIf(join(qaDir(cwd, slug), "hunt-report.md"));
  const ledger = readIf(roundLedger(cwd, slug));
  const discovery = readIf(discoveryLedger(cwd, slug));

  const facts = {
    slug,
    at: today(),
    verdict: verdict || run.final_verdict || "not-evaluated",
    qa: qa || (huntReport ? "run" : "skipped"),
    rounds: run.rounds_used,
    intakeSha: receipt.intake_sha256,
    board: boardCensus(cwd, slug),
    t0: t0Summary(cwd, slug),
    ratchet: ratchetReport(readTrials(trials(cwd, slug))),
    artifacts: verdictArtifactCount(cwd, slug),
    evalCriteria: section(evalReport, /^#+\s.*criteria/i) || section(evalReport, /^#+\s*spec-conformance/i),
    evalBugs: section(evalReport, /^#+\s*Bugs?\b/i),
    qaFindings: section(huntReport, /^#+\s*Findings?\b/i),
    decisions: section(ledger, /^#+\s*Decisions?\b/i),
    discovered: section(discovery, /^#+\s*Discovered\b/i),
  };
  return { markdown: buildReport(facts), path: reportPath(cwd, slug), facts };
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs reduce ship --slug <slug> [--cwd <dir>] [--verdict PASS|FAIL|not-evaluated] " +
         "[--qa run|skipped] [--stdout]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
  verdict: { type: "str" },
  qa: { type: "str" },
  stdout: { type: "flag" },
};

/**
 * Generate the ship report from the artifacts on disk.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();
  const { markdown, path } = generate({ cwd, slug: args.slug, verdict: args.verdict, qa: args.qa });
  if (args.stdout) {
    process.stdout.write(markdown);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown, "utf8");
    console.log(relShared(args.slug, "REPORT.md"));
  }
}
