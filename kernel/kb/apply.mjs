#!/usr/bin/env node
// harness kb apply — write what the reflector proposed into the rule table, through the kernel.
//
//   harness.mjs kb apply --slug <slug> --delta <path> [--cwd <dir>]
//
// `--delta` is a JSON list of operations, each naming the verified candidate it rests on:
//   {"op":"ADD","from_candidate":"C1","body":"…","when":{…}}        a new rule, on probation
//   {"op":"EDIT","from_candidate":"C1","id":"te-…","body":"…"}      the same rule, said better
//   {"op":"MERGE","from_candidate":"C1","ids":["te-…","te-…"],"body":"…"}
//   {"op":"RETIRE","from_candidate":"C1","id":"te-…"}
//   {"op":"DEFECT","from_candidate":"C2","body":"…"}               an entry in the defect register
//
// It runs only while a `learn` order of this run is open, and keeps nothing that leaves the table failing
// lint. Exit 0 applied · 1 refused (the reason on stderr, nothing written) · 2 malformed input.
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runArgs } from "../core/argv.mjs";
import { applyDelta } from "../shapeup/learn.mjs";
import { activeOrder } from "../shapeup/paths.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb apply --slug <slug> --delta <path> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  delta: { type: "path", required: true },
  cwd: { type: "path" },
};

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  let live = null;
  try { const ptr = JSON.parse(readFileSync(activeOrder(cwd), "utf8")); live = ptr.slug === args.slug ? JSON.parse(readFileSync(ptr.order_path, "utf8")) : null; } catch { /* none open */ }
  if (live?.operation !== "learn") { console.error("✋ kb apply: no `learn` order of this run is open — open one first, so the fence covers the write."); process.exit(1); }
  let delta;
  try { delta = JSON.parse(readFileSync(args.delta, "utf8")); } catch (e) { console.error(`kb apply: --delta is not readable JSON (${e.message})`); process.exit(2); }
  const r = applyDelta({ cwd, slug: args.slug, delta });
  if (!r.ok) { for (const p of r.problems) console.error(`✋ kb apply: ${p}`); console.log(JSON.stringify({ ok: false, problems: r.problems })); process.exit(1); }
  console.log(JSON.stringify({ ok: true, applied: r.applied }));
  process.exit(0);
}
