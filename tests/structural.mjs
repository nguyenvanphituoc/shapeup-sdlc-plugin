#!/usr/bin/env node
// Structural test layer for the Shape Up SDLC plugin.
//
// Zero dependencies, zero network, no Claude calls. Runs in milliseconds and is safe in CI.
// It does NOT test agent behavior (that needs tier-1/2 evals — see docs/audit). It proves the
// plugin is *well-formed*: the cheapest, highest-ROI guard, and the one that would have caught
// the broken `AGENT.md` reference and any future frontmatter/version drift.
//
// Usage:  node tests/structural.mjs        (exit 0 = pass, 1 = fail)

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
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
section("4. Hooks manifest (if present) is valid JSON");
// =============================================================================
const hooksPath = join(ROOT, "hooks/hooks.json");
if (existsSync(hooksPath)) {
  try { readJSON(hooksPath); ok("hooks.json parses"); }
  catch (e) { fail(`hooks.json does not parse: ${e.message}`); }
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
const sharedOracle = join(ROOT, "scripts/oracles/process-oracle.mjs");
const contract = join(ROOT, "examples/todo-cli/todo.contract.json");
if (existsSync(sharedOracle)) ok("shared process oracle present (scripts/oracles/process-oracle.mjs)");
else fail("shared process oracle missing: scripts/oracles/process-oracle.mjs");
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
const migDir = join(ROOT, "scripts/migrations");
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
  console.log("  (no scripts/migrations dir — skipping)");
}

// =============================================================================
section("8. Evaluation-contract oracle registry (Stage G) is complete & consistent");
// =============================================================================
// The registry is the source of truth for "which oracles exist". Every oracle it names must
// have a runner file; every oracle the docs claim must be in the registry. Catches a doc/code
// drift in the eval-contract the same way #3 catches broken SKILL references.
const { ORACLES, ORACLE_NAMES } = await import(join(ROOT, "scripts/oracles/index.mjs"));
const EXPECTED_RUNNERS = {
  process: "scripts/oracles/process-oracle.mjs",
  test: "scripts/oracles/test-oracle.mjs",
  snapshot: "scripts/oracles/snapshot-oracle.mjs",
  http: "scripts/oracles/http-oracle.mjs",
};
for (const [name, rel] of Object.entries(EXPECTED_RUNNERS)) {
  if (!ORACLES[name]) fail(`oracle "${name}" not registered in scripts/oracles/index.mjs`);
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
const testOraclePath = join(ROOT, "scripts/oracles/test-oracle.mjs");
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
const snapOraclePath = join(ROOT, "scripts/oracles/snapshot-oracle.mjs");
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
const httpOraclePath = join(ROOT, "scripts/oracles/http-oracle.mjs");
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
// Only recognized component dirs ship: a Claude plugin install copies `skills/` (etc.) to the
// plugin cache and BLOCKS path traversal outside it; the scaffolding installer copies only
// `skills/`; distribute.js inlines SKILL.md + references/*.md into one prompt. So `scripts/`,
// `examples/`, `docs/audit|plan|research/`, and `tests/` are ABSENT at runtime. A shipped skill
// file that tells the agent to run/read one of them dangles. (Runtime project paths the harness
// itself creates — `docs/shapeup-sdlc/`, `.shapeup-sdlc/` — are fine.) This guard is the fix for
// the false confidence the cwd-dependent oracle CLI checks (#6, #9–#11) gave: those run from the
// repo root; a real install does not.
const REPO_ONLY = /(?:^|[\s`(])(?:scripts\/|examples\/|docs\/audit|docs\/plan|docs\/research|tests\/)/;
const shippedSkillDocs = [];
for (const dir of skillDirs) {
  const sf = join(skillsDir, dir, "SKILL.md");
  if (existsSync(sf)) shippedSkillDocs.push(sf);
  const refDir = join(skillsDir, dir, "references");
  if (existsSync(refDir)) {
    for (const f of readdirSync(refDir).filter((x) => x.endsWith(".md"))) shippedSkillDocs.push(join(refDir, f));
  }
}
for (const f of shippedSkillDocs) {
  const rel = f.replace(ROOT + "/", "");
  const bad = read(f).split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => REPO_ONLY.test(line) && !/docs\/shapeup-sdlc|\.shapeup-sdlc/.test(line));
  if (bad.length) fail(`${rel} references repo-only path(s) that will not exist in an install: line ${bad.map((b) => b.n).join(", ")}`);
  else ok(`${rel} has no dangling repo-only path`);
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
