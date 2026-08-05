// Reachable: dispatch.js imports this one.
import { read, write } from "../store/json-store.js";
import { line } from "../render/lines.js";

export function archiveDone() {
  const items = read();
  const keep = items.filter((i) => !i.done);
  write(keep);
  process.stdout.write(line(`archived ${items.length - keep.length} completed todo(s)`));
  return 0;
}
