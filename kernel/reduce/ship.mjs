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
//   node `harness reduce ship` --slug <slug> [--cwd <dir>] [--verdict PASS|FAIL|not-evaluated]
//                        [--qa run|skipped] [--stdout]
//
// Exit: 0 written (path on stdout), 2 usage error.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import {
  report as reportPath, tasksDir, verdictsDir, trials, evaluationDir, qaDir,
  roundLedger, discoveryLedger, receipt as receiptPath, harnessRun, relShared,
  activeOrder, runArgsPath, readReceipt, runIdFromReceipt,
} from "../lib/paths.mjs";
import { readTrials } from "../verify/t0.mjs";
import { ratchetReport } from "../probe/stats.mjs";
import { projectRequirements, summaryLine } from "../probe/requirements.mjs";
import { deriveRounds } from "../probe/rounds.mjs";
import { collectDiff, scanDiff, summarize } from "./leftovers.mjs";

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
 * Board census, from task frontmatter — the same two-source discipline the GATE L2 block uses, reduced to
 * the authoritative one.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{total:number, done:number, unfinished:string[]}} Counts and the ids still open.
 */
export function boardCensus(cwd, slug) {
  const dir = tasksDir(cwd, slug);
  const out = { total: 0, done: 0, unfinished: [], anchors: {} };
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/^TASK-[\w.-]+\.md$/i.test(f)) continue;
    const body = readIf(join(dir, f)) || "";
    const fm = frontmatter(body);
    const id = fm.id || f.replace(/\.md$/, "");
    out.total++;
    // The COMMITTED anchor for this board id. `use_case_refs` is the tier-direction rule's own
    // sanctioned direction (LOCAL names SHARED), and it is what the frozen report cites instead of
    // the id — boards renumber per machine, use cases do not.
    const ucs = String(fm.use_case_refs ?? "").replace(/^\[|\]$/g, "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    out.anchors[id] = ucs;
    if (fm.status === "done") out.done++;
    else out.unfinished.push(id);
  }
  out.unfinished.sort();
  return out;
}

/**
 * Replace every board id in free prose with its committed anchor.
 *
 * THE WRITE BOUNDARY, not the column, and that is the whole point. Board ids reached the frozen
 * report three different ways — the unfinished-task callout, the covering-AC column's own prefix,
 * and INSIDE acceptance-criterion prose a planner wrote ("given the seeded todos (TASK-006)"). The
 * third is upstream free text, so a fix that only changes what the columns interpolate still
 * commits a file the next run's spec-lint reds. Everything written into the committed report passes
 * through here.
 *
 * An id with no resolvable use case becomes a neutral phrase rather than the id: the report loses a
 * pointer that never resolved off this machine anyway, and keeps the sentence around it.
 *
 * @param {*} text - Any value destined for the committed report.
 * @param {Record<string, string[]>} anchors - Board id → its `use_case_refs`.
 * @returns {string} The text with every `TASK-…` replaced by a stable anchor.
 */
export function deboard(text, anchors = {}) {
  return String(text ?? "").replace(/\bTASK-[A-Za-z0-9][\w.-]*/g, (id) => {
    const ucs = anchors[id];
    if (ucs && ucs.length) return ucs.join("/");
    return "a board task";
  });
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
    slug, at, verdict, qa, rounds, roundsJudged, board, t0, artifacts, ratchet,
    evalCriteria, evalBugs, qaFindings, decisions, discovered, intakeSha, leftovers, requirements,
  } = facts;

  const L = [];
  L.push("---", "type: ship-report", `feature: ${slug}`, `date: ${at}`,
    `verdict: ${verdict}`, `rounds_used: ${rounds ?? "~"}`, `rounds_judged: ${roundsJudged ?? "~"}`, `qa: ${qa}`,
    `intake_sha256: ${intakeSha ?? "~"}`, "---", "");
  L.push(`# ${slug} — ship report`, "");
  L.push("Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial",
    "ledger, the verdict artifacts, the board — never from a summary of the run.", "");

  L.push("## Outcome", "");
  L.push("| | |", "|---|---|");
  L.push(`| Verdict | **${verdict}** |`);
  L.push(`| Rounds used | ${rounds ?? "—"} |`);
  // A round built and a round judged are different facts — a round can die before EVAL ever sees
  // it, so this row is its own line rather than folded into "Rounds used" above. Omitted when EVAL
  // never ran at all, the same way the sections below it are.
  if (roundsJudged != null) L.push(`| Rounds judged | ${roundsJudged} |`);
  L.push(`| Board | ${board.done}/${board.total} tasks done |`);
  L.push(`| T0 artifacts | ${artifacts} |`);
  L.push(`| QA | ${qa} |`);
  L.push("");

  if (board.unfinished.length) {
    // Anchored, never enumerated by board id: the ids renumber per machine, and a committed file
    // carrying one reds the NEXT run of this pitch at L1b.
    const unfinishedAnchors = [...new Set(board.unfinished.flatMap((id) => board.anchors?.[id] ?? []))];
    L.push(`> **${board.unfinished.length} task(s) did not finish**${unfinishedAnchors.length ? ` — use cases: ${unfinishedAnchors.join(", ")}` : ""}.`,
      "> The verdict above grades what was built, not what was planned.", "");
  }

  // Leftovers — advisory, and a SECTION rather than a verdict. It was a Stop hook that printed once
  // into a transcript; here it lands in the artifact a human reads at GATE L4 and a teammate finds
  // on `git pull`, which is the difference between a note and a record.
  if (leftovers?.length) {
    L.push("## Leftovers (advisory)", "");
    L.push("Markers in lines this run ADDED. Not a gate and not part of the verdict — a cleanup list.", "");
    for (const line of leftovers) L.push(`- ${line}`);
    L.push("");
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

  // The requirement matrix — the way back from a verdict to the clause the pitch asked for, frozen
  // at the one moment the run's local evidence still exists. Omitted entirely when the run has no
  // registry: a table of nothing reads as "no requirements", which is a different claim from "this
  // run predates the registry". Derived like every other figure here, by the same probe the L4 line
  // and GATE H's census read, so the three cannot disagree.
  if (requirements?.registry && requirements.rows.length) {
    L.push("## Requirements", "");
    L.push("One row per registered clause. A requirement has evidence when an acceptance criterion",
      "covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the",
      "path back. This is a projection, never a verdict: it never blocked this ship.", "");
    L.push(`**${summaryLine(requirements)}** · run \`${requirements.run_id ?? "unknown"}\``, "");
    // A clause, an AC and a criterion are all free prose, and a literal pipe in any of them breaks
    // the row into columns nobody wrote — a frozen report that misrenders its own evidence.
    /**
     * Escape a free-prose value for a Markdown table cell.
     * @param {string} s - The value.
     * @returns {string} The value with every literal pipe escaped.
     */
    const cell = (s) => String(s).replace(/\|/g, "\\|");
    L.push("| REQ | source | evidence | covering AC | criterion | T0 |", "|---|---|---|---|---|---|");
    for (const r of requirements.rows) {
      const ac = r.covering_acs.length
        ? `${deboard(r.covering_acs[0].task_id, facts.board?.anchors)}: ${deboard(r.covering_acs[0].ac, facts.board?.anchors)}${r.covering_acs.length > 1 ? ` (+${r.covering_acs.length - 1})` : ""}`
        : "—";
      const crit = r.criteria.length ? `${r.criteria[0].criterion}${r.criteria.length > 1 ? ` (+${r.criteria.length - 1})` : ""} → ${r.criteria.map((c) => c.verdict).join(",")}` : "—";
      const t0h = r.t0.length ? r.t0.map((h) => String(h).slice(0, 12)).join(", ") : "—";
      L.push(`| ${r.id} | ${cell(r.source || "—")} | ${r.evidence} | ${cell(ac)} | ${cell(crit)} | ${t0h} |`);
    }
    L.push("");
    if (requirements.inconsistencies.length) {
      L.push("Anchored to a requirement no acceptance criterion covers — reconcile, do not count as evidence:", "");
      for (const i of requirements.inconsistencies) L.push(`- ${i.requirement} ← "${i.criterion}" (${i.verdict})`);
      L.push("");
    }
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
  // THE WHOLE REPORT, ONCE. Board ids were anchored in three places and leaked through a fourth: a
  // discovery-ledger entry copied verbatim into "Discovered, not built" carried `[TASK-005]`, this
  // kernel wrote it straight to the committed tier past the hook that guards the model's edits, and
  // the next run's L1b lint red'd the file the previous run had frozen. A committed report may not
  // name a board id anywhere, so the rule is applied to the finished text rather than section by
  // section.
  return deboard(L.join("\n"), board.anchors);
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

  // Two numbers, not one: `rounds` (built — an order, a T0 verdict, a build-gate artifact or an
  // EVAL result) and `roundsJudged` (EVAL actually returned a verdict for), kept separate so a run
  // whose later rounds never reached EVAL still reports the rounds it built.
  const derivedRounds = deriveRounds(cwd, slug, run.rounds_used);

  const facts = {
    slug,
    at: today(),
    verdict: verdict || run.final_verdict || "not-evaluated",
    qa: qa || (huntReport ? "run" : "skipped"),
    rounds: derivedRounds.rounds_used,
    roundsJudged: derivedRounds.rounds_judged,
    intakeSha: receipt.intake_sha256,
    board: boardCensus(cwd, slug),
    t0: t0Summary(cwd, slug),
    ratchet: ratchetReport(readTrials(trials(cwd, slug))),
    requirements: projectRequirements({ cwd, slug }),
    artifacts: verdictArtifactCount(cwd, slug),
    evalCriteria: section(evalReport, /^#+\s.*criteria/i) || section(evalReport, /^#+\s*spec-conformance/i),
    evalBugs: section(evalReport, /^#+\s*Bugs?\b/i),
    qaFindings: section(huntReport, /^#+\s*Findings?\b/i),
    decisions: section(ledger, /^#+\s*Decisions?\b/i),
    discovered: section(discovery, /^#+\s*Discovered\b/i),
    leftovers: (() => {
      // Advisory, and derived like everything else here: the run's own diff, added lines only.
      const diff = collectDiff(cwd, slug);
      return diff ? summarize(scanDiff(diff)) : [];
    })(),
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
/**
 * Did THIS run skip evaluation? Read from the run's own recorded arguments, and believed only when
 * the record can be shown to belong to this run.
 *
 * WHY THE KERNEL ASKS AT ALL. A run launched with `--no-eval` verified nothing, and the protocol
 * has always said such a run ships as `not-evaluated`, "recorded plainly — never silently
 * upgraded". That promise lived entirely inside the orchestrator's control flow, where one
 * assignment downstream of the branch restores the old behaviour with every check still green —
 * measured, not supposed. The gate block tells the human the truth either way; the committed report
 * a teammate inherits on `git pull` is the artifact that was lying, so the refusal belongs at the
 * writer of that artifact, where a future orchestrator edit cannot reach it.
 *
 * POSITIVELY PROVEN OR NOT AT ALL. The record is written at launch, later than the receipt that
 * mints the run key, so a freshly opened run can still find the PREVIOUS run's record on disk. A
 * stale flag would refuse a ship that verified everything — a worse failure than the one this
 * closes. The flag therefore counts only when the record names the same run the receipt does;
 * a missing, unreadable or differently-keyed record proves nothing and permits.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {boolean} True only when this run's own record says evaluation was skipped.
 */
function evalWasSkipped(cwd, slug) {
  try {
    const record = JSON.parse(readFileSync(runArgsPath(cwd, slug), "utf8"));
    if (record?.noEval !== true) return false;
    const mine = runIdFromReceipt(readReceipt(receiptPath(cwd, slug)));
    return Boolean(mine) && record.runId === mine;
  } catch { return false; }
}

/** The verdict values that assert the feature was graded and passed. */
const PASSING = new Set(["PASS", "pass"]);

export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = args.cwd || process.cwd();
  if (PASSING.has(String(args.verdict ?? "")) && evalWasSkipped(cwd, args.slug)) {
    console.error(
      "✋ reduce ship: this run was launched with --no-eval, so nothing graded it — refusing to freeze a report " +
      `that says ${args.verdict}. Ship it as --verdict not-evaluated, which the report, the ledger and the ` +
      "sign-off block all carry.",
    );
    process.exit(3);
  }
  const { markdown, path } = generate({ cwd, slug: args.slug, verdict: args.verdict, qa: args.qa });
  if (args.stdout) {
    process.stdout.write(markdown);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown, "utf8");

    // THE RUN IS OVER, SO RETIRE ITS POINTER. `harness compile` publishes `.shapeup/active-order`
    // as it writes each order and nothing ever erased it, so the pointer outlived every run that
    // produced one. That is harmless to the guard now — liveness comes from the order set, and a
    // shipped run has no unanswered orders — but a pointer naming a finished run is a fact on disk
    // that is no longer true, and the next reader to trust it inherits the same class of bug.
    // Only on the writing path: `--stdout` is a preview of the report, not the end of the run.
    rmSync(activeOrder(cwd), { force: true });

    console.log(relShared(args.slug, "REPORT.md"));
  }
}
