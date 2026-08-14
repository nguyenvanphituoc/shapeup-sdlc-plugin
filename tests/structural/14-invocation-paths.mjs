// Structural test module: the documented invocation path must match the granted permission.
//
// THE DEFECT THIS MODULE EXISTS FOR (censused across the shipped prose).
//
// Skill prose and the installer's grant are written by different hands and drift silently. Measured
// once already: 18 shipped call sites in a bare `node scripts/…` form that resolves to nothing from
// a project root and matches no rule, bridged by a PROSE NOTE asking the model to perform a string
// substitution — a prompt-carried invariant sitting directly underneath the mechanism built to
// forbid prompt-carried invariants. Its failure mode is measured: 26 approval denials in one
// session.
//
// v2.0 removes most of the surface this guarded: the deterministic half of the harness has ONE
// entry point (`kernel/harness.mjs`), so there is one command shape and one grant. What remains
// checkable, and worth checking, is that the prose and the grant still name the same thing.
//
// WHAT THIS MODULE ASSERTS:
//   1. Every kernel invocation in shipped skill prose is in the literal, quoted
//      `node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" <verb> [<action>]` form. No bare, no
//      half-qualified, no leftover per-script path.
//   2. The verb (and action) named is one the kernel's own routing table actually routes — a
//      command that merely looks right is a dangling instruction.
//   3. The grant `bin/init.mjs` writes covers that one entry point, in both argument shapes, and
//      names nothing that does not exist.
//   4. The substitution note is gone. It existed only to explain the bare form.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pipelineRules, mergePipelinePermissions, KERNEL_ENTRY, WORKFLOW_RULE } from "../../bin/lib/grant.mjs";

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

  // What the kernel actually routes — the routing table is the only authority.
  const { ROUTES } = await import(join(ROOT, "kernel/harness.mjs"));

  // Every shipped prose file (SKILL.md + references/), the surface a model actually reads.
  const skillsDir = join(ROOT, "skills");
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

  const LITERAL = /node\s+"\$\{CLAUDE_PLUGIN_ROOT\}\/kernel\/harness\.mjs"\s+([a-z]+)(?:\s+([a-z0-9]+))?/g;
  // Anything that looks like an attempt to run a shipped script, in ANY shape. A form this catches
  // and LITERAL does not is a call site outside the grant.
  const ANY_INVOCATION = /node\s+(?:"?\$\{CLAUDE_PLUGIN_ROOT\}[^"\s]*"?|skills\/[a-z-]+\/scripts\/[^\s`]+|kernel\/[a-z0-9/-]+\.mjs|scripts\/[a-z0-9/-]+\.mjs)/g;

  let literal = 0, wrong = 0;
  for (const { rel, abs } of docs) {
    const lines = readFileSync(abs, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(ANY_INVOCATION)) {
        const text = line.slice(m.index);          // the verb words follow the quoted path
        const lit = new RegExp(LITERAL.source).exec(text);
        if (!lit) {
          fail(`${rel}:${i + 1} invokes the harness in a form no permission rule matches: ${m[0].slice(0, 70)}`);
          wrong++;
          continue;
        }
        literal++;
        const [, verb, action] = lit;
        const target = ROUTES[verb];
        if (!target) {
          fail(`${rel}:${i + 1} names verb "${verb}", which the kernel does not route`);
          wrong++;
        } else if (typeof target === "object" && action && !target[action]) {
          fail(`${rel}:${i + 1} names "${verb} ${action}", and "${action}" is not one of ${Object.keys(target).filter((a) => a !== "_default").join(" | ")}`);
          wrong++;
        } else if (typeof target === "object" && !action && !target._default) {
          fail(`${rel}:${i + 1} names verb "${verb}" with no action, but it requires one`);
          wrong++;
        }
      }
    }
  }
  if (wrong === 0) ok(`all ${literal} documented invocations use the literal \${CLAUDE_PLUGIN_ROOT} kernel form and route`);
  // A floor, not a target. It exists so a rewrite that deletes the call sites instead of fixing
  // them cannot pass by making the census empty. The count moved 21 -> single digits at the v2.0
  // kernel cutover, because the BUILD/EVAL/SHIP prose that inlined one call site per step now runs
  // as CODE inside the workflow script (which invokes the kernel from a worker's own shell, a form
  // this scan does not and should not recognise — a workflow script reads no prose).
  if (literal < 4) fail(`only ${literal} invocations found — the kernel census expects at least 4; the scan is missing call sites`);
  else ok(`${literal} invocations scanned (kernel-cutover floor: 4)`);

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
  // The GRANT is what the installer actually writes — the Bash rules plus the optional Workflow
  // token — not just the Bash generator's output. Asking for the merged set is what keeps the
  // example file, the executing proof and this module comparing the same thing.
  const granted = {};
  mergePipelinePermissions(granted);
  const rules = granted.permissions.allow;

  if (rules.length === 0) fail("bin/lib/grant.mjs produced no rules — the grant is empty and every dispatch will be denied");
  else ok(`bin/lib/grant.mjs generates ${rules.length} rules over one entry point (${KERNEL_ENTRY})`);

  // 3a — the one entry point every documented call site uses is granted in BOTH argument shapes.
  // Both are needed: the trailing ` *` form requires at least one argument, so a bare
  // `node "<p>"` is denied without the argument-less rule. That asymmetry is measured, not assumed.
  {
    let missing = 0;
    for (const want of [`Bash(node "*/${KERNEL_ENTRY}" *)`, `Bash(node "*/${KERNEL_ENTRY}")`]) {
      if (!rules.includes(want)) { fail(`the kernel entry point has no rule ${want}`); missing++; }
    }
    if (missing === 0) ok("the kernel entry point is granted in both argument shapes");
    if (rules.includes(WORKFLOW_RULE)) ok(`the optional "${WORKFLOW_RULE}" grant is written by default (declinable with --no-native-workflow)`);
    else fail(`the default grant omits "${WORKFLOW_RULE}" — the unattended lane cannot launch its run script`);
  }

  // 3b — no rule points at something that does not exist. A dead rule is a grant nobody can audit.
  {
    let dead = 0;
    for (const rule of rules) {
      if (rule === WORKFLOW_RULE) continue;                 // a tool token, not a path
      const m = rule.match(/^Bash\(node "\*\/(kernel\/[a-z0-9-]+\.mjs)"/);
      if (!m) { fail(`rule is not in the audited shape: ${rule}`); dead++; continue; }
      if (m[1] !== KERNEL_ENTRY || !existsSync(join(ROOT, m[1]))) {
        fail(`rule grants ${m[1]}, which is not the shipped entry point`); dead++;
      }
    }
    if (dead === 0) ok("every generated rule names something that exists on disk");
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
    const expectedRules = pipelineRules();

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
        if (missing.length === 0) ok(`bin/init.mjs writes all ${expectedRules.length} harness grants on the ${label} path`);
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
