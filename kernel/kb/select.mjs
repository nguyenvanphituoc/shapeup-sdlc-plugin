#!/usr/bin/env node
// harness kb select — show what an order would load, without opening it.
//
//   harness.mjs kb select --reader <reader> [--operation <op>] [--step <step>] [--gate <id>] [--archetype <a>] [--signal <s>]… [--budget N] [--cwd <dir>]
//
// Writes nothing. Exit 0 · 2 malformed input.
import { resolve } from "node:path";
import { runArgs } from "../core/argv.mjs";
import { selectRules, READERS, DEFAULT_BUDGET } from "../shapeup/kb.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb select --reader <reader> [--operation <op>] [--step <step>] [--gate <id>] [--archetype <a>] [--signal <s>]… [--budget N]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  reader: { type: "enum", values: Object.keys(READERS), required: true },
  operation: { type: "str" }, step: { type: "str" }, gate: { type: "str" }, archetype: { type: "str" },
  signal: { type: "str", multiple: true },
  budget: { type: "int", min: 1 },
  cwd: { type: "path" },
};

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const facts = {};
  for (const k of ["operation", "step", "gate", "archetype"]) if (args[k]) facts[k] = [args[k]];
  if (args.signal) facts.signal = [].concat(args.signal);
  const c = selectRules({ cwd: resolve(args.cwd || process.cwd()), reader: args.reader, facts, budget: args.budget ?? DEFAULT_BUDGET });
  console.log(JSON.stringify({ ok: true, load_set: c.load_set, over_budget: c.over_budget, checks: c.checks, asks: c.asks, text: c.text }, null, 2));
  process.exit(0);
}
