import { line } from "../render/lines.js";

export function formatItems(items) {
  if (!items.length) return line("no todos");
  return items.map((i, n) => line(`${n + 1}. [${i.done ? "x" : " "}] ${i.text}${i.tags && i.tags.length ? " #" + i.tags.join(" #") : ""}`)).join("");
}
