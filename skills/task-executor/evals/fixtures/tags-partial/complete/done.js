import { resolveSelectors } from "./selectors.js";
import { read, write } from "../store/json-store.js";
import { refuse } from "../render/errors.js";

export function markDone(rest) {
  const items = read();
  const picked = resolveSelectors(rest, items.length);
  if (picked.error) return refuse(picked.error);
  for (const idx of picked.indexes) items[idx].done = true;
  write(items);
  return 0;
}
