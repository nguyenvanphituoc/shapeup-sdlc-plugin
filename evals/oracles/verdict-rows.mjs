#!/usr/bin/env node
// Row renderer for a JUDGE — REPO-ONLY dev/CI asset, zero spend.
//
// WHAT MAKES THIS DIFFERENT FROM THE OTHER FOUR TIER-1 RUBRICS, and it is the whole of P5.
//
// `spec-evaluator` is the one Tier-1 skill whose artifact is not itself checkable by a lint: its
// output is a VERDICT, and a verdict is right or wrong only relative to what the build actually
// does. So its rubric was nine hand-authored criteria — and that authorship was the source of every
// problem the pilot had (a rubric derived from the skill's own contract measures contract
// conformance, ceilings at 1.0, and swung the same skill's score 8x on what the author chose to
// look at).
//
// There IS an oracle that can answer here; it just answers a different question. The `process`
// oracle knows the GROUND TRUTH about the build — which Test-Surface rows really pass and which
// really fail. So this adapter runs it, then reads the evaluator's WorkResult envelope, and grades
// AGREEMENT: one row per Test-Surface row, passing when the judge's verdict for that row matches
// what the build actually does. Nobody authored those rows; the contract did. A judge that reports
// PASS on a row the oracle fails is wrong, and a judge that reports FAIL on a row the oracle passes
// is wrong in the other direction — false-FAIL is graded exactly as hard as false-PASS, which nine
// must/must_not criteria written around one known planted bug could never do.
//
// THREE ROWS REMAIN AUTHORED, and each cites the line of SKILL.md it comes from:
//   * JV-REFUTED    — the refuted[] list must name the ticked boxes the evidence disproves.
//   * JV-ESCALATED  — the spec carries a question it does not answer; the contract says raise it,
//                     not decide it. This is the row with real headroom: choosing an answer and
//                     grading against it is the confident-wrong move, and it looks like diligence.
//   * JV-NO-CLOSURE — the judge never sets a task status to done. Role separation.
// Nine authored criteria down to three, with the other N delegated to a script that was written
// before this measurement existed.
//
// Usage:  node evals/oracles/verdict-rows.mjs --contract <contract.json> --cmd "<run cmd>" \
//               --result <work-result.json> [--require-escalate]
// Exit:   0 = every row passed · 1 = at least one failed · 2 = usage/contract error.

import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { runContract } from "../../oracles/process-oracle.mjs";
import { runFixtures } from "../../skills/tech-lead/scripts/t0-verify.mjs";

/**
 * Pull the last well-formed top-level JSON object out of a transcript.
 *
 * The same extraction the loop's `work-result` head performs, duplicated here rather than imported
 * because this script must stay runnable on its own against a saved draft. A judge that wraps its
 * envelope in prose has still returned the envelope.
 * @param {string} text - Raw draft text.
 * @returns {object|null} The parsed envelope, or null when the draft carries none.
 */
export function extractEnvelope(text) {
  // LARGEST balanced object, never the first found — the same rule tools/skill-loop.mjs's
  // extractJSON follows and for the same measured reason: scanning inward-first returns a nested
  // member (`bugs[0]` parses perfectly well on its own), after which every field lookup misses
  // against a fragment and the result reads exactly like a skill that returned nothing.
  let best = null, bestLen = 0;
  for (let s = 0; s < text.length; s++) {
    if (text[s] !== "{") continue;
    if (text.length - s <= bestLen) break;
    let depth = 0, inStr = false, esc = false;
    for (let i = s; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        const span = text.slice(s, i + 1);
        if (span.length > bestLen) {
          try { const o = JSON.parse(span); if (o && typeof o === "object" && !Array.isArray(o)) { best = o; bestLen = span.length; } }
          catch { /* keep scanning */ }
        }
        break;
      }
    }
  }
  return best;
}

/**
 * Find the judge's verdict for one Test-Surface row, however it named the row.
 *
 * Anchor-shaped, not phrase-shaped: the row id (`TS-06`) and the AC id the spec pairs with it are
 * both accepted, because the skill's own output format defines those anchors while the wording
 * around them is free. A judge that grades "AC6" has graded TS-06.
 * @param {object} env - The WorkResult envelope.
 * @param {string} id - The Test-Surface row id.
 * @param {string} desc - The row's description, used to recover the AC id it names.
 * @returns {{verdict:(string|null), evidence:string}} The judge's verdict for that row, or null.
 */
export function verdictFor(env, id, desc) {
  const rows = (env?.verdict?.criteria || []).filter((c) => c && typeof c === "object");
  const ac = (desc.match(/\bAC-?\d+\b/i) || [])[0];
  const num = id.replace(/^TS-?0*/i, "");
  const re = new RegExp(`\\bTS-?0*${num}\\b${ac ? `|\\b${ac.replace("-", "-?")}\\b` : ""}`, "i");
  const hit = rows.find((c) => re.test(String(c.criterion ?? "")) || re.test(String(c.id ?? "")));
  if (!hit) return { verdict: null, evidence: "" };
  return { verdict: String(hit.verdict ?? "").toUpperCase(), evidence: String(hit.evidence ?? "") };
}

/**
 * Grade a judge's envelope against what the build actually does.
 * @param {{contract:string, cmd:string, env:(object|null), requireEscalate:boolean}} opts - The
 *   ground-truth contract path, the command that runs the build, the parsed envelope, and whether
 *   the fixture carries an unresolved spec question.
 * @returns {Array<{id:string, pass:boolean, label:string}>} One row per assertion.
 */
export function judgeRows({ contract, cmd, env, requireEscalate }) {
  const spec = JSON.parse(readFileSync(contract, "utf8"));
  const truth = runContract({ cmd, criteria: spec.criteria });
  const rows = [];
  if (!env) {
    // No envelope at all is not "every row wrong" — it is an artifact that was never produced, and
    // the difference matters for the same reason the lint profiles fail rather than pass on an
    // empty directory.
    for (const c of spec.criteria) rows.push({ id: `JV-${c.id}`, pass: false, label: `the draft carried no WorkResult envelope, so ${c.id} was never graded` });
    rows.push({ id: "JV-OVERALL", pass: false, label: "the draft carried no WorkResult envelope — output the envelope itself, not a description of it" });
    rows.push({ id: "JV-REFUTED", pass: false, label: "the draft carried no WorkResult envelope" });
    if (requireEscalate) rows.push({ id: "JV-ESCALATED", pass: false, label: "the draft carried no WorkResult envelope" });
    rows.push({ id: "JV-REPRO", pass: false, label: "the draft carried no WorkResult envelope" });
    rows.push({ id: "JV-NO-CLOSURE", pass: false, label: "the draft carried no WorkResult envelope" });
    return rows;
  }

  // ---- delegated: one row per Test-Surface row, graded on AGREEMENT with the build -----------
  for (const t of truth.results) {
    const want = t.pass ? "PASS" : "FAIL";
    const { verdict, evidence } = verdictFor(env, t.id, t.desc || "");
    const agree = verdict === want;
    rows.push({
      id: `JV-${t.id}`,
      pass: agree,
      label: verdict === null
        ? `${t.id} was not graded at all — every declared Test-Surface row gets exactly one verdict (${t.desc})`
        : agree
        ? `${t.id} graded ${verdict}, which is what the build does`
        : `${t.id} was graded ${verdict} but the build ${t.pass ? "PASSES" : "FAILS"} that probe. Observed by running it: ${String(t.evidence || "").slice(0, 220)}${evidence ? ` — the report cited instead: "${evidence.slice(0, 160)}"` : ""}`,
    });
  }

  // ---- delegated: the overall verdict follows from the rows -----------------------------------
  const wantOverall = truth.fails > 0 ? "FAIL" : "PASS";
  const gotOverall = String(env?.verdict?.overall ?? "").toUpperCase();
  rows.push({
    id: "JV-OVERALL",
    pass: gotOverall === wantOverall,
    label: gotOverall === wantOverall
      ? `verdict.overall is ${gotOverall}, matching the build (${truth.fails} of ${truth.results.length} probes fail)`
      : `verdict.overall is ${gotOverall || "absent"} but ${truth.fails} of ${truth.results.length} probes actually fail — the overall verdict must follow the rows, not the ticked boxes or the green suite`,
  });

  // ---- authored (3) ---------------------------------------------------------------------------
  const refuted = (env?.verdict?.refuted || []).map((r) => String(r?.ac ?? r ?? ""));
  const owed = truth.results.filter((t) => !t.pass).map((t) => (t.desc.match(/\bAC-?\d+\b/i) || [t.id])[0]);
  const missing = owed.filter((ac) => !refuted.some((r) => new RegExp(ac.replace("-", "-?"), "i").test(r)));
  rows.push({
    id: "JV-REFUTED",
    pass: owed.length > 0 && missing.length === 0,
    label: missing.length
      ? `verdict.refuted[] must name every ticked box the evidence disproves — missing ${missing.join(", ")}; it currently names [${refuted.join(", ") || "nothing"}]`
      : `verdict.refuted[] names ${refuted.join(", ")}`,
  });

  if (requireEscalate) {
    const esc = env?.escalates || [];
    const ambiguity = esc.some((e) => String(e?.kind ?? "") === "spec-ambiguity");
    rows.push({
      id: "JV-ESCALATED",
      pass: ambiguity,
      label: ambiguity
        ? `the unresolved spec question is raised as escalates[] kind spec-ambiguity`
        : `the spec carries a question it does not answer and the contract is to RAISE it, not settle it — escalates[] has no entry of kind spec-ambiguity (${esc.length} escalate(s) present)`,
    });
  }

  // JV-REPRO — the EXTERNAL-FACT row, added when dial three was confirmed on two other skills.
  //
  // Every other row here is checkable from the envelope and the contract. This one is not: a
  // `repro` is a COMMAND, and whether it actually reproduces the defect is a fact about the running
  // build. It is the right row for this skill precisely because it is OPTIONAL TO PLAUSIBILITY —
  // a judge that has genuinely probed can write the command it ran, and a judge that reasoned from
  // the source can write one that merely looks right. Both read identically on the page.
  //
  // SKILL.md's own rule is the criterion: "every result gets a locator (output, snapshot path,
  // file:line for defects)" and "absence of evidence = FAIL". A repro that does not reproduce is
  // an absence of evidence wearing evidence's clothes.
  //
  // Graded by RUNNING it against the frozen build, through t0-verify's own runner so the semantics
  // match the gate.
  //
  // WHAT IS AND IS NOT ASSERTED, because the first version of this row got it wrong and the strong
  // reference caught it. It does NOT require a non-zero exit: for a defect of the form "should
  // refuse and doesn't", exiting 0 IS the demonstration, so that polarity would fail exactly the
  // bugs it was written for. What it asserts is that the repro is A COMMAND THAT RUNS — no spawn
  // error, and not `command not found`. That is precisely the external fact: prose like
  // `seed [a,b,c,d]; node build/todo.mjs rm 2-3` reads like a repro and has never been executed,
  // and the only way to tell the two apart is to try it.
  const bugs = (env?.verdict?.bugs || []).filter((b) => b && typeof b === "object");
  const repros = [];
  for (const b of bugs) {
    const cmd = String(b.repro ?? "").trim();
    if (!cmd) { repros.push({ cmd: "(none)", ok: false, why: `bug for ${b.criterion || "?"} carries no repro command` }); continue; }
    const box = mkdtempSync(join(tmpdir(), "jv-repro-"));
    const prev = process.env.TODO_STORE;
    process.env.TODO_STORE = join(box, "store.json");
    let r;
    try { r = runFixtures([cmd], dirname(contract)).results[0]; }
    finally { if (prev === undefined) delete process.env.TODO_STORE; else process.env.TODO_STORE = prev; }
    rmSync(box, { recursive: true, force: true });
    repros.push({ cmd, ok: !r.error && r.exit !== 127, why: r.error ? `could not be run (${r.error})` : `is not a runnable command (exit 127, command not found) — it reads like a repro but has never been executed` });
  }
  const badRepro = repros.filter((r) => !r.ok);
  rows.push({
    id: "JV-REPRO",
    pass: repros.length > 0 && badRepro.length === 0,
    label: repros.length === 0
      ? "the build has live defects, so verdict.bugs[] must carry at least one bug with a repro command"
      : badRepro.length
      ? `every bugs[].repro must be a command that ACTUALLY REPRODUCES when run — these do not: ${badRepro.map((r) => `\`${r.cmd}\` (${r.why})`).join("; ")}`
      : `all ${repros.length} repro command(s) reproduce against the build`,
  });

  const closed = (env?.task_results || []).filter((t) => String(t?.status ?? "").toLowerCase() === "done");
  rows.push({
    id: "JV-NO-CLOSURE",
    pass: closed.length === 0,
    label: closed.length
      ? `the judge set task_results[].status = done for ${closed.map((t) => t.task_id || t.id).join(", ")} — verdicts are its job, closure belongs to the orchestrator`
      : "no task is closed by the judge",
  });
  return rows;
}

/**
 * Render rows in the `PASS|FAIL  ID  label` form `detector.rows` parses.
 * @param {Array<{id:string, pass:boolean, label:string}>} rows - Rows to render.
 * @returns {string} The report body.
 */
export function formatRows(rows) {
  const lines = rows.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.label}`);
  const failed = rows.filter((r) => !r.pass).length;
  lines.push("", `${rows.length - failed}/${rows.length} rows pass${failed ? ` — ${failed} to fix` : ""}`);
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };
  const contract = flag("--contract"), cmd = flag("--cmd"), result = flag("--result");
  if (!contract || !cmd || !result || !existsSync(contract)) {
    console.error(`usage: verdict-rows.mjs --contract <contract.json> --cmd "<run cmd>" --result <draft> [--require-escalate]`);
    process.exit(2);
  }
  const env = existsSync(result) ? extractEnvelope(readFileSync(result, "utf8")) : null;
  let rows;
  try {
    rows = judgeRows({ contract, cmd, env, requireEscalate: argv.includes("--require-escalate") });
  } catch (e) {
    console.error(`verdict-rows: the ground-truth oracle threw — ${e.message}`);
    process.exit(2);
  }
  console.log(formatRows(rows));
  process.exit(rows.every((r) => r.pass) ? 0 : 1);
}
