import { validateText } from "./validate.js";
import { read, write } from "../store/json-store.js";
import { line } from "../render/lines.js";

export function addTodo(rest) {
  const text = rest.join(" ");
  const bad = validateText(text);
  if (bad) { process.stderr.write(bad + "\n"); return 1; }
  const items = read();
  items.push({ text, done: false });
  write(items);
  process.stdout.write(line(`added: ${text}`));
  return 0;
}
