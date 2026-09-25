// `coveredReqIds` — the sole producer of "graded" for the L1b REQ-UNCOVERED red, the requirements
// matrix and the trace oracle — tested the raw covers: token against /^REQ-\d+$/, while `reqId()`
// existed one import away to fold R-<n>, [[…]] and case onto one space. An author told at L1b to
// cover a requirement with an AC, who had, stayed red.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("144. Every spelling of a covers: clause folds through one helper before it is graded");
  const { coveredReqIds } = await import(join(ROOT, "kernel/verify/trace.mjs"));
  const { reqId } = await import(join(ROOT, "kernel/lib/contract.mjs"));
  const spellings = ["REQ-1", "R-2", "[[REQ-3]]", "req-4", "[[R-5]]", "REQ-06"];
  const board = [{ id: "TASK-001", acceptance_criteria: spellings.map((s) => ({ text: `AC (covers: ${s})`, covers: [s] })) }];
  const got = [...coveredReqIds(board)].sort();
  const want = spellings.map(reqId).sort();
  if (got.length === spellings.length && JSON.stringify(got) === JSON.stringify(want)) ok(`all ${spellings.length} spellings grade as covered, folded to ${want.join(", ")}`);
  else fail(`coveredReqIds folded ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  const junk = [...coveredReqIds([{ acceptance_criteria: [{ covers: ["UC-01", "REQ-", "R", "requirement 3"] }] }])];
  if (junk.length === 0) ok("tokens that fold to nothing are still not graded");
  else fail(`junk tokens were graded: ${JSON.stringify(junk)}`);
  const src = readFileSync(join(ROOT, "kernel/verify/trace.mjs"), "utf8");
  const fn = src.slice(src.indexOf("export function coveredReqIds("), src.indexOf("\n}\n", src.indexOf("export function coveredReqIds(")));
  if (/reqId\(/.test(fn)) ok("coveredReqIds folds through reqId() — the same helper the sibling rule uses");
  else fail("coveredReqIds still tests the raw token");
  // The three readers share the one producer.
  for (const f of ["kernel/verify/spec.mjs", "kernel/probe/requirements.mjs", "kernel/verify/trace.mjs"]) {
    if (/coveredReqIds\(/.test(readFileSync(join(ROOT, f), "utf8"))) ok(`${f} grades through coveredReqIds`);
    else fail(`${f} no longer grades through coveredReqIds — a second key space`);
  }
}
