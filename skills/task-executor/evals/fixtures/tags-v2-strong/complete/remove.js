import { resolveSelectors } from "./selectors.js";
import { read, write } from "../store/json-store.js";
import { refuse } from "../render/errors.js";

export function removeTodos(rest) {
  const items = read();
  const picked = resolveSelectors(rest, items.length);
  if (picked.error) return refuse(picked.error);
  const drop = new Set(picked.indexes);
  write(items.filter((_, n) => !drop.has(n)));
  return 0;
}
