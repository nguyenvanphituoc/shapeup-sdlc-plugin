import { read } from "../store/json-store.js";
import { formatItems } from "./format.js";

export function searchTodos(rest) {
  const needle = rest.join(" ").toLowerCase();
  const items = read().filter((i) => i.text.toLowerCase().includes(needle));
  process.stdout.write(formatItems(items));
  return 0;
}
