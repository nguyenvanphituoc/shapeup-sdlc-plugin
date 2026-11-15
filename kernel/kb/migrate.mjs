#!/usr/bin/env node
// harness kb migrate — split the old one-file-per-reader knowledge base into one file per rule.
//
//   harness.mjs kb migrate [--cwd <dir>]
//
// Idempotent, and it never deletes or edits an old file: a rule whose old id is already an alias of a
// rule file is skipped. Exit 0 done · 2 malformed input.
import { resolve } from "node:path";
import { runArgs } from "../core/argv.mjs";
import { migrateRules } from "../shapeup/kb.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb migrate [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  cwd: { type: "path" },
};

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const r = migrateRules(resolve(args.cwd || process.cwd()));
  console.log(JSON.stringify({ ok: true, created: r.created, already_present: r.skipped }));
  process.exit(0);
}
