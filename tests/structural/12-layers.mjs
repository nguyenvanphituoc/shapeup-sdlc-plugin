// The layer boundary, read from the import graph: the mechanism the runtime holds (core) must not
// reach the Shape Up data it is handed (adapter) or the hooks that call it, and must not name a
// Shape Up root, ref namespace or gate id.
//
// Dependencies point one way: hooks -> core and adapter; adapter -> core; never the reverse. The
// modules that are headed for the core but have not moved yet are listed in PENDING_CORE, and what
// they violate today is a shrinking list in layers-expected.json: a stage may remove entries, and a
// violation not on the list fails. A listed entry that no longer occurs fails too, so the list
// cannot go stale. Regenerate with UPDATE_LAYERS=shrink (drops entries that are gone; adds none).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { captureRefusals } from "../lib/refusals.mjs";

// Modules whose mechanism belongs in kernel/core/ and have not moved there yet.
const PENDING_CORE = [];
const DOMAIN_LITERALS = {
  "shapeup-name": /shapeup/i,
  "refs-namespace": /refs\//,
  "registry-schema": /domain\.schema/,
  "gate-id": /["'`](?:L0|L1a|L1a\.5|L1b|L2|L3|L4|QA|H|COACH-1)["'`]/,
};

const walkMjs = (root, rel, acc = []) => {
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    const p = `${rel}/${e.name}`;
    if (e.isDirectory()) walkMjs(root, p, acc);
    else if (e.name.endsWith(".mjs")) acc.push(p);
  }
  return acc;
};

export function layerOf(file) {
  if (file.startsWith("kernel/core/") || PENDING_CORE.includes(file)) return "core";
  if (file.startsWith("hooks/") || file.startsWith("bin/")) return "hooks";
  return "shapeup";
}
const ALLOWED = { hooks: ["hooks", "shapeup", "core"], shapeup: ["shapeup", "core"], core: ["core"] };

export function scan(ROOT) {
  const files = [...walkMjs(ROOT, "kernel"), ...walkMjs(ROOT, "hooks")].sort();
  const found = new Map(); // entry -> count
  const add = (k, n = 1) => found.set(k, (found.get(k) || 0) + n);
  const mixed = [];
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), "utf8");
    const layer = layerOf(f);
    const specs = [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["'](\.[^"']+)["']/g), ...text.matchAll(/(?:^|\n)\s*import\s+["'](\.[^"']+)["']/g), ...text.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g)];
    for (const m of specs) {
      const dst = relative(ROOT, resolve(dirname(join(ROOT, f)), m[1])).split("\\").join("/");
      if (!/^(kernel|hooks|bin)\//.test(dst)) continue;
      const upward = f.startsWith("kernel/") && dst.startsWith("hooks/"); // the kernel must not depend on the hooks
      if (upward || !ALLOWED[layer].includes(layerOf(dst))) add(`edge: ${f} -> ${dst}`);
    }
    if (layer === "core") {
      for (const [kind, re] of Object.entries(DOMAIN_LITERALS)) {
        const n = text.split("\n").filter((l) => re.test(l)).length;
        if (n) add(`literal: ${f} :: ${kind}`, n);
      }
    }
    if (/^export\s[^;\n]*\sfrom\s/m.test(text) && /^export\s+(?:async\s+)?(?:function|const|class|let)\s/m.test(text)) mixed.push(f);
  }
  return { found, mixed };
}

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
  section("layers — the core imports nothing above it and names no domain");
  const expectedPath = join(ROOT, "tests/structural/layers-expected.json");
  const { found, mixed } = scan(ROOT);
  const mode = process.env.UPDATE_LAYERS;
  if (mode === "init") writeFileSync(expectedPath, JSON.stringify(Object.fromEntries([...found].sort()), null, 2) + "\n");
  const expected = existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, "utf8")) : {};
  if (mode === "shrink") {
    const kept = Object.fromEntries(Object.entries(expected).filter(([k]) => found.has(k)).map(([k, n]) => [k, Math.min(n, found.get(k))]));
    writeFileSync(expectedPath, JSON.stringify(kept, null, 2) + "\n");
    for (const k of Object.keys(expected)) if (!(k in kept)) delete expected[k];
    Object.assign(expected, kept);
  }
  const added = [...found].filter(([k, n]) => !(k in expected) || n > expected[k]).map(([k]) => k);
  const gone = Object.keys(expected).filter((k) => !found.has(k) || found.get(k) < expected[k]);
  check(added.length === 0, `no layer violation beyond the expected list${added.length ? ": " + added.join("; ") : ""}`);
  check(gone.length === 0, `every expected violation still occurs (remove the ones a stage fixed)${gone.length ? ": " + gone.join("; ") : ""}`);
  check(mixed.length === 0, `no module both defines and re-exports (a facade is only re-exports)${mixed.length ? ": " + mixed.join(", ") : ""}`);

  section("golden — every refusal and denial string the gate, fence and envelope emit is unchanged");
  const goldenPath = join(ROOT, "tests/golden/refusals.json");
  const now = captureRefusals(ROOT);
  if (process.env.UPDATE_GOLDEN === "1") writeFileSync(goldenPath, JSON.stringify(now, null, 2) + "\n");
  const golden = existsSync(goldenPath) ? JSON.parse(readFileSync(goldenPath, "utf8")) : {};
  const drift = Object.keys({ ...golden, ...now }).filter((k) => JSON.stringify(golden[k]) !== JSON.stringify(now[k]));
  check(Object.keys(golden).length > 20, `the golden file holds ${Object.keys(golden).length} captured refusals`);
  check(drift.length === 0, `no refusal string moved${drift.length ? ": " + drift.join(", ") : ""}`);
}
