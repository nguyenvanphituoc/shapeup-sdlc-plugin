// 59 — the requirements registry, and the one key space every link to it resolves in.
// Section: 93.
//
// WHAT WAS MEASURED, and it is the reason this module exists rather than a tidier one. A full run
// of one pitch produced twenty-one requirements. Every one of them had an acceptance criterion
// somewhere on the board; only half reached a criterion the judge grades; and the twenty scope
// contracts that DID claim a requirement claimed it in the pitch's own numbering — `R13` — while
// the registry, the AC clause and the verdict anchor all key off `REQ-13`. The edge was produced
// and then severed by spelling, and reported as a shape warning twenty-three times a run, which is
// indistinguishable from noise.
//
// So there are two halves here, and each is useless alone:
//
//   THE PRODUCER. Nothing in the pipeline ever dispatched `coverage`, so `shapeup/<slug>/
//   requirements.md` was a file the schema described, the substrate fenced, the craft documented —
//   and no run wrote. The registry has to exist before ANALYZE, because ANALYZE's acceptance
//   criteria are what cite its ids.
//
//   THE KEY SPACE. `covers[]` is an OPTIONAL contract field, and across two runs of one pitch it
//   went from 8 of 9 contracts populated to 0 of 18. A fix that asks the planner to spell the key
//   differently is a fix whose value is a coin flip; normalising on read converts the links on
//   contracts already committed. The mapping runs BEFORE `^REQ-[0-9]+$`, never instead of it —
//   (e2) below is the check that the arm still reds a key neither space recognises, because a
//   normaliser that silences the rule is worse than the rule being wrong.
//
// AND ONE MIGRATION GUARD (c2). `coverage` is deliberately NOT a phase: `PHASE_ARTIFACT` doubles as
// `nextPhase()`'s ordered list, so an entry there would fast-forward every run recorded before the
// registry existed to the registry instead of to `build`. That is a silent re-plan of work already
// done, on a relaunch, which is exactly the class of defect the fast-forward exists to retire.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "reqdemo";

/** Write a file, creating its directory. @param {string} root Base. @param {string} rel Relative path. @param {string} body Contents. @returns {void} */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

/** A registry table holding the given ids. @param {string[]} ids REQ ids. @returns {string} Markdown. */
const registry = (ids) => [
  "# Requirements", "",
  "| REQ-id | clause | source | status | note |",
  "|---|---|---|---|---|",
  ...ids.map((id) => `| ${id} | the clause for ${id} | shaping.md R${id.replace(/^REQ-/, "")} | covered | |`),
  "",
].join("\n");

/** A scope contract body. @param {string} id Scope id. @param {string} covers The covers[] literal. @returns {string} Markdown. */
const contract = (id, covers) => [
  "---", `scope_id: ${id}`, "topology_type: VERTICAL_SLICE",
  "use_cases: [UC-AddTodo]", `covers: ${covers}`,
  `allowed_file_substrate: [src/commands/${id}.js, test/commands/${id}.test.js]`,
  'e2e_verification_fixtures: ["node --test test/x.test.js"]',
  "hill_phase: UPHILL_UNKNOWN", "---", "", `# Scope: ${id}`, "", "## Why this slice", "", "One flow.", "",
].join("\n");

/**
 * A tree with a committed spec, one scope contract, and optionally a registry.
 * @param {{covers:string, reqs?:(string[]|null)}} parts - The contract's covers[] literal, and the
 *   registry ids (null = no registry on disk at all).
 * @returns {string} The fixture root.
 */
function tree({ covers, reqs = null }) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-req-registry-"));
  w(cwd, `shapeup/${SLUG}/spec/domain-model.md`, "# Domain model\n\n## Entities\n- Todo\n");
  w(cwd, `shapeup/${SLUG}/spec/usecases/UC-AddTodo.md`, "---\nid: UC-AddTodo\n---\n\n# UC-AddTodo\n\n## Steps\n1. [INV-01] text is non-empty\n");
  w(cwd, `shapeup/${SLUG}/scopes/SC-1.md`, contract("SC-1", covers));
  if (reqs) w(cwd, `shapeup/${SLUG}/requirements.md`, registry(reqs));
  return cwd;
}

/**
 * Run the requirements-registry checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  // =============================================================================
  section("93. The requirements registry is produced, and every link to it lands in one key space");
  // =============================================================================

  // --- (a) THE FIELD IS DECLARED WHERE A DISPATCH CAN RELY ON IT -------------------------------
  // `x-payload-by-worker` is the authoritative table of what a worker may read off its order, and
  // the worker's own contract says anything absent from it is unknown. A `coverage` dispatch that
  // hands over `payload.requirements` without this entry is handing over a field the craft is
  // entitled to ignore.
  {
    const domain = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
    const fields = domain["x-payload-by-worker"]?.["ba-pitch-analyzer"] || [];
    if (fields.includes("requirements")) ok("(a) x-payload-by-worker registers `requirements` for ba-pitch-analyzer — the coverage dispatch's payload is a declared input, not an inference");
    else fail("(a) x-payload-by-worker['ba-pitch-analyzer'] does not list `requirements` — the worker's contract entitles it to ignore the field the coverage dispatch hands over");

    const props = domain.$defs?.WorkOrderPayload?.properties || {};
    if (props.requirements) ok("(a) $defs/WorkOrderPayload declares the `requirements` property the registry entry names");
    else fail("(a) $defs/WorkOrderPayload has no `requirements` property — the registry names a field the envelope cannot carry");
  }

  // --- (b) THE DISPATCH EXISTS, ONCE, AND IS NOT A PHASE ---------------------------------------
  {
    const wf = read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"));
    const dispatches = (wf.match(/operation: "coverage"/g) || []).length;
    if (dispatches === 1) ok("(b) shapeup-run.js dispatches `coverage` exactly once");
    else fail(`(b) shapeup-run.js carries ${dispatches} coverage dispatches — the registry is written once per run, before ANALYZE, or its ids are not stable for the board to cite`);

    // The dispatch has to be addressed to the worker that owns the operation, and carry the source
    // to extract from. A `coverage` order with no `requirements` in its payload is a worker being
    // asked to guess which document the run was shaped from.
    const block = wf.slice(Math.max(0, wf.indexOf('operation: "coverage"') - 200), wf.indexOf('operation: "coverage"') + 400);
    if (/skill: "ba-pitch-analyzer"/.test(block) && /payload: \{[^}]*requirements:/.test(block)) {
      ok("(b) the coverage dispatch names ba-pitch-analyzer and carries payload.requirements");
    } else {
      fail("(b) the coverage dispatch does not pair `skill: \"ba-pitch-analyzer\"` with a payload carrying `requirements:` — the order would reach the wrong worker, or reach the right one with nothing to extract from");
    }

    // ANALYZE's acceptance criteria cite the ids, so the registry must be written first.
    const iCov = wf.indexOf('operation: "coverage"');
    const iAna = wf.indexOf('operation: "analyze"');
    if (iCov > -1 && iAna > -1 && iCov < iAna) ok("(b) coverage is dispatched before analyze — the ids exist before the acceptance criteria that cite them");
    else fail(`(b) coverage is not dispatched before analyze (coverage@${iCov}, analyze@${iAna}) — the board would be written against a registry that does not exist yet`);

    // Guarded on the bare fact, never on `--require`: `probe resume --require` is an enum over
    // PHASE_ARTIFACT's keys, so asking it about `coverage` exits 2 and this file reads any exit
    // other than 6 as "the predicate was never asked" — a working dispatch would abort the run.
    if (/rs\.has_requirements/.test(wf)) ok("(b) the coverage dispatch is guarded on the resume state's has_requirements fact");
    else fail("(b) nothing in shapeup-run.js branches on has_requirements — the registry is either never written or rewritten on every relaunch");

    const resumeSrc = read(join(ROOT, "kernel/probe/resume.mjs"));
    const mapStart = resumeSrc.indexOf("PHASE_ARTIFACT");
    const mapBody = resumeSrc.slice(mapStart, mapStart + 400);
    if (mapStart > -1 && !/coverage/.test(mapBody)) {
      ok("(b) PHASE_ARTIFACT has no `coverage` key — the map is also nextPhase()'s ordered list, so an entry there would fast-forward every pre-registry run to the registry instead of to build");
    } else {
      fail("(b) PHASE_ARTIFACT names `coverage` — every run recorded before the registry existed would resume at the registry instead of at build on its next relaunch");
    }
  }

  // --- (c) THE FACT IS DERIVED FROM DISK, AND IT MOVES NO EXISTING RUN -------------------------
  {
    const KERNEL = join(ROOT, "kernel/harness.mjs");
    /** Derive the resume state for a fixture. @param {string} root Fixture root. @returns {object|null} Parsed state. */
    const resume = (root) => {
      const r = spawnSync("node", [KERNEL, "probe", "resume", "--slug", SLUG, "--cwd", root], { encoding: "utf8" });
      try { return JSON.parse(r.stdout); } catch { return null; }
    };

    const bare = tree({ covers: "[]" });
    const withReg = tree({ covers: "[]", reqs: ["REQ-1"] });
    try {
      const a = resume(bare), b = resume(withReg);
      if (a?.has_requirements === false && b?.has_requirements === true) {
        ok("(c) has_requirements is derived from the registry on disk — false without it, true with it");
      } else {
        fail(`(c) has_requirements did not track the file: no registry → ${a?.has_requirements}, registry → ${b?.has_requirements}`);
      }

      // THE MIGRATION GUARD. A run that finished planning before the registry existed carries a
      // spec tree, a wiring map and scope contracts, and no requirements.md. It must still resume
      // at `build` — anything else re-plans work already done, on a relaunch, in silence.
      const legacy = mkdtempSync(join(tmpdir(), "struct-req-legacy-"));
      try {
        w(legacy, `.shapeup/${SLUG}/orient/code-surface.md`, "planted\n");
        w(legacy, `.shapeup/${SLUG}/orient/discovered-seed.md`, "planted\n");
        w(legacy, `.shapeup/${SLUG}/orient/hill-signal.md`, "planted\n");
        w(legacy, `.shapeup/${SLUG}/orient/spike-persistence.md`, "planted\n");
        w(legacy, `shapeup/${SLUG}/spec/usecases/UC-01.md`, "planted\n");
        // ANALYZE's per-machine half — a pre-registry run on its own machine had its board too.
        w(legacy, `.shapeup/${SLUG}/tasks/TASK-001.md`, "---\nid: TASK-001\nstatus: pending\n---\n\n# planted\n");
        w(legacy, `shapeup/${SLUG}/wiring-map.md`, "planted\n");
        w(legacy, `shapeup/${SLUG}/scopes/SC-1.md`, "planted\n");
        const st = resume(legacy);
        if (st?.next_phase === "build" && st?.has_requirements === false) {
          ok("(c) a run planned before the registry existed still resumes at build — has_requirements is a fact, not a phase");
        } else {
          fail(`(c) a pre-registry run resumed at "${st?.next_phase}" instead of build — adding the registry to the phase chain re-plans work already on disk`);
        }
      } finally { rmSync(legacy, { recursive: true, force: true }); }
    } finally {
      rmSync(bare, { recursive: true, force: true });
      rmSync(withReg, { recursive: true, force: true });
    }
  }

  // --- (d) THE ORDER THE DISPATCH COMPILES IS A VALID ENVELOPE ---------------------------------
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-req-order-"));
    try {
      w(ws, `.shapeup/${SLUG}/intake.md`, "# Pitch\n\nR1. The list persists.\n");
      const r = spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "compile",
        "--operation", "coverage", "--slug", SLUG, "--cwd", ws,
        "--payload", JSON.stringify({ requirements: `.shapeup/${SLUG}/intake.md`, feature: SLUG })],
      { encoding: "utf8" });
      const orderPath = join(ws, ".shapeup", SLUG, "orders", "coverage.json");
      let order = null;
      try { order = JSON.parse(readFileSync(orderPath, "utf8")); } catch { /* reported below */ }
      const { validate } = await import(join(ROOT, "kernel/verify/envelope.mjs"));
      const schema = readJSON(join(ROOT, "kernel/schemas/work-order.schema.json"));
      const v = order ? validate(order, schema) : { valid: false, errors: [r.stderr || r.stdout] };
      if (r.status === 0 && order?.payload?.requirements === `.shapeup/${SLUG}/intake.md` && v.valid) {
        ok("(d) a compiled coverage order carries payload.requirements and validates against work-order.schema.json");
      } else {
        fail(`(d) compiled coverage order: exit ${r.status}, payload.requirements=${order?.payload?.requirements}, valid=${v.valid} ${JSON.stringify(v.errors)}`);
      }
      // The substrate is the other half of a dispatch nobody can misuse: the registry is the only
      // thing this operation writes, and the pitch it extracts from is frozen under it.
      const allowed = order?.substrate?.allowed || [];
      if (allowed.length === 1 && /requirements\.md$/.test(allowed[0])) {
        ok("(d) the coverage order's substrate permits exactly one write — the registry itself");
      } else {
        fail(`(d) the coverage order's allowed substrate is ${JSON.stringify(allowed)} — the planner may write something other than the registry it was dispatched for`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (e) ONE KEY SPACE ------------------------------------------------------------------------
  {
    const { lint } = await import(join(ROOT, "kernel/verify/spec.mjs"));
    const { reqId } = await import(join(ROOT, "kernel/lib/contract.mjs"));

    // (e0) the mapping itself, stated once so the two reporters cannot disagree about it.
    const mapped = ["REQ-13", "R13", "R-13", "r13", "req-13"].map(reqId);
    if (mapped.every((m) => m === "REQ-13")) ok("(e) reqId maps every spelling of one requirement onto the registry's key — REQ-13, R13, R-13, r13, req-13");
    else fail(`(e) reqId does not converge: ${JSON.stringify(mapped)} — two spellings of one requirement are two nodes`);

    // ...and it is a MAPPING, not a loosening. Anything that is not a numbered requirement
    // reference comes back untouched, so `^REQ-[0-9]+$` still rejects it downstream.
    if (reqId("the login flow") === "the login flow" && reqId("REQ-A1") === "REQ-A1") {
      ok("(e) reqId returns a non-numbered reference unchanged — the pattern it feeds is unchanged, not widened");
    } else {
      fail(`(e) reqId rewrote a reference that is not a numbered requirement: ${JSON.stringify([reqId("the login flow"), reqId("REQ-A1")])}`);
    }

    // (e1) the measured case: a committed contract citing the pitch's numbering, against a registry
    // holding the canonical id. This is the link that existed on 20 of 21 requirements and resolved
    // for none of them.
    const resolves = tree({ covers: "[R13]", reqs: ["REQ-13"] });
    try {
      const f = lint({ cwd: resolves, slug: SLUG }).findings.filter((x) => x.rule === "SCOPE-COVERS");
      if (f.length === 0) ok("(e) a contract citing `R13` resolves against a registry holding `REQ-13` — SCOPE-COVERS emits nothing");
      else fail(`(e) a contract citing R13 against a registry holding REQ-13 still fired SCOPE-COVERS: ${JSON.stringify(f.map((x) => x.detail))}`);
    } finally { rmSync(resolves, { recursive: true, force: true }); }

    // (e2) THE DISCRIMINATOR. A normaliser that makes the arm quiet on everything has removed the
    // check rather than fixed it. A key the registry does not hold is still red, in either spelling.
    for (const [covers, label] of [["[R99]", "R99"], ["[REQ-99]", "REQ-99"]]) {
      const dangling = tree({ covers, reqs: ["REQ-13"] });
      try {
        const f = lint({ cwd: dangling, slug: SLUG }).findings.filter((x) => x.rule === "SCOPE-COVERS" && x.level === "red");
        if (f.length === 1) ok(`(e) a contract claiming ${label}, which the registry does not hold, is still red under SCOPE-COVERS`);
        else fail(`(e) ${label} against a registry holding only REQ-13 produced ${f.length} red findings — the normaliser silenced the closure check instead of resolving it`);
      } finally { rmSync(dangling, { recursive: true, force: true }); }
    }

    // (e3) absent artifact ⇒ arm skipped. No registry, no closure claim — the same non-regression
    // rule every other spine arm follows.
    const noReg = tree({ covers: "[R13]" });
    try {
      const f = lint({ cwd: noReg, slug: SLUG }).findings.filter((x) => x.rule === "SCOPE-COVERS");
      if (f.length === 0) ok("(e) with no registry on disk the closure half stays silent — absent artifact ⇒ arm skipped");
      else fail(`(e) SCOPE-COVERS fired on a tree with no requirements.md: ${JSON.stringify(f.map((x) => x.detail))}`);
    } finally { rmSync(noReg, { recursive: true, force: true }); }
  }

  // --- (f) THE RE-RUN RULE LIVES IN THE CRAFT, BECAUSE THE EXTRACTION IS JUDGMENT ---------------
  // An id is matched back by its frozen `source` cell and clause text. Re-deriving the number from
  // the source's CURRENT order is how a second coverage pass over a pitch whose R-ids shifted
  // re-points REQ-12 at a different clause — and every `covers:` and `traces_to` link written
  // against the old meaning keeps resolving, to the wrong requirement, silently. Nothing mechanical
  // can catch that; the rule has to be in the instructions the extraction is performed from.
  {
    const skill = read(join(ROOT, "skills/ba-pitch-analyzer/SKILL.md"));
    const row = skill.split("\n").find((l) => l.startsWith("| `coverage` |")) || "";
    const rules = [
      [/`?R12`?\s*→?\s*`?REQ-12`?|R<n>` → `REQ-<n>|`R12` → `REQ-12`/, "an R-id in the source keeps its number as REQ-<n>"],
      [/source.{0,80}verbatim|verbatim.{0,80}source|shaping\.md R12/, "the source cell records where the clause came from, verbatim"],
      [/next free number/, "a clause with no R-id takes the next free number above the highest one in the source"],
      [/split 2\/3|splitting/i, "splitting keeps the first part's id and records the split in the source cell"],
      [/never.{0,60}re-deriv|re-deriv.{0,60}never/i, "a re-run matches an existing id by its frozen source cell, never by re-deriving the number"],
    ];
    for (const [re, what] of rules) {
      if (re.test(row)) ok(`(f) the coverage craft states: ${what}`);
      else fail(`(f) the coverage craft does not state: ${what} — without it a second pass over a pitch whose R-ids shifted re-points an existing REQ-id, and every link written against the old meaning resolves to the wrong requirement`);
    }
  }

  // --- (g) THE AC-LEVEL LINK, which is where the edge was actually being lost ------------------
  // Measured: all 21 requirements had an acceptance criterion and only 11 reached a criterion the
  // judge grades. A board AC reaches the judge through the refuted list alone — it can yield a FAIL
  // and can never yield a PASS — so an AC that names no id produces no evidence for the requirement
  // it was written for. And a non-functional clause with no use-case home has to become a task
  // rather than a line in the risk register, or nothing grades it at all.
  {
    const skill = read(join(ROOT, "skills/ba-pitch-analyzer/SKILL.md"));
    if (/\(covers: REQ-…\)/.test(skill) && /acceptance criterion/i.test(skill)) {
      ok("(g) the analyze craft requires an acceptance criterion that grades a requirement to carry `(covers: REQ-…)` on the AC line");
    } else {
      fail("(g) the analyze craft never says an acceptance criterion carries `(covers: REQ-…)` — the requirement edge is written in prose, where no reader joins on it");
    }
    if (/risk (register|table)/i.test(skill) && /non-functional/i.test(skill)) {
      ok("(g) the analyze craft routes a requirement with no use-case home into a task with a covered AC, not into the risk register");
    } else {
      fail("(g) the analyze craft does not say where a non-functional requirement goes — it lands in the risk register, which nothing grades");
    }
  }

  // --- (h) THE GATE: a requirement nothing reaches is red at L1b ------------------------------
  // SCOPE-COVERS walks the links that exist and asks whether each resolves; a requirement with no
  // link at all satisfies it perfectly. REQ-UNCOVERED is the other direction of the same edge, and
  // L1b is the last place it can be answered cheaply — after it nobody re-reads the pitch.
  //
  // (h1) IS THE ONE THAT CATCHES THE IMPLEMENTATION MISTAKE, and it is the reason the covered
  // requirement is asserted about at all. `parseBoard` (the scheduling view lint() already holds)
  // carries no acceptance_criteria field, so an arm fed that board sees an empty covered set and
  // reds EVERY requirement on EVERY run. A test that only checks "REQ-2 is reported" passes on
  // exactly that implementation. Only `readBoard` carries the criteria, and a second parser of the
  // task file is ruled out where the first one lives.
  {
    const { lint } = await import(join(ROOT, "kernel/verify/spec.mjs"));

    /** A registry row. @param {string} id REQ id. @param {string} status Status cell. @returns {string} The table row. */
    const row = (id, status) => `| ${id} | the clause for ${id} | shaping.md R${id.replace(/^REQ-/, "")} | ${status} | |`;

    /**
     * A schema-valid tree whose only possible red is the one under test: one scope, one board task,
     * and a registry written row by row. The contract's topology_type is a real enum member here
     * because these cases assert on the EXIT CODE, which any other red would also set.
     * @param {{rows?:(string[]|null), acs?:string[], covers?:string}} parts - Registry rows (null =
     *   no registry), the board's acceptance-criteria lines, and the contract's covers[] literal.
     * @returns {string} The fixture root.
     */
    const reqTree = ({ rows = null, acs = [], covers = "[]" }) => {
      const cwd = mkdtempSync(join(tmpdir(), "struct-req-uncovered-"));
      w(cwd, `shapeup/${SLUG}/spec/domain-model.md`, "# Domain model\n\n## Entities\n- Todo\n");
      w(cwd, `shapeup/${SLUG}/spec/usecases/UC-AddTodo.md`, "---\nid: UC-AddTodo\n---\n\n# UC-AddTodo\n\n## Steps\n1. [INV-01] text is non-empty\n");
      // A real `TopologyType` member, whatever the shared helper above happens to use: these cases
      // assert on the EXIT CODE, and a contract that fails its own schema reds for CONTRACT-SCHEMA
      // instead — which would make every one of them pass without the new arm existing at all.
      w(cwd, `shapeup/${SLUG}/scopes/SC-1.md`, contract("SC-1", covers).replace(/^topology_type:.*$/m, "topology_type: ICEBERG"));
      if (rows) w(cwd, `shapeup/${SLUG}/requirements.md`, ["# Requirements", "", "| REQ-id | clause | source | status | note |", "|---|---|---|---|---|", ...rows, ""].join("\n"));
      w(cwd, `.shapeup/${SLUG}/tasks/TASK-001.md`, ["---", "id: TASK-001", "title: the one task", "status: todo", "priority: 1",
        "use_case_refs: [UC-AddTodo]", "scope_id: SC-1", "---", "", "## Acceptance criteria", "",
        ...acs.map((a) => `- [ ] ${a}`), ""].join("\n"));
      return cwd;
    };

    /** Lint a fixture and return its REQ-UNCOVERED findings and totals. @param {string} cwd Fixture root. @returns {object} The report plus the filtered findings. */
    const uncovered = (cwd) => {
      const rep = lint({ cwd, slug: SLUG });
      return { rep, hits: rep.findings.filter((f) => f.rule === "REQ-UNCOVERED") };
    };

    const BOTH = [row("REQ-1", "covered"), row("REQ-2", "covered")];
    const AC1 = ["the list survives a restart (covers: REQ-1)"];

    // (h1) one graded, one not.
    {
      const cwd = reqTree({ rows: BOTH, acs: AC1 });
      try {
        const { rep, hits } = uncovered(cwd);
        if (hits.length === 1 && hits[0].scope === "REQ-2" && hits[0].level === "red") {
          ok("(h) a requirement no AC grades and no scope claims is red under REQ-UNCOVERED");
        } else {
          fail(`(h) expected exactly one red REQ-UNCOVERED naming REQ-2, got ${JSON.stringify(hits)}`);
        }
        // THE DISCRIMINATOR. REQ-1 is graded by an AC on the board, and an arm reading the wrong
        // parser cannot see that — it would red this one too, and the assertion above would still
        // pass. This is what says the criteria were actually read.
        if (!hits.some((f) => /REQ-1\b/.test(f.scope))) {
          ok("(h) …and REQ-1, graded by an AC carrying (covers: REQ-1), is NOT reported — the arm reads the board parser that carries acceptance_criteria");
        } else {
          fail("(h) REQ-1 is graded by an AC on the board and was still reported uncovered — the arm is reading a board parser with no acceptance_criteria field, so it reds every requirement on every run");
        }
        // The detail has to be actionable by the PO alone: which clause, where it came from, and
        // the two ways out. An id on its own sends them back to the pitch to find out what broke.
        const d = hits[0]?.detail || "";
        if (/shaping\.md R2/.test(d) && /the clause for REQ-2/.test(d) && /covers: REQ-2/.test(d) && /CUT \(PO-approved\)/.test(d)) {
          ok("(h) the finding carries the source cell, the clause text and both ways out — cover it, or cut it on the record");
        } else {
          fail(`(h) the REQ-UNCOVERED detail does not name the source, the clause and both remedies: "${d}"`);
        }
        if (rep.red === 1) ok("(h) the uncovered requirement is the tree's only red — nothing else in a clean plan is disturbed by the new arm");
        else fail(`(h) a tree whose only defect is one uncovered requirement linted red=${rep.red}: ${JSON.stringify(rep.findings.map((f) => f.rule))}`);
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (h2) CUT is an answer already given, not a gap. The PO's way out has to actually work, or the
    // gate is unpassable on any pitch with a requirement this shape deliberately drops.
    {
      const cwd = reqTree({ rows: [row("REQ-1", "covered"), row("REQ-2", "CUT (PO-approved)")], acs: AC1 });
      try {
        const { rep, hits } = uncovered(cwd);
        if (hits.length === 0 && rep.red === 0) ok("(h) a requirement marked CUT (PO-approved) is not uncovered — the gate goes green on the PO's recorded answer");
        else fail(`(h) a CUT requirement still fired: red=${rep.red} ${JSON.stringify(hits.map((f) => f.detail))}`);
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (h3) The arm is about requirements NOTHING reaches, not about which layer reaches them. A
    // clause a contract claims has an owner who answers for it at L1b, even before the criterion
    // that grades it is written — and the claim is read in the one key space, so `R2` counts.
    {
      const cwd = reqTree({ rows: BOTH, acs: AC1, covers: "[R2]" });
      try {
        const { rep, hits } = uncovered(cwd);
        if (hits.length === 0 && rep.red === 0) ok("(h) a requirement claimed by a scope's covers: is not REQ-UNCOVERED — the arm asks whether anything reaches it, not which layer does");
        else fail(`(h) a scope claiming R2 did not answer for REQ-2: red=${rep.red} ${JSON.stringify(hits.map((f) => f.detail))}`);
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (h4) ABSENT ARTIFACT ⇒ ARM SKIPPED — the same non-regression rule INV-FLOOR and SCOPE-COVERS
    // follow. The board here carries a covers: clause with no registry to resolve it against, which
    // is the exact shape that made trace-lint emit findings out of an arm it reported as skipped.
    {
      const cwd = reqTree({ acs: AC1 });
      try {
        const { rep } = uncovered(cwd);
        const reqFindings = rep.findings.filter((f) => /^REQ-/.test(f.rule));
        if (reqFindings.length === 0 && rep.red === 0) ok("(h) a run with no requirements.md emits no REQ-* finding at all — absent artifact ⇒ arm skipped");
        else fail(`(h) REQ-* findings fired with no registry on disk: ${JSON.stringify(reqFindings)}`);
        // 4R.4: the dangling half stays where it already lives. A second COVERS-DANGLING here would
        // re-report, at a gate, a finding stage 1 deliberately arm-skipped in the oracle.
        if (!rep.findings.some((f) => f.rule === "COVERS-DANGLING")) ok("(h) spec-lint adds no second COVERS-DANGLING — the scope layer surfaces a dangling key first, and the oracle owns the board-side one");
        else fail("(h) spec-lint emitted COVERS-DANGLING — a second implementation of a finding that already has one");
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (h5) END TO END, because the exit code is the gate. `lint()` returning a red finding and the
    // CLI exiting 1 are different claims, and L1b reads the second one.
    {
      const red = reqTree({ rows: BOTH, acs: AC1 });
      const green = reqTree({ rows: BOTH, acs: [...AC1, "it is reachable by keyboard (covers: REQ-2)"] });
      try {
        /** Run the verify spec CLI over a fixture. @param {string} cwd Fixture root. @returns {object} spawnSync result. */
        const cli = (cwd) => spawnSync("node", [join(ROOT, "kernel/harness.mjs"), "verify", "spec", "--slug", SLUG, "--cwd", cwd], { encoding: "utf8" });
        const a = cli(red), b = cli(green);
        if (a.status === 1 && /REQ-UNCOVERED/.test(a.stdout)) ok("(h) `verify spec` exits 1 and prints REQ-UNCOVERED when a live requirement is graded by nothing");
        else fail(`(h) verify spec exited ${a.status} on an uncovered requirement (REQ-UNCOVERED printed: ${/REQ-UNCOVERED/.test(a.stdout)}) — the gate reads the exit code, so the finding alone changes nothing`);
        if (b.status === 0 && !/REQ-UNCOVERED/.test(b.stdout)) ok("(h) …and exits 0 once a second AC covers it — the gate is passable by doing the thing it asks for");
        else fail(`(h) verify spec exited ${b.status} after every requirement was covered by an AC: ${b.stdout.slice(0, 400)}`);
      } finally {
        rmSync(red, { recursive: true, force: true });
        rmSync(green, { recursive: true, force: true });
      }
    }
  }

  // --- (i) THE GATE BLOCK NAMES IT, because a red nobody is told to read is a red nobody reads ---
  {
    const gates = read(join(ROOT, "skills/tech-lead/references/gates.md"));
    const l1b = gates.slice(gates.indexOf("## GATE L1b"), gates.indexOf("## GATE L2"));
    if (/REQ-UNCOVERED/.test(l1b)) ok("(i) GATE L1b lists REQ-UNCOVERED among the reds that hard-stop the plan");
    else fail("(i) GATE L1b's red list never names REQ-UNCOVERED — the orchestrator would print an exit-1 lint and read no instruction about it");
    if (/REQ\s*→\s*AC/.test(l1b)) ok("(i) GATE L1b prints the REQ → AC table beside the Deferred Places — the PO sees which requirement nothing grades before signing off");
    else fail("(i) GATE L1b prints no REQ → AC table — the PO is asked to accept a plan without being shown which requirements it drops");
  }

  // --- (j) THE WAY BACK: verdict → REQ → L4 → census ------------------------------------------
  // L1b asks whether the plan reaches every requirement. This half asks the opposite question at
  // the other end of the run: which requirement did a verdict actually reach? Measured on the first
  // verdict any run of this spine produced — 97 criteria, 85 of them carrying a `traces_to` anchor
  // in the WorkResult, and ZERO of them in the file ingest wrote. The judge recorded the edge and
  // the projection dropped it, so nothing downstream could join a verdict to a pitch clause even
  // when the judge had said which one. The same row carried only the per-file `run` counter, which
  // repeats across runs of one slug, so any projection over it silently mixed two runs.
  {
    const K = join(ROOT, "kernel/harness.mjs");
    const RUN_A = "reqdemo-20260919T101112Z-abcdef01";
    const RUN_B = "reqdemo-20260918T090000Z-11111111";
    const HASH = "9".repeat(64);

    /** A verdict-ledger line. @param {object} o Row fields. @returns {string} One JSONL line. */
    const vrow = (o) => JSON.stringify({ run: 1, dimension: "spec-conformance", confidence: "high", reprobed: false, evidence: "probe output", at: "2026-09-19T10:00:00Z", ...o });

    /**
     * A finished run: a registry, a board whose ACs carry `covers:`, a receipt naming the run, an
     * EVAL result carrying its T0 citation, and the verdict ledger ingest projects.
     * @param {{rows?:(string[]|null), acs?:string[], ledger?:string[]}} parts - Registry rows
     *   (null = no registry at all), the board's AC lines, and the verdict-ledger lines.
     * @returns {string} The fixture root.
     */
    const ran = ({ rows = null, acs = [], ledger = [] }) => {
      const cwd = mkdtempSync(join(tmpdir(), "struct-req-probe-"));
      if (rows) w(cwd, `shapeup/${SLUG}/requirements.md`, ["# Requirements", "", "| REQ-id | clause | source | status | note |", "|---|---|---|---|---|", ...rows, ""].join("\n"));
      w(cwd, `.shapeup/${SLUG}/tasks/TASK-001.md`, ["---", "id: TASK-001", "title: the one task", "status: done", "priority: 1", "---", "", "## Acceptance criteria", "", ...acs.map((a) => `- [x] ${a}`), ""].join("\n"));
      w(cwd, `.shapeup/${SLUG}/receipt.json`, JSON.stringify({ run_id: RUN_A, slug: SLUG }));
      w(cwd, `.shapeup/${SLUG}/results/evaluate-r1.json`, JSON.stringify({
        schema_version: 1, order_id: `${SLUG}/evaluate-r1`, worker: "spec-evaluator", status: "done",
        verdict: { overall: "FAIL", t0_citations: [{ scope_id: "SC-1", path: `.shapeup/${SLUG}/t0/verdicts/r1-a1-t1.json`, sha256: HASH }] },
      }));
      if (ledger.length) w(cwd, `.shapeup/${SLUG}/evaluation/.verdicts-evaluate-r1.jsonl`, ledger.join("\n") + "\n");
      return cwd;
    };

    /** Run the probe over a fixture. @param {string} cwd Fixture root. @param {string[]} extra Extra argv. @returns {object} spawnSync result plus the parsed report. */
    const probe = (cwd, extra = []) => {
      const r = spawnSync("node", [K, "probe", "requirements", "--slug", SLUG, "--cwd", cwd, ...extra], { encoding: "utf8" });
      let json = null;
      try { json = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
      return { r, json };
    };

    const REG = [
      "| REQ-1 | the list survives a restart | shaping.md R1 | covered | |",
      "| REQ-2 | it is reachable by keyboard | shaping.md R2 | covered | |",
      "| REQ-3 | it exports to csv | shaping.md R3 | CUT (PO-approved) | |",
    ];
    const ACS = ["the list survives a restart (covers: REQ-1)", "tab reaches every control (covers: REQ-2)"];

    // (j1) THE PROJECTION INGEST WRITES. Executed, not read: the two fields have to survive the
    // real reducer, because the measured defect was that the judge wrote them and this step did not.
    {
      const cwd = mkdtempSync(join(tmpdir(), "struct-req-ingest-"));
      try {
        w(cwd, `.shapeup/${SLUG}/receipt.json`, JSON.stringify({ run_id: RUN_A, slug: SLUG }));
        const resultPath = join(cwd, ".shapeup", SLUG, "results", "evaluate-r1.json");
        w(cwd, `.shapeup/${SLUG}/results/evaluate-r1.json`, JSON.stringify({
          schema_version: 1, order_id: `${SLUG}/evaluate-r1`, worker: "spec-evaluator", status: "done",
          verdict: { overall: "PASS", criteria: [
            { criterion: "UC-01 step 3", dimension: "spec-conformance", verdict: "PASS", confidence: "high", evidence: "ran it", traces_to: ["REQ-1"] },
            { criterion: "UC-01 step 4", dimension: "spec-conformance", verdict: "PASS", confidence: "high", evidence: "ran it" },
          ] },
        }));
        const r = spawnSync("node", [K, "reduce", "ingest", resultPath, "--cwd", cwd], { encoding: "utf8" });
        const lines = (readFileSync(join(cwd, ".shapeup", SLUG, "evaluation", ".verdicts-evaluate-r1.jsonl"), "utf8"))
          .trim().split("\n").map((l) => JSON.parse(l));
        if (r.status === 0 && lines.length === 2) ok("(j) ingest projected both criteria into the verdict ledger");
        else fail(`(j) ingest exited ${r.status} and wrote ${lines.length} ledger rows: ${r.stderr.slice(0, 300)}`);
        if (lines.every((l) => l.run_id === RUN_A)) {
          ok("(j) every projected row carries the run key read off the receipt — `run` alone repeats across runs of one slug");
        } else {
          fail(`(j) the verdict ledger rows carry run_id=${JSON.stringify(lines.map((l) => l.run_id))} — without the run key any projection over this file mixes two runs of one feature`);
        }
        if (JSON.stringify(lines[0].traces_to) === JSON.stringify(["REQ-1"]) && JSON.stringify(lines[1].traces_to) === JSON.stringify([])) {
          ok("(j) the judge's traces_to anchor survives the projection, and a criterion with none reads as an empty list, not an absent field");
        } else {
          fail(`(j) traces_to did not survive ingest: ${JSON.stringify(lines.map((l) => l.traces_to))} — the judge records which requirement its criterion maps to and the projection throws it away`);
        }
      } catch (e) { fail(`(j) the ingest projection check threw: ${e.message}`); }
      finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (j2) THE QUERY, over a run with a registry, a covered board and one graded criterion.
    {
      const cwd = ran({ rows: REG, acs: ACS, ledger: [
        vrow({ run_id: RUN_A, criterion: "UC-01 step 3 persists", verdict: "PASS", traces_to: ["REQ-1"] }),
        vrow({ run_id: RUN_A, criterion: "keyboard reach", verdict: "FAIL", evidence: "src/a.ts:3", traces_to: ["REQ-2"] }),
      ] });
      try {
        const { r, json } = probe(cwd);
        if (r.status === 0 && json) ok("(j) probe requirements answers from disk and exits 0");
        else fail(`(j) probe requirements exited ${r.status}: ${r.stderr.slice(0, 300)}`);
        const byId = Object.fromEntries((json?.rows || []).map((x) => [x.id, x]));
        if (json?.rows?.length === 3 && byId["REQ-1"]?.evidence === "PASS") {
          ok("(j) a requirement an AC covers and a passing criterion names is reported as PASS");
        } else {
          fail(`(j) the matrix did not report REQ-1 as PASS: ${JSON.stringify(json?.rows?.map((x) => [x.id, x.evidence]))}`);
        }
        if (byId["REQ-1"]?.source === "shaping.md R1" && byId["REQ-1"]?.covering_acs?.[0]?.task_id === "TASK-001"
          && byId["REQ-1"]?.criteria?.[0]?.criterion === "UC-01 step 3 persists") {
          ok("(j) the row carries the pitch clause it came from, the AC that covers it and the criterion that graded it");
        } else {
          fail(`(j) the REQ-1 row is missing its source, its covering AC or its criterion: ${JSON.stringify(byId["REQ-1"])}`);
        }
        // The T0 hash is what makes a PASS a machine fact rather than a sentence, and it lives in
        // the EVAL result rather than the ledger — a row that cannot reach it is a row whose
        // evidence cannot be re-verified.
        if (byId["REQ-1"]?.t0?.[0] === HASH) ok("(j) the row cites the T0 artifact hash the EVAL round that graded it re-hashed");
        else fail(`(j) the REQ-1 row cites no T0 hash: ${JSON.stringify(byId["REQ-1"]?.t0)} — the evidence behind a PASS cannot be re-checked from the matrix`);
        // (b) covered, graded, and the grade was not a PASS.
        if (byId["REQ-2"]?.evidence === "no evidence" && byId["REQ-2"]?.criteria?.[0]?.verdict === "FAIL") {
          ok("(j) a requirement whose covering AC was graded FAIL reads as `no evidence`, with the failing criterion beside it");
        } else {
          fail(`(j) REQ-2 was reported as ${byId["REQ-2"]?.evidence} — a criterion that did not pass is not evidence the requirement holds`);
        }
        // (c) CUT is counted separately, never as a gap and never as a pass.
        if (byId["REQ-3"]?.evidence === "cut" && json.totals.cut === 1 && json.totals.pass === 1 && json.totals.no_evidence === 1) {
          ok("(j) a CUT (PO-approved) requirement is counted as cut — separately from PASS and from the gaps");
        } else {
          fail(`(j) the totals fold CUT into another class: ${JSON.stringify(json?.totals)}`);
        }
        // The L4 line is transcribed from this, so its shape is part of the contract.
        const { summaryLine } = await import(join(ROOT, "kernel/probe/requirements.mjs"));
        const line = summaryLine(json);
        if (/1\/3 PASS/.test(line) && /1 CUT \(PO\)/.test(line) && /REQ-2 ← shaping\.md R2/.test(line)) {
          ok(`(j) the summary line GATE L4 transcribes names the gap and where it came from: "${line}"`);
        } else {
          fail(`(j) the summary line is not the L4 shape: "${line}"`);
        }
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (j3) THE EMPTY JOIN READS AS CLEARLY AS THE FULL ONE. No registry is the state every run was
    // in before this stage, and it is the state a pre-spine run stays in forever; the probe answers
    // it rather than failing on it.
    {
      const cwd = ran({ acs: ACS });
      try {
        const { r, json } = probe(cwd);
        if (r.status === 0 && json?.registry === false && json?.rows?.length === 0 && json?.totals?.total === 0) {
          ok("(j) with no registry the probe exits 0 with an empty projection — an answer, not an error");
        } else {
          fail(`(j) the probe over a registry-less run exited ${r.status} with ${JSON.stringify(json?.totals)} — an absent artifact must read as empty, never as a failure`);
        }
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (j4) `covers:` IS THE AUTHORITATIVE JOIN. An anchor pointing at a requirement no AC covers is
    // a claim the plan never made. Counting it would derive the L4 line from two unreconciled
    // sources — the exact failure `probe owner` exists to prevent — so it is printed and not counted.
    {
      // REQ-4 is LIVE and uncovered, which is what makes this case discriminate: an implementation
      // that trusted the anchor alone would report it PASS on the judge's say-so, with no
      // acceptance criterion anywhere claiming the requirement.
      const cwd = ran({ rows: [...REG, "| REQ-4 | it is themeable | shaping.md R4 | covered | |"], acs: ACS, ledger: [
        vrow({ run_id: RUN_A, criterion: "theme switch works", verdict: "PASS", traces_to: ["REQ-4"] }),
      ] });
      try {
        const { json } = probe(cwd);
        const inc = json?.inconsistencies || [];
        if (inc.length === 1 && inc[0].requirement === "REQ-4" && inc[0].verdict === "PASS") {
          ok("(j) a criterion anchored to a requirement no AC covers is printed as an inconsistency row");
        } else {
          fail(`(j) the unreconciled anchor was not reported: ${JSON.stringify(inc)}`);
        }
        const req4 = (json?.rows || []).find((x) => x.id === "REQ-4");
        if (json?.totals?.pass === 0 && req4?.evidence === "no evidence") {
          ok("(j) …and is counted as nothing — a PASS anchored to a requirement the plan never claimed is not evidence for it");
        } else {
          fail(`(j) an unreconciled anchor was counted as evidence: totals=${JSON.stringify(json?.totals)} REQ-4=${req4?.evidence}`);
        }
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (j5) ONE RUN, NAMED. `order_id`, round and attempt all repeat; the run key is the only thing
    // that separates two runs of one feature, and rows written before it existed are reported as
    // unknown rather than folded into the run being read.
    {
      const cwd = ran({ rows: REG, acs: ACS, ledger: [
        vrow({ run_id: RUN_A, criterion: "UC-01 step 3 persists", verdict: "PASS", traces_to: ["REQ-1"] }),
        vrow({ run_id: RUN_B, criterion: "an older run's pass", verdict: "PASS", traces_to: ["REQ-2"] }),
        vrow({ criterion: "a row written before the key existed", verdict: "PASS", traces_to: ["REQ-2"] }),
      ] });
      try {
        const { json } = probe(cwd);
        const byId = Object.fromEntries((json?.rows || []).map((x) => [x.id, x]));
        if (json?.run_id === RUN_A && json?.ledger?.rows_projected === 1 && json?.ledger?.rows_other_run === 1) {
          ok("(j) the probe projects only the run its receipt names, and says how many rows belonged to another");
        } else {
          fail(`(j) the projection did not isolate one run: run_id=${json?.run_id} ledger=${JSON.stringify(json?.ledger)}`);
        }
        if (json?.ledger?.rows_unknown_run === 1 && byId["REQ-2"]?.evidence === "no evidence") {
          ok("(j) an unkeyed row is reported as unknown and not folded into the current run — REQ-2 stays without evidence");
        } else {
          fail(`(j) an unkeyed or foreign row leaked into this run's evidence: REQ-2=${byId["REQ-2"]?.evidence} ledger=${JSON.stringify(json?.ledger)}`);
        }
        // The other run's own key answers for its own rows.
        const other = probe(cwd, ["--run-id", RUN_B]);
        if (other.json?.rows?.find((x) => x.id === "REQ-2")?.evidence === "PASS") {
          ok("(j) …and naming the other run projects that run instead — the rows were isolated, not discarded");
        } else {
          fail(`(j) --run-id did not project the named run: ${JSON.stringify(other.json?.totals)}`);
        }
      } finally { rmSync(cwd, { recursive: true, force: true }); }
    }

    // (j6) FROZEN IN THE REPORT. The matrix is derived from the LOCAL tier, which is gitignored and
    // is cleaned up after a run; GATE L4 is the one moment it can be written down where a teammate
    // will find it on `git pull`.
    {
      const SR = await import(join(ROOT, "kernel/reduce/ship.mjs"));
      const full = ran({ rows: REG, acs: ACS, ledger: [
        vrow({ run_id: RUN_A, criterion: "UC-01 step 3 persists", verdict: "PASS", traces_to: ["REQ-1"] }),
      ] });
      const bare = ran({ acs: ACS });
      try {
        const md = SR.generate({ cwd: full, slug: SLUG }).markdown;
        if (/^## Requirements$/m.test(md) && /REQ-1/.test(md) && /shaping\.md R1/.test(md)) {
          ok("(j) reduce ship freezes a ## Requirements section naming each clause and where it came from");
        } else {
          fail("(j) the ship report has no ## Requirements section — the matrix dies with the gitignored tier it was derived from");
        }
        if (/1\/3 PASS/.test(md)) ok("(j) …carrying the same summary the L4 line transcribed, derived by the same probe");
        else fail(`(j) the report's requirement summary does not match the probe's: ${(md.match(/\*\*[^*]*PASS[^*]*\*\*/) || ["(none)"])[0]}`);
        const bareMd = SR.generate({ cwd: bare, slug: SLUG }).markdown;
        if (!/## Requirements/.test(bareMd)) {
          ok("(j) a run with no registry gets no Requirements section — an empty table reads as “no requirements”, which is a different claim");
        } else {
          fail("(j) the ship report printed a Requirements section for a run with no registry — an empty table asserts something the run never measured");
        }
      } finally {
        rmSync(full, { recursive: true, force: true });
        rmSync(bare, { recursive: true, force: true });
      }
    }

    // (j7) THE TWO READERS CITE THE QUERY. A figure narrated from memory at a gate is
    // indistinguishable from a measured one, which is why ownership already works this way.
    {
      const gates = read(join(ROOT, "skills/tech-lead/references/gates.md"));
      const l4 = gates.slice(gates.indexOf("## GATE L4 — Ship Sign-Off"));
      if (/^Requirements\s*:/m.test(l4)) ok("(j) GATE L4's block prints a Requirements line");
      else fail("(j) GATE L4 prints no Requirements line — the run signs off without saying which pitch clauses have evidence");
      if (/probe requirements/.test(l4)) ok("(j) …and says to transcribe it from `probe requirements`, not to compose it");
      else fail("(j) GATE L4's Requirements line cites no query — a line composed at the gate is a claim, not a measurement");

      const hammer = read(join(ROOT, "skills/scope-hammer/SKILL.md"));
      const h0 = hammer.slice(hammer.indexOf("## GATE H0"), hammer.indexOf("## GATE H1"));
      if (/probe requirements/.test(h0) && /no (PASS )?evidence/i.test(h0)) {
        ok("(j) GATE H0's census takes requirements with no PASS evidence from the probe, and cites it");
      } else {
        fail("(j) GATE H0 never censuses requirements with no evidence — the clause nothing verified is invisible exactly where the ship decision is made");
      }
      // §5 of the plan this came from: the matrix informs the baseline comparison, it never vetoes.
      if (/never block|never a ship blocker|does not block|not a ship blocker|decides nothing/i.test(l4.slice(0, 1400))) {
        ok("(j) …and L4 says the line decides nothing — the matrix is a projection, never a verdict");
      } else {
        fail("(j) nothing at L4 says the requirement line is not a gate — a printed matrix beside a sign-off reads as a blocker");
      }
    }

    // (j8) THE JUDGE FILLS THE FIELD IT ALREADY HAD. The schema has carried `traces_to` as an
    // optional navigation anchor all along; what was missing was any instruction to populate it,
    // and a field nobody fills is indistinguishable from a field that does not exist.
    {
      const judge = read(join(ROOT, "skills/spec-evaluator/SKILL.md"));
      if (/traces_to/.test(judge) && /covers:/.test(judge)) {
        ok("(j) spec-evaluator's craft says to fill traces_to from the graded ACs' covers: clauses");
      } else {
        fail("(j) spec-evaluator is never told to populate traces_to — the anchor stays empty and the matrix has nothing to join on");
      }
      if (/never a grading input|not a grading input|navigation/i.test(judge)) {
        ok("(j) …and that it changes nothing it grades — the anchor is navigation, exactly what the schema calls it");
      } else {
        fail("(j) the craft does not say traces_to is not a grading input — a judge that reads it as one is grading against a key instead of the spec");
      }
    }
  }
}
