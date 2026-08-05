import { read } from "../store/json-store.js";
import { formatItems } from "./format.js";

export function listTodos() {
  const items = read();
  process.stdout.write(formatItems(items));
  return 0;
}
