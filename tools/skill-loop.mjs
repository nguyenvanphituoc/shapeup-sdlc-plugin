#!/usr/bin/env node
// Day-1 reflective-loop harness — REPO-ONLY dev/CI asset.
//
// Implements §VI.A of *Graph Engineering — The Karpathy Loop, Improved 1000x by Itself*: "Take one
// existing LLM call whose output can be evaluated. Add: stored first draft, evaluator with explicit
// criteria, revision step, stopping rule. Store every artifact." The paper's own template is
//
//     def reflective_task(task, gen, eval, max_rounds=3):
//         versions = [gen(task)]
//         for _ in range(max_rounds):
//             review = eval(task, versions[-1])
//             if review["decision"] == "approve": return {...}
//             versions.append(gen(task, prior=versions[-1], instructions=review["changes"]))
//         return {..., "status": "iteration_limit"}
//
// and `runLoop()` below is that function with the artifacts written to disk instead of held in a
// list. Table II's exit criterion for the rung is **measured quality improvement**, so the run
// record ends in an arithmetic delta rather than a narrative.
//
// THREE MODES, and the distinction between the first two is the whole integrity story:
//
//   node tools/skill-loop.mjs                    INVENTORY (no auth, no spend). Which skills have a
//                                                Day-1 rubric, which do not. Refreshes the baseline's
//                                                coverage block so the gap is a number on the record.
//
//   node tools/skill-loop.mjs --selftest         SELFTEST (no auth, no spend). Scores each rubric
//                                                against its two HAND-AUTHORED reference drafts and
//                                                asserts the rubric SEPARATES them. This measures the
//                                                INSTRUMENT, never the skill. It is the same move the
//                                                oracle fixtures already make (structural §9–§11): a
//                                                grader that cannot fail a bad input is not a grader.
//
//   node tools/skill-loop.mjs --measure --skill X --model M
//                                                MEASURE (needs Claude auth; costs money). Runs the
//                                                real loop against a live model and writes a measured
//                                                record. Refuses to start without an explicit --model,
//                                                for the reason evals/README.md already gives: an
//                                                unlabeled rate is not a measurement of anything.
//
// The two traps this harness inherits from tools/trigger-eval.mjs, because they were paid for once:
//   * A broken harness must LOOK broken. If a measure run produces no parseable model output, it
//     aborts and writes nothing rather than scoring a zero. "0% quality" and "the CLI is missing"
//     are not the same finding and must never share a number.
//   * Selftest scores may never be reported as skill quality. Every version carries a `source`
//     ("reference-weak" | "reference-strong" | "model") and every record carries a `mode`, so a
//     synthetic score cannot be laundered into a measured one by being copied out of context.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, mkdtempSync, copyFileSync, cpSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = join(ROOT, "skills");
const BASELINE = join(ROOT, "evals", "baselines", "skill-loop.baseline.json");
const RUNS_DIR = join(ROOT, "evals", "runs");
// COMMITTED, unlike RUNS_DIR. evals/runs/ is gitignored run-trace; this report and the baseline it
// derives from are the only Day-1 evidence that survives a clone.
const REPORT = join(ROOT, "evals", "DAY1-REPORT.md");
const SCHEMA_VERSION = "1.0";

// ---- rubric loading ---------------------------------------------------------

/**
 * Load every Day-1 rubric on disk, one per skill directory that has one.
 * @param {string} [root=ROOT] - Repository root.
 * @returns {Array<{skill:string, file:string, dir:string, rubric:object}>} Rubrics, skill-sorted.
 */
export function loadRubrics(root = ROOT) {
  const skillsDir = join(root, "skills");
  const out = [];
  for (const name of readdirSync(skillsDir)) {
    const file = join(skillsDir, name, "evals", "day1-rubric.json");
    if (!existsSync(file)) continue;
    out.push({ skill: name, file, dir: dirname(file), rubric: JSON.parse(readFileSync(file, "utf8")) });
  }
  return out.sort((a, b) => a.skill.localeCompare(b.skill));
}

/**
 * List every skill directory, whether or not it carries a rubric.
 * @param {string} [root=ROOT] - Repository root.
 * @returns {string[]} Skill directory names, sorted.
 */
export function listSkills(root = ROOT) {
  return readdirSync(join(root, "skills"))
    .filter((n) => existsSync(join(root, "skills", n, "SKILL.md")))
    .sort();
}

// ---- the evaluator ----------------------------------------------------------

/**
 * Score one draft against one rubric — the "evaluator with explicit criteria" the rung requires.
 *
 * SCORING: `must` criteria earn credit; `must_not` criteria only ever subtract.
 *
 *     base    = satisfied `must` weight / total `must` weight
 *     penalty = violated `must_not` weight / total `must_not` weight
 *     score   = max(0, base - penalty)
 *
 * The asymmetry is deliberate and was forced by a failing test rather than chosen on taste. Scoring
 * both polarities as positive credit — the obvious first implementation — gave an EMPTY draft 0.417,
 * because saying nothing violates no prohibition. That is the paper's Table III warning ("average
 * success hides catastrophic cases") in miniature: a metric that rewards silence will happily report
 * a healthy score for a skill that has stopped answering. Structural §48(d) now asserts an empty
 * draft scores at or below the weak floor, so the regression cannot return.
 *
 * Weights exist for the same reason: returning PASS on a live defect must not cost the same as
 * omitting a table row, so it does not.
 *
 * This is the DETERMINISTIC head of the two-headed rubric. It is auditable, free, and runs in CI —
 * and it is deliberately literal, which is also its limit: an anchor-shaped detector
 * (`TS-04 … FAIL`, a `file:line`, an un-ticked `- [ ] AC4`) generalizes to real output because the
 * skill's own output format defines those anchors, while a phrase-shaped detector
 * (`no-green-suite-justification`) is brittle against paraphrase. Each criterion also carries an
 * `assertion` — the question a model judge would be asked — so the second head can be added over
 * the same rubric without restating the criteria. See docs/plan/day1-day2-measurement.md §5.
 *
 * @param {string} text - The draft to grade.
 * @param {object} rubric - A rubric object conforming to day1-rubric.schema.json.
 * @returns {{score:number, criteria:Array<object>, by_dimension:Object<string,number>}}
 *   `score` is in [0,1]; `criteria` is one result per rubric criterion, carrying the matched
 *   substring as evidence so a result is a finding rather than an assertion. `by_dimension` keeps
 *   the plain satisfied-weight fraction — it is diagnostic (which dimension is weak?), not the
 *   headline number, and is deliberately not penalty-adjusted.
 */
export function scoreDraft(text, rubric, ctx = {}) {
  const results = [];
  const dims = {};
  // Parsed once per draft: `json` detectors all read the same envelope.
  const envelope = rubric.grades === "work-result" ? extractJSON(text) : null;
  let mustGot = 0, mustTotal = 0, penaltyGot = 0, penaltyTotal = 0;
  for (const c of rubric.criteria) {
    const { detected, evidence: ev, fraction, rows } =
      c.detector.kind === "json" ? detectJSON(envelope, c.detector)
      : c.detector.kind === "oracle" ? detectOracle(c.detector, ctx)
      : detectRegex(text, c.detector);
    const m = ev;
    const satisfied = c.kind === "must" ? detected : !detected;
    const w = c.weight;
    // Partial credit applies to `must` ONLY. A part-violated prohibition is not part-satisfied —
    // "it only crashed on two of the five probes" earns nothing — so a must_not stays binary and
    // costs its whole weight the moment it fires. Enforced in the schema, asserted by structural §48.
    const credit = c.kind === "must" && fraction !== undefined ? fraction : satisfied ? 1 : 0;
    if (c.kind === "must") {
      mustTotal += w;
      mustGot += w * credit;
    } else {
      penaltyTotal += w;
      if (!satisfied) penaltyGot += w;   // a VIOLATED must_not is what costs
    }
    const d = c.dimension || "unassigned";
    dims[d] = dims[d] || { got: 0, total: 0 };
    dims[d].total += w;
    dims[d].got += w * credit;
    results.push({
      id: c.id,
      kind: c.kind,
      dimension: d,
      weight: w,
      detected,
      satisfied,
      ...(fraction !== undefined ? { fraction, rows } : {}),
      // Evidence is the matched text (truncated). For a violated must_not that is the offending
      // phrase; for a satisfied must it is the proof. A criterion result with neither is just a claim.
      // Oracle evidence is a multi-line report that feeds the revision step; collapsing and
      // clipping it to 160 chars threw away the only actionable part. Text/JSON heads still get
      // the short form — for those, the match IS the evidence.
      evidence: m == null ? null
        : c.detector.kind === "oracle" ? String(m)
        : String(m).replace(/\s+/g, " ").slice(0, 160),
    });
  }
  const by_dimension = {};
  for (const [d, v] of Object.entries(dims)) by_dimension[d] = round(v.got / v.total);
  const base = mustTotal === 0 ? 0 : mustGot / mustTotal;
  const penalty = penaltyTotal === 0 ? 0 : penaltyGot / penaltyTotal;
  return { score: round(Math.max(0, base - penalty)), criteria: results, by_dimension };
}

const round = (n) => Math.round(n * 1000) / 1000;
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Regex detector — the prose head. Kept only for skills with no structured output contract.
 * @param {string} text - Draft text.
 * @param {{pattern:string, flags?:string}} d - Detector spec.
 * @returns {{detected:boolean, evidence:(string|null)}} Match result and the matched substring.
 */
function detectRegex(text, d) {
  const m = new RegExp(d.pattern, d.flags || "").exec(text);
  return { detected: m !== null, evidence: m ? m[0] : null };
}

/**
 * Pull the last well-formed top-level JSON object out of a transcript.
 *
 * A worker answers with prose around its envelope (```json fences, a sentence before it). Rather
 * than demand a bare document — which would grade presentation again, the exact mistake this
 * replaces — scan for the last balanced `{...}` that parses.
 * @param {string} text - Draft text.
 * @returns {object|null} The parsed envelope, or null when the draft contains none.
 */
export function extractJSON(text) {
  // Take the LARGEST balanced object, not the first one found. Scanning inward-first returns a
  // nested member (`bugs[0]` parses perfectly well on its own) and every path lookup then misses
  // against a fragment — which reads exactly like a skill that returned nothing.
  let best = null, bestLen = 0;
  for (let s = 0; s < text.length; s++) {
    if (text[s] !== "{") continue;
    if (text.length - s <= bestLen) break;   // nothing further left can beat the incumbent
    let depth = 0, inStr = false, esc = false;
    for (let i = s; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        const span = text.slice(s, i + 1);
        if (span.length > bestLen) {
          try { const o = JSON.parse(span); if (o && typeof o === "object") { best = o; bestLen = span.length; } } catch { /* keep scanning */ }
        }
        break;
      }
    }
  }
  return best;
}

/**
 * Resolve a dotted path against an object, where a `[]` segment flattens an array.
 * `verdict.criteria[].evidence` → every criterion's evidence string.
 * @param {*} obj - Root object.
 * @param {string} path - Dotted path; `[]` flattens.
 * @returns {any[]} Every value the path reaches, absent branches skipped.
 */
export function resolvePath(obj, path) {
  let cur = [obj];
  for (const seg of path.split(".")) {
    const flat = seg.endsWith("[]");
    const key = flat ? seg.slice(0, -2) : seg;
    const next = [];
    for (const v of cur) {
      if (v === null || v === undefined) continue;
      const got = key === "" ? v : v[key];
      if (got === undefined || got === null) continue;
      if (flat && Array.isArray(got)) next.push(...got);
      else next.push(got);
    }
    cur = next;
  }
  return cur;
}

/**
 * Oracle detector — delegate the judgement to a script that already grades this artifact.
 *
 * The point of Tier 1: every skill here is sole writer of a committed artifact that a deterministic
 * script (`spec-lint`, `trace-lint`, `board-derive`, the evaluation oracles) already checks. Calling
 * that script means ZERO authored criteria, which removes the failure mode the spec-evaluator pilot
 * hit — 9 hand-written criteria that swung the same skill's score 8x (0.095 -> 0.933) purely on what
 * the author chose to look at.
 *
 * Exit-code contract, from oracles/process-oracle.mjs: 0 = all criteria pass, 1 = at least one
 * fails, 2 = usage/contract error. Two and one are NOT the same event: a 2 means the oracle was
 * invoked wrongly, and scoring that as "the artifact is bad" is the turn-cap mistake again — a
 * broken instrument reported as a bad result. A 2 throws.
 *
 * @param {{cmd:string, path?:string, equals?:*, matches?:string, min_count?:number}} d - Detector.
 * @param {{workspace?:string, slug?:string}} ctx - Substitution context for the command.
 * @returns {{detected:boolean, evidence:(string|null)}} Whether the oracle's verdict satisfies the
 *   criterion, plus a short evidence string.
 * @throws {Error} If the oracle cannot be run, or exits with a usage/contract error.
 */
function detectOracle(d, ctx = {}) {
  const cmd = d.cmd
    .replace(/\{\{workspace\}\}/g, ctx.workspace || ".")
    .replace(/\{\{slug\}\}/g, ctx.slug || "")
    .replace(/\{\{root\}\}/g, ROOT);
  // Quote-aware split. A naive split(" ") shatters `eval-cli-contract.mjs "node /ws/todo.js"` —
  // that oracle takes the entire run-command as ONE argv, so the shattered form would hand it the
  // word "node" as the deliverable and report a broken invocation as a failing artifact.
  const parts = (cmd.match(/"[^"]*"|\S+/g) || []).map((t) => t.replace(/^"|"$/g, ""));
  const r = spawnSync(parts[0], parts.slice(1), { encoding: "utf8", cwd: ctx.workspace || ROOT, maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw new Error(`oracle detector could not run "${cmd}": ${r.error.message}`);
  if (r.status === 2) {
    throw new Error(`oracle "${cmd}" exited 2 (usage/contract error) — the oracle is misconfigured, not the artifact. Refusing to score it as a failure.\n${(r.stderr || "").slice(0, 300)}`);
  }
  // With a `path`, read the oracle's JSON report; without one, the exit code IS the verdict.
  if (d.path) {
    const report = extractJSON(r.stdout || "");
    if (!report) throw new Error(`oracle "${cmd}" produced no parseable JSON report, but the detector asks for path "${d.path}"`);
    return detectJSON(report, d);
  }
  // With `rows`, the exit code is kept as the SATISFIED verdict but the report is also parsed into
  // per-row results, so the criterion can return partial credit. Measured reason: the todo-cli
  // contract had five rows then (six since P1); three paid runs sat at 4-of-5 for fifteen rounds and every one
  // of them scored 0.0, because a single binary criterion cannot distinguish "one edge case missed"
  // from "wrote nothing". That is Table III's "average success hides catastrophic cases" inverted —
  // a catastrophic score hiding an almost-passing artifact — and it makes the delta unreadable:
  // there is no number a revision round could move except 0 → 1.
  const rows = d.rows ? parseOracleRows(r.stdout || "", d.rows) : null;
  if (d.rows && (!rows || rows.length === 0)) {
    throw new Error(`oracle "${cmd}" produced no rows matching the detector's row pattern /${d.rows.pattern}/ — a row-scored criterion that parses nothing would score every artifact 0. Fix the pattern or drop \`rows\`.`);
  }
  return {
    ...(rows ? { fraction: round(rows.filter((x) => x.pass).length / rows.length), rows } : {}),
    detected: r.status === 0,
    // NOT truncated to a snippet. This string becomes the REVISION INSTRUCTION, and at 140 chars
    // the oracle's report was still inside its own header — the model was told "the oracle failed"
    // and never which row. Measured: 5 rounds, zero improvement, on a deliverable that was already
    // passing 4 of 5 rows and needed one named fix. A reviewer that returns "looks wrong" is the
    // exact failure §V warns about; the report IS the criterion-level defect list, so it ships whole.
    evidence: r.status === 0 ? `oracle passed: ${cmd}` : `oracle exit ${r.status}:\n${(r.stdout || r.stderr || "").slice(0, 4000)}`,
  };
}

/**
 * Split an oracle's own report into its per-row verdicts.
 *
 * The pattern is DECLARED in the rubric, never inferred: the row format belongs to the oracle
 * (`oracles/process-oracle.mjs`'s `formatReport` emits `PASS  E1  desc`), and a scorer that guessed
 * at it would silently return zero rows the day an oracle reworded its output — scoring every
 * artifact 0 while looking healthy. Hence the caller throws on an empty parse.
 *
 * Named groups are required rather than group indices so the rubric reads as the thing it means.
 * @param {string} stdout - The oracle's report.
 * @param {{pattern:string, flags?:string, pass:string}} spec - Row spec with named groups
 *   `status` (required), `id` and `label` (optional).
 * @returns {Array<{id:string, pass:boolean, label:string}>} One entry per matched row.
 */
export function parseOracleRows(stdout, spec) {
  const flags = spec.flags && spec.flags.includes("g") ? spec.flags : `${spec.flags || ""}g`;
  const re = new RegExp(spec.pattern, flags);
  const out = [];
  for (const m of stdout.matchAll(re)) {
    const g = m.groups || {};
    if (g.status === undefined) continue;
    out.push({
      id: (g.id || `row-${out.length + 1}`).trim(),
      pass: g.status.trim() === spec.pass,
      label: (g.label || "").trim(),
    });
  }
  return out;
}

/**
 * Structured detector — reads the worker's actual output contract instead of its prose.
 *
 * This is the whole point of the v2 rubric. `/spec-evaluator` returns a schema-validated WorkResult
 * whose fields ARE the things the rubric wants to know (`verdict.overall`, `verdict.refuted[]`,
 * `verdict.criteria[].evidence`). Grading those fields is exact and needs no pattern matching; the
 * regex head was measuring whether the model phrased a verdict the way the fixture author did.
 * @param {object|null} env - Extracted envelope, or null when the draft carried no JSON.
 * @param {{path:string, equals?:*, matches?:string, min_count?:number}} d - Detector spec.
 * @returns {{detected:boolean, evidence:(string|null)}} Whether the assertion holds, plus the value.
 */
function detectJSON(env, d) {
  if (!env) return { detected: false, evidence: null };
  const vals = resolvePath(env, d.path);
  if (d.min_count !== undefined) {
    return { detected: vals.length >= d.min_count, evidence: `${vals.length} value(s) at ${d.path}` };
  }
  if (d.equals !== undefined) {
    const hit = vals.find((v) => String(v).toLowerCase() === String(d.equals).toLowerCase());
    return { detected: hit !== undefined, evidence: hit === undefined ? JSON.stringify(vals).slice(0, 160) : String(hit) };
  }
  if (d.matches !== undefined) {
    const re = new RegExp(d.matches, d.flags || "i");
    const hit = vals.find((v) => re.test(typeof v === "string" ? v : JSON.stringify(v)));
    return { detected: hit !== undefined, evidence: hit === undefined ? null : String(typeof hit === "string" ? hit : JSON.stringify(hit)) };
  }
  return { detected: vals.length > 0, evidence: vals.length ? JSON.stringify(vals[0]).slice(0, 160) : null };
}

/**
 * Turn a review into the revision instructions the next round is given.
 * §V's grounding-layer example is explicit that a reviewer returns criterion-level required
 * evidence, never "looks good" — so the changes list names criteria, not impressions.
 * @param {{criteria:Array<object>}} review - A scoreDraft() result.
 * @param {object} rubric - The rubric the review came from (for assertion text).
 * @returns {string[]} One instruction per unsatisfied criterion.
 */
export function changesFrom(review, rubric) {
  const byId = new Map(rubric.criteria.map((c) => [c.id, c]));
  return review.criteria
    .filter((r) => !r.satisfied)
    .map((r) => {
      const c = byId.get(r.id);
      // BOTH branches carry the evidence. The `must` branch used to send the assertion alone, so an
      // oracle-graded criterion told the model "the contract does not pass" and withheld the report
      // naming WHICH row failed — the model then rewrote blind for 5 rounds on a deliverable that
      // was already passing 4 of 5. Fixing the truncation upstream achieved nothing while the text
      // was dropped here; the whole chain has to carry it, which is now asserted by structural §48.
      if (r.kind !== "must") {
        return `[${r.id}] FORBIDDEN, present: ${c.assertion}${r.evidence ? ` — found: "${r.evidence}"` : ""}`;
      }
      // A row-scored criterion already knows WHICH rows failed, so say so instead of restating the
      // whole assertion. The passing rows are named too: with the artifact now carried between
      // rounds, "fix E4" without "and E1/E2/E3/E5 already pass" is an invitation to rewrite from
      // scratch — which is what the first three paid runs did, one of them trading E4 for E1+E5.
      const failed = (r.rows || []).filter((x) => !x.pass);
      if (failed.length) {
        const passed = (r.rows || []).filter((x) => x.pass).map((x) => x.id);
        return [
          `[${r.id}] ${failed.length} of ${r.rows.length} rows FAIL — fix exactly these, and do not regress the rest:`,
          ...failed.map((x) => `    ✗ ${x.id}${x.label ? ` — ${x.label}` : ""}`),
          passed.length ? `  already passing, must stay passing: ${passed.join(", ")}` : "",
          r.evidence ? `  full oracle report:\n${r.evidence}` : "",
        ].filter(Boolean).join("\n");
      }
      return `[${r.id}] REQUIRED, missing: ${c.assertion}${r.evidence ? `\n  observed:\n${r.evidence}` : ""}`;
    });
}


/**
 * The deliverable paths a fixture declares, always as a list.
 *
 * `task-executor` writes one file (`todo.js`) and the field was a string for that reason. The other
 * four Tier-1 skills do not: `scope-architect` writes N scope contracts into a directory whose
 * membership is its own decision, and `ba-pitch-analyzer` writes a spec tree AND a board, which live
 * under two different storage roots (ADR-0001 — one committed, one gitignored). A single-file field
 * cannot name either, and naming only the first would carry half a revision forward.
 *
 * A path may be a file or a directory; a directory carries whole.
 * @param {object} rubric - Rubric with fixture.deliverable (string, string[], or absent).
 * @returns {string[]} Workspace-relative deliverable paths; [] when the fixture declares none.
 */
export function deliverablePaths(rubric) {
  const d = rubric.fixture?.deliverable;
  return Array.isArray(d) ? d.filter(Boolean) : d ? [d] : [];
}

/**
 * Normalize one `fixture.seed` entry into {from, to}.
 *
 * A bare string keeps the original meaning — copy the file to its BASENAME — because
 * `task-executor`'s fixture seeds one flat file and changing that would move its fingerprint and
 * retire a measurement for no reason. The object form is required by every fixture that seeds a
 * TREE: `spec-lint` resolves `shapeup/<slug>/spec/usecases/` through lib/paths.mjs, so a seed
 * flattened to its basename lands somewhere the oracle does not look and every artifact scores 0
 * while the instrument reports itself healthy.
 *
 * @param {string|{from:string, to?:string}} entry - A seed entry.
 * @returns {{from:string, to:string}} Repo-relative source and workspace-relative destination.
 */
export function seedEntry(entry) {
  if (typeof entry === "string") return { from: entry, to: basename(entry) };
  return { from: entry.from, to: entry.to || basename(entry.from) };
}

/**
 * Copy a file or a whole directory tree to `dest`, creating parents.
 * @param {string} src - Absolute source path.
 * @param {string} dest - Absolute destination path.
 * @returns {void}
 */
function copyInto(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  if (statSync(src).isDirectory()) cpSync(src, dest, { recursive: true });
  else copyFileSync(src, dest);
}

/**
 * Every file under a path, workspace-relative and sorted — the unit a tree is hashed and read by.
 * @param {string} root - The workspace root paths are made relative to.
 * @param {string} p - Absolute file or directory path (missing is fine → []).
 * @returns {string[]} Sorted root-relative file paths.
 */
function filesUnder(root, p) {
  if (!existsSync(p)) return [];
  if (!statSync(p).isDirectory()) return [relative(root, p)];
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const c = join(dir, e.name);
      if (e.isDirectory()) walk(c); else out.push(relative(root, c));
    }
  };
  walk(p);
  return out.sort();
}

/**
 * Hash a fixture's whole deliverable, however many files and directories it spans.
 *
 * The no-improvement ratchet compares this between rounds, so it must change when ANY graded byte
 * changes and must not change when only file order or mtime does — hence the sorted (path, sha)
 * digest rather than a concatenation. Returns null when the round produced no deliverable at all,
 * which the ratchet must not read as "unchanged".
 *
 * @param {string} ws - Absolute workspace root.
 * @param {string[]} paths - Workspace-relative deliverable paths.
 * @returns {string|null} A digest over the tree, or null when nothing was produced.
 */
export function deliverableSha(ws, paths) {
  const parts = [];
  for (const rel of paths) for (const f of filesUnder(ws, join(ws, rel))) parts.push(`${f}:${sha256(readFileSync(join(ws, f), "utf8"))}`);
  return parts.length ? sha256(parts.join("\n")) : null;
}

/**
 * Read a reference draft that may be a FILE or a whole DIRECTORY, as one text.
 *
 * Selftest still needs a string per version (it is what gets sha'd, sized and stored), but a
 * multi-file deliverable has no single file to read. The concatenation is deterministic and
 * headed by path so a stored draft stays diagnosable; the SCORE never comes from this text — it
 * comes from the oracle run against the workspace.
 *
 * @param {string} p - Absolute path to a file or directory.
 * @returns {string} The file's contents, or a path-headed concatenation of the tree's.
 */
export function readDraft(p) {
  if (!existsSync(p)) return "";
  if (!statSync(p).isDirectory()) return readFileSync(p, "utf8");
  return filesUnder(p, p).map((f) => `--- ${f} ---\n${readFileSync(join(p, f), "utf8")}`).join("\n");
}

/**
 * Build a scratch workspace for a `grades: "workspace"` rubric.
 *
 * `task-executor`'s draft is a DIRECTORY, not a string: it writes code, and the oracle runs that
 * code. So the loop hands it an isolated copy of the fixture seed, lets it write the deliverable
 * there, and points the oracle at the result. Isolated per round because the oracle EXECUTES what
 * it finds — grading round N against files left behind by round N-1 would measure the union of
 * every attempt rather than the attempt.
 *
 * @param {object} rubric - Rubric with fixture.seed[] and fixture.deliverable.
 * @param {string|null} [deliverableSrc] - What to install as the deliverable (selftest reference
 *   workspaces); omitted in measure mode, where the model writes it. A DIRECTORY is treated as a
 *   pre-built deliverable tree and overlaid at the workspace root, which is how a reference draft
 *   spanning several files is handed in; a FILE is installed at the first declared deliverable path.
 * @returns {string} Absolute path to the scratch workspace.
 */
export function prepareWorkspace(rubric, deliverableSrc = null) {
  const dir = mkdtempSync(join(tmpdir(), "skill-loop-ws-"));
  for (const entry of rubric.fixture.seed || []) {
    const { from, to } = seedEntry(entry);
    copyInto(join(ROOT, from), join(dir, to));
  }
  if (deliverableSrc) {
    const paths = deliverablePaths(rubric);
    if (statSync(deliverableSrc).isDirectory() && paths.length !== 1) cpSync(deliverableSrc, dir, { recursive: true });
    else copyInto(deliverableSrc, join(dir, paths[0]));
  }
  return dir;
}

/**
 * Build the workspace for ONE round, carrying the previous round's deliverable into it.
 *
 * This is the revision step for a `grades: "workspace"` rubric, and it is exported rather than
 * inlined in the CLI precisely because it was silently absent once: rounds got a fresh empty
 * directory and a list of failing rows, so the only move available was to write the deliverable
 * again from nothing. Three paid runs, fifteen rounds, not one revision among them — and the run
 * records looked like a loop the whole time. Structural §48 now asserts this end to end.
 *
 * The directory is still fresh (the oracle EXECUTES what it finds and must not grade leftovers);
 * only the declared deliverable paths cross the boundary.
 *
 * @param {object} rubric - Rubric with fixture.seed[] and fixture.deliverable.
 * @param {string|null} [prevWorkspace] - The previous round's workspace, or null for round 1.
 * @returns {{cwd:string, carried_forward:boolean}} The new workspace and whether it inherited.
 */
export function roundWorkspace(rubric, prevWorkspace = null) {
  const paths = deliverablePaths(rubric);
  const present = prevWorkspace ? paths.filter((p) => existsSync(join(prevWorkspace, p))) : [];
  const cwd = prepareWorkspace(rubric, null);
  // Copied AFTER the seed, so a deliverable that lives inside a seeded tree (a board written into a
  // seeded spec folder) wins over the seed's copy of it rather than being silently reverted.
  for (const p of present) copyInto(join(prevWorkspace, p), join(cwd, p));
  return { cwd, carried_forward: present.length > 0 };
}

// ---- the loop ---------------------------------------------------------------

/**
 * The paper's `reflective_task`, with every artifact stored.
 *
 * @param {object} opts - Loop configuration.
 * @param {string} opts.skill - Skill under evaluation.
 * @param {object} opts.rubric - Rubric conforming to day1-rubric.schema.json.
 * @param {function(number, (string|null), string[]): {text:string, source:string}} opts.gen -
 *   Generator. Called as gen(round, priorText, changes); returns the next draft and its provenance.
 * @param {"selftest"|"measure"} opts.mode - Recorded on the run; selftest output may never be
 *   reported as skill quality.
 * @param {string|null} [opts.model=null] - Model label; required in measure mode.
 * @param {function(number, string): (string|null)} [opts.persist] - Called with (round, text) for
 *   every draft; returns the path it was written to, which lands on the version record. §VI.A says
 *   "store every artifact" and means it: without the text, a low score is undiagnosable and the
 *   only way to find out what the model actually said is to pay for the run a second time.
 * @returns {object} A run record conforming to day1-loop-run.schema.json.
 */
export function runLoop({ skill, rubric, gen, mode, model = null, persist = null, ctx = {} }) {
  const maxRounds = rubric.stopping_rule?.max_rounds ?? 3;
  const approveAt = rubric.stopping_rule?.approve_at ?? 0.85;
  const versions = [];
  const reviews = [];
  const started = new Date().toISOString();

  // Per-round spend, in round order. Kept on the loop rather than only summed because a run that
  // cost $4 in one runaway round and a run that cost $4 evenly across five are different findings,
  // and a total cannot tell them apart.
  //
  // Recorded against the GENERATION, not against the kept version, and the difference is not
  // cosmetic: the no-improvement ratchet below discards a round that has already been paid for. A
  // loop that stops because round 4 came back byte-identical spent four rounds and would otherwise
  // record three. Same rule as the abort path — money spent on a round that produced nothing is
  // still money spent, and it is exactly the spend a re-run budget needs to include.
  const roundCosts = [];
  const noteCost = (produced) => { if (mode === "measure" && produced) roundCosts.push(produced.cost ?? null); return produced; };

  const push = (round, produced) => {
    versions.push({
      round,
      source: produced.source,
      path: produced.path ?? (persist ? persist(round, produced.text) : null),
      sha256: sha256(produced.text),   // recomputed from the text actually graded, never handed in
      bytes: Buffer.byteLength(produced.text, "utf8"),
      ...(produced.cost !== undefined ? { cost: produced.cost } : {}),
      // Workspace rubrics only. `artifact` is the deliverable this round actually produced (the
      // transcript at `path` is commentary about it); `carried_forward` records whether the round
      // started from the previous deliverable or from an empty directory — the difference between a
      // revision and a re-roll, and the one fact needed to read a flat delta correctly.
      ...(produced.artifact !== undefined ? { artifact: produced.artifact } : {}),
      ...(produced.carried_forward !== undefined ? { carried_forward: produced.carried_forward } : {}),
    });
    return produced.text;
  };

  // versions[0] — the paper's "stored first draft".
  const first = noteCost(gen(1, null, []));
  let lastArtifactSha = first.artifact_sha ?? null;
  let current = push(1, first);
  let firstScore = null;
  let stopped = { reason: "iteration_limit", round: 1 };

  for (let round = 1; round <= maxRounds; round++) {
    const review = scoreDraft(current, rubric, ctx);
    const decision = review.score >= approveAt ? "approve" : "revise";
    const changes = decision === "approve" ? [] : changesFrom(review, rubric);
    reviews.push({ round, decision, score: review.score, criteria: review.criteria, changes });
    if (firstScore === null) firstScore = review.score;

    if (decision === "approve") { stopped = { reason: "approve", round }; break; }
    if (round === maxRounds) { stopped = { reason: "iteration_limit", round }; break; }

    const produced = noteCost(gen(round + 1, current, changes));
    // §IX.B: "a ratchet improves the metric it can see." A round that produced nothing new is a
    // round that will produce nothing new again — stop rather than burn the remaining budget.
    //
    // Compared on the ARTIFACT when there is one. For a workspace rubric the transcript is
    // commentary, and commentary is never byte-identical twice ("Done." vs "Fixed E4."), so a
    // text comparison can never fire — the loop would re-run the oracle over an unchanged file for
    // every remaining round and score it the same each time. The deliverable's hash is the thing
    // that determines the score, so it is the thing the ratchet has to watch.
    const sameArtifact = produced && produced.artifact_sha != null && produced.artifact_sha === lastArtifactSha;
    if (!produced || produced.text === current || sameArtifact) { stopped = { reason: "no_improvement", round }; break; }
    lastArtifactSha = produced.artifact_sha ?? null;
    current = push(round + 1, produced);
  }

  const finalScore = reviews[reviews.length - 1].score;
  return {
    schema_version: SCHEMA_VERSION,
    skill,
    fixture: rubric.fixture.id,
    mode,
    run_id: null,
    started_at: started,
    model,
    versions,
    reviews,
    stopped,
    quality: {
      v1_score: firstScore,
      final_score: finalScore,
      delta: round3(finalScore - firstScore),
      improved: finalScore > firstScore,
      // Reported because carry-forward makes the failure it names possible. A revision round can now
      // break a row an earlier round had passing, and `final_score` alone cannot show that: a run
      // that reached 0.8 and fell back to 0.6 reads identically to one that never got past 0.6.
      // §VIII.B — "do not hide partial failure behind a fluent final answer."
      best_score: round3(Math.max(...reviews.map((r) => r.score))),
      regressed: finalScore < Math.max(...reviews.map((r) => r.score)),
      by_dimension: scoreDraft(current, rubric, ctx).by_dimension,
    },
    cost: mode === "selftest" ? null : { ...totalCost(roundCosts), wall_clock_s: null },
  };
}

/**
 * Sum per-round costs into one run total, refusing to publish a partial sum as a total.
 *
 * The refusal is the whole point and it is the F1 rule applied to spend. If any round did not
 * report its cost, the sum of the rest is not "the run cost a bit less than this" — it is a number
 * with no defined meaning that reads exactly like a measured total. So an unreported round makes
 * the total `null` and `rounds_reported` says how many of how many were known. A reader can then
 * see the gap; a reader handed a partial sum cannot.
 *
 * @param {Array<object|null>} roundCosts - One entry per round; null where the round reported none.
 * @returns {{tokens_in:(number|null), tokens_out:(number|null), cache_read_tokens:(number|null),
 *   cache_creation_tokens:(number|null), usd:(number|null), source:string,
 *   rounds_reported:number, rounds:number, per_round_usd:Array<number|null>}} The run total.
 */
export function totalCost(roundCosts) {
  const known = roundCosts.filter((c) => c && c.source === "cli-json");
  const complete = roundCosts.length > 0 && known.length === roundCosts.length;
  const sum = (k) => known.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  return {
    tokens_in: complete ? sum("tokens_in") : null,
    tokens_out: complete ? sum("tokens_out") : null,
    cache_read_tokens: complete ? sum("cache_read_tokens") : null,
    cache_creation_tokens: complete ? sum("cache_creation_tokens") : null,
    usd: complete ? round4(sum("usd")) : null,
    source: complete ? "cli-json" : roundCosts.length === 0 ? "unavailable" : "partial",
    rounds_reported: known.length,
    rounds: roundCosts.length,
    // Survives the null-on-partial rule: even when the total is withheld, the rounds that DID
    // report are still on the record, so the gap is inspectable rather than merely asserted.
    per_round_usd: roundCosts.map((c) => (c && Number.isFinite(c.usd) ? round4(c.usd) : null)),
  };
}

const round3 = (n) => Math.round(n * 1000) / 1000;
const round4 = (n) => Math.round(n * 10000) / 10000;

// ---- selftest: does the rubric discriminate? --------------------------------

/**
 * Score a rubric's two reference drafts and check the required separation.
 *
 * This is the zero-spend proof that the instrument is an instrument. A rubric whose weak and strong
 * reference drafts score the same measures nothing, and would happily report "no quality change"
 * forever. Note precisely what this does and does not establish: it establishes that the RUBRIC
 * separates a known-bad draft from a known-good one. It establishes nothing about the skill — the
 * drafts are hand-authored, and `source` on each version says so.
 *
 * @param {{skill:string, dir:string, rubric:object}} entry - A loadRubrics() entry.
 * @returns {{skill:string, weak:number, strong:number, separation:number, pass:boolean,
 *   errors:string[], loop:object}} Scores, the pass/fail against the rubric's declared thresholds,
 *   and a full loop record for the weak→strong revision (the Day-1 quality delta, synthetic).
 */
export function selftest(entry) {
  const { skill, dir, rubric } = entry;
  const errors = [];
  const weakPath = join(dir, rubric.fixture.reference_drafts.weak);
  const strongPath = join(dir, rubric.fixture.reference_drafts.strong);
  for (const p of [weakPath, strongPath]) {
    if (!existsSync(p)) errors.push(`reference draft missing: ${p}`);
  }
  if (errors.length) return { skill, weak: 0, strong: 0, separation: 0, pass: false, errors, loop: null };

  const weakText = readDraft(weakPath);
  const strongText = readDraft(strongPath);
  const ws = rubric.grades === "workspace";
  const weakWs = ws ? prepareWorkspace(rubric, weakPath) : null;
  const strongWs = ws ? prepareWorkspace(rubric, strongPath) : null;
  const sctx = { workspace: rubric.fixture.workspace ? join(ROOT, rubric.fixture.workspace) : ROOT, slug: rubric.fixture.id };
  const weak = scoreDraft(weakText, rubric, ws ? { ...sctx, workspace: weakWs } : sctx).score;
  const strong = scoreDraft(strongText, rubric, ws ? { ...sctx, workspace: strongWs } : sctx).score;
  const loopCtx = { ...sctx };

  const maxWeak = rubric.discrimination?.max_weak_score ?? 0.5;
  const minStrong = rubric.discrimination?.min_strong_score ?? 0.8;
  if (weak > maxWeak) errors.push(`weak draft scored ${weak}, must be <= ${maxWeak} (rubric does not catch the known failure mode)`);
  if (strong < minStrong) errors.push(`strong draft scored ${strong}, must be >= ${minStrong} (rubric penalizes correct output)`);
  if (strong <= weak) errors.push(`no separation: strong ${strong} <= weak ${weak}`);

  // Drive the real loop over the two drafts: round 1 is the weak draft, the revision step swaps in
  // the strong one. This exercises runLoop() end-to-end (stopping rule, artifact storage, delta
  // arithmetic) on every CI run, so the loop cannot rot while only the scorer is tested.
  let handed = false;
  const loop = runLoop({
    skill,
    rubric,
    ctx: loopCtx,
    mode: "selftest",
    gen: (round) => {
      // For a workspace rubric the DRAFT IS THE DIRECTORY, so the round must move the context too.
      // `loopCtx` is mutated in place and re-read by the next scoreDraft — otherwise round 1 grades
      // the weak draft against the strong workspace and the loop approves a bad draft immediately.
      if (round === 1) {
        if (ws) loopCtx.workspace = weakWs;
        return { text: weakText, source: "reference-weak", path: weakPath };
      }
      handed = true;
      if (ws) loopCtx.workspace = strongWs;
      return { text: strongText, source: "reference-strong", path: strongPath };
    },
  });
  if (!handed) errors.push("loop approved the weak draft on round 1 — the stopping rule is miscalibrated");
  if (!loop.quality.improved) errors.push(`loop recorded no quality improvement (delta ${loop.quality.delta})`);

  return { skill, weak, strong, separation: round3(strong - weak), pass: errors.length === 0, errors, loop };
}

// ---- measure mode -----------------------------------------------------------

/**
 * Parse the CLI's `--output-format json` envelope into a draft and a COST record.
 *
 * Split out of generateWithClaude() and exported for one reason: it is the only part of the paid
 * path that can be tested without paying. Structural §48 drives it with canned envelopes — a
 * success, a max-turns error, a permission denial — so the cost arithmetic and the abort semantics
 * are covered deterministically. The spawn around it is the only thing left untested.
 *
 * TWO FIELDS LOOK LIKE THE TOKEN COUNT AND ONE OF THEM IS WRONG. `usage` describes only the LAST
 * assistant message; `modelUsage` is the whole session. Measured on a one-turn probe: `usage
 * .input_tokens` = 10 against `modelUsage[...].inputTokens` = 531, with 17,536 cache-read tokens
 * that `usage` shows and a naive sum would double-count. Reading `usage` would have published a
 * spend figure ~50x under the truth while looking perfectly well-sourced — the exact shape of the
 * defect this file keeps finding, so it is written down rather than left to the next reader.
 *
 * Costs are summed across `modelUsage` keys because a session may route to more than one model
 * (a subagent, a fallback). `total_cost_usd` is the CLI's OWN figure and is taken verbatim rather
 * than recomputed from tokens: recomputing needs a price table, a price table goes stale, and a
 * stale price table produces a confident wrong number, which is worse than no number.
 *
 * @param {string} stdout - Raw stdout from the CLI.
 * @param {number|null} [status=0] - Process exit status, for the error message only.
 * @returns {{text:string, cost:object, denials:Array}} Draft text, cost record, permission denials.
 * @throws {Error} If the envelope does not parse, reports an error, or carries no result text.
 */
export function parseCliEnvelope(stdout, status = 0) {
  let env;
  try {
    env = JSON.parse(stdout);
  } catch {
    throw new Error(
      `measure adapter did not return a JSON envelope (exit ${status}). ` +
      `Expected \`--output-format json\`; got ${JSON.stringify((stdout || "").slice(0, 200))}. ` +
      `Refusing to score this — a harness that cannot read its own adapter's output must look broken.`
    );
  }
  if (!env || typeof env !== "object") throw new Error(`measure adapter returned a non-object envelope: ${JSON.stringify(stdout.slice(0, 200))}`);

  // A failed round still SPENT money, so the cost is extracted before any abort. The two probes
  // that established this envelope's shape cost $0.018 and $0.013, and the second one was the
  // max-turns FAILURE. Discarding the cost of aborted rounds would under-report exactly the runs a
  // budget most needs to see.
  const mu = env.modelUsage && typeof env.modelUsage === "object" ? Object.values(env.modelUsage) : [];
  const sum = (k) => mu.reduce((a, m) => a + (Number(m?.[k]) || 0), 0);
  const usd = Number.isFinite(env.total_cost_usd) ? env.total_cost_usd : null;
  const cost = {
    tokens_in: mu.length ? sum("inputTokens") : null,
    tokens_out: mu.length ? sum("outputTokens") : null,
    cache_read_tokens: mu.length ? sum("cacheReadInputTokens") : null,
    cache_creation_tokens: mu.length ? sum("cacheCreationInputTokens") : null,
    usd,
    // Names where the number came from, so a null is legible as "not reported" rather than as
    // zero. `cli-json` is the only value that licenses summing these into a run total.
    source: usd === null && !mu.length ? "unavailable" : "cli-json",
  };
  const denials = Array.isArray(env.permission_denials) ? env.permission_denials : [];

  // STRUCTURAL error signal, replacing the string-sniffing this used to do. Verified against the
  // CLI: a turn-cap exhaustion sets is_error, subtype `error_max_turns`, terminal_reason
  // `max_turns`, and OMITS `result` entirely. The old guard had to recognise the English sentence
  // "Error: Reached max turns (12)" to catch the same thing, and two paid runs got scored as
  // 29-byte drafts before it did.
  if (env.is_error === true || typeof env.result !== "string") {
    const why = env.subtype || env.terminal_reason || env.stop_reason || `exit ${status}`;
    throw new Error(
      `measure adapter returned a CLI ERROR, not a draft: ${why}` +
      (env.api_error_status ? ` (api status ${env.api_error_status})` : "") +
      (typeof env.result === "string" ? `\n${env.result.slice(0, 300)}` : "") +
      `\nSpent on this failed round: ${usd === null ? "unreported" : `$${usd.toFixed(4)}`}.` +
      `\nScoring this would measure the harness and report it as skill quality. ` +
      `If it is the turn cap, raise --max-turns: the cap defines what is being measured.`
    );
  }

  // FC-02, mechanically. The second withdrawn measurement in DAY1-REPORT.md is a run where the
  // skill could not execute `node`, correctly refused to fabricate the observation, and scored 0 —
  // a permission gap published as a -0.571 quality delta. The CLI now reports denials as data, so
  // that failure mode stops being something a reader has to notice afterwards.
  if (denials.length) {
    throw new Error(
      `measure adapter hit ${denials.length} PERMISSION DENIAL(S): ` +
      `${JSON.stringify(denials.slice(0, 3))}\n` +
      `The session was prevented from doing the work being graded, so its output is not a measurement ` +
      `of the skill. Add the tool to --allowedTools in generateWithClaude() and re-run. ` +
      `Spent on this denied round: ${usd === null ? "unreported" : `$${usd.toFixed(4)}`}. ` +
      `(This is FC-02 in evals/failure-classes.json; a prior run published a -0.571 delta that was ` +
      `entirely this.)`
    );
  }
  return { text: env.result.trim(), cost, denials };
}

/**
 * Generate one draft by invoking the real skill headlessly.
 *
 * Mirrors tools/trigger-eval.mjs's adapter contract, including its refusal semantics: a probe that
 * produces no output is an ABORT, not a zero. Override the command with SKILL_LOOP_CMD (placeholders
 * {{prompt}}, {{root}}, {{model}}) if your CLI differs.
 *
 * @param {string} prompt - The full prompt for this round.
 * @param {string} model - Model id; recorded in the run.
 * @param {number} [maxTurns=12] - Turn budget per round.
 * @param {string} [cwd] - Working directory the session runs in (a workspace rubric's scratch dir).
 * @param {boolean} [requireTextDraft=true] - Whether the transcript IS the graded artifact. False
 *   for `grades: "workspace"`, where the artifact is the file the session wrote.
 * @returns {{text:string, cost:(object|null)}} The model's text output and what the round spent.
 *   `cost` is null on the SKILL_LOOP_CMD path, where the output format is unknown — null meaning
 *   "not reported", never zero.
 * @throws {Error} If the CLI is absent or the run produced no output (broken-harness trap).
 */
export function generateWithClaude(prompt, model, maxTurns = 12, cwd = ROOT, requireTextDraft = true) {
  const tmpl = process.env.SKILL_LOOP_CMD;
  // Split the template FIRST, then substitute per token. Substituting into the string and splitting
  // afterwards shatters a multi-word prompt across argv — the override path would silently send the
  // model a handful of loose words and score whatever came back as a bad draft.
  const args = tmpl
    ? tmpl.split(" ").filter(Boolean).map((t) => t.replace("{{prompt}}", prompt).replace("{{root}}", ROOT).replace("{{model}}", model))
    : ["--plugin-dir", ROOT, "-p", prompt, "--max-turns", String(maxTurns), "--model", model,
       // The whole of P0 is this flag and the parser behind it. Every measure run before it
       // recorded `usd: null` while the CLI was computing the figure and printing it — the plan's
       // $81 budget was an estimate scaled from an estimate, in a repo whose own rule is that no
       // figure is written without a run that produced it. The text format discards the number;
       // this one returns it alongside the draft, so the cost of measuring becomes measured too.
       "--output-format", "json",
       // WITHOUT THIS the measurement is invalid, and it took a paid run to find out. A headless
       // session starts with no permission grant, so `/spec-evaluator` cannot run `node` — and the
       // one behaviour this rubric exists to measure is whether the judge PROBES THE RUNNING BUILD
       // instead of reading the source. The skill correctly refused to fabricate, replied "I need
       // permission to run the Node.js process to probe the build", and scored 0. The harness was
       // grading a skill it had tied the hands of. This is FC-02 in evals/failure-classes.json —
       // the same missing permission grant `npx shapeup-sdlc init` writes for real installs.
       //
       // Scoped, NOT --dangerously-skip-permissions: blanket bypass would measure a session no user
       // ever runs, and a measurement harness is the last place to switch the safety rails off.
       // Write/Edit are here because task-executor's entire job is producing code. Without them a
       // measured run returns "I hit a permission denial writing to ..." and scores 0 — the harness
       // grading a skill it had disabled. Same defect as the missing Bash(node:*) probe permission,
       // one skill later.
       // `Bash`, not `Bash(node:*)`, and the widening was forced by a measured abort. A prefix
       // pattern matches the WHOLE command string, so it permits `node todo.js list` and denies
       // the compound script a session actually writes to test its work:
       //   export TODO_STORE=/tmp/t.json; node todo.js list; echo "$?"
       // The first paid P1 run hit SEVEN such denials on run 1 and aborted with nothing measured.
       //
       // The principled reason to grant it rather than enumerate more prefixes: in production
       // task-executor HAS a shell, and uses it to run the T0 probes its own contract requires. A
       // session denied one is a configuration that never occurs in the harness this is measuring,
       // so a number produced under it would describe nothing real. Enumeration cannot fix this
       // either — no prefix pattern matches a multi-line script.
       //
       // The containment is the workspace, not the tool list: every round runs in a fresh mkdtemp
       // directory holding one seed and one deliverable. Still NOT
       // --dangerously-skip-permissions, which would also disable the denial REPORTING that caught
       // this in the first place.
       "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "Bash"];
  const bin = tmpl ? args.shift() : "claude";
  const r = spawnSync(bin, args, { encoding: "utf8", cwd, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`measure adapter could not run "${bin}": ${r.error.message}`);
  const raw = (r.stdout || "").trim();
  if (!raw) throw new Error(`measure adapter produced no output (exit ${r.status}). Refusing to score this as a low-quality draft — a broken harness must look broken, not like a bad result.`);

  // The default path returns a JSON envelope, so the draft, the cost and the failure signal all
  // arrive structurally. The override path returns whatever the operator's CLI prints — text, by
  // assumption — so it keeps the string sentinels below and reports NO cost.
  let out, cost;
  if (!tmpl) {
    ({ text: out, cost } = parseCliEnvelope(raw, r.status));
  } else {
    out = raw;
    cost = null;
    // Kept for the override path only. This is the guard the JSON envelope now makes structural,
    // and it is how that lesson was learned: the CLI reports a turn-budget exhaustion in TEXT mode
    // by printing `Error: Reached max turns (12)` on stdout and exiting 0 — 29 non-empty bytes. The
    // adapter took that string as the model's draft, scored it, got 0, and reported "quality did
    // not improve". Two paid runs on two different models produced byte-identical 29-byte "drafts"
    // before anyone looked at one. An overridden CLI can still do this, so the sniffing stays here.
    if (/^Error:\s/i.test(out) || /Reached max turns/i.test(out) || /^\s*(Credit balance|Invalid API key|Authentication)/i.test(out)) {
      throw new Error(
        `measure adapter returned a CLI ERROR, not a draft: ${JSON.stringify(out.slice(0, 200))}\n` +
        `Scoring this would measure the harness and report it as skill quality. ` +
        `If it is the turn cap, raise --max-turns: the cap defines what is being measured, and a ` +
        `skill that must read a spec and probe a running build needs far more turns than one that ` +
        `only has to activate.`
      );
    }
  }
  if (!out) throw new Error(`measure adapter returned an empty draft (exit ${r.status}). Refusing to score this as a low-quality draft — a broken harness must look broken, not like a bad result.`);
  // No evaluation report is 120 bytes. An unrecognized failure shape that slips past the sentinels
  // above still must not be graded as prose — fail loudly on the length instead of quietly on the score.
  //
  // Applies ONLY when the transcript is the artifact. For a workspace rubric it is not: the artifact
  // is the file on disk, and the transcript is commentary about it. A run that wrote a flawless
  // todo.js and reported "Done — patched E4." is 22 bytes and would abort the whole sample here,
  // which is the broken-harness trap firing on a good result. The error-shape sentinels above still
  // apply to both modes, because a CLI error is a CLI error regardless of what is being graded; and
  // a workspace round that genuinely produces no deliverable still scores 0 through the oracle,
  // which is a real result rather than a broken instrument.
  if (requireTextDraft && out.length < 120) {
    throw new Error(
      `measure adapter returned only ${out.length} bytes: ${JSON.stringify(out.slice(0, 200))}\n` +
      `Too short to be a draft. Refusing to score it — see the turn-cap incident in the comment above.`
    );
  }
  return { text: out, cost };
}

/**
 * Fingerprint everything that decides what a fixture grades.
 *
 * A quality number describes a skill AND the instrument that measured it. Change the prompt or add
 * a contract row and the next number is not the previous number moved — it is a different
 * measurement wearing the same label. Without this, `--measure` overwrote `results[skill][model]`
 * and the old figure was simply gone, which would have made P1's own exit criterion ("both numbers
 * published side by side") impossible to meet by the act of running it.
 *
 * Hashes the fixture block plus the bytes of every seed and every declared `contract_files` entry,
 * so an edit to the oracle's rows changes the fingerprint even though no rubric field moved.
 * Missing files are hashed as a marker rather than skipped: a contract file that disappears is a
 * change to what is graded, and silently ignoring it would make the fingerprint stable across the
 * most disruptive edit of all.
 *
 * @param {object} rubric - Rubric conforming to day1-rubric.schema.json.
 * @param {string} [root=ROOT] - Repository root.
 * @returns {string} A 16-char fixture fingerprint.
 */
export function fixtureSha(rubric, root = ROOT) {
  const parts = [JSON.stringify(rubric.fixture ?? null)];
  const rels = [...(rubric.fixture?.seed || []).map((e) => seedEntry(e).from), ...(rubric.fixture?.contract_files || [])];
  for (const rel of rels) {
    const p = join(root, rel);
    // A seed may be a whole TREE, and a tree's fingerprint has to move when any file in it does —
    // otherwise adding a use case to a seeded spec changes what is graded while the fingerprint
    // says the two measurements are comparable, which is the one thing this function exists to stop.
    parts.push(`${rel}:${existsSync(p) ? (statSync(p).isDirectory() ? deliverableSha(p, ["."]) : sha256(readFileSync(p, "utf8"))) : "MISSING"}`);
  }
  return sha256(parts.join("\n")).slice(0, 16);
}

/**
 * Summarise how often a loop needed more than one round, with what that count can support.
 *
 * Condition 4 ("at least one run needed more than one round") is a threshold on a COUNT, so it is
 * as much a statement about `n` as about the skill. Reporting it as a bare yes/no is what let three
 * verdicts be published on a single revision in three runs. With zero observed revisions the exact
 * one-sided 95% upper bound is `1 - 0.05^(1/n)` — 63% at n=3, 26% at n=10 — which is the honest
 * ceiling claim: the rate is BELOW this, not zero.
 *
 * @param {Array<{rounds:number}>} perRun - Per-run records from a measurement.
 * @returns {({n:number, k:number, upper95:(number|null)}|null)} Counts and the bound, or null when
 *   there are no runs. `upper95` is null once k > 0, where the observed rate is the better figure.
 */
export function revisionRate(perRun) {
  const n = (perRun || []).length;
  if (!n) return null;
  const k = perRun.filter((x) => (x.rounds ?? 0) > 1).length;
  return { n, k, upper95: k === 0 ? 1 - Math.pow(0.05, 1 / n) : null };
}

/**
 * Decide how a previous measurement for one skill+model is retired by a new one.
 *
 * RETIRE, NEVER OVERWRITE. An existing number is not a stale value to be replaced — it is a valid
 * measurement, and the comparison between it and its successor is the entire deliverable of a
 * phase like P1.
 *
 * THIS USED TO RETIRE ONLY ON A FIXTURE CHANGE, and a same-fixture re-run overwrote in place
 * "which is what re-sampling should do". That was backwards, and one measurement pass proved it: a
 * `ba-pitch-analyzer` re-run against a BYTE-IDENTICAL fixture moved improved 1/3 -> 0/3 and took a
 * MET verdict with it. Every other retired pair in the baseline is confounded by an instrument
 * change and carries a warning not to subtract the two — the same-fixture pair is the ONLY
 * legitimately comparable one there is, because nothing moved but the sample. The old rule was
 * discarding precisely the evidence that shows what this instrument's noise floor is, and that
 * number survived only because the baseline happened to be committed before the re-run.
 *
 * EXPORTED so the rule itself is testable, not merely the shape of the records it writes. A guard
 * that only inspects existing records cannot see the rule being switched off — measured: reverting
 * the retirement branch left the whole structural suite green.
 *
 * @param {{prior:(object|undefined), fxSha:string, skill:string, model:string, measuredAt:string, fallbackMeasuredAt?:(string|null)}} o - The prior entry and the new run's identity.
 * @returns {(object|null)} The record to append to `superseded`, or null when there is nothing to retire.
 */
export function retireEntry({ prior, fxSha, skill, model, measuredAt, fallbackMeasuredAt = null }) {
  if (!prior) return null;
  const sameFixture = prior.fixture_sha === fxSha;
  return {
    skill, model,
    measured_at: prior.measured_at || fallbackMeasuredAt || null,
    fixture_sha: prior.fixture_sha || null,
    superseded_at: measuredAt,
    // The cause is load-bearing: these read identically once the row is gone and they mean
    // different things. `fixture-change` — the instrument moved under a still-valid measurement,
    // and a successor fingerprint exists to point at. `re-sample` — nothing moved but the draw, so
    // the successor fingerprint EQUALS this one and the pair is the only comparable one in the
    // file. (`model-policy` is written by hand: the number was correct and simply is not the model
    // this repo publishes, so there is no successor fixture to name at all.)
    cause: sameFixture ? "re-sample" : "fixture-change",
    superseded_by_fixture_sha: fxSha,
    reason: sameFixture
      ? `re-measured on the SAME fixture (fingerprint ${fxSha} unchanged), so nothing moved but the sample — unlike every fixture-change pair in this list these two numbers ARE directly comparable, and any difference between them is this instrument's own variance at n=${prior.n ?? "?"}`
      : `the fixture changed between runs (fingerprint ${prior.fixture_sha || "unrecorded"} -> ${fxSha}), so this number and the current one measure different instruments and must not be read as a before/after of the SKILL alone`,
    summary: { n: prior.n, v1_score: prior.v1_score, final_score: prior.final_score, delta: prior.delta, improved_runs: prior.improved_runs, approved_runs: prior.approved_runs, cost: prior.cost ?? null },
  };
}

/**
 * Remove a previous run's stored drafts for one skill+model, before a new run writes its own.
 *
 * Drafts are named `<skill>.<model-slug>.r<run>.v<round>.*`, so a shorter run does not overwrite a
 * longer previous one — five rounds followed by two leaves v3–v5 orphaned, and the directory then
 * reads as a single sample that never existed. This is not a hypothetical tidiness argument: an
 * abort on run 1 of P1 left two fresh drafts beside twelve stale ones, and the stale files were
 * analysed as the new measurement. The conclusion drawn from them was wrong, and nothing in the
 * directory said so — the files differ only by mtime.
 *
 * Scoped to one skill+model so a run never deletes another measurement's evidence, and safe to
 * call when the directory does not exist yet.
 *
 * @param {string} dir - The drafts directory.
 * @param {string} skill - Skill name.
 * @param {string} slug - Model slug, as used in draft filenames.
 * @returns {string[]} The filenames removed.
 */
export function clearPriorDrafts(dir, skill, slug) {
  if (!existsSync(dir)) return [];
  const prefix = `${skill}.${slug}.`;
  const stale = readdirSync(dir).filter((f) => f.startsWith(prefix));
  // `recursive` because a multi-path deliverable is stored as a DIRECTORY (`…v2.artifact/`). Without
  // it the stale tree survives the clear and the next run's shorter tree merges into it — the same
  // leftover-analysed-as-the-measurement failure this function exists to prevent, one level up.
  for (const f of stale) rmSync(join(dir, f), { recursive: true, force: true });
  return stale;
}

// ---- baseline ---------------------------------------------------------------

/**
 * Build the coverage block: which skills carry a Day-1 rubric and which do not.
 * The gap is written down as data rather than left as an absence, because 1-of-13 is itself the
 * most useful number this file currently holds.
 * @param {string} [root=ROOT] - Repository root.
 * @returns {{skills:Object<string,object>, with_rubric:number, total:number}} Coverage summary.
 */
export function coverage(root = ROOT) {
  const rubrics = new Map(loadRubrics(root).map((r) => [r.skill, r]));
  const skills = {};
  for (const s of listSkills(root)) {
    const r = rubrics.get(s);
    skills[s] = r
      ? { day1_rubric: "present", criteria: r.rubric.criteria.length, fixture: r.rubric.fixture.id }
      : { day1_rubric: "absent", criteria: 0, fixture: null };
  }
  return { skills, with_rubric: rubrics.size, total: Object.keys(skills).length };
}

/**
 * Tier 1 — the skills whose artifact an existing deterministic script already grades, so their
 * rubric is a delegation rather than a judgement. Authored here as a constant because it is a
 * SCOPE decision, not a fact derivable from disk: see docs/plan/day1-tier1-plan.md §0 for the
 * table that assigns each one its oracle, and §5 for why the other eight are excluded (six document
 * their own lack of ground truth; `tech-lead` produces a run rather than an artifact).
 * The honest ceiling for Day 1 is 6 of 13 — these five plus `translator` — never 13/13.
 */
export const TIER1_SKILLS = ["task-executor", "scope-architect", "solution-architect", "ba-pitch-analyzer", "spec-evaluator"];

/**
 * Render the committed Day-1 report from the committed baseline.
 *
 * The raw run records under `evals/runs/` are gitignored — they are the machine's run-trace, the
 * same split as `.shapeup/` vs `shapeup/` (ADR-0001). That makes this report the only thing a
 * teammate (or a later session) sees, so it is DERIVED from the baseline rather than written
 * alongside it: a hand-maintained summary of a measurement is a second place for the number to live
 * and a first place for it to go stale. Structural §48 asserts every baseline result appears here.
 *
 * @param {object} baseline - Parsed skill-loop baseline.
 * @returns {string} Markdown report.
 */
export function renderReport(baseline) {
  const b = baseline;
  const L = [];
  const results = b.results || {};
  const cov = b.coverage || { skills: {}, with_rubric: 0, total: 0 };
  const measuredSkills = Object.keys(results).sort();

  L.push("# Day 1 — what has been measured");
  L.push("");
  L.push("<!-- GENERATED by `node tools/skill-loop.mjs --report` from evals/baselines/skill-loop.baseline.json.");
  L.push("     Do not edit by hand: structural §48 regenerates and compares it. Change the baseline, not this file. -->");
  L.push("");
  L.push("*Graph Engineering* §VI.A, Table II — the rung exits on a **measured quality improvement**.");
  L.push("Raw run records and per-round drafts live in the gitignored `evals/runs/`; this file and the");
  L.push("baseline it derives from are what survive a clone.");
  L.push("");
  L.push(`- **Baseline status:** ${b.status || "unknown"}${b.measured_at ? ` (last run ${b.measured_at})` : ""}`);
  L.push(`- **Rubric coverage:** ${cov.with_rubric} of ${cov.total} skills instrumented — honest ceiling is **6 of 13** (5 Tier-1 + \`translator\`), never 13/13`);
  L.push(`- **Measured:** ${measuredSkills.length ? measuredSkills.join(", ") : "none"}`);
  if (b.models_measured?.length) L.push(`- **Models:** ${b.models_measured.join(", ")}`);
  L.push("");

  // ---- the results table ----------------------------------------------------
  L.push("## Results");
  L.push("");
  if (!measuredSkills.length) {
    L.push("No skill has been measured yet. `results: null` is the honest state — no number is written");
    L.push("until an authenticated `--measure` run produces one.");
  } else {
    L.push("A quality rate is model-dependent: each row describes the model it names and no other.");
    L.push("");
    L.push("| Skill | Model | n | v1 mean | final mean | delta | improved | approve | rounds | revised? | Day-1 met? |");
    L.push("|---|---|---|---:|---:|---:|---:|---:|---:|---|---|");
    for (const skill of measuredSkills) {
      for (const [model, r] of Object.entries(results[skill]).sort()) {
        const spread = (x) => (x && x.min !== x.max ? ` [${x.min}, ${x.max}]` : "");
        const approved = r.approved_runs ?? null;
        const met = approved !== null ? approved > r.n / 2 : (r.delta?.mean ?? 0) > 0;
        // CONDITION 4 of the plan's definition of done, made visible in the table rather than left
        // to a reader who knows to look for it. A skill can clear the exit criterion
        // (`final_score >= approve_at` in a majority of runs) while every run approves on the FIRST
        // draft — and that is a pass/fail check wearing a loop's clothes, not a measured quality
        // improvement. Both measured skills read "MET" in this column for weeks while neither had
        // ever executed a revision round.
        const rounds = (r.per_run || []).map((x) => x.rounds);
        const maxRounds = rounds.length ? Math.max(...rounds) : 0;
        const revised = maxRounds > 1;
        // A BARE "no" IS THE FLAW THAT PRODUCED THREE RETRACTED VERDICTS. Condition 4 is a
        // threshold on a COUNT OF RUNS, so its answer depends on `n` as much as on the skill, and
        // at n=3 an event with a true rate of 1/3 is missed 30% of the time. Two skills read MET on
        // a single revision in three runs; re-drawn, one held and one did not, and nothing in this
        // column said either verdict was a coin toss. So a `no` now carries what it is actually
        // entitled to claim — a one-sided 95% upper bound on the rate (exact binomial with zero
        // observations, 1 - 0.05^(1/n)) — and a `yes` carries the observed count rather than a
        // bare word. Neither is a new measurement; both are the arithmetic the old cell suppressed.
        const rate = revisionRate(r.per_run || []);
        L.push(
          `| \`${skill}\` | ${model} | ${r.n} | ${r.v1_score?.mean}${spread(r.v1_score)} | ` +
          `${r.final_score?.mean}${spread(r.final_score)} | ${r.delta?.mean >= 0 ? "+" : ""}${r.delta?.mean} | ` +
          `${r.improved_runs}/${r.n} | ${approved ?? "—"}/${r.n} | ` +
          `${rounds.length ? (Math.min(...rounds) === maxRounds ? String(maxRounds) : `${Math.min(...rounds)}–${maxRounds}`) : "—"} | ` +
          `${revised ? `**yes** (${rate.k}/${rate.n})` : rate && rate.upper95 !== null ? `no — 0/${rate.n}, rate ≤ ${Math.round(rate.upper95 * 100)}%` : "no"} | ` +
          `${met ? (revised ? "**MET**" : "exit criterion only") : "not met"} |`
        );
      }
    }
    L.push("");
    L.push("**`revised?` is condition 4** of the plan's definition of done: *at least one run needed more");
    L.push("than one round*. A `no` there means the loop approved the first draft every time — the exit");
    L.push("criterion is cleared but no quality **improvement** was measured, which is what Table II");
    L.push("actually asks for. Those rows say `exit criterion only`, never `MET`.");
    L.push("");
    L.push("**The percentage beside a `no` is what that `no` is entitled to claim.** Condition 4 is a");
    L.push("threshold on a count of runs, so its answer depends on `n` as much as on the skill: at");
    L.push("`n=3` a skill whose true revision rate is 1/3 shows no revision **30%** of the time. Three");
    L.push("`MET` verdicts in this file were once carried by a single revision in three runs, and");
    L.push("re-drawing them held one and dropped two. The figure is a one-sided 95% upper bound from");
    L.push("the exact binomial with zero observations — `rate ≤ 26%` at n=10 means the data rule out a");
    L.push("rate above 26%, **not** that the skill never revises. Only a larger `n` narrows it.");
  }
  L.push("");

  // ---- what the measuring cost ----------------------------------------------
  // In the report rather than only in the plan, and for the same reason every other number here is:
  // the plan's spend figures were scaled from a published price ratio, and a budget derived from a
  // ratio is an estimate wearing a measurement's clothes. A row appears only where a run actually
  // reported spend; "not reported" is printed rather than a zero or an omission.
  if (measuredSkills.length) {
    const rows = [];
    for (const skill of measuredSkills) {
      for (const [model, r] of Object.entries(results[skill]).sort()) {
        // A result with no `cost` block predates cost capture. It gets a row saying so rather than
        // being skipped: the whole point of this table is that the gap is visible, and a silently
        // absent row is indistinguishable from a skill nobody has measured.
        const c = r.cost || { usd_total: null, usd_per_run_mean: null, tokens_in: null, tokens_out: null, wall_clock_s_total: null, runs_reported: 0, runs: r.n };
        rows.push(
          `| \`${skill}\` | ${model} | ${r.n} | ` +
          `${c.usd_total === null ? "not reported" : `$${c.usd_total.toFixed(4)}`} | ` +
          `${c.usd_per_run_mean === null ? "—" : `$${c.usd_per_run_mean.toFixed(4)}`} | ` +
          `${c.tokens_in === null ? "—" : c.tokens_in.toLocaleString("en-US")} | ` +
          `${c.tokens_out === null ? "—" : c.tokens_out.toLocaleString("en-US")} | ` +
          `${c.wall_clock_s_total === null ? "—" : `${Math.round(c.wall_clock_s_total)}s`} | ` +
          `${c.runs_reported}/${c.runs} |`
        );
      }
    }
    if (rows.length) {
      L.push("## What the measuring cost");
      L.push("");
      L.push("Measured spend, from the CLI's own `total_cost_usd` per session — not a token count");
      L.push("multiplied by a price table this repo would have to keep current. Runs recorded before");
      L.push("cost capture landed show **not reported**, which is what they are: `null`, not zero.");
      L.push("");
      L.push("| Skill | Model | n | total | per run | tokens in | tokens out | wall clock | runs costed |");
      L.push("|---|---|---:|---:|---:|---:|---:|---:|---:|");
      L.push(...rows);
      L.push("");
      L.push("`tokens in` counts UNCACHED input only, and it is the smallest and least stable of the");
      L.push("four figures — one-turn probes recorded 2 to 531 uncached input tokens against 15k–25k");
      L.push("cache-creation and 18k–25k cache-read tokens. The volume is in the cache fields, which");
      L.push("are recorded in the baseline and are already priced into the total. That cache traffic is");
      L.push("the session preamble and it is a per-ROUND floor, so a five-round loop pays it five times");
      L.push("and short rounds cost far more than their draft length suggests: on `claude-sonnet-5` a");
      L.push("round that replies only `ok` measured **$0.098**, which is roughly a third of what a full");
      L.push("`task-executor` round costs. Most of a cheap round is the preamble, not the work.");
      L.push("");
    }
  }

  // ---- caveats, verbatim from the baseline ----------------------------------
  // Carried whole rather than summarised. Every one of these was written because a number had
  // already been misread once, and a caveat that travels separately from its number does not travel.
  const notes = b.per_skill_notes || {};
  if (Object.keys(notes).length) {
    L.push("## Read each number with its caveat");
    L.push("");
    for (const skill of Object.keys(notes).sort()) {
      L.push(`### \`${skill}\``);
      L.push("");
      for (const n of notes[skill]) L.push(`- ${n}`);
      L.push("");
    }
  }
  if (b.limitations?.length) {
    L.push("## Limitations of the instrument");
    L.push("");
    for (const n of b.limitations) L.push(`- ${n}`);
    L.push("");
  }
  // SUPERSEDED is not WITHDRAWN, and collapsing the two would lose the distinction that matters.
  // A withdrawn number was never valid. A superseded one was measured correctly and then had its
  // instrument changed underneath it — so it stays readable, beside the number that replaced it,
  // with the fingerprints that prove they are not a before/after of the same thing.
  if (b.superseded?.length) {
    L.push("## Retired measurements");
    L.push("");
    L.push("These were measured **correctly**. What changed was the instrument, the sample, or the");
    L.push("publishing policy — not the finding — so they are kept beside the current numbers rather");
    L.push("than replaced by them. Three causes, and they mean different things:");
    L.push("");
    L.push("- **fixture-change** — the prompt, seeded spec or oracle contract moved underneath a valid");
    L.push("  measurement. The successor fingerprint is named. The two numbers are **not** a");
    L.push("  before/after of the skill and must not be subtracted.");
    L.push("- **re-sample** — the SAME fixture was measured again. Nothing moved but the draw, so this");
    L.push("  is the one kind of pair here that **is** directly comparable, and the difference between");
    L.push("  the two is this instrument's own variance rather than anything about the skill. Read");
    L.push("  these first: they are the only rows that say what a published `n=3` figure is worth.");
    L.push("- **model-policy** — the number was right and is simply no longer the model this repo");
    L.push("  publishes. No fixture changed, so no successor fingerprint exists to name.");
    L.push("");
    for (const s of b.superseded) {
      const q = s.summary || {};
      const cause = s.cause || "fixture-change";
      L.push(
        `- **\`${s.skill}\` / ${s.model}** (${s.measured_at || "date unrecorded"}, fixture \`${s.fixture_sha || "unrecorded"}\`) — ` +
        `n=${q.n ?? "?"}, v1 ${q.v1_score?.mean ?? "?"} → final ${q.final_score?.mean ?? "?"}, ` +
        `delta ${q.delta?.mean ?? "?"}, approve ${q.approved_runs ?? "?"}/${q.n ?? "?"}.`
      );
      L.push(
        `  <br/>Retired ${s.superseded_at} (**${cause}**` +
        `${cause === "fixture-change" ? `, superseded by fixture \`${s.superseded_by_fixture_sha}\`` : ""}): ${s.reason}`
      );
    }
    L.push("");
  }
  if (b.withdrawn?.length) {
    L.push("## Withdrawn measurements");
    L.push("");
    L.push("Kept rather than deleted: a number that was published and retracted is evidence about the");
    L.push("instrument, and removing it silently is how a fabricated baseline survives.");
    L.push("");
    for (const w of b.withdrawn) {
      L.push(`- **${w.skill || "—"} / ${w.model}** (${w.measured_at}) — reported ${JSON.stringify(w.reported)}.`);
      L.push(`  <br/>Withdrawn: ${w.reason}`);
    }
    L.push("");
  }

  // ---- what is left, derived ------------------------------------------------
  L.push("## What remains");
  L.push("");
  const noRubric = TIER1_SKILLS.filter((s) => cov.skills?.[s]?.day1_rubric !== "present");
  const unmeasured = TIER1_SKILLS.filter((s) => cov.skills?.[s]?.day1_rubric === "present" && !results[s]);
  const ceilinged = measuredSkills.filter((s) =>
    Object.values(results[s]).some((r) => (r.per_run || []).every((x) => x.rounds === 1)));
  L.push(`Tier 1 is ${TIER1_SKILLS.length} skills (\`${TIER1_SKILLS.join("`, `")}\`).`);
  L.push("");
  L.push(`| Item | Skills | State |`);
  L.push(`|---|---|---|`);
  L.push(`| No rubric yet | ${noRubric.length ? "`" + noRubric.join("`, `") + "`" : "—"} | ${noRubric.length} of ${TIER1_SKILLS.length} Tier-1 skills unbuilt |`);
  L.push(`| Rubric built, never measured | ${unmeasured.length ? "`" + unmeasured.join("`, `") + "`" : "—"} | needs an authenticated \`--measure\` |`);
  // "in the SAMPLE THAT IS PUBLISHED", never "never" — the row is derived from the live results
  // only, and two of these skills DID revise in an earlier measurement that has since been
  // superseded or re-sampled. Writing "never" makes this table contradict the superseded records
  // sitting a few sections below it, and the weaker claim is the true one.
  L.push(`| Measured but **ceilinged** — approved on the first draft in every run of the published sample | ${ceilinged.length ? "`" + ceilinged.join("`, `") + "`" : "—"} | a harder fixture, a larger \`n\`, or an honest ceiling — see each skill's notes |`);
  L.push("");
  L.push("A skill counts as done for this rung when its loop **revises** — a first draft below the bar,");
  L.push("a revision round that acts on criterion-level defects, and a final score that clears it. A");
  L.push("rubric that approves round 1 every time is a pass/fail check wearing a loop's clothes.");
  L.push("");
  if (b.method) {
    L.push("## Method");
    L.push("");
    L.push(b.method);
    L.push("");
  }
  if (b.adapter) L.push(`**Adapter:** ${b.adapter}`);
  if (b.measure_command) L.push(`\n**Reproduce:** \`${b.measure_command}\``);
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function writeBaseline(patch) {
  const prev = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
  const next = { ...prev, ...patch, coverage: coverage() };
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/**
 * Reduce N independent loop records for one skill into the summary a baseline can carry.
 *
 * N matters. One loop is one draw from a stochastic process, and Day 1's exit criterion —
 * "measured quality improvement" — is a claim about the process, not about the draw. So the
 * summary reports spread alongside the mean, and `improved_runs` counts how many of the N actually
 * moved: a mean delta of +0.2 built from one run at +0.6 and two at 0.0 is a different finding from
 * three runs at +0.2, and Table III's "average success hides catastrophic cases" is the warning
 * about reporting only the first number.
 *
 * @param {object[]} runs - Loop records from runLoop(), all for the same skill and fixture.
 * @returns {object} Aggregate summary: per-metric mean/min/max, improvement count, stop-reason
 *   histogram, and the per-run scores so the spread is auditable rather than asserted.
 */
export function aggregate(runs) {
  const stat = (xs) => ({
    mean: round3(xs.reduce((a, b) => a + b, 0) / xs.length),
    min: round3(Math.min(...xs)),
    max: round3(Math.max(...xs)),
  });
  const stops = {};
  for (const r of runs) stops[r.stopped.reason] = (stops[r.stopped.reason] || 0) + 1;
  return {
    n: runs.length,
    v1_score: stat(runs.map((r) => r.quality.v1_score)),
    final_score: stat(runs.map((r) => r.quality.final_score)),
    delta: stat(runs.map((r) => r.quality.delta)),
    improved_runs: runs.filter((r) => r.quality.improved).length,
    // The primary signal: how many runs cleared the bar. `stopped === "approve"` is exactly that,
    // since the loop only stops early when the score reaches approve_at.
    approved_runs: runs.filter((r) => r.stopped.reason === "approve").length,
    stopped: stops,
    // What the measurement itself cost. Reported at the same level as the quality figures because
    // the plan that schedules these runs budgets in dollars, and until P0 that budget was derived
    // from a published price ratio rather than from any run — an estimate scaled from an estimate.
    // Same null-not-zero rule as totalCost(): if any run's spend is unknown, the total is withheld.
    cost: costSummary(runs),
    per_run: runs.map((r, i) => ({
      run: i + 1,
      v1: r.quality.v1_score,
      final: r.quality.final_score,
      delta: r.quality.delta,
      rounds: r.reviews.length,
      stopped: r.stopped.reason,
      usd: Number.isFinite(r.cost?.usd) ? r.cost.usd : null,
      wall_clock_s: r.cost?.wall_clock_s ?? null,
    })),
  };
}

/**
 * Roll per-run costs into a sample-level spend figure.
 *
 * @param {Array<object>} runs - Completed loop records.
 * @returns {{usd_total:(number|null), usd_per_run_mean:(number|null), tokens_in:(number|null),
 *   tokens_out:(number|null), cache_read_tokens:(number|null), cache_creation_tokens:(number|null),
 *   wall_clock_s_total:(number|null), runs_reported:number, runs:number, source:string}} Spend.
 */
export function costSummary(runs) {
  const costs = runs.map((r) => r.cost || null);
  const known = costs.filter((c) => c && c.source === "cli-json" && Number.isFinite(c.usd));
  const complete = costs.length > 0 && known.length === costs.length;
  const sum = (k) => known.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const walls = costs.map((c) => c?.wall_clock_s).filter(Number.isFinite);
  return {
    usd_total: complete ? round4(sum("usd")) : null,
    usd_per_run_mean: complete ? round4(sum("usd") / known.length) : null,
    tokens_in: complete ? sum("tokens_in") : null,
    tokens_out: complete ? sum("tokens_out") : null,
    cache_read_tokens: complete ? sum("cache_read_tokens") : null,
    cache_creation_tokens: complete ? sum("cache_creation_tokens") : null,
    // Wall clock has always been captured, so it totals independently of whether spend was.
    wall_clock_s_total: walls.length === costs.length && walls.length ? round3(walls.reduce((a, b) => a + b, 0)) : null,
    runs_reported: known.length,
    runs: costs.length,
    source: complete ? "cli-json" : known.length ? "partial" : "unavailable",
  };
}

// ---- CLI --------------------------------------------------------------------

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };

  if (argv.includes("--selftest")) {
    const rubrics = loadRubrics();
    if (rubrics.length === 0) { console.error("no Day-1 rubrics found (skills/*/evals/day1-rubric.json)"); process.exit(1); }
    let failed = 0;
    mkdirSync(RUNS_DIR, { recursive: true });
    for (const entry of rubrics) {
      const r = selftest(entry);
      const mark = r.pass ? "✅" : "❌";
      console.log(`${mark} ${r.skill}: weak ${r.weak} → strong ${r.strong} (separation ${r.separation})`);
      for (const e of r.errors) { console.error(`   ✗ ${e}`); failed++; }
      if (r.loop) writeFileSync(join(RUNS_DIR, `${r.skill}.selftest.json`), JSON.stringify(r.loop, null, 2) + "\n");
    }
    console.log(failed === 0 ? `\nrubrics discriminate (${rubrics.length} checked)` : `\n${failed} selftest failure(s)`);
    process.exit(failed === 0 ? 0 : 1);
  }

  if (argv.includes("--measure")) {
    const skill = flag("--skill");
    const model = flag("--model") || process.env.SKILL_LOOP_MODEL;
    if (!skill) { console.error("--measure requires --skill <name>"); process.exit(2); }
    if (!model) {
      console.error("--measure requires an explicit --model. Trigger and quality rates are MODEL-DEPENDENT;\nan unlabeled number is not a measurement of anything (see evals/README.md).");
      process.exit(2);
    }
    const entry = loadRubrics().find((r) => r.skill === skill);
    if (!entry) { console.error(`no Day-1 rubric for skill "${skill}"`); process.exit(2); }
    const { rubric } = entry;
    const repeat = Math.max(1, parseInt(flag("--repeat") || "3", 10));
    // 50, not 12. A trigger-eval measures ACTIVATION and caps at 8; a Day-1 loop measures the
    // finished artifact, so the session must read the spec, run the build, probe every declared
    // Test-Surface row and write a verdict. At 12 the CLI returned `Error: Reached max turns` on
    // every round of two paid runs. The cap is part of the recorded method for exactly this reason.
    const maxTurns = Math.max(1, parseInt(flag("--max-turns") || "50", 10));

    // Model-scope every output path. Two runs of the same skill on different models are two
    // measurements, not one overwritten twice — and the baseline carries a single top-level `model`,
    // so unscoped writes would leave a merged result labelled with whichever finished last.
    const slug = model.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const DRAFTS = join(RUNS_DIR, "drafts");
    mkdirSync(DRAFTS, { recursive: true });
    // Clear this skill+model's prior drafts before writing new ones. A shorter run leaves the
    // longer previous run's tail behind (5 rounds then 2 leaves v3–v5 orphaned), and the mixed
    // directory reads as one sample. That is not hypothetical: an abort on run 1 of this very
    // phase left two new drafts beside twelve old ones, and the stale files were analysed as if
    // they were the new measurement — a wrong conclusion drawn from the instrument's own leftovers.
    // The records these belonged to are gitignored run-trace and already superseded.
    const cleared = clearPriorDrafts(DRAFTS, skill, slug);
    if (cleared.length) console.log(`cleared ${cleared.length} draft(s) from a previous ${skill}/${model} run`);
    const runs = [];
    const mctx = {};
    for (let i = 1; i <= repeat; i++) {
      const t0 = Date.now();
      let loop;
      try {
        loop = runLoop({
          skill, rubric, mode: "measure", model, ctx: mctx,
          persist: (round, text) => {
            const p = join(DRAFTS, `${skill}.${slug}.r${i}.v${round}.md`);
            writeFileSync(p, text);
            return p.replace(ROOT + "/", "");
          },
          gen: (round, prior, changes) => {
            // A workspace-graded skill's draft is the DIRECTORY, so `prior` (the model's transcript)
            // is not the artifact and re-prompting with it revises the wrong thing. Carry the
            // deliverable itself forward instead — see the block below for why.
            const ws = rubric.grades === "workspace";
            const dpaths = deliverablePaths(rubric);
            const dnames = dpaths.map((p) => `\`${p}\``).join(" and ");
            const prompt = round === 1
              ? rubric.fixture.prompt
              : ws
              ? `${rubric.fixture.prompt}\n\nA previous attempt at ${dnames} is ALREADY PRESENT in this directory and is mostly working. Read it first. The evaluation contract was run against it and reported:\n${changes.map((c) => `- ${c}`).join("\n")}\n\nEdit ${dnames} in place to fix ONLY the failing rows. Do not rewrite from scratch, and do not change anything the passing rows depend on. Write no files outside ${dnames}.`
              // "Output the COMPLETE report" is load-bearing. Without it the model treats a revision
              // round as a conversation turn and replies with a plan or a question — round 3 of a
              // paid run came back as "Once approved, I'll: 1. Run…", which is a sensible thing to
              // say and an unscoreable artifact, so a 0.571 first draft revised to 0. The loop
              // grades artifacts; every round must therefore return a whole one.
              // It must NOT say "do not ask for permission" — a model that cannot probe should say
              // so in the report, not invent the observation it was unable to make.
              : `${rubric.fixture.prompt}\n\nYour previous answer did not meet these criteria. Revise it, addressing each:\n${changes.map((c) => `- ${c}`).join("\n")}\n\nOutput the COMPLETE revised evaluation report as your entire response — not a summary of what changed, not a plan. If a probe cannot be run, state that plainly inside the report rather than reporting a result you did not observe.\n\nPrevious answer:\n${prior}`;
            // A workspace-graded skill writes a DIRECTORY, so build one per round and run the model
            // inside it. The directory is fresh — the oracle EXECUTES what it finds and must not
            // grade another round's leftovers — but the DELIVERABLE is carried forward from the
            // previous round.
            //
            // It used to be dropped, and that was the bug: round N+1 got a text list of failing rows
            // and an empty directory, so the only thing it could do was write the CLI again from
            // nothing. Measured over three paid runs, fifteen rounds: not one revision. Run 1 traded
            // E4 for E1+E5 on a re-roll; runs 2 and 3 reproduced the same 4-of-5 four more times
            // each. That is a re-sampling loop wearing a revision loop's clothes.
            //
            // Nor does dropping it match production, which was the original defence. A retried
            // task-executor is a zero-MEMORY subagent, not a zero-CONTEXT one: the previous
            // attempt's code is sitting in the repo when the retry order arrives, and P3 tells it to
            // read the substrate first. Carrying one file forward is what makes this loop the
            // instrument of the loop already running, per day1-tier1-plan.md §3.1.
            if (!ws) {
              const g = generateWithClaude(prompt, model, maxTurns, ROOT);
              return { text: g.text, cost: g.cost, source: "model", path: null };
            }
            const { cwd, carried_forward } = roundWorkspace(rubric, round > 1 ? mctx.workspace : null);
            mctx.workspace = cwd;
            const { text, cost } = generateWithClaude(prompt, model, maxTurns, cwd, false);
            // "Store every artifact" (§VI.A) means the CODE, not only the transcript about it. A
            // low score whose deliverable was thrown away is undiagnosable without paying again.
            // A multi-path deliverable is stored as a DIRECTORY under the same naming scheme, so
            // clearPriorDrafts still finds it and one round's tree never merges into another's.
            const paths = deliverablePaths(rubric);
            const present = paths.filter((p) => existsSync(join(cwd, p)));
            let codePath = null;
            const artifactSha = deliverableSha(cwd, paths);
            if (present.length) {
              const single = paths.length === 1 && !statSync(join(cwd, paths[0])).isDirectory();
              codePath = join(DRAFTS, `${skill}.${slug}.r${i}.v${round}.${single ? basename(paths[0]) : "artifact"}`);
              rmSync(codePath, { recursive: true, force: true });
              for (const p of present) copyInto(join(cwd, p), single ? codePath : join(codePath, p));
            }
            return {
              text, cost, source: "model", path: null, carried_forward,
              artifact: codePath ? codePath.replace(ROOT + "/", "") : null,
              artifact_sha: artifactSha,
            };
          },
        });
      } catch (e) {
        // The broken-harness trap: abort the WHOLE run and write nothing. Keeping the completed
        // iterations would publish a mean over a sample that stopped for a reason unrelated to
        // quality — which is how the first trigger-eval baselines fabricated a low number.
        console.error(`ABORT on run ${i}/${repeat} — ${e.message}`);
        console.error("Nothing was written. Fix the adapter and re-run; a partial sample is not a smaller sample.");
        // Nothing is written, but money WAS spent — by the runs that completed before the abort and
        // by the failed round itself. Reporting zero here, or reporting nothing, is how a re-run
        // budget gets set from a spend that never appeared anywhere.
        const spent = runs.map((l) => l.cost?.usd).filter(Number.isFinite).reduce((a, b) => a + b, 0);
        if (runs.length) console.error(`Spent on the ${runs.length} completed run(s) before this abort: $${spent.toFixed(4)} (the failed round's own spend is in the message above).`);
        process.exit(3);
      }
      loop.cost.wall_clock_s = round3((Date.now() - t0) / 1000);
      writeFileSync(join(RUNS_DIR, `${skill}.${slug}.measure.r${i}.json`), JSON.stringify(loop, null, 2) + "\n");
      runs.push(loop);
      console.log(`  run ${i}/${repeat}: v1 ${loop.quality.v1_score} → final ${loop.quality.final_score} (delta ${loop.quality.delta}, ${loop.reviews.length} round(s), stopped: ${loop.stopped.reason})`);
    }

    const summary = aggregate(runs);
    const prev = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};

    // An overridden adapter may not silently mint a measured baseline. SKILL_LOOP_CMD exists for two
    // legitimate reasons — a different CLI, and proving this pipeline works without spending — and
    // the second one produced a green "MET" from a shell script that just cats two fixture files.
    // No structural check can tell a stub from a model, so the refusal has to live here, at the only
    // point that knows an override was in play.
    const overridden = Boolean(process.env.SKILL_LOOP_CMD);
    const allowOverride = argv.includes("--allow-override-baseline");
    if (overridden && !allowOverride) {
      mkdirSync(RUNS_DIR, { recursive: true });
      writeFileSync(join(RUNS_DIR, `${skill}.override-summary.json`), JSON.stringify({ adapter: "SKILL_LOOP_CMD", model, summary }, null, 2) + "\n");
      console.log(`\n${skill} — n=${summary.n} (SKILL_LOOP_CMD override)`);
      console.log(`  delta mean ${summary.delta.mean}, improved in ${summary.improved_runs}/${summary.n} runs`);
      console.error(`\nBaseline NOT written: the adapter was overridden by SKILL_LOOP_CMD, so this run does not\nmeasure the skill through its real invocation path. Records are in evals/runs/.\nIf your CLI genuinely differs and this WAS a real model, re-run with --allow-override-baseline.`);
      process.exit(0);
    }

    const measuredAt = new Date().toISOString();
    const prevResults = prev.results || {};
    const fxSha = fixtureSha(rubric);

    const superseded = [...(prev.superseded || [])];
    const retired = retireEntry({ prior: prevResults[skill]?.[model], fxSha, skill, model, measuredAt, fallbackMeasuredAt: prev.measured_at });
    if (retired) {
      superseded.push(retired);
      console.log(retired.cause === "re-sample"
        ? `\nre-sampled: the previous ${skill}/${model} result was measured on the SAME fixture ${fxSha} — it is retained under \`superseded\` as cause \`re-sample\`, because the pair measures this instrument's variance.`
        : `\nsuperseded: the previous ${skill}/${model} result was measured on fixture ${retired.fixture_sha || "(unrecorded)"}, this run is ${fxSha} — the old number is retained under \`superseded\`, not overwritten.`);
    }

    const written = writeBaseline({
      superseded,
      status: "measured",
      models_measured: [...new Set([...(prev.models_measured || []), model])].sort(),
      adapter: overridden ? "SKILL_LOOP_CMD override (--allow-override-baseline)" : "default: claude --plugin-dir <root> -p <prompt>",
      method: `tools/skill-loop.mjs --measure (reflective_task per Graph Engineering §VI.A): round 1 is the skill's first draft, each later round re-prompts with the criterion-level failures from the rubric's DETERMINISTIC head; stopping rule = score >= ${rubric.stopping_rule.approve_at} or ${rubric.stopping_rule.max_rounds} rounds. Each round is one headless session at --max-turns ${maxTurns}, granted Read/Write/Edit/Glob/Grep/Bash — the shell is part of the measured configuration because task-executor uses one to run its own T0 probes in production, and a session denied it aborts rather than producing a number. n=${repeat} independent loops per skill.${rubric.grades === "workspace" ? ` The graded artifact is the DELIVERABLE FILE, not the transcript, and each revision round starts from the previous round's deliverable in a fresh directory — so a round edits one artifact rather than re-drawing it. Runs before 2026-08-04 did NOT carry it forward and are re-sampling, not revision; they are not comparable on delta.` : ""}${rubric.criteria.some((c) => c.detector.rows) ? ` Oracle criteria are scored per ROW (fraction of contract rows passing), not all-or-nothing; \`satisfied\` still requires every row, so approve_at is unchanged in meaning. Runs before 2026-08-04 scored these criteria binary and recorded 0.0 for any artifact short of perfect.` : ""} Quality rates are MODEL-DEPENDENT — this baseline describes the model named below and no other. Scored by regex detectors, NOT by a model judge: anchor-shaped criteria generalize, phrase-shaped ones are brittle against paraphrase (see docs/plan/day1-day2-measurement.md §5).`,
      model,
      measured_at: measuredAt,
      // Keyed skill -> model. Each entry carries its OWN model and timestamp, because the
      // top-level fields can only ever describe the most recent run, and a quality rate read
      // against the wrong model name is not a measurement of anything.
      results: {
        ...prevResults,
        [skill]: { ...(prevResults[skill] || {}), [model]: { ...summary, model, measured_at: measuredAt, fixture_sha: fxSha } },
      },
    });

    // Regenerated with the baseline, not left to a follow-up command. The run records that back this
    // number are gitignored, so the report IS the surviving evidence — and evidence that has to be
    // remembered separately is evidence that eventually is not.
    writeFileSync(REPORT, renderReport(written));

    console.log(`\n${skill} — n=${summary.n}`);
    console.log(`  v1    mean ${summary.v1_score.mean}  [${summary.v1_score.min}, ${summary.v1_score.max}]`);
    console.log(`  final mean ${summary.final_score.mean}  [${summary.final_score.min}, ${summary.final_score.max}]`);
    console.log(`  delta mean ${summary.delta.mean}  [${summary.delta.min}, ${summary.delta.max}]`);
    console.log(`  improved in ${summary.improved_runs}/${summary.n} runs`);
    // EXIT CRITERION: reaching the bar, not moving. The paper's Table II wording is "measured
    // quality improvement", and a literal delta>0 reading was measured to be perverse: a run whose
    // FIRST draft scored 1.0 and stopped at `approve` in one round records delta 0 and is counted
    // as "did not improve". The criterion rewarded a skill that starts bad and punished one that is
    // already right. What the rung is actually for is a loop whose output clears an explicit bar, so
    // that is what is reported; delta stays as the headroom diagnostic beside it.
    const approved = summary.approved_runs ?? null;
    const met = approved !== null ? approved > summary.n / 2 : summary.delta.mean > 0;
    console.log(`  reached approve (>= ${rubric.stopping_rule.approve_at}) in ${approved}/${summary.n} runs`);
    const cs = summary.cost;
    console.log(
      `  spend ${cs.usd_total === null ? `NOT REPORTED (${cs.runs_reported}/${cs.runs} runs costed)` : `$${cs.usd_total.toFixed(4)} total, $${cs.usd_per_run_mean.toFixed(4)}/run`}` +
      `${cs.tokens_in === null ? "" : ` — ${cs.tokens_in.toLocaleString("en-US")} in / ${cs.tokens_out.toLocaleString("en-US")} out (+${cs.cache_read_tokens.toLocaleString("en-US")} cache read)`}`
    );
    console.log(`\nDay-1 exit criterion (final score clears the bar): ${met ? "MET" : "NOT met"}`);
    console.log(`  secondary — delta (headroom, not the criterion): mean ${summary.delta.mean}, improved ${summary.improved_runs}/${summary.n}`);
    console.log(`baseline: ${BASELINE.replace(ROOT + "/", "")} (now status: measured)`);
    process.exit(0);
  }

  if (argv.includes("--report")) {
    if (!existsSync(BASELINE)) { console.error(`no baseline at ${BASELINE.replace(ROOT + "/", "")} — run \`node tools/skill-loop.mjs\` first`); process.exit(2); }
    const b = writeBaseline({});   // refresh coverage from disk before deriving
    writeFileSync(REPORT, renderReport(b));
    console.log(`wrote ${REPORT.replace(ROOT + "/", "")} (derived from ${BASELINE.replace(ROOT + "/", "")})`);
    process.exit(0);
  }

  // Default: inventory.
  const cov = coverage();
  const b = writeBaseline({});
  console.log(`Day-1 rubric coverage: ${cov.with_rubric}/${cov.total} skills`);
  for (const [s, v] of Object.entries(cov.skills)) {
    console.log(`  ${v.day1_rubric === "present" ? "✓" : "·"} ${s.padEnd(20)} ${v.day1_rubric}${v.criteria ? ` (${v.criteria} criteria)` : ""}`);
  }
  console.log(`\nbaseline status: ${b.status} — ${BASELINE.replace(ROOT + "/", "")}`);
}
