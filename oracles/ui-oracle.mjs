#!/usr/bin/env node
// `ui` oracle for the evaluation contract.
//
// Deliverable: a running web app. The oracle starts the server, drives a real browser through
// the **Playwright CLI**, and grades the OBSERVED accessibility tree — never the source.
//
// WHY THIS RUNNER EXISTS. `ui` is the DEFAULT oracle (a Test Surface row or an AC that omits the
// tag is treated as `ui`), and it was the only one in the registry with no runner behind it: the
// four others are deterministic Node processes proven against a negative control in CI, while
// `ui` was a prose loop an agent performed and then reported on. Three properties every other
// oracle has, that the default one did not:
//
//   • CITABLE — a T0 citation is a sha256 the evaluator recomputes from an artifact on disk. A
//     probe that exists only as an agent's narration has no artifact, so no `ui` evidence could
//     ever be cited the way `verify t0` requires of everything else.
//   • REPLAYABLE — the seesaw regression check re-runs FINISHED scopes' fixture COMMANDS. A prose
//     loop is not a command, so UI behaviour could regress without the ratchet being able to see
//     it: the one deliverable class where regressions are most visible to a user was the one
//     class the regression check structurally could not cover.
//   • NON-NEGOTIABLE — "assertions target affordances only (test_id/role/data-state), never
//     colour, font, spacing or pixel position" was a rule written in prose, addressed to the same
//     model the anti-leniency protocol exists to distrust. Here it is enforced by construction:
//     `validateCriterion` rejects any key outside the affordance grammar, so a styling assertion
//     cannot be expressed in a contract, let alone rationalised into one.
//
// NO CODEGEN. The driver spec below is written out verbatim — the contract travels to it as a
// JSON file plus two environment variables, never as interpolated source. A generated-source
// design would put contract text on the same channel as the code that grades it, which is the
// injection shape this repo refuses everywhere else.
//
// ZERO DEPENDENCIES, as everywhere in `oracles/`: this file imports nothing but `node:` builtins
// and the shared grammar. Playwright is the CONSUMER's tool, invoked as a subprocess through
// whichever CLI their project already has — it is never a dependency of the plugin, and this
// oracle never installs one.
//
// Contract shape:
//   { "oracle": "ui",
//     "server": { "cmd": "node ./server.mjs", "ready_path": "/", "ready_timeout_ms": 6000 },
//     "criteria": [
//       { "id": "U1", "desc": "counter starts at zero",
//         "probe": { "path": "/" },
//         "expect": { "testid": "count", "text": "/^0$/" } },
//       { "id": "U2", "desc": "increment advances the count and marks the field dirty",
//         "probe": { "path": "/", "steps": [ { "click": "inc" } ] },
//         "expect": { "testid": "count", "text": "/^1$/", "data_state": "dirty",
//                     "console_clean": true } },
//       { "id": "U3", "desc": "no export affordance exists (pitch no-go)",
//         "probe": { "path": "/" },
//         "expect": { "testid": "export", "absent": true } } ] }
//
// The server is spawned with env.PORT set to a free port the runner picks, exactly as the `http`
// oracle does, so the same fixtures work under both.
//
// Library use:  const { fails, results } = await runContract({ server, criteria })
// CLI use:      node ui-oracle.mjs <contract.json> ["override server command"]
//               exit 0 = all PASS, 1 = ≥1 FAIL, 2 = usage/contract error.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { formatReport, freePort, waitForHttp } from "./_shared.mjs";
import { isMain } from "../kernel/lib/argv.mjs";
import { localDir } from "../kernel/lib/paths.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERE = dirname(fileURLToPath(import.meta.url));

/** The one message a missing browser toolchain must produce, wherever it is detected. */
export const INSTALL_HINT =
  "install it in the project under test: `npm i -D @playwright/test && npx playwright install chromium`";

// --- the affordance grammar --------------------------------------------------------------
//
// These two allow-lists ARE the "affordance-only" hard rule. Grading a colour or a pixel box
// would resurrect the frozen styling layer through the judge, so the vocabulary simply has no
// word for it: `color`, `css`, `screenshot`, `bounding_box` are not rejected by a special case,
// they are absent from the language.

/** Keys a criterion's `expect` may carry. */
export const EXPECT_KEYS = new Set([
  "testid", "role", "name",     // which affordance
  "state",                      // visible | hidden | enabled | disabled
  "data_state",                 // the element's data-state attribute
  "text",                       // /regex/ or literal, matched against the element's text
  "absent",                     // true → the affordance must not exist (no-go breach probe)
  "url",                        // /regex/ matched against the page URL
  "console_clean",              // true → no console error / pageerror during the probe
]);

/** Keys a `probe.steps[]` entry may carry. */
export const STEP_KEYS = new Set([
  "click", "click_role", "name", // click by test id, or by role+accessible name
  "fill", "value",               // type into a field addressed by test id
  "press", "key",                // send a key to a field addressed by test id
  "wait_for",                    // wait until a test id is visible
]);

/**
 * Reject anything outside the affordance grammar, naming the offending key.
 *
 * A contract is authored by a model; an unknown key is far more likely to be a styling assertion
 * it invented than a typo, and either way silently ignoring it would grade a criterion the author
 * believes is being checked. Both cases are contract errors, not FAILs — the criterion never ran.
 *
 * @param {object} criterion - One `{id, desc, probe, expect}` row.
 * @returns {string|null} The reason it is invalid, or null when it conforms.
 */
export function validateCriterion(criterion) {
  const e = criterion.expect || {};
  for (const k of Object.keys(e)) {
    if (!EXPECT_KEYS.has(k)) {
      return `expect.${k} is not in the affordance grammar (allowed: ${[...EXPECT_KEYS].join(", ")}). ` +
        "UI grading targets affordances only — test id, role, data-state, text, presence.";
    }
  }
  if (!e.testid && !e.role && e.url === undefined && e.console_clean === undefined) {
    return "expect must address an affordance (testid or role), a url, or console_clean";
  }
  if (e.absent && (e.state || e.data_state || e.text)) {
    return "expect.absent cannot be combined with state/data_state/text — an absent element has none";
  }
  for (const [i, step] of (criterion.probe?.steps || []).entries()) {
    for (const k of Object.keys(step)) {
      if (!STEP_KEYS.has(k)) {
        return `probe.steps[${i}].${k} is not a known step (allowed: ${[...STEP_KEYS].join(", ")})`;
      }
    }
  }
  return null;
}

// --- the Playwright CLI seam -------------------------------------------------------------

/**
 * Locate the Playwright CLI the project under test already has.
 *
 * Project-local `node_modules/.bin/playwright` first, because that is the version whose
 * `@playwright/test` the generated spec will import; `npx --no-install` second, which resolves a
 * hoisted or globally-linked install. `--no-install` is deliberate and load-bearing: the oracle
 * must never reach the network mid-eval, and a browser toolchain silently installed under a
 * grading run is a side effect the operator did not approve.
 *
 * @param {string} cwd - Project root of the deliverable under test.
 * @returns {{cmd: string, args: string[], source: string}|null} Null when no CLI answers.
 */
export function resolveCli(cwd) {
  const local = join(cwd, "node_modules", ".bin", "playwright");
  const candidates = existsSync(local)
    ? [{ cmd: local, args: [], source: "node_modules/.bin/playwright" }]
    : [];
  candidates.push({ cmd: "npx", args: ["--no-install", "playwright"], source: "npx --no-install playwright" });
  for (const c of candidates) {
    const r = spawnSync(c.cmd, [...c.args, "--version"], { encoding: "utf8", cwd, timeout: 30_000 });
    if (r.status === 0) return { ...c, version: (r.stdout || "").trim() };
  }
  return null;
}

// The driver spec, written out byte-for-byte. It reads the contract from a file whose path
// arrives in the environment, so no contract text is ever interpolated into executable source.
const DRIVER_SPEC = `// GENERATED by oracles/ui-oracle.mjs — do not edit; rewritten on every run.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const { toRegExp } = await import(process.env.UI_ORACLE_SHARED);
const contract = JSON.parse(readFileSync(process.env.UI_ORACLE_CONTRACT, "utf8"));
const BASE = process.env.UI_ORACLE_BASE;

function target(page, sel) {
  if (sel.testid) return page.getByTestId(sel.testid);
  return page.getByRole(sel.role, sel.name ? { name: sel.name } : undefined);
}

for (const c of contract.criteria) {
  test(c.id, async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e && e.message ? e.message : e)));

    await page.goto(BASE + ((c.probe && c.probe.path) || "/"));

    for (const step of (c.probe && c.probe.steps) || []) {
      if (step.click !== undefined) await target(page, { testid: step.click }).click();
      else if (step.click_role !== undefined) await target(page, { role: step.click_role, name: step.name }).click();
      else if (step.fill !== undefined) await target(page, { testid: step.fill }).fill(String(step.value ?? ""));
      else if (step.press !== undefined) await target(page, { testid: step.press }).press(step.key || "Enter");
      else if (step.wait_for !== undefined) await expect(target(page, { testid: step.wait_for })).toBeVisible();
    }

    const e = c.expect || {};
    const addressed = e.testid !== undefined || e.role !== undefined;
    if (addressed) {
      const el = target(page, e);
      if (e.absent) {
        await expect(el).toHaveCount(0);
      } else {
        if (e.state === "hidden") await expect(el).toBeHidden();
        else if (e.state === "enabled") await expect(el).toBeEnabled();
        else if (e.state === "disabled") await expect(el).toBeDisabled();
        else await expect(el).toBeVisible();
        if (e.data_state !== undefined) await expect(el).toHaveAttribute("data-state", e.data_state);
        if (e.text !== undefined) await expect(el).toHaveText(toRegExp(e.text));
      }
    }
    if (e.url !== undefined) await expect(page).toHaveURL(toRegExp(e.url));
    if (e.console_clean) expect(consoleErrors, "console errors during probe").toEqual([]);
  });
}
`;

// The config, likewise verbatim. A testDir of "." resolves against the config file's own
// directory, so the workspace path never has to be interpolated either.
const DRIVER_CONFIG = `// GENERATED by oracles/ui-oracle.mjs — do not edit; rewritten on every run.
export default {
  testDir: ".",
  testMatch: ["ui-oracle.spec.mjs"],
  reporter: [["json"]],
  workers: 1,
  retries: 0,
  fullyParallel: false,
  timeout: Number(process.env.UI_ORACLE_TIMEOUT_MS || 15000),
  outputDir: "./test-results",
  use: { headless: true },
};
`;

/**
 * Write the run workspace (driver spec, config, contract) and return its paths.
 *
 * The workspace lives under the project's GITIGNORED local tier rather than a system temp dir for
 * one hard reason: the generated spec imports `@playwright/test`, and Node resolves that by
 * walking parent directories — from `/tmp` it would never reach the project's `node_modules`.
 * It doubles as the evidence trail, which is why it is left on disk rather than cleaned up.
 *
 * @param {string} cwd - Project root of the deliverable under test.
 * @param {object} contract - `{criteria}` as handed to `runContract`.
 * @param {string} [workdir] - Override for the workspace directory.
 * @returns {{dir: string, config: string, contract: string}} Absolute paths.
 */
export function writeWorkspace(cwd, contract, workdir) {
  const dir = workdir || join(localDir(cwd), ".ui-oracle");
  mkdirSync(dir, { recursive: true });
  const specPath = join(dir, "ui-oracle.spec.mjs");
  const configPath = join(dir, "ui-oracle.config.mjs");
  const contractPath = join(dir, "contract.json");
  writeFileSync(specPath, DRIVER_SPEC);
  writeFileSync(configPath, DRIVER_CONFIG);
  writeFileSync(contractPath, JSON.stringify(contract, null, 2));
  return { dir, config: configPath, contract: contractPath };
}

/**
 * Turn the Playwright JSON report into this registry's `{id, pass, evidence}` rows.
 *
 * A criterion the report never mentions is a FAIL, not a missing row: the suite is generated one
 * test per criterion, so a silent disappearance means the file failed to load or the run died —
 * both "no evidence", both FAIL.
 *
 * @param {object|null} report - Parsed Playwright JSON report, or null when stdout did not parse.
 * @param {Array<object>} criteria - The criteria the run was asked to grade.
 * @param {string} [rawTail] - Trailing output to cite when the report is unusable.
 * @returns {{fails: number, results: Array<object>}} The oracle contract's return shape.
 */
export function parseReport(report, criteria, rawTail = "") {
  const byId = new Map();
  for (const suite of report?.suites || []) {
    for (const spec of collectSpecs(suite)) {
      const result = spec.tests?.[0]?.results?.[0] || {};
      byId.set(spec.title, {
        pass: spec.ok === true && result.status === "passed",
        status: result.status || "unknown",
        error: (result.error?.message || "").replace(/\u001b\[[0-9;]*m/g, "").split("\n").slice(0, 4).join(" ").trim(),
      });
    }
  }
  // Load-time errors (a missing `@playwright/test`, a syntax error, "No tests found") never
  // reach a per-spec row; they are the whole story, so they become every criterion's evidence.
  const loadErrors = (report?.errors || [])
    .map((e) => (e.message || "").replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0].trim())
    .filter(Boolean);

  const results = [];
  let fails = 0;
  for (const c of criteria) {
    const hit = byId.get(c.id);
    let row;
    if (hit) {
      row = { id: c.id, desc: c.desc, pass: hit.pass, evidence: hit.pass ? `probe ${hit.status}` : `probe ${hit.status}: ${hit.error || "no message"}` };
    } else {
      const why = loadErrors.length ? loadErrors.join(" | ") : rawTail.slice(0, 200) || "the suite produced no result for this criterion";
      row = { id: c.id, desc: c.desc, pass: false, evidence: `NO EVIDENCE — ${why}` };
    }
    if (!row.pass) fails++;
    results.push(row);
  }
  return { fails, results };
}

/** Flatten Playwright's nested suite tree into its specs. */
function collectSpecs(suite) {
  const out = [...(suite.specs || [])];
  for (const child of suite.suites || []) out.push(...collectSpecs(child));
  return out;
}

/** Every criterion FAILs with one shared reason — the "absence of evidence" shape. */
function failAll(criteria, reason) {
  return { fails: criteria.length, results: criteria.map((c) => ({ id: c.id, desc: c.desc, pass: false, evidence: reason })) };
}

/**
 * Grade a `ui` contract by driving the running app through the Playwright CLI.
 *
 * @param {object} args - The contract.
 * @param {object} args.server - `{cmd, ready_path, ready_timeout_ms, cwd, env}` for the app.
 * @param {Array<object>} args.criteria - `{id, desc, probe, expect}` rows.
 * @param {string} [args.browser] - chromium (default) | firefox | webkit.
 * @param {string} [args.cwd] - Project root; where the Playwright CLI is resolved from.
 * @param {string} [args.workdir] - Override for the generated workspace directory.
 * @returns {Promise<{fails: number, results: Array<object>}>} One verdict per criterion.
 */
export async function runContract({ server, criteria, browser, cwd, workdir }) {
  const root = resolve(cwd || process.cwd());

  // Contract errors first: a criterion outside the affordance grammar never ran, so it cannot be
  // graded, and reporting it as a behavioural FAIL would send a generator to fix the wrong thing.
  const invalid = criteria.map((c) => [c, validateCriterion(c)]).filter(([, why]) => why);
  if (invalid.length) {
    return failAll(criteria, `contract error — ${invalid.map(([c, why]) => `${c.id}: ${why}`).join(" | ")}`);
  }

  // Preflight, at the moment a `ui` criterion is actually graded — never at install time, and
  // never auto-installed. A missing browser toolchain FAILs the probe, it does not skip it.
  const cli = resolveCli(root);
  if (!cli) {
    return failAll(criteria, `NO EVIDENCE — the Playwright CLI is not available from ${root}; ${INSTALL_HINT}`);
  }

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const [bin, ...args] = String(server.cmd).split(/\s+/).filter(Boolean);
  const child = spawn(bin, args, {
    env: { ...process.env, ...(server.env || {}), PORT: String(port) },
    cwd: server.cwd || root,
    stdio: ["ignore", "ignore", "ignore"],
  });

  try {
    const up = await waitForHttp(base, server.ready_path || "/", server.ready_timeout_ms || 6000);
    if (!up) {
      // Same rule the `http` oracle applies: an app you cannot reach does not pass. The evaluator's
      // own doctrine calls this a critical bug ("app does not start with the stated run command"),
      // not an untestable criterion.
      return failAll(criteria, `app never became reachable at ${base}${server.ready_path || "/"} within ${server.ready_timeout_ms || 6000}ms`);
    }

    const ws = writeWorkspace(root, { criteria }, workdir);
    const run = spawnSync(cli.cmd, [...cli.args, "test", "-c", ws.config, "--browser", browser || "chromium"], {
      encoding: "utf8",
      cwd: root,
      timeout: 300_000,
      env: {
        ...process.env,
        // Plain-text output at the source: an ANSI escape in an `evidence` string travels into the
        // EVAL report and the WorkResult envelope. The strip in `parseReport` stays as a fallback
        // for a runner that ignores this.
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        UI_ORACLE_CONTRACT: ws.contract,
        UI_ORACLE_BASE: base,
        UI_ORACLE_SHARED: join(HERE, "_shared.mjs"),
      },
    });

    const stdout = run.stdout || "";
    let report = null;
    try { report = JSON.parse(stdout.slice(stdout.indexOf("{"))); } catch { /* handled below */ }
    if (!report) {
      const tail = ((run.stderr || "") + stdout).trim().split("\n").slice(-3).join(" ").slice(0, 300);
      return failAll(criteria, `NO EVIDENCE — the Playwright CLI produced no JSON report (${tail || run.error?.message || "no output"}); ${INSTALL_HINT}`);
    }
    const summary = parseReport(report, criteria, (run.stderr || "").trim());
    // A browser binary that was never downloaded surfaces per-spec, not as a load error. It is
    // still a toolchain gap rather than a defect in the deliverable, so it carries the fix.
    if (summary.fails === criteria.length && summary.results.every((r) => /Executable doesn't exist|browserType\.launch/i.test(r.evidence))) {
      return failAll(criteria, `NO EVIDENCE — the browser binary is missing; ${INSTALL_HINT}`);
    }
    return summary;
  } finally {
    child.kill("SIGTERM");
    await sleep(100);
    if (!child.killed) { try { child.kill("SIGKILL"); } catch { /* already gone */ } }
  }
}

export { formatReport };

// --- CLI entry ---------------------------------------------------------------
if (isMain(import.meta.url)) {
  const contractPath = process.argv[2];
  const overrideCmd = process.argv[3];
  if (!contractPath) {
    console.error('usage: node ui-oracle.mjs <contract.json> ["override server command"]');
    process.exit(2);
  }
  let contract;
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); }
  catch (e) { console.error(`cannot read contract ${contractPath}: ${e.message}`); process.exit(2); }
  if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
    console.error(`contract ${contractPath} has no criteria[]`); process.exit(2);
  }
  const server = { ...(contract.server || {}) };
  if (overrideCmd) server.cmd = overrideCmd;
  if (!server.cmd) { console.error(`contract ${contractPath} has no server.cmd`); process.exit(2); }
  const summary = await runContract({ server, criteria: contract.criteria, browser: contract.browser });
  console.log(formatReport(`ui oracle: ${contractPath}`, summary));
  process.exit(summary.fails === 0 ? 0 : 1);
}
