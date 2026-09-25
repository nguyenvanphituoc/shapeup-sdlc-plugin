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

  // The parser that BUILDS `ac.covers` from a task file reads the whole bullet and folds too — a
  // clause on an indented continuation line, or spelled R-2, used to vanish before grading began.
  const { mkdtempSync, rmSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const ws = mkdtempSync(join(tmpdir(), "covers-parse-"));
  try {
    const { readBoard } = await import(join(ROOT, "kernel/compile.mjs"));
    mkdirSync(join(ws, ".shapeup/f/tasks"), { recursive: true });
    writeFileSync(join(ws, ".shapeup/f/tasks/TASK-001.md"), [
      "---", "id: TASK-001", "status: ready", "---", "", "## Acceptance Criteria", "",
      "- [ ] the badge renders the count (TS-INV-01)",
      "      and hides at zero (TS-INV-02) (covers: REQ-1)",
      "- [ ] tapping opens the list (covers: R-2, [[REQ-3]])",
      "- [ ] a bullet with no clause at all",
      "",
    ].join("\n"));
    const acs = readBoard(ws, "f")[0]?.acceptance_criteria || [];
    const c0 = typeof acs[0] === "object" ? acs[0].covers : [], c1 = typeof acs[1] === "object" ? acs[1].covers : [];
    if (JSON.stringify(c0) === JSON.stringify(["REQ-1"]) && typeof acs[0] === "object" && acs[0].text === "the badge renders the count (TS-INV-01)") ok("a clause on the bullet's continuation line is read, and the AC text stays the checkbox line");
    else fail(`continuation-line clause not read: ${JSON.stringify(acs[0])}`);
    if (JSON.stringify(c1) === JSON.stringify(["REQ-2", "REQ-3"])) ok("R-2 and [[REQ-3]] fold to REQ-2, REQ-3 at parse time");
    else fail(`the parser did not fold: ${JSON.stringify(acs[1])}`);
    if (typeof acs[2] === "string") ok("a bullet with no clause stays a plain string");
    else fail(`a clause-less bullet became ${JSON.stringify(acs[2])}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
