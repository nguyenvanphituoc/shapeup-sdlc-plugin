// Structural module — Day-1 / Day-2 measurement instrument (Graph Engineering §VI.A–B).
// Section: 48. Byte-identical body style to its siblings; the runner threads the shared ctx.
//
// What this module is for. The paper's first two rungs each end in a NUMBER — Day 1 exits on
// "measured quality improvement", Day 2 on "tool reduces known error class" (Table II). A rung
// whose instrument is merely present is not passed; it is claimed. So this module does not check
// that the rubric files exist. It runs the scorer, asserts it SEPARATES a known-bad draft from a
// known-good one, tampers with the good draft and asserts the score falls, and holds every
// baseline to the same honesty invariant §16 already applies to the trigger-eval layer.
//
// The negative controls are the point, exactly as in §9–§11 (the oracle fixtures) and §13 (the
// anti-leniency fixture): a grader that cannot fail a bad input is not a grader, and a register
// that cannot tell a measured rate from an absent one is not evidence.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { validateFile, validate } from "../../skills/tech-lead/scripts/validate-envelope.mjs";
import { loadRubrics, listSkills, scoreDraft, selftest, coverage } from "../../tools/skill-loop.mjs";

/**
 * Run the Day-1/Day-2 instrument checks.
 * @param {object} ctx - Shared structural-test context from tests/lib/harness.mjs.
 * @returns {Promise<void>} Resolves when every check in section 48 has been recorded on ctx.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;
  const SCHEMAS = join(ROOT, "evals", "schemas");

  // =============================================================================
  section("48. Day-1 loop + Day-2 failure register are instruments, not decorations");
  // =============================================================================

  // ---- (a) the three schemas exist and parse ----------------------------------
  const schemaFiles = ["day1-rubric.schema.json", "day1-loop-run.schema.json", "day2-failure-class.schema.json"];
  for (const s of schemaFiles) {
    const p = join(SCHEMAS, s);
    if (!existsSync(p)) { fail(`evals/schemas/${s} missing`); continue; }
    try { readJSON(p); ok(`evals/schemas/${s} parses`); }
    catch (e) { fail(`evals/schemas/${s} does not parse: ${e.message}`); }
  }

  // ---- (b) every Day-1 rubric is well-formed ----------------------------------
  const skills = new Set(listSkills(ROOT));
  const rubrics = loadRubrics(ROOT);
  if (rubrics.length === 0) fail("no Day-1 rubric found — the loop rung has no instrument at all");
  else ok(`Day-1 rubrics present for ${rubrics.length}/${skills.size} skill(s)`);

  for (const entry of rubrics) {
    const rel = `skills/${entry.skill}/evals/day1-rubric.json`;
    const v = validateFile(entry.file, join(SCHEMAS, "day1-rubric.schema.json"));
    if (v.valid) ok(`${rel} validates against day1-rubric.schema.json`);
    else fail(`${rel} fails its schema: ${v.errors.join("; ")}`);

    if (entry.rubric.skill === entry.skill) ok(`${rel} names its own skill`);
    else fail(`${rel} declares skill "${entry.rubric.skill}" but lives under ${entry.skill}`);

    // A rubric needs BOTH polarities. An all-`must` rubric cannot detect the leniency failure
    // mode at all (a lenient draft omits things; it does not add forbidden ones), and an
    // all-`must_not` rubric scores an empty file perfectly.
    const musts = entry.rubric.criteria.filter((c) => c.kind === "must").length;
    const mustNots = entry.rubric.criteria.filter((c) => c.kind === "must_not").length;
    // The polarity floor exists for AUTHORED rubrics: all-`must` cannot catch the leniency failure
    // mode (a lenient draft omits things, it does not add forbidden ones) and all-`must_not` scores
    // an empty file perfectly. Neither hazard applies when the criterion delegates to an oracle —
    // the oracle already contains the polarity internally (todo.contract.json carries six rows,
    // four of them negative edge cases). Requiring six hand-written criteria in front of it would
    // re-introduce exactly the authorship Tier 1 exists to remove.
    const delegated = entry.rubric.criteria.every((c) => c.detector.kind === "oracle");
    if (delegated) ok(`${rel}: fully oracle-delegated (${entry.rubric.criteria.length} criteria) — polarity floor N/A`);
    else if (musts >= 3 && mustNots >= 2) ok(`${rel}: ${musts} must / ${mustNots} must_not criteria`);
    else fail(`${rel} needs >=3 must and >=2 must_not criteria (got ${musts}/${mustNots})`);

    const ids = entry.rubric.criteria.map((c) => c.id);
    if (new Set(ids).size === ids.length) ok(`${rel} criterion ids are unique`);
    else fail(`${rel} has duplicate criterion ids`);

    // Every detector must be a compilable regex — a broken one silently never fires, which reads
    // as "criterion satisfied" for a must_not and would quietly inflate every score.
    let badRe = 0;
    for (const c of entry.rubric.criteria) {
      try { new RegExp(c.detector.pattern, c.detector.flags || ""); }
      catch { fail(`${rel} criterion "${c.id}" has an uncompilable detector`); badRe++; }
    }
    if (badRe === 0) ok(`${rel} every detector compiles`);

    // Each criterion must carry the model-judge head too, so the second head can be added later
    // over the same rubric rather than a restated one.
    const noAssertion = entry.rubric.criteria.filter((c) => !c.assertion || c.assertion.length < 10);
    if (noAssertion.length === 0) ok(`${rel} every criterion carries a judge assertion`);
    else fail(`${rel} criteria without a usable assertion: ${noAssertion.map((c) => c.id).join(", ")}`);
  }

  // ---- (c) THE BEHAVIORAL CHECK: does the rubric discriminate? ----------------
  // This is what separates section 48 from a linter. Same shape as §9–§11.
  for (const entry of rubrics) {
    const r = selftest(entry);
    if (r.pass) ok(`${entry.skill} rubric discriminates: weak ${r.weak} → strong ${r.strong} (separation ${r.separation})`);
    else for (const e of r.errors) fail(`${entry.skill} rubric selftest: ${e}`);

    if (!r.loop) continue;
    const lv = validate(r.loop, readJSON(join(SCHEMAS, "day1-loop-run.schema.json")), SCHEMAS);
    if (lv.valid) ok(`${entry.skill} loop record validates against day1-loop-run.schema.json`);
    else fail(`${entry.skill} loop record fails its schema: ${lv.errors.join("; ")}`);

    // The stored artifacts ARE the rung's requirement ("store every artifact"), so their absence
    // is a failure of Day 1 itself, not of bookkeeping.
    if (r.loop.versions.length >= 2) ok(`${entry.skill} loop stored ${r.loop.versions.length} versions (first draft + revision)`);
    else fail(`${entry.skill} loop stored only ${r.loop.versions.length} version — no revision step was exercised`);
    if (r.loop.quality.improved && r.loop.quality.delta > 0) ok(`${entry.skill} loop records a positive quality delta (${r.loop.quality.delta})`);
    else fail(`${entry.skill} loop records no quality improvement — Day-1's exit criterion is unmet`);
    if (r.loop.mode === "selftest" && r.loop.model === null && r.loop.cost === null) ok(`${entry.skill} selftest record is marked zero-spend (mode selftest, no model, no cost)`);
    else fail(`${entry.skill} selftest record does not declare itself synthetic — a selftest score could be misread as measured`);
    // Provenance on every version: a synthetic draft may never be mistaken for model output.
    if (r.loop.versions.every((v) => v.source.startsWith("reference-"))) ok(`${entry.skill} every selftest version is marked reference-*, never "model"`);
    else fail(`${entry.skill} a selftest version claims source "model" — synthetic text laundered as measured output`);
  }

  // ---- (d) TAMPER CONTROL: the scorer is content-sensitive, not a rubber stamp -
  // Delete the verdict line from the strong draft and the score MUST fall. A scorer that returns
  // the same number for mutilated input is measuring nothing, and would report "no regression"
  // forever. (F-16 in miniature: green, and inert.)
  for (const entry of rubrics) {
    const strongPath = join(entry.dir, entry.rubric.fixture.reference_drafts.strong);
    if (!existsSync(strongPath)) continue;
    // A workspace rubric's artifact is a DIRECTORY, so the mutilation has to be one: remove the
    // deliverable the oracle runs. Deleting text from a transcript proves nothing about a rubric
    // that never reads the transcript.
    if (entry.rubric.grades === "workspace") {
      const { prepareWorkspace } = await import("../../tools/skill-loop.mjs");
      const good = prepareWorkspace(entry.rubric, strongPath);
      const intactWs = scoreDraft("", entry.rubric, { workspace: good }).score;
      const gutted = prepareWorkspace(entry.rubric, null);   // seed only — no deliverable
      const goneWs = scoreDraft("", entry.rubric, { workspace: gutted }).score;
      if (intactWs > goneWs) ok(`${entry.skill} scorer is artifact-sensitive (deliverable removed: ${intactWs} → ${goneWs})`);
      else fail(`${entry.skill} scored ${goneWs} for a workspace with NO deliverable (intact ${intactWs}) — the oracle is not reading the artifact`);
      continue;
    }
    const strong = read(strongPath);
    const intact = scoreDraft(strong, entry.rubric).score;
    // The mutilation has to match the artifact. Stripping a markdown verdict line does nothing to a
    // JSON envelope, so a prose-shaped tamper would pass a work-result rubric while proving nothing.
    let mutilated;
    if (entry.rubric.grades === "work-result") {
      const o = JSON.parse(strong);
      delete o.verdict;                      // remove the graded contract, keep it valid JSON
      mutilated = JSON.stringify(o, null, 2);
    } else {
      mutilated = strong.replace(/^\s*\*{0,2}overall verdict\*{0,2}\s*:.*$/gim, "");
    }
    const tampered = scoreDraft(mutilated, entry.rubric).score;
    if (tampered < intact) ok(`${entry.skill} scorer is content-sensitive (verdict removed: ${intact} → ${tampered})`);
    else fail(`${entry.skill} scorer returned ${tampered} for a draft with its verdict removed (was ${intact}) — it is not reading the draft`);

    // An empty draft must score at or below the weak floor. This catches an all-must_not rubric,
    // which would score a blank file 1.0.
    const empty = scoreDraft("", entry.rubric).score;
    const maxWeak = entry.rubric.discrimination?.max_weak_score ?? 0.5;
    if (empty <= maxWeak) ok(`${entry.skill} empty draft scores ${empty} (<= weak floor ${maxWeak})`);
    else fail(`${entry.skill} empty draft scores ${empty}, above the weak floor ${maxWeak} — the rubric rewards saying nothing`);
  }

  // ---- (d1b) VACUOUS TRUTH IS NOT A PASS -------------------------------------
  // The hazard a lint-delegated rubric has and an oracle-that-runs-the-code does not. `spec-lint`
  // reports no PA1 finding for a scopes/ directory that is empty, and `trace-lint` reports no
  // unreachable engine for a wiring map with no rows — so a rubric that reads "no finding" as
  // "passed" scores an artifact that was never written 3 of 3 on its delegated rules, and the
  // score climbs as more rules are delegated. (d) above asserts an unwritten deliverable scores
  // BELOW the intact one; this asserts the stronger and correct thing: it scores exactly ZERO. The
  // renderers implement it by failing every row when the artifact they grade is absent, and the
  // assertion is here so the guard cannot be quietly dropped while every other check stays green.
  {
    const { prepareWorkspace, deliverablePaths, seedEntry } = await import("../../tools/skill-loop.mjs");
    for (const entry of rubrics.filter((e) => e.rubric.grades === "workspace")) {
      const seedOnly = prepareWorkspace(entry.rubric, null);
      const s = scoreDraft("", entry.rubric, { workspace: seedOnly }).score;
      // BROWNFIELD FIXTURES SEED THEIR OWN DELIVERABLE, so "the artifact was never written" has no
      // instance: `task-executor`'s dial-three fixture hands over a working CLI and grades whether
      // an added command breaks it. The guard's INTENT is preserved rather than dropped — what it
      // exists to prevent is a score that is already full before the skill does anything, so for a
      // seeded deliverable the assertion becomes "the handed-in baseline must NOT already pass".
      // A fixture whose seed scores min_strong is a fixture with no work in it.
      const dp = deliverablePaths(entry.rubric);
      const seededTo = (entry.rubric.fixture.seed || []).map((e) => seedEntry(e).to);
      const brownfield = dp.some((p) => seededTo.some((t) => p === t || p.startsWith(`${t}/`) || t.startsWith(`${p}/`)));
      const floor = entry.rubric.discrimination?.min_strong_score ?? 1;
      if (!brownfield) {
        if (s === 0) ok(`${entry.skill} scores 0 for a workspace with no deliverable — no rule passes vacuously`);
        else fail(`${entry.skill} scored ${s} for a workspace where the deliverable was never written — a rule whose subject is absent is being read as satisfied, and the score rises with every rule delegated`);
      } else if (s < floor) {
        ok(`${entry.skill} seeds its deliverable (brownfield); the handed-in baseline scores ${s}, below the strong bar ${floor} — there is real work in the fixture`);
      } else {
        fail(`${entry.skill} seeds its deliverable and that baseline ALREADY scores ${s} (>= ${floor}) — the fixture is complete before the skill touches it, so any run would approve on round 1 by doing nothing`);
      }
    }
  }

  // ---- (d2) any COMMITTED measure record is a real, schema-valid measurement ---
  // Measure records are tracked (unlike selftest records) because they cost money to produce and
  // are the only evidence a quality number ever existed. So they are held to the schema, and to the
  // rule that a measure record names a model and carries model-authored versions.
  const runsDir = join(ROOT, "evals", "runs");
  if (existsSync(runsDir)) {
    const { readdirSync } = await import("node:fs");
    const measured = readdirSync(runsDir).filter((f) => /\.measure(\.r\d+)?\.json$/.test(f));
    for (const f of measured) {
      const rec = readJSON(join(runsDir, f));
      const mv = validate(rec, readJSON(join(SCHEMAS, "day1-loop-run.schema.json")), SCHEMAS);
      if (mv.valid) ok(`evals/runs/${f} validates against day1-loop-run.schema.json`);
      else fail(`evals/runs/${f} fails its schema: ${mv.errors.join("; ")}`);
      if (rec.mode === "measure" && rec.model) ok(`evals/runs/${f} names the model it measured`);
      else fail(`evals/runs/${f} is a committed measure record with mode "${rec.mode}" and model ${JSON.stringify(rec.model)} — an unlabeled quality number measures nothing`);
      if (rec.versions.every((v) => v.source === "model")) ok(`evals/runs/${f} contains only model-authored versions`);
      else fail(`evals/runs/${f} mixes reference-* fixture text into a MEASURED record — synthetic output laundered as measurement`);
    }
    if (measured.length) ok(`${measured.length} committed measure record(s) checked`);
  }

  // ---- (d3) the ORACLE detector discriminates, and knows broken from bad -------
  // Tier 1's whole premise is that an existing script replaces authored criteria, so the detector
  // that calls it has to be proven the same way §9-§11 prove the oracles themselves: it must PASS a
  // known-good artifact, FAIL a known-bad one, and — the part that is easy to get wrong — treat an
  // oracle USAGE error (exit 2) as a broken instrument rather than a bad artifact. Scoring a
  // misconfigured oracle as a failing skill is the turn-cap incident in a new costume.
  {
    const testOracle = "node oracles/test-oracle.mjs examples/lib-mathx/mathx.contract.json";
    const green = scoreDraft("", { grades: "oracle", criteria: [{
      id: "t0-green", kind: "must", dimension: "verification", weight: 1,
      assertion: "The declared test contract passes.",
      detector: { kind: "oracle", cmd: testOracle } }] }, { workspace: ROOT });
    if (green.score === 1) ok("oracle detector PASSes the green mathx contract");
    else fail(`oracle detector failed a known-GOOD artifact (score ${green.score}) — it is not reading the oracle`);

    // A missing contract is a usage error (exit 2) → must THROW, not quietly score 0.
    try {
      const red = scoreDraft("", { grades: "oracle", criteria: [{
        id: "t0-red", kind: "must", dimension: "verification", weight: 1,
        assertion: "A red suite must not pass.",
        detector: { kind: "oracle", cmd: "node oracles/test-oracle.mjs examples/lib-mathx/does-not-exist.json" } }] }, { workspace: ROOT });
      fail(`oracle detector scored ${red.score} for a MISCONFIGURED oracle — a usage error must abort, not count as a failing artifact`);
    } catch (e) {
      if (/usage|contract error|exited 2|could not run|no parseable/i.test(e.message)) ok("oracle detector aborts on a misconfigured oracle instead of scoring it as a bad artifact");
      else fail(`oracle detector threw an unexpected error: ${e.message}`);
    }
  }

  // ---- (d4) the REVISION INSTRUCTION carries the evidence, end to end ----------
  // Day 1 has four parts and the revision step is the one this harness kept failing to deliver.
  // Three separate defects broke the same chain — detectOracle truncated the report to 140 chars,
  // scoreDraft re-clipped it to 160, and changesFrom dropped it entirely on the `must` branch — and
  // each fix looked complete while the next link still discarded the text. Measured cost: two paid
  // runs, 5 rounds each, zero improvement, on a deliverable already passing 4 of 5 contract rows.
  // So the assertion is end-to-end (oracle -> score -> instruction), not per-link.
  {
    const { changesFrom, prepareWorkspace } = await import("../../tools/skill-loop.mjs");
    for (const entry of rubrics.filter((e) => e.rubric.criteria.some((c) => c.detector.kind === "oracle"))) {
      const weakSrc = join(entry.dir, entry.rubric.fixture.reference_drafts.weak);
      const ws = entry.rubric.grades === "workspace" ? prepareWorkspace(entry.rubric, weakSrc) : ROOT;
      const review = scoreDraft("", entry.rubric, { workspace: ws });
      const instruction = changesFrom(review, entry.rubric).join("\n");
      if (/\bFAIL\b/i.test(instruction) && instruction.length > 200) {
        ok(`${entry.skill} revision instruction carries the oracle's failing rows (${instruction.length} chars)`);
      } else {
        fail(`${entry.skill} revision instruction does not name what failed (${instruction.length} chars) — the loop would revise blind: ${JSON.stringify(instruction.slice(0, 160))}`);
      }
    }
  }

  // ---- (d5) a row-scored criterion returns PARTIAL credit ---------------------
  // The weak/strong separation in (a) is necessary and was never sufficient: a scorer that answers
  // only 0 or 1 passes it perfectly while being unable to say anything about an artifact that is
  // nearly right. That is not hypothetical — it is the measured state of this instrument before
  // `detector.rows` existed. Three paid runs, fifteen rounds, fourteen of them at 4-of-5 contract
  // rows, every single one recorded as 0.0. The delta the whole rung exits on was therefore pinned:
  // no revision could move a number that had only two values, and the run records showed a flat 0
  // for a deliverable that needed one edge case fixed.
  //
  // So the assertion is ORDERING, not a magic constant: weak < partial < strong, with the partial
  // artifact still UNSATISFIED so a stopping rule of approve_at 1.0 keeps meaning what it says.
  {
    const { prepareWorkspace } = await import("../../tools/skill-loop.mjs");
    // Keyed on the FIXTURE, not on `detector.rows`. Keying it on the detector was tried and is a
    // guard that disarms itself: deleting `rows` from the rubric — the exact regression this block
    // exists to catch — removed the rubric from the filter and the suite went green on binary
    // scoring again. Verified by mutation. A committed `partial` draft is a standing claim that this
    // rubric can score between its endpoints, and only the rubric's author can withdraw it.
    for (const entry of rubrics.filter((e) => e.rubric.criteria.some((c) => c.detector.kind === "oracle"))) {
      const refs = entry.rubric.fixture.reference_drafts;
      const usesRows = entry.rubric.criteria.some((c) => c.detector.rows);
      if (usesRows && !refs.partial) {
        fail(`${entry.skill} uses detector.rows but ships no \`partial\` reference draft — nothing proves the score can land between 0 and 1, which is the only reason rows exist`);
        continue;
      }
      if (!refs.partial) continue;
      const score = (rel) => {
        const ws = prepareWorkspace(entry.rubric, join(entry.dir, rel));
        return scoreDraft("", entry.rubric, { workspace: ws });
      };
      const weak = score(refs.weak).score;
      const partial = score(refs.partial);
      const strong = score(refs.strong).score;
      if (partial.score > weak && partial.score < strong) {
        ok(`${entry.skill} row-scored criterion gives partial credit (weak ${weak} < partial ${partial.score} < strong ${strong})`);
      } else {
        fail(`${entry.skill} scored its PARTIAL reference ${partial.score}, outside (weak ${weak}, strong ${strong}) — the criterion is still all-or-nothing, so a revision round has no number to move`);
      }
      const c = partial.criteria.find((r) => r.rows);
      if (c && c.satisfied === false && c.fraction > 0 && c.fraction < 1) {
        ok(`${entry.skill} partial draft is scored ${c.fraction} but NOT satisfied — approve_at ${entry.rubric.stopping_rule.approve_at} still requires every row`);
      } else {
        fail(`${entry.skill} partial draft: expected satisfied=false with 0 < fraction < 1, got satisfied=${c && c.satisfied} fraction=${c && c.fraction} — partial credit must not be able to approve an incomplete artifact`);
      }
      // A must_not may never take partial credit: "it only crashed on two of five probes" earns
      // nothing. Scored polarity, not documentation.
      const rowMustNot = entry.rubric.criteria.filter((x) => x.kind === "must_not" && x.detector.rows);
      if (rowMustNot.length === 0) ok(`${entry.skill} declares no row-scored must_not (partial credit is must-only)`);
      else fail(`${entry.skill} has row-scored must_not criteria (${rowMustNot.map((x) => x.id).join(", ")}) — a part-violated prohibition is not part-satisfied`);
    }
  }

  // ---- (d6) the revision round CARRIES THE ARTIFACT FORWARD -------------------
  // The fourth part of Day 1 is a revision step, and this instrument shipped without one while
  // reporting rounds, scores and a delta. Every round of a workspace rubric got a fresh EMPTY
  // directory plus a list of failing rows, so the only available move was to write the deliverable
  // again from nothing. Fifteen rounds produced fifteen independent samples and zero revisions; run
  // 1 re-rolled an implementation that traded E4 for E1 and E5, which is the signature of a
  // re-sample and impossible for a real edit. A loop that re-draws is not a loop.
  //
  // Asserted on bytes, not on the presence of the call: the deliverable written in round N must be
  // in round N+1's workspace unchanged, and the seed must be there too.
  {
    const { roundWorkspace, prepareWorkspace, runLoop, deliverablePaths, seedEntry } = await import("../../tools/skill-loop.mjs");
    const { writeFileSync, readFileSync, mkdirSync } = await import("node:fs");
    for (const entry of rubrics.filter((e) => e.rubric.grades === "workspace")) {
      const dpaths = deliverablePaths(entry.rubric);
      // A deliverable path is a FILE when it carries an extension and a DIRECTORY otherwise — the
      // marker has to land somewhere the carry-forward will actually pick up, and three of the five
      // Tier-1 fixtures deliver directories (`scopes/`, `spec/`, `tasks/`) rather than one file.
      const markerFor = (p) => (/\.[a-z0-9]+$/i.test(p) ? p : join(p, "round-1-marker.md"));
      const label = dpaths.join(" + ");
      const seededTo = (entry.rubric.fixture.seed || []).map((raw) => seedEntry(raw).to);
      // BROWNFIELD again: when the fixture SEEDS the deliverable, round 1 starting from it is the
      // point, not a leak — the skill is asked to change working code, and the graded thing is the
      // change. The intent behind "round 1 must be clean" was that a first draft must not be
      // grading a handout, and (d1b) above now carries that: it asserts the seeded baseline does
      // not already pass. What still has to hold here is that round 1 is not marked as a REVISION,
      // because `carried_forward` is what tells a reader whether a delta measured editing or
      // re-drawing.
      const brownfield = dpaths.some((p) => seededTo.some((t) => p === t || p.startsWith(`${t}/`) || t.startsWith(`${p}/`)));
      const r1 = roundWorkspace(entry.rubric, null);
      if (brownfield) {
        if (!r1.carried_forward && dpaths.every((p) => existsSync(join(r1.cwd, p)))) {
          ok(`${entry.skill} seeds its deliverable (brownfield): round 1 starts from the seeded ${label} and is still marked carried_forward=false`);
        } else {
          fail(`${entry.skill} is brownfield but round 1 has carried_forward=${r1.carried_forward} / deliverable present=${dpaths.map((p) => existsSync(join(r1.cwd, p))).join(",")} — a first draft must start from the seed and must not be recorded as a revision of one`);
        }
      } else if (!r1.carried_forward && !dpaths.some((p) => existsSync(join(r1.cwd, p)))) {
        ok(`${entry.skill} round 1 starts from a clean workspace (no deliverable, carried_forward false)`);
      } else {
        fail(`${entry.skill} round 1 already contains ${label} — the first draft would be grading a handout, not the skill`);
      }

      const marker = `// round-1 artifact ${Math.random().toString(36).slice(2)}\n`;
      // EVERY declared path gets a marker, so a fixture whose deliverable spans two storage roots
      // (ba-pitch-analyzer: a committed spec tree and a gitignored board) fails this check if the
      // carry-forward moves only the first — which is exactly the half-revision it would otherwise
      // perform silently.
      for (const p of dpaths) {
        const dest = join(r1.cwd, markerFor(p));
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, marker);
      }
      const r2 = roundWorkspace(entry.rubric, r1.cwd);
      const missed = dpaths.filter((p) => {
        const f = join(r2.cwd, markerFor(p));
        return !existsSync(f) || readFileSync(f, "utf8") !== marker;
      });
      if (r2.carried_forward && missed.length === 0) {
        ok(`${entry.skill} round 2 inherits round 1's ${label} byte-for-byte — the revision step edits, it does not re-roll`);
      } else {
        fail(`${entry.skill} round 2 did NOT inherit ${missed.join(", ") || label} (carried_forward=${r2.carried_forward}) — every round would rewrite from scratch and the delta would measure re-sampling`);
      }
      // Fresh directory, only the declared deliverable across the boundary: the oracle EXECUTES what
      // it finds, so a round must not inherit stray files a previous round left behind.
      writeFileSync(join(r1.cwd, "stray-leftover.txt"), "x");
      const r3 = roundWorkspace(entry.rubric, r1.cwd);
      if (!existsSync(join(r3.cwd, "stray-leftover.txt"))) ok(`${entry.skill} carries the deliverable only — stray files do not leak between rounds`);
      else fail(`${entry.skill} leaked stray-leftover.txt into the next round's workspace — the oracle would grade the union of every attempt`);

      for (const raw of entry.rubric.fixture.seed || []) {
        const { to } = seedEntry(raw);
        if (existsSync(join(r2.cwd, to))) ok(`${entry.skill} revision round still has its seed (${to})`);
        else fail(`${entry.skill} revision round lost seed ${to} — the round cannot read the task it is revising against`);
      }

      // The ratchet stop (§IX.B) must watch the ARTIFACT, not the transcript. A round that left the
      // deliverable byte-identical will score identically, so continuing spends budget on a known
      // answer — but its commentary ("Done." vs "Fixed E4.") differs every time, so a text
      // comparison can never fire for a workspace rubric.
      const staleWs = prepareWorkspace(entry.rubric, join(entry.dir, entry.rubric.fixture.reference_drafts.partial || entry.rubric.fixture.reference_drafts.weak));
      let calls = 0;
      const stale = runLoop({
        skill: entry.skill, rubric: entry.rubric, mode: "selftest", ctx: { workspace: staleWs },
        gen: () => ({ text: `round ${++calls}: distinct commentary, identical file`, source: "model", artifact_sha: "a".repeat(64) }),
      });
      if (stale.stopped.reason === "no_improvement") ok(`${entry.skill} loop stops on an unchanged deliverable even when the transcript differs`);
      else fail(`${entry.skill} loop ran to ${stale.stopped.reason} over ${calls} rounds of a byte-identical artifact — the ratchet is watching the transcript, not the file`);
    }
  }

  // ---- (d7) the measurement SURVIVES a clone ----------------------------------
  // `evals/runs/` is deliberately gitignored — raw records and per-round drafts are the machine's
  // run-trace, the same split as `.shapeup/` vs `shapeup/` (ADR-0001). The consequence is that a
  // paid run leaves NOTHING a teammate can see except the committed baseline and the report derived
  // from it. So the report is not documentation here, it is the evidence, and it has to be checked
  // like evidence: present, current, and covering every result the baseline holds.
  //
  // Derived rather than hand-written for the reason this repo derives hill phase — a summary
  // maintained beside its source is a second place for the number to live and the first place for it
  // to go stale. The check regenerates and compares bytes.
  {
    const { spawnSync } = await import("node:child_process");
    const { renderReport } = await import("../../tools/skill-loop.mjs");
    const ignored = (p) => spawnSync("git", ["check-ignore", "-q", p], { cwd: ROOT }).status === 0;
    const reportPath = join(ROOT, "evals", "DAY1-REPORT.md");
    const baselinePath = join(ROOT, "evals/baselines/skill-loop.baseline.json");

    if (ignored(join(ROOT, "evals", "runs", "x.measure.r1.json"))) ok("evals/runs/ is gitignored (run-trace, not evidence)");
    else fail("evals/runs/ is tracked — raw run records and drafts are run-trace and churn every run; the committed evidence is the baseline + DAY1-REPORT.md");

    // The two artifacts that DO survive must not be swept up by the same rule.
    for (const [label, p] of [["baseline", baselinePath], ["DAY1-REPORT.md", reportPath]]) {
      if (!ignored(p)) ok(`${label} is committed — the measurement survives a clone`);
      else fail(`${label} is GITIGNORED, so a paid run leaves no trace a teammate can see`);
    }

    if (!existsSync(baselinePath)) fail("no baseline — cannot check the report");
    else if (!existsSync(reportPath)) {
      fail("evals/DAY1-REPORT.md missing — with evals/runs/ gitignored this is the only surviving account of what was measured; run `node tools/skill-loop.mjs --report`");
    } else {
      const baseline = readJSON(baselinePath);
      const expected = renderReport(baseline);
      const actual = read("evals/DAY1-REPORT.md");
      if (actual === expected) ok("DAY1-REPORT.md matches the baseline it derives from (regenerates byte-identical)");
      else fail("DAY1-REPORT.md is STALE or hand-edited — it no longer regenerates from the baseline. Run `node tools/skill-loop.mjs --report`; edit the baseline, never the report");

      // Coverage, asserted independently of the byte compare: a renderer that silently dropped a
      // skill would still round-trip perfectly against its own output.
      const missing = [];
      for (const [skill, byModel] of Object.entries(baseline.results || {})) {
        for (const model of Object.keys(byModel)) {
          if (!(actual.includes(skill) && actual.includes(model))) missing.push(`${skill}/${model}`);
        }
      }
      if (missing.length === 0) ok(`DAY1-REPORT.md names every measured skill+model (${Object.keys(baseline.results || {}).length} skill(s))`);
      else fail(`DAY1-REPORT.md omits measured result(s): ${missing.join(", ")} — a measurement not in the report is a measurement nobody will find`);

      // Every caveat in the baseline must reach the report. These exist because a number was already
      // misread once; a caveat that does not travel with its number does not travel.
      const notes = Object.values(baseline.per_skill_notes || {}).flat().concat(baseline.limitations || []);
      const dropped = notes.filter((n) => !actual.includes(n));
      if (dropped.length === 0) ok(`DAY1-REPORT.md carries all ${notes.length} caveat(s) from the baseline verbatim`);
      else fail(`${dropped.length} caveat(s) never reach the report, e.g. ${JSON.stringify(dropped[0].slice(0, 80))} — a number published without its caveat is how the last one was misread`);
    }
  }

  // ---- (d8) SPEND is measured, and an unknown spend never reads as a cheap one -
  // Every measure run before this recorded `cost.usd: null` while the CLI was computing the figure
  // and printing it on the same stdout the adapter was already reading — the text output format
  // simply discarded it. The consequence was not a missing nicety: the plan budgeting these runs
  // carried a ~$81 total derived from a published price RATIO applied to an older estimate, in a
  // repo whose entire rule is that no figure is written without a run that produced it. So the
  // instrument was measuring the skill honestly and its own cost by arithmetic.
  //
  // The envelope parser is exported precisely so this can be tested for free. Canned envelopes
  // only — no spawn, no auth, no spend — which is the same trade §9–§11 make for the oracles.
  {
    const { parseCliEnvelope, totalCost, costSummary } = await import("../../tools/skill-loop.mjs");

    // A REAL envelope, trimmed. Field names and the usage/modelUsage divergence below were taken
    // from an actual `claude -p --output-format json` run, not from documentation.
    const success = {
      type: "result", subtype: "success", is_error: false, result: "the draft",
      total_cost_usd: 0.0183236, permission_denials: [],
      // `usage` describes only the LAST assistant message. It is present here on purpose: it is
      // the field a reader reaches for first, and it is the wrong one.
      usage: { input_tokens: 10, output_tokens: 38, cache_read_input_tokens: 17536 },
      modelUsage: { "claude-haiku-4-5-20251001": { inputTokens: 531, outputTokens: 51, cacheReadInputTokens: 17536, cacheCreationInputTokens: 7892, costUSD: 0.0183236 } },
    };
    const parsed = parseCliEnvelope(JSON.stringify(success), 0);
    if (parsed.text === "the draft") ok("cost: envelope parser returns the model's `result` as the draft");
    else fail(`cost: parser returned ${JSON.stringify(parsed.text)} instead of the envelope's result`);

    // THE CONTROL THAT MATTERS MOST HERE. Reading `usage.input_tokens` (10) instead of the summed
    // `modelUsage.inputTokens` (531) under-reports a session's input by ~50x while looking
    // perfectly well-sourced. Both fields exist, both are plausible, one is right.
    if (parsed.cost.tokens_in === 531 && parsed.cost.tokens_out === 51) ok("cost: tokens come from session-wide modelUsage (531 in), not last-message usage (10 in)");
    else fail(`cost: tokens_in=${parsed.cost.tokens_in} tokens_out=${parsed.cost.tokens_out} — expected 531/51 from modelUsage; reading \`usage\` gives 10 and under-reports the session ~50x`);
    if (parsed.cost.usd === 0.0183236 && parsed.cost.source === "cli-json") ok("cost: usd is the CLI's own total_cost_usd, sourced as cli-json");
    else fail(`cost: usd=${parsed.cost.usd} source=${parsed.cost.source} — expected the envelope's total_cost_usd verbatim`);
    if (parsed.cost.cache_read_tokens === 17536 && parsed.cost.cache_creation_tokens === 7892) ok("cost: cache read/write tokens recorded (the per-round session-preamble floor)");
    else fail(`cost: cache tokens ${parsed.cost.cache_read_tokens}/${parsed.cost.cache_creation_tokens} — expected 17536/7892`);

    // A broken harness must LOOK broken. Verified against the CLI: a turn-cap exhaustion sets
    // is_error, subtype error_max_turns, and OMITS `result` entirely — so a parser that only
    // checked for a string would hand back `undefined` and the loop would score it.
    const maxTurns = { type: "result", subtype: "error_max_turns", is_error: true, terminal_reason: "max_turns", num_turns: 2, total_cost_usd: 0.0128494, permission_denials: [] };
    try {
      parseCliEnvelope(JSON.stringify(maxTurns), 1);
      fail("cost: parser accepted an is_error/error_max_turns envelope as a draft — the turn-cap incident, reintroduced");
    } catch (e) {
      if (/error_max_turns/.test(e.message)) ok("cost: an error envelope ABORTS and names its subtype, rather than being scored");
      else fail(`cost: error envelope aborted but did not name the reason: ${e.message.slice(0, 120)}`);
      // A failed round still spent money, and a re-run budget set from a spend nobody printed is
      // the same fabrication one layer down.
      if (/0\.0128/.test(e.message)) ok("cost: the abort message reports what the FAILED round spent");
      else fail(`cost: abort message omits the failed round's spend: ${e.message.slice(0, 200)}`);
    }

    // The DANGEROUS shape, and the reason the check above is not sufficient on its own. The
    // max-turns envelope omits `result`, so a parser with no is_error check at all still blows up
    // on the missing field and looks guarded. An error envelope that DOES carry text does not: it
    // returns fluent prose that scores like a draft. That is the original 29-byte incident exactly,
    // wearing JSON. So the flag itself must be load-bearing, not the absent field.
    const errorWithText = { type: "result", subtype: "error_during_execution", is_error: true, result: "I was unable to complete the task because the build failed.", total_cost_usd: 0.02, permission_denials: [], modelUsage: {} };
    try {
      parseCliEnvelope(JSON.stringify(errorWithText), 1);
      fail("cost: parser accepted an is_error envelope that CARRIED TEXT — fluent prose from a failed session would be scored as a draft, which is the 29-byte turn-cap incident in JSON clothing");
    } catch (e) {
      if (/error_during_execution/.test(e.message)) ok("cost: is_error aborts even when the envelope carries plausible draft text");
      else fail(`cost: is_error-with-text aborted for the wrong reason: ${e.message.slice(0, 140)}`);
    }

    // FC-02, made mechanical. DAY1-REPORT.md carries a WITHDRAWN measurement that was exactly
    // this: the session could not run `node`, correctly refused to fabricate the observation it
    // could not make, and scored 0 — published as a -0.571 quality delta. The CLI reports denials
    // as data now, so the reader no longer has to notice it afterwards.
    const denied = { type: "result", subtype: "success", is_error: false, result: "I need permission to run the Node.js process to probe the build.", total_cost_usd: 0.004, permission_denials: [{ tool_name: "Bash", tool_input: { command: "node build.js" } }], modelUsage: {} };
    try {
      parseCliEnvelope(JSON.stringify(denied), 0);
      fail("cost: parser scored a draft from a session that hit a permission denial — this is the withdrawn -0.571 measurement, reintroduced");
    } catch (e) {
      if (/PERMISSION DENIAL/i.test(e.message) && /FC-02/.test(e.message)) ok("cost: a permission-denied session ABORTS and cites FC-02, instead of being graded");
      else fail(`cost: denial aborted with the wrong message: ${e.message.slice(0, 140)}`);
    }

    try {
      parseCliEnvelope("Error: Reached max turns (12)", 0);
      fail("cost: parser accepted non-JSON stdout — the adapter would score a CLI error string as a draft");
    } catch (e) {
      if (/JSON envelope/.test(e.message)) ok("cost: non-JSON stdout aborts (the adapter's output format is not optional)");
      else fail(`cost: non-JSON stdout raised the wrong error: ${e.message.slice(0, 120)}`);
    }

    // THE HONESTY RULE, and the reason this is a test rather than a comment. If round 3 of 5 did
    // not report, the sum of the other four is NOT "the run cost about this much" — it is a number
    // with no defined meaning that renders identically to a measured total. It must be withheld.
    const c = (usd) => ({ tokens_in: 100, tokens_out: 10, cache_read_tokens: 5, cache_creation_tokens: 5, usd, source: "cli-json" });
    const full = totalCost([c(1), c(2)]);
    if (full.usd === 3 && full.source === "cli-json" && full.rounds_reported === 2) ok("cost: a fully-reported run totals its rounds ($1 + $2 = $3)");
    else fail(`cost: complete run totalled ${JSON.stringify(full)} — expected usd 3, source cli-json`);
    const partial = totalCost([c(1), null, c(2)]);
    if (partial.usd === null && partial.source === "partial") ok("cost: a run with an unreported round WITHHOLDS its total (null, source 'partial') rather than publishing $3 of a larger truth");
    else fail(`cost: partial run published usd=${partial.usd} source=${partial.source} — a partial sum reads exactly like a measured total, which is the F1 sin applied to spend`);
    if (partial.per_round_usd.length === 3 && partial.per_round_usd[1] === null && partial.per_round_usd[0] === 1) ok("cost: the rounds that DID report survive the withheld total (per_round_usd), so the gap is inspectable");
    else fail(`cost: per_round_usd lost the reporting rounds: ${JSON.stringify(partial.per_round_usd)}`);
    if (totalCost([]).source === "unavailable" && totalCost([]).usd === null) ok("cost: a run with no rounds costed is 'unavailable', not $0");
    else fail("cost: an uncosted run must report source 'unavailable' with a null total, never zero");

    // Same rule one level up: two runs measured and one not is not a sample-level total.
    const run = (usd) => ({ cost: { ...c(usd), wall_clock_s: 12 } });
    const sFull = costSummary([run(1), run(3)]);
    if (sFull.usd_total === 4 && sFull.usd_per_run_mean === 2 && sFull.wall_clock_s_total === 24) ok("cost: sample summary totals spend and wall clock across runs");
    else fail(`cost: sample summary was ${JSON.stringify(sFull)} — expected total 4, mean 2, wall 24`);
    const sPart = costSummary([run(1), { cost: null }]);
    if (sPart.usd_total === null && sPart.source === "partial" && sPart.runs_reported === 1) ok("cost: a sample with an uncosted run withholds its total too (1/2 runs costed)");
    else fail(`cost: sample with an uncosted run published ${JSON.stringify(sPart)} — must withhold`);

    // A DISCARDED round was still paid for. The no-improvement ratchet stops the loop when a round
    // comes back unchanged — but that round ran, and an accumulator that only records rounds it
    // KEPT under-reports the run by exactly the rounds that wasted money. Driven through the real
    // runLoop with a generator that repeats itself on round 2, so the ratchet fires for real.
    {
      const { runLoop } = await import("../../tools/skill-loop.mjs");
      const entry = rubrics[0];
      if (entry) {
        const paid = { tokens_in: 1, tokens_out: 1, cache_read_tokens: 0, cache_creation_tokens: 0, usd: 0.5, source: "cli-json" };
        const rec = runLoop({
          skill: entry.skill, rubric: entry.rubric, mode: "measure", model: "test-only-no-spend",
          ctx: { workspace: ROOT },
          // Round 1 and round 2 return the SAME text, so round 2 is generated (and paid for) and
          // then thrown away by the ratchet.
          gen: () => ({ text: "identical draft", source: "model", path: null, cost: paid }),
        });
        if (rec.stopped.reason === "no_improvement") ok("cost: the no-improvement ratchet fires on a repeated draft (the discard path under test)");
        else fail(`cost: expected the ratchet to stop this loop, got stopped.reason=${rec.stopped.reason} — the discarded-round check below is not exercising what it claims`);
        if (rec.cost.rounds === 2 && rec.cost.usd === 1) ok("cost: a round DISCARDED by the ratchet is still charged (2 rounds, $1.00, not 1 round and $0.50)");
        else fail(`cost: the discarded round vanished from the bill — rounds=${rec.cost.rounds} usd=${rec.cost.usd}, expected 2 and 1. A run that stopped because round N repeated itself still paid for round N.`);
      }
    }

    // The flag is the whole feature. Drop `--output-format json` and every check above still
    // passes while the adapter silently returns text and records null cost again — a guard that
    // disarms when the thing it guards is removed is F-16 in a new costume, which §5 of the
    // Phase-1 finding already caught once in this very module.
    const src = read("tools/skill-loop.mjs");
    if (/"--output-format",\s*"json"/.test(src)) ok("cost: the default adapter still passes --output-format json (without it every cost figure silently reverts to null)");
    else fail("cost: tools/skill-loop.mjs no longer passes --output-format json — the CLI would return text, the parser would abort or the cost would be null, and the spend column would quietly empty");
  }

  // ---- (d9) a fixture change RETIRES the old number, it does not erase it ------
  // The measure path used to write `results[skill][model] = summary`, so re-measuring after a
  // fixture change destroyed the figure it was supposed to be compared against — the act of
  // producing the new number deleted the old one. P1 exists precisely to publish a before and an
  // after, and it would have been unable to.
  {
    const { fixtureSha } = await import("../../tools/skill-loop.mjs");
    const { writeFileSync, readFileSync } = await import("node:fs");

    for (const entry of rubrics) {
      const cf = entry.rubric.fixture.contract_files || [];
      if (!cf.length) { ok(`${entry.skill} declares no contract_files (fingerprint covers the fixture block and seeds only)`); continue; }
      const missing = cf.filter((rel) => !existsSync(join(ROOT, rel)));
      if (!missing.length) ok(`${entry.skill} contract_files all exist (${cf.length} file(s))`);
      else fail(`${entry.skill} contract_files names files that do not exist: ${missing.join(", ")} — the fingerprint would hash them as MISSING forever and never change again`);
    }

    const te = rubrics.find((e) => e.skill === "task-executor");
    if (te) {
      const before = fixtureSha(te.rubric, ROOT);
      if (/^[0-9a-f]{16}$/.test(before)) ok(`task-executor fixture fingerprint is well-formed (${before})`);
      else fail(`task-executor fixture fingerprint malformed: ${before}`);

      // THE CONTROL. Add a row to the oracle's contract — the exact edit P1 made — and the
      // fingerprint must move. A fingerprint over the rubric file alone would not: the rubric did
      // not change, and the score of an unchanged deliverable did.
      //
      // The target is DERIVED from the rubric's own contract_files rather than hard-coded. It was
      // hard-coded once, at examples/todo-cli/todo.contract.json, and when P5' repointed the
      // fixture at its own contract the check went on tampering with a file the fingerprint no
      // longer covered — testing nothing, and failing for the right reason only by luck.
      const contractJson = (te.rubric.fixture.contract_files || []).find((f) => f.endsWith(".json"));
      if (!contractJson) { fail("task-executor declares no .json contract file — the fingerprint cannot be shown to track the graded rows"); return; }
      const cpath = join(ROOT, contractJson);
      const original = readFileSync(cpath, "utf8");
      try {
        const c = JSON.parse(original);
        c.criteria.push({ id: "E99", desc: "synthetic row, structural test only", probe: { argv: ["list"], store: "[]" }, expect: { exit: "==0" } });
        writeFileSync(cpath, JSON.stringify(c, null, 2) + "\n");
        const after = fixtureSha(te.rubric, ROOT);
        if (after !== before) ok("fixture fingerprint MOVES when a contract row is added (the rubric file itself is unchanged — hashing it alone would miss this)");
        else fail("fixture fingerprint did not change when a row was added to todo.contract.json — a re-measure would silently overwrite a number measured against a different contract");
      } finally {
        writeFileSync(cpath, original);   // always restore, even if an assertion throws
      }
      if (readFileSync(cpath, "utf8") === original) ok("structural test restored todo.contract.json after tampering with it");
      else fail("todo.contract.json was NOT restored after the fingerprint test — the repo is now dirty");

      // P1's own exit criterion, guarded against a silent revert. These two facts are interface
      // conventions of the measuring apparatus, not craft: the first measured run's entire delta
      // came from the model inferring them, and one run was punished for choosing a reasonable
      // {items, nextId} format instead. If they leave the prompt, the fixture is back to measuring
      // convention-discovery and reporting it as edge-case handling.
      //
      // SCOPED TO A GREENFIELD FIXTURE, and the distinction is the whole reason P1's rule exists.
      // The rule is that a graded row must be DERIVABLE from what the skill was given. When the
      // fixture hands over an empty directory, the only place the store convention can live is the
      // prompt — so it must be stated. When the fixture SEEDS the implementation, the convention is
      // already in the code the skill was given (`src/store/paths.js` reads $TODO_STORE;
      // `json-store.js` defines the file shape), and it is derivable by reading it. Restating it in
      // the prompt would then be the opposite error: handing over the answer to the one row that
      // measures whether the skill checks the code before writing against it.
      const prompt = te.rubric.fixture.prompt;
      const seeded = new Set((te.rubric.fixture.seed || []).map((e) => (typeof e === "string" ? e : e.to || e.from)));
      const seedsTheImplementation = [...seeded].some((d) => /(^|\/)src(\/|$)/.test(String(d)));
      if (seedsTheImplementation) {
        // The brownfield equivalent: the prompt must say WHERE the authoritative format lives, so
        // "go and read it" is an instruction rather than a guess the fixture hopes the model makes.
        if (/json-store\.js/.test(prompt)) ok("task-executor (brownfield) prompt names the module that owns the store format, so the fact is derivable by reading the seeded code");
        else fail("task-executor seeds an implementation but its prompt never names the module that owns the store format — the skill would be graded on inferring a convention that is neither stated nor pointed at");
      } else {
        if (/TODO_STORE/.test(prompt)) ok("task-executor prompt states the store PATH convention ($TODO_STORE) the oracle imposes");
        else fail("task-executor prompt no longer states $TODO_STORE — the oracle sandboxes the store through it, so the skill would again be graded on inferring an undocumented convention (P1's confound, reintroduced)");
        if (/JSON array/i.test(prompt)) ok("task-executor prompt states the store FORMAT the oracle seeds (a JSON array)");
        else fail("task-executor prompt no longer states the store format — the probe seeds a bare array, and a deliverable choosing {items, nextId} is a fair reading of idea.md that the oracle would fail");
      }
    }

    // CONDITION 4 must reach the report. The rung's exit criterion (`final_score >= approve_at` in a
    // majority of runs) is satisfiable by a loop that approves the first draft every time, and for
    // weeks all three measured rows read "MET" while not one had executed a revision round. A
    // reader cannot be expected to cross-check rounds-per-run against the plan's definition of
    // done; the table has to say it.
    {
      const { renderReport } = await import("../../tools/skill-loop.mjs");
      const bl = join(ROOT, "evals/baselines/skill-loop.baseline.json");
      if (existsSync(bl)) {
        const b = readJSON(bl);
        const md = renderReport(b);
        let checked = 0;
        for (const [skill, byModel] of Object.entries(b.results || {})) {
          for (const [model, r] of Object.entries(byModel)) {
            const rounds = (r.per_run || []).map((x) => x.rounds);
            if (!rounds.length) continue;
            checked++;
            const revised = Math.max(...rounds) > 1;
            // Find this skill+model's row and read its verdict cell.
            const row = md.split("\n").find((l) => l.startsWith(`| \`${skill}\` | ${model} |`));
            if (!row) { fail(`report has no results row for ${skill}/${model}`); continue; }
            if (!revised && /\*\*MET\*\*/.test(row)) {
              fail(`${skill}/${model} approved on the first draft in every run, yet its report row claims **MET** — the exit criterion is cleared but no quality IMPROVEMENT was measured, which is what Table II asks for`);
            } else if (!revised && /exit criterion only/.test(row)) {
              ok(`${skill}/${model} is ceilinged and the report says "exit criterion only", not MET`);
            } else if (revised && /\*\*MET\*\*/.test(row)) {
              ok(`${skill}/${model} revised (max ${Math.max(...rounds)} rounds) and the report says MET`);
            } else if (revised && /not met/.test(row)) {
              // The fourth state, and it was missing until a run produced it. A loop can REVISE and
              // still fail the exit criterion: condition 4 asks that some run needed a second round,
              // condition 3 asks that a MAJORITY reach approve, and a skill that revises twice and
              // recovers once satisfies the first and fails the second. That is not a contradiction
              // to be flagged — it is the most informative row this table can hold, because it is
              // the only shape that shows the loop working AND the bar unmet.
              ok(`${skill}/${model} revised (max ${Math.max(...rounds)} rounds) but did not reach approve in a majority — the report says "not met", which is condition 3 failing while condition 4 holds`);
            } else {
              fail(`${skill}/${model}: revised=${revised} but the report verdict cell does not match it — ${row.slice(0, 160)}`);
            }
          }
        }
        if (checked) ok(`condition 4 (a run needed >1 round) is rendered for all ${checked} measured skill+model row(s)`);
      }
    }

    // Stale drafts from a previous run must not survive into the next one's evidence directory.
    // A five-round run followed by a two-round run leaves v3–v5 behind, and the directory then
    // reads as one seven-round sample that never happened. The files differ only by mtime, so
    // nothing in the directory itself reveals the mixture.
    {
      const { clearPriorDrafts } = await import("../../tools/skill-loop.mjs");
      const { mkdtempSync, writeFileSync, readdirSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const d = mkdtempSync(join(tmpdir(), "skill-loop-drafts-"));
      for (const f of [
        "task-executor.claude-sonnet-5.r1.v1.md", "task-executor.claude-sonnet-5.r3.v5.todo.js",
        "task-executor.claude-haiku-4-5.r1.v1.md",   // SAME skill, DIFFERENT model — must survive
        "spec-evaluator.claude-sonnet-5.r1.v1.md",   // different skill — must survive
      ]) writeFileSync(join(d, f), "x");
      const removed = clearPriorDrafts(d, "task-executor", "claude-sonnet-5");
      const left = readdirSync(d).sort();
      if (removed.length === 2) ok("stale drafts: a new run clears its own skill+model's previous drafts (2 removed)");
      else fail(`stale drafts: expected 2 removed, got ${removed.length} (${removed.join(", ")}) — orphaned rounds from a longer previous run would be read as part of the new sample`);
      if (left.length === 2 && left.every((f) => /haiku|spec-evaluator/.test(f))) ok("stale drafts: another model's and another skill's drafts are left untouched");
      else fail(`stale drafts: clearing was too broad, it deleted another measurement's evidence — left ${JSON.stringify(left)}`);
      if (clearPriorDrafts(join(d, "does-not-exist"), "x", "y").length === 0) ok("stale drafts: clearing a missing directory is a no-op, not a crash");
      else fail("stale drafts: clearing a missing directory did not return empty");
    }

    // The supersede record must carry what makes it readable: both fingerprints and a reason.
    const bl = join(ROOT, "evals/baselines/skill-loop.baseline.json");
    if (existsSync(bl)) {
      const b = readJSON(bl);
      // A retired number must stay READABLE, and what makes it readable depends on why it was
      // retired. A `fixture-change` supersede must name the successor fingerprint, or the reader
      // cannot tell which instrument replaced it. A `model-policy` supersede has no successor
      // fixture — the measurement was correct and simply is not the model this repo publishes any
      // more — so requiring a fingerprint there would mean inventing one, which is the failure this
      // whole section exists to prevent. Both must always carry a reason and the retired figures.
      for (const s of b.superseded || []) {
        const cause = s.cause || "fixture-change";   // records written before `cause` existed
        const base = s.skill && s.model && s.reason && s.summary;
        if (!base) { fail(`superseded record for ${s.skill || "?"}/${s.model || "?"} lacks a reason or the retired figures — a retired number that cannot be read is indistinguishable from a deleted one`); continue; }
        if (cause === "fixture-change") {
          if (s.superseded_by_fixture_sha) ok(`superseded (fixture-change) ${s.skill}/${s.model} names the successor fixture ${s.superseded_by_fixture_sha}`);
          else fail(`superseded record for ${s.skill}/${s.model} claims a fixture change but names no successor fingerprint — the reader cannot tell which instrument replaced it`);
        } else if (cause === "model-policy") {
          if (!s.superseded_by_fixture_sha) ok(`superseded (model-policy) ${s.skill}/${s.model} correctly names no successor fixture — the instrument did not change, the published model did`);
          else fail(`superseded record for ${s.skill}/${s.model} is model-policy but names a successor fixture — that would assert a fixture change that never happened`);
        } else if (cause === "re-sample") {
          // The third cause, and the one the mechanism used to throw away. A same-fixture re-run
          // must name a successor fingerprint EQUAL to its own: that equality is the whole claim
          // — nothing moved but the sample — and it is what makes this the only pair in the file
          // a reader may legitimately subtract.
          if (s.superseded_by_fixture_sha === s.fixture_sha && s.fixture_sha) ok(`superseded (re-sample) ${s.skill}/${s.model} carries an unchanged fingerprint ${s.fixture_sha} — the pair measures the instrument's variance, not the skill`);
          else fail(`superseded record for ${s.skill}/${s.model} is a re-sample but its fingerprints differ (${s.fixture_sha} -> ${s.superseded_by_fixture_sha}) — a re-sample asserts the instrument did NOT move, so an unequal pair is mislabelled and would be read as comparable when it is not`);
        } else {
          fail(`superseded record for ${s.skill}/${s.model} has unknown cause "${cause}" (expected fixture-change|re-sample|model-policy)`);
        }
      }

      // THE RULE ITSELF, driven directly, because a guard that only inspects the records a rule
      // WROTE cannot see the rule being switched off. Measured: reverting the retirement branch to
      // fire only on a fixture change left the entire structural suite green, which is exactly the
      // silence that let the original blind spot survive in the first place. `retireEntry` is
      // exported so this can assert behaviour instead of residue.
      {
        const { retireEntry } = await import("../../tools/skill-loop.mjs");
        const prior = { n: 3, fixture_sha: "aaaa1111", measured_at: "2026-01-01T00:00:00.000Z", v1_score: { mean: 0.9 }, final_score: { mean: 1 }, delta: { mean: 0.1 }, improved_runs: 1, approved_runs: 3 };
        const args = { skill: "demo", model: "m", measuredAt: "2026-02-02T00:00:00.000Z" };

        const same = retireEntry({ prior, fxSha: "aaaa1111", ...args });
        if (same && same.cause === "re-sample" && same.superseded_by_fixture_sha === "aaaa1111" && same.summary?.improved_runs === 1) {
          ok("retireEntry RETIRES a same-fixture re-sample (cause re-sample, fingerprint unchanged, figures carried)");
        } else {
          fail(`retireEntry returned ${JSON.stringify(same)} for a same-fixture re-run — a re-sample must be RETAINED, not overwritten: it is the only directly comparable pair the baseline holds, and discarding it hides the instrument's own variance (measured: improved 1/3 -> 0/3 on a byte-identical fixture, taking a MET verdict with it)`);
        }

        const moved = retireEntry({ prior, fxSha: "bbbb2222", ...args });
        if (moved && moved.cause === "fixture-change" && moved.superseded_by_fixture_sha === "bbbb2222") ok("retireEntry still retires a fixture-change and names the successor fingerprint");
        else fail(`retireEntry returned ${JSON.stringify(moved)} for a changed fixture — expected cause fixture-change naming bbbb2222`);

        if (retireEntry({ prior: undefined, fxSha: "aaaa1111", ...args }) === null) ok("retireEntry retires nothing when there is no prior measurement");
        else fail("retireEntry invented a retirement record with no prior measurement to retire");
      }

      // And the residue check, which catches a record hand-edited to the wrong cause.
      for (const [skill, byModel] of Object.entries(b.results || {})) {
        for (const [model, r] of Object.entries(byModel)) {
          const sameFx = (b.superseded || []).filter((s) => s.skill === skill && s.model === model && s.fixture_sha && s.fixture_sha === r.fixture_sha);
          const mislabelled = sameFx.filter((s) => (s.cause || "fixture-change") !== "re-sample");
          if (!mislabelled.length) continue;
          fail(`${skill}/${model} has ${mislabelled.length} retired record(s) on its CURRENT fingerprint ${r.fixture_sha} not marked \`re-sample\` — a same-fixture pair is the only comparable one in this file and mislabelling it hides the instrument's variance`);
        }
      }
      // A live result measured after the mechanism landed must be fingerprinted, or the NEXT
      // fixture change cannot tell whether it supersedes anything.
      for (const [skill, byModel] of Object.entries(b.results || {})) {
        for (const [model, r] of Object.entries(byModel)) {
          if (r.fixture_sha || !r.cost) continue;   // pre-mechanism results are legitimately unstamped
          fail(`${skill}/${model} was measured with cost capture but carries no fixture_sha — the next fixture change would overwrite it silently`);
        }
      }
    }
  }

  // ---- (e) Day-1 baseline honesty invariant -----------------------------------
  // Identical rule to §16. Extended here because a quality number is easier to fabricate than a
  // trigger rate: it has no obviously wrong value.
  const loopBaselinePath = join(ROOT, "evals/baselines/skill-loop.baseline.json");
  if (!existsSync(loopBaselinePath)) fail("evals/baselines/skill-loop.baseline.json missing — run `node tools/skill-loop.mjs`");
  else {
    const b = readJSON(loopBaselinePath);
    if (b.status === "unmeasured") {
      if (b.results === null || b.results === undefined) ok("skill-loop baseline is honestly unmeasured (results: null)");
      else fail("skill-loop baseline says 'unmeasured' but carries results — fabricated numbers (the F1 sin)");
      if (b.model === null && b.measured_at === null) ok("skill-loop baseline claims no model and no measurement date");
      else fail("skill-loop baseline is 'unmeasured' but names a model or a measurement date");
    } else if (b.status === "measured") {
      if (b.results && b.method && b.measured_at && b.model) ok("skill-loop baseline is measured with method + measured_at + model");
      else fail("skill-loop baseline says 'measured' but lacks results/method/measured_at/model (an unlabeled quality number measures nothing)");
    } else fail(`skill-loop baseline has unknown status "${b.status}" (expected unmeasured|measured)`);

    // The coverage block is an inventory, and a stale inventory is a quiet lie about how much of
    // the harness is actually instrumented.
    const cov = coverage(ROOT);
    const listed = b.coverage && b.coverage.skills ? Object.keys(b.coverage.skills).length : 0;
    if (listed === cov.total && b.coverage.with_rubric === cov.with_rubric) ok(`skill-loop baseline coverage matches disk (${cov.with_rubric}/${cov.total} instrumented)`);
    else fail(`skill-loop baseline coverage is stale: says ${b.coverage ? b.coverage.with_rubric : "?"}/${listed}, disk has ${cov.with_rubric}/${cov.total} — run \`node tools/skill-loop.mjs\``);
  }

  // ---- (f) Day-2 register ------------------------------------------------------
  const regPath = join(ROOT, "evals/failure-classes.json");
  if (!existsSync(regPath)) { fail("evals/failure-classes.json missing — the Day-2 rung has no register"); return; }

  const rv = validateFile(regPath, join(SCHEMAS, "day2-failure-class.schema.json"));
  if (rv.valid) ok("evals/failure-classes.json validates against day2-failure-class.schema.json");
  else fail(`evals/failure-classes.json fails its schema: ${rv.errors.join("; ")}`);

  const reg = readJSON(regPath);
  const seen = new Set();
  for (const c of reg.classes || []) {
    const tag = c.id || "<no id>";
    if (seen.has(c.id)) fail(`failure register has duplicate id ${c.id}`);
    seen.add(c.id);

    // The paper's three tool requirements, checked one at a time because they fail one at a time.
    if (c.tool && c.tool.path && existsSync(join(ROOT, c.tool.path))) ok(`${tag} tool exists on disk (${c.tool.path})`);
    else fail(`${tag} names tool path "${c.tool && c.tool.path}" which does not exist`);

    if (c.tool && c.tool.typed_schema === null) ok(`${tag} declares no typed schema (explicitly null, not omitted)`);
    else if (c.tool && existsSync(join(ROOT, c.tool.typed_schema))) ok(`${tag} typed schema resolves (${c.tool.typed_schema})`);
    else fail(`${tag} names typed_schema "${c.tool && c.tool.typed_schema}" which does not exist`);

    if (c.tool && c.tool.permissions && c.tool.permissions.length > 20) ok(`${tag} states what the tool is permitted to do`);
    else fail(`${tag} has no usable permissions statement`);

    // Result confirmation is the F-16 countermeasure and the one a register would most easily fake.
    const rc = c.tool && c.tool.result_confirmation;
    if (rc && rc.kind !== "none" && rc.ref && rc.ref.length > 5) ok(`${tag} names evidence the tool actually fires (${rc.kind})`);
    else fail(`${tag} has no result confirmation — an unfired guard is indistinguishable from an absent one (F-16)`);

    // Provenance of the failure itself.
    if (c.discovered_by && existsSync(join(ROOT, c.discovered_by.source))) ok(`${tag} discovery source exists (${c.discovered_by.source})`);
    else fail(`${tag} discovered_by.source "${c.discovered_by && c.discovered_by.source}" does not exist on disk`);

    for (const s of c.skills || []) {
      if (!skills.has(s)) fail(`${tag} names skill "${s}" which is not a skill directory`);
    }

    // The honesty invariant, applied to rates.
    for (const which of ["baseline", "current"]) {
      const r = c[which];
      if (!r) { fail(`${tag} has no ${which} rate`); continue; }
      if (r.status === "unmeasured") {
        if (r.value === null || r.value === undefined) ok(`${tag} ${which} is honestly unmeasured (value null)`);
        else fail(`${tag} ${which} says 'unmeasured' but carries value ${r.value}`);
      } else {
        if (r.value !== null && r.value !== undefined && r.unit && r.method) ok(`${tag} ${which} is measured with a unit and a method`);
        else fail(`${tag} ${which} says 'measured' but lacks value/unit/method — an unlabeled number is not a measurement`);
        if (r.unit === "rate" && (r.value < 0 || r.value > 1)) fail(`${tag} ${which} unit is 'rate' but value ${r.value} is outside [0,1]`);
      }
    }

    // Day-2's exit criterion, and the only place it may be claimed.
    if (c.reduces === null || c.reduces === undefined) ok(`${tag} claims no reduction (exit criterion not yet met)`);
    else if (c.baseline.status === "measured" && c.current.status === "measured" && c.reduction_basis) {
      ok(`${tag} claims a reduction from two measured rates, basis "${c.reduction_basis}"`);
    } else {
      fail(`${tag} claims reduces=${c.reduces} without two measured rates and a stated basis — this is the F1 fabrication in Day-2 clothing`);
    }
  }
  if (seen.size >= 5) ok(`failure register carries ${seen.size} classes`);
  else fail(`failure register carries only ${seen.size} classes — too thin to be the Day-2 rung's evidence`);

  // Every hook in the shipped manifest should eventually appear as some class's tool. Reported as
  // coverage, not asserted as complete: an honest gap beats a register padded to look finished.
  const registeredTools = new Set((reg.classes || []).map((c) => c.tool && c.tool.path));
  const hooksJson = join(ROOT, "hooks", "hooks.json");
  if (existsSync(hooksJson)) {
    const raw = read(hooksJson);
    const hookFiles = [...new Set([...raw.matchAll(/hooks\/([a-z0-9-]+\.mjs)/g)].map((m) => `hooks/${m[1]}`))];
    const covered = hookFiles.filter((h) => registeredTools.has(h));
    ok(`Day-2 register covers ${covered.length}/${hookFiles.length} registered hooks (gap is reported, not asserted away)`);
  }
}
