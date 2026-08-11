#!/usr/bin/env node
// Kill/resume probe instrument — hash every artifact a run produces, so the two legs can be
// compared as set operations rather than by reading a transcript.
//
// usage: node snapshot.mjs <project-root> <slug> <out.json>

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const [root, slug, out] = process.argv.slice(2);
if (!root || !slug || !out) {
  console.error("usage: snapshot.mjs <project-root> <slug> <out.json>");
  process.exit(2);
}

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile()) acc.push(p);
  }
  return acc;
}

const files = {};
for (const dir of [join(root, ".shapeup", slug), join(root, "shapeup", slug)]) {
  for (const p of walk(dir)) {
    files[relative(root, p)] = { sha256: sha(p), size: statSync(p).size };
  }
}

const localRoot = join(root, ".shapeup", slug);
const orders = existsSync(join(localRoot, "orders")) ? readdirSync(join(localRoot, "orders")).filter((f) => f.endsWith(".json")).sort() : [];
const results = existsSync(join(localRoot, "results")) ? readdirSync(join(localRoot, "results")).filter((f) => f.endsWith(".json")).sort() : [];
const verdictsDir = join(localRoot, "t0", "verdicts");
const verdicts = existsSync(verdictsDir) ? readdirSync(verdictsDir).filter((f) => f.endsWith(".json")).sort() : [];

// Green (scope, round) pairs, read out of each verdict artifact — the claim assertion 2 is phrased
// over, because an order filename is not an audit trail (see stage2-evidence.md §4).
const green = [];
for (const v of verdicts) {
  try {
    const b = JSON.parse(readFileSync(join(verdictsDir, v), "utf8"));
    if (b.overall === "green") green.push({ file: v, scope_id: b.scope_id ?? null, round: b.round ?? null });
  } catch { /* an unreadable verdict is reported by its hash alone */ }
}

writeFileSync(out, `${JSON.stringify({
  root, slug, files,
  orders, results,
  completed_phase_orders: orders.filter((o) => results.includes(o)),
  pending_orders: orders.filter((o) => !results.includes(o)),
  verdicts, green_verdicts: green,
  active_scope: existsSync(join(root, ".shapeup", "active-scope")) ? readFileSync(join(root, ".shapeup", "active-scope"), "utf8").trim() : null,
  run_status: (() => {
    const p = join(localRoot, "harness-run.md");
    if (!existsSync(p)) return null;
    const m = /^status:\s*(.*)$/m.exec(readFileSync(p, "utf8"));
    return m ? m[1].trim() : null;
  })(),
}, null, 2)}\n`);

console.log(`${Object.keys(files).length} files · ${orders.length} orders · ${results.length} results · ${verdicts.length} verdicts (${green.length} green)`);
