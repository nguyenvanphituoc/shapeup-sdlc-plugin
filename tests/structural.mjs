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
console.log(`\n${"=".repeat(60)}`);
if (failures === 0) {
  console.log(`✅ structural tests passed (${checks} checks)`);
  process.exit(0);
} else {
  console.error(`❌ ${failures} structural failure(s), ${checks} checks passed`);
  process.exit(1);
}
