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
import { pipelineEntryPoints, pipelineRules } from "../../bin/lib/grant.mjs";

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
  // Floor LOWERED 25 -> 18 at the orchestrator cutover, deliberately and on the record — this
  // comment being the record, since the staging plan it cited is no longer in the tree (the census
  // this floor guards moved from 36 to 21 in that cutover's own diff). The cutover's
  // SKILL.md rewrite (the thin shell — see tests/structural/08-docs.mjs's ratchet, same commit)
  // deletes the BUILD/EVAL/SHIP prose that used to inline ~15 of these `node "${CLAUDE_PLUGIN_ROOT}
  // /..."` call sites directly in SKILL.md; those operations now run as CODE inside
  // skills/tech-lead/workflows/shapeup-run.js (which invokes its own scripts through mech(), a
  // form this scan does not and should not recognise — a workflow script has no permission-grant
  // problem to guard against, it runs as the harness's own Bash tool call, not a model reading
  // prose). The remaining literal invocations are real: GATE L0/L4's own scripts (init-run,
  // gate-answers, ship-report) still run from SKILL.md's own conversation, and every reference file
  // (gates.md, delegation.md, round-protocol.md) keeps its own copies for the tiny/scope-less lane
  // this migration explicitly leaves on the old prose path. 18 leaves headroom below the current
  // 21 without re-opening the floor to a silent drop toward zero.
  if (literal < 18) fail(`only ${literal} invocations found — the post-migration census expects at least 18; the scan is missing call sites`);
  else ok(`${literal} invocations scanned (post-migration floor: 18)`);

  // (3) Every documented call site has a rule, and every rule has a script.
  //
  // WHAT THIS CHECK USED TO BE, AND WHY IT WAS REPLACED. It asserted the granted prefix was a
  // STRING PREFIX of each documented command. That is a proxy for "the CLI will honour this", and
  // the two diverged exactly here: the shipped rule `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/<o>/
  // scripts/:*)` is a perfectly good string prefix of every call site AND granted no command at
  // all, because Bash prefix rules match at complete ARGUMENT boundaries and that prefix ends in
  // the middle of a path argument. The module stayed green across three releases over a pipeline
  // that could not take its first step (HD-009).
  //
  // So the matching SEMANTICS are no longer asserted here — they cannot be, offline: the decision
  // lives inside the CLI. `tests/grant/executing-grant.mjs` starts a real session and decides by
  // whether the target script's marker file landed. THAT is the evidence; this is bookkeeping.
  // What is checkable here, and worth checking, is COMPLETENESS in both directions: no call site
  // without a rule, no rule without a script.
  const rules = pipelineRules(ROOT);
  const entryPoints = new Set(pipelineEntryPoints(ROOT));

  if (rules.length === 0) fail("bin/lib/grant.mjs produced no rules — the grant is empty and every dispatch will be denied");
  else ok(`bin/lib/grant.mjs generates ${rules.length} rules over ${entryPoints.size} entry points`);

  // 3a — every script a shipped doc tells the model to run is covered, in BOTH argument shapes.
  // Both are needed: the trailing ` *` form requires at least one argument, so a bare `node "<p>"`
  // is denied without the argument-less rule. That asymmetry is measured, not assumed.
  {
    const cited = new Set();
    for (const { abs } of docs) {
      for (const m of readFileSync(abs, "utf8").matchAll(LITERAL)) {
        cited.add(`skills/${m[1]}/scripts/${m[2]}${m[3]}`);
      }
    }
    let missing = 0;
    for (const rel of [...cited].sort()) {
      const withArgs = `Bash(node "*/${rel}" *)`;
      const bare = `Bash(node "*/${rel}")`;
      for (const want of [withArgs, bare]) {
        if (!rules.includes(want)) { fail(`documented call site ${rel} has no rule ${want}`); missing++; }
      }
    }
    if (missing === 0) ok(`all ${cited.size} documented call sites are granted in both argument shapes`);
  }

  // 3b — no rule points at a script that does not exist. A dead rule is a grant nobody can audit.
  {
    let dead = 0;
    for (const rule of rules) {
      const m = rule.match(/^Bash\(node "\*\/(skills\/[a-z-]+\/scripts\/[a-z0-9-]+\.mjs)"/);
      if (!m) { fail(`rule is not in the audited shape: ${rule}`); dead++; continue; }
      if (!entryPoints.has(m[1]) || !existsSync(join(ROOT, m[1]))) {
        fail(`rule grants ${m[1]}, which is not a shipped entry point`); dead++;
      }
    }
    if (dead === 0) ok("every generated rule names a script that exists on disk");
  }

  // 3c — the example file users are pointed at must BE the generated set, not a hand-copy of it.
  // It drifted before: it listed 3 rules while the installer wrote 6, and the README calls it the
  // authoritative preview of what is pre-approved.
  {
    const ex = join(ROOT, ".claude/settings.local.example.json");
    if (!existsSync(ex)) fail(".claude/settings.local.example.json is missing — it ships in the files allowlist");
    else {
      let parsed = null;
      try { parsed = JSON.parse(readFileSync(ex, "utf8")); } catch (e) { fail(`.claude/settings.local.example.json is not valid JSON: ${e.message}`); }
      if (parsed) {
        const shown = [...(parsed.permissions?.allow || [])].sort();
        const want = [...rules].sort();
        if (shown.length === want.length && shown.every((r, i) => r === want[i])) {
          ok("settings.local.example.json shows exactly the rules the installer writes");
        } else {
          fail(`settings.local.example.json lists ${shown.length} rules but the installer writes ${want.length} — the preview users are pointed at is drift`);
        }
      }
    }
  }

  // 3d — staleness gate on the executing proof. Bookkeeping above cannot see whether the rules
  // still WORK; only `npm run test:grant` can. If the grant generator or any entry point has moved
  // since that proof was last stamped, say so rather than let this module imply coverage it has not
  // got. Degrades to a note outside a git checkout instead of failing the suite.
  {
    const stampFile = join(ROOT, "tests/grant/last-verified.json");
    if (!existsSync(stampFile)) {
      fail("tests/grant/last-verified.json is missing — no execution has ever proven these rules grant anything");
    } else {
      let stamp = null;
      try { stamp = JSON.parse(readFileSync(stampFile, "utf8")); } catch { fail("tests/grant/last-verified.json is not valid JSON"); }
      if (stamp) {
        if (stamp.rules !== rules.length) {
          fail(`the executing guard last proved ${stamp.rules} rules, the generator now emits ${rules.length} — re-run: npm run test:grant`);
        } else ok(`executing guard last verified ${stamp.rules} rules on CLI ${stamp.cli_version || "?"} (tests/grant/last-verified.json)`);
      }
    }
  }

  // (5) The grant is actually WRITTEN — on BOTH install paths, executed rather than read.
  //
  // Checks (1)–(3) prove the grant MATCHES the call sites. They cannot see whether it is ever
  // written, and for one release it was not: `installClaude()` takes the `claude` CLI path whenever
  // that binary exists — the common case — and returned before reaching `mergePipelinePermissions`,
  // while the comment beside it claimed both paths merged. A fresh `npx shapeup-sdlc init` printed
  // success and produced `permissions.allow: []`. That is FC-02 in the install script itself: the
  // enforcement point inert on the path people actually take, and its measured cost is the 26
  // approval denials this whole module exists because of.
  //
  // So this runs the installer twice against a temp project — once with a fake `claude` on PATH
  // (CLI path), once with PATH stripped of it (fallback) — and asserts the grant lands both times.
  {
    const { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { spawnSync } = await import("node:child_process");

    // IMPORTED, never re-derived. This block used to rebuild the expected rules by regex-parsing
    // `const OWNERS = [...]` out of the installer's source — a test comparing the code against its
    // own copy of the intent, which is how a grant that matched nothing passed. Ask the generator.
    const initFile = join(ROOT, "bin/init.mjs");
    const expectedRules = pipelineRules(ROOT);

    const grantsIn = (file) => {
      if (!existsSync(file)) return null;
      try { return new Set(JSON.parse(readFileSync(file, "utf8"))?.permissions?.allow || []); }
      catch { return null; }
    };
    const runInstaller = (label, withFakeCli) => {
      const box = mkdtempSync(join(tmpdir(), "init-grant-"));
      try {
        const proj = join(box, "proj");
        mkdirSync(proj, { recursive: true });
        const binDir = join(box, "bin");
        mkdirSync(binDir, { recursive: true });
        if (withFakeCli) {
          // Stands in for the real CLI: succeeds, and writes the marketplace/plugin keys the way
          // the real one does, so the merge is tested against a NON-EMPTY settings.json.
          writeFileSync(join(binDir, "claude"), [
            "#!/usr/bin/env bash",
            'if [ "$1" = "--version" ]; then echo "fake 1.0"; exit 0; fi',
            'mkdir -p .claude',
            `printf '%s' '{"extraKnownMarketplaces":{"nvptuoc-marketplace":{}},"enabledPlugins":{"shapeup-sdlc-plugin@nvptuoc-marketplace":true}}' > .claude/settings.json`,
            "exit 0",
          ].join("\n"));
          chmodSync(join(binDir, "claude"), 0o755);
        }
        const PATH = withFakeCli
          ? `${binDir}:${process.env.PATH}`
          : (process.env.PATH || "").split(":").filter((d) => !existsSync(join(d, "claude"))).join(":");
        const r = spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "-d", proj, "-y"],
          { cwd: proj, env: { ...process.env, PATH }, encoding: "utf8" });
        if (r.status !== 0) { fail(`bin/init.mjs exited ${r.status} on the ${label} path: ${(r.stderr || "").slice(0, 200)}`); return; }

        const allow = grantsIn(join(proj, ".claude", "settings.json"));
        if (allow === null) { fail(`bin/init.mjs (${label} path) left no readable .claude/settings.json — the pipeline grant cannot be there`); return; }
        const missing = expectedRules.filter((r) => !allow.has(r));
        if (missing.length === 0) ok(`bin/init.mjs writes all ${expectedRules.length} pipeline grants on the ${label} path`);
        else fail(`bin/init.mjs (${label} path) wrote ${allow.size} grant(s), missing ${missing.length}: ${missing[0]} — a headless run cannot take its first step without these`);

        if (withFakeCli) {
          // The merge must not clobber what the CLI wrote, or installing the plugin un-installs it.
          let s = {};
          try { s = JSON.parse(readFileSync(join(proj, ".claude", "settings.json"), "utf8")); } catch { /* handled above */ }
          if (s.enabledPlugins && Object.keys(s.enabledPlugins).length) ok("the grant is MERGED into what the claude CLI wrote — enabledPlugins survives");
          else fail("bin/init.mjs overwrote the claude CLI's settings.json — the plugin registration is gone, so the grant arrived and the plugin left");
        }
      } finally { rmSync(box, { recursive: true, force: true }); }
    };

    if (existsSync(initFile) && expectedRules.length) {
      runInstaller("claude-CLI", true);
      runInstaller("fallback", false);
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
