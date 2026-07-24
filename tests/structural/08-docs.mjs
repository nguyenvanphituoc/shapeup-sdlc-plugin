// Structural test module: docs. Split out of tests/structural.mjs (Track C).
// Sections: 5, 7, 25, 26. Byte-identical bodies; the runner threads the shared ctx.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the docs structural checks.
 * @param {object} ctx - Shared harness context from tests/lib/harness.mjs (makeCtx).
 *   Carries ROOT (repo root), the ok/fail/section counters, and the read/readJSON/
 *   frontmatter/walk helpers. ok()/fail() mutate ctx.checks/ctx.failures in place.
 * @returns {Promise<void>} Resolves when the section bodies finish; assertions are
 *   recorded as side effects on ctx (never thrown for an ordinary check failure).
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON, frontmatter, walk } = ctx;
  const skillsDir = join(ROOT, "skills");
  const skillDirs = readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory());


  // =============================================================================
  section("5. No doc references a non-existent AGENT.md (regression guard for F8)");
  // =============================================================================
  // The evolution roadmap referenced `AGENT.md` (singular); the real file is AGENTS.md.
  const hasAgentsMd = existsSync(join(ROOT, "AGENTS.md"));
  const hasAgentMd = existsSync(join(ROOT, "AGENT.md"));
  for (const f of walk(ROOT)) {
    const rel = f.replace(ROOT + "/", "");
    const txt = read(f);
    // Flag a stray `AGENT.md` (not preceded by S, so AGENTS.md itself is fine) ONLY when the file
    // does not also mention AGENTS.md — a doc discussing the bug names both and is intentional.
    const mentionsBad = /(^|[^S\w])AGENT\.md/.test(txt);
    const mentionsGood = /AGENTS\.md/.test(txt);
    if (mentionsBad && !mentionsGood && !hasAgentMd) {
      fail(`${rel} references AGENT.md, but only AGENTS.md exists`);
    }
  }
  if (hasAgentsMd) ok("AGENTS.md present");


  // =============================================================================
  section("7. Migrations are well-formed (DB-migration discipline)");
  // =============================================================================
  // Ordered NNNN__slug.sh, unique ids, each defines MIGRATION_DESC + migration_up — so the runner
  // in lib-migrate.sh can discover, order, and apply them deterministically.
  const migDir = join(ROOT, "scripts/shapeup-sdlc/migrations");
  if (existsSync(migDir)) {
    const seen = new Map();
    for (const name of readdirSync(migDir).filter((f) => f.endsWith(".sh"))) {
      const m = name.match(/^(\d{4})__[a-z0-9-]+\.sh$/);
      if (!m) { fail(`migration "${name}" must match NNNN__slug.sh (4-digit id, kebab slug)`); continue; }
      const id = m[1];
      if (seen.has(id)) fail(`duplicate migration id ${id}: ${name} and ${seen.get(id)}`);
      else seen.set(id, name);
      const body = read(join(migDir, name));
      if (!/migration_up\s*\(\)/.test(body)) fail(`migration ${name} does not define migration_up()`);
      else ok(`migration ${name} defines migration_up()`);
      if (!/MIGRATION_DESC=/.test(body)) fail(`migration ${name} missing MIGRATION_DESC`);
    }
  } else {
    console.log("  (no scripts/shapeup-sdlc/migrations dir — skipping)");
  }


  // =============================================================================
  section("25. Prompt line-count ratchet — orchestrator prose must not silently regrow");
  // =============================================================================
  // The absorb-audit found prompt-mass growth is a failure mode discipline alone doesn't stop
  // (dwarves-kit: 31 commands × 25 agents of prose). 24995ba cut tech-lead to 724 lines; the
  // skills-optimization plan (A3) then extracted the gate playbooks into references/gates.md +
  // references/invocation.md, landing SKILL.md at ~447. This ratchet turns that cut into a
  // regression: new logic goes into scripts or references/, not SKILL.md prose.
  const LINE_RATCHETS = { "skills/tech-lead/SKILL.md": 450 };
  for (const [rel, limit] of Object.entries(LINE_RATCHETS)) {
    const p = join(ROOT, rel);
    if (!existsSync(p)) { fail(`ratcheted file missing: ${rel}`); continue; }
    const lines = read(p).split("\n").length;
    if (lines > limit) fail(`${rel} is ${lines} lines — over the ${limit}-line ratchet; move logic into scripts, not prose`);
    else ok(`${rel} within ratchet (${lines}/${limit} lines)`);
  }


  // =============================================================================
  section("26. Doc-drift — documented counts, hook inventory, and cited paths match the filesystem");
  // =============================================================================
  // The dwarves-kit failure mode observed locally: the comparison report went stale twice in
  // 24 hours. Docs that assert counts or cite paths are now checked against the tree.
  {
    // (a) skill counts: every "the N (harness) skills" claim equals the actual skill dir count.
    for (const rel of ["README.md", "docs/design/README.md", "docs/design/06-appendix.md"]) {
      const p = join(ROOT, rel);
      if (!existsSync(p)) continue;
      for (const m of read(p).matchAll(/the (\d+) (?:harness )?skills/g)) {
        if (Number(m[1]) !== skillDirs.length) fail(`${rel} claims "${m[0]}" but skills/ holds ${skillDirs.length}`);
        else ok(`${rel} skill count matches (${m[1]})`);
      }
    }

    // (b) hook inventory, both directions.
    const manifest = readJSON(join(ROOT, "hooks/hooks.json"));
    const registeredScripts = new Set();
    for (const groups of Object.values(manifest.hooks || {})) {
      for (const g of groups) for (const h of g.hooks || []) {
        const m = (h.command || "").match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?\.mjs)/);
        if (m) registeredScripts.add(m[1]);
      }
    }
    const readme = read(join(ROOT, "README.md"));
    const design03 = read(join(ROOT, "docs/design/03-system-design.md"));
    for (const script of registeredScripts) {
      const base = script.split("/").pop();
      if (!readme.includes(base)) fail(`hooks.json registers ${base} but README.md never mentions it (undocumented hook)`);
      else ok(`README documents hook ${base}`);
      if (!design03.includes(base)) fail(`hooks.json registers ${base} but docs/design/03-system-design.md never mentions it`);
      else ok(`design/03 documents hook ${base}`);
    }
    for (const f of readdirSync(join(ROOT, "hooks")).filter((f) => f.endsWith(".mjs"))) {
      if (![...registeredScripts].some((s) => s.endsWith(`/${f}`) || s === `hooks/${f}`)) {
        fail(`hooks/${f} exists on disk but hooks.json never registers it (orphan hook — it enforces nothing)`);
      } else ok(`hooks/${f} is registered`);
    }

    // (c) cited concrete paths exist (placeholders/globs are excluded by the char class).
    const pathRe = /(?:^|[\s`("'])((?:hooks|skills|scripts|tests|commands)\/[A-Za-z0-9._/-]+\.(?:mjs|json|js|md|sh))(?![A-Za-z0-9])/g;
    const docFiles = ["README.md", ...readdirSync(join(ROOT, "docs/design")).map((f) => `docs/design/${f}`)];
    const cited = new Map();
    for (const rel of docFiles) {
      for (const m of read(join(ROOT, rel)).matchAll(pathRe)) {
        if (!cited.has(m[1])) cited.set(m[1], rel);
      }
    }
    for (const [p, from] of cited) {
      if (!existsSync(join(ROOT, p))) fail(`${from} cites ${p} — not on disk (doc drift)`);
      else ok(`cited path exists: ${p}`);
    }

    // (d) checks-floor: docs state a floor ("N+ checks"), never an exact count that drifts.
    const floorM = read(join(ROOT, "docs/design/06-appendix.md")).match(/(\d+)\+ checks/);
    if (!floorM) fail(`docs/design/06-appendix.md states no "N+ checks" floor`);
    else { ctx.checksFloor = Number(floorM[1]); ok(`docs state a checks floor (${ctx.checksFloor}+)`); }
  }

}
