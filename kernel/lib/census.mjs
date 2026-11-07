// The stop step's census, read the one way — what "a census is on disk" means, and what the kernel
// does when the file is not one.
//
// WHY THIS IS A MODULE. The census is written by the loop in its own context (no sub-agent, no order),
// so nothing but the file says it is done. Three callers need the same reading — `probe next` (is the
// step satisfied, or refused), `reduce ingest --close-census` (the act that records a refusal) and
// the structural suite — and a predicate written three times is how a gate reads a file the step
// called valid. GATE L4's resolver reads the verdict through `censusVerdict` in `gate.mjs`; that
// function is deliberately unchanged and looks at the verdict alone. This reads the SHAPE, and the
// two are kept apart on purpose: the gate must never get stricter than the evidence it already
// accepted, while the step may refuse a census the loop wrote badly.
//
// "SENT BACK ONCE" IS A COUNT ON DISK. `probe next` is read-only and remembers nothing, and the stop
// step has no order and no dispatch receipt to count. So a refusal is a row in a kernel-written file
// (`censusRefusals`), keyed by the refused file's own hash — the same content refused twice is one
// refusal, a second different invalid census is the second. One refusal sends the step back with the
// reason; the second stops the run with it.

import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { hammerCensus, censusRefusals, readRunId } from "./paths.mjs";
import { validate } from "../verify/envelope.mjs";
import { HAMMER_VERDICTS } from "../gate.mjs";

/** The `HammerCensus` definition in the domain registry — the shape a census must have. */
const CENSUS_REF = { $ref: "domain.schema.json#/$defs/HammerCensus" };

/**
 * Read the census file and say whether it is one.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{exists:boolean, sha256:(string|null), problem:(string|null), verdict:(string|null), census:(object|null)}}
 *   `exists` is false when there is no file (not a refusal — the step is simply not done). `problem` is
 *   null exactly when the file is a valid census: readable JSON, `schema_version` 1, a verdict from the
 *   three, a `cut_list` array, and every typed field the registry names the right type.
 */
export function readCensus(cwd, slug) {
  const file = hammerCensus(cwd, slug);
  if (!existsSync(file)) return { exists: false, sha256: null, problem: null, verdict: null, census: null };
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch (e) { return { exists: true, sha256: null, problem: `the census file is not readable: ${e.message}`, verdict: null, census: null }; }
  const sha256 = createHash("sha256").update(text).digest("hex");
  let census = null;
  try { census = JSON.parse(text); } catch (e) { return { exists: true, sha256, problem: `the census is not readable JSON: ${e.message}`, verdict: null, census: null }; }
  if (!census || typeof census !== "object" || Array.isArray(census)) {
    return { exists: true, sha256, problem: "the census must be a JSON object", verdict: null, census: null };
  }
  const { errors } = validate(census, CENSUS_REF);
  const problems = [...errors];
  if (census.schema_version !== 1) problems.push(`schema_version must be 1 (got ${JSON.stringify(census.schema_version)})`);
  if (!HAMMER_VERDICTS.includes(census.verdict) && !errors.some((e) => /verdict/.test(e))) {
    problems.push(`verdict ${JSON.stringify(census.verdict)} is not one of ${HAMMER_VERDICTS.join(" | ")}`);
  }
  return {
    exists: true, sha256, census,
    problem: problems.length ? problems.slice(0, 4).join("; ") : null,
    verdict: problems.length ? null : census.verdict,
  };
}

/**
 * This run's recorded census refusals, oldest first.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {Array<{at:string, run_id:(string|null), sha256:string, reason:string}>} Rows for the open run.
 */
export function censusRefusalRows(cwd, slug) {
  const runId = readRunId(cwd, slug);
  let text = "";
  try { text = readFileSync(censusRefusals(cwd, slug), "utf8"); } catch { return []; }
  return text.split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && r.sha256 && (!runId || !r.run_id || r.run_id === runId));
}

/**
 * Close the stop step over what is on disk: record a refusal when the census is not valid.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {{ok:boolean, state:("valid"|"absent"|"refused"), reason:(string|null), verdict:(string|null)}} What was
 *   found. `absent` records nothing; `refused` appends one row unless this exact file was refused already.
 */
export function closeCensus(cwd, slug) {
  const c = readCensus(cwd, slug);
  if (!c.exists) return { ok: false, state: "absent", reason: "no census on disk — write it to the path the step names", verdict: null };
  if (!c.problem) return { ok: true, state: "valid", reason: null, verdict: c.verdict };
  if (c.sha256 && !censusRefusalRows(cwd, slug).some((r) => r.sha256 === c.sha256)) {
    try {
      const path = censusRefusals(cwd, slug);
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), run_id: readRunId(cwd, slug), sha256: c.sha256, reason: c.problem }) + "\n");
    } catch { /* a refusal that cannot be recorded is still a refusal; the step re-reads the file */ }
  }
  return { ok: false, state: "refused", reason: c.problem, verdict: null };
}
