#!/usr/bin/env node
// harness kb review — what the runs so far say about each rule on probation.
//
//   harness.mjs kb review --slug <slug> [--apply] [--cwd <dir>]
//
// Without --apply it only reports. With --apply it promotes, expires or retires — a change of the rule file's
// `status` and nothing else — and it runs only while a `learn` order of this run is open, so the fence covers
// the write. A rule retired because its class came back is also filed to the defect register.
// Exit 0 · 1 refused · 2 malformed input.
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runArgs } from "../core/argv.mjs";
import { review } from "../shapeup/probation.mjs";
import { applyReview } from "../shapeup/learn.mjs";
import { activeOrder } from "../shapeup/paths.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb review --slug <slug> [--apply] [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  apply: { type: "flag" },
  cwd: { type: "path" },
};

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  if (!args.apply) { console.log(JSON.stringify({ ok: true, rules: review(cwd, args.slug) }, null, 2)); process.exit(0); }
  let live = null;
  try { const ptr = JSON.parse(readFileSync(activeOrder(cwd), "utf8")); live = ptr.slug === args.slug ? JSON.parse(readFileSync(ptr.order_path, "utf8")) : null; } catch { /* none */ }
  if (live?.operation !== "learn") { console.error("✋ kb review --apply: no `learn` order of this run is open — open one first, so the fence covers the write."); process.exit(1); }
  const r = applyReview({ cwd, slug: args.slug });
  if (!r.ok) { for (const p of r.problems) console.error(`✋ kb review: ${p}`); process.exit(1); }
  console.log(JSON.stringify({ ok: true, applied: r.applied }));
  process.exit(0);
}
