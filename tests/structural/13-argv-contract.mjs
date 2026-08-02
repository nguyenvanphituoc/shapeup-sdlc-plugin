// Structural test module: the typed argv boundary (Day-2 leg 1).
//
// THE DEFECT THIS MODULE EXISTS FOR, reproduced against the shipped script.
//
//     $ t0-verify.mjs contract.json --round --attempt 1
//     { "path": "t0/verdicts/rNaN-a1.json", "overall": "green", ... }      exit=0
//
// `out.round = Number(argv[++i])` with no validation, then `args.round ?? 1` — which does not
// catch `NaN`. A flag passed without a value wrote a REAL verdict artifact to a nonsense address
// and exited 0. The orchestrator then looks for `r1-a1.json`, finds nothing, and the evaluator's
// mandatory T0 citation cannot resolve. A green verdict nobody can look up.
//
// The envelope boundary is rigorously typed and hook-validated in both directions; that discipline
// stopped dead at `process.argv`, which is where the pipeline actually executes.
//
// WHAT THIS MODULE ASSERTS, by EXECUTING each entry point rather than reading its source:
//
//   1. Every entry point declares an `ARGV_SPEC`. That is what makes the contract inspectable —
//      a test cannot check a parser it has to guess the shape of.
//   2. For every INT/NUM flag in that spec: `--flag` with no value, and `--flag abc`, both exit 2
//      with a machine-readable reason on stderr. Not exit 0, and not a written artifact.
//   3. A rejected parse writes NOTHING. The parser runs before any I/O, so a bad invocation
//      cannot leave a half-built artifact behind for a later step to cite.
//   4. An unknown flag is rejected rather than silently swallowed as a positional — a typo'd
//      `--rounds 2` landing in `_` is the same defect wearing a different hat.

import { existsSync, mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Every skill-local entry point, discovered from the filesystem rather than listed by hand. */
function entryPoints(ROOT) {
  const out = [];
  const skillsDir = join(ROOT, "skills");
  for (const skill of readdirSync(skillsDir)) {
    const scripts = join(skillsDir, skill, "scripts");
    if (!existsSync(scripts)) continue;
    for (const f of readdirSync(scripts)) {
      if (f.endsWith(".mjs")) out.push({ rel: `skills/${skill}/scripts/${f}`, abs: join(scripts, f) });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Run the structural checks for the argv contract.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("42. The argv boundary is typed: a malformed flag is rejected before anything runs");
  // =============================================================================
  const eps = entryPoints(ROOT);
  if (eps.length < 15) fail(`expected ≥15 skill-local entry points, found ${eps.length}`);
  else ok(`${eps.length} skill-local entry points discovered`);

  let specced = 0;
  let numericChecked = 0;

  for (const { rel, abs } of eps) {
    let mod;
    try { mod = await import(abs); }
    catch (e) { fail(`${rel} cannot be imported: ${e.message}`); continue; }

    const spec = mod.ARGV_SPEC;
    if (!spec || typeof spec !== "object") {
      fail(`${rel} declares no ARGV_SPEC — its argv contract cannot be inspected or enforced`);
      continue;
    }
    specced++;

    // A scratch cwd per entry point: a rejected parse must leave it EMPTY. This is the assertion
    // the reproduced defect fails — it wrote `rNaN-a1.json` and exited 0.
    const numeric = Object.entries(spec).filter(([k, d]) => k !== "_" && k !== "usage" && (d.type === "int" || d.type === "num"));
    if (numeric.length === 0) continue;

    const sandbox = mkdtempSync(join(tmpdir(), "argv-"));
    try {
      // A plausible positional operand, so the rejection is provably about the FLAG and not
      // about a missing operand the script would have complained about anyway.
      const operand = join(sandbox, "operand.json");
      writeFileSync(operand, JSON.stringify({ scope_id: "SC-01", e2e_verification_fixtures: [] }));

      for (const [flagName, def] of numeric) {
        const cases = [
          { label: "no value (next token is another flag)", argv: [`--${flagName}`, "--cwd", sandbox, operand] },
          { label: "non-numeric value", argv: [`--${flagName}`, "abc", "--cwd", sandbox, operand] },
          { label: "no value at end of argv", argv: [operand, "--cwd", sandbox, `--${flagName}`] },
        ];
        if (def.min !== undefined) {
          cases.push({ label: `below min (${def.min})`, argv: [`--${flagName}`, String(def.min - 1), "--cwd", sandbox, operand] });
        }
        for (const c of cases) {
          const r = spawnSync(process.execPath, [abs, ...c.argv], { cwd: sandbox, encoding: "utf8", timeout: 30_000 });
          numericChecked++;
          if (r.status !== 2) {
            fail(`${rel} --${flagName} ${c.label}: exit ${r.status}, expected 2 (this is the rNaN defect)`);
            continue;
          }
          const stderr = (r.stderr || "").trim();
          if (!stderr) { fail(`${rel} --${flagName} ${c.label}: exit 2 but stderr was empty — the reason must be machine-readable`); continue; }
          let detail;
          try { detail = JSON.parse(stderr.split("\n")[0]); }
          catch { fail(`${rel} --${flagName} ${c.label}: stderr's first line is not JSON: ${stderr.slice(0, 80)}`); continue; }
          if (!detail.error || !detail.flag) fail(`${rel} --${flagName} ${c.label}: rejection record lacks error/flag: ${stderr.slice(0, 80)}`);
        }
      }

      // The rejected parses above must have written nothing beyond the operand we seeded.
      const leftover = readdirSync(sandbox).filter((f) => f !== "operand.json");
      if (leftover.length === 0) ok(`${rel} writes no artifact on a rejected parse (${numeric.length} numeric flag(s) exercised)`);
      else fail(`${rel} wrote ${leftover.join(", ")} despite a rejected parse — a bad invocation must not leave evidence behind`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }

  if (specced === eps.length) ok(`all ${specced} entry points declare an inspectable ARGV_SPEC`);
  if (numericChecked > 0) ok(`${numericChecked} malformed numeric-flag invocations all exited 2 with a machine-readable reason`);
  else fail("no numeric flag was exercised — the argv contract is untested");

  // NAMED ANCHORS. The loop above only exercises flags a spec DECLARES as int/num, so relaxing a
  // type to `str` would silently blind it — the coverage would quietly follow the defect. These
  // are the flags the reproduced failure actually ran through, pinned by name so the type cannot
  // be downgraded without a test failure.
  const ANCHORS = [
    ["skills/tech-lead/scripts/t0-verify.mjs", "round", { type: "int", min: 1, required: true }],
    ["skills/tech-lead/scripts/t0-verify.mjs", "attempt", { type: "int", min: 1, required: true }],
    ["skills/tech-lead/scripts/compile-order.mjs", "round", { type: "int", min: 1 }],
    ["skills/tech-lead/scripts/compile-order.mjs", "attempt", { type: "int", min: 1 }],
  ];
  for (const [rel, flagName, want] of ANCHORS) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) { fail(`anchor file missing: ${rel}`); continue; }
    const spec = (await import(abs)).ARGV_SPEC || {};
    const got = spec[flagName];
    if (!got) { fail(`${rel} no longer declares --${flagName} — the rNaN defect's own flag is untyped`); continue; }
    const drift = Object.entries(want).filter(([k, v]) => got[k] !== v);
    if (drift.length === 0) ok(`${rel} --${flagName} stays ${want.type}${want.min !== undefined ? ` ≥ ${want.min}` : ""}${want.required ? " (required)" : ""}`);
    else fail(`${rel} --${flagName} drifted: ${drift.map(([k, v]) => `${k} expected ${v}, got ${got[k]}`).join("; ")}`);
  }

  // Unknown flags: rejected, not silently absorbed as positionals.
  const t0 = join(ROOT, "skills/tech-lead/scripts/t0-verify.mjs");
  if (existsSync(t0)) {
    const sandbox = mkdtempSync(join(tmpdir(), "argv-unknown-"));
    try {
      const operand = join(sandbox, "c.json");
      writeFileSync(operand, JSON.stringify({ scope_id: "SC-01", e2e_verification_fixtures: [] }));
      const r = spawnSync(process.execPath, [t0, operand, "--round", "1", "--attempt", "1", "--rounds", "2"], { cwd: sandbox, encoding: "utf8", timeout: 30_000 });
      if (r.status === 2 && /unknown_flag/.test(r.stderr || "")) ok("t0-verify rejects an unknown flag (--rounds) rather than absorbing it as a positional");
      else fail(`t0-verify accepted the typo'd --rounds: exit ${r.status}, stderr ${(r.stderr || "").slice(0, 80)}`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  }

  // The unit-level truth table for the parser itself, including the exact reproduced case.
  const { parseArgs, ArgvError } = await import(join(ROOT, "skills/tech-lead/scripts/lib/argv.mjs"));
  const SPEC = { _: { arity: 1, name: "contract" }, round: { type: "int", min: 1, required: true }, "no-seesaw": { type: "flag" } };
  const reject = (argv, wantError, label) => {
    try {
      parseArgs(SPEC, argv);
      fail(`parseArgs accepted ${JSON.stringify(argv)} — expected ${wantError} (${label})`);
    } catch (e) {
      if (!(e instanceof ArgvError)) fail(`parseArgs threw a non-ArgvError for ${JSON.stringify(argv)}: ${e.message}`);
      else if (e.detail.error !== wantError) fail(`parseArgs: ${label} — expected ${wantError}, got ${e.detail.error}`);
      else ok(`parseArgs rejects ${label} as ${wantError}`);
    }
  };
  // THE reproduced case: `--round --attempt 1` consumed the next FLAG as the value.
  reject(["c.json", "--round", "--no-seesaw"], "invalid_flag", "a flag whose value is another flag");
  reject(["c.json", "--round"], "missing_value", "a flag at the end of argv with no value");
  reject(["c.json", "--round", "abc"], "invalid_value", "a non-numeric int");
  reject(["c.json", "--round", "0"], "invalid_value", "an int below its declared minimum");
  reject(["c.json", "--round", "1.5"], "invalid_value", "a float where an int is declared");
  reject(["--round", "1"], "missing_operand", "a missing required positional");
  reject(["c.json", "--rounds", "1"], "unknown_flag", "an unknown flag");
  reject(["c.json"], "missing_required", "a missing required flag");

  const good = parseArgs(SPEC, ["c.json", "--round", "3", "--no-seesaw"]);
  if (good.round === 3 && good.noSeesaw === true && good._[0] === "c.json") ok("parseArgs coerces a valid argv, camelCasing flag names (--no-seesaw → noSeesaw)");
  else fail(`parseArgs mis-parsed a valid argv: ${JSON.stringify(good)}`);

  const eq = parseArgs(SPEC, ["c.json", "--round=4"]);
  if (eq.round === 4) ok("parseArgs accepts --flag=value as well as --flag value");
  else fail(`parseArgs did not handle --round=4: ${JSON.stringify(eq)}`);
}
