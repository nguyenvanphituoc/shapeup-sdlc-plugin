// Applying an install plan. A step PLANS — it returns operations and touches nothing — and this file
// is the only place they are carried out, which is what makes `--dry-run` a different call to the same
// plan and a second run a no-op: every write compares bytes first and says "unchanged" when nothing moves.
//
// Operations:
//   { op: "write",  path, content, created?, kept? }  create or replace a whole file
//   { op: "append", path, content, note? }            add text to the end of an existing file
//   { op: "mkdir",  path }
//   { op: "copy",   from, to, note? }                 copy one file, never over itself
//   { op: "note",   text }                            a line for the reader, written to no file
//   { op: "run",    describe, fn }                    an act that is not a file write (a CLI call)
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, appendFileSync, realpathSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Carry out a plan.
 * @param {object[]} ops - Operations, in order.
 * @param {{dryRun?: boolean, log?: function(string): void}} [o] - `dryRun` prints and writes nothing.
 * @returns {{changed: number, unchanged: number}} How many file operations moved bytes.
 */
export function apply(ops, { dryRun = false, log = console.log } = {}) {
  let changed = 0, unchanged = 0;
  for (const o of ops) {
    if (o.op === "note") { log(o.text); continue; }
    if (o.op === "run") { if (dryRun) log(`[dry-run] ${o.describe}`); else o.fn(); continue; }
    if (dryRun) { log(`[dry-run] ${o.op} ${o.path ?? o.to}`); continue; }
    if (o.op === "mkdir") { mkdirSync(o.path, { recursive: true }); continue; }
    if (o.op === "write") {
      const before = existsSync(o.path) ? readFileSync(o.path, "utf8") : null;
      if (before === o.content) { unchanged++; continue; }
      mkdirSync(dirname(o.path), { recursive: true });
      writeFileSync(o.path, o.content);
      changed++;
      if (o.note) log(o.note);
    } else if (o.op === "append") {
      appendFileSync(o.path, o.content);
      changed++;
      if (o.note) log(o.note);
    } else if (o.op === "copy") {
      // Self-install: the target may be the plugin's own checkout, reached through a symlinked temp
      // root, so the comparison is on real paths. cpSync throws on a file copied over itself.
      if (existsSync(o.to) && (o.from === o.to || realpathSync(o.from) === realpathSync(o.to))) { unchanged++; if (o.same) log(o.same); continue; }
      mkdirSync(dirname(o.to), { recursive: true });
      cpSync(o.from, o.to);
      changed++;
      if (o.note) log(o.note);
    }
  }
  return { changed, unchanged };
}
