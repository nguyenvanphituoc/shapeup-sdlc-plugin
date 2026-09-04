// verify oracle — run a registered evaluation oracle against a contract and grade the result.
//
// CONTRACT. Reads `<contract>.json`, dispatches it through `oracles/index.mjs`, prints the shared
// PASS/FAIL report and exits 0 when every criterion passes, 1 when any FAILs, 2 on malformed
// input. Writes nothing outside whatever the oracle itself needs (the `ui` oracle keeps a run
// workspace under the local tier; the others write nothing at all).
//
// WHY IT IS A SUBCOMMAND. Every oracle already had a `node <name>-oracle.mjs <contract>` entry
// point, and every one of them was outside the permission grant, which covers exactly one
// executable. Interactively that costs an approval prompt nobody minds; in an unattended run it
// is fatal in the same way the kernel's own header describes — the evaluator cannot take the step
// and improvises a verdict from a source read instead, which is precisely the substitution the
// anti-leniency protocol exists to prevent. Routing the registry through the granted entry point
// makes "run the oracle" a step a headless run can actually take. Subcommands are free; entry
// points are not.
//
// WHY IT DISPATCHES INSTEAD OF REIMPLEMENTING. The registry is the source of truth for which
// oracles exist. A second switch here would be a second list to forget, which is the drift the
// registry's own comment warns about.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { runOracle, ORACLE_NAMES } from "../../oracles/index.mjs";
import { formatReport } from "../../oracles/_shared.mjs";

/**
 * Build the argument object one oracle runner expects from a parsed contract.
 *
 * Each runner takes a different shape — `process`/`test` want a default command, `http`/`ui` want
 * a `server` block — so the contract carries all of them and this picks out the ones that runner
 * reads. Overrides from the command line win, which is how the structural fixtures point the same
 * contract at a correct build and at a negative control.
 *
 * @param {string} oracle - The registry key.
 * @param {object} contract - The parsed contract file.
 * @param {{serverCmd?: string, cmd?: string, cwd?: string, browser?: string}} overrides - CLI flags.
 * @returns {object} The argument object for `runOracle`.
 */
export function buildArgs(oracle, contract, overrides = {}) {
  const args = { criteria: contract.criteria };
  if (oracle === "http" || oracle === "ui") {
    args.server = { ...(contract.server || {}) };
    if (overrides.serverCmd) args.server.cmd = overrides.serverCmd;
    if (overrides.cwd) args.server.cwd = overrides.cwd;
  } else {
    args.cmd = overrides.cmd || contract.cmd;
    if (overrides.cwd) args.cwd = overrides.cwd;
  }
  if (oracle === "ui") {
    args.browser = overrides.browser || contract.browser;
    args.cwd = overrides.cwd || process.cwd();
  }
  return args;
}

export const ARGV_SPEC = {
  usage: 'harness.mjs verify oracle --contract <path> [--oracle <name>] [--server-cmd "<cmd>"] [--cmd "<cmd>"] [--browser <engine>] [--cwd <dir>]',
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  contract: { type: "path", required: true },
  oracle: { type: "enum", values: ORACLE_NAMES },
  "server-cmd": { type: "str" },
  cmd: { type: "str" },
  browser: { type: "str" },
  cwd: { type: "path" },
  json: { type: "flag" },
};

/**
 * Grade one evaluation contract with its oracle.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {Promise<void>} Exits 0 when every criterion PASSes, 1 when any FAILs.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const contractPath = resolve(args.contract);

  let contract;
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); }
  catch (e) { console.error(`  ✗ verify oracle: cannot read contract ${contractPath}: ${e.message}`); process.exit(2); }

  // `ui` is the documented default for a contract that names no oracle, matching the Test Surface
  // rule that an untagged row is a web-app row.
  const oracle = args.oracle || contract.oracle || "ui";
  if (!ORACLE_NAMES.includes(oracle)) {
    console.error(`  ✗ verify oracle: unknown oracle "${oracle}" (known: ${ORACLE_NAMES.join(", ")})`);
    process.exit(2);
  }
  if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
    console.error(`  ✗ verify oracle: contract ${contractPath} has no criteria[]`);
    process.exit(2);
  }

  const summary = await runOracle(oracle, buildArgs(oracle, contract, {
    serverCmd: args.serverCmd, cmd: args.cmd, cwd: args.cwd, browser: args.browser,
  }));

  if (args.json) console.log(JSON.stringify({ oracle, contract: contractPath, ...summary }, null, 2));
  else console.log(formatReport(`${oracle} oracle: ${contractPath}`, summary));
  process.exit(summary.fails === 0 ? 0 : 1);
}
