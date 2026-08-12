#!/usr/bin/env node
// Anti-rationalization — advisory Stop hook (v1.2).
//
// When the session's final message claims completion ("done", "all tests pass", "ready to
// ship") while the harness's own mechanical facts disagree (unfinished board tasks, a red T0
// verdict), this hook says so — to the user, out loud, with the facts.
//
// ADVISORY ONLY, by architectural invariant: "QA is a level-up, not a gate." This hook exits
// 0 always and emits at most { systemMessage } — never { decision: "block" }, never exit 2.
// A blocking Stop hook would be a second gate behind the single judge (spec-evaluator).
//
// Harness-scoped: fires only when a run is actually active (.shapeup/active-scope
// exists, or some .shapeup/*/harness-run.md is mid-build). An always-on nag on
// non-harness work is exactly the annoyance that gets hooks disabled.
//
// Contract: Stop stdin JSON { cwd, stop_hook_active, last_assistant_message, transcript_path }.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { isMain } from "../skills/tech-lead/scripts/lib/is-main.mjs";
import { localDir, localRoot, activeScope } from "../skills/tech-lead/scripts/lib/paths.mjs";

import { runHook, readStdin, settle } from "./lib/decision.mjs";

function readJSON(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text || "");
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (kv) fm[kv[1]] = kv[2].replace(/^['"]|['"]$/g, "");
  }
  return fm;
}

const MID_RUN = new Set(["orienting", "mapping", "building", "evaluating"]);

/** The active harness slug, or null when no run is in progress. */
export function activeSlug(cwd) {
  const pointer = readJSON(activeScope(cwd));
  if (pointer?.slug) return pointer.slug;
  const root = localDir(cwd);
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root)) {
    const runPath = join(root, entry, "harness-run.md");
    if (!existsSync(runPath)) continue;
    try {
      const fm = frontmatter(readFileSync(runPath, "utf8"));
      if (MID_RUN.has(fm.status)) return entry;
    } catch { /* unreadable run file → not this one */ }
  }
  return null;
}

/**
 * Does the text claim the work is finished — or promise that it is about to be?
 *
 * The past-tense half is the original detector. The future-tense half was added after a transcript
 * this hook should have caught and structurally could not: the session ended on "The tech-lead
 * skill is orchestrating the full harness. It will: 1…".
 * A promise at the END of a session is a completion claim wearing different grammar — the run is
 * over, and the thing it says it will do is never going to happen. Matching only past tense meant
 * the emptiest failures were the least detectable, which is backwards.
 *
 * (The zero-work case — dispatched and never started — belongs to `gate-zerowork.mjs`, which
 * blocks on a mechanical absence rather than on phrasing. This one covers narration INSIDE a run
 * that did start.)
 */
const FUTURE_CLAIM = /\b(will (?:now )?(?:run|orchestrate|execute|proceed|begin|start)|is orchestrating|I'?ll (?:now )?(?:run|start|begin|orchestrate)|going to (?:run|orchestrate|execute))\b/i;

export function detectClaim(text) {
  if (!text || typeof text !== "string") return null;
  const past = /\b(done|complete(?:d)?|finished|shipped|ready to ship|all (?:tests|tasks) pass(?:ing|ed)?|everything works)\b/i.exec(text);
  if (past) return past[1];
  const future = FUTURE_CLAIM.exec(text);
  return future ? future[0] : null;
}

/**
 * Is this claim a promise about work still to come, rather than an assertion that work is done?
 * The two are checked against DIFFERENT facts — see contradictions().
 * @param {string} claim - The matched claim fragment from detectClaim().
 * @returns {boolean} True for a future-tense promise.
 */
export function isFutureClaim(claim) {
  return typeof claim === "string" && FUTURE_CLAIM.test(claim);
}

/** Read-only mechanical facts about the run — the evidence the claim is checked against. */
export function gatherFacts(cwd, slug) {
  const root = localRoot(cwd, slug);
  const facts = { unfinished: [], red_t0: null, run_status: null, final_verdict: null };

  const tasksDir = join(root, "tasks");
  if (existsSync(tasksDir)) {
    for (const f of readdirSync(tasksDir)) {
      if (!/^TASK-.*\.md$/.test(f)) continue;
      try {
        const fm = frontmatter(readFileSync(join(tasksDir, f), "utf8"));
        if (fm.status && fm.status !== "done") facts.unfinished.push(fm.id || f.replace(/\.md$/, ""));
      } catch { /* unreadable task file → no fact */ }
    }
  }

  const verdictsDir = join(root, "t0", "verdicts");
  if (existsSync(verdictsDir)) {
    let latest = null;
    for (const f of readdirSync(verdictsDir)) {
      const m = /^r(\d+)-a(\d+)\.json$/.exec(f);
      if (!m) continue;
      const key = [Number(m[1]), Number(m[2])];
      if (!latest || key[0] > latest.key[0] || (key[0] === latest.key[0] && key[1] > latest.key[1])) {
        latest = { key, file: f };
      }
    }
    if (latest) {
      const verdict = readJSON(join(verdictsDir, latest.file));
      if (verdict?.overall === "red") facts.red_t0 = latest.file.replace(/\.json$/, "");
    }
  }

  const runPath = join(root, "harness-run.md");
  if (existsSync(runPath)) {
    try {
      const fm = frontmatter(readFileSync(runPath, "utf8"));
      facts.run_status = fm.status || null;
      facts.final_verdict = fm.final_verdict || null;
    } catch { /* no fact */ }
  }
  return facts;
}

/**
 * The facts that contradict a claim, as human-readable fragments.
 *
 * TENSE DECIDES WHICH FACTS COUNT, and getting this wrong is what makes a hook get disabled.
 * An unfinished board and a red T0 both contradict "it is done". NEITHER of
 * them contradict "I am about to run the evaluator" — they are that sentence's PREMISE. Checking
 * a promise against them meant every healthy build round ended with the hook announcing that the
 * turn's own plan "disagrees with the facts", naming as evidence the very work the plan exists to
 * do. This file's header calls an always-on nag "exactly the annoyance that gets hooks disabled",
 * and the sibling future-tense detector in gate-zerowork.mjs is marked advisory for the same
 * reason. So a promise is contradicted by one thing only: a run that is already CLOSED, where the
 * promised work is never going to happen.
 *
 * The zero-work case that motivated future-tense detection — a session that dispatches, narrates
 * "it will: 1…", and stops having written nothing — is gate-zerowork.mjs's, which blocks on a
 * mechanical absence rather than on phrasing. It is not this hook's to double-report.
 *
 * @param {string} claim - The matched claim fragment from detectClaim().
 * @param {object} facts - Mechanical facts from gatherFacts().
 * @returns {string[]} Human-readable contradiction fragments; empty means the claim stands.
 */
export function contradictions(claim, facts) {
  const out = [];

  if (isFutureClaim(claim)) {
    if (facts.run_status === "shipped" || facts.run_status === "escalated") {
      out.push(`run status is already "${facts.run_status}" — the run is closed, so the promised work cannot happen in it`);
    }
    return out;
  }

  if (facts.unfinished.length > 0) {
    const named = facts.unfinished.slice(0, 5).join(", ");
    out.push(`${facts.unfinished.length} board task(s) not done (${named}${facts.unfinished.length > 5 ? ", …" : ""})`);
  }
  if (facts.red_t0) out.push(`latest T0 verdict ${facts.red_t0} is red`);
  if (facts.final_verdict === "fail") out.push("harness-run records final_verdict: fail");
  if (/ship/i.test(claim || "") && MID_RUN.has(facts.run_status)) out.push(`run status is still "${facts.run_status}"`);
  return out;
}

function lastAssistantFromTranscript(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return null;
    if (statSync(transcriptPath).size > 20 * 1024 * 1024) return null; // stay cheap
    const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 64; i--) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      const msg = entry?.message;
      if (entry?.type === "assistant" || msg?.role === "assistant") {
        const content = msg?.content ?? entry?.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          return content.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
        }
      }
    }
  } catch { /* unreadable transcript → no claim source */ }
  return null;
}

async function main() {
  await runHook("anti-rationalization", async () => {
  const raw = await readStdin();
  let p;
  /** Stay silent — with the reason on the record (hooks/lib/decision.mjs). */
  const defer = (reason, rule) => settle({ verdict: "allow", event: "Stop", cwd: p?.cwd, reason, rule });
  try { p = JSON.parse(raw || "{}"); }
  catch (e) { settle({ verdict: "error", event: "Stop", reason: `unparseable payload: ${e.message}` }); }

  if (p.stop_hook_active) defer("stop_hook_active — never participate in a stop-hook loop", "loop-guard");

  const cwd = p.cwd || process.cwd();
  const slug = activeSlug(cwd);
  if (!slug) defer("no active run — nothing to check the claim against", "no-run");

  const message = typeof p.last_assistant_message === "string" && p.last_assistant_message
    ? p.last_assistant_message
    : lastAssistantFromTranscript(p.transcript_path);
  const claim = detectClaim(message);
  if (!claim) defer("the final message makes no completion claim", "no-claim");

  const facts = gatherFacts(cwd, slug);
  const contra = contradictions(claim, facts);
  if (contra.length === 0) defer(`claim "${claim}" agrees with the run facts — inspected and permitted`, "claim-supported");

  return {
    verdict: "allow", event: "Stop", cwd, subject: slug, rule: "claim-contradicted", emit: true,
    reason: `claim "${claim}" contradicted by ${contra.length} fact(s) — advisory note emitted, not a block`,
    payload: {
      systemMessage:
        `anti-rationalization (advisory): the last message claims "${claim}" but run "${slug}" facts disagree — ` +
        `${contra.join("; ")}. Not blocking (QA is a level-up, not a gate) — verify against the board and T0 before shipping.`,
    },
  };
  });
}

if (isMain(import.meta.url)) {
  main();
}
