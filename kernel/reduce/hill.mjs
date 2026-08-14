#!/usr/bin/env node
// Hill Phase Derivation — phases are derived from facts, never authored
// Mechanical derivation of a scope's hill position based on facts (T0 verdicts, T1 evaluation, and discovery ledger).
// Writes to shapeup/<slug>/hill/<scope-id>.yml

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { scopesDir, hillDir, verdictsDir, evaluationDir, discoveryLedger } from "../lib/paths.mjs";
import { readAllContracts, SCOPE_CONTRACT } from "../lib/contract.mjs";

/**
 * Derive and write the hill phase for all scopes mechanically based on T0, T1, and ledger facts.
 * 
 * The derived phase follows these progression rules (facts move dots, not authors):
 * - UPHILL_UNKNOWN: open unknowns > 0 in the ledger for this scope
 * - UPHILL_SOLVED: unknowns 0, no T0-green yet
 * - DOWNHILL_EXECUTION: ≥1 T0-green; T1/seesaw pending
 * - FINISHED: T1 PASS ∧ seesaw green
 *
 * @param {string} cwd - The project root directory.
 * @param {string} slug - The feature slug being built.
 * @returns {Array<{scope_id: string, phase: string, changed: boolean}>} A report of all scopes processed, their derived phase, and whether the hill shard on disk was modified.
 *   Side effects: writes to `shapeup/<slug>/hill/<scope-id>.yml` for each scope.
 */
export function deriveHill(cwd, slug) {
  const scopes = readAllContracts(scopesDir(cwd, slug), SCOPE_CONTRACT).map((x) => x.contract);
  const vDir = verdictsDir(cwd, slug);
  const evalDir = evaluationDir(cwd, slug);
  const ledgerPath = discoveryLedger(cwd, slug);
  const hDir = hillDir(cwd, slug);
  
  if (!existsSync(hDir)) mkdirSync(hDir, { recursive: true });
  
  // 1. Check if T1 Evaluation passed (spec-conformance === PASS for the most recent run)
  let t1Pass = false;
  const evalFile = join(evalDir, ".verdicts-run.jsonl");
  if (existsSync(evalFile)) {
    const lines = readFileSync(evalFile, "utf8").trim().split(/\n/).filter(Boolean);
    let maxRun = 0;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.run >= maxRun) {
          maxRun = parsed.run;
          if (parsed.dimension === "spec-conformance") {
            t1Pass = (parsed.verdict === "PASS");
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  // 2. T0 facts per scope: has it achieved a green overall verdict? was seesaw also green?
  const t0Facts = {};
  if (existsSync(vDir)) {
    for (const f of readdirSync(vDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const b = JSON.parse(readFileSync(join(vDir, f), "utf8"));
        if (!t0Facts[b.scope_id]) t0Facts[b.scope_id] = { hasGreen: false, seesawGreen: false };
        if (b.overall === "green") {
          t0Facts[b.scope_id].hasGreen = true;
          // If regression is false on a green T0, it means seesaw was also green
          if (b.regression === false) {
            t0Facts[b.scope_id].seesawGreen = true;
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
  
  // 3. Ledger unknowns per scope
  const scopeUnknowns = {};
  if (existsSync(ledgerPath)) {
    const lines = readFileSync(ledgerPath, "utf8").split("\n");
    let currentScope = null;
    for (const line of lines) {
      const m = line.match(/^## Discovered — .*?:([\w.-]+)-a\d+/);
      if (m) {
        currentScope = m[1];
      }
      if (currentScope && line.startsWith("~ ")) {
        scopeUnknowns[currentScope] = (scopeUnknowns[currentScope] || 0) + 1;
      }
    }
  }
  
  const report = [];
  for (const s of scopes) {
    const id = s.scope_id;
    const t0 = t0Facts[id] || { hasGreen: false, seesawGreen: false };
    const unknowns = scopeUnknowns[id] || 0;
    
    let phase = "UPHILL_UNKNOWN";
    if (t1Pass && t0.hasGreen && t0.seesawGreen) {
      phase = "FINISHED";
    } else if (t0.hasGreen) {
      phase = "DOWNHILL_EXECUTION";
    } else if (unknowns === 0) {
      phase = "UPHILL_SOLVED";
    }
    
    const yaml = `scope_id: ${id}\nphase: ${phase}\n`;
    const out = join(hDir, `${id}.yml`);
    let changed = false;
    if (!existsSync(out) || readFileSync(out, "utf8") !== yaml) {
      writeFileSync(out, yaml);
      changed = true;
    }
    report.push({ scope_id: id, phase, changed });
  }
  return report;
}

export const ARGV_SPEC = {
  usage: "harness.mjs reduce hill --slug <slug> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
};

/**
 * Derive each scope's hill phase from its T0 and evaluation artifacts.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {(Promise<void>|void)} Settles when the subcommand has written its output; most paths
 *   call `process.exit()` with the subcommand's documented code rather than returning.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const report = deriveHill(cwd, args.slug);
  console.log(JSON.stringify(report, null, 2));
}
