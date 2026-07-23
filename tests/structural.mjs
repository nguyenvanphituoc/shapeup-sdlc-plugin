#!/usr/bin/env node
// Structural test layer for the Shape Up SDLC plugin.
//
// Zero dependencies, zero network, no Claude calls. Runs in milliseconds and is safe in CI.
// It does NOT test agent behavior (that needs tier-1/2 evals — see docs/audit). It proves the
// plugin is *well-formed*: the cheapest, highest-ROI guard, and the one that would have caught
// the broken `AGENT.md` reference and any future frontmatter/version drift.
//
// Usage:  node tests/structural.mjs        (exit 0 = pass, 1 = fail)

import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
let checks = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const ok = (msg) => { checks++; if (process.env.VERBOSE) console.log(`  ✓ ${msg}`); };
const section = (name) => console.log(`\n▸ ${name}`);

const read = (p) => readFileSync(p, "utf8");
const readJSON = (p) => JSON.parse(read(p));

// --- tiny YAML-frontmatter extractor (top-level scalar keys only — enough for our schema) ---
function frontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const meta = {};
  let key = null, buf = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (buf !== null) {
      // continuation of a folded/literal block or quoted value spanning lines
      if (/^\S/.test(line) && line.includes(":")) {
        meta[key] = buf.trim(); buf = null; // fall through to new-key parse below
      } else { buf += " " + line.trim(); continue; }
    }
    const c = line.indexOf(":");
    if (c === -1 || /^\s/.test(line)) continue;
    key = line.slice(0, c).trim();
    let val = line.slice(c + 1).trim();
    if (val === ">" || val === "|") { buf = ""; continue; }
    val = val.replace(/^["']|["']$/g, "");
    meta[key] = val;
  }
  if (buf !== null && key) meta[key] = buf.trim();
  return meta;
}

// =============================================================================
section("1. Plugin & marketplace manifests parse and agree");
// =============================================================================
const pluginPath = join(ROOT, ".claude-plugin/plugin.json");
const marketPath = join(ROOT, ".claude-plugin/marketplace.json");
const pkgPath = join(ROOT, "package.json");

let plugin, market, pkg;
try { plugin = readJSON(pluginPath); ok("plugin.json parses"); }
catch (e) { fail(`plugin.json does not parse: ${e.message}`); }
try { market = readJSON(marketPath); ok("marketplace.json parses"); }
catch (e) { fail(`marketplace.json does not parse: ${e.message}`); }
try { pkg = readJSON(pkgPath); ok("package.json parses"); }
catch (e) { fail(`package.json does not parse: ${e.message}`); }

if (plugin) {
  for (const f of ["name", "version", "description"]) {
    if (!plugin[f]) fail(`plugin.json missing required field "${f}"`); else ok(`plugin.json has ${f}`);
  }
}
if (plugin && pkg && plugin.version !== pkg.version) {
  fail(`version drift: plugin.json=${plugin.version} but package.json=${pkg.version}`);
} else if (plugin && pkg) ok(`versions agree (${plugin.version})`);

if (market && plugin) {
  const named = (market.plugins || []).some((p) => p.name === plugin.name);
  if (!named) fail(`marketplace.json does not list plugin "${plugin.name}"`);
  else ok(`marketplace lists ${plugin.name}`);
}

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
section("4. Hooks manifest (if present) is valid JSON, uses real events, and resolves its scripts");
// =============================================================================
// Beyond parsing, guard the F2-class bug the audit found: a hook keyed on a NON-EXISTENT event
// (the old `ShapeupSessionStart`) is silently ignored — it looks wired but enforces nothing. So we
// also assert every event key is a real Claude Code hook event, and every `${CLAUDE_PLUGIN_ROOT}`
// script a command invokes actually exists in a shipped dir (or it would dangle at install).
const VALID_HOOK_EVENTS = new Set([
  "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
  "Notification", "Stop", "SubagentStop", "PreCompact", "Setup",
]);
const hooksPath = join(ROOT, "hooks/hooks.json");
if (existsSync(hooksPath)) {
  let hooksManifest;
  try { hooksManifest = readJSON(hooksPath); ok("hooks.json parses"); }
  catch (e) { fail(`hooks.json does not parse: ${e.message}`); }
  if (hooksManifest?.hooks) {
    for (const [event, groups] of Object.entries(hooksManifest.hooks)) {
      if (VALID_HOOK_EVENTS.has(event)) ok(`hook event "${event}" is a real Claude Code event`);
      else fail(`hook event "${event}" is not a valid event — it will be silently ignored (the F2 bug class)`);
      for (const g of groups || []) {
        for (const h of g.hooks || []) {
          // A command that runs a plugin-bundled script must point at a file that exists.
          const sm = (h.command || "").match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?\.(?:mjs|js|sh|cjs))/);
          if (sm) {
            if (existsSync(join(ROOT, sm[1]))) ok(`hook script ${sm[1]} exists`);
            else fail(`hook command references ${sm[1]} which does not exist (would dangle at install)`);
          }
        }
      }
    }
  }
}

// =============================================================================
section("5. No doc references a non-existent AGENT.md (regression guard for F8)");
// =============================================================================
// The evolution roadmap referenced `AGENT.md` (singular); the real file is AGENTS.md.
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}
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
section("6. Worked example: CLI evaluation oracle passes against its reference impl");
// =============================================================================
// Proves examples/todo-cli/ stays runnable: the Stage-G evaluation-contract prototype must
// report PASS against the correct reference solution (and, by construction, FAIL on a broken one).
import { spawnSync } from "node:child_process";
const oracle = join(ROOT, "examples/todo-cli/eval-cli-contract.mjs");
const refImpl = join(ROOT, "examples/todo-cli/reference/todo.js");
if (existsSync(oracle) && existsSync(refImpl)) {
  const r = spawnSync("node", [oracle, `node ${refImpl}`], { encoding: "utf8" });
  if (r.status === 0) ok("todo-cli oracle PASSes against reference impl");
  else fail(`todo-cli oracle did not pass against reference impl (exit ${r.status})\n${r.stdout || ""}${r.stderr || ""}`);

  // Negative control: a deliverable that does nothing must FAIL — proves the oracle discriminates
  // (a grader that always PASSes is worthless). `node -e ...` exits 0 with empty stdout, so E1's
  // "prints a friendly message" check must FAIL it.
  const neg = spawnSync("node", [oracle, `node -e ""`], { encoding: "utf8" });
  if (neg.status === 1) ok("todo-cli oracle FAILs a do-nothing impl (discriminates)");
  else fail(`todo-cli oracle did not FAIL a do-nothing impl (exit ${neg.status}) — grader may be a rubber stamp`);
} else {
  console.log("  (example oracle/reference not found — skipping)");
}

// The shared process oracle (Stage G) and its reference contract must be present & well-formed.
const sharedOracle = join(ROOT, "scripts/shapeup-sdlc/oracles/process-oracle.mjs");
const contract = join(ROOT, "examples/todo-cli/todo.contract.json");
if (existsSync(sharedOracle)) ok("shared process oracle present (scripts/shapeup-sdlc/oracles/process-oracle.mjs)");
else fail("shared process oracle missing: scripts/shapeup-sdlc/oracles/process-oracle.mjs");
if (existsSync(contract)) {
  try {
    const c = readJSON(contract);
    if (Array.isArray(c.criteria) && c.criteria.length > 0 && c.criteria.every((x) => x.id && x.probe && x.expect))
      ok(`todo.contract.json well-formed (${c.criteria.length} criteria)`);
    else fail("todo.contract.json criteria[] malformed (need id/probe/expect each)");
  } catch (e) { fail(`todo.contract.json does not parse: ${e.message}`); }
}

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
section("8. Evaluation-contract oracle registry (Stage G) is complete & consistent");
// =============================================================================
// The registry is the source of truth for "which oracles exist". Every oracle it names must
// have a runner file; every oracle the docs claim must be in the registry. Catches a doc/code
// drift in the eval-contract the same way #3 catches broken SKILL references.
const { ORACLES, ORACLE_NAMES } = await import(join(ROOT, "scripts/shapeup-sdlc/oracles/index.mjs"));
const EXPECTED_RUNNERS = {
  process: "scripts/shapeup-sdlc/oracles/process-oracle.mjs",
  test: "scripts/shapeup-sdlc/oracles/test-oracle.mjs",
  snapshot: "scripts/shapeup-sdlc/oracles/snapshot-oracle.mjs",
  http: "scripts/shapeup-sdlc/oracles/http-oracle.mjs",
};
for (const [name, rel] of Object.entries(EXPECTED_RUNNERS)) {
  if (!ORACLES[name]) fail(`oracle "${name}" not registered in scripts/shapeup-sdlc/oracles/index.mjs`);
  else if (!existsSync(join(ROOT, rel))) fail(`oracle "${name}" runner missing: ${rel}`);
  else ok(`oracle "${name}" registered with runner ${rel}`);
}
// The eval-contract spec table and the ba/test-surface registry must name exactly these oracles.
const specPath = join(ROOT, "docs/audit/evaluation-contract-spec.md");
if (existsSync(specPath)) {
  const spec = read(specPath);
  for (const name of ORACLE_NAMES) {
    if (spec.includes("`" + name + "`")) ok(`spec documents oracle "${name}"`);
    else fail(`evaluation-contract-spec.md does not document registered oracle "${name}"`);
  }
}

// =============================================================================
section("9. `test` oracle PASSes its green fixture and FAILs a red suite (discriminates)");
// =============================================================================
const testOraclePath = join(ROOT, "scripts/shapeup-sdlc/oracles/test-oracle.mjs");
const mathxContract = join(ROOT, "examples/lib-mathx/mathx.contract.json");
if (existsSync(testOraclePath) && existsSync(mathxContract)) {
  const pass = spawnSync("node", [testOraclePath, mathxContract], { encoding: "utf8", cwd: ROOT });
  if (pass.status === 0) ok("test oracle PASSes the green mathx suite");
  else fail(`test oracle did not PASS its green fixture (exit ${pass.status})\n${pass.stdout || ""}${pass.stderr || ""}`);

  // Negative control: a deliberately failing suite must FAIL (a grader that always passes is useless).
  const { runContract: runTest } = await import(testOraclePath);
  const red = runTest({ criteria: [{ id: "T1", desc: "red", probe: { cmd: "node --test --test-reporter=tap mathx.redtest.mjs", cwd: join(ROOT, "examples/lib-mathx") }, expect: { exit: "==0", min_tests: 1, no_failures: true } }] });
  if (red.fails === 1) ok("test oracle FAILs a red suite (discriminates)");
  else fail("test oracle did not FAIL a red suite — grader may be a rubber stamp");
} else {
  console.log("  (test oracle/fixture not found — skipping)");
}

// =============================================================================
section("10. `snapshot` oracle PASSes its golden and FAILs a do-nothing impl (discriminates)");
// =============================================================================
const snapOraclePath = join(ROOT, "scripts/shapeup-sdlc/oracles/snapshot-oracle.mjs");
const greetContract = join(ROOT, "examples/refactor-greet/greet.contract.json");
if (existsSync(snapOraclePath) && existsSync(greetContract)) {
  const pass = spawnSync("node", [snapOraclePath, greetContract, "node examples/refactor-greet/greet.mjs"], { encoding: "utf8", cwd: ROOT });
  if (pass.status === 0) ok("snapshot oracle PASSes output identical to its golden");
  else fail(`snapshot oracle did not PASS its golden (exit ${pass.status})\n${pass.stdout || ""}${pass.stderr || ""}`);

  // Negative control: a do-nothing impl emits nothing → diff non-empty → FAIL.
  const neg = spawnSync("node", [snapOraclePath, greetContract, "node -e undefined"], { encoding: "utf8", cwd: ROOT });
  if (neg.status === 1) ok("snapshot oracle FAILs a do-nothing impl (discriminates)");
  else fail(`snapshot oracle did not FAIL a do-nothing impl (exit ${neg.status}) — grader may be a rubber stamp`);
} else {
  console.log("  (snapshot oracle/fixture not found — skipping)");
}

// =============================================================================
section("11. `http` oracle PASSes its working server and FAILs a broken one (discriminates)");
// =============================================================================
const httpOraclePath = join(ROOT, "scripts/shapeup-sdlc/oracles/http-oracle.mjs");
const pingContract = join(ROOT, "examples/http-ping/ping.contract.json");
if (existsSync(httpOraclePath) && existsSync(pingContract)) {
  const { runContract: runHttp } = await import(httpOraclePath);
  const c = readJSON(pingContract);
  const good = await runHttp({ server: { ...c.server, cwd: ROOT }, criteria: c.criteria });
  if (good.fails === 0) ok(`http oracle PASSes the working server (${good.results.length} criteria)`);
  else fail(`http oracle did not PASS the working server (${good.fails} fail)\n${good.results.map((r) => r.evidence).join("\n")}`);

  // Negative control: a server that is reachable but returns 500/wrong body must FAIL every criterion.
  const bad = await runHttp({ server: { ...c.server, cmd: "node examples/http-ping/broken-server.mjs", cwd: ROOT }, criteria: c.criteria });
  if (bad.fails === bad.results.length && bad.results.length > 0) ok("http oracle FAILs a broken server (discriminates)");
  else fail(`http oracle did not FAIL a broken server (${bad.fails}/${bad.results.length}) — grader may be a rubber stamp`);
} else {
  console.log("  (http oracle/fixture not found — skipping)");
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
// Runtime project paths the harness itself creates (`docs/shapeup-sdlc/`, `.shapeup-sdlc/`)
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
      if (/docs\/shapeup-sdlc|\.shapeup-sdlc/.test(line)) return false;
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
section("13. `spec-evaluator` planted-bug fixture is well-formed and discriminates (anti-leniency)");
// =============================================================================
// The judge-first Tier-2 fixture (audit Stage C2). We cannot run the LLM judge in CI, but we CAN
// assert its GROUND TRUTH deterministically: the planted bug is real and catchable by the
// evaluation contract. The process oracle must PASS the correct control build and FAIL the buggy
// one (on TS-04). If it stops discriminating, the anti-leniency eval is testing nothing.
const pbDir = join(ROOT, "examples/eval-planted-bug");
const pbContract = join(pbDir, "fizzbuzz.contract.json");
if (existsSync(pbContract)) {
  const goodPB = spawnSync("node", [sharedOracle, pbContract, "node examples/eval-planted-bug/build-correct/fizzbuzz.mjs"], { encoding: "utf8", cwd: ROOT });
  if (goodPB.status === 0) ok("planted-bug oracle PASSes the correct control build");
  else fail(`planted-bug oracle did not PASS the correct build (exit ${goodPB.status})\n${goodPB.stdout || ""}${goodPB.stderr || ""}`);

  const buggyPB = spawnSync("node", [sharedOracle, pbContract, "node examples/eval-planted-bug/build-buggy/fizzbuzz.mjs"], { encoding: "utf8", cwd: ROOT });
  if (buggyPB.status === 1 && /FAIL\s+TS-04/.test(buggyPB.stdout || "")) ok("planted-bug oracle FAILs the buggy build on TS-04 (discriminates)");
  else fail(`planted-bug oracle did not FAIL the buggy build on TS-04 (exit ${buggyPB.status}) — bug not catchable, fixture is inert\n${buggyPB.stdout || ""}`);

  // Fixture completeness: the materials a Tier-2 run + its gold key depend on must all be present.
  for (const rel of ["spec/usecases/UC-01-fizzbuzz.md", "spec/tasks/TASK-001.md", "spec/scope-summary.md",
                     "build-buggy/fizzbuzz.mjs", "build-correct/fizzbuzz.mjs",
                     "PLANTED-BUG.md", "EXPECTED-VERDICT.md", "README.md"]) {
    if (existsSync(join(pbDir, rel))) ok(`planted-bug fixture has ${rel}`);
    else fail(`planted-bug fixture missing ${rel}`);
  }

  // evals.json must parse and declare the FAIL verdict the skill is graded against.
  const evalsPath = join(pbDir, "evals.json");
  if (existsSync(evalsPath)) {
    try {
      const e = readJSON(evalsPath);
      const buggy = (e.cases || []).find((c) => c.id === "planted-bug-buggy");
      if (buggy && buggy.expected_verdict === "FAIL" && buggy.expected_failing_criterion === "AC4")
        ok("evals.json declares the buggy case → FAIL on AC4");
      else fail("evals.json missing a planted-bug-buggy case with expected_verdict FAIL on AC4");
    } catch (err) { fail(`evals.json does not parse: ${err.message}`); }
  } else fail("planted-bug fixture missing evals.json");

  // The trap precondition: AC4's box must be TICKED in the task file (the build claims done).
  // If it were already unchecked, the fixture wouldn't test leniency — there'd be nothing to revoke.
  const taskBody = read(join(pbDir, "spec/tasks/TASK-001.md"));
  if (/- \[x\] AC4/.test(taskBody)) ok("planted-bug task ships AC4 ticked (the leniency trap is armed)");
  else fail("planted-bug task does not ship AC4 ticked — the anti-leniency trap is not armed");
} else {
  console.log("  (planted-bug fixture not found — skipping)");
}

// =============================================================================
section("14. GATE L2 PreToolUse hook denies a red board and allows a green one (Stage E1)");
// =============================================================================
// The one gate the runtime actually enforces (audit E1 / F2). We feed the hook crafted PreToolUse
// payloads against temp board fixtures and assert its decisions: deny the once-per-round EVAL on a
// partial board, allow it on a green one, and never gate per-task evals / other skills / boardless
// runs (fail-open so it can't break legitimate flows).
const gatePath = join(ROOT, "hooks/gate-l2.mjs");
if (existsSync(gatePath)) {
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  // Build a board fixture; `done` flips TASK-002 between done and in-progress.
  const makeSpec = (secondDone) => {
    const dir = mkdtempSync(join(tmpdir(), "gate-l2-"));
    const tasks = join(dir, "spec", "tasks");
    mkdirSync(tasks, { recursive: true });
    const mark = secondDone ? "✅ done" : "🔄 in-progress";
    writeFileSync(join(tasks, "_index.md"),
      `---\ntype: task-board\n---\n| ID | Title | Status |\n|---|---|---|\n| TASK-001 | A | ✅ done |\n| TASK-002 | B | ${mark} |\n`);
    writeFileSync(join(tasks, "TASK-001-a.md"), `---\nid: TASK-001\nstatus: done\n---\n`);
    writeFileSync(join(tasks, "TASK-002-b.md"), `---\nid: TASK-002\nstatus: ${secondDone ? "done" : "in-progress"}\n---\n`);
    return dir;
  };
  const ask = (cwd, skillArgs, skillName = "spec-evaluator", toolName = "Skill") => {
    const payload = JSON.stringify({ tool_name: toolName, cwd, tool_input: { skill_name: skillName, skill_args: skillArgs } });
    const r = spawnSync("node", [gatePath], { encoding: "utf8", input: payload });
    const denied = (r.stdout || "").includes('"permissionDecision":"deny"');
    return { denied, out: r.stdout || "" };
  };
  // v0.4.0 Local Tasks Architecture fixture: committed spec dir is boardless; the board lives
  // under the LOCAL gitignored root .shapeup-sdlc/<slug>/tasks/. `withBoard: false` models a
  // teammate's machine that pulled the spec but never generated a local board (must fail-open —
  // spec-evaluator v0.9 grades from the committed spec there).
  const makeLocalSpec = (secondDone, withBoard = true) => {
    const dir = mkdtempSync(join(tmpdir(), "gate-l2-local-"));
    mkdirSync(join(dir, "docs", "shapeup-sdlc", "demo", "spec", "usecases"), { recursive: true });
    if (withBoard) {
      const tasks = join(dir, ".shapeup-sdlc", "demo", "tasks");
      mkdirSync(tasks, { recursive: true });
      const mark = secondDone ? "✅ done" : "🔄 in-progress";
      writeFileSync(join(tasks, "_index.md"),
        `---\ntype: task-board\n---\n| ID | Title | Status |\n|---|---|---|\n| TASK-001 | A | ✅ done |\n| TASK-002 | B | ${mark} |\n`);
      writeFileSync(join(tasks, "TASK-001-a.md"), `---\nid: TASK-001\nstatus: done\n---\n`);
      writeFileSync(join(tasks, "TASK-002-b.md"), `---\nid: TASK-002\nstatus: ${secondDone ? "done" : "in-progress"}\n---\n`);
    }
    return dir;
  };
  const green = makeSpec(true), red = makeSpec(false);
  const lGreen = makeLocalSpec(true), lRed = makeLocalSpec(false), lBoardless = makeLocalSpec(true, false);
  try {
    // 1. Red board + round mode → DENY, naming the unfinished task.
    const a = ask(red, "--spec spec --feature demo --single-pass");
    if (a.denied && a.out.includes("TASK-002")) ok("gate DENIES round EVAL on a partial board (names TASK-002)");
    else fail(`gate did not deny a red-board round EVAL — the gate is not enforcing\n${a.out}`);

    // 2. Green board + round mode → ALLOW (defer, no deny).
    const b = ask(green, "--spec spec --feature demo --single-pass");
    if (!b.denied) ok("gate ALLOWS round EVAL on a fully-green board");
    else fail(`gate denied a green board — false block\n${b.out}`);

    // 3. Red board but per-task eval (--task) → defer (not gated).
    const c = ask(red, "--spec spec --task TASK-001");
    if (!c.denied) ok("gate does NOT gate a per-task eval (--task)");
    else fail("gate wrongly blocked a per-task eval — board-green rule must be round-only");

    // 4. Other skill → defer.
    const d = ask(red, "--spec spec --single-pass", "task-executor");
    if (!d.denied) ok("gate ignores non-spec-evaluator skills");
    else fail("gate blocked a non-spec-evaluator skill");

    // 5. Non-Skill tool → defer.
    const e = ask(red, "--spec spec --single-pass", "spec-evaluator", "Bash");
    if (!e.denied) ok("gate ignores non-Skill tool calls");
    else fail("gate blocked a non-Skill tool call");

    // 6. v0.4.0 layout, red LOCAL board → DENY. This is the island-escape regression: the board
    //    is not in <spec>/tasks/, and a hook that only looks there fail-opens on a stale board.
    const f = ask(lRed, "--spec docs/shapeup-sdlc/demo/spec --feature demo --single-pass");
    if (f.denied && f.out.includes("TASK-002")) ok("gate DENIES a red LOCAL board (.shapeup-sdlc/<slug>/tasks/, v0.4.0 layout)");
    else fail(`gate fail-opened on a red LOCAL board — v0.4.0 island-escape hole is back\n${f.out}`);

    // 7. v0.4.0 layout, green LOCAL board → ALLOW.
    const g = ask(lGreen, "--spec docs/shapeup-sdlc/demo/spec --feature demo --single-pass");
    if (!g.denied) ok("gate ALLOWS a green LOCAL board");
    else fail(`gate denied a green LOCAL board — false block\n${g.out}`);

    // 8. No --feature → slug derived from the spec path convention (docs/shapeup-sdlc/<slug>/spec).
    const h = ask(lRed, "--spec docs/shapeup-sdlc/demo/spec --single-pass");
    if (h.denied && h.out.includes("TASK-002")) ok("gate derives <slug> from the spec path when --feature is absent");
    else fail(`gate did not find the LOCAL board without --feature — slug derivation broken\n${h.out}`);

    // 9. Committed spec present but NO local board anywhere → defer (fail-open). A grading
    //    machine that never generated a board is legitimate (spec-evaluator v0.9).
    const i = ask(lBoardless, "--spec docs/shapeup-sdlc/demo/spec --feature demo --single-pass");
    if (!i.denied) ok("gate fail-opens when no board exists on this machine (boardless grading is legitimate)");
    else fail("gate blocked a boardless machine — breaks v0.4.0 remote-grading flow");

    // 10. Pure-skill envelope shape (v1.0): the round EVAL now dispatches as
    //     `spec-evaluator --order <WorkOrder operation:evaluate>` — the gate must read the
    //     order and deny on a red board just like the legacy flag shape, and stay quiet for
    //     a non-evaluate order (some other worker's dispatch).
    const mkOrder = (dir, operation, worker = "spec-evaluator") => {
      const op = join(dir, ".shapeup-sdlc", "demo", "orders");
      mkdirSync(op, { recursive: true });
      const pth = join(op, `${operation}-r1.json`);
      writeFileSync(pth, JSON.stringify({
        schema_version: 1, order_id: `demo/${operation}-r1`, worker, mode: "orchestrated",
        operation, payload: { feature: "demo", spec_folder: "docs/shapeup-sdlc/demo/spec" },
      }));
      return pth;
    };
    const jr = ask(lRed, `--order ${mkOrder(lRed, "evaluate")}`);
    if (jr.denied && jr.out.includes("TASK-002")) ok("gate DENIES an --order round EVAL on a red board (envelope shape gated)");
    else fail(`gate fail-opened on an --order eval dispatch — the pure-skill port bypasses GATE L2\n${jr.out}`);
    const jg = ask(lGreen, `--order ${mkOrder(lGreen, "evaluate")}`);
    if (!jg.denied) ok("gate ALLOWS an --order round EVAL on a green board");
    else fail(`gate denied a green-board --order eval — false block\n${jg.out}`);
  } finally {
    rmSync(green, { recursive: true, force: true });
    rmSync(red, { recursive: true, force: true });
    rmSync(lGreen, { recursive: true, force: true });
    rmSync(lRed, { recursive: true, force: true });
    rmSync(lBoardless, { recursive: true, force: true });
  }
} else {
  console.log("  (gate-l2 hook not found — skipping)");
}

// =============================================================================
section("15. Verdict-ledger grammar flags flips and forces low confidence (Stage D1)");
// =============================================================================
// The judge-calibration reference impl (audit D1 / F3). Proves the documented flip/confidence
// grammar discriminates an unstable judge (verdict changed across runs) from a stable one — and
// that a flip FORCES confidence low regardless of what the judge proposed. The skill performs this
// procedure itself (verdict-ledger.md, no script dep); this is the executable proof, like the oracles.
const vlPath = join(ROOT, "scripts/shapeup-sdlc/verdict-ledger.mjs");
if (existsSync(vlPath)) {
  const { reconcile, detectFlips, stability, parseLedger } = await import(vlPath);

  // reconcile: AC4 PASS(run1) → FAIL(run2) is a flip → confidence forced low; AC1 PASS→PASS stable.
  const prior = [
    { run: 1, dimension: "spec-conformance", criterion: "AC1", verdict: "PASS", confidence: "high" },
    { run: 1, dimension: "spec-conformance", criterion: "AC4", verdict: "PASS", confidence: "high" },
  ];
  const current = [
    { run: 2, dimension: "spec-conformance", criterion: "AC1", verdict: "PASS", confidence: "medium" },
    { run: 2, dimension: "spec-conformance", criterion: "AC4", verdict: "FAIL", confidence: "high" },
  ];
  const { records, summary } = reconcile(prior, current);
  const ac4 = records.find((r) => r.criterion === "AC4");
  const ac1 = records.find((r) => r.criterion === "AC1");
  if (ac4.flip && ac4.confidence === "low") ok("reconcile flags a PASS→FAIL flip and forces confidence low");
  else fail(`reconcile did not flag/downgrade the AC4 flip (flip=${ac4.flip}, confidence=${ac4.confidence})`);
  if (!ac1.flip && ac1.confidence === "medium") ok("reconcile leaves a stable criterion untouched");
  else fail(`reconcile wrongly altered the stable AC1 (flip=${ac1.flip}, confidence=${ac1.confidence})`);
  if (summary.flipped === 1 && summary.stable === 1) ok("reconcile summary counts 1 flipped / 1 stable");
  else fail(`reconcile summary wrong: ${JSON.stringify(summary)}`);

  // detectFlips over a full ledger: only AC4 flipped.
  const ledger = [...prior, ...current];
  const flips = detectFlips(ledger);
  if (flips.length === 1 && flips[0].criterion === "AC4" && flips[0].from === "PASS" && flips[0].to === "FAIL")
    ok("detectFlips finds the AC4 PASS→FAIL transition and nothing else");
  else fail(`detectFlips wrong: ${JSON.stringify(flips)}`);

  // stability: 1 of 2 latest-run criteria stable.
  const s = stability(ledger);
  if (s.stable === 1 && s.total === 2) ok("stability reports 1/2 stable for the latest run");
  else fail(`stability wrong: ${JSON.stringify(s)}`);

  // Negative control: a fully-stable ledger has no flips and stability 1.0.
  const stable = [
    { run: 1, dimension: "d", criterion: "X", verdict: "PASS" },
    { run: 2, dimension: "d", criterion: "X", verdict: "PASS" },
  ];
  if (detectFlips(stable).length === 0 && stability(stable).ratio === 1) ok("a stable ledger yields no flips (discriminates)");
  else fail("verdict-ledger reported a flip on a stable ledger — grammar is not discriminating");

  // CLI: exit 1 on a flip, exit 0 on a clean ledger.
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const d = mkdtempSync(join(tmpdir(), "vl-"));
  try {
    const flipFile = join(d, ".verdicts-TASK-001.jsonl");
    writeFileSync(flipFile, ledger.map((l) => JSON.stringify(l)).join("\n"));
    const rf = spawnSync("node", [vlPath, flipFile], { encoding: "utf8" });
    if (rf.status === 1 && /flip/i.test(rf.stdout)) ok("verdict-ledger CLI exits 1 and reports the flip");
    else fail(`verdict-ledger CLI did not flag the flip (exit ${rf.status})\n${rf.stdout}`);

    const okFile = join(d, ".verdicts-TASK-002.jsonl");
    writeFileSync(okFile, stable.map((l) => JSON.stringify(l)).join("\n"));
    const rs = spawnSync("node", [vlPath, okFile], { encoding: "utf8" });
    if (rs.status === 0 && /no verdict flips/i.test(rs.stdout)) ok("verdict-ledger CLI exits 0 on a stable ledger");
    else fail(`verdict-ledger CLI mis-graded a stable ledger (exit ${rs.status})\n${rs.stdout}`);
    parseLedger(""); // smoke: empty parse must not throw
  } finally { rmSync(d, { recursive: true, force: true }); }
} else {
  console.log("  (verdict-ledger reference impl not found — skipping)");
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
  fail("evals/baselines/trigger-evals.baseline.json missing — run `node scripts/shapeup-sdlc/trigger-eval.mjs`");
}
if (existsSync(join(ROOT, "scripts/shapeup-sdlc/trigger-eval.mjs"))) ok("trigger-eval harness present");
else fail("scripts/shapeup-sdlc/trigger-eval.mjs missing");

// =============================================================================
section("17. Sandbox guard (PA3) denies an out-of-substrate write and allows an in-substrate one");
// =============================================================================
// The v0.3.0 write-whitelist hook (design spec §4.5/Blueprint E). Same fixture style as #14:
// craft PreToolUse payloads against a temp checkout with a scope contract + active-scope
// pointer, and assert the hook's allow/deny decisions.
const sandboxGuardPath = join(ROOT, "hooks/sandbox-guard.mjs");
if (existsSync(sandboxGuardPath)) {
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const makeCheckout = (withScope) => {
    const dir = mkdtempSync(join(tmpdir(), "sandbox-guard-"));
    if (withScope) {
      mkdirSync(join(dir, ".shapeup-sdlc"), { recursive: true });
      writeFileSync(join(dir, ".shapeup-sdlc", "active-scope"), JSON.stringify({ slug: "demo", scope_id: "cart-creation" }));
      const scopesDir = join(dir, "docs", "shapeup-sdlc", "demo", "scopes");
      mkdirSync(scopesDir, { recursive: true });
      writeFileSync(join(scopesDir, "cart-creation.json"), JSON.stringify({
        scope_id: "cart-creation",
        allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"],
        shared_substrate: ["packages/shared/http.ts"],
      }));
    }
    return dir;
  };
  const ask = (cwd, filePath, toolName = "Edit") => {
    const payload = JSON.stringify({ tool_name: toolName, cwd, tool_input: { file_path: filePath } });
    const r = spawnSync("node", [sandboxGuardPath], { encoding: "utf8", input: payload });
    const denied = (r.stdout || "").includes('"permissionDecision":"deny"');
    return { denied, out: r.stdout || "" };
  };
  const scoped = makeCheckout(true), unscoped = makeCheckout(false);
  try {
    // 1. In-substrate write → allow (defer).
    const a = ask(scoped, join(scoped, "apps/web/cart/Cart.tsx"));
    if (!a.denied) ok("sandbox guard ALLOWS a write inside the scope's substrate");
    else fail(`sandbox guard wrongly denied an in-substrate write\n${a.out}`);

    // 2. Declared shared_substrate write → allow.
    const b = ask(scoped, join(scoped, "packages/shared/http.ts"));
    if (!b.denied) ok("sandbox guard ALLOWS a write to declared shared_substrate");
    else fail(`sandbox guard wrongly denied a shared_substrate write\n${b.out}`);

    // 3. Out-of-substrate write → deny, naming the offending path.
    const c = ask(scoped, join(scoped, "apps/api/payments/handler.ts"));
    if (c.denied && c.out.includes("apps/api/payments/handler.ts")) ok("sandbox guard DENIES an out-of-substrate write (names the path)");
    else fail(`sandbox guard did not deny an out-of-substrate write — the guard is not enforcing\n${c.out}`);

    // 4. Pathology telemetry: the deny above must have appended a PA3 event to metrics/.
    const metricsDir = join(scoped, "docs", "shapeup-sdlc", "metrics");
    const shard = existsSync(metricsDir) ? readdirSync(metricsDir).find((f) => f.endsWith(".jsonl")) : null;
    if (shard && read(join(metricsDir, shard)).includes('"PA3"')) ok("sandbox guard logs a PA3 pathology event to metrics/*.jsonl on deny");
    else fail("sandbox guard did not log a PA3 pathology event on deny");

    // 5. Run-trace carve-out: the doer MUST be able to write the active feature's LOCAL root —
    //    task board status/AC ticks (task-executor P3) and the discovery ledger (P3.7). Blocking
    //    these strands the board (island-escape: 16/20 task files stale on a shipped feature).
    const rt1 = ask(scoped, join(scoped, ".shapeup-sdlc/demo/tasks/TASK-001-a.md"));
    if (!rt1.denied) ok("sandbox guard ALLOWS a task-board write under the active run-trace root");
    else fail(`sandbox guard denied the doer's own board bookkeeping (P3 doc update would strand)\n${rt1.out}`);
    const rt2 = ask(scoped, join(scoped, ".shapeup-sdlc/demo/discovery/ledger.md"));
    if (!rt2.denied) ok("sandbox guard ALLOWS a discovery-ledger write under the active run-trace root");
    else fail(`sandbox guard denied the P3.7 discovery-ledger write\n${rt2.out}`);

    // 6. The guard's own pointer is NOT carved out — a worker must never rewrite its sandbox.
    const rt3 = ask(scoped, join(scoped, ".shapeup-sdlc/active-scope"));
    if (rt3.denied) ok("sandbox guard still DENIES writing .shapeup-sdlc/active-scope (pointer stays guard-only)");
    else fail("sandbox guard allowed a write to .shapeup-sdlc/active-scope — a worker could widen its own sandbox");

    // 7. Another feature's run-trace root is NOT carved out (carve-out is active-slug only).
    const rt4 = ask(scoped, join(scoped, ".shapeup-sdlc/other-feature/tasks/_index.md"));
    if (rt4.denied) ok("sandbox guard still DENIES a different feature's run-trace root");
    else fail("sandbox guard allowed a write to another feature's run-trace — carve-out too wide");

    // 8. No active-scope pointer (no harness round in progress) → defer, never break a plain edit.
    const d = ask(unscoped, join(unscoped, "anything.ts"));
    if (!d.denied) ok("sandbox guard defers (fail-open) when no active-scope pointer exists");
    else fail("sandbox guard wrongly denied a write with no harness round in progress");

    // 9. Non Edit/Write/MultiEdit tool → defer.
    const e = ask(scoped, join(scoped, "apps/api/payments/handler.ts"), "Bash");
    if (!e.denied) ok("sandbox guard ignores non-Edit/Write/MultiEdit tool calls");
    else fail("sandbox guard wrongly gated a non-write tool call");
  } finally {
    rmSync(scoped, { recursive: true, force: true });
    rmSync(unscoped, { recursive: true, force: true });
  }

  // Unit-level glob matcher check (no process spawn needed).
  const { globToRegExp, matchesAny } = await import(sandboxGuardPath);
  if (globToRegExp("apps/web/cart/*.tsx").test("apps/web/cart/Cart.tsx")) ok("globToRegExp matches a single-star glob");
  else fail("globToRegExp failed to match a single-star glob");
  if (!globToRegExp("apps/web/cart/*.tsx").test("apps/web/cart/sub/Cart.tsx")) ok("globToRegExp single-star does not cross a path segment");
  else fail("globToRegExp single-star wrongly crossed a path segment");
  if (matchesAny("apps/api/cart/route.ts", ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"])) ok("matchesAny finds a match across multiple globs");
  else fail("matchesAny failed to find a match across multiple globs");
} else {
  console.log("  (sandbox-guard.mjs not found — skipping)");
}

// =============================================================================
section("18. T0 mechanical layer (t0-verify.mjs) computes a discriminating verdict + writes a citable artifact");
// =============================================================================
const t0Path = join(ROOT, "skills/tech-lead/scripts/t0-verify.mjs");
if (existsSync(t0Path)) {
  const { runFixtures, runDbProbe, seesawCheck, computeVerdict, writeArtifact } = await import(t0Path);

  const green = runFixtures(["node -e \"process.exit(0)\""], ROOT);
  if (green.pass) ok("t0-verify runFixtures reports green for a passing fixture command");
  else fail("t0-verify runFixtures did not report green for an exit-0 command");

  const red = runFixtures(["node -e \"process.exit(1)\""], ROOT);
  if (!red.pass) ok("t0-verify runFixtures reports red for a failing fixture command (discriminates)");
  else fail("t0-verify runFixtures did not report red for an exit-1 command — grader may be a rubber stamp");

  if (runDbProbe(null, ROOT) === null) ok("t0-verify runDbProbe is a no-op (null) when no db_probe is declared — never a false failure");
  else fail("t0-verify runDbProbe should return null when no db_probe command is given");

  const verdictGreen = computeVerdict({ fixtures: green, dbProbe: null, seesaw: { ran: false, pass: true } });
  if (verdictGreen.overall === "green" && !verdictGreen.regression) ok("t0-verify computeVerdict is green + non-regression when fixtures pass and seesaw didn't run");
  else fail(`t0-verify computeVerdict wrong on an all-green input: ${JSON.stringify(verdictGreen)}`);

  const verdictRegression = computeVerdict({ fixtures: green, dbProbe: null, seesaw: { ran: true, pass: false } });
  if (verdictRegression.overall === "red" && verdictRegression.regression) ok("t0-verify computeVerdict flags a seesaw failure as a regression (own fixtures green, seesaw red)");
  else fail(`t0-verify computeVerdict did not flag the seesaw-red case as a regression: ${JSON.stringify(verdictRegression)}`);

  const verdictOwnFail = computeVerdict({ fixtures: red, dbProbe: null, seesaw: { ran: false, pass: true } });
  if (verdictOwnFail.overall === "red" && !verdictOwnFail.regression) ok("t0-verify computeVerdict distinguishes an own-fixture failure from a regression");
  else fail(`t0-verify computeVerdict wrongly classified an own-fixture failure: ${JSON.stringify(verdictOwnFail)}`);

  // Artifact write + citation hash — what spec-evaluator's GATE V0.7 will read and re-verify.
  const { mkdtempSync, rmSync, readFileSync: rf, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const outDir = mkdtempSync(join(tmpdir(), "t0-artifact-"));
  try {
    const { path, sha256 } = writeArtifact(outDir, 2, 3, { scope_id: "cart-creation", ...verdictGreen });
    if (existsSync(path) && /r2-a3\.json$/.test(path)) ok("t0-verify writeArtifact writes to the r<N>-a<M>.json path convention");
    else fail(`t0-verify writeArtifact wrote to an unexpected path: ${path}`);
    const body = JSON.parse(rf(path, "utf8"));
    if (body.round === 2 && body.attempt === 3 && body.overall === "green") ok("t0-verify artifact body carries round/attempt/overall");
    else fail(`t0-verify artifact body malformed: ${JSON.stringify(body)}`);
    const { createHash } = await import("node:crypto");
    const recomputed = createHash("sha256").update(rf(path, "utf8")).digest("hex");
    if (recomputed === sha256) ok("t0-verify artifact sha256 citation is reproducible from the file on disk");
    else fail("t0-verify artifact sha256 does not match the file's actual contents — citation would be unverifiable");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }

  // Seesaw over a registry with one always-failing scope.
  const regDir = mkdtempSync(join(tmpdir(), "t0-seesaw-"));
  try {
    const regPath = join(regDir, "registry.json");
    writeFileSync(regPath, JSON.stringify({ scopes: [{ scope_id: "checkout", fixtures: ["node -e \"process.exit(1)\""] }] }));
    const s = seesawCheck(regPath, ROOT);
    if (s.ran && !s.pass && s.failing.includes("checkout")) ok("t0-verify seesawCheck detects a regressed FINISHED scope");
    else fail(`t0-verify seesawCheck did not detect the seeded regression: ${JSON.stringify(s)}`);
    const none = seesawCheck(join(regDir, "does-not-exist.json"), ROOT);
    if (none.ran === false && none.pass === true) ok("t0-verify seesawCheck is a no-op-green when the registry doesn't exist yet (first FINISHED scope)");
    else fail("t0-verify seesawCheck should default to ran:false, pass:true with no registry");
  } finally {
    rmSync(regDir, { recursive: true, force: true });
  }
} else {
  console.log("  (t0-verify.mjs not found — skipping)");
}

// =============================================================================
section("19. AEGIS digester distills raw logs into {file, line, core_message} triples");
// =============================================================================
const digestPath = join(ROOT, "skills/tech-lead/scripts/aegis-digest.mjs");
if (existsSync(digestPath)) {
  const { digest } = await import(digestPath);

  const stackLog = "TypeError: Cannot read properties of undefined (reading 'total')\n    at calculateCartTotal (apps/web/cart/Cart.tsx:84:12)\n    at process (apps/web/cart/Cart.tsx:40:5)\n";
  const triples = digest(stackLog);
  const first = triples.find((t) => t.file === "apps/web/cart/Cart.tsx" && t.line === 84);
  if (first && /Cannot read properties/.test(first.core_message)) ok("aegis-digest extracts {file, line, core_message} from a Node stack trace");
  else fail(`aegis-digest did not extract the expected triple from a stack trace: ${JSON.stringify(triples)}`);

  const dupLog = stackLog + stackLog; // identical failure logged twice (retry noise)
  const deduped = digest(dupLog);
  const count = deduped.filter((t) => t.file === "apps/web/cart/Cart.tsx" && t.line === 84).length;
  if (count === 1) ok("aegis-digest de-duplicates identical (file, line, message) triples");
  else fail(`aegis-digest did not de-duplicate a repeated triple (found ${count})`);

  const unmatched = digest("some unrelated line of prose with no file:line signal\n");
  if (Array.isArray(unmatched)) ok("aegis-digest never throws on unrecognized log content (script-first, no invented file:line)");
  else fail("aegis-digest should return an array even when nothing matches");

  const empty = digest("");
  if (Array.isArray(empty) && empty.length === 0) ok("aegis-digest returns an empty array for empty input");
  else fail("aegis-digest should return [] for empty input");
} else {
  console.log("  (aegis-digest.mjs not found — skipping)");
}

// =============================================================================
section("20. Envelope schemas + validate-envelope.mjs discriminate (pure-skill P0)");
// =============================================================================
// The WorkOrder/WorkResult port is the harness's canonical contract (plan §4.1). The validator
// must PASS a well-formed order, FAIL a malformed one, and as a PreToolUse hook DENY a dispatch
// whose --order file is invalid while deferring on everything else (fail-open for standalone).
const vePath = join(ROOT, "skills/tech-lead/scripts/validate-envelope.mjs");
const orderSchemaPath = join(ROOT, "skills/tech-lead/schemas/work-order.schema.json");
const resultSchemaPath = join(ROOT, "skills/tech-lead/schemas/work-result.schema.json");
if (existsSync(vePath) && existsSync(orderSchemaPath)) {
  const { validate: veValidate } = await import(vePath);
  const orderSchema = readJSON(orderSchemaPath);
  const resultSchema = readJSON(resultSchemaPath);
  const goodOrder = {
    schema_version: 1, order_id: "demo/r1-a1", worker: "task-executor", mode: "orchestrated",
    operation: "execute", substrate: { allowed: ["apps/api/**"] },
    payload: { tasks: [{ id: "TASK-001", acceptance_criteria: ["x"] }] },
  };
  if (veValidate(goodOrder, orderSchema).valid) ok("validate-envelope PASSes a well-formed WorkOrder");
  else fail(`validate-envelope rejected a well-formed WorkOrder: ${veValidate(goodOrder, orderSchema).errors}`);
  const badOrder = { schema_version: 2, order_id: "Bad Slug", worker: "nobody", mode: "yolo" };
  const badRes = veValidate(badOrder, orderSchema);
  if (!badRes.valid && badRes.errors.length >= 4) ok("validate-envelope FAILs a malformed WorkOrder with per-field errors (discriminates)");
  else fail(`validate-envelope did not discriminate a malformed order: ${JSON.stringify(badRes)}`);
  const goodResult = {
    schema_version: 1, order_id: "demo/r1-a1", status: "done",
    task_results: [{ task_id: "TASK-001", status: "done", ac_results: [{ ac: "x", result: "pass" }] }],
  };
  if (veValidate(goodResult, resultSchema).valid) ok("validate-envelope PASSes a well-formed WorkResult");
  else fail("validate-envelope rejected a well-formed WorkResult");
  if (!veValidate({ schema_version: 1, order_id: "d/x", status: "nope" }, resultSchema).valid)
    ok("validate-envelope FAILs an invalid WorkResult status");
  else fail("validate-envelope accepted an invalid WorkResult status — rubber stamp");

  // Hook mode.
  {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const d = mkdtempSync(join(tmpdir(), "ve-hook-"));
    try {
      writeFileSync(join(d, "bad.json"), JSON.stringify(badOrder));
      writeFileSync(join(d, "good.json"), JSON.stringify(goodOrder));
      const askVe = (prompt, tool = "Agent") => {
        const r = spawnSync("node", [vePath], { encoding: "utf8", input: JSON.stringify({ tool_name: tool, cwd: d, tool_input: { prompt } }) });
        return (r.stdout || "").includes('"permissionDecision":"deny"');
      };
      if (askVe("run task-executor --order bad.json")) ok("hook DENIES a dispatch whose --order fails the schema");
      else fail("hook did not deny a malformed --order dispatch — the envelope gate is not enforcing");
      if (askVe("run task-executor --order missing.json")) ok("hook DENIES a dispatch whose --order file is missing");
      else fail("hook did not deny a dangling --order path");
      if (!askVe("run task-executor --order good.json")) ok("hook ALLOWS a valid --order dispatch");
      else fail("hook denied a valid order — false block");
      if (!askVe("just run the tests")) ok("hook defers when no --order is present (standalone stays free)");
      else fail("hook blocked a dispatch with no --order — fail-open broken");
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
  // hooks.json must wire the envelope gate.
  const hooksManifest2 = readJSON(join(ROOT, "hooks/hooks.json"));
  const wired = JSON.stringify(hooksManifest2).includes("validate-envelope.mjs");
  if (wired) ok("hooks.json wires validate-envelope.mjs as a PreToolUse hook");
  else fail("hooks.json does not wire validate-envelope.mjs — malformed orders would reach workers");
} else {
  fail("validate-envelope.mjs or schemas/ missing — the P0 envelope layer is absent");
}

// =============================================================================
section("21. compile-order.mjs assembles a schema-valid, fact-only WorkOrder (pure-skill P1)");
// =============================================================================
const coPath = join(ROOT, "skills/tech-lead/scripts/compile-order.mjs");
const irPath = join(ROOT, "skills/tech-lead/scripts/ingest-result.mjs");
if (existsSync(coPath) && existsSync(irPath)) {
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const d = mkdtempSync(join(tmpdir(), "pipe-"));
  const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
  try {
    w(".shapeup-sdlc/demo/tasks/TASK-001-a.md", `---\nid: TASK-001\ntitle: "A"\nstatus: ready\npriority: 1\ndepends_on: []\n---\n## Acceptance Criteria\n- [ ] first criterion\n- [ ] second criterion\n`);
    w(".shapeup-sdlc/demo/tasks/TASK-002-b.md", `---\nid: TASK-002\ntitle: "B"\nstatus: blocked\npriority: 2\ndepends_on: [TASK-001]\n---\n## Acceptance Criteria\n- [ ] third criterion\n`);
    w(".shapeup-sdlc/demo/tasks/_index.md", `| ID | Title | Status |\n|---|---|---|\n| TASK-001 | A | ⬜ ready |\n| TASK-002 | B | 🚫 blocked |\n`);
    w("docs/shapeup-sdlc/demo/scopes/cart.json", JSON.stringify({ scope_id: "cart", topology_type: "LAYER_CAKE", allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"], shared_substrate: [] }));
    w("docs/shapeup-sdlc/demo/round-ledger.md", `## Decisions\n| ID | Scope | Q | A |\n|---|---|---|---|\n| ESC-1 | cart | q | use idempotency key |\n| ESC-2 | other | q | not mine |\n`);
    w(".shapeup-sdlc/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "red", discovered_tasks: [{ file: "apps/api/cart/x.ts", line: 4, core_message: "boom" }] }));

    const r = spawnSync("node", [coPath, "--scope", "docs/shapeup-sdlc/demo/scopes/cart.json", "--round", "1", "--attempt", "2", "--cwd", d], { encoding: "utf8" });
    const orderPath = (r.stdout || "").trim();
    if (r.status === 0 && existsSync(orderPath)) ok("compile-order writes the order to orders/r<N>-a<M>.json");
    else fail(`compile-order failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
    if (existsSync(orderPath)) {
      const order = readJSON(orderPath);
      const { validate: veValidate2 } = await import(vePath);
      if (veValidate2(order, readJSON(orderSchemaPath)).valid) ok("compiled order validates against work-order.schema.json");
      else fail("compiled order fails its own schema");
      if (order.payload.decisions?.length === 1 && order.payload.decisions[0].answer === "use idempotency key")
        ok("compile-order threads ONLY this scope's ledger decisions into the order");
      else fail(`compile-order decisions wrong: ${JSON.stringify(order.payload.decisions)}`);
      if (order.payload.digested_errors?.[0]?.core_message === "boom")
        ok("compile-order folds the previous attempt's AEGIS triples into digested_errors");
      else fail("compile-order did not pick up the previous T0 artifact's discovered_tasks");
      if (order.payload.tasks?.some((t) => t.acceptance_criteria.includes("first criterion")))
        ok("compile-order parses AC checkbox text into the task entries");
      else fail("compile-order did not parse acceptance criteria");
      if (order.substrate.allowed.includes("apps/web/cart/*.tsx")) ok("compile-order carries the scope substrate as the write contract");
      else fail("compile-order lost the substrate");
    }
    // --next respects dependency order: only TASK-001 is dispatchable.
    const rn = spawnSync("node", [coPath, "--next", "--slug", "demo", "--cwd", d], { encoding: "utf8" });
    const nextOrder = rn.status === 0 ? readJSON((rn.stdout || "").trim()) : null;
    if (nextOrder && nextOrder.payload.tasks.length === 1 && nextOrder.payload.tasks[0].id === "TASK-001")
      ok("compile-order --next picks the ready task with satisfied dependencies");
    else fail(`compile-order --next wrong: ${rn.stdout}${rn.stderr}`);

    // =============================================================================
    section("22. ingest-result.mjs is the single writer: ticks, flips, unblocks, appends — and rejects malformed results");
    // =============================================================================
    const result = {
      schema_version: 1, order_id: "demo/r1-a2", worker: "task-executor", status: "done",
      task_results: [{ task_id: "TASK-001", status: "done", ac_results: [
        { ac: "first criterion", result: "pass", evidence: "ran it" },
        { ac: "second criterion", result: "pass", evidence: "ran it too" },
      ] }],
      discoveries: [{ marker: "+", line: "edge case found" }],
      escalates: [{ kind: "spec-ambiguity", question: "which default?" }],
    };
    w(".shapeup-sdlc/demo/results/r1-a2.json", JSON.stringify(result));
    const ri = spawnSync("node", [irPath, join(d, ".shapeup-sdlc/demo/results/r1-a2.json"), "--cwd", d], { encoding: "utf8" });
    if (ri.status === 0) ok("ingest-result ingests a valid WorkResult");
    else fail(`ingest-result failed (exit ${ri.status})\n${ri.stdout}${ri.stderr}`);
    const t1 = read(join(d, ".shapeup-sdlc/demo/tasks/TASK-001-a.md"));
    if (/- \[x\] first criterion/.test(t1) && /- \[x\] second criterion/.test(t1)) ok("ingest ticks the verified AC boxes");
    else fail("ingest did not tick AC boxes");
    if (/^status: done$/m.test(t1) && /## Execution Log/.test(t1)) ok("ingest flips status: done + appends the Execution Log");
    else fail("ingest did not flip status / append the log");
    const t2 = read(join(d, ".shapeup-sdlc/demo/tasks/TASK-002-b.md"));
    if (/^status: ready$/m.test(t2)) ok("ingest propagates unblocks (blocked → ready when deps done)");
    else fail("ingest did not unblock the dependent task");
    if (read(join(d, ".shapeup-sdlc/demo/tasks/_index.md")).includes("✅")) ok("ingest updates the board row");
    else fail("ingest did not update the board index");
    if (read(join(d, ".shapeup-sdlc/demo/discovery/ledger.md")).includes("edge case found")) ok("ingest appends discoveries to the ledger");
    else fail("ingest did not append the discovery");
    if (existsSync(join(d, ".shapeup-sdlc/demo/escalates/r1-a2.json"))) ok("ingest queues escalates for the orchestrator");
    else fail("ingest did not queue the escalate");
    // Verdict path: refuted box un-ticked + verdict JSONL appended.
    const evalResult = {
      schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
      verdict: { overall: "FAIL",
        criteria: [{ criterion: "first criterion", verdict: "FAIL", confidence: "high", evidence: "broke" }],
        refuted: [{ task_id: "TASK-001", ac: "first criterion" }] },
    };
    w(".shapeup-sdlc/demo/results/evaluate-r1.json", JSON.stringify(evalResult));
    const rv = spawnSync("node", [irPath, join(d, ".shapeup-sdlc/demo/results/evaluate-r1.json"), "--cwd", d], { encoding: "utf8" });
    const t1b = read(join(d, ".shapeup-sdlc/demo/tasks/TASK-001-a.md"));
    if (rv.status === 0 && /- \[ \] first criterion/.test(t1b) && /eval_verdict: fail/.test(t1b))
      ok("ingest un-ticks refuted AC boxes + sets eval_verdict from the judge's data");
    else fail("ingest did not apply the judge's refuted list");
    if (existsSync(join(d, ".shapeup-sdlc/demo/evaluation/.verdicts-evaluate-r1.jsonl")))
      ok("ingest appends the verdict-ledger JSONL");
    else fail("ingest did not write the verdict ledger");
    // Negative control: malformed result must be rejected without mutating anything.
    w(".shapeup-sdlc/demo/results/bad.json", JSON.stringify({ schema_version: 1, order_id: "demo/x", status: "nope" }));
    const rb = spawnSync("node", [irPath, join(d, ".shapeup-sdlc/demo/results/bad.json"), "--cwd", d], { encoding: "utf8" });
    if (rb.status === 1) ok("ingest-result REJECTS a malformed WorkResult (a bad envelope never mutates the board)");
    else fail("ingest-result accepted a malformed result — the board can be corrupted");
  } finally { rmSync(d, { recursive: true, force: true }); }
} else {
  fail("compile-order.mjs / ingest-result.mjs missing — the P1 pipeline layer is absent");
}

// =============================================================================
section("23. board-derive + spec-lint mechanize the planner's graph math and lints (pure-skill P3)");
// =============================================================================
const bdPath = join(ROOT, "skills/ba-pitch-analyzer/scripts/board-derive.mjs");
const slPath = join(ROOT, "skills/ba-pitch-analyzer/scripts/spec-lint.mjs");
if (existsSync(bdPath) && existsSync(slPath)) {
  const { deriveUnlocks, criticalPath } = await import(bdPath);
  const { lintScopes } = await import(slPath);
  const tasks = [
    { id: "T1", depends_on: [], unlocks: [], hours: 2 },
    { id: "T2", depends_on: ["T1"], unlocks: [], hours: 3 },
    { id: "T3", depends_on: ["T2"], unlocks: [], hours: 1 },
  ];
  const un = deriveUnlocks(tasks);
  if (un.T1.includes("T2") && un.T2.includes("T3") && un.T3.length === 0) ok("deriveUnlocks computes the depends_on inverse (KB-BA-001 mechanized)");
  else fail(`deriveUnlocks wrong: ${JSON.stringify(un)}`);
  const cp = criticalPath(tasks);
  if (cp.hours === 6 && cp.chain.join(">") === "T1>T2>T3") ok("criticalPath finds the longest chain by hours");
  else fail(`criticalPath wrong: ${JSON.stringify(cp)}`);
  // PA1 discriminates: single-layer substrate red, cross-layer substrate clean.
  const repoFiles = ["apps/web/cart/Cart.tsx", "apps/api/cart/route.ts"];
  const layerScope = [{ scope_id: "web-only", topology_type: "LAYER_CAKE", allowed_file_substrate: ["apps/web/cart/*.tsx"] }];
  const flowScope = [{ scope_id: "cart", topology_type: "LAYER_CAKE", allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"] }];
  if (lintScopes(layerScope, repoFiles).some((f) => f.rule === "PA1" && f.level === "red")) ok("spec-lint PA1 flags a directory-aligned scope");
  else fail("spec-lint PA1 missed a single-layer scope");
  if (!lintScopes(flowScope, repoFiles).some((f) => f.rule === "PA1")) ok("spec-lint PA1 passes a cross-layer flow slice (discriminates)");
  else fail("spec-lint PA1 wrongly flagged a flow slice");
  // DISJOINT: undeclared overlap red; declared-in-both shared clean.
  const overlapping = [
    { scope_id: "a", allowed_file_substrate: ["apps/web/cart/*.tsx", "apps/api/cart/*.ts"], shared_substrate: [] },
    { scope_id: "b", allowed_file_substrate: ["apps/api/cart/*.ts", "apps/web/cart/*.tsx"], shared_substrate: [] },
  ];
  if (lintScopes(overlapping, repoFiles).some((f) => f.rule === "DISJOINT" && f.level === "red")) ok("spec-lint flags an undeclared substrate overlap");
  else fail("spec-lint missed a substrate overlap");
  const declared = overlapping.map((s) => ({ ...s, shared_substrate: ["apps/api/cart/*.ts", "apps/web/cart/*.tsx"] }));
  if (!lintScopes(declared, repoFiles).some((f) => f.rule === "DISJOINT")) ok("spec-lint accepts overlap declared in BOTH shared_substrate lists");
  else fail("spec-lint wrongly flagged a declared shared substrate");
  // TIER-DIRECTION + UC-ANCHOR — the tier rule is mechanical: a SHARED spec doc never links
  // the LOCAL board; a LOCAL task must fully anchor into the committed spec.
  const { lintStructure } = await import(slPath);
  const tierTmp = mkdtempSync(join(tmpdir(), "spec-lint-tier-"));
  try {
    const specDir = join(tierTmp, "spec");
    mkdirSync(join(specDir, "usecases"), { recursive: true });
    writeFileSync(join(specDir, "domain-model.md"), "# dm\n");
    writeFileSync(join(specDir, "usecases", "UC-Checkout.md"), "## Steps\n");
    writeFileSync(join(specDir, "synthesis.md"), "covered by [[tasks/TASK-001]]\n");
    const tierTasks = [
      { id: "TASK-001", file: "TASK-001.md", type: "task", status: "ready", depends_on: [], unlocks: [], use_case_refs: ["UC-Checkout"] },
      { id: "TASK-002", file: "TASK-002.md", type: "task", status: "ready", depends_on: [], unlocks: [], use_case_refs: [] },
      { id: "TASK-003", file: "TASK-003.md", type: "task", status: "ready", depends_on: [], unlocks: [], use_case_refs: ["UC-Ghost"] },
      { id: "TASK-004", file: "TASK-004.md", type: "SPIKE", status: "ready", depends_on: [], unlocks: [], use_case_refs: [] },
    ];
    const tierFindings = lintStructure({ specDir, tasks: tierTasks });
    if (tierFindings.some((f) => f.rule === "TIER-DIRECTION" && f.level === "red" && f.detail.includes("synthesis.md")))
      ok("spec-lint TIER-DIRECTION flags a [[tasks/...]] link in a SHARED spec doc");
    else fail("spec-lint TIER-DIRECTION missed a SHARED→LOCAL task link");
    if (tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.level === "red" && f.detail.includes("TASK-002")))
      ok("spec-lint UC-ANCHOR flags a task with empty use_case_refs");
    else fail("spec-lint UC-ANCHOR missed an unanchored task");
    if (tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.detail.includes("TASK-003") && f.detail.includes("UC-Ghost")))
      ok("spec-lint UC-ANCHOR flags an anchor naming a nonexistent UC");
    else fail("spec-lint UC-ANCHOR missed an unresolvable use_case_refs entry");
    if (!tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.detail.includes("TASK-001")))
      ok("spec-lint UC-ANCHOR passes a fully anchored task (discriminates)");
    else fail("spec-lint UC-ANCHOR wrongly flagged an anchored task");
    if (!tierFindings.some((f) => f.rule === "UC-ANCHOR" && f.detail.includes("TASK-004")))
      ok("spec-lint UC-ANCHOR exempts a SPIKE task (anchors via api_ref)");
    else fail("spec-lint UC-ANCHOR wrongly flagged a SPIKE task");
  } finally {
    rmSync(tierTmp, { recursive: true, force: true });
  }
} else {
  fail("board-derive.mjs / spec-lint.mjs missing — the planner's mechanical layer is absent");
}

// =============================================================================
section("24. domain.schema.json is the central registry: every $ref resolves, the payload map is consistent, and validation discriminates through the ref chain");
// =============================================================================
// The definition layer (central-domain-registry): every record type and payload field the
// envelopes carry is defined ONCE in skills/tech-lead/schemas/domain.schema.json; the two
// envelope schemas only $ref it. This section guards the registry the way #3 guards SKILL
// references: a dangling $ref, a payload field named in x-payload-by-worker but not defined,
// or a worker listed that isn't in the WorkerName enum is drift between the registry and
// reality — exactly the "each skill defines its own fields" failure the registry exists to end.
const domainSchemaPath = join(ROOT, "skills/tech-lead/schemas/domain.schema.json");
if (existsSync(domainSchemaPath) && existsSync(vePath)) {
  let domain;
  try { domain = readJSON(domainSchemaPath); ok("domain.schema.json parses"); }
  catch (e) { fail(`domain.schema.json does not parse: ${e.message}`); }
  if (domain) {
    // Every $ref anywhere in the three schema files must resolve to a real definition.
    const schemasDir = join(ROOT, "skills/tech-lead/schemas");
    const docs = {};
    for (const f of readdirSync(schemasDir).filter((x) => x.endsWith(".json"))) docs[f] = readJSON(join(schemasDir, f));
    const collectRefs = (node, acc) => {
      if (Array.isArray(node)) node.forEach((n) => collectRefs(n, acc));
      else if (node && typeof node === "object") {
        if (typeof node.$ref === "string") acc.push(node.$ref);
        for (const v of Object.values(node)) collectRefs(v, acc);
      }
      return acc;
    };
    let dangling = 0;
    for (const [file, doc] of Object.entries(docs)) {
      for (const ref of collectRefs(doc, [])) {
        const [refFile, pointer = ""] = ref.split("#");
        const target = refFile ? docs[refFile] : doc;
        let nodeAt = target;
        for (const seg of pointer.split("/").filter(Boolean)) nodeAt = nodeAt?.[seg];
        if (!nodeAt) { dangling++; fail(`${file}: dangling $ref "${ref}"`); }
      }
    }
    if (dangling === 0) ok("every $ref across the schemas resolves to a real definition");

    // x-payload-by-worker: every field must exist in WorkOrderPayload.properties, every
    // worker key must be in the WorkerName enum — the registry may not drift from itself.
    const payloadProps = domain.$defs?.WorkOrderPayload?.properties || {};
    const workerEnum = new Set(domain.$defs?.WorkerName?.enum || []);
    const byWorker = domain["x-payload-by-worker"] || {};
    let mapDrift = 0;
    for (const [worker, fields] of Object.entries(byWorker)) {
      if (worker === "description") continue;
      if (!workerEnum.has(worker)) { mapDrift++; fail(`x-payload-by-worker names unknown worker "${worker}"`); }
      for (const f of fields) {
        if (!payloadProps[f]) { mapDrift++; fail(`x-payload-by-worker: ${worker} relies on undefined payload field "${f}"`); }
      }
    }
    const mappedWorkers = Object.keys(byWorker).filter((k) => k !== "description");
    if (mappedWorkers.length === workerEnum.size) ok(`x-payload-by-worker covers all ${workerEnum.size} workers`);
    else fail(`x-payload-by-worker covers ${mappedWorkers.length}/${workerEnum.size} workers`);
    if (mapDrift === 0) ok("x-payload-by-worker is consistent with WorkOrderPayload + WorkerName");

    // x-result-by-worker: the result half of the registry gets the same guard — every field
    // must exist in work-result.schema.json properties, every worker key must be in the
    // WorkerName enum, all workers must be mapped, and the two authority boundaries hold
    // (only spec-evaluator returns a verdict; only task-executor returns task_results).
    const resultProps = docs["work-result.schema.json"]?.properties || {};
    const byWorkerResult = domain["x-result-by-worker"] || {};
    let resultDrift = 0;
    for (const [worker, fields] of Object.entries(byWorkerResult)) {
      if (worker === "description") continue;
      if (!workerEnum.has(worker)) { resultDrift++; fail(`x-result-by-worker names unknown worker "${worker}"`); }
      for (const f of fields) {
        if (!resultProps[f]) { resultDrift++; fail(`x-result-by-worker: ${worker} may output undefined result field "${f}"`); }
      }
    }
    const mappedResultWorkers = Object.keys(byWorkerResult).filter((k) => k !== "description");
    if (mappedResultWorkers.length === workerEnum.size) ok(`x-result-by-worker covers all ${workerEnum.size} workers`);
    else fail(`x-result-by-worker covers ${mappedResultWorkers.length}/${workerEnum.size} workers`);
    if (resultDrift === 0) ok("x-result-by-worker is consistent with work-result.schema.json + WorkerName");
    const verdictHolders = mappedResultWorkers.filter((w) => (byWorkerResult[w] || []).includes("verdict"));
    const taskResultHolders = mappedResultWorkers.filter((w) => (byWorkerResult[w] || []).includes("task_results"));
    if (verdictHolders.length === 1 && verdictHolders[0] === "spec-evaluator" &&
        taskResultHolders.length === 1 && taskResultHolders[0] === "task-executor")
      ok("result authority boundaries hold: verdict = spec-evaluator only, task_results = task-executor only");
    else fail(`result authority drift: verdict → [${verdictHolders}], task_results → [${taskResultHolders}]`);

    // The x-erd relationship map must exist and reference only registered entity names
    // (loose check: 'from' side, minus the two envelope roots and prose-annotated targets).
    const rels = domain["x-erd"]?.relationships || [];
    if (rels.length >= 10 && rels.every((r) => r.from && r.to && r.cardinality && r.via))
      ok(`x-erd carries ${rels.length} annotated relationships (from/to/cardinality/via)`);
    else fail("x-erd relationships missing or malformed (need from/to/cardinality/via each)");

    // Validation must DISCRIMINATE through the $ref chain — deep fields, not just top level.
    const { validate: veValidate3 } = await import(vePath);
    const orderSchema3 = readJSON(orderSchemaPath);
    const resultSchema3 = readJSON(resultSchemaPath);
    const badDeepOrder = {
      schema_version: 1, order_id: "demo/r1-a1", worker: "task-executor", mode: "orchestrated",
      operation: "execute",
      payload: { lens: "extreme", scope_contract: { scope_id: "cart", topology_type: "SPAGHETTI" } },
    };
    const bo = veValidate3(badDeepOrder, orderSchema3);
    if (!bo.valid && bo.errors.some((e) => e.includes("lens")) && bo.errors.some((e) => e.includes("topology_type")))
      ok("order validation rejects a bad lens + topology_type THROUGH the $ref chain");
    else fail(`order validation did not discriminate deep $ref'd fields: ${JSON.stringify(bo.errors)}`);
    const badDeepResult = {
      schema_version: 1, order_id: "demo/r1-a1", status: "done",
      discoveries: [{ marker: "!", line: "x" }],
      verdict: { overall: "PASS", t0_citations: [{ scope_id: "cart", path: "p", sha256: "not-a-hash" }] },
    };
    const br = veValidate3(badDeepResult, resultSchema3);
    if (!br.valid && br.errors.some((e) => e.includes("marker")) && br.errors.some((e) => e.includes("sha256")))
      ok("result validation rejects a bad discovery marker + T0 sha256 THROUGH the $ref chain");
    else fail(`result validation did not discriminate deep $ref'd fields: ${JSON.stringify(br.errors)}`);
    // Positive control: a fully-loaded valid envelope pair still passes.
    const richOrder = {
      schema_version: 1, order_id: "demo/r2-a1", worker: "spec-evaluator", mode: "orchestrated",
      operation: "evaluate", interaction: { pause_gates: false },
      substrate: { allowed: [".shapeup-sdlc/demo/evaluation/**"], frozen: ["docs/**"] },
      payload: { spec_folder: "docs/shapeup-sdlc/demo/spec", feature: "demo",
        dimensions: ["spec-conformance"], run_cmd: "pnpm dev", browser: "cli",
        t0_artifacts: [".shapeup-sdlc/demo/t0/verdicts/r2-a1.json"] },
    };
    if (veValidate3(richOrder, orderSchema3).valid) ok("a fully-loaded valid order still PASSes (no false blocks from the registry)");
    else fail(`registry wrongly rejects a valid order: ${JSON.stringify(veValidate3(richOrder, orderSchema3).errors)}`);
  }
} else {
  fail("domain.schema.json missing — the central domain registry is absent");
}

// =============================================================================
section("25. Prompt line-count ratchet — orchestrator prose must not silently regrow");
// =============================================================================
// The absorb-audit found prompt-mass growth is a failure mode discipline alone doesn't stop
// (dwarves-kit: 31 commands × 25 agents of prose). 24995ba cut tech-lead to 724 lines; this
// ratchet turns that cut into a regression. New logic goes into scripts, not SKILL.md prose.
const LINE_RATCHETS = { "skills/tech-lead/SKILL.md": 750 };
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
let checksFloor = null;
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
  else { checksFloor = Number(floorM[1]); ok(`docs state a checks floor (${checksFloor}+)`); }
}

// =============================================================================
section("27. safety-spine hook denies destructive/secret operations, honors overrides, fails open");
// =============================================================================
{
  const spinePath = join(ROOT, "hooks/safety-spine.mjs");
  const d = mkdtempSync(join(tmpdir(), "spine-"));
  const ask = (payload) => {
    const r = spawnSync("node", [spinePath], { encoding: "utf8", input: JSON.stringify(payload) });
    let out = null;
    try { out = JSON.parse(r.stdout); } catch { /* silent = allow */ }
    return { status: r.status, out };
  };
  const bash = (command) => ({ tool_name: "Bash", cwd: d, tool_input: { command } });
  const denies = (payload, category, label) => {
    const { status, out } = ask(payload);
    const decision = out?.hookSpecificOutput?.permissionDecision;
    const reason = out?.hookSpecificOutput?.permissionDecisionReason || "";
    if (status === 0 && decision === "deny" && reason.includes(category)) ok(`denies ${label} (${category})`);
    else fail(`should deny ${label} as ${category}, got decision=${decision} reason=${reason.slice(0, 80)}`);
  };
  const allows = (payload, label) => {
    const { status, out } = ask(payload);
    if (status === 0 && !out) ok(`allows ${label}`);
    else fail(`should allow ${label}, got ${JSON.stringify(out)}`);
  };

  denies(bash("rm -rf /"), "destructive-fs", "rm -rf /");
  denies(bash("rm -rf ~/"), "destructive-fs", "rm -rf ~/");
  denies(bash("cd /tmp && rm -rf .."), "destructive-fs", "rm -rf .. behind &&");
  denies(bash("git push --force origin main"), "git-destructive", "force push");
  denies(bash("git push origin main"), "git-destructive", "push to main");
  denies(bash("git reset --hard HEAD~3"), "git-destructive", "hard reset");
  denies(bash('psql -c "DROP TABLE users;"'), "sql-destructive", "DROP TABLE");
  denies(bash("cat .env"), "secret-read", "cat .env");
  denies(bash("grep KEY ~/.ssh/id_rsa"), "secret-read", "grep ssh private key");
  denies(bash("echo '{}' > .shapeup-sdlc/safety-overrides.json"), "self-protect", "redirect into overrides file");
  denies({ tool_name: "Read", cwd: d, tool_input: { file_path: join(d, ".env") } }, "secret-read", "Read(.env)");
  denies({ tool_name: "Write", cwd: d, tool_input: { file_path: ".shapeup-sdlc/safety-overrides.json", content: "{}" } }, "self-protect", "Write(overrides)");

  allows(bash("rm -rf ./build"), "rm -rf ./build (relative multi-segment)");
  allows(bash("git push"), "plain git push");
  allows(bash("git push --force-with-lease origin feat-x"), "--force-with-lease");
  allows(bash("git reset --soft HEAD~1"), "git reset --soft");
  allows(bash("cat .env.example"), ".env.example");
  allows(bash("npm test"), "npm test");
  allows({ tool_name: "Read", cwd: d, tool_input: { file_path: join(d, "README.md") } }, "Read(README.md)");

  // Denies are telemetry, not just defense: a SAFETY pathology row must have been logged.
  const spineMetricsDir = join(d, "docs/shapeup-sdlc/metrics");
  const spineRows = existsSync(spineMetricsDir)
    ? readdirSync(spineMetricsDir).flatMap((f) => read(join(spineMetricsDir, f)).trim().split("\n")).map((l) => JSON.parse(l))
    : [];
  if (spineRows.some((r) => r.pathology === "SAFETY" && r.category === "destructive-fs")) ok("denies append SAFETY pathology rows to the metrics shard");
  else fail("no SAFETY pathology row was logged for a deny");

  // Override file: exempts the matching command, is itself logged, and fails CLOSED when corrupt.
  mkdirSync(join(d, ".shapeup-sdlc"), { recursive: true });
  writeFileSync(join(d, ".shapeup-sdlc/safety-overrides.json"),
    JSON.stringify({ schema_version: 1, allow_commands: ["^git push origin main$"], note: "CI deploy branch" }));
  allows(bash("git push origin main"), "push to main WITH override");
  const overrideRows = readdirSync(spineMetricsDir).flatMap((f) => read(join(spineMetricsDir, f)).trim().split("\n")).map((l) => JSON.parse(l));
  if (overrideRows.some((r) => r.pathology === "SAFETY-OVERRIDE")) ok("an exercised override is logged as SAFETY-OVERRIDE (visible, never silent)");
  else fail("override was exercised but no SAFETY-OVERRIDE row was logged");
  writeFileSync(join(d, ".shapeup-sdlc/safety-overrides.json"), "broken{");
  denies(bash("git push origin main"), "git-destructive", "push to main with CORRUPT override (override channel fails closed)");

  // Fail-open on garbage stdin.
  const garbage = spawnSync("node", [spinePath], { encoding: "utf8", input: "not json" });
  if (garbage.status === 0 && !garbage.stdout.trim()) ok("garbage stdin → silent exit 0 (fail-open)");
  else fail(`garbage stdin should fail open, got status=${garbage.status} stdout=${garbage.stdout}`);
  rmSync(d, { recursive: true, force: true });
}

// =============================================================================
section("28. Advisory Stop hooks inform but can never block (QA is a level-up, not a gate)");
// =============================================================================
{
  const arPath = join(ROOT, "hooks/anti-rationalization.mjs");
  const scPath = join(ROOT, "hooks/slop-cleaner.mjs");
  const d = mkdtempSync(join(tmpdir(), "stop-"));
  const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
  w(".shapeup-sdlc/active-scope", JSON.stringify({ slug: "demo", scope_id: "cart" }));
  w(".shapeup-sdlc/demo/tasks/TASK-001.md", `---\nid: TASK-001\nstatus: done\n---\n`);
  w(".shapeup-sdlc/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: in-progress\n---\n`);
  w(".shapeup-sdlc/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "red" }));

  const stop = (path, payload) => {
    const r = spawnSync("node", [path], { encoding: "utf8", input: JSON.stringify(payload) });
    let out = null;
    try { out = JSON.parse(r.stdout); } catch { /* silent */ }
    return { status: r.status, out, raw: r.stdout };
  };

  const claim = { cwd: d, stop_hook_active: false, last_assistant_message: "All done — feature complete, all tests pass." };
  const red = stop(arPath, claim);
  if (red.status === 0 && red.out?.systemMessage) ok("claim + contradicting facts → advisory systemMessage");
  else fail(`expected systemMessage on red fixture, got: ${red.raw}`);
  if (red.out?.systemMessage?.includes("TASK-002") && red.out?.systemMessage?.includes("red")) ok("message names the specific facts (task + red T0)");
  else fail(`message doesn't name the facts: ${red.out?.systemMessage}`);
  if (red.out && !("decision" in red.out)) ok("output carries NO decision key — advisory can never block");
  else fail("advisory hook emitted a decision key — that's a gate, not a level-up");

  const claimless = stop(arPath, { ...claim, last_assistant_message: "Still investigating the parser." });
  if (claimless.status === 0 && !claimless.out) ok("no completion claim → silent");
  else fail(`claimless message should be silent, got: ${claimless.raw}`);

  const looping = stop(arPath, { ...claim, stop_hook_active: true });
  if (looping.status === 0 && !looping.out) ok("stop_hook_active → silent (no stop-hook loops)");
  else fail("hook fired while stop_hook_active");

  w(".shapeup-sdlc/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: done\n---\n`);
  w(".shapeup-sdlc/demo/t0/verdicts/r1-a2.json", JSON.stringify({ overall: "green" }));
  const green = stop(arPath, claim);
  if (green.status === 0 && !green.out) ok("green board + green T0 → claim stands, silent");
  else fail(`green fixture should be silent, got: ${green.raw}`);

  const noRun = mkdtempSync(join(tmpdir(), "norun-"));
  const idle = stop(arPath, { cwd: noRun, stop_hook_active: false, last_assistant_message: "All done." });
  if (idle.status === 0 && !idle.out) ok("no harness run → silent (harness-scoped, not an always-on nag)");
  else fail(`no-run case should be silent, got: ${idle.raw}`);

  // slop-cleaner: pure scanner unit + fail-open CLI.
  const { scanDiff, summarize } = await import(scPath);
  const dirtyDiff = [
    "+++ b/src/x.ts", "+console.log(1)", "+// TODO fix this later", "+const a = 1;",
    "+++ b/src/clean.ts", "+const b = 2;",
  ].join("\n");
  const findings = scanDiff(dirtyDiff);
  if (findings.length === 1 && findings[0].file === "src/x.ts" && findings[0].markers["console.log"] === 1 && findings[0].markers["TODO/FIXME"] === 1)
    ok("scanDiff flags console.log + TODO in added lines only");
  else fail(`scanDiff wrong: ${JSON.stringify(findings)}`);
  if (scanDiff(["+++ b/src/clean.ts", "+const b = 2;"].join("\n")).length === 0) ok("scanDiff stays quiet on a clean diff");
  else fail("scanDiff flagged a clean diff");
  const bigDiff = ["+++ b/src/gen.ts", ...Array.from({ length: 500 }, (_, i) => `+line ${i}`)].join("\n");
  if (scanDiff(bigDiff)[0]?.big && summarize(scanDiff(bigDiff))[0].includes("+500 lines")) ok("scanDiff flags a 500-line single-file add");
  else fail("scanDiff missed the big-file signal");
  const scIdle = stop(scPath, { cwd: noRun, stop_hook_active: false });
  if (scIdle.status === 0 && !scIdle.out) ok("slop-cleaner: no run → silent exit 0 (fail-open)");
  else fail(`slop-cleaner no-run case not silent: ${scIdle.raw}`);
  rmSync(d, { recursive: true, force: true });
  rmSync(noRun, { recursive: true, force: true });
}

// =============================================================================
section("29. run-snapshot derives mid-run state from files only; compact/rehydrate hooks carry it");
// =============================================================================
{
  const rsPath = join(ROOT, "skills/tech-lead/scripts/run-snapshot.mjs");
  const csPath = join(ROOT, "hooks/compact-snapshot.mjs");
  const srPath = join(ROOT, "hooks/session-rehydrate.mjs");
  const d = mkdtempSync(join(tmpdir(), "snap-"));
  const w = (rel, body) => { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), body); };
  w(".shapeup-sdlc/active-scope", JSON.stringify({ slug: "demo", scope_id: "cart" }));
  w(".shapeup-sdlc/demo/harness-run.md", `---\nfeature: demo\nstatus: building\nrounds_used: 1\nmax_rounds: 3\nauto_level: interactive\n---\n# run\n`);
  w(".shapeup-sdlc/demo/tasks/TASK-001.md", `---\nid: TASK-001\nstatus: done\n---\n`);
  w(".shapeup-sdlc/demo/tasks/TASK-002.md", `---\nid: TASK-002\nstatus: ready\n---\n`);
  w(".shapeup-sdlc/demo/t0/verdicts/r1-a1.json", JSON.stringify({ overall: "green" }));
  w(".shapeup-sdlc/demo/t0/verdicts/r1-a2.json", JSON.stringify({ overall: "red" }));
  w(".shapeup-sdlc/demo/orders/r1-a2.json", "{}");

  const { deriveSnapshot } = await import(rsPath);
  const snap = deriveSnapshot(d);
  if (snap && snap.slug === "demo" && snap.scope_id === "cart" && snap.round === 1 && snap.attempt === 2)
    ok("deriveSnapshot reads slug/scope from the pointer and round/attempt from the latest T0 filename");
  else fail(`deriveSnapshot wrong: ${JSON.stringify(snap)}`);
  if (snap?.board?.total === 2 && snap.board.done === 1 && snap.board.unfinished.includes("TASK-002"))
    ok("board totals derived from task frontmatter");
  else fail(`board wrong: ${JSON.stringify(snap?.board)}`);
  if (snap?.latest_t0?.overall === "red") ok("latest_t0 is the max (round, attempt) verdict");
  else fail(`latest_t0 wrong: ${JSON.stringify(snap?.latest_t0)}`);
  if (snap?.pending_orders?.length === 1 && snap.pending_orders[0] === "r1-a2.json")
    ok("pending_orders = dispatched-but-not-ingested (orders/ minus results/)");
  else fail(`pending_orders wrong: ${JSON.stringify(snap?.pending_orders)}`);

  const { validate: veValidateSnap } = await import(join(ROOT, "skills/tech-lead/scripts/validate-envelope.mjs"));
  const snapCheck = veValidateSnap(snap, { $ref: "domain.schema.json#/$defs/RunSnapshot" });
  if (snapCheck.valid) ok("derived snapshot validates against domain.schema.json#/$defs/RunSnapshot");
  else fail(`snapshot fails its own registry def: ${snapCheck.errors.join("; ")}`);

  const rWrite = spawnSync("node", [rsPath, "--cwd", d, "--write"], { encoding: "utf8" });
  if (rWrite.status === 0 && existsSync(join(d, ".shapeup-sdlc/demo/run-snapshot.json"))) ok("--write persists run-snapshot.json");
  else fail(`--write failed: ${rWrite.stderr}`);

  const empty = mkdtempSync(join(tmpdir(), "snapempty-"));
  const rEmpty = spawnSync("node", [rsPath, "--cwd", empty], { encoding: "utf8" });
  if (rEmpty.status === 0 && !rEmpty.stdout.trim()) ok("no active run → exit 0, empty stdout (fail-open)");
  else fail(`empty dir should be silent, got status=${rEmpty.status} stdout=${rEmpty.stdout}`);

  rmSync(join(d, ".shapeup-sdlc/demo/run-snapshot.json"));
  const rCompact = spawnSync("node", [csPath], { encoding: "utf8", input: JSON.stringify({ cwd: d, trigger: "auto" }) });
  if (rCompact.status === 0 && existsSync(join(d, ".shapeup-sdlc/demo/run-snapshot.json"))) ok("PreCompact hook persists the snapshot mid-run");
  else fail(`compact-snapshot failed: status=${rCompact.status} ${rCompact.stderr}`);
  const rCompactIdle = spawnSync("node", [csPath], { encoding: "utf8", input: JSON.stringify({ cwd: empty, trigger: "auto" }) });
  if (rCompactIdle.status === 0) ok("PreCompact hook exits 0 with no run (never blocks compaction)");
  else fail("compact-snapshot blocked on an empty dir");

  const rRehy = spawnSync("node", [srPath], { encoding: "utf8", input: JSON.stringify({ cwd: d, source: "compact" }) });
  let rehyOut = null;
  try { rehyOut = JSON.parse(rRehy.stdout); } catch { /* silent */ }
  const ctx = rehyOut?.hookSpecificOutput?.additionalContext || "";
  if (rehyOut?.hookSpecificOutput?.hookEventName === "SessionStart" && ctx.includes("mid-run") && ctx.includes("demo") && ctx.includes("round 1"))
    ok("SessionStart(compact) injects the rehydrate hint as additionalContext");
  else fail(`rehydrate output wrong: ${rRehy.stdout.slice(0, 120)}`);
  const rRehyIdle = spawnSync("node", [srPath], { encoding: "utf8", input: JSON.stringify({ cwd: empty, source: "compact" }) });
  if (rRehyIdle.status === 0 && !rRehyIdle.stdout.trim()) ok("rehydrate is silent with no active run");
  else fail("rehydrate spoke with no run active");
  rmSync(d, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
}

// =============================================================================
section("30. stats.mjs is a read-only, schema-valid projection over the metrics shards");
// =============================================================================
{
  const statsPath = join(ROOT, "skills/tech-lead/scripts/stats.mjs");
  const d = mkdtempSync(join(tmpdir(), "stats-"));
  const mdir = join(d, "docs/shapeup-sdlc/metrics");
  mkdirSync(mdir, { recursive: true });
  writeFileSync(join(mdir, "a.jsonl"), [
    JSON.stringify({ schema_version: 1, feature_slug: "demo", terminal_state: "shipped", round_count: 2, scope_cut_count: 0, qa_findings: { total: 3, promoted: 1, held: 2 }, slice_count: 4, sources: [] }),
    JSON.stringify({ schema_version: 1, at: "2026-07-10T00:00:00Z", feature_slug: "demo", terminal_state: "shipped", round_count: 3, scope_cut_count: 1, attempt_exhaustions: 1, qa_findings: { total: 2, promoted: 2, held: 0 }, slice_count: 4, sources: [] }),
    JSON.stringify({ schema_version: 1, kind: "pathology", pathology: "PA3", slug: "demo" }),
    "not json at all",
    "{}",
  ].join("\n") + "\n");
  writeFileSync(join(mdir, "b.jsonl"), JSON.stringify({ schema_version: 1, feature_slug: "other", terminal_state: "escalated", round_count: 4, sources: [] }) + "\n");

  const before = readdirSync(mdir).map((f) => `${f}:${statSync(join(mdir, f)).size}`).join(",");
  const r = spawnSync("node", [statsPath, "--cwd", d], { encoding: "utf8" });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { /* handled below */ }
  if (r.status === 0 && report) ok("stats exits 0 and emits parseable JSON");
  else fail(`stats failed: status=${r.status} ${r.stderr}`);

  const { validate: veValidateStats } = await import(join(ROOT, "skills/tech-lead/scripts/validate-envelope.mjs"));
  const repCheck = report ? veValidateStats(report, { $ref: "domain.schema.json#/$defs/StatsReport" }) : { valid: false, errors: ["no report"] };
  if (repCheck.valid) ok("report validates against domain.schema.json#/$defs/StatsReport");
  else fail(`report fails its own registry def: ${repCheck.errors.join("; ")}`);

  const demo = report?.per_slug?.find((s) => s.feature_slug === "demo");
  if (demo?.runs === 2 && demo.rounds.avg === 2.5 && demo.hammer_cut_rate === 0.5 && demo.attempt_exhaustions === 1)
    ok("aggregates are right (runs 2, rounds.avg 2.5, cut-rate 0.5, exhaustions 1)");
  else fail(`demo aggregate wrong: ${JSON.stringify(demo)}`);
  if (report?.rows_malformed === 2 && report?.rows_pathology === 1 && report?.pathologies?.PA3 === 1)
    ok("malformed rows skipped+counted; pathology rows partitioned, not errors");
  else fail(`row accounting wrong: malformed=${report?.rows_malformed} pathology=${report?.rows_pathology}`);

  const rTable = spawnSync("node", [statsPath, "--cwd", d, "--format", "table"], { encoding: "utf8" });
  if (rTable.status === 0 && rTable.stdout.includes("demo")) ok("--format table renders and names the slug");
  else fail(`table render failed: ${rTable.stderr}`);

  const after = readdirSync(mdir).map((f) => `${f}:${statSync(join(mdir, f)).size}`).join(",");
  if (before === after) ok("metrics dir is byte-identical after both runs (read-only proof)");
  else fail(`stats WROTE to the metrics dir: before=${before} after=${after}`);

  const emptyDir = mkdtempSync(join(tmpdir(), "statsempty-"));
  const rEmpty = spawnSync("node", [statsPath, "--cwd", emptyDir], { encoding: "utf8" });
  let emptyReport = null;
  try { emptyReport = JSON.parse(rEmpty.stdout); } catch { /* handled below */ }
  if (rEmpty.status === 0 && emptyReport?.rows_total === 0) ok("missing metrics dir → valid empty report, exit 0");
  else fail(`empty-dir case wrong: status=${rEmpty.status}`);
  rmSync(d, { recursive: true, force: true });
  rmSync(emptyDir, { recursive: true, force: true });
}

// =============================================================================
section("31. trace-lint.mjs is the covers-closure + reachability oracle (spine v1.3)");
// =============================================================================
// The plan's governing rule: if a script can't check it, it's decoration. This section proves
// the oracle actually goes RED on the two audit findings it exists to catch — a dropped clause
// and an orphaned engine — is ADVISORY by default (exit 0) yet BLOCKS under --gate, and is a
// true non-regression on legacy specs (no spine artifacts → green). It also guards the schema
// registration surface the plan requires (worker/operation/$def/payload) against drift.
{
  const tlPath = join(ROOT, "skills/tech-lead/scripts/trace-lint.mjs");
  if (!existsSync(tlPath)) fail("skills/tech-lead/scripts/trace-lint.mjs missing — the traceability oracle is absent");
  else {
    const run = (slug, cwd, extra = []) => {
      const r = spawnSync("node", [tlPath, "--slug", slug, "--cwd", cwd, "--quiet", ...extra], { encoding: "utf8" });
      let report = null;
      try { report = readJSON(join(cwd, ".shapeup-sdlc", slug, "trace", "report.json")); } catch { /* handled by caller */ }
      return { status: r.status, report };
    };

    // Fixture A: a dropped clause (REQ covered-status, no AC), a dangling covers, an orphan engine.
    const A = mkdtempSync(join(tmpdir(), "tracelint-red-"));
    mkdirSync(join(A, "docs/shapeup-sdlc/demo"), { recursive: true });
    mkdirSync(join(A, ".shapeup-sdlc/demo/tasks"), { recursive: true });
    mkdirSync(join(A, "src"), { recursive: true });
    writeFileSync(join(A, "docs/shapeup-sdlc/demo/requirements.md"),
      "| REQ-id | clause | source | status | note |\n|--|--|--|--|--|\n" +
      "| REQ-1 | lure enemies into traps | p §2.1 | covered | |\n" +
      "| REQ-2 | side-step enemies | p §2.2 | covered | |\n" +
      "| REQ-3 | low-res textures | p §2.3 | CUT (PO-approved) | absorbed |\n");
    writeFileSync(join(A, ".shapeup-sdlc/demo/tasks/TASK-001.md"),
      "---\nid: TASK-001\nstatus: ready\npriority: 1\n---\n- [ ] enemy lured into a trap (covers: REQ-1)\n- [ ] trap resets (covers: REQ-9)\n");
    writeFileSync(join(A, "docs/shapeup-sdlc/demo/project-profile.json"),
      JSON.stringify({ schema_version: 1, archetype: "client-only-game", entry_point: "main.js" }));
    writeFileSync(join(A, "docs/shapeup-sdlc/demo/wiring-map.json"),
      JSON.stringify({ schema_version: 1, feature: "demo", entries: [
        { use_case: "UC-01", engine: "src/trap.js", affordance: "trap fires" },
        { use_case: "UC-02", engine: "src/asset-pipeline.js", affordance: "textures" }] }));
    writeFileSync(join(A, "main.js"), 'import { fire } from "./src/trap.js";\nfire();\n');
    writeFileSync(join(A, "src/trap.js"), "export function fire(){ return 1; }\n");
    writeFileSync(join(A, "src/asset-pipeline.js"), "export function load(){ return 631; }\n");

    const advisory = run("demo", A);
    if (advisory.status === 0) ok("trace-lint is advisory by default (exit 0 even when red)");
    else fail(`advisory run should exit 0, got ${advisory.status}`);
    const cc = advisory.report?.covers_closure, rc = advisory.report?.reachability;
    if (advisory.report?.overall === "red") ok("trace-lint reports overall red on dropped clause + orphan");
    else fail(`expected overall red, got ${advisory.report?.overall}`);
    if (cc?.uncovered?.includes("REQ-2")) ok("covers-closure flags the dropped clause REQ-2 (no AC covers it)");
    else fail(`REQ-2 not flagged uncovered: ${JSON.stringify(cc?.uncovered)}`);
    if (cc?.dangling_covers?.includes("REQ-9")) ok("covers-closure flags the dangling covers: REQ-9 (not in the registry)");
    else fail(`REQ-9 not flagged dangling: ${JSON.stringify(cc?.dangling_covers)}`);
    if (!cc?.uncovered?.includes("REQ-3")) ok("a CUT (PO-approved) clause is NOT counted uncovered (governance, not a gap)");
    else fail("REQ-3 (CUT) wrongly flagged uncovered");
    if (rc?.unreachable?.some((u) => u.use_case === "UC-02")) ok("reachability flags the orphaned engine (UC-02, 0 import sites)");
    else fail(`UC-02 orphan not flagged: ${JSON.stringify(rc?.unreachable)}`);
    if (!rc?.unreachable?.some((u) => u.use_case === "UC-01")) ok("reachability does NOT flag the wired engine (UC-01 reaches entry_point)");
    else fail("UC-01 wrongly flagged unreachable");

    const gated = run("demo", A, ["--gate"]);
    if (gated.status === 1) ok("--gate turns the same red report into a blocking failure (exit 1)");
    else fail(`--gate should exit 1 on red, got ${gated.status}`);

    // Fixture B: a legacy spec with no spine artifacts must be green even under --gate.
    const B = mkdtempSync(join(tmpdir(), "tracelint-legacy-"));
    mkdirSync(join(B, ".shapeup-sdlc/legacy/tasks"), { recursive: true });
    writeFileSync(join(B, ".shapeup-sdlc/legacy/tasks/TASK-001.md"),
      "---\nid: TASK-001\nstatus: ready\npriority: 1\n---\n- [ ] something works\n");
    const legacy = run("legacy", B, ["--gate"]);
    if (legacy.status === 0 && legacy.report?.overall === "green") ok("legacy spec (no requirements/wiring/profile) is green even under --gate (non-regression)");
    else fail(`legacy run should be green/exit0, got status=${legacy.status} overall=${legacy.report?.overall}`);
    if (legacy.report?.covers_closure?.checked === false && legacy.report?.reachability?.checked === false) ok("both spine arms self-skip when their artifacts are absent");
    else fail("legacy run did not self-skip the spine arms");

    rmSync(A, { recursive: true, force: true });
    rmSync(B, { recursive: true, force: true });
  }

  // Schema registration surface the plan mandates (§2, §5) — guard against half-wired drift.
  const domain = readJSON(join(ROOT, "skills/tech-lead/schemas/domain.schema.json"));
  const wn = new Set(domain.$defs?.WorkerName?.enum || []);
  const ops = new Set(domain.$defs?.Operation?.enum || []);
  if (wn.has("solution-architect")) ok("WorkerName enum registers solution-architect");
  else fail("solution-architect missing from WorkerName enum");
  for (const op of ["wire", "coverage"]) {
    if (ops.has(op)) ok(`Operation enum registers ${op}`);
    else fail(`Operation enum missing ${op}`);
  }
  for (const def of ["RequirementClause", "WiringMap", "WiringEntry", "ProjectProfile"]) {
    if (domain.$defs?.[def]) ok(`$defs registers ${def}`);
    else fail(`$defs missing ${def}`);
  }
  // The new $defs must carry the writer/tier annotations the registry discipline requires.
  const writers = { RequirementClause: "ba-pitch-analyzer", WiringMap: "solution-architect", ProjectProfile: "tech-lead" };
  for (const [def, who] of Object.entries(writers)) {
    if ((domain.$defs?.[def]?.["x-writer"] || "").includes(who)) ok(`${def} x-writer is ${who}`);
    else fail(`${def} x-writer must name ${who}`);
  }
  // ProjectProfile.archetype must be a closed enum (a typo must fail, not silently disable reachability).
  if (Array.isArray(domain.$defs?.ProjectProfile?.properties?.archetype?.enum)) ok("ProjectProfile.archetype is a closed enum");
  else fail("ProjectProfile.archetype must be an enum");
  // acceptance_criteria must be the additive union (string | {text, covers?}).
  const acItems = domain.$defs?.TaskRef?.properties?.acceptance_criteria?.items;
  if (Array.isArray(acItems?.anyOf) && acItems.anyOf.some((s) => s.type === "string") && acItems.anyOf.some((s) => s.type === "object"))
    ok("TaskRef.acceptance_criteria accepts the additive string | {text, covers?} union");
  else fail("acceptance_criteria is not the additive union the plan requires");

  // parseTaskFile must extract covers[] while keeping .text byte-identical (ingest tick-back safe).
  const cwd2 = mkdtempSync(join(tmpdir(), "covers-parse-"));
  mkdirSync(join(cwd2, ".shapeup-sdlc/px/tasks"), { recursive: true });
  writeFileSync(join(cwd2, ".shapeup-sdlc/px/tasks/TASK-001.md"),
    "---\nid: TASK-001\nstatus: ready\npriority: 1\n---\n- [ ] does A (covers: REQ-3, REQ-7)\n- [ ] plain B\n");
  const { readBoard } = await import(join(ROOT, "skills/tech-lead/scripts/compile-order.mjs"));
  const board = readBoard(cwd2, "px");
  const acs = board[0]?.acceptance_criteria || [];
  const withCovers = acs.find((a) => typeof a === "object");
  if (withCovers && withCovers.text === "does A (covers: REQ-3, REQ-7)" && withCovers.covers.join(",") === "REQ-3,REQ-7")
    ok("parseTaskFile extracts covers[] and keeps .text byte-identical to the checkbox");
  else fail(`covers parse wrong: ${JSON.stringify(withCovers)}`);
  if (acs.some((a) => a === "plain B")) ok("an AC with no covers: stays a plain string (non-regression)");
  else fail("plain AC was not left as a string");
  rmSync(cwd2, { recursive: true, force: true });
}

// The floor parsed in section 26(d) is asserted here, where the final total exists.
if (checksFloor !== null) {
  if (checks >= checksFloor) ok(`total checks (${checks}) meet the documented floor (${checksFloor}+)`);
  else fail(`docs promise ${checksFloor}+ checks but only ${checks} ran — lower the floor only if checks were deliberately removed`);
}

// =============================================================================
console.log(`\n${"=".repeat(60)}`);
if (failures === 0) {
  console.log(`✅ structural tests passed (${checks} checks)`);
  process.exit(0);
} else {
  console.error(`❌ ${failures} structural failure(s), ${checks} checks passed`);
  process.exit(1);
}
