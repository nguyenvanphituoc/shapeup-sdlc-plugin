#!/usr/bin/env node
// EXECUTING grant guard — the check HD-009 says must exist, and the reason it exists.
//
// The structural suite could not catch HD-009 because it asserted the grant was a string PREFIX of
// each documented command. That is a proxy for "the CLI will honour this", and proxy and behaviour
// diverged exactly there: the rule was a perfectly good prefix and granted no command at all.
//
// So this module asserts the only thing that is not a proxy — it starts a real `claude` session
// under the rules `bin/lib/grant.mjs` actually emits, asks it to run one command, and decides
// ALLOWED vs DENIED by whether the target script's SIDE EFFECT landed on disk. A marker file the
// script alone can write is evidence; a model saying "I ran it" is a claim.
//
// WHY IT IS NOT IN `npm test`. Tier-0 promises zero dependencies, zero network and zero Claude
// calls, and that promise is worth more than this check. The permission decision only happens
// inside a real CLI session, so this is Tier 1: `npm run test:grant`, run in CI on any diff
// touching `bin/` or `skills/**/scripts/**`. It SKIPS LOUDLY (non-zero) when the `claude` binary
// or auth is missing, because a silent skip reported as a pass is the failure mode this module
// exists to end.
//
// The negative controls are not decoration. Without them a future `Bash(node:*)` regression — or
// any rule broad enough to grant everything — turns every positive case green and the suite would
// certify it.

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { pipelineRules } from "../../bin/lib/grant.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MARKER = "EXECUTING_GRANT_MARKER_b41c";
const MODEL = process.env.GRANT_PROBE_MODEL || "claude-haiku-4-5-20251001";

let pass = 0;
const failures = [];
const ok = (m) => { pass++; console.log(`  ok   ${m}`); };
const fail = (m) => { failures.push(m); console.log(`  FAIL ${m}`); };

/**
 * Run one command in a scratch project under a given allow-list and report what really happened.
 *
 * @param {object} spec - `{label, allow, command, layout}`.
 * @returns {("ALLOWED"|"DENIED"|"ERROR")} Verdict, decided by the marker file.
 */
function runCase({ allow, command, layout, projectScoped = false }) {
  const box = mkdtempSync(join(tmpdir(), "exec-grant-"));
  try {
    const pluginRoot = join(box, layout);
    const scriptDir = join(pluginRoot, "skills", "tech-lead", "scripts");
    const proj = join(box, "proj");
    mkdirSync(scriptDir, { recursive: true });
    mkdirSync(proj, { recursive: true });

    const marker = join(box, "marker.txt");
    writeFileSync(
      join(scriptDir, "init-run.mjs"),
      `import { writeFileSync } from "node:fs";\n` +
        `writeFileSync(${JSON.stringify(marker)}, ${JSON.stringify(MARKER)});\n` +
        `console.log(${JSON.stringify(MARKER)});\n`,
    );
    // The negative control's target lives outside any skills/ tree, so no rule can reach it.
    writeFileSync(join(box, "not-ours.mjs"), `console.log("SHOULD_NOT_RUN");\n`);

    // Two delivery routes, and the difference is load-bearing. `--settings` hands the rules in
    // from outside the project; `.claude/settings.json` is where the INSTALLER actually writes.
    // Those are not equivalent: a project-scoped allow-list is discarded wholesale in an untrusted
    // workspace, which is every fresh CI clone. Testing only the `--settings` route would prove
    // the rules are well-formed while saying nothing about the configuration users get.
    const settingsFile = join(box, "settings.json");
    const payload = JSON.stringify({ permissions: { allow, deny: [], ask: [] } }, null, 2);
    if (projectScoped) {
      mkdirSync(join(proj, ".claude"), { recursive: true });
      writeFileSync(join(proj, ".claude", "settings.json"), payload);
    } else {
      writeFileSync(settingsFile, payload);
    }

    const cmd = command(scriptDir, box);
    const r = spawnSync(
      "claude",
      ["-p",
        `Run exactly this one Bash command, verbatim, and nothing else:\n\n${cmd}\n\n` +
        `Do not modify it, do not add flags, do not append an exit-code marker, and do not ` +
        `substitute another tool. If it is denied by permissions, stop and reply with the single ` +
        `word DENIED. Do not create any file yourself.`,
        ...(projectScoped ? [] : ["--settings", settingsFile]),
        "--permission-mode", "default", "--model", MODEL],
      { cwd: proj, encoding: "utf8", timeout: 240_000, stdio: ["ignore", "pipe", "pipe"] },
    );
    const say = (r.stdout || "") + (r.stderr || "");
    if (/Please run \/login|Not logged in|Invalid API key|credit balance/i.test(say)) return "ERROR";
    return existsSync(marker) && readFileSync(marker, "utf8").includes(MARKER) ? "ALLOWED" : "DENIED";
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
}

// The rules under test are IMPORTED, never re-derived. A test that rebuilds what it expects to see
// is testing its own copy of the intent, which is how the last one stayed green.
const RULES = pipelineRules(ROOT);
const q = (dir) => `node "${join(dir, "init-run.mjs")}"`;

const CASES = [
  // --- positives: the two argument shapes, in both install topologies -------------------------
  { label: "marketplace layout, quoted + args",
    allow: RULES, layout: "cache/nvptuoc-marketplace/shapeup-sdlc-plugin/1.8.0",
    command: (d) => `${q(d)} --slug demo`, expect: "ALLOWED" },
  { label: "marketplace layout, quoted + NO args (the ` *` rule alone would deny this)",
    allow: RULES, layout: "cache/nvptuoc-marketplace/shapeup-sdlc-plugin/1.8.0",
    command: (d) => q(d), expect: "ALLOWED" },
  { label: "dev --plugin-dir checkout, arbitrary directory name",
    allow: RULES, layout: "proj-harness-plugin",
    command: (d) => `${q(d)} --slug demo`, expect: "ALLOWED" },
  { label: "install path containing a space (v1.5's reason for quoting)",
    allow: RULES, layout: "Application Support/shapeup",
    command: (d) => `${q(d)} --slug demo`, expect: "ALLOWED" },

  // --- negative controls: without these, an over-broad rule passes every positive -------------
  { label: "NEGATIVE a script outside any skills/ tree is not granted",
    allow: RULES, layout: "proj-harness-plugin",
    command: (_d, box) => `node "${join(box, "not-ours.mjs")}"`, expect: "DENIED" },
  { label: "NEGATIVE an unrelated destructive command is not granted",
    allow: RULES, layout: "proj-harness-plugin",
    command: (_d, box) => `rm -rf "${join(box, "not-ours.mjs")}"`, expect: "DENIED" },

  // --- regression pins for the two defects that made up HD-009 --------------------------------
  { label: "PIN the superseded mid-argument prefix rule still grants nothing",
    allow: ["Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)"],
    layout: "proj-harness-plugin", command: (d) => `${q(d)} --slug demo`, expect: "DENIED" },
  { label: "PIN a call site carrying the literal ${CLAUDE_PLUGIN_ROOT} is refused",
    allow: RULES, layout: "proj-harness-plugin",
    command: () => `node "\${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/init-run.mjs" --slug demo`,
    expect: "DENIED" },

  // --- the third layer: correct rules, in the place the installer writes them, still ignored ---
  // This case is expected to FAIL-CLOSED and that is the point. `.claude/settings.json` is exactly
  // what `npx shapeup-sdlc init` produces, and a fresh clone — every CI checkout — is untrusted,
  // so the CLI discards the whole allow-list before any rule is consulted. The rules are right and
  // the harness still cannot dispatch. `bin/init.mjs` prints a warning at install time because of
  // this; if this case ever starts returning ALLOWED, the trust requirement has changed and that
  // warning is now lying to users.
  { label: "PIN project-scoped rules are ignored in an untrusted workspace (the CI case)",
    allow: RULES, layout: "proj-harness-plugin", projectScoped: true,
    command: (d) => `${q(d)} --slug demo`, expect: "DENIED" },
];

console.log(`\nexecuting-grant: ${CASES.length} cases against ${RULES.length} generated rules\n`);

if (!spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout) {
  console.error("SKIPPED LOUDLY: no `claude` binary on PATH — this guard proves nothing without it.");
  process.exit(2);
}

for (const c of CASES) {
  const got = runCase(c);
  if (got === "ERROR") {
    console.error(`\nSKIPPED LOUDLY: the CLI never reached the permission layer (auth?) on "${c.label}".`);
    process.exit(2);
  }
  if (got === c.expect) ok(`${c.label} -> ${got}`);
  else fail(`${c.label} -> ${got}, expected ${c.expect}`);
}

const stamp = {
  cli_version: (spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout || "").trim(),
  plugin_version: JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version,
  git_sha: (spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout || "").trim(),
  rules: RULES.length,
  cases: CASES.map((c) => ({ label: c.label, expect: c.expect })),
};
writeFileSync(join(ROOT, "tests/grant/last-verified.json"), JSON.stringify(stamp, null, 2) + "\n");

console.log(`\n${pass}/${CASES.length} passed`);
if (failures.length) { console.error(`\n${failures.length} FAILED`); process.exit(1); }
console.log("executing grant guard: PASS (evidence stamped to tests/grant/last-verified.json)");
