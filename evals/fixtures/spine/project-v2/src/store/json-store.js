import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { storePath } from "./paths.js";

// The on-disk shape is an ENVELOPE: {"v":1,"items":[...]}. It is versioned because the store used
// to be a bare array and `migrate()` still lifts that older form. Everything above this module
// works in plain item arrays and never sees the envelope — read() unwraps, write() re-wraps.
const EMPTY = { v: 1, items: [] };

function migrate(raw) {
  if (Array.isArray(raw)) return { v: 1, items: raw };          // the pre-v1 bare array
  if (raw && typeof raw === "object" && Array.isArray(raw.items)) return { v: 1, items: raw.items };
  return EMPTY;
}

export function read() {
  const p = storePath();
  if (!existsSync(p)) return [];
  try { return migrate(JSON.parse(readFileSync(p, "utf8"))).items; }
  catch { return []; }
}

export function write(items) {
  writeFileSync(storePath(), JSON.stringify({ v: 1, items }, null, 2));
}
