import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { storePath } from "./paths.js";

// REWROTE the shared store to a bare array, because that is the shape the new command wanted.
// Nothing checked who else depended on the envelope.
export function read() {
  const p = storePath();
  if (!existsSync(p)) return [];
  try { const v = JSON.parse(readFileSync(p, "utf8")); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
export function write(items) { writeFileSync(storePath(), JSON.stringify(items, null, 2)); }
