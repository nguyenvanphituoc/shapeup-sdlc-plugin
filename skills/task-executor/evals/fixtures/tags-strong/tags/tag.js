import { read, write } from "../store/json-store.js";
import { line } from "../render/lines.js";
import { refuse } from "../render/errors.js";

// Works in PLAIN ARRAYS, like every other module above the store: json-store.read() unwraps the
// on-disk envelope and write() re-wraps it. Nothing here needs to know the file's shape.
export function tagTodo(rest) {
  const [sel, ...words] = rest;
  const tag = words.join(" ").trim();
  if (!tag) return refuse("usage: todo tag <n> <tag>");
  const items = read();
  const n = Number(sel);
  if (!Number.isInteger(n) || n < 1 || n > items.length) return refuse(`no item ${sel}`);
  const item = items[n - 1];
  item.tags = item.tags || [];
  if (!item.tags.includes(tag)) item.tags.push(tag);
  write(items);
  process.stdout.write(line(`tagged ${n}: ${tag}`));
  return 0;
}
