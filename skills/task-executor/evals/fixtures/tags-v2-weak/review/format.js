import { line } from "../render/lines.js";

// The renderer already knows how to show tags — it was written for a tagging feature that never
// shipped, so `i.tags` is the field name an item carries them under. Nothing currently PUTS one
// there; no command attaches a tag.
export function formatItems(items) {
  if (!items.length) return line("no todos");
  return items.map((i, n) => {
    const tags = Array.isArray(i.tags) && i.tags.length ? ` ${i.tags.map((t) => `#${t}`).join(" ")}` : "";
    return line(`${n + 1}. [${i.done ? "x" : " "}] ${i.text}${tags}`);
  }).join("");
}
