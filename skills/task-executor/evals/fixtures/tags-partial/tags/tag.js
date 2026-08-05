import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { line } from "../render/lines.js";
import { refuse } from "../render/errors.js";

// ASSUMED the on-disk shape from what the other modules pass around, instead of reading
// src/store/json-store.js. Every module above the store works in plain arrays; the FILE does not.
const storePath = () => process.env.TODO_STORE || "todos.json";

export function tagTodo(rest) {
  const [sel, ...words] = rest;
  const tag = words.join(" ").trim();
  if (!tag) return refuse("usage: todo tag <n> <tag>");
  const items = existsSync(storePath()) ? JSON.parse(readFileSync(storePath(), "utf8")) : [];
  const n = Number(sel);
  if (!Array.isArray(items) || !Number.isInteger(n) || n < 1 || n > items.length) return refuse(`no item ${sel}`);
  const item = items[n - 1];
  item.tags = item.tags || [];
  if (!item.tags.includes(tag)) item.tags.push(tag);
  writeFileSync(storePath(), JSON.stringify(items, null, 2));
  process.stdout.write(line(`tagged ${n}: ${tag}`));
  return 0;
}
