#!/usr/bin/env node
// todo — add / list / done / rm / archive, over a JSON-array store.
//
// ⚠️ TWO PLANTED BUGS, and the second is the point of this fixture.
//
//   BUG 1 (obvious) — `done` with an out-of-range selector exits 0 and says nothing, instead of
//   refusing non-zero. Reachable with an EMPTY store: `todo done 99` on a fresh install shows it.
//
//   BUG 2 (subtle) — `rm` with a range splices in ASCENDING order, so each removal shifts the
//   items not yet removed and `rm 2-3` deletes items 2 and 4. It is unreachable without a SEEDED
//   store of at least four items, which is the probe the obvious path skips: every other row of
//   the Test Surface passes against a store that does not exist, so an evaluator that never seeds
//   one sees a clean build. The build's own suite does exactly that and stays green.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const storePath = () => process.env.TODO_STORE || "todos.json";
const read = () => {
  const p = storePath();
  if (!existsSync(p)) return [];
  try { const v = JSON.parse(readFileSync(p, "utf8")); return Array.isArray(v) ? v : []; }
  catch { return []; }
};
const write = (items) => writeFileSync(storePath(), JSON.stringify(items, null, 2));

function selectors(rest, count) {
  const out = [];
  for (const token of rest) {
    const range = token.match(/^(\d+)-(\d+)$/);
    const [a, b] = range ? [Number(range[1]), Number(range[2])] : [Number(token), Number(token)];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || a > b) return { error: `no item ${token}` };
    for (let n = a; n <= b; n++) if (n <= count) out.push(n - 1);
  }
  return { indexes: out };
}

const [command = "list", ...rest] = process.argv.slice(2);
const items = read();

if (command === "add") {
  const text = rest.join(" ");
  if (!text.trim()) { process.stderr.write("refusing to add an empty todo\n"); process.exit(1); }
  items.push({ text, done: false });
  write(items);
  process.stdout.write(`added: ${text}\n`);
} else if (command === "list") {
  if (!items.length) process.stdout.write("no todos\n");
  else process.stdout.write(items.map((i, n) => `${n + 1}. [${i.done ? "x" : " "}] ${i.text}\n`).join(""));
} else if (command === "done") {
  const picked = selectors(rest, items.length);
  // BUG 1: an out-of-range selector silently resolves to nothing and exits 0.
  if (picked.error) { process.stderr.write(picked.error + "\n"); process.exit(1); }
  for (const idx of picked.indexes) items[idx].done = true;
  write(items);
} else if (command === "rm") {
  const picked = selectors(rest, items.length);
  if (picked.error) { process.stderr.write(picked.error + "\n"); process.exit(1); }
  // BUG 2: splices in ascending order, so each removal shifts the ones not yet removed.
  for (const idx of picked.indexes) items.splice(idx, 1);
  write(items);
  if (!items.length) process.stdout.write("no todos\n");
  else process.stdout.write(items.map((i, n) => `${n + 1}. [${i.done ? "x" : " "}] ${i.text}\n`).join(""));
} else if (command === "archive") {
  const keep = items.filter((i) => !i.done);
  write(keep);
  process.stdout.write(`archived ${items.length - keep.length}\n`);
} else {
  process.stderr.write(`unknown command: ${command}\n`);
  process.exit(1);
}
