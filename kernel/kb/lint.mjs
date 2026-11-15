#!/usr/bin/env node
// harness kb lint — read the rule table and refuse what would load wrong.
//
//   harness.mjs kb lint [--cwd <dir>]
//
// Exit 0 clean (also when the project has no rule table) · 1 problems, one per line, each naming its file
// and the change · 2 malformed input.
import { resolve } from "node:path";
import { runArgs } from "../core/argv.mjs";
import { lintRules } from "../shapeup/kb.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb lint [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
};

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const problems = lintRules(cwd);
  for (const p of problems) console.error(`✋ kb lint: ${p.file} [${p.rule}] ${p.message}`);
  console.log(JSON.stringify({ ok: problems.length === 0, problems: problems.length }));
  process.exit(problems.length ? 1 : 0);
}
