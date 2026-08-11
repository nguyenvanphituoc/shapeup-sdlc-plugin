// Structural test module: docs. Split out of tests/structural.mjs (Track C).
// Sections: 5, 7, 25, 26, 49. Byte-identical bodies; the runner threads the shared ctx.
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
  // RAISED 450 → 460 in v1.4.1, deliberately and on the record, because the ratchet's rule is that
  // prose must not regrow SILENTLY. What bought the ten lines is Step 1c: what to do when
  // `init-run.mjs` exits 3 because a run is already open. That branch had no procedure anywhere —
  // `--from build` appeared once in a flags line and nowhere else in 449 lines — and it is the branch
  // a session takes on every cold start into live work, which is exactly the SDD benchmark's F4
  // handoff. Measured cost of leaving it unwritten: 82–120 turns before the first write, 0/3 gap
  // closed. The mechanical half went into scripts and hooks where this rule wants it (exit 3 now
  // prints the derived resume state; the SessionStart hook injects it); these ten lines are the part
  // that has to be in the orchestrator's own instructions, because they tell it which phase to
  // re-enter at.
  const LINE_RATCHETS = { "skills/tech-lead/SKILL.md": 460 };
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
      const WORDNUM = { nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15 };
      // Spelled-out counts drift too, and silently: "The twelve skills" sat above a 13-row table
      // because the digit-only pattern could not see it. A drift check that only reads one notation
      // is a drift check with a blind spot.
      for (const m of read(p).matchAll(/the ([0-9]+|nine|ten|eleven|twelve|thirteen|fourteen|fifteen) (?:harness )?skills/gi)) {
        m[1] = String(WORDNUM[m[1].toLowerCase()] ?? m[1]);
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
    // Recurse: `docs/design/` gained `adr/` (ADR-0001), and a flat readdir both skipped the
    // decision records and handed a directory to readFileSync. Decision records cite more concrete
    // paths than any other doc, so they are exactly what this drift check wants to cover.
    const mdUnder = (rel) => readdirSync(join(ROOT, rel)).flatMap((f) =>
      statSync(join(ROOT, rel, f)).isDirectory() ? mdUnder(`${rel}/${f}`) : (f.endsWith(".md") ? [`${rel}/${f}`] : []));
    const docFiles = ["README.md", ...mdUnder("docs/design")];
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


  // =============================================================================
  section("49. Attempt-loop doc parity — the prose names the ratchet's four-way branch");
  // =============================================================================
  // v1.5.0 replaced a green/red + stash-and-retry attempt loop with a ratchet whose branch
  // selector is `status` ∈ kept|reverted|rebased|crash, decided inside t0-verify.mjs. SKILL.md
  // followed; the two reference docs it routes to at :110-111 did not — round-protocol.md still
  // prescribed the stash branch that lib/ratchet-tree.mjs was written to fix, and delegation.md
  // still documented the read-back as "overall (green|red) + regression (bool)". Section 25
  // above caps how MUCH orchestrator prose exists and asserts nothing about whether it is TRUE;
  // this is that other half. The mechanism already drifted from its docs once.
  {
    const RATCHET_STATUSES = ["kept", "reverted", "rebased", "crash"];
    const LOOP_DOCS = [
      "skills/tech-lead/SKILL.md",
      "skills/tech-lead/references/round-protocol.md",
      "skills/tech-lead/references/delegation.md",
    ];
    // SKILL.md names the retired branch AS retired ("Subsumes the old seesaw `git stash`
    // branch"), which is the one legitimate use. The reference docs are where the string only
    // ever appeared as a live instruction, so the ban covers those two.
    const NO_RETIRED_BRANCH = LOOP_DOCS.slice(1);
    for (const rel of LOOP_DOCS) {
      const p = join(ROOT, rel);
      if (!existsSync(p)) { fail(`attempt-loop doc missing: ${rel}`); continue; }
      const txt = read(p);
      const missing = RATCHET_STATUSES.filter((s) => !new RegExp(`\\b${s}\\b`).test(txt));
      if (missing.length) fail(`${rel} describes the attempt loop but never names ${missing.join(", ")} — the branch is kept|reverted|rebased|crash, decided in t0-verify.mjs decideStatus()`);
      else ok(`${rel} names all four ratchet statuses`);
      if (!NO_RETIRED_BRANCH.includes(rel)) continue;
      if (/git stash/.test(txt)) fail(`${rel} prescribes \`git stash\` — the retired pre-ratchet branch that left a failing tree on the branch for the next attempt's fresh subagent; the tree is moved by t0-verify.mjs via shadow refs`);
      else ok(`${rel} free of the retired stash-and-retry branch`);
      // t0-verify exits 1 on a `kept` red-but-improved attempt — the ratchet's signature case —
      // because the exit code carries the T0 binary, deliberately mirroring oracles/*. A doc
      // that hands the orchestrator this branch must say so, or the next reader wires it into
      // an `&&` chain and loses exactly the case the ratchet was built for.
      if (/exit\s+code/i.test(txt)) ok(`${rel} states the exit-code reading rule`);
      else fail(`${rel} documents the attempt loop but never warns that the exit code is the T0 binary, not the ratchet decision`);
    }
  }

}
