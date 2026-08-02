// Structural test module: skills. Split out of tests/structural.mjs (Track C).
// Sections: 2, 3, 12, 16. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the skills structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;

  // =============================================================================
  section("2. Every skill has valid SKILL.md frontmatter");
  // =============================================================================
  const skillsDir = join(ROOT, "skills");
  const skillDirs = readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory());

  if (skillDirs.length === 0) fail("no skills found");
  for (const dir of skillDirs) {
    const skillFile = join(skillsDir, dir, "SKILL.md");
    if (!existsSync(skillFile)) { fail(`${dir}/ has no SKILL.md`); continue; }
    const meta = frontmatter(read(skillFile));
    if (!meta) { fail(`${dir}/SKILL.md has no frontmatter block`); continue; }
    if (!meta.name) fail(`${dir}/SKILL.md frontmatter missing "name"`);
    else if (meta.name !== dir) fail(`${dir}/SKILL.md name "${meta.name}" != directory "${dir}"`);
    else ok(`${dir} name matches dir`);
    if (!meta.description) fail(`${dir}/SKILL.md frontmatter missing "description"`);
    else if (meta.description.length < 40) fail(`${dir}/SKILL.md description suspiciously short (${meta.description.length} chars)`);
    else ok(`${dir} description ok (${meta.description.length} chars)`);
  }

  // Description-composition lint (skills-optimization plan A1, guard #2). The description is ALWAYS
  // in context every session — it must carry only what-it-does + when-to-trigger, never behavioral
  // contracts or version changelogs (those belong in the SKILL.md body, loaded only on trigger).
  // Lint the CONTENT, not the char count: trigger-evals are the length arbiter; a hard cap would
  // fight skill-creator's own held-out-score selection. Fails on provably-misplaced prose only.
  const BANNED_IN_DESC = [
    [/\bv\d+\.\d+/, "version/changelog marker (e.g. v0.13) — put changelogs in the body"],
    [/\bWorkResult\b/, "envelope-return semantics (WorkResult) — a contract, not a trigger"],
    [/\bpure worker\b/i, "role-contract prose (\"pure worker\") — belongs in the body"],
    [/\bsole writer\b/i, "single-writer contract (\"sole writer\") — belongs in the body"],
    [/\bNO (verdict|score|gate)\b/, "contract negation (\"NO verdict/score/gate\") — belongs in the body"],
  ];
  for (const dir of skillDirs) {
    const skillFile = join(skillsDir, dir, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    const meta = frontmatter(read(skillFile));
    const desc = meta?.description || "";
    const hits = BANNED_IN_DESC.filter(([re]) => re.test(desc)).map(([, why]) => why);
    if (hits.length) fail(`${dir}/SKILL.md description carries misplaced prose: ${hits.join("; ")}`);
    else ok(`${dir} description is composition-clean (no contracts/changelog in metadata)`);
  }


  // =============================================================================
  section("3. Every references/<file> mentioned in a SKILL.md actually exists");
  // =============================================================================
  // Catches the broken-link class of bug (the audit found `AGENT.md` referenced but absent).
  const refRe = /references\/[A-Za-z0-9._\/-]+\.md/g;
  for (const dir of skillDirs) {
    const skillFile = join(skillsDir, dir, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    const body = read(skillFile);
    const mentioned = new Set(body.match(refRe) || []);
    for (const rel of mentioned) {
      const abs = join(skillsDir, dir, rel);
      if (!existsSync(abs)) fail(`${dir}/SKILL.md references missing file: ${rel}`);
      else ok(`${dir} → ${rel}`);
    }
  }


  // =============================================================================
  section("12. No SHIPPED skill file points at a repo-only path (would dangle on install)");
  // =============================================================================
  // Only recognized component dirs ship: a Claude plugin install copies the WHOLE repo (incl.
  // `hooks/` and `scripts/`) to the plugin cache; the Antigravity/Codex scaffolding paths and
  // distribute.js's Cursor-rules channel copy/inline only `skills/` — so a SKILL.md that assumes
  // repo-root `scripts/`, `examples/`, `docs/audit|plan|research/`, or `tests/` exists dangles
  // on those lower-fidelity channels. Since v1.0 the runtime scripts live INSIDE their owning
  // skill (per the custom-skills doc: scripts ship beside SKILL.md), so two reference forms are
  // legitimate and checked by EXISTENCE, not pattern:
  //   • skill-local  `scripts/<file>` — must exist under THIS skill's directory
  //   • cross-skill  `skills/<name>/(scripts|schemas)/<file>` — must exist under skills/
  // Runtime project paths the harness itself creates (`shapeup/`, `.shapeup/`)
  // stay fine. This guard is the fix for the false confidence the cwd-dependent oracle CLI
  // checks (#6, #9–#11) gave: those run from the repo root; a real install does not.
  const REPO_ONLY = /(?:^|[\s`(])(?:scripts\/|examples\/|docs\/audit|docs\/plan|docs\/research|tests\/)/;
  const LOCAL_SCRIPT_RE = /(?:^|[\s`("'])(scripts\/[A-Za-z0-9._/-]+\.[a-z]+)/g;
  const CROSS_SKILL_RE = /skills\/[A-Za-z0-9-]+\/(?:scripts|schemas)\/[A-Za-z0-9._-]+\.[a-z]+/g;
  const shippedSkillDocs = [];
  for (const dir of skillDirs) {
    const sf = join(skillsDir, dir, "SKILL.md");
    if (existsSync(sf)) shippedSkillDocs.push({ path: sf, dir });
    const refDir = join(skillsDir, dir, "references");
    if (existsSync(refDir)) {
      for (const f of readdirSync(refDir).filter((x) => x.endsWith(".md"))) shippedSkillDocs.push({ path: join(refDir, f), dir });
    }
  }
  for (const { path: f, dir } of shippedSkillDocs) {
    const rel = f.replace(ROOT + "/", "");
    const skillRoot = join(skillsDir, dir);
    const body = read(f);
    const bad = body.split(/\r?\n/)
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => {
        if (!REPO_ONLY.test(line)) return false;
        if (/docs\/shapeup-sdlc|\.shapeup/.test(line)) return false;
        // Skill-local scripts ship with the skill: allow when every scripts/ token resolves
        // inside this skill's own directory.
        const locals = [...line.matchAll(LOCAL_SCRIPT_RE)].map((m) => m[1]);
        if (locals.length && locals.every((t) => existsSync(join(skillRoot, t)))) return false;
        return true;
      });
    if (bad.length) fail(`${rel} references repo-only path(s) that will not exist in an install: line ${bad.map((b) => b.n).join(", ")}`);
    else ok(`${rel} has no dangling repo-only path`);
    // Cross-skill script/schema references must point at files that actually ship.
    const dangling = [...new Set([...body.matchAll(CROSS_SKILL_RE)].map((m) => m[0]))]
      .filter((p) => !existsSync(join(ROOT, p)));
    if (dangling.length) fail(`${rel} references missing cross-skill file(s): ${dangling.join(", ")}`);
    else ok(`${rel} cross-skill script refs all exist`);
  }


  // =============================================================================
  section("16. Tier-1 trigger-eval datasets are well-formed and the baseline is honest (Stage C1)");
  // =============================================================================
  // The evidence layer F1 found missing. We can't measure trigger activation without Claude auth,
  // but we CAN guarantee the datasets are sound and — critically — that the baseline never fabricates
  // numbers (the prior roadmap's sin). Each dataset: names its own skill, has positives AND
  // cross-skill hard negatives, every `expected_other` names a real skill (or "none"). Baseline: if
  // `unmeasured`, results MUST be null; if `measured`, it MUST carry method + measured_at.
  const VALID_SKILLS = new Set(skillDirs);
  let datasetCount = 0, caseCount = 0;
  for (const dir of skillDirs) {
    const f = join(skillsDir, dir, "evals", "trigger-evals.json");
    if (!existsSync(f)) continue;
    datasetCount++;
    let ds;
    try { ds = readJSON(f); } catch (e) { fail(`${dir}/evals/trigger-evals.json does not parse: ${e.message}`); continue; }
    if (ds.skill !== dir) fail(`${dir} trigger-evals "skill" is "${ds.skill}", must match its directory`);
    if (!Array.isArray(ds.cases) || ds.cases.length < 6) { fail(`${dir} trigger-evals needs >=6 cases`); continue; }
    caseCount += ds.cases.length;
    const pos = ds.cases.filter((c) => c.should_trigger === true);
    const neg = ds.cases.filter((c) => c.should_trigger === false);
    if (pos.length >= 4 && neg.length >= 3) ok(`${dir} trigger-evals: ${pos.length}+ / ${neg.length}− cases`);
    else fail(`${dir} trigger-evals needs >=4 positives and >=3 negatives (got ${pos.length}/${neg.length})`);
    for (const c of ds.cases) {
      if (typeof c.query !== "string" || !c.query.trim()) { fail(`${dir} trigger-evals has a case with no query`); break; }
      if (typeof c.should_trigger !== "boolean") { fail(`${dir} trigger-evals case "${c.query}" missing boolean should_trigger`); break; }
    }
    // Every hard negative must say where it SHOULD go — a real sibling skill, or "none".
    const badOther = neg.filter((c) => !c.expected_other || (c.expected_other !== "none" && !VALID_SKILLS.has(c.expected_other)));
    if (badOther.length) fail(`${dir} trigger-evals negatives with invalid expected_other: ${badOther.map((c) => c.expected_other).join(", ")}`);
    else ok(`${dir} trigger-evals negatives all route to a real skill or "none"`);
    // A self-negative (a sibling pointing its negative back at this skill) would be incoherent.
    if (neg.some((c) => c.expected_other === dir)) fail(`${dir} trigger-evals has a negative whose expected_other is itself`);
  }
  if (datasetCount === skillDirs.length) ok(`every skill (${datasetCount}) has a trigger-eval dataset`);
  else fail(`only ${datasetCount}/${skillDirs.length} skills have trigger-eval datasets`);

  // Baseline honesty invariant — the mechanical encoding of the F1 lesson.
  const baselinePath = join(ROOT, "evals/baselines/trigger-evals.baseline.json");
  if (existsSync(baselinePath)) {
    const b = readJSON(baselinePath);
    if (b.status === "unmeasured") {
      if (b.results === null || b.results === undefined) ok("trigger-eval baseline is honestly unmeasured (results: null)");
      else fail("trigger-eval baseline says 'unmeasured' but carries results — fabricated numbers (the F1 sin)");
    } else if (b.status === "measured") {
      if (b.results && b.method && b.measured_at) ok("trigger-eval baseline is measured with method + measured_at");
      else fail("trigger-eval baseline says 'measured' but lacks results/method/measured_at");
    } else fail(`trigger-eval baseline has unknown status "${b.status}" (expected unmeasured|measured)`);
    // The recorded dataset inventory must match what's on disk (no stale counts).
    if (b.datasets && Object.keys(b.datasets).length === datasetCount) ok("baseline dataset inventory matches the datasets on disk");
    else fail(`baseline inventory lists ${b.datasets ? Object.keys(b.datasets).length : 0} skills, disk has ${datasetCount}`);
  } else {
    fail("evals/baselines/trigger-evals.baseline.json missing — run `node tools/trigger-eval.mjs`");
  }
  if (existsSync(join(ROOT, "tools/trigger-eval.mjs"))) ok("trigger-eval harness present");
  else fail("tools/trigger-eval.mjs missing");

}
