// Structural test module: the documented invocation path must match the granted permission.
//
// THE DEFECT THIS MODULE EXISTS FOR (censused across the shipped prose).
//
// `npx shapeup-sdlc init` writes prefix rules of the form
// `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/:*)`. Against that grant, the skills
// actually instructed the model to run:
//
//     node "${CLAUDE_PLUGIN_ROOT}/skills/…"      2 sites   — matches
//     node skills/<owner>/scripts/…             13 sites   — only if the model prepends the root
//     node scripts/…                (bare)      18 sites   — matches nothing, and resolves to
//                                                            nothing from the project cwd
//
// The bare form was the HOT PATH: `compile-order` ×8, `ingest-result` ×5, `t0-verify` ×3 — once
// per attempt, up to five attempts per scope per round. There is no `scripts/` at a project root;
// those scripts ship with the plugin. The gap was bridged by a PROSE NOTE asking the model to
// perform a string substitution — a prompt-carried invariant sitting directly underneath the
// mechanism built to forbid prompt-carried invariants. Its failure mode is measured: 26 approval
// denials in one session. The two sites that DID carry the literal form were `init-run` and
// `gate-answers` — precisely the two the project had already been burned on.
//
// WHAT THIS MODULE ASSERTS:
//   1. Every `node …/scripts/*.mjs` in shipped skill prose is in the literal, quoted
//      `node "${CLAUDE_PLUGIN_ROOT}/skills/<owner>/scripts/…"` form. No bare, no half-qualified.
//   2. The owner segment names the skill the script ACTUALLY lives in — a literal path pointing
//      at the wrong skill is a dangling command that merely looks right.
//   3. The grant `bin/init.mjs` writes is a prefix of every one of those commands. This is the
//      check that keeps the two from drifting apart again: quoting the path (needed for install
//      paths containing a space) would otherwise silently put every call site back outside the
//      grant, which is the exact defect being fixed.
//   4. The substitution note is gone. It existed only to explain the bare form.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Run the structural checks for documented invocation paths.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("43. Every documented script invocation is in the form the permission grant matches");
  // =============================================================================

  // Where each script actually lives — the filesystem is the only authority.
  const owner = new Map();
  const skillsDir = join(ROOT, "skills");
  for (const skill of readdirSync(skillsDir)) {
    const scripts = join(skillsDir, skill, "scripts");
    if (!existsSync(scripts)) continue;
    for (const f of readdirSync(scripts)) if (f.endsWith(".mjs")) owner.set(f, skill);
  }

  // Every shipped prose file (SKILL.md + references/), the surface a model actually reads.
  const docs = [];
  for (const skill of readdirSync(skillsDir)) {
    const sf = join(skillsDir, skill, "SKILL.md");
    if (existsSync(sf)) docs.push({ rel: `skills/${skill}/SKILL.md`, abs: sf });
    const refDir = join(skillsDir, skill, "references");
    if (existsSync(refDir)) {
      for (const f of readdirSync(refDir).filter((x) => x.endsWith(".md"))) {
        docs.push({ rel: `skills/${skill}/references/${f}`, abs: join(refDir, f) });
      }
    }
  }

  const LITERAL = /node\s+"\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/([a-z-]+)\/scripts\/((?:[a-z-]+\/)*)([a-z0-9-]+\.mjs)"/g;
  const ANY_INVOCATION = /node\s+(?:"?\$\{CLAUDE_PLUGIN_ROOT\}[^"\s]*"?|skills\/[a-z-]+\/scripts\/[^\s`]+|scripts\/[a-z0-9/-]+\.mjs)/g;

  let literal = 0, wrong = 0;
  for (const { rel, abs } of docs) {
    const body = readFileSync(abs, "utf8");
    const lines = body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(ANY_INVOCATION)) {
        const text = m[0];
        // Re-match the literal form against this exact token.
        const lit = new RegExp(LITERAL.source).exec(text);
        if (!lit) {
          fail(`${rel}:${i + 1} invokes a script in a form no permission rule matches: ${text.slice(0, 70)}`);
          wrong++;
          continue;
        }
        literal++;
        const [, ownerSeg, sub, script] = lit;
        const actual = owner.get(script);
        if (actual && actual !== ownerSeg && !sub) {
          fail(`${rel}:${i + 1} names skills/${ownerSeg}/ but ${script} lives in skills/${actual}/`);
          wrong++;
        }
      }
    }
  }
  if (wrong === 0) ok(`all ${literal} documented invocations use the literal \${CLAUDE_PLUGIN_ROOT} form and name the right owner`);
  if (literal < 25) fail(`only ${literal} invocations found — the census counted 31; the scan is missing call sites`);
  else ok(`${literal} invocations scanned (the censused population was 31)`);

  // (3) The grant is a genuine prefix of every documented command.
  const initPath = join(ROOT, "bin/init.mjs");
  if (!existsSync(initPath)) fail("bin/init.mjs is missing — the permission grant cannot be verified");
  else {
    const initSrc = readFileSync(initPath, "utf8");
    // Reconstruct the granted prefixes from the source, both spellings.
    const owners = [...initSrc.matchAll(/const OWNERS = \[([^\]]+)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]));
    if (owners.length === 0) fail("bin/init.mjs no longer declares an OWNERS list — the grant shape changed and this check is blind");
    else {
      const prefixes = owners.flatMap((o) => [
        `node \${CLAUDE_PLUGIN_ROOT}/skills/${o}/scripts/`,
        `node "\${CLAUDE_PLUGIN_ROOT}/skills/${o}/scripts/`,
      ]);
      let ungranted = 0;
      for (const { rel, abs } of docs) {
        const body = readFileSync(abs, "utf8");
        for (const m of body.matchAll(LITERAL)) {
          if (!prefixes.some((p) => m[0].startsWith(p))) {
            fail(`${rel}: "${m[0].slice(0, 60)}" is not covered by any granted prefix`);
            ungranted++;
          }
        }
      }
      if (ungranted === 0) ok(`every documented invocation is covered by a prefix bin/init.mjs grants (${prefixes.length} rules over ${owners.length} owners)`);
      // The quoted spelling must be granted, or quoting silently un-grants everything.
      if (prefixes.some((p) => p.includes('"'))) ok("the grant covers the QUOTED spelling — quoting for spaced install paths does not un-grant the call sites");
      else fail("bin/init.mjs grants only the unquoted prefix, but the skills write the quoted form — every call site is outside the grant");
    }
  }

  // (4) The substitution note is gone.
  const techLead = join(ROOT, "skills/tech-lead/SKILL.md");
  if (existsSync(techLead)) {
    const body = readFileSync(techLead, "utf8");
    if (/bare\s+`?scripts\//i.test(body) || /resolve them against\s+this SKILL\.md/i.test(body)) {
      fail("skills/tech-lead/SKILL.md still carries the bare-path substitution note — a prompt-carried invariant under the mechanism built to forbid them");
    } else ok("the bare-path substitution note is gone: no invariant is left riding in prose here");
  }
}
