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
    const domain = readJSON(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"));
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
      const schema = readJSON(join(ROOT, "skills/tech-lead/schemas/work-order.schema.json"));
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
}
